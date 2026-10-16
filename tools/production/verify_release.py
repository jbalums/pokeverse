"""Read-only checks for Verdant planning inventories and local source releases.

This is project-local tooling, not a game-dev package verifier or admission
receipt. Passing static checks never establishes Unreal import, visual approval,
license clearance, or game readiness. All paths in a source release are relative
POSIX paths beneath its manifest directory; the manifest alone is exempt from
the closed SHA256 file roster.
"""
from __future__ import annotations

import argparse
from collections import Counter
import copy
import hashlib
import json
import math
import os
from pathlib import Path, PurePosixPath, PureWindowsPath
import re
import struct
from typing import Any


RELEASE_SCHEMA = "verdant.source-release.v1"
INVENTORY_SCHEMA = "verdant.asset-planning.v1"
SHA256 = re.compile(r"^[0-9a-f]{64}$")
COMPONENTS = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2),
              5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
ELEMENTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4,
            "MAT2": 4, "MAT3": 9, "MAT4": 16}


class Check:
    def __init__(self) -> None:
        self.errors: list[dict[str, str]] = []
        self.warnings: list[dict[str, str]] = []

    def error(self, code: str, message: str, location: str = "") -> None:
        self.errors.append({"code": code, "location": location, "message": message})

    def warning(self, code: str, message: str, location: str = "") -> None:
        self.warnings.append({"code": code, "location": location, "message": message})

    def result(self, **details: Any) -> dict[str, Any]:
        return {"valid": not self.errors, "errors": self.errors,
                "warnings": self.warnings, **details}


def integer(value: Any, minimum: int = 0) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value >= minimum


def finite_list(value: Any, size: int) -> bool:
    return (isinstance(value, list) and len(value) == size and
            all(isinstance(v, (int, float)) and not isinstance(v, bool) and
                math.isfinite(v) for v in value))


def _reject_constant(value: str) -> None:
    raise ValueError(f"Non-finite JSON number: {value}")


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON object key: {key}")
        result[key] = value
    return result


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8-sig"), parse_constant=_reject_constant,
                       object_pairs_hook=_unique_object)
    if not isinstance(value, dict):
        raise ValueError("Expected a JSON object")
    return value


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def contained_file(root: Path, relative: Any) -> Path:
    """Resolve a portable file path; refuse traversal, ADS and link escapes."""
    if not isinstance(relative, str) or not relative or "\\" in relative:
        raise ValueError("A nonempty relative POSIX path is required")
    portable = PurePosixPath(relative)
    windows = PureWindowsPath(relative)
    if (portable.is_absolute() or windows.drive or ":" in relative or
            any(part in ("", ".", "..") for part in relative.split("/"))):
        raise ValueError("Absolute paths, traversal and noncanonical paths are forbidden")
    for part in portable.parts:
        # Windows strips trailing spaces/dots and reserves device names even
        # with extensions. Refuse aliases before hashing the intended bytes.
        stem = part.split(".", 1)[0].upper()
        if (part.endswith((" ", ".")) or any(ord(char) < 32 for char in part) or
                stem in {"CON", "PRN", "AUX", "NUL", "CONIN$", "CONOUT$"} or
                re.fullmatch(r"(?:COM|LPT)[1-9]", stem)):
            raise ValueError("Windows device names and path aliases are forbidden")
    root = root.resolve()
    target = root.joinpath(*portable.parts)
    if not target.resolve().is_relative_to(root):
        raise ValueError("The resolved path escapes its root")
    # Refuse even in-root links: a portable roster must name actual release bytes.
    current = root
    for part in portable.parts:
        current = current / part
        if current.is_symlink() or (hasattr(current, "is_junction") and current.is_junction()):
            raise ValueError("Symlinks and junctions are not portable release files")
    return target


