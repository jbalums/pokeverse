"""Import local S1 sources in Unreal; run with -run=pythonscript -script=...

Imports only to /Game/Verdant/Production/Proofs/{Environment,Characters}.
Both source releases must pass read-only roster checks before any engine import.
GLB uses Unreal's registered default importer. OBJ is a separately recorded
static fallback; it does not establish skeletal/animation acceptance. This
script does not create game-dev package or vendor receipts.
"""
from pathlib import Path
import json
import math
import re
import sys
import traceback

import unreal as u

sys.path.insert(0, str(Path(__file__).resolve().parent))
import verify_release


ROOT = Path(u.Paths.project_dir()).resolve().parent
BASE = "/Game/Verdant/Production/Proofs"
RECEIPT = ROOT / "output/asset-evidence/s1-proof-v001/unreal-import.json"
SOURCE_RELEASES = (
    ("Environment", ROOT / "assets/production/source/s1-environment/v001/source-release.json"),
    ("Characters", ROOT / "assets/production/source/s1-characters/v001/source-release.json"),
)
EAL = u.EditorAssetLibrary
TOOLS = u.AssetToolsHelpers.get_asset_tools()


def _save_receipt(receipt):
    RECEIPT.parent.mkdir(parents=True, exist_ok=True)
    RECEIPT.write_text(json.dumps(receipt, indent=2, ensure_ascii=False, allow_nan=False), encoding="utf-8")


def _safe_name(value):
    value = re.sub(r"[^A-Za-z0-9_]", "_", str(value)).strip("_")
    if not value:
        raise ValueError("Mesh ID cannot form a safe native asset name")
    return value


def _vector(value):
    result = [float(value.x), float(value.y), float(value.z)]
    if not all(math.isfinite(axis) for axis in result):
        raise ValueError("Nonfinite native mesh bounds")
    return result


def _bounds(mesh):
    try:
        bounds = mesh.get_bounds()
    except (AttributeError, TypeError):
        bounds = mesh.get_editor_property("imported_bounds")
    origin, extent = _vector(bounds.origin), _vector(bounds.box_extent)
    return {"origin": origin, "extent": extent,
            "min": [origin[i] - extent[i] for i in range(3)],
            "max": [origin[i] + extent[i] for i in range(3)],
            "dimensions": [axis * 2 for axis in extent], "units": "Unreal_centimetres"}


def _native_assets(paths, destination):
    candidates = set(str(path) for path in paths)
    assets = []
    for path in sorted(candidates):
        if not path.startswith(destination + "/"):
            raise RuntimeError("Importer reported an asset outside its isolated destination: " + path)
        asset = EAL.load_asset(path)
        if asset is None:
            raise RuntimeError("Imported native asset cannot be loaded: " + path)
        assets.append(asset)
    return assets


def _task(source, destination, name, obj_fallback=False):
    if not destination.startswith(BASE + "/"):
        raise ValueError("Refusing an import outside the generated proof namespace")
    EAL.make_directory(destination)
    task = u.AssetImportTask()
    task.filename = str(source)
    task.destination_path = destination
    task.destination_name = name
    task.automated = True
    task.replace_existing = True
    task.save = True
    if obj_fallback:
        options = u.FbxImportUI()
        options.set_editor_property("import_mesh", True)
        options.set_editor_property("import_materials", True)
        options.set_editor_property("import_textures", True)
        options.set_editor_property("import_as_skeletal", False)
        options.set_editor_property("automated_import_should_detect_type", False)
        options.set_editor_property("mesh_type_to_import", u.FBXImportType.FBXIT_STATIC_MESH)
        options.static_mesh_import_data.set_editor_property("combine_meshes", True)
        options.static_mesh_import_data.set_editor_property("auto_generate_collision", False)
        options.static_mesh_import_data.set_editor_property("normal_import_method", u.FBXNormalImportMethod.FBXNIM_COMPUTE_NORMALS)
        task.options = options
        task.factory = u.FbxFactory()
    # A GLB task deliberately has no invented glTF factory or options. Unreal's
    # registered plugin/import pipeline owns its supported format behavior.
    TOOLS.import_asset_tasks([task])
    paths = list(task.imported_object_paths)
    # Only the task's actual result can establish an import. An old mesh or
    # clip left in the destination must not turn a failed task into success.
    try:
        paths.extend(asset.get_path_name() for asset in task.get_objects() if asset is not None)
    except AttributeError:
        pass
    assets = _native_assets(paths, destination)
    return assets


