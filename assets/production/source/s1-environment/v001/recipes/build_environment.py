"""Original editable S1 environment studies. Standard library only; no engine writes.

Logical source coordinates are centimetres, right-handed Z-up. GLB rotates them
to (x,z,-y)/100, with no mirror. OBJ is a separately labelled legacy-import
derivative (x,-y,z), with reflected winding. These are local source studies,
not Game Development Studio canonical packages or accepted production art.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import random
import struct

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = ROOT / "assets/production/source/s1-environment/v001"

# Palette factors are authored in sRGB and converted to linear for glTF.
PALETTE = {
    "terracotta": ("CF5940", .78, 1), "terracotta_light": ("E57A56", .77, 1),
    "terracotta_dark": ("A23C30", .82, 1), "cream": ("EAD9AF", .9, 1),
    "cream_light": ("F8E8C3", .9, 1), "stone": ("969783", .95, 1),
    "stone_light": ("B8B69B", .95, 1), "stone_dark": ("6D7870", .95, 1),
    "wood": ("795437", .88, 1), "wood_light": ("AA7A49", .87, 1),
    "wood_dark": ("523C2B", .92, 1), "green_shutter": ("61854D", .85, 1),
    "green_shutter_light": ("82A061", .85, 1), "leaf": ("507B36", .9, 1),
    "leaf_light": ("8FAE44", .9, 1), "leaf_deep": ("285B43", .93, 1),
    "leaf_tip": ("B2C758", .9, 1), "pine": ("39725A", .92, 1),
    "pine_light": ("619162", .91, 1), "grass": ("619B3C", .92, 1),
    "grass_tip": ("B5C84E", .91, 1), "flower_white": ("FFF0CF", .8, 1),
    "flower_gold": ("E5AD32", .85, 1), "flower_lilac": ("B880C2", .85, 1),
    "glass": ("53B6D4", .15, .66), "window_warm": ("F6CC73", .35, 1),
    "metal": ("4B595A", .6, 1), "sign_white": ("F2EEE0", .7, 1),
    "water": ("2689B5", .18, .86), "water_light": ("49B2CE", .2, .9),
    "foam": ("D8F3E8", .35, .94), "rope": ("B9AC8B", .95, 1),
    "rope_light": ("D2C3A1", .94, 1), "soil": ("5F5840", .98, 1),
    "lamp_glow": ("FFE3A0", .3, 1),
}


def add(a, b): return tuple(x + y for x, y in zip(a, b))
def sub(a, b): return tuple(x - y for x, y in zip(a, b))
def mul(a, s): return tuple(x * s for x in a)
def dot(a, b): return sum(x * y for x, y in zip(a, b))
def cross(a, b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def length(a): return math.sqrt(dot(a, a))
def unit(a): return mul(a, 1 / length(a))


class Mesh:
    """Triangle soup retains hard edges, independent UVs and face materials."""
    def __init__(self, name):
        self.name, self.vertices, self.uvs, self.faces, self.face_materials = name, [], [], [], []

    def triangle(self, a, b, c, material, uvs=((0, 0), (1, 0), (0, 1))):
        if length(cross(sub(b, a), sub(c, a))) < 1e-8:
            raise ValueError(f"Degenerate triangle in {self.name}: {a}, {b}, {c}")
        first = len(self.vertices)
        self.vertices.extend(tuple(float(v) for v in p) for p in (a, b, c))
        self.uvs.extend(uvs)
        self.faces.append((first, first + 1, first + 2))
        self.face_materials.append(material)

    def face(self, points, material):
        # Project UVs onto the two longest in-plane axes. Explicit triangle UVs
        # keep tangent frames defined on caps and narrow bevel strips as well.
        normal = unit(cross(sub(points[1], points[0]), sub(points[2], points[0])))
        axis_u = unit(sub(points[1], points[0]))
        axis_v = cross(normal, axis_u)
        coords = [(dot(sub(p, points[0]), axis_u), dot(sub(p, points[0]), axis_v)) for p in points]
        scale = max(max(abs(x), abs(y)) for x, y in coords) or 1
        coords = [(x / scale, y / scale) for x, y in coords]
        for i in range(1, len(points) - 1):
            self.triangle(points[0], points[i], points[i + 1], material, (coords[0], coords[i], coords[i + 1]))

    def bounds(self):
        return ([min(p[i] for p in self.vertices) for i in range(3)],
                [max(p[i] for p in self.vertices) for i in range(3)])

    def fit(self, dimensions):
        """Lock the actual AABB to a documented floor-centred module extent."""
        lo, hi = self.bounds()
        center = ((lo[0]+hi[0])/2, (lo[1]+hi[1])/2, lo[2])
        scales = [dimensions[i] / (hi[i]-lo[i]) for i in range(3)]
        self.vertices = [tuple((p[i]-center[i])*scales[i] for i in range(3)) for p in self.vertices]
        return self


def rounded_rectangle(width, depth, radius, segments=3):
    points = []
    for cx, cy, start in [(width/2-radius, depth/2-radius, 0),
                          (-width/2+radius, depth/2-radius, math.pi/2),
                          (-width/2+radius, -depth/2+radius, math.pi),
                          (width/2-radius, -depth/2+radius, 3*math.pi/2)]:
        for i in range(segments + 1):
            a = start + math.pi/2*i/segments
            points.append((cx + radius*math.cos(a), cy + radius*math.sin(a)))
    return points


def loft(mesh, rings, material, caps=True):
    n = len(rings[0])
    for lower, upper in zip(rings, rings[1:]):
        for i in range(n):
            j = (i+1) % n
            mesh.face([lower[i], lower[j], upper[j], upper[i]], material)
    if caps:
        # Fan around mean, rather than a perimeter point: avoids collinear
        # triangles on flat octagon edges and supports irregular rock caps.
        for ring, reverse in ((rings[0], True), (rings[-1], False)):
            center = tuple(sum(p[k] for p in ring)/n for k in range(3))
            for i in range(n):
                tri = [center, ring[i], ring[(i+1) % n]]
                mesh.face(list(reversed(tri)) if reverse else tri, material)


def beveled_box(mesh, center, size, material, bevel=2, angle=0):
    w, d, h = size
    b = min(bevel, w*.2, d*.2, h*.2)
    outer = rounded_rectangle(w, d, b, 1)
    inner = rounded_rectangle(w-2*b, d-2*b, max(b*.2, .01), 1)
    rings = []
    for xy, z in [(inner, -h/2), (outer, -h/2+b), (outer, h/2-b), (inner, h/2)]:
        rings.append([(center[0]+x*math.cos(angle)-y*math.sin(angle),
                       center[1]+x*math.sin(angle)+y*math.cos(angle), center[2]+z) for x, y in xy])
    loft(mesh, rings, material)


def tube(mesh, points, radii, material, sides=10, caps=True):
    if isinstance(radii, (int, float)):
        radii = [radii] * len(points)
    rings = []
    previous_u = None
    for i, (p, radius) in enumerate(zip(points, radii)):
        tangent = unit(sub(points[min(i+1, len(points)-1)], points[max(0, i-1)]))
        # Parallel-transport the section frame. Re-selecting a world up axis at
        # every ring introduces a sudden half-twist on a curved rope or hoop.
        projected = sub(previous_u,mul(tangent,dot(previous_u,tangent))) if previous_u is not None else (0,0,0)
        if length(projected) < 1e-8:
            reference = min([(1,0,0),(0,1,0),(0,0,1)],key=lambda axis:abs(dot(axis,tangent)))
            u = unit(cross(reference,tangent))
        else:
            u = unit(projected)
        previous_u = u
        v = cross(tangent, u)
        rings.append([add(p, add(mul(u, radius*math.cos(math.tau*j/sides)),
                                  mul(v, radius*math.sin(math.tau*j/sides)))) for j in range(sides)])
    loft(mesh, rings, material, caps)


def ellipsoid(mesh, center, radii, material, rings=6, segments=10, irregular=0, phase=0):
    levels = []
    for j in range(1, rings):
        phi = -math.pi/2 + math.pi*j/rings
        row = []
        for i in range(segments):
            theta = math.tau*i/segments
            bump = 1 + irregular*(.7*math.sin(5*theta+2*phi+phase)+.3*math.cos(3*theta-4*phi))
            row.append(add(center, (radii[0]*math.cos(phi)*math.cos(theta)*bump,
                                    radii[1]*math.cos(phi)*math.sin(theta)*bump,
                                    radii[2]*math.sin(phi)*bump)))
        levels.append(row)
    loft(mesh, levels, material, False)
    for row, pole, reverse in [(levels[0], add(center, (0, 0, -radii[2])), True),
                               (levels[-1], add(center, (0, 0, radii[2])), False)]:
        for i in range(segments):
            p = [pole, row[i], row[(i+1) % segments]]
            mesh.face(list(reversed(p)) if reverse else p, material)


def leaf(mesh, base, direction, width, material, bend=5):
    """Pointed almond leaf: raised centre ridge, taper and a curved tip."""
    axis = unit(direction)
    side = unit(cross(axis, (0, 0, 1) if abs(axis[2]) < .9 else (0, 1, 0)))
    normal = unit(cross(side, axis))
    mid = add(add(base, mul(direction, .46)), mul(normal, bend))
    upper = add(add(base, mul(direction, .77)), mul(normal, bend*.8))
    points = [base, add(mid, mul(side, -width)), add(mid, mul(normal, width*.17)),
              add(mid, mul(side, width)), add(upper, mul(side, -width*.58)),
              add(upper, mul(side, width*.58)), add(base, direction)]
    for ids in [(0,1,2),(0,2,3),(1,4,2),(2,4,6),(2,6,5),(2,5,3)]:
        mesh.face([points[i] for i in ids], material)


def warped_tile(mesh, x0, x1, y0, y1, height, material, thickness=4):
    bevel = min(1.6, (x1-x0)*.08, (y1-y0)*.08)
    xy = [(x0+bevel,y0),(x1-bevel,y0),(x1,y0+bevel),(x1,y1-bevel),
          (x1-bevel,y1),(x0+bevel,y1),(x0,y1-bevel),(x0,y0+bevel)]
    lower = [(x,y,height(x,y)) for x,y in xy]
    upper = [(x,y,height(x,y)+thickness) for x,y in xy]
    # Top is crowned, with individually turned/bevelled tile corners.
    loft(mesh, [lower, upper], material, False)
    cx,cy=(x0+x1)/2,(y0+y1)/2
    for i in range(8):
        j=(i+1)%8
        mesh.face([(cx,cy,height(cx,cy)+thickness+1.7),upper[i],upper[j]], material)
        mesh.face([(cx,cy,height(cx,cy)),lower[j],lower[i]], material)


def arch_ring(mesh, center_z, outer, inner, depth, material, start=0, end=math.tau, segments=40):
    closed = abs(end-start-math.tau) < 1e-8
    angles = [start+(end-start)*i/segments for i in range(segments+1)]
    rings=[]
    for y in [-depth/2,depth/2]:
        rings.append(([(outer*math.cos(a),y,center_z+outer*math.sin(a)) for a in angles],
                      [(inner*math.cos(a),y,center_z+inner*math.sin(a)) for a in angles]))
    (front,inside),(back,back_inside)=rings
    for i in range(segments):
        mesh.face([front[i],front[i+1],inside[i+1],inside[i]],material)
        mesh.face([back_inside[i],back_inside[i+1],back[i+1],back[i]],material)
        mesh.face([front[i],back[i],back[i+1],front[i+1]],material)
        mesh.face([inside[i+1],back_inside[i+1],back_inside[i],inside[i]],material)
    if not closed:
        mesh.face([front[0],inside[0],back_inside[0],back[0]],material)
        mesh.face([inside[-1],front[-1],back[-1],back_inside[-1]],material)


def healing_roof():
    m=Mesh("HealingRoof")
    for width,depth,r,z0,z1,material in [(620,460,45,0,12,"cream_light"),
                                        (612,452,44,12,25,"terracotta"),
                                        (595,435,41,25,39,"terracotta_light")]:
        xy=rounded_rectangle(width,depth,r,6)
        loft(m,[[(x,y,z0) for x,y in xy],[(x,y,z1) for x,y in xy]],material)
    height=lambda x,y: 37+161*(1-(abs(x)/294)**4)*(1-(abs(y)/214)**4)
    for j in range(13):
        for i in range(18):
            x0=-289+i*578/18; y0=-209+j*418/13
            material=["terracotta","terracotta_light","terracotta","terracotta_dark"][(i*7+j*3)%4]
            warped_tile(m,x0+.5,x0+578/18-.5,y0+.4,y0+418/13-.4,height,material,5)
    return m


def healing_facade():
    m=Mesh("HealingFacade")
    xy=rounded_rectangle(570,400,42,5)
    for z0,z1,material in [(0,26,"stone_light"),(283,308,"cream_light"),(308,320,"stone")]:
        loft(m,[[(x,y,z0) for x,y in xy],[(x,y,z1) for x,y in xy]],material,False)
    # Returns/back remain real wall thickness. Front is open for glazing.
    for i,p in enumerate(xy):
        q=xy[(i+1)%len(xy)]
        if p[1] < -158 and q[1] < -158:
            continue
        inner_p=(p[0]*.94,p[1]*.94); inner_q=(q[0]*.94,q[1]*.94)
        m.face([(p[0],p[1],26),(q[0],q[1],26),(q[0],q[1],283),(p[0],p[1],283)],"cream")
        m.face([(inner_q[0],inner_q[1],26),(inner_p[0],inner_p[1],26),
                (inner_p[0],inner_p[1],283),(inner_q[0],inner_q[1],283)],"cream_light")
    for x in [-246,-82,82,246]:
        beveled_box(m,(x,-188,154),(30,30,258),"cream_light",3)
        for z in [32,112,198,278]:
            beveled_box(m,(x,-190,z),(33,33,5),"stone_light",1)
    return m


def healing_arch():
    m=Mesh("HealingArch")
    arch_ring(m,32,133,112,30,"terracotta_light",0,math.pi,36)
    arch_ring(m,32,112,7,24,"terracotta",0,math.pi,36)
    # A small lower core fills the centre while the ring remains nondegenerate.
    beveled_box(m,(0,0,23),(263,28,44),"terracotta",4)
    beveled_box(m,(0,-4,5),(270,36,12),"cream_light",2)
    return m


def healing_emblem():
    m=Mesh("HealingEmblem")
    arch_ring(m,50,50,37,8,"sign_white")
    arch_ring(m,50,27,21,10,"sign_white")
    tube(m,[(0,-4,50),(0,4,50)],21,"terracotta",32)
    beveled_box(m,(0,-.6,50),(95,7,12),"sign_white",2)
    return m


def healing_glass():
    m=Mesh("HealingGlass")
    for x0,x1 in [(-220,-88),(-73,73),(88,220)]:
        beveled_box(m,((x0+x1)/2,1.7,121),(x1-x0-8,2.3,232),"glass",.3)
        for x in [x0,x1]:
            beveled_box(m,(x,0,120),(5,8,240),"metal",.8)
        for z in [3,237]:
            beveled_box(m,((x0+x1)/2,0,z),(x1-x0,8,6),"metal",.8)
        beveled_box(m,((x0+x1)/2,0,194),(x1-x0,7,4),"metal",.6)
    for x in [-5,5]:
        beveled_box(m,(x,-5,104),(2,3,18),"cream_light",.4)
    return m


def cottage_roof():
    m=Mesh("CottageRoof")
    h=lambda x,y: 16+202*(1-abs(x)/250)+10*(abs(x)/250)**3
    for side in [-1,1]:
        for i in range(8):
            xa=side*(i*250/8); xb=side*((i+1)*250/8)
            for j in range(12):
                y=-210+j*420/12
                warped_tile(m,min(xa,xb)+.5,max(xa,xb)-.5,y+.3,y+420/12-.3,h,
                            ["terracotta","terracotta_light","terracotta_dark"][(i+2*j)%3],4)
    tube(m,[(0,y,220) for y in [-214,-150,-75,0,75,150,214]],9,"terracotta_light",12)
    for x in [-246,246]:
        beveled_box(m,(x,0,17),(13,440,24),"wood_dark",2)
    # Front and rear sloped fascia follow the actual roof silhouette.
    for y in [-213,213]:
        tube(m,[(-248,y,22),(0,y,225),(248,y,22)],6,"wood_light",8)
    return m


def cottage_wall():
    m=Mesh("CottageWall")
    # Hollow shell with door/window openings on its front, rather than painted apertures.
    for x in [-210,210]:
        beveled_box(m,(x,0,145),(20,340,290),"cream",2)
    beveled_box(m,(0,160,145),(440,20,290),"cream",2)
    for x,w,z,h in [(-175,90,145,290),(22.5,85,145,290),(207.5,25,145,290),
                      (-75,110,257.5,65),(130,130,257.5,65),(130,130,35,70)]:
        beveled_box(m,(x,-160,z),(w,20,h),"cream_light",1.5)
    for y in [-160,160]:
        m.face([(-210,y,290),(210,y,290),(0,y,475)] if y>0 else [(210,y,290),(-210,y,290),(0,y,475)],"cream")
    for x in [-216,65,216]:
        beveled_box(m,(x,-174,147),(13,13,294),"wood",1.5)
    for z in [15,287]:
        beveled_box(m,(0,-173,z),(446,13,14),"wood",1.5)
    for y in [-168,168]:
        tube(m,[(-211,y,290),(0,y,475),(211,y,290)],7,"wood",8)
    # Recessed plank door, handle and arched lintel.
    for i in range(5):
        beveled_box(m,(-119+i*22,-171,111),(21,9,210),["wood","wood_light"][i%2],1.5)
    arch_start=len(m.vertices)
    arch_ring(m,213,64,53,13,"wood",0,math.pi,20)
    m.vertices[arch_start:]=[(x-75,y-172,z) for x,y,z in m.vertices[arch_start:]]
    beveled_box(m,(-75,-175,221),(130,18,13),"wood",2)
    ellipsoid(m,(-45,-183,103),(4,3,4),"metal",4,8)
    return m


def cottage_shutters():
    m=Mesh("CottageShutters")
    for x in [-39,39]:
        for z in [37,100]:
            beveled_box(m,(x,2,z),(69,4,55),"window_warm",.5)
    for x in [-79,0,79]:
        beveled_box(m,(x,-2,69),(8,15,142),"wood",1.5)
    for z in [0,69,138]:
        beveled_box(m,(0,-2,z),(166,15,8),"wood_light",1)
    for side in [-1,1]:
        x=side*113
        for i in range(4):
            beveled_box(m,(x-24+i*16,-4,69),(15,9,132),
                        ["green_shutter","green_shutter_light"][i%2],1.5)
        for z in [19,119]:
            beveled_box(m,(x,-10,z),(66,5,9),"green_shutter",1)
        for z in [30,108]:
            beveled_box(m,(side*87,-14,z),(10,5,5),"metal",.6)
    beveled_box(m,(0,-7,-7),(174,27,12),"wood_light",2)
    return m


def broadleaf():
    m=Mesh("Broadleaf")
    tube(m,[(0,0,0),(5,-3,80),(-3,4,185),(12,5,325),(0,0,420)],
         [34,24,21,13,5],"wood",12)
    for a in range(7):
        theta=a*math.tau/7
        tube(m,[(0,0,12),(math.cos(theta)*37,math.sin(theta)*37,6),
                (math.cos(theta)*65,math.sin(theta)*65,0)],[17,13,2],"wood_dark",7)
    centers=[(-105,-45,370),(99,-30,405),(-55,95,420),(80,85,465),(-65,-90,490),
             (15,-15,545),(35,60,560),(-130,35,480),(112,-75,505)]
    rng=random.Random(71021)
    for k,c in enumerate(centers):
        tube(m,[(4,2,220),(c[0]*.6,c[1]*.6,c[2]-70),c],[13,9,2],"wood",8)
        ellipsoid(m,c,(90,80,85),["leaf","leaf_deep","leaf_light"][k%3],6,10,.08,k)
        for j in range(20):
            theta=j*2.3999632297+k
            phi=math.acos(1-2*(j+.5)/20)
            surface=(math.sin(phi)*math.cos(theta),math.sin(phi)*math.sin(theta),math.cos(phi))
            base=add(c,(surface[0]*77,surface[1]*69,surface[2]*72))
            direction=(surface[0]*rng.uniform(24,47),surface[1]*rng.uniform(24,47),rng.uniform(17,42))
            leaf(m,base,direction,rng.uniform(10,19),["leaf","leaf_light","leaf_tip"][j%3],4)
    return m


def conifer():
    m=Mesh("Conifer")
    tube(m,[(0,0,0),(3,0,180),(-3,1,400),(0,0,670)],[24,18,10,1],"wood",10)
    for tier in range(7):
        z=190+tier*65; r=145-tier*17
        for i in range(11):
            a=i*math.tau/11+tier*.52
            base=(math.cos(a)*8,math.sin(a)*8,z+20)
            tip=(math.cos(a)*r,math.sin(a)*r,z-32)
            tube(m,[base,mul(add(base,tip),.5),tip],[5,3,.6],"wood_dark",5)
            for j in range(4):
                t=(j+.4)/4
                p=add(base,mul(sub(tip,base),t))
                sideways=(-math.sin(a),math.cos(a),0)
                for sign in [-1,1]:
                    direction=add((math.cos(a)*47,math.sin(a)*47,-17),mul(sideways,sign*(28-15*t)))
                    leaf(m,p,direction,18-9*t,["pine","pine_light","leaf_deep"][(i+j+tier)%3],3)
    for i in range(7):
        a=i*math.tau/7
        leaf(m,(0,0,590),(math.cos(a)*27,math.sin(a)*27,88),10,"pine_light",3)
    return m


def encounter_grass():
    m=Mesh("EncounterGrass")
    rng=random.Random(2937)
    for i in range(43):
        a=i*2.3999632297
        radius=48*math.sqrt((i+.2)/43)
        base=(math.cos(a)*radius,math.sin(a)*radius,0)
        lean=rng.uniform(10,31)
        leaf(m,base,(math.cos(a+.7)*lean,math.sin(a+.7)*lean,rng.uniform(65,115)),
             rng.uniform(4,8),["grass","leaf","grass_tip"][i%3],rng.uniform(3,7))
    return m


def flower_head(mesh, center, radius, petal_material, petals=7):
    cx,cy,cz=center
    for j in range(petals):
        a=j*math.tau/petals
        direction=(math.cos(a),math.sin(a),0)
        side=(-direction[1],direction[0],0)
        base=add(center,mul(direction,radius*.14))
        shoulder=add(center,mul(direction,radius*.63))
        tip=add(center,(direction[0]*radius,direction[1]*radius,1.5))
        ridge=add(shoulder,(0,0,2.8))
        left=add(shoulder,mul(side,radius*.29)); right=add(shoulder,mul(side,-radius*.29))
        mesh.face([base,right,ridge],petal_material)
        mesh.face([base,ridge,left],petal_material)
        mesh.face([ridge,right,tip],petal_material)
        mesh.face([left,ridge,tip],petal_material)
    ellipsoid(mesh,center,(radius*.23,radius*.23,2.5),"flower_gold",3,8)


def flower_cluster():
    m=Mesh("FlowerCluster")
    for i,(x,y,h,r) in enumerate([(-30,-19,42,12),(12,-25,55,13),(35,7,35,10),(-21,26,51,11),(7,19,31,9)]):
        tube(m,[(x-3,y,0),(x+2,y-2,h*.6),(x,y,h)],[1.1,.85,.5],"leaf",5)
        leaf(m,(x,y,h*.32),(17*(-1)**i,8,11),5,"leaf_light",2)
        flower_head(m,(x,y,h),r,["flower_white","flower_lilac","flower_white"][i%3],7)
    return m


def irregular_rock(mesh, center, size, material, phase):
    rings=[]
    for z,scale in [(-.5,.78),(-.25,1),(.29,.93),(.5,.57)]:
        row=[]
        for i in range(9):
            a=i*math.tau/9
            variation=1+.12*math.sin(i*2.7+phase+z*4)
            row.append((center[0]+math.cos(a)*size[0]*.5*scale*variation,
                        center[1]+math.sin(a)*size[1]*.5*scale*variation,
                        center[2]+z*size[2]+.07*size[2]*math.sin(a*3+phase)))
        rings.append(row)
    loft(mesh,rings,material)


def cascade_bank():
    m=Mesh("CascadeBank")
    irregular_rock(m,(0,18,135),(385,260,270),"stone_dark",.8)
    for row in range(3):
        for i in range(5):
            x=-160+i*80+(row%2)*12
            y=-93-10*math.sin(i*2+row)
            z=48+row*82+9*math.cos(i*1.7)
            irregular_rock(m,(x,y,z),(92+8*math.sin(i),95,101),["stone","stone_light","stone_dark"][(i+row)%3],i+row*3)
    outline=[]
    for i in range(20):
        a=i*math.tau/20
        outline.append((math.cos(a)*201*(1+.035*math.sin(a*7)),math.sin(a)*136,281+5*math.sin(a*4)))
    loft(m,[[(x*.98,y*.98,z-15) for x,y,z in outline],outline],"grass")
    for i in range(35):
        a=i*2.3999632297
        base=(math.cos(a)*183,math.sin(a)*121,282)
        leaf(m,base,(math.cos(a)*12,math.sin(a)*12,17+(i%5)*3),4,"grass_tip",2)
    return m


def flow_center(t):
    if t < .34:
        return -150+t/.34*108, 281-5*t/.34
    if t < .65:
        v=(t-.34)/.31
        return -42+47*math.sin(v*math.pi/2), 276-253*v
    v=(t-.65)/.35
    return 5+145*v,23-9*v


def cascade_water():
    m=Mesh("CascadeWater")
    nx,ny=12,40
    grid=[]
    for j in range(ny+1):
        t=j/ny; y,z=flow_center(t)
        width=78+6*math.sin(t*9)
        grid.append([(width*(2*i/nx-1),y+1.2*math.sin(i*.7+t*9),z+1.3*math.sin(i*1.7+t*27)) for i in range(nx+1)])
    for j in range(ny):
        for i in range(nx):
            # Flow path progresses downhill; x first ensures upward/outward front.
            m.face([grid[j][i],grid[j][i+1],grid[j+1][i+1],grid[j+1][i]],
                   "water_light" if (i+3*j)%11==0 else "water")
    return m


def cascade_foam():
    m=Mesh("CascadeFoam")
    for strand in range(13):
        start=0; end=1
        x=-77+strand*12
        rows=[]
        for j in range(26):
            t=start+(end-start)*j/25
            y,z=flow_center(t)
            width=1.5+1.2*math.sin(j*.6+strand)**2
            offset=3.5*math.sin(t*19+strand)
            rows.append([(x+offset-width,y,z+2.6),(x+offset+width,y,z+2.6)])
        for j in range(25):
            if (j+strand)%7 not in [0,1]:
                m.face([rows[j][0],rows[j][1],rows[j+1][1],rows[j+1][0]],"foam")
    for radius in [27,47,70]:
        for i in range(28):
            a=i*math.tau/28; b=(i+.74)*math.tau/28
            pts=[(r*math.cos(theta),33+r*.47*math.sin(theta),19+1.2*math.sin(theta*3))
                 for r,theta in [(radius,a),(radius+2.3,a),(radius+2.3,b),(radius,b)]]
            m.face(pts,"foam")
    return m


def bridge_deck():
    m=Mesh("BridgeDeck")
    for i in range(18):
        x=-204+i*24
        sag=10*(abs(x)/216)**2
        material=["wood_light","wood","wood_light","wood_dark"][i%4]
        beveled_box(m,(x,0,29+sag),(23,185+4*math.sin(i*2),15),material,1.8,math.sin(i*3)*.008)
        for y in [-70,70]:
            tube(m,[(x,y,37+sag),(x,y,38+sag)],1.6,"metal",7)
        # Shaped narrow raised grain seams vary by plank, without huge decals.
        for k in range(2):
            yy=-47+k*74+(i%3)*4
            tube(m,[(x-7,yy-20,36.7+sag),(x-6,yy,37+sag),(x-7,yy+19,36.7+sag)],.45,"wood_dark",3)
    for y in [-68,68]:
        points=[(-219+i*438/16,y,12+13*(abs(-1+i/8))**2) for i in range(17)]
        tube(m,points,9,"wood_dark",8)
    return m


def bridge_post():
    m=Mesh("BridgePost")
    beveled_box(m,(0,0,64),(24,24,128),"wood",3.8)
    beveled_box(m,(0,0,134),(29,29,12),"wood_light",4)
    beveled_box(m,(0,0,143),(22,22,6),"wood_light",2)
    for z in [11,111]:
        beveled_box(m,(0,0,z),(25,25,6),"metal",3)
    for i in range(3):
        x=-7+i*6
        tube(m,[(x,-12.1,20),(x+1,-12.4,62),(x-.5,-12.1,100)],.5,"wood_dark",4)
    return m


def bridge_rope():
    m=Mesh("BridgeRope")
    n=88
    for strand in range(3):
        path=[]
        for i in range(n+1):
            t=i/n; x=-220+440*t
            z=6+72*((2*t-1)**2)
            a=t*math.tau*17+strand*math.tau/3
            path.append((x,1.45*math.cos(a),z+1.45*math.sin(a)))
        tube(m,path,1.35,["rope","rope_light","rope"][strand],6)
    return m


def cottage_foundation():
    m=Mesh("CottageFoundation")
    beveled_box(m,(0,0,14),(460,360,28),"stone_dark",5)
    for row in range(2):
        for i in range(8):
            x=-202+i*58+(row%2)*8
            beveled_box(m,(x,-171,17+row*22),(55,30,23),["stone","stone_light"][(i+row)%2],4)
        for side in [-1,1]:
            for j in range(5):
                beveled_box(m,(side*215,-125+j*62,17+row*22),(28,58,23),"stone",4)
    return m


def cottage_step():
    m=Mesh("CottageStep")
    for width,depth,h,y,z in [(170,115,14,0,7),(156,79,14,15,21),(145,43,14,30,35)]:
        beveled_box(m,(0,y,z),(width,depth,h),"stone_light",3)
    return m


def healing_planter():
    m=Mesh("HealingPlanter")
    sides=14
    for i in range(sides):
        a=i*math.tau/sides; b=(i+.95)*math.tau/sides
        rings=[]
        for r,z in [(21,0),(25,5),(31,44),(31,49)]:
            rings.append([(r*math.cos(a),r*math.sin(a),z),(r*math.cos(b),r*math.sin(b),z),
                          ((r-3)*math.cos(b),(r-3)*math.sin(b),z),((r-3)*math.cos(a),(r-3)*math.sin(a),z)])
        loft(m,rings,["wood","wood_light"][i%2])
    for z,r in [(8,26),(42,31.5)]:
        circle=[(math.cos(i*math.tau/28)*r,math.sin(i*math.tau/28)*r,z) for i in range(29)]
        tube(m,circle,1.7,"metal",5)
    ellipsoid(m,(0,0,45),(28,28,3),"soil",3,14)
    for i in range(12):
        a=i*2.3999632297
        base=(math.cos(a)*10,math.sin(a)*10,46)
        leaf(m,base,(math.cos(a)*28,math.sin(a)*28,20+i%4*4),8,"leaf_light",3)
    for i in range(5):
        a=i*math.tau/5
        center=(math.cos(a)*18,math.sin(a)*18,77+(i%2)*8)
        tube(m,[(center[0],center[1],47),center],.9,"leaf",5)
        flower_head(m,center,8,["flower_gold","flower_white"][i%2],6)
    return m


def healing_light():
    m=Mesh("HealingLight")
    for r,z,h in [(21,0,8),(15,8,10),(10,18,23),(5,41,135)]:
        tube(m,[(0,0,z),(0,0,z+h)],r,"metal",10)
    beveled_box(m,(0,0,180),(35,35,10),"metal",3)
    beveled_box(m,(0,0,205),(26,26,41),"lamp_glow",1.5)
    for x,y in [(-15,-15),(-15,15),(15,-15),(15,15)]:
        tube(m,[(x,y,182),(x*.75,y*.75,225)],1.7,"metal",6)
    rings=[]
    for width,z in [(44,226),(29,236),(6,244)]:
        rings.append([(x,y,z) for x,y in rounded_rectangle(width,width,2,1)])
    loft(m,rings,"metal")
    ellipsoid(m,(0,0,247),(3.5,3.5,5),"metal",4,8)
    return m


def bridge_anchor():
    m=Mesh("BridgeAnchor")
    irregular_rock(m,(0,0,16),(95,64,32),"stone",3)
    beveled_box(m,(9,0,48),(28,28,72),"wood",4,0.12)
    tube(m,[(-37,0,22),(8,0,64)],7,"wood_dark",8)
    circle=[(9+18*math.cos(i*math.tau/22),18*math.sin(i*math.tau/22),68+i/22*8) for i in range(23)]
    tube(m,circle,2,"rope",6)
    return m


SPECS = [
    (healing_roof,(620,460,210),["VT-ARC-001"],"B1", "Rounded rectangular eave stack and 234 individually crowned, chamfered curved-surface terracotta tiles."),
    (healing_facade,(570,400,320),["VT-ARC-001"],"B1","Open-front cream facade with curved returns, real inner walls, stone bands and scored piers."),
    (healing_arch,(270,36,170),["VT-ARC-001"],"B1","Extruded red half-disc entrance sign, concentric curved trim and cream footing."),
    (healing_emblem,(100,12,100),["VT-ARC-001"],"B1","Circular cream/red geometric healing landmark emblem; separate editable rings and crossbar."),
    (healing_glass,(445,12,240),["VT-ARC-001"],"B1","Three blue glass fields, metal mullions/transoms and small central door pulls."),
    (cottage_roof,(510,440,235),["VT-ARC-002","VT-ARC-004"],"B2","192 individually crowned roof tiles on two slopes, modeled ridge cap and sloping timber fascia."),
    (cottage_wall,(450,350,475),["VT-ARC-002","VT-ARC-005"],"B2","Hollow plaster/timber cottage shell, real window/door openings, gables, plank door and lintel."),
    (cottage_shutters,(230,32,160),["VT-ARC-005"],"B2","Warm four-pane window, recessed frame, green stave shutters, cross braces, hinges and sill."),
    (broadleaf,(470,430,640),["VT-ENV-004"],"B3","Root-flared branching trunk, nine irregular canopy lobes and 180 pointed ridged leaves."),
    (conifer,(310,310,680),["VT-ENV-005"],"B3","Tapered branching trunk and seven rotated whorls with layered drooping pointed needle boughs."),
    (encounter_grass,(120,120,115),["VT-ENV-008"],"B3","43 curved, pointed, raised-ridge grass blades with three green material values."),
    (flower_cluster,(110,100,60),["VT-ENV-009"],"B3","Five varied-height white/lilac seven-petal daisies, golden centres, thin stems and leaves."),
    (cascade_bank,(420,300,310),["VT-ENV-002","VT-ENV-003"],"B4","Irregular elevated bank substrate, fifteen staggered fractured rock masses, grassy lip and blades."),
    (cascade_water,(170,300,285),["VT-ENV-011"],"B4","Subdivided blue water ribbon with an actual 253 cm vertical cascade and two horizontal reaches."),
    (cascade_foam,(180,300,289),["VT-FX-001"],"B4","Broken downhill foam streaks and three interrupted lower splash/ripple rings; static study."),
    (bridge_deck,(440,195,52),["VT-ARC-007"],"B5","18 independently chamfered varied planks, curved log supports, modeled grain seams and nail heads."),
    (bridge_post,(29,29,146),["VT-ARC-007"],"B5","Chamfered timber upright, layered cap, two metal bands and modeled grain grooves."),
    (bridge_rope,(440,6,78),["VT-ARC-007"],"B5","Three modeled helical rope strands following a sagging parabolic span."),
    (cottage_foundation,(470,370,52),["VT-ARC-004"],"B2","Solid beveled stone base with two staggered visible stone courses and corner returns."),
    (cottage_step,(170,115,42),["VT-ARC-004"],"B2","Three independently beveled, ascending stone entrance treads."),
    (healing_planter,(77,75,91),["VT-ARC-001"],"B1","Fourteen tapered tub staves, metal hoops, soil, leaves and five small flower heads."),
    (healing_light,(44,44,252),["VT-ARC-001"],"B1","Stepped metal pedestal, narrow pole, tapered lantern frame, warm inset glass and hipped cap."),
    (bridge_anchor,(95,64,85),["VT-ARC-007"],"B5","Angular bank rock anchor, chamfered wooden peg, diagonal brace and wrapped rope."),
]


def assembly(name, placements):
    return {"id":name,"units":"centimetres","status":"unreviewed source assembly starting points",
            "components":[{"mesh":mesh,"translation_cm":list(position),"rotation_deg":[0,0,0],"scale":[1,1,1]}
                          for mesh,position in placements]}


ASSEMBLIES = [
    assembly("B1Healing",[("HealingFacade",(0,0,0)),("HealingRoof",(0,0,320)),
                         ("HealingGlass",(0,-203,28)),("HealingArch",(0,-217,264)),
                         ("HealingEmblem",(0,-240,300)),("HealingPlanter",(-178,-254,0)),
                         ("HealingPlanter",(178,-254,0)),("HealingLight",(-323,-210,0))]),
    assembly("B2Cottage",[("CottageFoundation",(0,0,0)),("CottageWall",(0,0,45)),
                         ("CottageRoof",(0,0,290)),("CottageShutters",(132,-184,115)),
                         ("CottageStep",(-75,-225,0))]),
    assembly("B3Vegetation",[("Broadleaf",(-180,140,0)),("Conifer",(290,200,0)),
                            ("EncounterGrass",(70,-115,0)),("FlowerCluster",(-80,-170,0))]),
    assembly("B4Cascade",[("CascadeBank",(-295,0,0)),("CascadeBank",(295,0,0)),
                         ("CascadeWater",(0,0,15)),("CascadeFoam",(0,0,17))]),
    assembly("B5Bridge",[("BridgeDeck",(0,0,0)),("BridgePost",(-208,-92,0)),
                        ("BridgePost",(-208,92,0)),("BridgePost",(208,-92,0)),("BridgePost",(208,92,0)),
                        ("BridgeRope",(0,-93,65)),("BridgeRope",(0,93,65)),
                        ("BridgeAnchor",(-249,0,0)),("BridgeAnchor",(249,0,0))]),
]


def material_rgba(key):
    color,_,alpha=PALETTE[key]
    def linear(x):
        v=int(x,16)/255
        return v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4
    return [linear(color[i:i+2]) for i in (0,2,4)]+[alpha]


def gltf_point(p): return (p[0]/100,p[2]/100,-p[1]/100)
def obj_point(p): return (p[0],-p[1],p[2])


def glb_bytes(mesh):
    """Self-contained glTF 2 GLB, metre coordinates, normals, UVs and tangents."""
    binary=bytearray(); views=[]; accessors=[]
    def accessor(values,kind,component=5126,minimum=None,maximum=None,target=34962):
        while len(binary)%4: binary.append(0)
        offset=len(binary)
        flat=[x for value in values for x in value] if isinstance(values[0],tuple) else values
        binary.extend(struct.pack('<'+('f' if component==5126 else 'I')*len(flat),*flat))
        view=len(views); views.append({"buffer":0,"byteOffset":offset,"byteLength":len(binary)-offset,"target":target})
        entry={"bufferView":view,"componentType":component,"count":len(values),"type":kind}
        if minimum is not None: entry["min"]=minimum;entry["max"]=maximum
        accessors.append(entry);return len(accessors)-1
    used=sorted(set(mesh.face_materials)); primitives=[]
    for material in used:
        positions=[]; normals=[];uvs=[];tangents=[]
        for face,face_material in zip(mesh.faces,mesh.face_materials):
            if face_material!=material: continue
            points=[gltf_point(mesh.vertices[i]) for i in face]
            texture=[mesh.uvs[i] for i in face]
            e1=sub(points[1],points[0]); e2=sub(points[2],points[0]); n=unit(cross(e1,e2))
            du1,dv1=sub(texture[1],texture[0]); du2,dv2=sub(texture[2],texture[0])
            determinant=du1*dv2-dv1*du2
            if abs(determinant)>1e-10:
                t=mul(sub(mul(e1,dv2),mul(e2,dv1)),1/determinant)
                bitangent=mul(sub(mul(e2,du1),mul(e1,du2)),1/determinant)
            else:
                t=unit(e1);bitangent=cross(n,t)
            t=unit(sub(t,mul(n,dot(n,t))))
            handedness=-1 if dot(cross(n,t),bitangent)<0 else 1
            positions.extend(points);normals.extend([n]*3);uvs.extend(texture);tangents.extend([(*t,handedness)]*3)
        lo=[min(p[k] for p in positions) for k in range(3)];hi=[max(p[k] for p in positions) for k in range(3)]
        primitive={"attributes":{"POSITION":accessor(positions,"VEC3",minimum=lo,maximum=hi),
                                  "NORMAL":accessor(normals,"VEC3"),"TEXCOORD_0":accessor(uvs,"VEC2"),
                                  "TANGENT":accessor(tangents,"VEC4")},
                   "indices":accessor(list(range(len(positions))),"SCALAR",5125,target=34963),
                   "material":used.index(material),"mode":4}
        primitives.append(primitive)
    materials=[]
    for key in used:
        rgba=material_rgba(key)
        material={"name":"VTEnv_"+key,"pbrMetallicRoughness":{"baseColorFactor":rgba,"roughnessFactor":PALETTE[key][1],"metallicFactor":.25 if key=="metal" else 0},"doubleSided":True}
        if rgba[3]<1: material["alphaMode"]="BLEND"
        if key=="lamp_glow":material["emissiveFactor"]=[.65,.35,.08]
        materials.append(material)
    document={"asset":{"version":"2.0","generator":"Verdant local environment source authoring v1"},
              "scene":0,"scenes":[{"nodes":[0]}],"nodes":[{"name":mesh.name,"mesh":0}],
              "meshes":[{"name":mesh.name,"primitives":primitives}],"materials":materials,
              "buffers":[{"byteLength":len(binary)}],"bufferViews":views,"accessors":accessors,
              "extras":{"source_units":"centimetres","source_to_glTF":"(x,z,-y)/100","pivot":"floor centre at origin","acceptance":"local source study; engine and visual review pending"}}
    encoded=json.dumps(document,separators=(',',':'),sort_keys=True).encode('utf8')
    encoded+=b' '*((-len(encoded))%4);binary.extend(b'\0'*((-len(binary))%4))
    total=12+8+len(encoded)+8+len(binary)
    return struct.pack('<4sII',b'glTF',2,total)+struct.pack('<I4s',len(encoded),b'JSON')+encoded+struct.pack('<I4s',len(binary),b'BIN\0')+binary


def write_obj(mesh,path):
    lines=[f"# Local editable study | {mesh.name} | centimetres; legacy OBJ derivative",
           "# Source reflection (x,-y,z); face order reversed exactly once.",f"mtllib {path.stem}.mtl",f"o {mesh.name}"]
    lines.extend("v %.7f %.7f %.7f"%obj_point(p) for p in mesh.vertices)
    lines.extend("vt %.7f %.7f"%uv for uv in mesh.uvs)
    normals=[]
    for face in mesh.faces:
        a,b,c=[mesh.vertices[i] for i in face]
        n=obj_point(unit(cross(sub(b,a),sub(c,a))))
        normals.extend([n]*3)
    lines.extend("vn %.7f %.7f %.7f"%n for n in normals)
    lines.append("s off");last=None
    for face,material in zip(mesh.faces,mesh.face_materials):
        if material!=last: lines.append("usemtl VTEnv_"+material);last=material
        lines.append("f "+" ".join(f"{i+1}/{i+1}/{i+1}" for i in reversed(face)))
    path.write_text('\n'.join(lines)+'\n',encoding='utf8')
    material_lines=["# Original project colour palette; no texture dependencies."]
    for key in sorted(set(mesh.face_materials)):
        rgba=material_rgba(key)
        material_lines.extend(["newmtl VTEnv_"+key,"Kd "+' '.join(f'{v:.7f}' for v in rgba[:3]),
                               f"d {rgba[3]}","Ks 0.05 0.05 0.05","Ns 8","illum 2",""])
    path.with_suffix('.mtl').write_text('\n'.join(material_lines)+'\n',encoding='utf8')


def build(output=DEFAULT_OUTPUT):
    output=Path(output).resolve()
    output.mkdir(parents=True,exist_ok=True)
    for directory in ['models','legacy-obj','editable','recipes']:(output/directory).mkdir(exist_ok=True)
    records=[]
    for factory,dimensions,inventory,bundle,recipe in SPECS:
        mesh=factory().fit(dimensions)
        glb=f'models/{mesh.name}.glb';obj=f'legacy-obj/{mesh.name}.obj';source=f'editable/{mesh.name}.mesh.json'
        (output/glb).write_bytes(glb_bytes(mesh));write_obj(mesh,output/obj)
        lo,hi=mesh.bounds()
        record={"id":mesh.name,"inventory_ids":inventory,"proof_bundle":bundle,"glb":glb,"obj":obj,
                "mtl":str(Path(obj).with_suffix('.mtl')).replace('\\','/'),"editable":source,
                "dimensions_cm":list(dimensions),"bounds_cm":{"min":lo,"max":hi},"pivot_cm":[0,0,0],
                "pivot_description":"AABB floor centre; place each module using its own dimensions and intended assembly anchors",
                "triangles":len(mesh.faces),"vertices":len(mesh.vertices),"materials":sorted(set(mesh.face_materials)),
                "recipe":recipe,"collision":"none authored; separate simple native collision required",
                "usage_status":"unknown","lods":[0],"native_acceptance":"pending"}
        (output/source).write_text(json.dumps({"schema":"verdant.editable-mesh.v1","id":mesh.name,"units":"centimetres",
            "coordinates":"right-handed Z-up; front architectural face is -Y; bridge span is X",
            "vertices":mesh.vertices,"uvs":mesh.uvs,"triangles":mesh.faces,"face_materials":mesh.face_materials,
            "recipe":recipe},separators=(',',':'))+'\n',encoding='utf8')
        records.append(record)
    (output/'recipes/build_environment.py').write_bytes(Path(__file__).read_bytes())
    readme='''# S1 environment editable source studies, v001

Original deterministic local modeling work for five of the eight proof bundles.
This source release is noncanonical. It is not a Game Development Studio receipt,
vendor admission, final quality approval, complete town, or game-ready release.
Source/usage status remains unknown; reference/design usage review is unresolved.

Regenerate using Python 3.10+:
    python recipes/build_environment.py --output NEW_EMPTY_DESTINATION

The editable .mesh.json files retain centimetre vertices, triangle topology,
independent face UVs and named material assignments. Python recipes retain the
procedural shapes and deterministic seeds. OBJ is editable in standard DCC tools.

GLB: self-contained glTF 2, metres, Y-up, exact transform (x,z,-y)/100. Positive
rotation and unit conversion only; no mirrored negative node transform. Every
triangle has geometric normals, UVs and tangent frames. Colour factors are linear
glTF values derived from the documented sRGB palette. No texture URI dependencies.

OBJ: separate legacy Unreal derivative in centimetres and (x,-y,z); reversed
winding and reflected normals exactly once, companion MTL and per-face usemtl.
Do not apply the OBJ reflection to GLB or apply both scale conversions together.
Native importer material behaviour and the round trip still require engine checks.

Every module pivot is its AABB floor centre. Bounds and dimensions are recorded
per mesh. Architectural front faces are -Y; bridge spans follow X. Place roof on
wall top using the module height. Healing arch/emblem are wall-mounted studies;
their floor pivot is the lowest sign extent, not the building origin. Glass is
placed in the facade front opening. Cottage shutters include the whole window
assembly. Add foundation/step separately. Bridge rope end anchors sit above its
lowest centre sag, requiring native placement beside paired bridge posts.

Intended assembly starting points in centimetres (art review pending): facade at
(0,0,0), roof at (0,0,320), glass at (0,-203,28), sign arch at (0,-217,264), emblem
at (0,-240,300). Cottage foundation at ground, wall at Z=45, roof at Z=290;
its gables enter the roof envelope. Cottage window/shutters at (132,-184,115).
Bridge deck floor at ground, four posts at X=+-208/Y=+-92, ropes at Y=+-93/Z=65.
Use bridge anchor at the banks. Adjust seams in engine under the matching camera.

Leaves/grass/petals are opaque shaped two-sided geometry. Translucent glass/water
and static foam are proof material approximations. Native wind/flow, shoreline,
masked foliage, LODs, collisions, mips, textures, performance and occlusion work
remain pending. No collision is generated by decorative triangles.

The mesh JSON and GLB are genuine geometry with material colours, not textured
final painterly art. Full matched scene, other proof bundles and Chapter 1 remain
separate work. Review this source in engine before repeating the asset library.
'''
    (output/'README.md').write_text(readme,encoding='utf8')
    # This is metadata for an authoring handoff, never a CLI verification receipt.
    manifest={"schema":"verdant.source-release.v1","release_id":"s1-environment-v001","canonical":False,
              "kind":"project-local editable environment source studies","usage_status":"unknown",
              "authorship":"Original deterministic mesh recipes authored for this project; no acquired meshes or provider jobs",
              "source_coordinates":"centimetres, right-handed Z-up; front -Y; bridge span X",
              "glb_conversion":"(x,z,-y)/100; metre/Y-up; no reflection","obj_conversion":"(x,-y,z); centimetres; reverse winding once",
              "reference":{"path":"docs/references/town-visual-target.png","sha256":None},
              "inventory_ids":sorted({x for record in records for x in record['inventory_ids']}),
              "materials":{key:{"srgb_hex":value[0],"linear_rgba":material_rgba(key),"roughness":value[1]} for key,value in PALETTE.items()},
              "meshes":records,"assemblies":ASSEMBLIES,
              "acceptance":{"static":"run project source verifier","engine":"pending","visual":"pending","game_ready":False},
              "limitations":["Source/usage unknown; no rights permission inferred from original mesh authorship",
                             "Single LOD, no native collision, no texture maps, no native wind/flow shader",
                             "Not a Game Development Studio canonical package, verification receipt or vendored admission"]}
    reference=ROOT/'docs/references/town-visual-target.png'
    if reference.is_file():manifest['reference']['sha256']=hashlib.sha256(reference.read_bytes()).hexdigest()
    files=[]
    for path in sorted(output.rglob('*')):
        if not path.is_file() or path.name=='source-release.json':continue
        relative=path.relative_to(output).as_posix()
        if path.suffix in ['.glb','.obj','.mtl']:
            matching=next((r for r in records if r['id']==path.stem),None)
        elif path.name.endswith('.mesh.json'):
            matching=next((r for r in records if r['id']==path.name[:-10]),None)
        else:matching=None
        files.append({"path":relative,"sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"bytes":path.stat().st_size,
                      "kind":'model' if path.suffix=='.glb' else 'editable-source' if path.suffix in ['.py','.json','.obj'] else 'supplement',
                      "inventory_ids":matching['inventory_ids'] if matching else manifest['inventory_ids'],"usage_status":"unknown"})
    manifest['files']=files
    (output/'source-release.json').write_text(json.dumps(manifest,indent=2,sort_keys=True)+'\n',encoding='utf8')
    return manifest


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=DEFAULT_OUTPUT)
    args=parser.parse_args()
    result=build(args.output)
    print(f"Built {len(result['meshes'])} original environment studies, {sum(r['triangles'] for r in result['meshes']):,} triangles. Engine/visual acceptance pending.")