def resolve_inventory(document: dict[str, Any]) -> list[dict[str, Any]]:
    """Apply the documented shallow precedence: defaults, profile, then row.

    Arrays are replaced by an override, not concatenated. Return independent
    copies so checking or consuming the resolved rows cannot mutate the plan.
    """
    defaults = document.get("entry_defaults", {})
    profiles = document.get("technical_profiles", {})
    if not isinstance(defaults, dict) or not isinstance(profiles, dict):
        raise ValueError("entry_defaults and technical_profiles must be objects")
    rows = document.get("inventory")
    if not isinstance(rows, list):
        raise ValueError("inventory must be an array")
    resolved = []
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("Every inventory row must be an object")
        profile = row.get("profile")
        if not isinstance(profile, str) or not isinstance(profiles.get(profile), dict):
            raise ValueError(f"Unknown or invalid technical profile: {profile!r}")
        resolved.append(copy.deepcopy({**defaults, **profiles[profile], **row}))
    return resolved


def verify_inventory(path: Path) -> dict[str, Any]:
    check = Check()
    path = Path(path).resolve()
    try:
        document = load_json(path)
        if document.get("schema") != INVENTORY_SCHEMA:
            check.error("inventory_schema", f"Expected {INVENTORY_SCHEMA}", "schema")
        rows = resolve_inventory(document)
    except (OSError, ValueError, TypeError) as exc:
        check.error("inventory_read", str(exc), str(path))
        return check.result(path=str(path))

    identifiers: dict[str, dict[str, Any]] = {}
    units: Counter[str] = Counter()
    usage: Counter[str] = Counter()
    completion: Counter[str] = Counter()
    for index, row in enumerate(rows):
        location = f"inventory[{index}]"
        identifier = row.get("id")
        if not isinstance(identifier, str) or not identifier.strip():
            check.error("inventory_id", "A nonempty ID is required", location)
        elif identifier in identifiers:
            check.error("duplicate_id", f"Duplicate inventory ID: {identifier}", location)
        else:
            identifiers[identifier] = row
        quantity, variants = row.get("quantity"), row.get("variants")
        if not integer(quantity, 1):
            check.error("quantity", "quantity must be a positive integer", location)
        if (not isinstance(variants, list) or
                not all(isinstance(v, str) and v for v in variants)):
            check.error("variants", "variants must be an array of nonempty names", location)
        elif len(variants) != len(set(variants)):
            check.error("duplicate_variant", "Variant names must be unique in a row", location)
        elif quantity != len(variants):
            check.error("quantity_variants", "quantity must equal named variant count", location)
        unit = row.get("unit")
        if not isinstance(unit, str) or not unit:
            check.error("unit", "A declared quantity unit is required", location)
        elif integer(quantity, 1):
            units[unit] += quantity
        for key in ("dependencies", "decision_dependencies"):
            items = row.get(key)
            if (not isinstance(items, list) or
                    not all(isinstance(item, str) and item for item in items)):
                check.error("dependencies", f"{key} must contain nonempty strings", location)
            elif len(items) != len(set(items)):
                check.error("duplicate_dependency", f"Duplicate {key}", location)
        decisions = row.get("decision_dependencies", [])
        if (not isinstance(decisions, list) or not all(isinstance(d, str) for d in decisions)
                or not {"L0", "L1"}.issubset(decisions)):
            check.error("universal_locks", "Each resolved row must retain L0 and L1", location)
        # Unknown and unassessed usage states remain verbatim, never upgraded.
        for key, counter in (("usage_status", usage), ("completion_status", completion)):
            value = row.get(key)
            if not isinstance(value, str) or not value:
                check.error("status", f"A string {key} is required", location)
            else:
                counter[value] += 1

    adjacency = {}
    for identifier, row in identifiers.items():
        dependencies = row.get("dependencies", [])
        dependencies = dependencies if isinstance(dependencies, list) else []
        adjacency[identifier] = [d for d in dependencies if isinstance(d, str)]
        for dependency in adjacency[identifier]:
            if dependency not in identifiers:
                check.error("unknown_dependency", f"Unknown dependency: {dependency}", identifier)
    # Iterative DFS avoids recursion failures on malformed or very large plans.
    visited, active, ordering = set(), set(), []
    for start in adjacency:
        stack = [(start, False)]
        while stack:
            identifier, leaving = stack.pop()
            if leaving:
                active.discard(identifier)
                if identifier not in visited:
                    visited.add(identifier)
                    ordering.append(identifier)
                continue
            if identifier in active:
                check.error("dependency_cycle", f"Dependency cycle reaches {identifier}", identifier)
                continue
            if identifier in visited or identifier not in adjacency:
                continue
            active.add(identifier)
            stack.append((identifier, True))
            stack.extend((d, False) for d in reversed(adjacency[identifier]))

    bundles = document.get("proof_bundles", [])
    bundle_ids = set()
    if not isinstance(bundles, list):
        check.error("proof_bundles", "proof_bundles must be an array")
        bundles = []
    for bundle in bundles:
        if not isinstance(bundle, dict) or not isinstance(bundle.get("id"), str):
            check.error("proof_bundle", "Every proof bundle needs an ID")
            continue
        if bundle["id"] in bundle_ids:
            check.error("duplicate_bundle", f"Duplicate proof bundle: {bundle['id']}")
        bundle_ids.add(bundle["id"])
        references = bundle.get("inventory_ids")
        if not isinstance(references, list) or not references:
            check.error("proof_bundle", "Proof bundle needs inventory_ids", bundle["id"])
            continue
        for reference in references:
            if not isinstance(reference, str) or reference not in identifiers:
                check.error("unknown_bundle_asset", f"Unknown inventory ID: {reference!r}", bundle["id"])

    for name in ("plan", "brief"):
        if name in document:
            try:
                linked = contained_file(path.parent, document[name])
                if not linked.is_file():
                    check.error("missing_document", f"Missing {name}: {document[name]}", name)
            except (OSError, ValueError) as exc:
                check.error("document_path", str(exc), name)
    reference = document.get("reference")
    if isinstance(reference, dict):
        try:
            source = contained_file(path.parent, reference.get("path"))
            expected = reference.get("sha256")
            if not isinstance(expected, str) or not SHA256.fullmatch(expected):
                check.error("reference_digest", "Reference SHA256 must be 64 lowercase hex characters")
            elif not source.is_file():
                check.error("reference_missing", "Reference file is missing", str(source))
            elif sha256_file(source) != expected:
                check.error("reference_digest", "Reference SHA256 differs from the frozen reference", str(source))
        except (OSError, ValueError) as exc:
            check.error("reference_path", str(exc), "reference")
    return check.result(path=str(path), schema=document.get("schema"), entry_count=len(rows),
                        ids=list(identifiers), dependency_order=ordering,
                        quantities_by_unit=dict(sorted(units.items())),
                        usage_status_counts=dict(sorted(usage.items())),
                        completion_status_counts=dict(sorted(completion.items())),
                        proof_bundle_count=len(bundles),
                        locks="required_declarations_checked_decisions_not_approved")


