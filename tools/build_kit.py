"""Deterministic, dependency-free OBJ kit generator. Units: Unreal centimetres."""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
import random

ROOT = Path(__file__).resolve().parents[1]
KIT = ROOT / "assets" / "town-kit"


class Mesh:
    def __init__(self, name):
        self.name, self.vertices, self.uvs, self.faces = name, [], [], []

    def vertex(self, xyz, uv=(0, 0)):
        self.vertices.append(tuple(xyz))
        self.uvs.append(uv)
        return len(self.vertices)

    def triangle(self, a, b, c):
        self.faces.append((a, b, c))

    def quad(self, points, uvs=((0, 0), (1, 0), (1, 1), (0, 1))):
        ids = [self.vertex(p, uv) for p, uv in zip(points, uvs)]
        self.triangle(ids[0], ids[1], ids[2])
        self.triangle(ids[0], ids[2], ids[3])

    def write(self):
        # Unreal's installed legacy OBJ importer preserves Z and mirrors Y.
        # Export right-handed Z-up coordinates; reverse face winding with Y.
        lines = [f"# Verdant kit | {self.name} | centimetres | OBJ Z-up, right-handed", f"o {self.name}"]
        lines += [f"v {x:.5f} {-y:.5f} {z:.5f}" for x, y, z in self.vertices]
        lines += [f"vt {u:.6f} {v:.6f}" for u, v in self.uvs]
        lines += ["s 1"]
        lines += ["f " + " ".join(f"{i}/{i}" for i in reversed(face)) for face in self.faces]
        path = KIT / "meshes" / f"{self.name}.obj"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return path


def ellipsoid(name, rings=12, segments=20, irregular=False):
    mesh = Mesh(name)
    for j in range(rings + 1):
        phi = math.pi * (j + 0.001) / (rings + 0.002)
        for i in range(segments + 1):
            theta = i * 2 * math.pi / segments
            bump = 1 + (0.10 * math.sin(theta * 5 + phi * 4)
                        + 0.055 * math.cos(theta * 7 - phi * 3) if irregular else 0)
            mesh.vertex((50 * math.sin(phi) * math.cos(theta) * bump,
                         50 * math.sin(phi) * math.sin(theta) * bump,
                         50 * math.cos(phi) * bump), (i / segments, j / rings))
    for j in range(rings):
        for i in range(segments):
            a = j * (segments + 1) + i + 1
            b = a + segments + 1
            mesh.triangle(a, b, a + 1)
            mesh.triangle(a + 1, b, b + 1)
    return mesh


def roof():
    m = Mesh("Roof")
    # Gable ridge parallel to Y, raised Z. Faces have local full-surface UVs.
    m.quad([(-50,-50,0),(0,-50,50),(0,50,50),(-50,50,0)])
    m.quad([(0,-50,50),(50,-50,0),(50,50,0),(0,50,50)])
    m.quad([(-50,50,0),(50,50,0),(50,-50,0),(-50,-50,0)])
    for y, reverse in [(-50,False),(50,True)]:
        pts = [(-50,y,0),(50,y,0),(0,y,50)]
        if reverse:
            pts.reverse()
        ids = [m.vertex(p, uv) for p, uv in zip(pts, [(0,0),(1,0),(.5,1)])]
        m.triangle(*ids)
    return m


def trunk():
    m = Mesh("Trunk")
    n = 12
    for z, r in [(0,45),(20,30),(100,20)]:
        for i in range(n + 1):
            a = i * 2 * math.pi / n
            m.vertex((math.cos(a)*r,math.sin(a)*r,z),(i/n,z/100))
    for j in range(2):
        for i in range(n):
            a = j*(n+1)+i+1
            m.triangle(a,a+1,a+n+1)
            m.triangle(a+1,a+n+2,a+n+1)
    return m


