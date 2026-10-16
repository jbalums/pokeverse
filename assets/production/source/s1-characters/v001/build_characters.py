"""Deterministic, original S1 character source proofs; Python standard library only.

Authoring: Unreal logical centimetres (+X forward, +Y right, +Z up).
glTF: metres, +Y up, +X forward. Mapping (X,Y,Z)->(X,Z,-Y) follows
the project's measured Unreal glTF importer. This rotation preserves winding.
These are editable procedural studies, not accepted finished characters.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = ROOT / "assets/production/source/s1-characters/v001"
PALETTE = {
    "skin": (0.95, 0.66, 0.44), "skin_shadow": (0.75, 0.37, 0.22),
    "hair": (0.065, 0.035, 0.025), "cap_red": (0.76, 0.055, 0.045),
    "cap_white": (0.96, 0.94, 0.83), "shirt": (0.94, 0.89, 0.76),
    "vest_blue": (0.045, 0.32, 0.59), "vest_edge": (0.025, 0.15, 0.27),
    "shorts": (0.035, 0.095, 0.17), "shoe_red": (0.56, 0.075, 0.055),
    "shoe_dark": (0.025, 0.045, 0.065), "sole": (0.78, 0.78, 0.68),
    "pack_blue": (0.04, 0.24, 0.36), "pack_brown": (0.36, 0.19, 0.075),
    "gold": (0.96, 0.67, 0.12), "eye_white": (0.99, 0.98, 0.91),
    "eye_black": (0.012, 0.018, 0.022), "iris_brown": (0.22, 0.085, 0.025),
    "mouth": (0.24, 0.045, 0.035), "yellow": (1.0, 0.68, 0.035),
    "yellow_light": (1.0, 0.78, 0.055), "cheek_red": (0.90, 0.055, 0.025),
    "ear_black": (0.035, 0.025, 0.018), "stripe_brown": (0.34, 0.15, 0.035),
}


def add(a, b): return tuple(x + y for x, y in zip(a, b))
def sub(a, b): return tuple(x - y for x, y in zip(a, b))
def mul(a, s): return tuple(x * s for x in a)
def dot(a, b): return sum(x * y for x, y in zip(a, b))
def cross(a, b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def unit(v):
    length = math.sqrt(dot(v, v))
    if length < 1e-12: raise ValueError("zero direction")
    return mul(v, 1 / length)
def lerp(a, b, t): return add(mul(a, 1-t), mul(b, t))
def gltf(p): return (p[0]/100, p[2]/100, -p[1]/100)
def gltf_normal(p): return (p[0], p[2], -p[1])
# Physical source axes after the calibrated glTF conversion. Positive pitch
# moves a downward leg toward source +X, preserving the previous gait timing.
PITCH, YAW, ROLL = (0,0,1), (0,1,0), (1,0,0)


class Character:
    def __init__(self, name, inventory):
        self.name, self.inventory = name, inventory
        self.vertices, self.faces, self.bones = [], [], []
        self.bone_index, self.clips = {}, []

    def bone(self, name, position, parent=None):
        index = len(self.bones)
        self.bone_index[name] = index
        self.bones.append({"name": name, "position": position, "parent": self.bone_index.get(parent)})
        return index

    def weights(self, value):
        if isinstance(value, str): value = [(value, 1.0)]
        values = [(self.bone_index[name], float(weight)) for name, weight in value if weight > 1e-8]
        total = sum(w for _, w in values)
        if not 0 < len(values) <= 4 or total <= 0: raise ValueError("invalid influences")
        return values + [(0, 0.0)] * (4-len(values)) if abs(total-1) < 1e-10 else [(j, w/total) for j, w in values] + [(0, 0.0)] * (4-len(values))

    def vertex(self, point, weight, uv=(0, 0)):
        index = len(self.vertices)
        self.vertices.append({"p": tuple(point), "skin": self.weights(weight), "uv": uv})
        return index

    def tri(self, a, b, c, material, outward=None):
        pa, pb, pc = [self.vertices[i]["p"] for i in (a, b, c)]
        normal = cross(sub(pb, pa), sub(pc, pa))
        if dot(normal, normal) < 1e-15: raise ValueError("degenerate triangle")
        if outward is not None and dot(normal, outward) < 0: b, c = c, b
        self.faces.append((a, b, c, material))

    def normals(self):
        result = [(0, 0, 0) for _ in self.vertices]
        for a, b, c, _ in self.faces:
            n = cross(sub(self.vertices[b]["p"], self.vertices[a]["p"]), sub(self.vertices[c]["p"], self.vertices[a]["p"]))
            for i in (a, b, c): result[i] = add(result[i], n)
        return [unit(n) for n in result]

    def bounds(self):
        return [[min(v["p"][i] for v in self.vertices), max(v["p"][i] for v in self.vertices)] for i in range(3)]


def ellipsoid(m, center, radii, material, weight, lat=16, lon=24):
    """Pole-safe smooth ellipsoid, with one vertex at each pole."""
    top_point = add(center, (0, 0, radii[2]))
    top = m.vertex(top_point, weight(top_point) if callable(weight) else weight, (0.5, 1))
    rings = []
    for j in range(1, lat):
        phi = math.pi*j/lat
        ring = []
        for k in range(lon):
            theta = 2*math.pi*k/lon
            p = add(center, (radii[0]*math.sin(phi)*math.cos(theta), radii[1]*math.sin(phi)*math.sin(theta), radii[2]*math.cos(phi)))
            ring.append(m.vertex(p, weight(p) if callable(weight) else weight, (k/lon, 1-j/lat)))
        rings.append(ring)
    bottom = m.vertex(add(center, (0, 0, -radii[2])), weight(center) if callable(weight) else weight, (0.5, 0))
    for k in range(lon):
        k1 = (k+1) % lon
        m.tri(top, rings[0][k], rings[0][k1], material, sub(m.vertices[rings[0][k]]["p"], center))
        m.tri(bottom, rings[-1][k1], rings[-1][k], material, sub(m.vertices[rings[-1][k]]["p"], center))
    for ra, rb in zip(rings, rings[1:]):
        for k in range(lon):
            k1 = (k+1) % lon
            hint = sub(m.vertices[ra[k]]["p"], center)
            m.tri(ra[k], rb[k], rb[k1], material, hint)
            m.tri(ra[k], rb[k1], ra[k1], material, hint)


def loft(m, rings, material, weight, sides=28, cap=True):
    """Horizontal profile rings: (height, forward_center, lateral_center, depth, width)."""
    indices = []
    for j, (z, f, r, depth, width) in enumerate(rings):
        row = []
        for k in range(sides):
            t = 2*math.pi*k/sides
            p = (f+depth*math.cos(t), r+width*math.sin(t), z)
            row.append(m.vertex(p, weight(p) if callable(weight) else weight, (k/sides, j/(len(rings)-1))))
        indices.append(row)
    for j, (a, b) in enumerate(zip(indices, indices[1:])):
        f, r = rings[j][1:3]
        for k in range(sides):
            q = (k+1) % sides
            hint = sub(m.vertices[a[k]]["p"], (f, r, rings[j][0]))
            mat = material(j, k, sides) if callable(material) else material
            m.tri(a[k], b[k], b[q], mat, hint)
            m.tri(a[k], b[q], a[q], mat, hint)
    if cap:
        for ring, profile, sign in [(indices[0], rings[0], -1), (indices[-1], rings[-1], 1)]:
            z, f, r, _, _ = profile
            p = (f, r, z)
            center = m.vertex(p, weight(p) if callable(weight) else weight)
            for k in range(sides):
                mat = material(0, k, sides) if callable(material) else material
                m.tri(center, ring[k], ring[(k+1) % sides], mat, (0, 0, sign))


def tube(m, points, radii, material, weights, sides=16):
    """Sweep with varying radii and smoothly shared skin rings."""
    rows = []
    previous_frame = None
    for j, (p, radius) in enumerate(zip(points, radii)):
        tangent = unit(sub(points[min(j+1, len(points)-1)], points[max(j-1, 0)]))
        reference = (1, 0, 0) if abs(tangent[0]) < 0.8 else (0, 1, 0)
        # Project the last frame onto the next tangent plane to avoid 180 degree
        # twists when a curved strap crosses the initial reference-axis choice.
        transported = sub(previous_frame, mul(tangent, dot(previous_frame, tangent))) if previous_frame else None
        e1 = unit(transported) if transported and dot(transported, transported) > 1e-8 else unit(cross(tangent, reference))
        e2 = unit(cross(tangent, e1)); previous_frame = e1
        rr = radius if isinstance(radius, tuple) else (radius, radius)
        row = []
        for k in range(sides):
            a = 2*math.pi*k/sides
            pos = add(p, add(mul(e1, rr[0]*math.cos(a)), mul(e2, rr[1]*math.sin(a))))
            row.append(m.vertex(pos, weights[j], (k/sides, j/(len(points)-1))))
        rows.append(row)
    for j in range(len(rows)-1):
        mat = material[j] if isinstance(material, list) else material
        for k in range(sides):
            q = (k+1) % sides
            hint = sub(m.vertices[rows[j][k]]["p"], points[j])
            m.tri(rows[j][k], rows[j+1][k], rows[j+1][q], mat, hint)
            m.tri(rows[j][k], rows[j+1][q], rows[j][q], mat, hint)
    for j, hint in [(0, sub(points[0], points[1])), (len(points)-1, sub(points[-1], points[-2]))]:
        center = m.vertex(points[j], weights[j])
        mat = material[0 if j == 0 else -1] if isinstance(material, list) else material
        for k in range(sides): m.tri(center, rows[j][k], rows[j][(k+1) % sides], mat, hint)


def line(m, points, radius, material, bone):
    tube(m, points, [radius]*len(points), material, [bone]*len(points), sides=8)


def face_oval(m, f, r, z, depth, width, height, material, bone="head", lat=12, lon=20):
    ellipsoid(m, (f, r, z), (depth, width, height), material, bone, lat, lon)


def trainer():
    m = Character("Trainer", "VT-HUM-001")
    for name, position, parent in [
        ("root", (0, 0, 0), None), ("pelvis", (0, 0, 75), "root"),
        ("spine", (0, 0, 85), "pelvis"), ("chest", (0, 0, 99), "spine"),
        ("neck", (0, 0, 108), "chest"), ("head", (0, 0, 121), "neck"),
        ("upper_arm_l", (0, -15, 99), "chest"), ("forearm_l", (2, -22, 82), "upper_arm_l"), ("hand_l", (6, -24, 67), "forearm_l"),
        ("upper_arm_r", (0, 15, 99), "chest"), ("forearm_r", (2, 22, 82), "upper_arm_r"), ("hand_r", (6, 24, 67), "forearm_r"),
        ("thigh_l", (0, -7, 71), "pelvis"), ("calf_l", (0, -7, 38), "thigh_l"), ("foot_l", (1, -7, 10), "calf_l"),
        ("thigh_r", (0, 7, 71), "pelvis"), ("calf_r", (0, 7, 38), "thigh_r"), ("foot_r", (1, 7, 10), "calf_r"),
        ("pack_socket", (-11, 0, 96), "chest"), ("hand_socket_r", (6, 24, 64), "hand_r"),
    ]: m.bone(name, position, parent)
    def torso_skin(p):
        if p[2] < 85:
            t = max(0, min(1, (p[2]-75)/10)); return [("pelvis", 1-t), ("spine", t)]
        t = max(0, min(1, (p[2]-85)/14)); return [("spine", 1-t), ("chest", t)]
    def vest_mat(j, k, sides):
        # Front opening is a visible shirt wedge; broad blue sides/back remain continuous.
        angle = 2*math.pi*(k+0.5)/sides
        return "shirt" if math.cos(angle) > 0.96 else "vest_blue"
    loft(m, [(74,0,0,8,11),(80,0,0,9,12),(90,0,0,10,14),(99,0,0,9,16),(103,0,0,7,12)], vest_mat, torso_skin, 40)
    loft(m, [(66,0,0,9,13),(72,0,0,10,14),(77,0,0,9,12)], "shorts", "pelvis", 32)
    ellipsoid(m, (0,0,107), (5,6,7), "skin", "neck")
    # Neck edge and open white collar, following the chest rather than floating.
    for s in (-1,1):
        tube(m, [(7,s*3,102),(8,s*6,99),(8,s*9,98)], [2,2.3,1.5], "shirt", ["chest"]*3, 12)
        line(m, [(10.0,s*3.1,79),(10.3,s*3.3,90),(9.1,s*3.1,99)], .55, "vest_edge", "chest")
    ellipsoid(m, (10.5,3.8,91), (.7,1.1,1.6), "gold", "chest", 10, 16)
    # Human arms: continuous swept skin changes at elbow, sleeves are separate garments.
    for s, side in [(-1,"l"),(1,"r")]:
        upper, lower, hand = "upper_arm_"+side, "forearm_"+side, "hand_"+side
        tube(m, [(0,s*15,98),(1,s*19,91),(2,s*22,82),(4,s*23,75),(6,s*24,67)],
             [(4.6,4.8),(4.7,4.8),(4,4.2),(3.4,3.8),(3,3.3)], "skin",
             [upper,upper,[(upper,.5),(lower,.5)],lower,hand], 24)
        tube(m, [(0,s*15,100),(0.7,s*17,96),(1,s*20,91)], [(5.8,5.4),(6,5.7),(5.4,5.1)], "shirt", [upper]*3, 28)
        ellipsoid(m, (6.5,s*24,64), (3.7,3.7,5.2), "skin", hand, 14, 22)
        ellipsoid(m, (8.5,s*21.8,65), (2.2,2.0,2.9), "skin", hand, 10, 16)
        # Shorts hems and genuinely skinned lower legs.
        thigh, calf, foot = "thigh_"+side, "calf_"+side, "foot_"+side
        tube(m, [(0,s*7,69),(0,s*7,57),(0,s*7,48),(0,s*7,38),(0.5,s*7,23),(1,s*7,11)],
             [(6.2,6.7),(5.6,6.0),(5.1,5.5),(4.4,4.8),(3.8,4.1),(3.2,3.5)], "skin",
             [thigh,thigh,[(thigh,.85),(calf,.15)],[(thigh,.4),(calf,.6)],calf,foot], 28)
        tube(m, [(0,s*7,70),(0,s*7,62),(0,s*7,55)], [(7.3,7.6),(7.0,7.3),(6.6,6.9)], "shorts", [thigh]*3, 28)
        tube(m, [(1,s*7,12),(1,s*7,17),(1,s*7,20)], [(3.6,3.8),(3.8,4.0),(3.7,3.8)], "shirt", [foot]*3, 20)
        # Flattened custom shoe volumes: sole bottom is the ground plane.
        loft(m, [(0,4,s*7,7.5,5.2),(2,4,s*7,8.0,5.5),(3,4,s*7,7.8,5.3)], "sole", foot, 28)
        loft(m, [(3,4,s*7,7.8,5.3),(5,4,s*7,7.7,5.2),(9,2,s*7,6.1,4.5),(12,1,s*7,3.3,3.4)], "shoe_red", foot, 28)
        face_oval(m, 10.2,s*7,5.5,1.8,4.0,2.3,"shoe_dark",foot)
        for u in (7.6,9): line(m, [(6.0,s*7-2,u),(7,s*7,u),(6,s*7+2,u)], .40,"shirt",foot)
    # Face and cranial silhouette; separate lobes represent hair, cap and facial features.
    ellipsoid(m, (0,0,121), (14.1,16.3,18.2), "skin", "head", 26, 40)
    ellipsoid(m, (-8.7,0,122), (8.0,16.7,17), "hair", "head", 20, 32)
    for s in (-1,1):
        ellipsoid(m, (0.2,s*15.7,120), (3.8,3.0,5.0), "skin", "head")
        face_oval(m, 2.8,s*16.9,120.6,1,1,2.6,"skin_shadow")
        ellipsoid(m, (4.5,s*13.4,126), (6.2,4.8,8.7), "hair", "head", 16, 24)
        # White sclera, brown iris, pupil and catchlight make a readable expressive face.
        face_oval(m, 12.4,s*6.4,123.1,1.55,3.65,4.45,"eye_white")
        face_oval(m, 13.85,s*6.0,122.8,.62,2.45,3.3,"iris_brown")
        face_oval(m, 14.40,s*5.9,122.8,.42,1.3,2.65,"eye_black")
        face_oval(m, 14.76,s*5.9-.6,124.1,.20,.65,.95,"eye_white",lat=8,lon=12)
        line(m, [(12.2,s*3.3,129),(12.8,s*6.2,130),(11.8,s*9.2,129.3)], .60,"hair","head")
    face_oval(m, 14.15,0,118.7,3.35,2.1,2.35,"skin")
    line(m, [(13.3,-4.0,114.5),(14.0,-2.3,113.4),(14.3,0,113.0),(14.0,2.3,113.4),(13.3,4,114.5)], .47,"mouth","head")
    # Shaped hat crown and asymmetric front brim instead of an engine hemisphere actor.
    loft(m, [(131,0,0,14.8,18.2),(136,-.6,0,15.1,18.4),(141,-1.2,0,13.5,16.7),(145,-1.8,0,8.5,11),(146,-2,0,1.1,1.5)], "cap_red", "head", 48)
    loft(m, [(130.8,0,0,14.6,18.2),(132.3,0,0,14.8,18.4)], "vest_edge", "head", 48)
    # Crown white front patch is a curved shell on the cap, distinct from eye whites.
    face_oval(m, 14.3,0,137.8,1.2,7.0,6.2,"cap_white",lat=16,lon=28)
    ellipsoid(m, (16.2,0,131.3), (10.3,17.0,1.6), "cap_red", "head", 12, 40)
    face_oval(m, 15.7,0,138.1,.45,2.3,2.6,"cap_red",lat=12,lon=20)
    # Tailored backpack with flap, pocket, straps, stitching and fastening tab.
    ellipsoid(m, (-13.5,0,91), (7.7,12.5,16.5), "pack_blue", "chest", 22, 32)
    ellipsoid(m, (-20.1,0,86.5), (2.7,9.5,7.8), "vest_blue", "chest", 16, 28)
    ellipsoid(m, (-18.0,0,102.5), (5.8,12.3,5), "pack_brown", "chest", 16, 28)
    line(m, [(-22.1,-8,87),(-22.8,0,86),(-22.1,8,87)], .55,"gold","chest")
    for s in (-1,1):
        tube(m, [(-11,s*8.5,104),(-3,s*13,103),(5,s*13,98),(8.8,s*10.5,88),(5,s*9,79),(-7,s*8,78)],
             [(1.6,1),(1.8,1),(1.7,1),(1.5,1),(1.5,1),(1.5,1)], "pack_brown", ["chest"]*6, 12)
        face_oval(m, 9.5,s*10.6,91,1.0,1.8,2.3,"gold","chest",10,16)
    m.clips = human_clips(m)
    return m


def prism(m, polygon, center_f, thickness, material, weight):
    """Concave lightning silhouette, triangulated with deterministic ear clipping."""
    rings = [[m.vertex((center_f+d, r,z),weight((center_f+d,r,z)) if callable(weight) else weight) for r,z in polygon] for d in (-thickness/2,thickness/2)]
    area = sum(polygon[i][0]*polygon[(i+1)%len(polygon)][1]-polygon[(i+1)%len(polygon)][0]*polygon[i][1] for i in range(len(polygon)))
    pending = list(range(len(polygon)))
    if area < 0: pending.reverse()
    triangles = []
    def side(a,b,c): return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    while len(pending)>3:
        found=False
        for j in range(len(pending)):
            a,b,c = pending[j-1],pending[j],pending[(j+1)%len(pending)]
            if side(polygon[a],polygon[b],polygon[c]) <= 1e-9: continue
            others=[v for v in pending if v not in (a,b,c)]
            if any(min(side(polygon[a],polygon[b],polygon[v]),side(polygon[b],polygon[c],polygon[v]),side(polygon[c],polygon[a],polygon[v])) >= -1e-9 for v in others): continue
            triangles.append((a,b,c)); pending.pop(j); found=True; break
        if not found: raise ValueError("invalid tail polygon")
    triangles.append(tuple(pending))
    for a,b,c in triangles:
        for ring,sign in zip(rings,(-1,1)): m.tri(ring[a],ring[b],ring[c],material,(sign,0,0))
    for j in range(len(polygon)):
        q=(j+1)%len(polygon)
        edge=(0,polygon[q][0]-polygon[j][0],polygon[q][1]-polygon[j][1])
        hint = cross(edge,(1,0,0)) if area > 0 else cross((1,0,0),edge)
        # Sharp tail edges use separate normals from the broad cap faces.
        side=[]
        for old in (rings[0][j],rings[0][q],rings[1][q],rings[1][j]):
            p=m.vertices[old]["p"]
            side.append(m.vertex(p,weight(p) if callable(weight) else weight))
        m.tri(side[0],side[1],side[2],material,hint)
        m.tri(side[0],side[2],side[3],material,hint)


def pikachu():
    m = Character("Pikachu", "VT-PKM-PIKACHU")
    for name,position,parent in [
        ("root",(0,0,0),None),("pelvis",(0,0,17),"root"),("chest",(0,0,30),"pelvis"),
        ("head",(0,0,42),"chest"),("ear_l",(-1,-10,51),"head"),("ear_r",(-1,10,51),"head"),
        ("arm_l",(3,-12,31),"chest"),("arm_r",(3,12,31),"chest"),
        ("leg_l",(0,-10,13),"pelvis"),("leg_r",(0,10,13),"pelvis"),
        ("foot_l",(4,-11,5),"leg_l"),("foot_r",(4,11,5),"leg_r"),
        ("tail_base",(-9,6,18),"pelvis"),("tail_tip",(-12,22,37),"tail_base"),
        ("cheek_fx_l",(11,-13,37),"head"),("cheek_fx_r",(11,13,37),"head"),
    ]: m.bone(name,position,parent)
    def body_skin(p):
        t=max(0,min(1,(p[2]-19)/14)); return [("pelvis",1-t),("chest",t)]
    loft(m, [(7,-2,0,6,9),(12,-1,0,10,13),(19,-1.5,0,12,15),(22,-1.4,0,12,15),(27,-1,0,11.4,14.4),(31,-.4,0,10.5,13.2),(34,0,0,9,12),(37,0,0,6.5,9)], "yellow", body_skin, 48)
    ellipsoid(m,(0,0,42),(13.7,18,14.9),"yellow_light","head",28,48)
    # Slightly rounder cheek pads shape the distinctive wide lower face.
    for s,side in [(-1,"l"),(1,"r")]:
        ellipsoid(m,(3.0,s*11.8,37.0),(10.3,7.2,8.0),"yellow_light","head",16,28)
        face_oval(m,11.9,s*7.6,45.3,1.1,2.9,3.55,"eye_black",lat=16,lon=24)
        face_oval(m,12.85,s*7.6-.65,46.7,.32,.88,1.12,"eye_white",lat=10,lon=16)
        face_oval(m,13.1,s*14.2,36.8,1.25,3.5,3.1,"cheek_red",lat=14,lon=24)
        # Long curved tapered ears; black tip is a contiguous material region.
        ear="ear_"+side
        points=[(-1,s*10.8,52),(-1.4,s*14,59),(-2,s*18,66),(-2.4,s*21.0,71),(-2.9,s*22.8,76),(-3.1,s*23.2,77.2)]
        tube(m,points,[(4.1,3.0),(4.5,3.2),(3.7,2.7),(2.6,2.0),(1.2,.95),(.15,.14)],
             ["yellow_light","yellow_light","yellow_light","ear_black","ear_black"],[ear]*6,28)
        arm="arm_"+side
        tube(m,[(3,s*12,31),(5,s*14,27),(7,s*13.8,22),(8,s*12.6,19)],[(4.7,4.2),(4.9,4.1),(4.1,3.7),(2.4,2.7)],"yellow_light",[arm]*4,24)
        for offset in (-1,1):
            line(m,[(9.5,s*12.6+offset*1.3,19),(9.9,s*12.6+offset*1.2,20.5)],.25,"stripe_brown",arm)
        leg,foot="leg_"+side,"foot_"+side
        ellipsoid(m,(-2,s*10.5,10.5),(7.2,7.0,8.1),"yellow",leg,18,28)
        ellipsoid(m,(5,s*11.0,3.5),(9.4,5.1,3.5),"yellow_light",foot,16,28)
        for offset in (-1,1):
            line(m,[(13,s*11+offset*1.4,4),(12,s*11+offset*1.6,5.2)],.27,"stripe_brown",foot)
    face_oval(m,14.0,0,40.1,.8,1.4,.85,"eye_black",lat=10,lon=16)
    # W smile and tiny pink tongue are readable without relying on face textures.
    line(m,[(13.3,-4.7,36.7),(14.1,-2.5,35.6),(14.6,0,36.9),(14.1,2.5,35.6),(13.3,4.7,36.7)],.42,"mouth","head")
    # The dorsal brown stripes are shallow curved patches attached to chest/pelvis.
    for z,w in [(24.8,10.8),(31.0,8.6)]:
        ellipsoid(m,(-11.2,0,z),(1.8,w,1.7),"stripe_brown","chest" if z>28 else "pelvis",12,28)
    # Broad, genuinely concave bolt with a brown root, flat in lateral/up plane.
    def tail_skin(p):
        t=max(0,min(1,(p[2]-20)/20)); return [("tail_base",1-t),("tail_tip",t)]
    # Partition the silhouette at Z=25 rather than layering coplanar painted
    # polygons; matching seam weights keep the brown/yellow join deforming.
    left,right=(34/3,25),(20.375,25)
    prism(m,[left,(10,27),(22,37),(18,42),(29,54),(37,49),(27,37),(30,32),right],-12,3.3,"yellow_light",tail_skin)
    prism(m,[(6,15),(14,21),left,right,(19,24),(22,20),(9,12)],-12,3.3,"stripe_brown",tail_skin)
    m.clips=creature_clips(m)
    return m


def quat(axis, degrees):
    a=math.radians(degrees)/2; n=unit(axis)
    return (*mul(n,math.sin(a)),math.cos(a))


def rotation_channel(bone, axis, values):
    return {"bone":bone,"path":"rotation","values":[quat(axis,v) for v in values]}


def human_clips(m):
    clips=[]
    # 30 Hz samples are explicitly baked; durations contain exact final loop sample.
    for name,duration,loop in [("Trainer_Idle",2.0,True),("Trainer_Walk",1.0,True),("Trainer_Run",.6,True),("Trainer_Interact",1.6,False),("Trainer_Command",1.4,False)]:
        count=round(duration*30); times=[i/30 for i in range(count+1)]
        phase=[2*math.pi*t/duration for t in times]; channels=[]
        def rot(bone,axis,vals): channels.append(rotation_channel(bone,axis,vals))
        if "Idle" in name:
            rot("chest",ROLL,[1.4*math.sin(p) for p in phase])
            rot("head",YAW,[2.2*math.sin(p) for p in phase])
            rot("upper_arm_l",ROLL,[-1.2*math.sin(p) for p in phase])
            rot("upper_arm_r",ROLL,[1.2*math.sin(p) for p in phase])
        elif "Walk" in name or "Run" in name:
            run="Run" in name; amplitude=42 if run else 25
            for side,offset in [("l",0),("r",math.pi)]:
                rot("thigh_"+side,PITCH,[amplitude*math.sin(p+offset) for p in phase])
                rot("calf_"+side,PITCH,[-(62 if run else 32)*max(0,math.sin(p+offset+.4)) for p in phase])
                rot("foot_"+side,PITCH,[-9*math.sin(p+offset) for p in phase])
                rot("upper_arm_"+side,PITCH,[-(37 if run else 20)*math.sin(p+offset) for p in phase])
                rot("forearm_"+side,PITCH,[35 if run else 9 for _ in phase])
            rot("chest",PITCH,[-10 if run else -3 for _ in phase])
            base=gltf(sub(m.bones[m.bone_index["pelvis"]]["position"],(0,0,0)))
            channels.append({"bone":"pelvis","path":"translation","values":[add(base,(0,(.025 if run else .012)*(1-math.cos(2*p)),0)) for p in phase]})
        else:
            envelope=[math.sin(math.pi*t/duration)**2 for t in times]
            if "Interact" in name:
                rot("chest",PITCH,[-14*v for v in envelope])
                rot("upper_arm_r",PITCH,[62*v for v in envelope])
                rot("forearm_r",PITCH,[30*v for v in envelope])
                rot("head",PITCH,[-9*v for v in envelope])
            else:
                rot("upper_arm_r",PITCH,[92*v for v in envelope])
                rot("forearm_r",PITCH,[-15*v for v in envelope])
                rot("chest",YAW,[-12*v for v in envelope])
                rot("head",YAW,[12*v for v in envelope])
        channels.append({"bone":"root","path":"translation","values":[(0,0,0) for _ in times]})
        clips.append({"name":name,"duration_seconds":duration,"loop":loop,"times":times,"channels":channels,"root_motion":"in_place"})
    return clips


def creature_clips(m):
    clips=[]
    for name,duration in [("Pikachu_Idle",2.0),("Pikachu_Walk",.8)]:
        times=[i/30 for i in range(round(duration*30)+1)]; phase=[2*math.pi*t/duration for t in times]
        channels=[]
        def rot(bone,axis,values): channels.append(rotation_channel(bone,axis,values))
        rot("ear_l",ROLL,[3*math.sin(p+.4) for p in phase]); rot("ear_r",ROLL,[-3*math.sin(p+.4) for p in phase])
        rot("tail_base",YAW,[5*math.sin(p) for p in phase]); rot("tail_tip",PITCH,[4*math.sin(p+.3) for p in phase])
        rot("head",YAW,[2.4*math.sin(p) for p in phase])
        if "Walk" in name:
            for side,offset in [("l",0),("r",math.pi)]:
                rot("leg_"+side,PITCH,[24*math.sin(p+offset) for p in phase])
                rot("foot_"+side,PITCH,[-12*math.sin(p+offset) for p in phase])
                rot("arm_"+side,PITCH,[-17*math.sin(p+offset) for p in phase])
        base=gltf((0,0,17))
        channels.append({"bone":"pelvis","path":"translation","values":[add(base,(0,.007*(1-math.cos((2 if "Walk" in name else 1)*p)),0)) for p in phase]})
        channels.append({"bone":"root","path":"translation","values":[(0,0,0) for _ in times]})
        clips.append({"name":name,"duration_seconds":duration,"loop":True,"times":times,"channels":channels,"root_motion":"in_place"})
    return clips


class GlbWriter:
    def __init__(self):
        self.bin=bytearray(); self.views=[]; self.accessors=[]

    def accessor(self, rows, component, kind, target=None, bounds=False):
        width={"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4,"MAT4":16}[kind]
        fmt={5126:"f",5123:"H",5125:"I"}[component]
        while len(self.bin)%4: self.bin.append(0)
        offset=len(self.bin)
        for row in rows:
            values=row if isinstance(row,(tuple,list)) else (row,)
            if len(values)!=width: raise ValueError("accessor width")
            self.bin.extend(struct.pack("<"+fmt*width,*values))
        view={"buffer":0,"byteOffset":offset,"byteLength":len(self.bin)-offset}
        if target is not None: view["target"]=target
        self.views.append(view)
        acc={"bufferView":len(self.views)-1,"componentType":component,"count":len(rows),"type":kind}
        if bounds:
            values=[r if isinstance(r,(tuple,list)) else (r,) for r in rows]
            acc["min"]=[min(r[i] for r in values) for i in range(width)]
            acc["max"]=[max(r[i] for r in values) for i in range(width)]
        self.accessors.append(acc)
        return len(self.accessors)-1


def glb_bytes(m):
    w=GlbWriter(); positions=[gltf(v["p"]) for v in m.vertices]
    attrs={"POSITION":w.accessor(positions,5126,"VEC3",34962,True),
           "NORMAL":w.accessor([gltf_normal(n) for n in m.normals()],5126,"VEC3",34962),
           "TEXCOORD_0":w.accessor([v["uv"] for v in m.vertices],5126,"VEC2",34962),
           "JOINTS_0":w.accessor([[i for i,_ in v["skin"]] for v in m.vertices],5123,"VEC4",34962),
           "WEIGHTS_0":w.accessor([[weight for _,weight in v["skin"]] for v in m.vertices],5126,"VEC4",34962)}
    materials=sorted({face[3] for face in m.faces}); primitives=[]
    for material in materials:
        indices=[i for a,b,c,mat in m.faces if mat==material for i in (a,b,c)]
        primitives.append({"attributes":attrs,"indices":w.accessor(indices,5125,"SCALAR",34963),"material":materials.index(material)})
    nodes=[]
    for index,bone in enumerate(m.bones):
        parent_pos=(0,0,0) if bone["parent"] is None else m.bones[bone["parent"]]["position"]
        node={"name":bone["name"],"translation":gltf(sub(bone["position"],parent_pos)),"rotation":[0,0,0,1]}
        children=[i for i,b in enumerate(m.bones) if b["parent"]==index]
        if children: node["children"]=children
        nodes.append(node)
    nodes.append({"name":m.name+"_SkinnedMesh","mesh":0,"skin":0})
    inverse=[]
    for bone in m.bones:
        x,y,z=gltf(bone["position"])
        inverse.append((1,0,0,0,0,1,0,0,0,0,1,0,-x,-y,-z,1))
    ibm=w.accessor(inverse,5126,"MAT4")
    animations=[]
    for clip in m.clips:
        time=w.accessor(clip["times"],5126,"SCALAR",bounds=True); samplers=[]; channels=[]
        for channel in clip["channels"]:
            values=w.accessor(channel["values"],5126,"VEC4" if channel["path"]=="rotation" else "VEC3")
            samplers.append({"input":time,"output":values,"interpolation":"LINEAR"})
            channels.append({"sampler":len(samplers)-1,"target":{"node":m.bone_index[channel["bone"]],"path":channel["path"]}})
        animations.append({"name":clip["name"],"samplers":samplers,"channels":channels,
                           "extras":{"loop":clip["loop"],"root_motion":clip["root_motion"],"sample_rate_hz":30}})
    document={"asset":{"version":"2.0","generator":"Verdant original procedural character source proof v001","extras":{"inventory_id":m.inventory,"usage":"unassessed","source_unit":"centimetre","source_axes":"+X forward +Y right +Z up","gltf_forward":"+X","axis_calibration":"Unreal import bounds verified 2026-10-16; preserve source forward"}},
              "scene":0,"scenes":[{"name":m.name,"nodes":[0,len(m.bones)]}],"nodes":nodes,
              "meshes":[{"name":m.name,"primitives":primitives}],
              "skins":[{"name":m.name+"_Rig_v001","joints":list(range(len(m.bones))),"skeleton":0,"inverseBindMatrices":ibm}],
              "materials":[{"name":mat,"pbrMetallicRoughness":{"baseColorFactor":[*PALETTE[mat],1],"metallicFactor":0,"roughnessFactor":.82},"doubleSided":False} for mat in materials],
              "animations":animations,"buffers":[{"byteLength":len(w.bin)}],"bufferViews":w.views,"accessors":w.accessors}
    js=json.dumps(document,separators=(",",":"),sort_keys=True).encode(); js+=b" "*((-len(js))%4)
    binary=bytes(w.bin)+b"\0"*((-len(w.bin))%4)
    total=12+8+len(js)+8+len(binary)
    return struct.pack("<4sII",b"glTF",2,total)+struct.pack("<I4s",len(js),b"JSON")+js+struct.pack("<I4s",len(binary),b"BIN\0")+binary


def obj_text(m):
    lines=["# Static bind-pose visual derivative. Unreal cm +X forward +Z up. NOT a deforming rig.","mtllib characters.mtl","o "+m.name]
    for v in m.vertices: lines.append("v %.7f %.7f %.7f" % v["p"])
    for v in m.vertices: lines.append("vt %.7f %.7f" % v["uv"])
    for n in m.normals(): lines.append("vn %.7f %.7f %.7f" % n)
    lines.append("s 1")
    for mat in sorted({f[3] for f in m.faces}):
        lines.append("usemtl "+mat)
        for a,b,c,material in m.faces:
            if material==mat: lines.append("f "+" ".join(f"{i+1}/{i+1}/{i+1}" for i in (a,b,c)))
    return "\n".join(lines)+"\n"


def mtl_text():
    lines=["# Original flat-color material source. Texture/lookdev pass remains pending."]
    for name,color in sorted(PALETTE.items()):
        lines.extend(["newmtl "+name,"Kd %.6f %.6f %.6f" % color,"Ka 0.08 0.08 0.08","Ks 0.02 0.02 0.02","Ns 8","d 1","illum 2",""])
    return "\n".join(lines)


def png_bytes(width,height,pixels):
    def chunk(kind,payload): return struct.pack(">I",len(payload))+kind+payload+struct.pack(">I",zlib.crc32(kind+payload)&0xffffffff)
    raw=b"".join(b"\0"+bytes(pixels[y*width*3:(y+1)*width*3]) for y in range(height))
    return b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",width,height,8,2,0,0,0))+chunk(b"IDAT",zlib.compress(raw,9))+chunk(b"IEND",b"")


def source_preview(m):
    """CPU triangle raster proof, no claim of Unreal lighting/material acceptance."""
    width,height=600,800; pixels=bytearray([235,234,222]*(width*height)); depth=[-1e20]*(width*height)
    camera=unit((1.0,1.55,.9)); right=unit(cross((0,0,1),camera)); up=unit(cross(camera,right))
    bound=m.bounds(); center=tuple((lo+hi)/2 for lo,hi in bound)
    projected=[(dot(sub(v["p"],center),right),dot(sub(v["p"],center),up),dot(sub(v["p"],center),camera)) for v in m.vertices]
    extent=max(max(p[0] for p in projected)-min(p[0] for p in projected), (max(p[1] for p in projected)-min(p[1] for p in projected))*width/height)
    scale=width*.85/extent
    points=[(width/2+x*scale,height/2-y*scale,z) for x,y,z in projected]
    normals=m.normals(); light=unit((1,-.6,1.7))
    for ia,ib,ic,mat in m.faces:
        a,b,c=points[ia],points[ib],points[ic]
        n=cross(sub(m.vertices[ib]["p"],m.vertices[ia]["p"]),sub(m.vertices[ic]["p"],m.vertices[ia]["p"]))
        if dot(n,camera)<=0: continue
        lo_x=max(0,math.floor(min(a[0],b[0],c[0]))); hi_x=min(width-1,math.ceil(max(a[0],b[0],c[0])))
        lo_y=max(0,math.floor(min(a[1],b[1],c[1]))); hi_y=min(height-1,math.ceil(max(a[1],b[1],c[1])))
        area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
        if abs(area)<1e-9: continue
        for y in range(lo_y,hi_y+1):
            for x in range(lo_x,hi_x+1):
                px,py=x+.5,y+.5
                wb=((px-a[0])*(c[1]-a[1])-(py-a[1])*(c[0]-a[0]))/area
                wc=((b[0]-a[0])*(py-a[1])-(b[1]-a[1])*(px-a[0]))/area
                wa=1-wb-wc
                if min(wa,wb,wc)<-1e-7: continue
                z=wa*a[2]+wb*b[2]+wc*c[2]; index=y*width+x
                if z<=depth[index]: continue
                depth[index]=z
                nn=unit(add(add(mul(normals[ia],wa),mul(normals[ib],wb)),mul(normals[ic],wc)))
                shading=.48+.52*max(0,dot(nn,light))
                col=PALETTE[mat]
                for k in range(3): pixels[index*3+k]=round(255*max(0,min(1,col[k]*shading))**(1/2.2))
    return png_bytes(width,height,pixels)


def mesh_record(m):
    bounds=m.bounds(); dimensions=[round(hi-lo,5) for lo,hi in bounds]
    return {"id":m.name,"name":m.name,"inventory_ids":[m.inventory],"glb":m.name+".glb","obj":m.name+".obj","mtl":"characters.mtl",
            "dimensions_cm":dimensions,"bounds_cm":bounds,"gltf_dimensions_m":[dimensions[0]/100,dimensions[2]/100,dimensions[1]/100],
            "vertices":len(m.vertices),"triangles":len(m.faces),"material_sections":len({f[3] for f in m.faces}),
            "rig":{"name":m.name+"_Rig_v001","root":"root","joint_names":[b["name"] for b in m.bones],"max_influences":4,"actual_max_influences":max(sum(w>0 for _,w in v["skin"]) for v in m.vertices),"bind_pose":"relaxed_standing","skin":"linear_blend"},
            "animations":[{k:v for k,v in clip.items() if k not in ("times","channels")} | {"sample_rate_hz":30,"keyframes":len(clip["times"]),"events":[],"foot_contact_status":"authored_cycle_timing_unverified_in_engine"} for clip in m.clips],
            "collisions":"none; engine gameplay capsule and nonblocking follower policy are separate",
            "limitations":["Source proof: likeness, deformation and topology await art review.","Flat-color material sections; painterly texture/UV seam/lookdev pass and LODs pending.","No facial bones or finger rig; features follow the head, mitten hands follow wrist.","Skeletal glTF importer and animation round trip are unverified until native engine receipt.","Static OBJ is bind-pose visual fallback only and cannot validate deformation."]}


def build(output=DEFAULT_OUT, previews=True):
    output=Path(output); output.mkdir(parents=True,exist_ok=True)
    characters=[trainer(),pikachu()]
    content={"characters.mtl":mtl_text().encode(),"build_characters.py":Path(__file__).read_bytes()}
    for m in characters:
        content[m.name+".glb"]=glb_bytes(m); content[m.name+".obj"]=obj_text(m).encode()
        if previews: content[m.name+"-source-preview.png"]=source_preview(m)
    notes="""# S1 character source proofs v001

