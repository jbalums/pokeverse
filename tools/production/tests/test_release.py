"""Failure-path tests for local source-release validation, without Unreal/GUI."""
from contextlib import redirect_stdout
import copy
import hashlib
import io
import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import verify_release as verifier


def make_glb(document=None, binary=None):
    if binary is None:
        binary = struct.pack("<9f3H", 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 1, 2)
    if document is None:
        document = {
            "asset": {"version": "2.0"}, "buffers": [{"byteLength": len(binary)}],
            "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": 36},
                            {"buffer": 0, "byteOffset": 36, "byteLength": 6}],
            "accessors": [{"bufferView": 0, "componentType": 5126, "count": 3, "type": "VEC3"},
                          {"bufferView": 1, "componentType": 5123, "count": 3, "type": "SCALAR"}],
            "meshes": [{"primitives": [{"attributes": {"POSITION": 0}, "indices": 1}]}],
            "nodes": [{"mesh": 0}], "scenes": [{"nodes": [0]}], "scene": 0,
        }
    json_bytes = json.dumps(document).encode("utf-8")
    json_bytes += b" " * (-len(json_bytes) % 4)
    bin_bytes = binary + b"\0" * (-len(binary) % 4)
    chunks = struct.pack("<II", len(json_bytes), 0x4E4F534A) + json_bytes
    chunks += struct.pack("<II", len(bin_bytes), 0x004E4942) + bin_bytes
    return struct.pack("<4sII", b"glTF", 2, len(chunks) + 12) + chunks


def inventory_document():
    return {
        "schema": verifier.INVENTORY_SCHEMA,
        "entry_defaults": {"dependencies": [], "decision_dependencies": ["L0", "L1"],
                           "usage_status": "unknown", "completion_status": "planned", "owner_role": "default"},
        "technical_profiles": {"prop": {"owner_role": "artist", "pivot_policy": "base"}},
        "inventory": [
            {"id": "A", "profile": "prop", "quantity": 1, "unit": "mesh", "variants": ["one"]},
            {"id": "B", "profile": "prop", "quantity": 2, "unit": "appearance", "variants": ["a", "b"],
             "dependencies": ["A"], "owner_role": "specialist", "usage_status": "bespoke_unreviewed_state"},
        ],
        "proof_bundles": [{"id": "B1", "inventory_ids": ["A", "B"]}],
    }