def grass():
    m = Mesh("GrassTuft")
    rng = random.Random(49)
    for i in range(11):
        x,y = rng.uniform(-32,32),rng.uniform(-32,32)
        h,w = rng.uniform(48,100),rng.uniform(5,12)
        a = rng.uniform(0,math.tau)
        dx,dy = math.cos(a)*w,math.sin(a)*w
        ids = [m.vertex((x-dx,y-dy,0),(0,0)),
               m.vertex((x+dx,y+dy,0),(1,0)),
               m.vertex((x+dx*.5,y+dy*.5,h*.62),(1,.62)),
               m.vertex((x-dx*.5,y-dy*.5,h*.62),(0,.62)),
               m.vertex((x+dx*2,y+dy*2,h),(.5,1))]
        m.triangle(ids[0],ids[1],ids[2])
        m.triangle(ids[0],ids[2],ids[3])
        m.triangle(ids[3],ids[2],ids[4])
    return m


def flower():
    m = Mesh("Flower")
    for i in range(6):
        a = i*math.tau/6
        cx,cy = math.cos(a)*10,math.sin(a)*10
        centre = m.vertex((cx,cy,40),(.5,.5))
        ring = []
        for j in range(9):
            b = j*math.tau/8
            radial,tangent = 12*math.cos(b),5*math.sin(b)
            ring.append(m.vertex((cx+radial*math.cos(a)-tangent*math.sin(a),
                                  cy+radial*math.sin(a)+tangent*math.cos(a),
                                  40+math.sin(b)*2),((math.cos(b)+1)/2,(math.sin(b)+1)/2)))
        for j in range(8):
            m.triangle(centre,ring[j],ring[j+1])
    return m


def leaf():
    m = Mesh("Leaf")
    ids = [m.vertex(p,uv) for p,uv in zip(
        [(0,0,0),(-35,0,45),(0,12,60),(35,0,45),(0,0,100)],
        [(.5,0),(0,.45),(.5,.6),(1,.45),(.5,1)])]
    for a,b,c in [(0,1,2),(0,2,3),(1,4,2),(2,4,3)]:
        m.triangle(ids[a],ids[b],ids[c])
    return m


def water_plane():
    m=Mesh('WaterPlane')
    nx,ny=8,48
    for j in range(ny+1):
        for i in range(nx+1):
            m.vertex((-50+100*i/nx,-50+100*j/ny,0),(i/nx,j/ny))
    for j in range(ny):
        for i in range(nx):
            a=j*(nx+1)+i+1
            m.triangle(a,a+1,a+nx+2)
            m.triangle(a,a+nx+2,a+nx+1)
    return m


def build():
    meshes = [roof(),trunk(),ellipsoid("Canopy",14,24,True),
              ellipsoid("Rock",5,9,True),grass(),flower(),leaf(),water_plane()]
    records = []
    for mesh in meshes:
        path = mesh.write()
        records.append({"id":mesh.name,"file":str(path.relative_to(KIT)).replace("\\","/"),
                        "vertices":len(mesh.vertices),"triangles":len(mesh.faces),
                        "sha256":hashlib.sha256(path.read_bytes()).hexdigest(),
                        "collision":"assembly-owned simple collision; decorative meshes have none"})
    atlas = KIT / "textures/town-material-atlas.png"
    manifest = {"schema":1,"kit":"verdant-corner-v1","units":"centimetres",
                "source_coordinates":"OBJ right-handed Z-up; Y mirrored by installed Unreal importer",
                "seed":41723,"meshes":records,
                "textures":[{"id":"TownAtlas","file":"textures/town-material-atlas.png",
                              "sha256":hashlib.sha256(atlas.read_bytes()).hexdigest(),
                              "origin":"OpenAI image generation, authored for this project",
                              "quadrants":{"top_left":"Grass","top_right":"Paving",
                                           "bottom_left":"Wood","bottom_right":"Roof"},
                              "uv_inset":0.012,
                              "limitations":"Generated seams need in-engine visual approval; no PBR map fidelity claim."}],
                "authored_by":"procedural project scripts and generated material artwork",
                "reference":"../../docs/references/isometric-town-concept.png",
                "characters":"Constructed trainer, gardener and Bulbasaur study; not final skinned character assets.",
                "acceptance":"Source and import validation separate from in-engine visual/gameplay acceptance."}
    (KIT / "manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
    print(f"Wrote {len(meshes)} meshes, {sum(len(m.faces) for m in meshes)} source triangles and manifest.")


if __name__ == "__main__":
    build()
