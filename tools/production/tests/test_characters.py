"""Binary/geometry/rig checks for local S1 sources; these are not engine acceptance."""
from __future__ import annotations

import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[1] / "build_characters.py"
SPEC = importlib.util.spec_from_file_location("build_characters", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def decode(data):
    magic,version,length=struct.unpack_from("<4sII",data)
    if (magic,version,length)!=(b"glTF",2,len(data)): raise ValueError("bad GLB header")
    js_len,js_kind=struct.unpack_from("<I4s",data,12)
    if js_kind!=b"JSON" or js_len%4: raise ValueError("bad JSON chunk")
    document=json.loads(data[20:20+js_len])
    binary_len,kind=struct.unpack_from("<I4s",data,20+js_len)
    if kind!=b"BIN\0" or binary_len%4 or binary_len+28+js_len!=len(data): raise ValueError("bad binary chunk")
    return document,data[28+js_len:]


def accessor(doc,binary,index):
    acc=doc["accessors"][index]; view=doc["bufferViews"][acc["bufferView"]]
    width={"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4,"MAT4":16}[acc["type"]]
    fmt={5126:"f",5123:"H",5125:"I"}[acc["componentType"]]
    offset=view.get("byteOffset",0)+acc.get("byteOffset",0)
    stride=struct.calcsize("<"+fmt*width)
    return [struct.unpack_from("<"+fmt*width,binary,offset+i*stride) for i in range(acc["count"])]


class CharacterProofTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.characters=[MODULE.trainer(),MODULE.pikachu()]
        cls.glbs=[MODULE.glb_bytes(m) for m in cls.characters]
        cls.documents=[decode(data) for data in cls.glbs]

    def test_binary_layout_is_aligned_and_accessors_are_in_bounds(self):
        for doc,binary in self.documents:
            self.assertEqual(doc["buffers"][0]["byteLength"],len(binary))
            for view in doc["bufferViews"]:
                self.assertEqual(view.get("byteOffset",0)%4,0)
                self.assertGreater(view["byteLength"],0)
                self.assertLessEqual(view.get("byteOffset",0)+view["byteLength"],len(binary))
            for index,acc in enumerate(doc["accessors"]):
                data=accessor(doc,binary,index)
                width={"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4,"MAT4":16}[acc["type"]]
                component_bytes={5126:4,5123:2,5125:4}[acc["componentType"]]
                view=doc["bufferViews"][acc["bufferView"]]
                self.assertLessEqual(acc.get("byteOffset",0)+len(data)*width*component_bytes,view["byteLength"])
                self.assertTrue(all(math.isfinite(n) for row in data for n in row))
                if "min" in acc:
                    for k in range(width):
                        self.assertAlmostEqual(min(row[k] for row in data),acc["min"][k],places=5)
                        self.assertAlmostEqual(max(row[k] for row in data),acc["max"][k],places=5)

    def test_geometry_has_valid_faces_and_normalized_outward_normals(self):
        for doc,binary in self.documents:
            prims=doc["meshes"][0]["primitives"]
            positions=accessor(doc,binary,prims[0]["attributes"]["POSITION"])
            normals=accessor(doc,binary,prims[0]["attributes"]["NORMAL"])
            self.assertEqual(len(positions),len(normals))
            for n in normals: self.assertAlmostEqual(sum(v*v for v in n),1,places=5)
            for prim in prims:
                indices=[row[0] for row in accessor(doc,binary,prim["indices"])]
                self.assertEqual(len(indices)%3,0)
                self.assertTrue(all(0<=i<len(positions) for i in indices))
                for j in range(0,len(indices),3):
                    a,b,c=indices[j:j+3]
                    face=MODULE.cross(MODULE.sub(positions[b],positions[a]),MODULE.sub(positions[c],positions[a]))
                    self.assertGreater(MODULE.dot(face,face),1e-18)
                    mean=MODULE.add(MODULE.add(normals[a],normals[b]),normals[c])
                    self.assertGreater(MODULE.dot(face,mean),-1e-8)

    def test_skin_weights_are_finite_normalized_and_have_actual_blending(self):
        for doc,binary in self.documents:
            attrs=doc["meshes"][0]["primitives"][0]["attributes"]
            joints=accessor(doc,binary,attrs["JOINTS_0"])
            weights=accessor(doc,binary,attrs["WEIGHTS_0"])
            blended=0
            for js,ws in zip(joints,weights):
                self.assertEqual(len(js),4); self.assertEqual(len(ws),4)
                self.assertTrue(all(0<=j<len(doc["skins"][0]["joints"]) for j in js))
                self.assertTrue(all(0<=w<=1 and math.isfinite(w) for w in ws))
                self.assertAlmostEqual(sum(ws),1,places=6)
                blended+=sum(w>1e-5 for w in ws)>1
            self.assertGreater(blended,100,"skin must include actual blended deformation zones")

    def test_joint_hierarchy_and_inverse_bind_restore_reference_positions(self):
        for character,(doc,binary) in zip(self.characters,self.documents):
            skin=doc["skins"][0]; inverse=accessor(doc,binary,skin["inverseBindMatrices"])
            self.assertEqual(skin["joints"],list(range(len(character.bones))))
            self.assertEqual(skin["skeleton"],0)
            parents={}
            for i,node in enumerate(doc["nodes"]):
                for child in node.get("children",[]):
                    self.assertNotIn(child,parents); parents[child]=i
                    self.assertLess(i,child)
            absolute=[]
            for i,bone in enumerate(character.bones):
                p=doc["nodes"][i]["translation"]
                absolute.append(MODULE.add(p,absolute[parents[i]]) if i in parents else p)
                expected=MODULE.gltf(bone["position"])
                for actual,wanted in zip(absolute[i],expected): self.assertAlmostEqual(actual,wanted)
                ibm=inverse[i]
                self.assertEqual(tuple(ibm[k] for k in (0,5,10,15)),(1,1,1,1))
                for k in range(3): self.assertAlmostEqual(ibm[12+k],-absolute[i][k],places=6)
                self.assertTrue(all(abs(ibm[k])<1e-8 for k in (1,2,3,4,6,7,8,9,11)))
            attrs=doc["meshes"][0]["primitives"][0]["attributes"]
            positions=accessor(doc,binary,attrs["POSITION"]); weights=accessor(doc,binary,attrs["WEIGHTS_0"]); joints=accessor(doc,binary,attrs["JOINTS_0"])
            for p,ws,js in zip(positions,weights,joints):
                skinned=[sum(w*(p[k]+inverse[j][12+k]+absolute[j][k]) for w,j in zip(ws,js)) for k in range(3)]
                for actual,wanted in zip(skinned,p): self.assertAlmostEqual(actual,wanted,places=6)

    def test_skeleton_animation_channels_deform_nonroot_weighted_vertices(self):
        for character,(doc,binary) in zip(self.characters,self.documents):
            walk=next(a for a in doc["animations"] if "Walk" in a["name"])
            attrs=doc["meshes"][0]["primitives"][0]["attributes"]
            joints=accessor(doc,binary,attrs["JOINTS_0"]); weights=accessor(doc,binary,attrs["WEIGHTS_0"])
            moved_joint_ids=set()
            for channel in walk["channels"]:
                if channel["target"]["path"]!="rotation": continue
                sampler=walk["samplers"][channel["sampler"]]
                values=accessor(doc,binary,sampler["output"])
                if any(abs(row[k])>.04 for row in values for k in range(3)): moved_joint_ids.add(channel["target"]["node"])
            affected=sum(any(j in moved_joint_ids and w>.1 for j,w in zip(js,ws)) for js,ws in zip(joints,weights))
            self.assertGreater(affected,500,"animated skin joints must influence actual render geometry")

    def test_animation_time_quaternions_loop_and_ground_root_contracts(self):
        expected=[{"Trainer_Idle","Trainer_Walk","Trainer_Run","Trainer_Interact","Trainer_Command"},{"Pikachu_Idle","Pikachu_Walk"}]
        for wanted,(doc,binary) in zip(expected,self.documents):
            self.assertEqual({a["name"] for a in doc["animations"]},wanted)
            for anim in doc["animations"]:
                roots=[]
                for channel in anim["channels"]:
                    sampler=anim["samplers"][channel["sampler"]]
                    times=[row[0] for row in accessor(doc,binary,sampler["input"])]; values=accessor(doc,binary,sampler["output"])
                    self.assertEqual(times[0],0); self.assertEqual(len(times),len(values))
                    self.assertTrue(all(a<b for a,b in zip(times,times[1:])))
                    self.assertTrue(all(abs(b-a-1/30)<1e-6 for a,b in zip(times,times[1:])))
                    self.assertEqual(sampler["interpolation"],"LINEAR")
                    if channel["target"]["path"]=="rotation":
                        for q in values: self.assertAlmostEqual(sum(v*v for v in q),1,places=5)
                    if anim["extras"]["loop"]:
                        for a,b in zip(values[0],values[-1]): self.assertAlmostEqual(a,b,places=5)
                    if channel["target"]["node"]==0:
                        roots.append(channel)
                        self.assertEqual(channel["target"]["path"],"translation")
                        self.assertTrue(all(row==(0,0,0) for row in values))
                self.assertEqual(len(roots),1)
                self.assertEqual(anim["extras"]["root_motion"],"in_place")

    def test_units_grounded_pivot_and_obj_winding_are_consistent(self):
        for character,(doc,binary) in zip(self.characters,self.documents):
            attrs=doc["meshes"][0]["primitives"][0]["attributes"]
            positions=accessor(doc,binary,attrs["POSITION"])
            self.assertAlmostEqual(min(p[1] for p in positions),0,places=6)
            self.assertEqual(doc["nodes"][0]["translation"],[0,0,0])
            for source,converted in zip(character.vertices,positions):
                for a,b in zip(MODULE.gltf(source["p"]),converted): self.assertAlmostEqual(a,b,places=6)
            obj=MODULE.obj_text(character)
            self.assertIn("Unreal cm +X forward +Z up",obj)
            self.assertEqual(sum(line.startswith("v ") for line in obj.splitlines()),len(character.vertices))
            self.assertEqual(sum(line.startswith("f ") for line in obj.splitlines()),len(character.faces))
            for a,b,c,mat in character.faces[::101]:
                source_normal=MODULE.cross(MODULE.sub(character.vertices[b]["p"],character.vertices[a]["p"]),MODULE.sub(character.vertices[c]["p"],character.vertices[a]["p"]))
                converted_normal=MODULE.cross(MODULE.sub(MODULE.gltf(character.vertices[b]["p"]),MODULE.gltf(character.vertices[a]["p"])),MODULE.sub(MODULE.gltf(character.vertices[c]["p"]),MODULE.gltf(character.vertices[a]["p"])))
                self.assertGreater(MODULE.dot(MODULE.gltf_normal(source_normal),converted_normal),0)

    def test_calibrated_native_import_axes_and_animation_forward_direction(self):
        for source in [(100,0,0),(0,100,0),(0,0,100),(2,3,4)]:
            x,y,z=MODULE.gltf(source)
            native=(x*100,-z*100,y*100)
            for a,b in zip(native,source): self.assertAlmostEqual(a,b)
        q=MODULE.quat(MODULE.PITCH,60); axis=q[:3]; point=(0,-1,0)
        # q * v * q^-1, expressed using the vector quaternion formula.
        rotated=MODULE.add(point,MODULE.mul(MODULE.cross(axis,MODULE.add(MODULE.cross(axis,point),MODULE.mul(point,q[3]))),2))
        self.assertGreater(rotated[0],0,"positive limb pitch must swing toward native +X forward")

    def test_sources_and_glbs_are_byte_deterministic(self):
        for a,b,data in zip(self.characters,[MODULE.trainer(),MODULE.pikachu()],self.glbs):
            self.assertEqual(a.vertices,b.vertices); self.assertEqual(a.faces,b.faces)
            self.assertEqual(data,MODULE.glb_bytes(b))
            self.assertEqual(MODULE.obj_text(a),MODULE.obj_text(b))

    def test_release_roster_is_closed_and_hashes_are_exact(self):
        with tempfile.TemporaryDirectory(prefix="verdant-characters-") as tmp:
            output=Path(tmp); release=MODULE.build(output,previews=False)
            manifest=json.loads((output/"source-release.json").read_text())
            self.assertEqual(release,manifest)
            self.assertEqual(release["schema"],"verdant.source-release.v1")
            self.assertEqual(release["usage"],"unassessed")
            self.assertFalse(release["acceptance"]["game_ready"])
            self.assertFalse(release["provenance"]["canonical_game_dev_package"])
            expected={p.name for p in output.iterdir()}-{"source-release.json"}
            self.assertEqual({f["path"] for f in release["files"]},expected)
            for record in release["files"]:
                path=output/record["path"]
                self.assertEqual(record["bytes"],path.stat().st_size)
                self.assertEqual(record["sha256"],hashlib.sha256(path.read_bytes()).hexdigest())
                self.assertTrue(record["inventory_ids"])
            for record in release["meshes"]:
                self.assertTrue((output/record["glb"]).is_file()); self.assertTrue((output/record["obj"]).is_file())
                self.assertTrue(record["animations"]); self.assertTrue(record["limitations"])
            self.assertEqual((output/"build_characters.py").read_bytes(),SOURCE.read_bytes())

    def test_release_rejects_unowned_files_instead_of_silently_omitting_them(self):
        with tempfile.TemporaryDirectory(prefix="verdant-characters-") as tmp:
            (Path(tmp)/"untracked.txt").write_text("must not disappear from release accounting")
            with self.assertRaisesRegex(ValueError,"unowned/stale files"):
                MODULE.build(Path(tmp),previews=False)


if __name__=="__main__": unittest.main(verbosity=2)