def _skeleton_path(asset):
    try:
        skeleton = asset.get_editor_property("skeleton")
    except Exception:
        return None
    return skeleton.get_path_name() if skeleton else None


def _materials(mesh):
    records = []
    property_name = "materials" if isinstance(mesh, u.SkeletalMesh) else "static_materials"
    for index, slot in enumerate(mesh.get_editor_property(property_name)):
        material = slot.get_editor_property("material_interface")
        records.append({"slot": index, "name": str(slot.get_editor_property("material_slot_name")),
                        "path": material.get_path_name() if material else None,
                        "class": material.get_class().get_name() if material else None})
    return records


def _animation_record(animation):
    result = {"path": animation.get_path_name(), "name": animation.get_name(),
              "skeleton": _skeleton_path(animation)}
    try:
        result["length_seconds"] = float(animation.get_play_length())
    except Exception as exc:
        result["length_read_error"] = str(exc)
    return result


def _resolve_source(manifest_path, row, key, allowed):
    relative = row.get(key)
    if relative is None:
        return None
    path = verify_release.contained_file(manifest_path.parent, relative)
    if relative not in allowed or not path.is_file():
        raise ValueError(f"{row.get('id')}.{key} is missing or absent from the verified file roster")
    return path


def _source_rows(manifest_path, manifest):
    """Validate all importer lookups before the first engine mutation."""
    rows = manifest.get("meshes")
    if not isinstance(rows, list) or not rows:
        raise ValueError("Source release needs a nonempty meshes array for engine import")
    allowed = {record["path"] for record in manifest["files"]}
    digests = {record["path"]: record["sha256"] for record in manifest["files"]}
    seen, safe_names, resolved = set(), set(), []
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get("id"), str) or not row["id"]:
            raise ValueError("Every mesh needs a nonempty ID")
        name = _safe_name(row["id"])
        if row["id"] in seen or name.casefold() in safe_names:
            raise ValueError("Duplicate or colliding source mesh ID: " + row["id"])
        seen.add(row["id"])
        safe_names.add(name.casefold())
        glb = _resolve_source(manifest_path, row, "glb", allowed)
        obj = _resolve_source(manifest_path, row, "obj", allowed)
        mtl = _resolve_source(manifest_path, row, "mtl", allowed)
        if glb is None:
            raise ValueError("Every mesh must supply its canonical portable GLB source")
        if glb.suffix.lower() != ".glb" or (obj is not None and obj.suffix.lower() != ".obj"):
            raise ValueError("Mesh source extension does not match glb/obj declaration")
        row = dict(row)
        row["_verified_source_digests"] = {str(source): digests[source.relative_to(manifest_path.parent).as_posix()]
                                            for source in (glb, obj, mtl) if source is not None}
        resolved.append((row, name, glb, obj, mtl))
    return resolved