class Fixture(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)

    def write_json(self, name, value):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value), encoding="utf-8")
        return path

    def write_release(self):
        path = self.root / "model.glb"
        path.write_bytes(make_glb())
        document = {"schema": verifier.RELEASE_SCHEMA, "usage_status": "unknown_pending_review",
                    "status": "source_only", "files": [{"path": "model.glb",
                     "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "bytes": path.stat().st_size}]}
        manifest = self.write_json("source-release.json", document)
        return manifest, document

    def codes(self, report):
        return {error["code"] for error in report["errors"]}


class InventoryTests(Fixture):
    def test_resolution_precedence_and_independent_copies(self):
        document = inventory_document()
        original = copy.deepcopy(document)
        resolved = verifier.resolve_inventory(document)
        self.assertEqual(resolved[0]["owner_role"], "artist")
        self.assertEqual(resolved[1]["owner_role"], "specialist")
        self.assertEqual(resolved[0]["pivot_policy"], "base")
        resolved[0]["decision_dependencies"].append("extra")
        self.assertEqual(document, original)

    def test_valid_inventory_preserves_units_and_unknown_usage(self):
        report = verifier.verify_inventory(self.write_json("inventory.json", inventory_document()))
        self.assertTrue(report["valid"], report)
        self.assertEqual(report["quantities_by_unit"], {"mesh": 1, "appearance": 2})
        self.assertEqual(report["usage_status_counts"], {"unknown": 1, "bespoke_unreviewed_state": 1})
        self.assertLess(report["dependency_order"].index("A"), report["dependency_order"].index("B"))

    def test_cycles_are_rejected(self):
        document = inventory_document()
        document["inventory"][0]["dependencies"] = ["B"]
        report = verifier.verify_inventory(self.write_json("inventory.json", document))
        self.assertIn("dependency_cycle", self.codes(report))

    def test_duplicate_id_quantity_unknown_dependency_and_missing_lock(self):
        document = inventory_document()
        document["inventory"][1].update(id="A", quantity=7, dependencies=["absent"], decision_dependencies=["L0"])
        report = verifier.verify_inventory(self.write_json("inventory.json", document))
        self.assertTrue({"duplicate_id", "quantity_variants", "universal_locks"}.issubset(self.codes(report)))
        document["inventory"][1]["id"] = "B"
        report = verifier.verify_inventory(self.write_json("inventory.json", document))
        self.assertIn("unknown_dependency", self.codes(report))

    def test_profile_and_proof_bundle_validation(self):
        document = inventory_document()
        document["proof_bundles"][0]["inventory_ids"] = ["missing"]
        report = verifier.verify_inventory(self.write_json("inventory.json", document))
        self.assertIn("unknown_bundle_asset", self.codes(report))
        document["inventory"][0]["profile"] = "missing"
        report = verifier.verify_inventory(self.write_json("inventory.json", document))
        self.assertIn("inventory_read", self.codes(report))

    def test_malformed_dependencies_and_duplicate_json_fields_do_not_crash(self):
        document = inventory_document()
        document["inventory"][0]["decision_dependencies"] = [{"invalid": "value"}]
        report = verifier.verify_inventory(self.write_json("inventory.json", document))
        self.assertFalse(report["valid"])
        self.assertIn("universal_locks", self.codes(report))
        path = self.root / "duplicate.json"
        path.write_text('{"schema":"a","schema":"b"}')
        report = verifier.verify_inventory(path)
        self.assertIn("inventory_read", self.codes(report))

    def test_plan_link_traversal_and_reference_tampering(self):
        document = inventory_document()
        document["plan"] = "../outside.md"
        reference = self.root / "reference.png"
        reference.write_bytes(b"frozen")
        document["reference"] = {"path": reference.name, "sha256": hashlib.sha256(b"original").hexdigest()}
        report = verifier.verify_inventory(self.write_json("inventory.json", document))
        self.assertTrue({"document_path", "reference_digest"}.issubset(self.codes(report)))


class ReleaseTests(Fixture):
    def test_valid_closed_roster_and_static_scope(self):
        manifest, _ = self.write_release()
        report = verifier.verify_release(manifest)
        self.assertTrue(report["valid"], report)
        self.assertEqual(report["file_count"], 1)
        self.assertEqual(report["usage_status"], "unknown_pending_review")
        self.assertEqual(report["glbs"]["model.glb"]["stats"]["triangle_count"], 1)
        output = io.StringIO()
        with redirect_stdout(output):
            result = verifier.main(["--release", str(manifest)])
        self.assertEqual(result, 0)
        report = json.loads(output.getvalue())
        self.assertFalse(report["game_ready"])
        self.assertEqual(report["unreal_import_status"], "not_run")
        self.assertEqual(report["visual_review_status"], "not_run")

    def test_tampered_bytes_rejected(self):
        manifest, _ = self.write_release()
        with (self.root / "model.glb").open("ab") as stream:
            stream.write(b"tampered")
        report = verifier.verify_release(manifest)
        self.assertIn("tampered_file", self.codes(report))
        self.assertFalse(report["valid"])

    def test_missing_and_unlisted_files_rejected(self):
        manifest, _ = self.write_release()
        (self.root / "model.glb").unlink()
        (self.root / "unlisted.txt").write_text("unexpected")
        report = verifier.verify_release(manifest)
        self.assertTrue({"missing_file", "unlisted_file"}.issubset(self.codes(report)))

    def test_traversal_absolute_windows_and_ads_paths_rejected(self):
        manifest, document = self.write_release()
        for malicious in ("../outside.bin", "/outside.bin", "C:/outside.bin", "..\\outside.bin", "a//b", "./model.glb", "model.glb:stream", "NUL.txt", "model.glb.", "dir /model.glb"):
            with self.subTest(path=malicious):
                document["files"][0]["path"] = malicious
                self.write_json(manifest.name, document)
                report = verifier.verify_release(manifest)
                self.assertIn("release_path", self.codes(report))

    def test_duplicate_and_manifest_self_hash_rejected(self):
        manifest, document = self.write_release()
        document["files"].append(dict(document["files"][0]))
        document["files"].append({"path": manifest.name, "sha256": "0" * 64})
        self.write_json(manifest.name, document)
        report = verifier.verify_release(manifest)
        self.assertTrue({"duplicate_file", "manifest_self_hash"}.issubset(self.codes(report)))

    def test_symlink_escape_rejected_when_host_supports_links(self):
        manifest, document = self.write_release()
        with tempfile.TemporaryDirectory() as outside:
            target = Path(outside) / "outside.txt"
            target.write_bytes(b"outside")
            try:
                (self.root / "escaped.txt").symlink_to(target)
            except OSError as exc:
                self.skipTest(f"Host cannot create symlinks: {exc}")
            document["files"].append({"path": "escaped.txt", "sha256": hashlib.sha256(b"outside").hexdigest()})
            self.write_json(manifest.name, document)
            report = verifier.verify_release(manifest)
            self.assertIn("release_path", self.codes(report))

    def test_unknown_inventory_ids_rejected_if_inventory_provided(self):
        manifest, document = self.write_release()
        document["inventory_ids"] = ["A", "missing"]
        self.write_json(manifest.name, document)
        report = verifier.verify_release(manifest, {"ids": ["A"]})
        self.assertIn("release_unknown_inventory_id", self.codes(report))

    def test_cli_nonzero_and_schema_rejects_canonical_receipt(self):
        manifest, document = self.write_release()
        document["schema"] = "game-dev.package-receipt.v1"
        self.write_json(manifest.name, document)
        output = io.StringIO()
        with redirect_stdout(output):
            code = verifier.main(["--release", str(manifest)])
        self.assertEqual(code, 1)
        self.assertIn("release_schema", self.codes(json.loads(output.getvalue())["release"]))


class GlbTests(Fixture):
    def inspect(self, data):
        path = self.root / "test.glb"
        path.write_bytes(data)
        return verifier.inspect_glb(path)

    def base_document(self):
        data = make_glb()
        size = struct.unpack_from("<I", data, 12)[0]
        return json.loads(data[20:20 + size])

    def test_geometry_bounds_are_measured_and_scope_is_explicit(self):
        report = self.inspect(make_glb())
        self.assertTrue(report["valid"], report)
        self.assertEqual(report["stats"]["local_dimensions_m"], [1.0, 2.0, 0.0])
        self.assertEqual(report["stats"]["unique_position_vertices"], 3)
        self.assertIn("before_node_transforms", report["stats"]["bounds_scope"])

    def test_bad_headers_chunk_and_buffer_lengths(self):
        data = bytearray(make_glb())
        struct.pack_into("<I", data, 8, len(data) - 1)
        self.assertFalse(self.inspect(data)["valid"])
        document = self.base_document()
        document["buffers"][0]["byteLength"] = 5000
        self.assertFalse(self.inspect(make_glb(document))["valid"])
        document = self.base_document()
        document["bufferViews"][0]["byteLength"] = 999
        self.assertIn("glb_buffer_view", self.codes(self.inspect(make_glb(document))))

    def test_accessor_out_of_bounds_and_stride(self):
        document = self.base_document()
        document["accessors"][0]["count"] = 999
        self.assertIn("glb_accessor_bounds", self.codes(self.inspect(make_glb(document))))
        document = self.base_document()
        document["bufferViews"][0]["byteStride"] = 8
        self.assertIn("glb_accessor_bounds", self.codes(self.inspect(make_glb(document))))

    def test_nonfinite_geometry_and_index_bounds(self):
        binary = struct.pack("<9f3H", float("nan"), 0, 0, 1, 0, 0, 0, 2, 0, 0, 1, 2)
        self.assertIn("glb_nonfinite", self.codes(self.inspect(make_glb(binary=binary))))
        binary = struct.pack("<9f3H", 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 1, 3)
        self.assertIn("glb_index_bounds", self.codes(self.inspect(make_glb(binary=binary))))

    def test_external_buffer_sparse_and_compression_are_not_silently_accepted(self):
        document = self.base_document()
        document["buffers"][0]["uri"] = "outside.bin"
        self.assertFalse(self.inspect(make_glb(document))["valid"])
        document = self.base_document()
        document["accessors"][0]["sparse"] = {"count": 1}
        self.assertIn("glb_sparse_unsupported", self.codes(self.inspect(make_glb(document))))
        document = self.base_document()
        document["meshes"][0]["primitives"][0]["extensions"] = {"KHR_draco_mesh_compression": {}}
        self.assertIn("glb_compression_unsupported", self.codes(self.inspect(make_glb(document))))

    def test_glb_cannot_escape_closed_roster_via_external_image(self):
        document = self.base_document()
        document["images"] = [{"uri": "../unrostered.png"}]
        self.assertIn("glb_external_image", self.codes(self.inspect(make_glb(document))))
        document["images"] = [{"bufferView": 999, "mimeType": "image/png"}]
        self.assertIn("glb_image", self.codes(self.inspect(make_glb(document))))


if __name__ == "__main__":
    unittest.main()