def inspect_glb(path: Path) -> dict[str, Any]:
    """Inspect embedded GLB 2 bytes without importing or modifying the model.

    Sparse accessors and compressed mesh extensions are reported unsupported;
    silently ignoring their payload would give misleading geometry checks.
    Bounds are explicitly local POSITION bounds before node transforms.
    """
    check = Check()
    stats: dict[str, Any] = {}
    try:
        payload = Path(path).read_bytes()
        if len(payload) < 20:
            raise ValueError("Truncated GLB header or first chunk")
        magic, version, length = struct.unpack_from("<4sII", payload)
        if magic != b"glTF" or version != 2 or length != len(payload):
            raise ValueError("Expected GLB 2 magic/version and exact declared file length")
        chunks, offset = [], 12
        while offset < len(payload):
            if offset + 8 > len(payload):
                raise ValueError("Truncated GLB chunk header")
            size, kind = struct.unpack_from("<II", payload, offset)
            offset += 8
            if size % 4 or offset + size > len(payload):
                raise ValueError("GLB chunk length is unaligned or outside the file")
            chunks.append((kind, payload[offset:offset + size]))
            offset += size
        if not chunks or chunks[0][0] != 0x4E4F534A:
            raise ValueError("The first GLB chunk must be JSON")
        if sum(kind == 0x4E4F534A for kind, _ in chunks) != 1:
            raise ValueError("GLB must have exactly one JSON chunk")
        bins = [data for kind, data in chunks if kind == 0x004E4942]
        if len(bins) > 1:
            raise ValueError("GLB permits at most one BIN chunk")
        document = json.loads(chunks[0][1].decode("utf-8"), parse_constant=_reject_constant,
                              object_pairs_hook=_unique_object)
        if not isinstance(document, dict) or document.get("asset", {}).get("version") != "2.0":
            raise ValueError("GLB JSON must declare asset.version 2.0")
        binary = bins[0] if bins else b""
        buffers = document.get("buffers", [])
        if not isinstance(buffers, list) or len(buffers) > 1:
            raise ValueError("Only a single embedded GLB buffer is supported")
        declared = 0
        if buffers:
            buffer = buffers[0]
            if not isinstance(buffer, dict) or "uri" in buffer:
                raise ValueError("GLB buffer must be embedded; external/data URI buffers are unsupported")
            declared = buffer.get("byteLength")
            if not integer(declared) or declared > len(binary) or len(binary) - declared > 3:
                raise ValueError("Embedded buffer byteLength is outside BIN bounds/padding")
        elif binary:
            raise ValueError("BIN payload has no declared buffer")
        views = document.get("bufferViews", [])
        accessors = document.get("accessors", [])
        if not isinstance(views, list) or not isinstance(accessors, list):
            raise ValueError("bufferViews and accessors must be arrays")
        valid_views = {}
        for index, view in enumerate(views):
            location = f"bufferViews[{index}]"
            if not isinstance(view, dict):
                check.error("glb_buffer_view", "bufferView must be an object", location)
                continue
            start, size = view.get("byteOffset", 0), view.get("byteLength")
            stride = view.get("byteStride")
            if (view.get("buffer") != 0 or not buffers or not integer(start) or
                    not integer(size, 1) or start + size > declared):
                check.error("glb_buffer_view", "bufferView exceeds its declared embedded buffer", location)
                continue
            if stride is not None and (not integer(stride, 4) or stride > 252 or stride % 4):
                check.error("glb_stride", "byteStride must be a multiple of four between 4 and 252", location)
                continue
            valid_views[index] = (start, size, stride)
        images = document.get("images", [])
        if not isinstance(images, list):
            raise ValueError("images must be an array")
        for index, image in enumerate(images):
            location = f"images[{index}]"
            if not isinstance(image, dict):
                check.error("glb_image", "Image must be an object", location)
                continue
            if "uri" in image:
                check.error("glb_external_image", "Portable GLB images must use embedded bufferViews; URI image inspection is unsupported", location)
            image_view = image.get("bufferView")
            if not integer(image_view) or image_view not in valid_views:
                check.error("glb_image", "Embedded image needs a valid bufferView", location)
            if not isinstance(image.get("mimeType"), str) or not image["mimeType"].startswith("image/"):
                check.error("glb_image", "Embedded image needs an image MIME type", location)
        decoded = {}
        for index, accessor in enumerate(accessors):
            location = f"accessors[{index}]"
            if not isinstance(accessor, dict):
                check.error("glb_accessor", "accessor must be an object", location)
                continue
            component, shape, count = accessor.get("componentType"), accessor.get("type"), accessor.get("count")
            if component not in COMPONENTS or shape not in ELEMENTS or not integer(count, 1):
                check.error("glb_accessor", "Invalid accessor componentType, type or count", location)
                continue
            if "sparse" in accessor:
                check.error("glb_sparse_unsupported", "Sparse accessor inspection is unsupported", location)
                continue
            code, component_bytes = COMPONENTS[component]
            element_bytes = component_bytes * ELEMENTS[shape]
            if shape.startswith("MAT"):
                dimension = int(shape[-1])
                element_bytes = ((dimension * component_bytes + 3) // 4 * 4) * dimension
            relative = accessor.get("byteOffset", 0)
            if not integer(relative) or relative % component_bytes:
                check.error("glb_accessor_alignment", "Accessor byteOffset is invalid or misaligned", location)
                continue
            view_index = accessor.get("bufferView")
            if view_index is None:
                if relative:
                    check.error("glb_accessor_bounds", "Unbacked accessor cannot have a byteOffset", location)
                    continue
                decoded[index] = (accessor, None, 0, element_bytes)
                continue
            if not integer(view_index) or view_index not in valid_views:
                check.error("glb_accessor_bounds", "Accessor references an invalid bufferView", location)
                continue
            start, size, stride = valid_views[view_index]
            stride = stride or element_bytes
            if ((start + relative) % component_bytes or stride < element_bytes or
                    stride % component_bytes or relative + (count - 1) * stride + element_bytes > size):
                check.error("glb_accessor_bounds", "Accessor exceeds or misaligns its bufferView", location)
                continue
            decoded[index] = (accessor, start + relative, component_bytes, stride)
            if component == 5126:
                # Matrices have no padding with float components.
                unpack = struct.Struct("<" + code * ELEMENTS[shape])
                for vertex in range(count):
                    if not all(math.isfinite(v) for v in unpack.unpack_from(binary, start + relative + vertex * stride)):
                        check.error("glb_nonfinite", "Accessor contains non-finite float values", location)
                        break
            for bound_name in ("min", "max"):
                if bound_name in accessor and not finite_list(accessor[bound_name], ELEMENTS[shape]):
                    check.error("glb_accessor_bounds_metadata", f"Invalid accessor {bound_name}", location)

        low, high = [math.inf] * 3, [-math.inf] * 3
        positions_seen, position_count, triangles, primitives = set(), 0, 0, 0
        meshes = document.get("meshes", [])
        if not isinstance(meshes, list):
            raise ValueError("meshes must be an array")
        for mesh_index, mesh in enumerate(meshes):
            if not isinstance(mesh, dict) or not isinstance(mesh.get("primitives"), list) or not mesh["primitives"]:
                check.error("glb_mesh", "Mesh needs a nonempty primitives array", f"meshes[{mesh_index}]")
                continue
            for primitive_index, primitive in enumerate(mesh["primitives"]):
                location = f"meshes[{mesh_index}].primitives[{primitive_index}]"
                if not isinstance(primitive, dict):
                    check.error("glb_primitive", "Primitive must be an object", location)
                    continue
                if any(ext in primitive.get("extensions", {}) for ext in ("KHR_draco_mesh_compression",)):
                    check.error("glb_compression_unsupported", "Compressed mesh inspection is unsupported", location)
                attributes = primitive.get("attributes", {})
                if not isinstance(attributes, dict):
                    check.error("glb_attributes", "attributes must be an object", location)
                    continue
                position_index = attributes.get("POSITION")
                if not integer(position_index) or position_index not in decoded:
                    check.error("glb_position", "Primitive needs a valid POSITION accessor", location)
                    continue
                position, position_offset, _, position_stride = decoded[position_index]
                if position["type"] != "VEC3" or position["componentType"] != 5126:
                    check.error("glb_position", "POSITION must be VEC3 float", location)
                    continue
                count = position["count"]
                for semantic, accessor_index in attributes.items():
                    if not integer(accessor_index) or accessor_index not in decoded:
                        check.error("glb_attribute", f"Invalid {semantic} accessor", location)
                    elif decoded[accessor_index][0]["count"] != count:
                        check.error("glb_attribute_count", f"{semantic} count differs from POSITION", location)
                if position_index not in positions_seen:
                    positions_seen.add(position_index)
                    position_count += count
                    if position_offset is None:
                        for axis in range(3):
                            low[axis], high[axis] = min(low[axis], 0), max(high[axis], 0)
                    else:
                        for vertex in range(count):
                            xyz = struct.unpack_from("<3f", binary, position_offset + vertex * position_stride)
                            if all(math.isfinite(v) for v in xyz):
                                for axis in range(3):
                                    low[axis], high[axis] = min(low[axis], xyz[axis]), max(high[axis], xyz[axis])
                index_count = count
                if "indices" in primitive:
                    index_ref = primitive["indices"]
                    if not integer(index_ref) or index_ref not in decoded:
                        check.error("glb_indices", "Invalid index accessor", location)
                    else:
                        indices, index_offset, _, index_stride = decoded[index_ref]
                        index_count = indices["count"]
                        if indices["type"] != "SCALAR" or indices["componentType"] not in (5121, 5123, 5125):
                            check.error("glb_indices", "Indices must be unsigned SCALAR values", location)
                        elif index_offset is not None:
                            unpack = struct.Struct("<" + COMPONENTS[indices["componentType"]][0])
                            for vertex in range(index_count):
                                if unpack.unpack_from(binary, index_offset + vertex * index_stride)[0] >= count:
                                    check.error("glb_index_bounds", "Index is outside POSITION vertex count", location)
                                    break
                mode = primitive.get("mode", 4)
                if not integer(mode) or mode > 6:
                    check.error("glb_primitive_mode", "Unknown primitive mode", location)
                elif mode == 4:
                    if index_count % 3:
                        check.error("glb_triangle_count", "Triangle index/vertex count must be divisible by three", location)
                    triangles += index_count // 3
                elif mode in (5, 6):
                    triangles += max(0, index_count - 2)
                primitives += 1

        nodes = document.get("nodes", [])
        if not isinstance(nodes, list):
            raise ValueError("nodes must be an array")
        nonidentity_scales = []
        for index, node in enumerate(nodes):
            if not isinstance(node, dict):
                check.error("glb_node", "Node must be an object", f"nodes[{index}]")
                continue
            for field, length in (("matrix", 16), ("translation", 3), ("rotation", 4), ("scale", 3)):
                if field in node and not finite_list(node[field], length):
                    check.error("glb_node_transform", f"Invalid finite {field}", f"nodes[{index}]")
            if "matrix" in node and any(field in node for field in ("translation", "rotation", "scale")):
                check.error("glb_node_transform", "matrix and TRS cannot coexist", f"nodes[{index}]")
            scale = node.get("scale", [1, 1, 1])
            if finite_list(scale, 3) and scale != [1, 1, 1]:
                nonidentity_scales.append({"node": index, "scale": scale})
            if "mesh" in node and (not integer(node["mesh"]) or node["mesh"] >= len(meshes)):
                check.error("glb_node_mesh", "Node references an invalid mesh", f"nodes[{index}]")
        if any("EXT_meshopt_compression" in view.get("extensions", {}) for view in views if isinstance(view, dict)):
            check.error("glb_compression_unsupported", "Meshopt buffer decoding is unsupported")
        stats = {"mesh_count": len(meshes), "primitive_count": primitives,
                 "embedded_image_count": len(images),
                 "unique_position_vertices": position_count, "triangle_count": triangles,
                 "bounds_scope": "local_accessor_positions_before_node_transforms",
                 "units": "metres_per_gltf_convention_not_engine_calibration",
                 "nonidentity_node_scales": nonidentity_scales}
        if position_count and all(math.isfinite(v) for v in low + high):
            stats.update(position_bounds_m={"min": low, "max": high},
                         local_dimensions_m=[high[i] - low[i] for i in range(3)])
        check.warning("limited_static_scope", "This inspection is not the full Khronos validator, engine import, rig/clip review, or visual approval")
    except (OSError, ValueError, TypeError, KeyError, IndexError, OverflowError, struct.error, AttributeError) as exc:
        check.error("glb_read", str(exc), str(path))
    return check.result(stats=stats)


def verify_release(path: Path, inventory: dict[str, Any] | None = None) -> dict[str, Any]:
    check = Check()
    manifest_path = Path(path)
    if manifest_path.is_dir():
        manifest_path = manifest_path / "source-release.json"
    manifest_path = manifest_path.resolve()
    root = manifest_path.parent
    try:
        document = load_json(manifest_path)
    except (OSError, ValueError) as exc:
        check.error("release_read", str(exc), str(manifest_path))
        return check.result(path=str(manifest_path))
    if document.get("schema") != RELEASE_SCHEMA:
        check.error("release_schema", f"Expected {RELEASE_SCHEMA}; canonical game-dev receipts are a separate format", "schema")
    files = document.get("files")
    if not isinstance(files, list) or not files:
        check.error("release_files", "A nonempty closed files roster is required", "files")
        files = []
    roster: dict[str, Path] = {}
    folded = set()
    glbs = {}
    known_ids = set(inventory.get("ids", [])) if inventory is not None else None
    file_usage = {}
    for index, record in enumerate(files):
        location = f"files[{index}]"
        if not isinstance(record, dict):
            check.error("release_file", "File record must be an object", location)
            continue
        relative = record.get("path")
        try:
            source = contained_file(root, relative)
        except (OSError, ValueError) as exc:
            check.error("release_path", str(exc), location)
            continue
        if source == manifest_path:
            check.error("manifest_self_hash", "Manifest is the sole roster exemption and cannot hash itself", location)
            continue
        if relative.casefold() in folded:
            check.error("duplicate_file", f"Duplicate or case-colliding file path: {relative}", location)
            continue
        folded.add(relative.casefold())
        roster[relative] = source
        digest = record.get("sha256")
        if not isinstance(digest, str) or not SHA256.fullmatch(digest):
            check.error("release_digest", "SHA256 must be 64 lowercase hex characters", location)
        elif not source.is_file():
            check.error("missing_file", f"Rostered file is missing: {relative}", location)
        else:
            try:
                if sha256_file(source) != digest:
                    check.error("tampered_file", f"SHA256 mismatch: {relative}", location)
                if "bytes" in record and (not integer(record["bytes"]) or record["bytes"] != source.stat().st_size):
                    check.error("file_size", f"Byte length mismatch: {relative}", location)
                if source.suffix.lower() == ".glb":
                    result = inspect_glb(source)
                    glbs[relative] = result
                    if not result["valid"]:
                        check.error("invalid_glb", f"GLB static inspection failed: {relative}", location)
            except OSError as exc:
                check.error("release_file_read", str(exc), location)
        if "usage_status" in record:
            file_usage[relative] = record["usage_status"]
        if "inventory_ids" in record:
            references = record["inventory_ids"]
            if not isinstance(references, list) or not all(isinstance(v, str) for v in references):
                check.error("release_inventory_ids", "inventory_ids must be an array of strings", location)
            elif known_ids is not None:
                for identifier in references:
                    if identifier not in known_ids:
                        check.error("release_unknown_inventory_id", f"Unknown inventory ID: {identifier}", location)
    # os.walk does not follow symlinks; junctions and directory links are rejected.
    def walk_error(exc: OSError) -> None:
        check.error("release_walk", str(exc))
    for directory, dirs, names in os.walk(root, followlinks=False, onerror=walk_error):
        for name in list(dirs):
            child = Path(directory) / name
            if (child.is_symlink() or (hasattr(child, "is_junction") and child.is_junction()) or
                    not child.resolve().is_relative_to(root)):
                check.error("release_link", "Directory symlinks/junctions are forbidden", child.relative_to(root).as_posix())
                dirs.remove(name)
        for name in names:
            source = Path(directory) / name
            if source == manifest_path:
                continue
            relative = source.relative_to(root).as_posix()
            if relative not in roster:
                check.error("unlisted_file", f"Unlisted release file: {relative}", relative)
            if source.is_symlink() or not source.resolve().is_relative_to(root):
                check.error("release_link", "File link or escaped path is forbidden", relative)
    if "inventory_ids" in document:
        references = document["inventory_ids"]
        if not isinstance(references, list) or not all(isinstance(v, str) for v in references):
            check.error("release_inventory_ids", "inventory_ids must be an array of strings")
        elif known_ids is not None:
            for identifier in references:
                if identifier not in known_ids:
                    check.error("release_unknown_inventory_id", f"Unknown inventory ID: {identifier}")
    return check.result(path=str(manifest_path), schema=document.get("schema"),
                        file_count=len(roster), glbs=glbs,
                        usage_status=document.get("usage_status", "unknown"),
                        file_usage_statuses=file_usage,
                        declared_status=document.get("status", "unknown"),
                        canonical_package_verification="not_run_separate_game_dev_workflow")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inventory", type=Path, help="Planning inventory JSON")
    parser.add_argument("--release", type=Path, help="source-release.json or its directory")
    args = parser.parse_args(argv)
    if args.inventory is None and args.release is None:
        parser.error("At least one of --inventory or --release is required")
    report: dict[str, Any] = {"schema": "verdant.source-validation.v1", "game_ready": False,
                              "unreal_import_status": "not_run", "visual_review_status": "not_run",
                              "usage_clearance_status": "not_assessed_by_static_verifier"}
    if args.inventory is not None:
        report["inventory"] = verify_inventory(args.inventory)
    if args.release is not None:
        report["release"] = verify_release(args.release, report.get("inventory"))
    report["valid"] = all(result["valid"] for key, result in report.items() if key in ("inventory", "release"))
    report["static_validation_status"] = "passed" if report["valid"] else "failed"
    print(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False))
    return 0 if report["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
