"""Validate the interchange kit, not screenshots or Unreal gameplay."""
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import build_kit


class KitTests(unittest.TestCase):
    def test_manifest_hashes_and_portability(self):
        root=build_kit.KIT
        manifest=json.loads((root/'manifest.json').read_text(encoding='utf-8'))
        records=manifest['meshes']+manifest['textures']
        for record in records:
            path=(root/record['file']).resolve()
            self.assertTrue(path.is_relative_to(root.resolve()))
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),record['sha256'])

    def test_obj_indices_uvs_and_nondegenerate_faces(self):
        for path in (build_kit.KIT/'meshes').glob('*.obj'):
            vertices,uvs,faces=[],[],[]
            for line in path.read_text().splitlines():
                parts=line.split()
                if not parts: continue
                if parts[0]=='v': vertices.append(tuple(map(float,parts[1:])))
                if parts[0]=='vt': uvs.append(tuple(map(float,parts[1:])))
                if parts[0]=='f': faces.append([tuple(map(int,p.split('/'))) for p in parts[1:]])
            self.assertGreater(len(faces),0,path.name)
            self.assertEqual(len(vertices),len(uvs),path.name)
            for face in faces:
                for vertex,uv in face:
                    self.assertTrue(1<=vertex<=len(vertices),path.name)
                    self.assertTrue(1<=uv<=len(uvs),path.name)
                a,b,c=[vertices[p[0]-1] for p in face]
                ab=[b[i]-a[i] for i in range(3)]; ac=[c[i]-a[i] for i in range(3)]
                cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]]
                self.assertGreater(sum(x*x for x in cross),1e-14,path.name)
            self.assertTrue(all(math.isfinite(x) for v in vertices for x in v))

    def test_source_meshes_are_deterministic(self):
        first=build_kit.grass(); second=build_kit.grass()
        self.assertEqual(first.vertices,second.vertices)
        self.assertEqual(first.faces,second.faces)
        self.assertLess(sum(len(m.faces) for m in [build_kit.roof(),build_kit.trunk(),
            build_kit.ellipsoid('Canopy',14,24,True),build_kit.ellipsoid('Rock',5,9,True),
            build_kit.grass(),build_kit.flower(),build_kit.leaf(),build_kit.water_plane()]),2000)

    def test_atlas_is_square_rgba_or_rgb(self):
        data=(build_kit.KIT/'textures/town-material-atlas.png').read_bytes()
        self.assertEqual(data[:8],b'\x89PNG\r\n\x1a\n')
        width,height,depth,color=struct.unpack('>IIBB',data[16:26])
        self.assertEqual(width,height)
        self.assertEqual(width%2,0)
        self.assertGreaterEqual(width,1024)
        self.assertEqual(depth,8)
        self.assertIn(color,(2,6))


if __name__=='__main__': unittest.main()