These are original deterministic procedural studies for B6/B7, built from
`tools/production/build_characters.py`. They are not accepted final art or a
Game Development Studio canonical package. Rebuild with the project Python
interpreter and `tools/production/build_characters.py --output <directory>`.

Trainer and Pikachu GLBs contain real joint hierarchies, inverse bind matrices,
normalized skin weights, normals, material sections, UV coordinates and baked
30 Hz in-place clips. Mesh and skeleton are both in one GLB; no external buffer
or texture dependency is required. Source dimensions use centimetres. GLB uses
metres with +Y up and +X forward: `(forward,right,up) -> (forward,up,-right)/100`.
This is the project's measured Unreal glTF import route; source X/Y bounds
remain aligned in native Unreal. The transform is a proper rotation and keeps
triangle winding. Normals, joints, inverse binds and clip axes use the same
mapping. Ground root stays at zero and visible soles meet source Z=0.

OBJ/MTL derivatives use centimetres with +X forward, +Y right and +Z up.
They represent the unanimated bind pose. They cannot establish Unreal skeletal
or animation support. If an importer applies a separate axis fix, record that
fix as a derivative/import setting instead of modifying the original GLB.

PNG previews are CPU rasterizations of source triangles, not engine captures.
The body and limb surfaces use shaped ring profiles; clothing, hair, face,
ears, tail and pack use separate semantic surfaces where layering is needed.
The head/cheek/body intersections and provisional elbow/knee weight zones need
artist cleanup and deformation review. The concave tail has explicit triangles.
There are no engine primitive actors masquerading as a completed character.

