"""Geometry/interchange checks, not an engine, appearance or game-ready test."""
from __future__ import annotations

import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct
import tempfile
import unittest

MODULE = Path(__file__).resolve().parents[1] / "build_environment.py"
SPEC = importlib.util.spec_from_file_location("environment_author", MODULE)
env = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(env)

EXPECTED = {
    "HealingRoof":(620,460,210), "HealingFacade":(570,400,320),
    "HealingArch":(270,36,170), "HealingEmblem":(100,12,100), "HealingGlass":(445,12,240),
    "CottageRoof":(510,440,235), "CottageWall":(450,350,475), "CottageShutters":(230,32,160),
    "Broadleaf":(470,430,640), "Conifer":(310,310,680), "EncounterGrass":(120,120,115),
    "FlowerCluster":(110,100,60), "CascadeBank":(420,300,310), "CascadeWater":(170,300,285),
    "CascadeFoam":(180,300,289), "BridgeDeck":(440,195,52), "BridgePost":(29,29,146),
    "BridgeRope":(440,6,78), "CottageFoundation":(470,370,52), "CottageStep":(170,115,42),
    "HealingPlanter":(77,75,91), "HealingLight":(44,44,252), "BridgeAnchor":(95,64,85),
}


def decode_glb(data):
    magic, version, total = struct.unpack_from('<4sII', data)
    if (magic, version, total) != (b'glTF', 2, len(data)):
        raise AssertionError("Invalid GLB header")
    json_length, kind = struct.unpack_from('<I4s', data, 12)
    if kind != b'JSON' or json_length % 4:
        raise AssertionError("Invalid JSON chunk")
    document = json.loads(data[20:20+json_length])
    offset = 20+json_length
    binary_length, kind = struct.unpack_from('<I4s', data, offset)
    if kind != b'BIN\0' or binary_length % 4 or offset+8+binary_length != len(data):
        raise AssertionError("Invalid embedded binary chunk")
    return document, data[offset+8:]


def read_accessor(document, binary, accessor_id):
    accessor = document['accessors'][accessor_id]
    view = document['bufferViews'][accessor['bufferView']]
    dimensions = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[accessor['type']]
    fmt = {5126:'f',5125:'I'}[accessor['componentType']]
    stride = view.get('byteStride', dimensions*4)
    offset = view.get('byteOffset',0)+accessor.get('byteOffset',0)
    return [struct.unpack_from('<'+fmt*dimensions,binary,offset+stride*i) for i in range(accessor['count'])]


def signed_volume(mesh):
    return sum(env.dot(mesh.vertices[a],env.cross(mesh.vertices[b],mesh.vertices[c]))/6 for a,b,c in mesh.faces)


def ray_y_hits(mesh,x,z):
    """Moller-Trumbore ray, independent of authoring helper implementation."""
    origin=(x,-500,z); direction=(0,1,0); hits=[]
    for face in mesh.faces:
        a,b,c=[mesh.vertices[i] for i in face]
        edge1=env.sub(b,a);edge2=env.sub(c,a)
        h=env.cross(direction,edge2);det=env.dot(edge1,h)
        if abs(det)<1e-9:continue
        s=env.sub(origin,a);u=env.dot(s,h)/det
        if u < -1e-8 or u>1+1e-8:continue
        q=env.cross(s,edge1);v=env.dot(direction,q)/det
        if v < -1e-8 or u+v>1+1e-8:continue
        t=env.dot(edge2,q)/det
        if t>=0:hits.append(origin[1]+t)
    return sorted(hits)


class EnvironmentSourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory()
        cls.output=Path(cls.temp.name)/'first'
        cls.manifest=env.build(cls.output)

    @classmethod
    def tearDownClass(cls):cls.temp.cleanup()

    def test_all_expected_modules_have_real_floor_centred_geometry(self):
        self.assertEqual(set(EXPECTED),{r['id'] for r in self.manifest['meshes']})
        for record in self.manifest['meshes']:
            with self.subTest(mesh=record['id']):
                document=json.loads((self.output/record['editable']).read_text())
                vertices=document['vertices'];faces=document['triangles']
                self.assertGreater(len(faces),100)
                self.assertEqual(len(faces),record['triangles'])
                self.assertEqual(len(vertices),len(document['uvs']))
                self.assertEqual(len(faces),len(document['face_materials']))
                for p in vertices:self.assertTrue(all(math.isfinite(v) for v in p))
                lo=[min(p[i] for p in vertices) for i in range(3)]
                hi=[max(p[i] for p in vertices) for i in range(3)]
                for i,extent in enumerate(EXPECTED[record['id']]):
                    self.assertAlmostEqual(hi[i]-lo[i],extent,places=7)
                    self.assertAlmostEqual(lo[i],-extent/2 if i<2 else 0,places=7)
                self.assertEqual(record['pivot_cm'],[0,0,0])
                for face in faces:
                    self.assertEqual(len(set(face)),3)
                    self.assertTrue(all(0<=index<len(vertices) for index in face))
                    a,b,c=[vertices[i] for i in face]
                    self.assertGreater(env.length(env.cross(env.sub(b,a),env.sub(c,a))),1e-7)

    def test_glb_is_embedded_metre_geometry_with_consistent_normals_and_tangents(self):
        for record in self.manifest['meshes']:
            with self.subTest(mesh=record['id']):
                document,binary=decode_glb((self.output/record['glb']).read_bytes())
                self.assertEqual(document['asset']['version'],'2.0')
                self.assertEqual(len(document['buffers']),1)
                self.assertNotIn('uri',document['buffers'][0])
                self.assertEqual(document['buffers'][0]['byteLength'],len(binary))
                self.assertNotIn('images',document)
                self.assertNotIn('scale',document['nodes'][0])
                for view in document['bufferViews']:
                    self.assertEqual(view.get('buffer',0),0)
                    self.assertEqual(view.get('byteOffset',0)%4,0)
                    self.assertLessEqual(view.get('byteOffset',0)+view['byteLength'],len(binary))
                aggregate=[];triangles=0
                for primitive in document['meshes'][0]['primitives']:
                    attributes=primitive['attributes']
                    points=read_accessor(document,binary,attributes['POSITION'])
                    normals=read_accessor(document,binary,attributes['NORMAL'])
                    tangents=read_accessor(document,binary,attributes['TANGENT'])
                    uv=read_accessor(document,binary,attributes['TEXCOORD_0'])
                    ids=[v[0] for v in read_accessor(document,binary,primitive['indices'])]
                    self.assertEqual(len(ids)%3,0)
                    self.assertEqual(len(normals),len(points));self.assertEqual(len(uv),len(points))
                    self.assertEqual(len(tangents),len(points))
                    self.assertTrue(all(0<=i<len(points) for i in ids))
                    self.assertLess(primitive['material'],len(document['materials']))
                    for p in points:self.assertTrue(all(math.isfinite(v) for v in p))
                    for n,t in zip(normals,tangents):
                        self.assertAlmostEqual(env.length(n),1,places=5)
                        self.assertAlmostEqual(env.length(t[:3]),1,places=5)
                        self.assertAlmostEqual(env.dot(n,t[:3]),0,places=5)
                        self.assertIn(t[3],[-1,1])
                    for i in range(0,len(ids),3):
                        a,b,c=[points[index] for index in ids[i:i+3]]
                        normal=env.unit(env.cross(env.sub(b,a),env.sub(c,a)))
                        self.assertGreater(env.dot(normal,normals[ids[i]]),.9999)
                    triangles+=len(ids)//3;aggregate.extend(points)
                self.assertEqual(triangles,record['triangles'])
                # Source X remains X; source Z becomes Y; source Y becomes -Z.
                mapped=[EXPECTED[record['id']][i]/100 for i in [0,2,1]]
                for i,extent in enumerate(mapped):
                    self.assertAlmostEqual(max(p[i] for p in aggregate)-min(p[i] for p in aggregate),extent,places=5)
                self.assertAlmostEqual(min(p[1] for p in aggregate),0,places=6)

    def test_obj_reflects_y_and_reverses_winding_once_with_material_sections(self):
        for record in self.manifest['meshes']:
            with self.subTest(mesh=record['id']):
                source=json.loads((self.output/record['editable']).read_text())
                lines=(self.output/record['obj']).read_text().splitlines()
                vertices=[tuple(map(float,line.split()[1:])) for line in lines if line.startswith('v ')]
                normals=[tuple(map(float,line.split()[1:])) for line in lines if line.startswith('vn ')]
                faces=[[int(part.split('/')[0])-1 for part in line.split()[1:]] for line in lines if line.startswith('f ')]
                for p,q in zip(vertices,source['vertices']):
                    self.assertAlmostEqual(p[0],q[0],places=6)
                    self.assertAlmostEqual(p[1],-q[1],places=6)
                    self.assertAlmostEqual(p[2],q[2],places=6)
                for expected,actual in zip(source['triangles'],faces):self.assertEqual(list(reversed(expected)),actual)
                for ids in faces:
                    a,b,c=[vertices[i] for i in ids]
                    geometric=env.unit(env.cross(env.sub(b,a),env.sub(c,a)))
                    self.assertGreater(env.dot(geometric,normals[ids[0]]),.999)
                named={line.split()[1] for line in lines if line.startswith('usemtl ')}
                defined={line.split()[1] for line in (self.output/record['mtl']).read_text().splitlines() if line.startswith('newmtl ')}
                self.assertEqual(named,defined)
                self.assertEqual(named,{'VTEnv_'+key for key in record['materials']})

    def test_closed_modeling_primitives_have_outward_winding(self):
        box=env.Mesh('box');env.beveled_box(box,(0,0,0),(20,30,40),'wood',2)
        cylinder=env.Mesh('cylinder');env.tube(cylinder,[(0,0,0),(0,0,100)],10,'wood',12)
        sphere=env.Mesh('ellipsoid');env.ellipsoid(sphere,(0,0,0),(20,30,40),'wood',8,16)
        self.assertGreater(signed_volume(box),.9*20*30*40)
        self.assertLess(signed_volume(box),20*30*40)
        self.assertAlmostEqual(signed_volume(cylinder),30000,places=6)
        self.assertGreater(signed_volume(sphere),.9*4*math.pi*20*30*40/3)
        self.assertLess(signed_volume(sphere),4*math.pi*20*30*40/3)

    def test_curved_hoop_tube_keeps_its_section_without_axis_flip(self):
        hoop=env.Mesh('hoop')
        points=[(30*math.cos(i*math.tau/96),30*math.sin(i*math.tau/96),0) for i in range(97)]
        env.tube(hoop,points,3,'rope',12,caps=False)
        expected=2*math.pi**2*30*3**2
        self.assertGreater(signed_volume(hoop),.94*expected)
        self.assertLess(signed_volume(hoop),expected)

    def test_real_front_openings_and_curved_landmark_silhouette(self):
        self.assertGreater(min(ray_y_hits(env.healing_facade(),175,150)),0)
        self.assertGreater(min(ray_y_hits(env.cottage_wall(),130,140)),0)
        self.assertLess(min(ray_y_hits(env.cottage_wall(),-75,140)),-150)
        roof=env.healing_roof().fit(EXPECTED['HealingRoof'])
        center=max(z for x,y,z in roof.vertices if abs(x)<30 and abs(y)<30)
        long_edge=max(z for x,y,z in roof.vertices if abs(y)>190)
        short_edge=max(z for x,y,z in roof.vertices if abs(x)>280)
        self.assertGreater(center-long_edge,70)
        self.assertGreater(center-short_edge,70)
        # A gabled box has the same ridge height throughout Y and fails above.
        grass=env.encounter_grass()
        self.assertGreater(len(grass.faces),200)
        self.assertLessEqual(len(grass.faces),400)

    def test_release_roster_is_closed_hashed_and_unknown_usage_is_preserved(self):
        roster=self.manifest['files']
        actual={p.relative_to(self.output).as_posix() for p in self.output.rglob('*') if p.is_file() and p.name!='source-release.json'}
        self.assertEqual({r['path'] for r in roster},actual)
        self.assertEqual(len(roster),len(actual))
        for record in roster:
            path=self.output/record['path']
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),record['sha256'])
            self.assertEqual(path.stat().st_size,record['bytes'])
            self.assertEqual(record['usage_status'],'unknown')
            self.assertTrue(record['inventory_ids'])
        self.assertFalse(self.manifest['canonical'])
        self.assertFalse(self.manifest['acceptance']['game_ready'])
        self.assertEqual({r['proof_bundle'] for r in self.manifest['meshes']},{'B1','B2','B3','B4','B5'})
        for group in self.manifest['assemblies']:
            for component in group['components']:
                self.assertIn(component['mesh'],EXPECTED)
                self.assertEqual(component['scale'],[1,1,1])

    def test_generation_is_byte_deterministic_and_portable(self):
        second=Path(self.temp.name)/'second'
        env.build(second)
        first_paths={p.relative_to(self.output) for p in self.output.rglob('*') if p.is_file()}
        self.assertEqual(first_paths,{p.relative_to(second) for p in second.rglob('*') if p.is_file()})
        for path in first_paths:self.assertEqual((self.output/path).read_bytes(),(second/path).read_bytes(),str(path))
        manifest=(second/'source-release.json').read_text()
        self.assertNotIn(str(self.temp.name),manifest)


if __name__=='__main__':unittest.main()