def _import_mesh(group, row, name, glb, obj, mtl):
    destination = BASE + "/" + group + "/" + name
    record = {"id": row["id"], "group": group,
              "inventory_ids": row.get("inventory_ids", []),
              "source_glb": str(glb.relative_to(ROOT)),
              "source_obj": str(obj.relative_to(ROOT)) if obj else None,
              "source_mtl": str(mtl.relative_to(ROOT)) if mtl else None,
              "source_dimensions_cm": row.get("dimensions_cm"),
              "native_mesh": None, "native_mesh_class": None,
              "native_animations": [], "native_skeletons": [], "native_assets": [],
              "bounds_cm": None, "materials": [], "errors": [], "warnings": [],
              "material_policy": "preserve_imported_materials_no_tint_override",
              "material_color_acceptance": "not_reviewed", "status": "running"}
    try:
        for source_path, digest in row.get("_verified_source_digests", {}).items():
            if verify_release.sha256_file(Path(source_path)) != digest:
                raise RuntimeError("Source changed after preflight: " + source_path)
        record["source_glb_sha256"] = row["_verified_source_digests"][str(glb)]
        if obj:
            record["source_obj_sha256"] = row["_verified_source_digests"][str(obj)]
        assets = []
        try:
            assets = _task(glb, destination + "/GLB", name)
        except Exception as exc:
            record["warnings"].append("GLB importer error: " + str(exc))
        meshes = [asset for asset in assets if isinstance(asset, (u.SkeletalMesh, u.StaticMesh))]
        route = "glb_default_importer"
        if not meshes:
            if obj is None:
                raise RuntimeError("GLB import produced no readable native mesh and no OBJ fallback exists")
            if verify_release.sha256_file(obj) != row["_verified_source_digests"][str(obj)]:
                raise RuntimeError("OBJ fallback changed after preflight")
            record["warnings"].append("GLB produced no native mesh; used static OBJ fallback")
            assets = _task(obj, destination + "/OBJFallback", name, obj_fallback=True)
            meshes = [asset for asset in assets if isinstance(asset, u.StaticMesh)]
            route = "obj_fbx_factory_static_fallback"
        if not meshes:
            raise RuntimeError("Importer produced no readable native mesh: " + row["id"])
        # Prefer the requested skeletal payload when a GLB produces extra meshes.
        meshes.sort(key=lambda asset: (not isinstance(asset, u.SkeletalMesh), asset.get_path_name()))
        mesh = meshes[0]
        record["import_route"] = route
        record["native_mesh"] = mesh.get_path_name()
        record["native_mesh_class"] = mesh.get_class().get_name()
        record["native_assets"] = [{"path": asset.get_path_name(), "class": asset.get_class().get_name()} for asset in assets]
        record["native_meshes"] = [{"path": asset.get_path_name(), "class": asset.get_class().get_name()} for asset in meshes]
        record["bounds_cm"] = _bounds(mesh)
        record["materials"] = _materials(mesh)
        if isinstance(mesh, u.StaticMesh) and mesh.get_num_lods() < 1:
            raise RuntimeError("Native static mesh has no imported LOD")
        skeletons = [asset for asset in assets if isinstance(asset, u.Skeleton)]
        record["native_skeletons"] = [{"path": asset.get_path_name(), "name": asset.get_name()} for asset in skeletons]
        animations = [asset for asset in assets if isinstance(asset, u.AnimSequence)]
        record["native_animations"] = [_animation_record(asset) for asset in animations]
        declared_rig = bool(row.get("rig")) or group == "Characters"
        record["source_joint_names"] = row.get("rig", {}).get("joint_names", []) if isinstance(row.get("rig"), dict) else []
        record["source_animations"] = row.get("animations", [])
        if isinstance(mesh, u.SkeletalMesh):
            record["native_skeleton"] = _skeleton_path(mesh)
            record["rig_status"] = "skeletal_mesh_imported_deformation_review_pending"
            record["animation_status"] = "clips_imported_coverage_review_pending" if animations else "not_imported"
        else:
            record["native_skeleton"] = None
            record["rig_status"] = ("not_imported_static_fallback" if route.startswith("obj") else "not_imported_native_static_mesh") if declared_rig else "not_applicable"
            record["animation_status"] = "not_imported" if row.get("animations") else "not_applicable"
        if declared_rig and (not isinstance(mesh, u.SkeletalMesh) or not animations):
            record["warnings"].append("Character rig/animation engine round-trip remains pending")
            record["status"] = "partial_rig_animation_pending"
        else:
            record["status"] = "native_imported_review_pending"
        if any(material["path"] is None for material in record["materials"]):
            record["warnings"].append("One or more native material slots are unassigned")
        expected = row.get("dimensions_cm")
        if verify_release.finite_list(expected, 3):
            actual = record["bounds_cm"]["dimensions"]
            record["scale_dimensions_match_within_5_percent"] = all(abs(actual[i] - expected[i]) <= max(1.0, abs(expected[i]) * .05) for i in range(3))
            if not record["scale_dimensions_match_within_5_percent"]:
                record["warnings"].append("Native dimensions differ from declared centimetre bounds; calibration review required")
        EAL.save_directory(destination, only_if_is_dirty=False, recursive=True)
    except Exception as exc:
        record["status"] = "failed"
        record["errors"].append(str(exc))
    return record