Flat colors are an initial lookdev palette. Painterly textures, packed maps,
UV seam/padding review, optimized material section counts, LODs, collision,
facial/finger rigging, foot planting and polished animation remain pending.
Chapter attack/hit/faint/release/capture actions remain absent; these two clips
do not enable Pikachu as a fully supported chapter combatant. Source generation
does not grant intellectual property usage rights; usage status is unassessed.
No provider, paid service, remote model or external package generated these
sources. The native Unreal importer is checked separately by the integration
pipeline; those receipts do not establish polished deformation or final art.
The included `build_characters.py` is the editable original. A standalone copy
can rebuild into a fresh folder with `python build_characters.py --output <dir>`.
"""
    content["README.md"]=notes.encode()
    existing={p.relative_to(output).as_posix() for p in output.rglob("*") if p.is_file()}
    unexpected=existing-set(content)-{"source-release.json"}
    if unexpected: raise ValueError("release output contains unowned/stale files; use a fresh output directory: "+", ".join(sorted(unexpected)))
    for filename,data in content.items(): (output/filename).write_bytes(data)
    inventory_all=[m.inventory for m in characters]
    files=[]
    for filename,data in sorted(content.items()):
        inventory=[next(m.inventory for m in characters if filename.startswith(m.name))] if any(filename.startswith(m.name) for m in characters) else inventory_all
        kind={".glb":"skinned_gltf_source_proof",".obj":"static_bind_pose_derivative",".mtl":"material_palette_source",".png":"cpu_source_preview",".md":"source_documentation",".py":"editable_procedural_source"}[Path(filename).suffix]
        files.append({"path":filename,"sha256":hashlib.sha256(data).hexdigest(),"bytes":len(data),"kind":kind,"inventory_ids":inventory})
    release={"schema":"verdant.source-release.v1","id":"s1-characters-v001","stage":"S1-source-proof","status":"source_checks_only_acceptance_pending","usage":"unassessed",
             "inventory_ids":inventory_all,"files":files,"meshes":[mesh_record(m) for m in characters],
             "coordinate_system":{"source_units":"centimetres","source_axes":"+X forward +Y right +Z up","gltf_units":"metres","gltf_axes":"+Y up +X forward (project Unreal import calibration)","source_to_gltf":"(X,Y,Z) -> (X,Z,-Y)/100; proper rotation, winding preserved","obj_axes":"Unreal logical cm +X forward +Y right +Z up","root_anchor":"ground centered"},
             "provenance":{"method":"original deterministic procedural geometry and animation","generator":"tools/production/build_characters.py","external_sources":["docs/references/town-visual-target.png visual design reference only"],"usage_status":"unassessed","paid_provider":False,"canonical_game_dev_package":False},
             "acceptance":{"static_validation":"run tools/production/tests/test_characters.py","source_preview":"CPU triangle raster only","native_import":"pending","deformation":"pending","user_visual_approval":"pending","game_ready":False},
             "limitations":["B6/B7 representative source proof only; no final art or game-ready claim.","No .blend/FBX derivative because a supported DCC runtime is unavailable; Python geometry is editable source.","No Game Development Studio CLI canonical receipt; this is a separate local source release schema."]}
    (output/"source-release.json").write_text(json.dumps(release,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    return release


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument("--output",type=Path,default=DEFAULT_OUT); parser.add_argument("--no-previews",action="store_true")
    args=parser.parse_args(); result=build(args.output,not args.no_previews)
    print(json.dumps({"release":result["id"],"output":str(args.output),"meshes":[{"id":m["id"],"triangles":m["triangles"],"dimensions_cm":m["dimensions_cm"]} for m in result["meshes"]]},indent=2))