def main():
    global RECEIPT
    receipt = {"schema": "verdant.unreal-proof-import.v1", "status": "preflight",
               "engine": u.SystemLibrary.get_engine_version(), "game_ready": False,
               "visual_review_status": "not_run", "rig_acceptance_status": "not_reviewed",
               "canonical_package_verification": "not_run", "vendor_admission": "not_run",
               "sources": [], "meshes": [], "errors": []}
    try:
        command_line = u.SystemLibrary.get_command_line()
        match = re.search(r'(?:^|\s)-ProofImportGroup=(?:"([^"]+)"|(\S+))', command_line, re.IGNORECASE)
        selection = (match.group(1) or match.group(2)) if match else "All"
        selection = {"all": "All", "characters": "Characters", "environment": "Environment"}.get(selection.lower())
        if selection is None:
            raise ValueError("-ProofImportGroup must be All, Characters or Environment")
        RECEIPT = ROOT / "output/asset-evidence/s1-proof-v001" / ("unreal-import.json" if selection == "All" else "unreal-import-" + selection.lower() + ".json")
        selected = [(group, path) for group, path in SOURCE_RELEASES if selection in ("All", group)]
        receipt["group_selection"] = selection
        receipt["requested_groups"] = [group for group, _ in selected]
        jobs = []
        inventory = verify_release.verify_inventory(ROOT / "docs/asset-package-inventory.json")
        receipt["inventory_preflight"] = inventory
        if not inventory["valid"]:
            raise RuntimeError("Planning inventory preflight failed")
        # Preflight all sources before creating or replacing any native asset.
        for group, path in selected:
            result = verify_release.verify_release(path, inventory)
            receipt["sources"].append({"group": group, "manifest": str(path.relative_to(ROOT)),
                                        "preflight": result})
            if not result["valid"]:
                raise RuntimeError("Source release preflight failed: " + str(path))
            manifest = verify_release.load_json(path)
            receipt["sources"][-1]["manifest_sha256"] = verify_release.sha256_file(path)
            jobs.extend((group, *job) for job in _source_rows(path, manifest))
        receipt["status"] = "importing"
        _save_receipt(receipt)
        for job in jobs:
            result = _import_mesh(*job)
            receipt["meshes"].append(result)
            _save_receipt(receipt)
        failed = [record["id"] for record in receipt["meshes"] if record["status"] == "failed"]
        if failed:
            raise RuntimeError("Native mesh imports failed: " + ", ".join(failed))
        imported_status = ("partial_rig_animation_pending" if any(record["status"].startswith("partial") for record in receipt["meshes"])
                           else "native_imported_review_pending")
        receipt["selected_group_import_status"] = imported_status
        receipt["status"] = "partial_groups_pending" if selection != "All" else imported_status
        _save_receipt(receipt)
        u.log("VERDANT_PROOF_IMPORT_COMPLETE: %d source meshes, status=%s" % (len(receipt["meshes"]), receipt["status"]))
    except Exception as exc:
        receipt["status"] = "failed"
        receipt["errors"].append(str(exc))
        receipt["traceback"] = traceback.format_exc()
        _save_receipt(receipt)
        u.log_error("VERDANT_PROOF_IMPORT_FAILED: " + str(exc))
        raise


if __name__ == "__main__":
    main()
