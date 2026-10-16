"""Verdant Town hero assets, modelled with Blender's bmesh kernel.

Run from the project root:
    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P prototypes/blender/build_assets.py

Writes prototypes/verdant-assets.js (window.VERDANT_ASSETS), which verdant-town-3d.html picks up automatically.
Geometry is authored directly in three.js convention: x right, y up, +z toward the camera / building front.
Colours are sRGB vertex colours with ambient occlusion baked in by ray casting against each asset.
"""
import base64
import json
import math
import os
import random
import time
from array import array

import bmesh
from mathutils import Matrix, Vector, noise
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'verdant-assets.js'))
rng = random.Random(1015)


def rr(a, b):
    return a + (b - a) * rng.random()


def pick(seq):
    return seq[int(rng.random() * len(seq))]


def hexc(h):
    return Vector((int(h[1:3], 16) / 255, int(h[3:5], 16) / 255, int(h[5:7], 16) / 255))


def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def T(x, y, z):
    return Matrix.Translation((x, y, z))


def RX(a):
    return Matrix.Rotation(a, 4, 'X')


def RY(a):
    return Matrix.Rotation(a, 4, 'Y')


def RZ(a):
    return Matrix.Rotation(a, 4, 'Z')


def S(x, y, z):
    m = Matrix.Identity(4)
    m[0][0], m[1][1], m[2][2] = x, y, z
    return m


def frame_matrix(xa, ya, za, pos):
    """Matrix whose columns are the local x/y/z axes and translation."""
    return Matrix(((xa.x, ya.x, za.x, pos.x), (xa.y, ya.y, za.y, pos.y), (xa.z, ya.z, za.z, pos.z), (0, 0, 0, 1)))


Y_UP = RX(-math.pi / 2)  # bmesh primitives grow along +z; this turns +z into +y


# ---------------------------------------------------------------- accumulation
class Part:
    def __init__(self, mat):
        self.mat = mat
        self.pos, self.nrm, self.col, self.uv = [], [], [], []

    def tri(self, ps, ns, cs, uvs=None):
        for i in range(3):
            self.pos.append(tuple(ps[i]))
            self.nrm.append(tuple(ns[i]))
            self.col.append(tuple(cs[i]))
            self.uv.append(tuple(uvs[i]) if uvs else None)


class Asset:
    def __init__(self, name, ao_dist=0.6, ao_strength=0.75, ground=0.0, ao_skip=()):
        self.name, self.parts = name, {}
        self.ao_dist, self.ao_strength, self.ground, self.ao_skip = ao_dist, ao_strength, ground, ao_skip
        ASSETS.append(self)

    def p(self, mat):
        if mat not in self.parts:
            self.parts[mat] = Part(mat)
        return self.parts[mat]


ASSETS = []


def add_bm(part, bm, M=None, color=None, cfn=None, jitter=0.05, smooth_deg=45, nfn=None):
    """Append a bmesh, transformed by M, with auto-smoothed normals and a colour (or colour function)."""
    M = M if M is not None else Matrix.Identity(4)
    N3 = M.to_3x3().inverted_safe().transposed()
    bm.normal_update()
    bm.faces.index_update()
    cs = math.cos(math.radians(smooth_deg))
    j = 1 + (rng.random() - 0.5) * 2 * jitter  # one tint per call so faces share vertices
    for tri in bm.calc_loop_triangles():
        f = tri[0].face
        fn = f.normal
        ps, ns, cl = [], [], []
        for lp in tri:
            if smooth_deg >= 180:
                n = lp.vert.normal.copy()
            else:
                n = Vector()
                for f2 in lp.vert.link_faces:
                    if f2.normal.dot(fn) >= cs:
                        n += f2.normal * max(f2.calc_area(), 1e-7)
                n = n.normalized() if n.length > 1e-9 else fn.copy()
            wp = M @ lp.vert.co
            wn = (N3 @ n).normalized()
            if nfn:
                wn = nfn(wp, wn)
            ps.append(wp)
            ns.append(wn)
            cl.append(cfn(wp, wn) if cfn else color * j)
        part.tri(ps, ns, cl)


def add_quad(part, pts, nrms, cols, uvs):
    part.tri([pts[0], pts[1], pts[2]], [nrms[0], nrms[1], nrms[2]], [cols[0], cols[1], cols[2]], [uvs[0], uvs[1], uvs[2]])
    part.tri([pts[0], pts[2], pts[3]], [nrms[0], nrms[2], nrms[3]], [cols[0], cols[2], cols[3]], [uvs[0], uvs[2], uvs[3]])


# ---------------------------------------------------------------- primitives
def bevel(bm, amount, segs=1):
    if amount > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=amount, segments=segs, affect='EDGES', profile=0.5, clamp_overlap=True)
    return bm


def bm_box(sx, sy, sz, bev=0.0, segs=1):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector((sx, sy, sz)), verts=bm.verts)
    return bevel(bm, bev, segs)


def bm_cyl(r1, r2, h, segs=12, caps=True):
    """Cylinder/cone standing on y=0 growing to y=h."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=segs, radius1=r1, radius2=r2, depth=h)
    bmesh.ops.transform(bm, matrix=T(0, h / 2, 0) @ Y_UP, verts=bm.verts)
    return bm


def bm_ico(r, sub=2):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    return bm


def bm_sphere(r, u=16, v=10):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=r)
    return bm


def bm_prism(poly, t):
    """Extrude a 2D polygon (xy) to thickness t along z, centred."""
    bm = bmesh.new()
    front = [bm.verts.new((x, y, t / 2)) for x, y in poly]
    back = [bm.verts.new((x, y, -t / 2)) for x, y in poly]
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    n = len(poly)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((front[j], front[i], back[i], back[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_torus(R, r, segs=24, tsegs=8, arc=2 * math.pi):
    """Torus in the xy plane (axis z); partial arcs start at +x and run counter-clockwise."""
    bm = bmesh.new()
    closed = arc >= 2 * math.pi - 1e-6
    n = segs if closed else segs + 1
    rings = []
    for i in range(n):
        a = arc * i / segs
        c = Vector((math.cos(a), math.sin(a), 0))
        ring = []
        for k in range(tsegs):
            b = 2 * math.pi * k / tsegs
            ring.append(bm.verts.new(c * (R + r * math.cos(b)) + Vector((0, 0, r * math.sin(b)))))
        rings.append(ring)
    for i in range(segs):
        r0, r1 = rings[i], rings[(i + 1) % n]
        for k in range(tsegs):
            k1 = (k + 1) % tsegs
            bm.faces.new((r0[k], r1[k], r1[k1], r0[k1]))
    if not closed:
        bm.faces.new(rings[0])
        bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_tube(points, radius, tsegs=6):
    """Tube along a list of Vectors."""
    bm = bmesh.new()
    rings = []
    for i, p in enumerate(points):
        a = points[max(0, i - 1)]
        b = points[min(len(points) - 1, i + 1)]
        t = (b - a).normalized()
        up = Vector((0, 1, 0)) if abs(t.y) < 0.9 else Vector((1, 0, 0))
        u = t.cross(up).normalized()
        v = t.cross(u).normalized()
        rings.append([bm.verts.new(p + (u * math.cos(2 * math.pi * k / tsegs) + v * math.sin(2 * math.pi * k / tsegs)) * radius) for k in range(tsegs)])
    for i in range(len(rings) - 1):
        for k in range(tsegs):
            k1 = (k + 1) % tsegs
            bm.faces.new((rings[i][k], rings[i + 1][k], rings[i + 1][k1], rings[i][k1]))
    bm.faces.new(rings[0])
    bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def jitter_verts(bm, amp, seed=0.0):
    for v in bm.verts:
        o = v.co * 9.0 + Vector((seed, seed * 1.7, seed * 2.3))
        v.co += Vector((noise.noise(o), noise.noise(o + Vector((31.4, 0, 0))), noise.noise(o + Vector((0, 17.2, 0))))) * amp
    return bm


def lump(bm, amp, freq, seed):
    """Radial noise displacement for organic blobs."""
    off = Vector((seed * 13.1, seed * 7.7, seed * 3.3))
    for v in bm.verts:
        d = v.co.normalized()
        n = noise.noise(v.co * freq + off) * 0.7 + noise.noise(v.co * freq * 2.3 + off) * 0.3
        v.co += d * n * amp
    return bm


# ---------------------------------------------------------------- shared builders
def stone_face(part, M, u0, u1, v0, v1, opens, palette, row=(0.19, 0.26), wid=(0.26, 0.5), depth=(0.05, 0.09), bev=0.22, clip=None, segs=1, cfn=None):
    """Course of individually bevelled stones on a wall face. Local frame: u along the wall, v up, w out of the wall."""
    v = v0
    while v < v1 - 0.03:
        h = min(rr(*row), v1 - v)
        u = u0 - rr(0, wid[1])
        while u < u1:
            w = rr(*wid)
            a, b = max(u, u0), min(u + w, u1)
            u += w
            if b - a < 0.06:
                continue
            spans = [(a, b)]
            for ou0, ou1, ov0, ov1 in opens:
                if v + h > ov0 + 0.01 and v < ov1 - 0.01:
                    nxt = []
                    for s0, s1 in spans:
                        if s1 <= ou0 or s0 >= ou1:
                            nxt.append((s0, s1))
                        else:
                            if ou0 - s0 > 0.06:
                                nxt.append((s0, ou0))
                            if s1 - ou1 > 0.06:
                                nxt.append((ou1, s1))
                    spans = nxt
            for s0, s1 in spans:
                top = v + h
                if clip:
                    top = min(top, clip(s0), clip(s1))
                hh = top - v
                if hh < 0.05:
                    continue
                d = rr(*depth)
                g = 0.02
                bm = bm_box(s1 - s0 - g, hh - g, d, bev=min(s1 - s0, hh) * bev, segs=segs)
                jitter_verts(bm, 0.006, rng.random() * 50)
                col = hexc(pick(palette))
                add_bm(part, bm, M @ T((s0 + s1) / 2, v + hh / 2, d / 2 - 0.02), color=col, cfn=(lambda p, n, c=col: cfn(p, n, c)) if cfn else None, jitter=0.04, smooth_deg=50)
                bm.free()
        v += h


def window_frame(part, M, x0, x1, y0, y1, t=0.07, d=0.08, color='#6d4527', mull=(1, 1)):
    col = hexc(color)
    for (cx, cy, sx, sy) in [((x0 + x1) / 2, y1 + t / 2, x1 - x0 + 2 * t, t), ((x0 + x1) / 2, y0 - t / 2, x1 - x0 + 2 * t, t),
                              (x0 - t / 2, (y0 + y1) / 2, t, y1 - y0), (x1 + t / 2, (y0 + y1) / 2, t, y1 - y0)]:
        add_bm(part, bm_box(sx, sy, d, bev=0.012), M @ T(cx, cy, d / 2 - 0.02), color=col, jitter=0.03)
    nx, ny = mull
    for i in range(1, nx + 1):
        x = x0 + (x1 - x0) * i / (nx + 1)
        add_bm(part, bm_box(0.035, y1 - y0, 0.035, bev=0.008), M @ T(x, (y0 + y1) / 2, 0.0), color=col, jitter=0.02)
    for i in range(1, ny + 1):
        y = y0 + (y1 - y0) * i / (ny + 1)
        add_bm(part, bm_box(x1 - x0, 0.035, 0.035, bev=0.008), M @ T((x0 + x1) / 2, y, 0.0), color=col, jitter=0.02)


def glass(part, M, x0, x1, y0, y1, z=-0.03, color='#ffe8b0'):
    c = hexc(color)
    pts = [M @ Vector((x0, y0, z)), M @ Vector((x1, y0, z)), M @ Vector((x1, y1, z)), M @ Vector((x0, y1, z))]
    n = (M.to_3x3() @ Vector((0, 0, 1))).normalized()
    add_quad(part, pts, [n] * 4, [c] * 4, [(0, 0), (1, 0), (1, 1), (0, 1)])


def shutter(part, M, cx, cy, w, h):
    base = hexc('#e9ece6')
    add_bm(part, bm_box(w, h, 0.04, bev=0.01), M @ T(cx, cy, 0.03), color=base * 0.86, jitter=0.03)
    n = 7
    for i in range(n):
        y = cy - h / 2 + 0.06 + (h - 0.12) * (i + 0.5) / n
        add_bm(part, bm_box(w - 0.06, (h - 0.12) / n * 0.9, 0.02), M @ T(cx, y, 0.06) @ RX(-0.5), color=base, jitter=0.03)


def flowers(part, M, x0, x1, y, z, n=8, cols=('#ff6f8f', '#ffd23f', '#ffffff', '#ff8a3d', '#b89cff')):
    for i in range(n):
        x = x0 + (x1 - x0) * (i + rng.random()) / n
        add_bm(part, bm_ico(rr(0.05, 0.075), 1), M @ T(x, y + rr(0.02, 0.1), z + rr(-0.04, 0.04)), color=hexc('#4f9a35'), jitter=0.08, smooth_deg=180)
        add_bm(part, bm_ico(rr(0.035, 0.05), 1), M @ T(x + rr(-0.03, 0.03), y + rr(0.09, 0.16), z + rr(-0.03, 0.05)), color=hexc(pick(cols)), jitter=0.05, smooth_deg=180)


# ---------------------------------------------------------------- Pokémon Center
BEIGE = ['#efe3c8', '#e5d6b8', '#f3e9d6', '#ddcca9', '#e9dcc0', '#d8c7a5', '#ece0c6']
REDS = ['#e0483a', '#d63f33', '#e85a48', '#cc3a2f', '#e2503f', '#d94a3c', '#ea6150']


def fish_tile():
    w, h = 0.22, 0.2
    pts = [(-w / 2, h / 2)]
    pts.append((-w / 2, -h / 2 + w / 2))
    for k in range(1, 6):
        a = math.pi + math.pi * k / 6
        pts.append((math.cos(a) * w / 2, -h / 2 + w / 2 + math.sin(a) * w / 2))
    pts.append((w / 2, -h / 2 + w / 2))
    pts.append((w / 2, h / 2))
    return bm_prism(pts, 0.034)


def pokecenter():
    A = Asset('pokecenter', ao_dist=0.7)
    W, D, H = 5.3, 4.3, 2.15
    base, blue, warm = A.p('base'), A.p('glow_blue'), A.p('glow_warm')
    add_bm(base, bm_box(W + 0.3, 0.14, D + 0.3, bev=0.03), T(0, 0.07, 0), color=hexc('#a59b89'))
    add_bm(base, bm_box(W - 0.06, H, D - 0.06), T(0, 0.14 + H / 2, 0), color=hexc('#b9aa8c'))
    dw = W * 0.3
    win_x = W * 0.31
    front_open = [(-dw / 2 - 0.12, dw / 2 + 0.12, 0.0, 2.1)] + [(sx * win_x - W * 0.135, sx * win_x + W * 0.135, 0.6, 1.85) for sx in (-1, 1)]
    faces = [
        (T(0, 0, D / 2 - 0.03), W, front_open),
        (T(W / 2 - 0.03, 0, 0) @ RY(math.pi / 2), D, [(-1.1, 0.3, 0.75, 1.75)]),
        (T(-W / 2 + 0.03, 0, 0) @ RY(-math.pi / 2), D, [(-0.3, 1.1, 0.75, 1.75)]),
        (T(0, 0, -D / 2 + 0.03) @ RY(math.pi), W, []),
    ]
    for M, L, opens in faces:
        stone_face(base, M, -L / 2 + 0.24, L / 2 - 0.24, 0.14, 0.14 + H, opens, BEIGE)
    # quoins
    for sx in (-1, 1):
        for sz in (-1, 1):
            y, k = 0.14, 0
            while y < 0.14 + H - 0.05:
                hh = min(0.27, 0.14 + H - y)
                lx, lz = (0.5, 0.3) if k % 2 == 0 else (0.3, 0.5)
                add_bm(base, jitter_verts(bm_box(lx, hh - 0.02, lz, bev=0.035), 0.006), T(sx * (W / 2 - lx / 2 + 0.03), y + hh / 2, sz * (D / 2 - lz / 2 + 0.03)), color=hexc(pick(['#f4ecdb', '#ece2cc', '#f7f0e2'])), jitter=0.03, smooth_deg=50)
                y += hh
                k += 1
    # trim band and cornice
    add_bm(base, bm_box(W + 0.26, 0.2, D + 0.26, bev=0.05, segs=2), T(0, H + 0.24, 0), color=hexc('#f6f2ea'), jitter=0.01)
    add_bm(base, bm_box(W + 0.16, 0.08, D + 0.16, bev=0.02), T(0, H + 0.1, 0), color=hexc('#e7dfcf'), jitter=0.01)
    # dome of fish-scale tiles over a dark core
    roof = A.p('base')
    a, b, c, cy = W / 2 + 0.1, 1.55, D / 2 + 0.1, H + 0.33
    core = bm_sphere(1.0, 40, 16)
    bmesh.ops.delete(core, geom=[v for v in core.verts if v.co.z < -0.02], context='VERTS')
    add_bm(roof, core, T(0, cy, 0) @ S(a - 0.03, b - 0.03, c - 0.03) @ RX(-math.pi / 2), color=hexc('#8f2219'), jitter=0.02, smooth_deg=180)
    tile = fish_tile()
    th = 0.0
    row = 0
    while th < 1.36:
        ca, sa = math.cos(th), math.sin(th)
        A_, C_ = a * ca, c * ca
        per = math.pi * (3 * (A_ + C_) - math.sqrt((3 * A_ + C_) * (A_ + 3 * C_)))
        n = max(6, round(per / 0.21))
        for i in range(n):
            ph = 2 * math.pi * (i + 0.5 * (row % 2)) / n
            p = Vector((a * ca * math.cos(ph), cy + b * sa, c * ca * math.sin(ph)))
            nrm = Vector(((p.x) / a ** 2, (p.y - cy) / b ** 2, p.z / c ** 2)).normalized()
            tang = Vector((-a * math.sin(ph), 0, c * math.cos(ph))).normalized()
            up = nrm.cross(tang).normalized()
            if up.y < 0:
                up = -up
                tang = -tang
            M = frame_matrix(tang, up, nrm, p + nrm * 0.02) @ RX(-0.22) @ S(per / n / 0.2, 1, 1)
            add_bm(roof, tile, M, color=hexc(pick(REDS)), jitter=0.05, smooth_deg=55)
        ds = math.sqrt((a * sa) ** 2 + (b * ca) ** 2)
        th += 0.15 / max(ds, 0.3)
        row += 1
    add_bm(roof, bm_sphere(0.16, 14, 8), T(0, cy + b + 0.04, 0) @ S(1, 0.6, 1), color=hexc('#d63f33'), smooth_deg=180)
    add_bm(base, bm_cyl(0.05, 0.03, 0.22, 10), T(0, cy + b + 0.08, 0), color=hexc('#f6f2ea'))
    add_bm(base, bm_sphere(0.06, 12, 8), T(0, cy + b + 0.32, 0), color=hexc('#f6f2ea'), smooth_deg=180)
    # front hood (tiled half cylinder) carrying the emblem
    rH, z0, z1 = 1.05, D / 2 - 0.6, D / 2 + 0.5
    hood = bm_cyl(rH - 0.02, rH - 0.02, z1 - z0, 32, caps=False)
    bmesh.ops.delete(hood, geom=[v for v in hood.verts if v.co.x < -0.01], context='VERTS')
    add_bm(roof, hood, T(0, cy, z0) @ RX(math.pi / 2) @ RY(math.pi / 2), color=hexc('#8f2219'), smooth_deg=180)
    z = z0 + 0.12
    while z < z1:
        n = 15
        for i in range(n + 1):
            al = math.pi * (i + 0.5 * ((round(z * 10)) % 2)) / n
            if al > math.pi:
                continue
            nrm = Vector((math.cos(al), math.sin(al), 0))
            p = Vector((0, cy, z)) + nrm * rH
            up = Vector((0, 0, -1))
            tang = up.cross(nrm).normalized()
            M = frame_matrix(tang, up, nrm, p + nrm * 0.02) @ RX(-0.22)
            add_bm(roof, tile, M, color=hexc(pick(REDS)), jitter=0.05, smooth_deg=55)
        z += 0.16
    face = bm_cyl(rH + 0.02, rH + 0.02, 0.06, 32)
    bmesh.ops.delete(face, geom=[v for v in face.verts if v.co.x < -0.01], context='VERTS')
    add_bm(base, face, T(0, cy, z1 + 0.03) @ RX(math.pi / 2) @ RY(math.pi / 2), color=hexc('#e14836'), jitter=0.01)
    add_bm(base, bm_torus(rH + 0.02, 0.08, 32, 8, math.pi), T(0, cy, z1 + 0.07), color=hexc('#f6f2ea'), jitter=0.01, smooth_deg=180)
    ey, ez = cy + 0.5, z1 + 0.08
    add_bm(base, bm_cyl(0.52, 0.52, 0.05, 40), T(0, ey, ez) @ RX(math.pi / 2), color=hexc('#ffffff'), jitter=0.0)
    add_bm(base, bm_torus(0.37, 0.085, 40, 10), T(0, ey, ez + 0.05), color=hexc('#e2473b'), jitter=0.0, smooth_deg=180)
    add_bm(base, bm_cyl(0.16, 0.16, 0.06, 30), T(0, ey, ez + 0.03) @ RX(math.pi / 2), color=hexc('#ffffff'), jitter=0.0)
    add_bm(base, bm_torus(0.16, 0.035, 30, 8), T(0, ey, ez + 0.09), color=hexc('#6b6b6b'), jitter=0.0, smooth_deg=180)
    # glass door
    F = T(0, 0, D / 2 + 0.02)
    window_frame(base, F, -dw / 2, dw / 2, 0.14, 1.93, t=0.12, d=0.12, color='#f6f2ea', mull=(1, 0))
    glass(blue, F, -dw / 2, dw / 2, 0.14, 1.93, z=-0.04, color='#bff3ff')
    for sx in (-1, 1):
        add_bm(base, bm_box(0.03, 0.5, 0.03, bev=0.01), F @ T(sx * 0.12, 1.05, 0.03), color=hexc('#d9f6ff'))
    add_bm(base, bm_box(dw + 0.5, 0.05, 0.4, bev=0.01), T(0, 0.165, D / 2 + 0.22), color=hexc('#c9a774'))
    # front windows with warm light, sills and planter-ready ledges
    for sx in (-1, 1):
        x0, x1 = sx * win_x - W * 0.12, sx * win_x + W * 0.12
        window_frame(base, F, x0, x1, 0.62, 1.83, t=0.07, d=0.09, color='#6d4527', mull=(2, 1))
        glass(warm, F, x0, x1, 0.62, 1.83)
        add_bm(base, bm_box(x1 - x0 + 0.3, 0.07, 0.22, bev=0.02), F @ T((x0 + x1) / 2, 0.55, 0.06), color=hexc('#e9e2d2'))
        # wall lanterns
        lx = sx * (dw / 2 + 0.34)
        add_bm(base, bm_box(0.04, 0.04, 0.16), F @ T(lx, 1.62, 0.06), color=hexc('#2a2e33'))
        add_bm(base, bm_box(0.18, 0.04, 0.18, bev=0.01), F @ T(lx, 1.5, 0.16), color=hexc('#2a2e33'))
        add_bm(base, bm_cyl(0.13, 0.02, 0.1, 4), F @ T(lx, 1.76, 0.16) @ RY(math.pi / 4), color=hexc('#2a2e33'))
        add_bm(A.p('lamp_glow'), bm_box(0.14, 0.22, 0.14), F @ T(lx, 1.63, 0.16), color=hexc('#fff1c0'), jitter=0)
    # side windows
    for sx in (-1, 1):
        M = T(sx * (W / 2 + 0.02), 0, 0) @ RY(sx * math.pi / 2)
        u0, u1 = (-1.1, 0.3) if sx > 0 else (-0.3, 1.1)
        window_frame(base, M, u0 + 0.05, u1 - 0.05, 0.78, 1.72, color='#6d4527', mull=(2, 1))
        glass(warm, M, u0 + 0.05, u1 - 0.05, 0.78, 1.72)
    return A


# ---------------------------------------------------------------- cottage
CREAM = ['#efe6d2', '#e6dac2', '#f2ead9', '#ddd0b4', '#e9dfc9', '#d9cbb0', '#e3d5bb']
TERRA = ['#d8683c', '#cf5e34', '#e27a4a', '#c95631', '#da6f42', '#e08a55', '#d4643a']


def barrel_tile(r=0.075, L=0.27, segs=5, t=0.014):
    bm = bmesh.new()
    outer, inner = [], []
    for i in range(segs + 1):
        a = math.pi * i / segs
        y, z = math.sin(a), math.cos(a)
        outer.append([bm.verts.new((x, y * r, z * r)) for x in (-L / 2, L / 2)])
        inner.append([bm.verts.new((x, y * (r - t), z * (r - t))) for x in (-L / 2, L / 2)])
    for i in range(segs):
        bm.faces.new((outer[i][0], outer[i][1], outer[i + 1][1], outer[i + 1][0]))
        bm.faces.new((inner[i + 1][0], inner[i + 1][1], inner[i][1], inner[i][0]))
        for e in (0, 1):
            bm.faces.new((outer[i][e], outer[i + 1][e], inner[i + 1][e], inner[i][e]))
    for i in (0, segs):
        bm.faces.new((outer[i][0], inner[i][0], inner[i][1], outer[i][1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def cottage():
    A = Asset('cottage', ao_dist=0.55)
    W, D, H, RH = 2.9, 3.4, 1.95, 1.45
    base, roof, sh, warm = A.p('base'), A.p('roof'), A.p('shutter'), A.p('glow_warm')
    y0 = 0.16
    add_bm(base, bm_box(W + 0.24, y0, D + 0.24, bev=0.04), T(0, y0 / 2, 0), color=hexc('#9f9686'))
    add_bm(base, bm_box(W - 0.05, H, D - 0.05), T(0, y0 + H / 2, 0), color=hexc('#c9b89a'))
    gable = bm_prism([(-W / 2 + 0.03, 0), (W / 2 - 0.03, 0), (0, RH - 0.03)], D - 0.05)
    add_bm(base, gable, T(0, y0 + H, 0), color=hexc('#c9b89a'))
    win_x = W * 0.3
    front_open = [(-0.52, 0.52, 0.0, 1.72), (win_x - 0.33, win_x + 0.33, 0.8, 1.56)]
    gy = y0 + H + RH * 0.38
    clip = lambda u: y0 + H + RH * (1 - abs(u) / (W / 2)) - 0.04
    Ff = T(0, 0, D / 2 - 0.025)
    stone_face(base, Ff, -W / 2 + 0.03, W / 2 - 0.03, y0, y0 + H + RH, front_open + [(-0.32, 0.32, gy - 0.32, gy + 0.32)], CREAM, row=(0.17, 0.24), wid=(0.22, 0.42), depth=(0.05, 0.1), bev=0.3, clip=clip)
    side = [(zz - 0.34, zz + 0.34, 0.8, 1.56) for zz in (-D * 0.22, D * 0.22)]
    stone_face(base, T(-W / 2 + 0.025, 0, 0) @ RY(-math.pi / 2), -D / 2 + 0.03, D / 2 - 0.03, y0, y0 + H, side, CREAM, row=(0.17, 0.24), wid=(0.22, 0.42), depth=(0.05, 0.1), bev=0.3)
    stone_face(base, T(W / 2 - 0.025, 0, 0) @ RY(math.pi / 2), -D / 2 + 0.03, D / 2 - 0.03, y0, y0 + H, [(-0.34, 0.34, 0.8, 1.56)], CREAM, row=(0.17, 0.24), wid=(0.22, 0.42), depth=(0.05, 0.1), bev=0.3)
    stone_face(base, T(0, 0, -D / 2 + 0.025) @ RY(math.pi), -W / 2 + 0.03, W / 2 - 0.03, y0, y0 + H + RH, [], CREAM, row=(0.2, 0.28), wid=(0.3, 0.5), bev=0.25, clip=clip)
    # roof: deck, barrel tiles, ridge caps, bargeboards
    half = W / 2 + 0.28
    rise = RH + 0.2
    slant = math.hypot(half, rise)
    ang = math.atan2(rise, half)
    ridge = Vector((0, y0 + H + RH + 0.08, 0))
    tile = barrel_tile()
    for s in (-1, 1):
        dirv = Vector((s * math.cos(ang), -math.sin(ang), 0))
        nrm = Vector((s * math.sin(ang), math.cos(ang), 0))
        zdir = dirv.cross(nrm).normalized()
        add_bm(base, bm_box(slant, 0.08, D + 0.5), frame_matrix(dirv, nrm, zdir, ridge + dirv * slant / 2 - nrm * 0.02), color=hexc('#6e2c18'))
        t = 0.1
        while t < slant - 0.05:
            zz = -(D / 2 + 0.2)
            while zz <= D / 2 + 0.2:
                p = ridge + dirv * t + nrm * 0.03 + Vector((0, 0, zz))
                M = frame_matrix(dirv, nrm, zdir, p) @ RZ(0.12 * s if s > 0 else 0.12) @ RX(rr(-0.04, 0.04))
                col = hexc('#a08a52') if rng.random() < 0.05 else hexc(pick(TERRA))
                add_bm(roof, tile, M, color=col, jitter=0.05, smooth_deg=60)
                zz += 0.155
            t += 0.21
        for zs in (-1, 1):
            add_bm(base, bm_box(slant + 0.05, 0.13, 0.06, bev=0.015), frame_matrix(dirv, nrm, zdir, ridge + dirv * slant / 2 + nrm * 0.02 + Vector((0, 0, zs * (D / 2 + 0.27)))), color=hexc('#7a4a2a'))
    ridge_tile = barrel_tile(0.1, 0.3, 6, 0.016)
    zz = -(D / 2 + 0.22)
    while zz <= D / 2 + 0.25:
        add_bm(roof, ridge_tile, T(0, ridge.y + 0.06, zz) @ RY(math.pi / 2), color=hexc('#b04a28'), jitter=0.05, smooth_deg=60)
        zz += 0.27
    # chimney
    cx, cz = W / 4, -D / 5
    yb = y0 + H + RH * 0.35
    yy = yb
    k = 0
    while yy < y0 + H + RH + 0.55:
        for ox, oz, sx, sz in ([(-0.12, 0, 0.24, 0.46), (0.12, 0, 0.24, 0.46)] if k % 2 else [(0, -0.12, 0.46, 0.24), (0, 0.12, 0.46, 0.24)]):
            add_bm(base, jitter_verts(bm_box(sx - 0.02, 0.16, sz - 0.02, bev=0.03), 0.006), T(cx + ox, yy + 0.08, cz + oz), color=hexc(pick(['#a8a294', '#98928a', '#b4ad9e'])), smooth_deg=50)
        yy += 0.17
        k += 1
    add_bm(base, bm_box(0.56, 0.07, 0.56, bev=0.02), T(cx, yy + 0.035, cz), color=hexc('#8e897e'))
    add_bm(base, bm_cyl(0.09, 0.08, 0.18, 12), T(cx, yy + 0.07, cz), color=hexc('#b9673f'))
    # arched door with stone voussoirs
    Fd = T(0, 0, D / 2 + 0.03)
    for i in range(5):
        x = -0.34 + 0.068 + i * 0.136
        top = 1.31 + math.sqrt(max(0.0, 0.36 ** 2 - x ** 2)) * 0.96
        add_bm(base, bm_box(0.13, top - y0, 0.06, bev=0.01), Fd @ T(x, (top + y0) / 2, -0.06), color=hexc(pick(['#7e4e2b', '#8a5631', '#744726'])), jitter=0.04)
    for hy in (0.5, 1.15):
        add_bm(base, bm_box(0.5, 0.05, 0.02), Fd @ T(-0.07, hy, -0.02), color=hexc('#2f2a26'))
    add_bm(base, bm_sphere(0.035, 10, 6), Fd @ T(0.22, 0.85, -0.01), color=hexc('#e8c35a'), smooth_deg=180)
    for i in range(9):
        a = math.pi * i / 8
        add_bm(base, jitter_verts(bm_box(0.12, 0.17, 0.09, bev=0.025), 0.005), Fd @ T(math.cos(a) * 0.45, 1.31 + math.sin(a) * 0.45, -0.01) @ RZ(a - math.pi / 2), color=hexc(pick(['#d6cbb4', '#cfc2a6', '#e0d6c2'])), smooth_deg=50)
    add_bm(base, bm_box(1.0, 0.08, 0.36, bev=0.02), T(0, y0 + 0.04, D / 2 + 0.16), color=hexc('#a59b89'))
    # windows
    def cottage_window(M, cx_, cy_=1.18):
        x0, x1, ya, yb_ = cx_ - 0.26, cx_ + 0.26, cy_ - 0.33, cy_ + 0.33
        window_frame(base, M, x0, x1, ya, yb_, t=0.06, d=0.08, color='#f2efe6', mull=(1, 1))
        glass(warm, M, x0, x1, ya, yb_)
        for k in (-1, 1):
            shutter(sh, M, cx_ + k * 0.42, cy_, 0.24, 0.74)
        add_bm(base, bm_box(0.7, 0.14, 0.2, bev=0.015), M @ T(cx_, ya - 0.13, 0.1), color=hexc('#8a5a32'))
        flowers(base, M, cx_ - 0.3, cx_ + 0.3, ya - 0.08, 0.12)
    cottage_window(T(0, 0, D / 2 + 0.03), win_x)
    for zz in (-D * 0.22, D * 0.22):
        cottage_window(T(-W / 2 - 0.03, 0, 0) @ RY(-math.pi / 2), zz)
    cottage_window(T(W / 2 + 0.03, 0, 0) @ RY(math.pi / 2), 0)
    # round gable window
    Gm = T(0, gy, D / 2 + 0.03)
    add_bm(base, bm_torus(0.25, 0.05, 24, 8), Gm, color=hexc('#6d4527'), smooth_deg=180)
    glass(warm, Gm, -0.24, 0.24, -0.24, 0.24, z=-0.02)
    add_bm(base, bm_box(0.03, 0.5, 0.03), Gm, color=hexc('#6d4527'))
    add_bm(base, bm_box(0.5, 0.03, 0.03), Gm, color=hexc('#6d4527'))
    return A


# ---------------------------------------------------------------- props
def lamp():
    A = Asset('lamp', ao_dist=0.3)
    m, glow = A.p('base'), A.p('lamp_glow')
    k = hexc('#2a2e33')
    add_bm(m, bm_cyl(0.13, 0.11, 0.08, 16), T(0, 0, 0), color=k)
    add_bm(m, bm_cyl(0.1, 0.06, 0.22, 16), T(0, 0.08, 0), color=k, smooth_deg=60)
    add_bm(m, bm_cyl(0.045, 0.038, 1.95, 12), T(0, 0.28, 0), color=k, smooth_deg=60)
    for y in (0.32, 1.2, 2.18):
        add_bm(m, bm_torus(0.05, 0.018, 16, 6), T(0, y, 0) @ RX(math.pi / 2), color=k, smooth_deg=180)
    add_bm(m, bm_cyl(0.04, 0.09, 0.08, 4), T(0, 2.16, 0) @ RY(math.pi / 4), color=k)
    add_bm(m, bm_box(0.24, 0.03, 0.24, bev=0.008), T(0, 2.23, 0), color=k)
    for sx in (-1, 1):
        for sz in (-1, 1):
            add_bm(m, bm_box(0.022, 0.3, 0.022), T(sx * 0.1, 2.38, sz * 0.1), color=k)
    add_bm(glow, bm_box(0.18, 0.28, 0.18), T(0, 2.38, 0), color=hexc('#fff1c0'), jitter=0)
    add_bm(m, bm_cyl(0.19, 0.03, 0.16, 4), T(0, 2.53, 0) @ RY(math.pi / 4), color=k)
    add_bm(m, bm_sphere(0.035, 10, 6), T(0, 2.72, 0), color=k, smooth_deg=180)
    return A


WOOD = ['#a8774a', '#9a6a3f', '#b4835a', '#946238', '#a0703f', '#8c5c35']


def bridge():
    A = Asset('bridge', ao_dist=0.45, ground=None)
    w = A.p('base')
    L, Wd = 5.1, 1.5
    bh = lambda x: 0.08 + 0.32 * math.sin(math.pi * max(0.0, min(1.0, x / L)))
    x = 0.1
    while x < L - 0.05:
        dy = (bh(x + 0.05) - bh(x - 0.05)) / 0.1
        add_bm(w, jitter_verts(bm_box(0.22, 0.06, Wd + rr(-0.06, 0.06), bev=0.012), 0.004), T(x, bh(x), rr(-0.03, 0.03)) @ RZ(math.atan(dy)) @ RY(rr(-0.02, 0.02)), color=hexc(pick(WOOD)), jitter=0.04, smooth_deg=40)
        x += 0.245
    for z in (-Wd / 2 + 0.18, Wd / 2 - 0.18):
        x = 0.0
        while x < L:
            dy = (bh(x + 0.3) - bh(x + 0.2)) / 0.1
            add_bm(w, bm_box(0.52, 0.15, 0.13, bev=0.02), T(x + 0.25, bh(x + 0.25) - 0.13, z) @ RZ(math.atan(dy)), color=hexc('#6b4627'), jitter=0.04)
            x += 0.5
    posts = [0.12, L / 2, L - 0.12]
    for z in (-Wd / 2 + 0.05, Wd / 2 - 0.05):
        for px in posts:
            top = bh(px) + 0.78
            bot = bh(px) - 0.25 if px == posts[1] else -0.45
            add_bm(w, jitter_verts(bm_cyl(0.08, 0.075, top - bot, 12), 0.004), T(px, bot, z), color=hexc('#86592f'), jitter=0.03, smooth_deg=60)
            add_bm(w, bm_sphere(0.085, 12, 6), T(px, top, z) @ S(1, 0.55, 1), color=hexc('#7a4f29'), smooth_deg=180)
            for hgt in (0.72, 0.42):
                add_bm(w, bm_torus(0.085, 0.02, 14, 6), T(px, bh(px) + hgt, z) @ RX(math.pi / 2), color=hexc('#e6d7b2'), smooth_deg=180)
        for hgt in (0.72, 0.42):
            for i in range(2):
                a, b = posts[i], posts[i + 1]
                pts = [Vector((a + (b - a) * k / 14, bh(a + (b - a) * k / 14) + hgt - math.sin(math.pi * k / 14) * 0.1, z)) for k in range(15)]
                for strand in range(2):
                    off = [Vector((0, math.cos(k * 1.4 + strand * math.pi) * 0.009, math.sin(k * 1.4 + strand * math.pi) * 0.009)) for k in range(15)]
                    add_bm(w, bm_tube([p + o for p, o in zip(pts, off)], 0.014, 5), color=hexc('#efe2c2'), jitter=0.03, smooth_deg=180)
    return A


def fence():
    A = Asset('fence', ao_dist=0.35)
    w = A.p('base')
    add_bm(w, jitter_verts(bm_box(0.12, 0.86, 0.12, bev=0.025), 0.008), T(0, 0.38, 0), color=hexc('#86592f'), jitter=0.04, smooth_deg=50)
    add_bm(w, bm_cyl(0.085, 0.02, 0.07, 4), T(0, 0.81, 0) @ RY(math.pi / 4), color=hexc('#6b4624'))
    for hgt in (0.3, 0.62):
        add_bm(w, jitter_verts(bm_box(1.04, 0.085, 0.055, bev=0.015), 0.006), T(0.5, hgt, 0.05) @ RZ(rr(-0.02, 0.02)), color=hexc(pick(['#9a6a3c', '#8f6136', '#a3713f'])), jitter=0.04, smooth_deg=40)
    B = Asset('fence_post', ao_dist=0.35)
    add_bm(B.p('base'), jitter_verts(bm_box(0.12, 0.86, 0.12, bev=0.025), 0.008), T(0, 0.38, 0), color=hexc('#86592f'), jitter=0.04, smooth_deg=50)
    add_bm(B.p('base'), bm_cyl(0.085, 0.02, 0.07, 4), T(0, 0.81, 0) @ RY(math.pi / 4), color=hexc('#6b4624'))


GREYS = ['#a8a294', '#98928a', '#b4ad9e', '#8e897e', '#a29c8d', '#9b9789', '#b8b2a2']
MOSS = hexc('#6d8f3a')


def mossy(p, n, c):
    m = smooth(0.35, 0.85, n.y) * (0.55 + 0.45 * noise.noise(p * 3.1)) + max(0.0, noise.noise(p * 1.7 + Vector((5, 0, 0)))) * 0.35
    return c.lerp(MOSS, max(0.0, min(0.85, m)))


def wall_module():
    A = Asset('wall', ao_dist=0.35)
    w = A.p('base')
    L, ylo, yhi = 2.0, -0.45, 1.06
    add_bm(w, bm_box(L, yhi - ylo, 0.26), T(L / 2, (ylo + yhi) / 2, -0.03), color=hexc('#6f6a5c'))
    stone_face(w, T(0, 0, 0.1), 0.01, L - 0.01, ylo, yhi - 0.1, [], GREYS, row=(0.2, 0.3), wid=(0.3, 0.6), depth=(0.06, 0.12), bev=0.3, cfn=mossy)
    x = 0.0
    while x < L - 0.05:
        sw = min(rr(0.35, 0.55), L - x)
        col = hexc(pick(GREYS))
        add_bm(w, jitter_verts(bm_box(sw - 0.03, 0.12, 0.42, bev=0.04), 0.01), T(x + sw / 2, yhi - 0.04, -0.01), cfn=lambda p, n, c=col: mossy(p, n, c), smooth_deg=55)
        x += sw


def rocks():
    for v in range(4):
        A = Asset(f'rock_{v}', ao_dist=0.5, ao_strength=0.5)
        bm = bm_ico(1.0, 3)
        lump(bm, 0.32, 1.3, v * 3.7 + 1)
        for vert in bm.verts:
            vert.co.y *= 0.72
            if vert.co.y < -0.25:
                vert.co.y = -0.25 + (vert.co.y + 0.25) * 0.3
        def cfn(p, n, v=v):
            base = hexc('#86817a').lerp(hexc('#aaa596'), 0.5 + 0.5 * noise.noise(p * 2.2 + Vector((v, 0, 0))))
            base = base.lerp(hexc('#5f5b54'), smooth(0.0, -0.6, n.y) * 0.5)
            m = smooth(0.3, 0.8, n.y) * (0.65 + 0.35 * noise.noise(p * 4.0))
            return base.lerp(hexc('#6e9a38'), max(0.0, min(0.9, m)))
        add_bm(A.p('base'), bm, cfn=cfn, smooth_deg=180)


# ---------------------------------------------------------------- trees (clumps + alpha leaf cards)
def foliage_col(base, cy, r):
    dark, light = base * 0.55, base.lerp(hexc('#c9e07a'), 0.35)
    def f(p, n):
        t = max(0.0, min(1.0, (p.y - (cy - r)) / (2 * r)))
        c = dark.lerp(base, smooth(0.0, 0.6, t)).lerp(light, smooth(0.55, 1.0, t) * 0.8)
        return c * (0.93 + 0.14 * (noise.noise(p * 5.0) * 0.5 + 0.5))
    return f


def round_tree(v):
    A = Asset(f'tree_round_{v}', ao_dist=0.9, ao_strength=0.85)
    bark, clumps, cards = A.p('base'), A.p('leaf'), A.p('leafcard')
    bc = hexc(pick(['#6e4a2c', '#5f3f26', '#73502f']))
    trunk = bm_cyl(0.17, 0.1, 1.55, 10)
    for vert in trunk.verts:
        o = vert.co.y * 1.3 + v
        vert.co.x += noise.noise(Vector((o, 0, 0))) * 0.08 * vert.co.y
        vert.co.z += noise.noise(Vector((0, o, 3))) * 0.08 * vert.co.y
    add_bm(bark, trunk, cfn=lambda p, n: bc * (0.8 + 0.25 * (noise.noise(Vector((p.x * 20, p.y * 3, p.z * 20))) * 0.5 + 0.5)), smooth_deg=70)
    for k in range(4):
        a = k * math.pi / 2 + rr(-0.3, 0.3)
        add_bm(bark, bm_cyl(0.1, 0.01, 0.45, 6), T(math.cos(a) * 0.1, 0.0, math.sin(a) * 0.1) @ RY(-a) @ RZ(-1.9), color=bc, smooth_deg=60)
    cy = 2.05
    lc = hexc(pick(['#4f9233', '#5a9b3a', '#4a8c31']))
    fcol = foliage_col(lc, cy, 1.1)
    centres = []
    for k in range(5):
        a = k * 2 * math.pi / 5 + rr(-0.3, 0.3)
        tip = Vector((math.cos(a) * rr(0.45, 0.65), cy + rr(-0.25, 0.2), math.sin(a) * rr(0.45, 0.65)))
        add_bm(bark, bm_tube([Vector((0, 1.15 + k * 0.06, 0)), Vector((tip.x * 0.5, (1.3 + tip.y) / 2, tip.z * 0.5)), tip], 0.045, 6), color=bc, smooth_deg=180)
    centres.append((Vector((0, cy + 0.15, 0)), 0.66))
    for k in range(8):
        a = k * 2 * math.pi / 8 + rr(-0.25, 0.25)
        rad = rr(0.55, 0.72)
        centres.append((Vector((math.cos(a) * rad, cy + rr(-0.32, 0.3), math.sin(a) * rad)), rr(0.42, 0.56)))
    for k in range(4):
        a = k * math.pi / 2 + rr(0, 1)
        centres.append((Vector((math.cos(a) * 0.32, cy + 0.62 + rr(-0.05, 0.12), math.sin(a) * 0.32)), rr(0.38, 0.48)))
    canopy_c = Vector((0, cy, 0))
    sph_n = lambda p, n: (n * 0.35 + (p - canopy_c).normalized() * 0.65).normalized()
    for c, r in centres:
        bm = bm_ico(r, 2)
        lump(bm, r * 0.16, 3.0, rng.random() * 40)
        add_bm(clumps, bm, T(c.x, c.y, c.z), cfn=lambda p, n: fcol(p, n) * 0.92, smooth_deg=180, nfn=sph_n)
        bm.free()
    for c, r in centres:
        for i in range(int(14 * r / 0.5)):
            d = Vector((rr(-1, 1), rr(-0.4, 1), rr(-1, 1))).normalized()
            p = c + d * r * rr(0.82, 1.02)
            size = rr(0.36, 0.5)
            up = Vector((0, 1, 0))
            tx = d.cross(up)
            if tx.length < 0.1:
                tx = Vector((1, 0, 0))
            tx.normalize()
            ty = tx.cross(d).normalized()
            roll = rr(0, 2 * math.pi)
            ax = tx * math.cos(roll) + ty * math.sin(roll)
            ay = d.cross(ax).normalized()
            pts = [p + (-ax - ay) * size / 2, p + (ax - ay) * size / 2, p + (ax + ay) * size / 2, p + (-ax + ay) * size / 2]
            nrm = [(q - canopy_c).normalized() for q in pts]
            cols = [fcol(q, nn) for q, nn in zip(pts, nrm)]
            ou, ov = (0.5 if rng.random() < 0.5 else 0.0), (0.5 if rng.random() < 0.5 else 0.0)
            add_quad(cards, pts, nrm, cols, [(ou, ov), (ou + 0.5, ov), (ou + 0.5, ov + 0.5), (ou, ov + 0.5)])
    return A


def pine_tree(v):
    A = Asset(f'tree_pine_{v}', ao_dist=0.5, ao_strength=0.45)
    bark, core, cards = A.p('base'), A.p('leaf'), A.p('needle')
    add_bm(bark, bm_cyl(0.11, 0.04, 2.7, 8), color=hexc('#5e3f27'), smooth_deg=70)
    base = hexc(pick(['#3f8146', '#46894b', '#3a7a41']))
    tip = hexc('#9bc865')
    tiers = 6
    for k in range(tiers):
        by = 0.42 + k * 0.38
        r = (0.98 - k * 0.15)
        h = 0.72 - k * 0.06
        cone = bm_cyl(r * 0.78, 0.02, h, 12)
        for vert in cone.verts:
            if vert.co.y < 0.01 and math.hypot(vert.co.x, vert.co.z) > 0.1:
                a = math.atan2(vert.co.z, vert.co.x)
                f = 1.12 if (round(a / (2 * math.pi) * 12) % 2) else 0.9
                vert.co.x *= f
                vert.co.z *= f
                vert.co.y -= 0.08 if f > 1 else 0
        add_bm(core, cone, T(0, by, 0), cfn=lambda p, n, by=by, h=h: base * (0.8 + 0.35 * max(0.0, min(1.0, (p.y - by) / h))), smooth_deg=180)
        n = 12 - k
        for i in range(n):
            a = 2 * math.pi * (i + rng.random() * 0.5) / n + k * 0.4
            dirv = Vector((math.cos(a), 0, math.sin(a)))
            inner = Vector((0, by + h * 0.55, 0)) + dirv * r * 0.1
            outer = Vector((0, by - 0.05, 0)) + dirv * r * rr(1.0, 1.12)
            side = Vector((-dirv.z, 0, dirv.x)) * rr(0.17, 0.23)
            lift = Vector((0, 0.05, 0))
            pts = [inner - side * 0.4, outer - side + lift, outer + side + lift, inner + side * 0.4]
            nrm = [((q - Vector((0, q.y, 0))).normalized() * 0.6 + Vector((0, 0.8, 0))).normalized() for q in pts]
            cols = [base * 0.8, base.lerp(tip, 0.75), base.lerp(tip, 0.75), base * 0.8]
            add_quad(cards, pts, nrm, cols, [(0, 0), (0, 1), (1, 1), (1, 0)])
    return A


# ---------------------------------------------------------------- finishing: dedupe, AO bake, export
HEMI = []
for i in range(16):
    u, v = (i + 0.5) / 16, ((i * 7) % 16 + 0.5) / 16
    r, phi = math.sqrt(u), 2 * math.pi * v
    HEMI.append(Vector((r * math.cos(phi), r * math.sin(phi), math.sqrt(max(0.0, 1 - u)))))


def finalize(A):
    t0 = time.time()
    for part in A.parts.values():
        keymap, up, un, uc, uu, idx = {}, [], [], [], [], []
        for p, n, c, u in zip(part.pos, part.nrm, part.col, part.uv):
            key = (round(p[0], 4), round(p[1], 4), round(p[2], 4), round(n[0] * 127), round(n[1] * 127), round(n[2] * 127),
                   round(c[0] * 255), round(c[1] * 255), round(c[2] * 255), None if u is None else (round(u[0], 3), round(u[1], 3)))
            k = keymap.get(key)
            if k is None:
                k = len(up)
                keymap[key] = k
                up.append(Vector(p))
                un.append(Vector(n))
                uc.append(Vector(c))
                uu.append(u)
            idx.append(k)
        part.up, part.un, part.uc, part.uu, part.idx = up, un, uc, uu, idx
    verts, polys = [], []
    for part in A.parts.values():
        if part.mat in A.ao_skip:
            continue
        b = len(verts)
        verts += part.up
        polys += [tuple(b + i for i in part.idx[j:j + 3]) for j in range(0, len(part.idx), 3)]
    if A.ground is not None:
        b = len(verts)
        g = 30
        verts += [Vector((-g, A.ground, -g)), Vector((g, A.ground, -g)), Vector((g, A.ground, g)), Vector((-g, A.ground, g))]
        polys += [(b, b + 2, b + 1), (b, b + 3, b + 2)]
    bvh = BVHTree.FromPolygons(verts, polys, epsilon=0.0)
    for part in A.parts.values():
        if part.mat.startswith('glow') or part.mat == 'lamp_glow':
            continue
        for i, (p, n) in enumerate(zip(part.up, part.un)):
            t = n.orthogonal().normalized()
            bt = n.cross(t)
            occ = 0.0
            o = p + n * 0.006
            for h in HEMI:
                d = (t * h.x + bt * h.y + n * h.z).normalized()
                hit = bvh.ray_cast(o + d * 0.004, d, A.ao_dist)
                if hit[0] is not None:
                    occ += 1.0 - hit[3] / A.ao_dist
            ao = 1.0 - A.ao_strength * occ / len(HEMI)
            part.uc[i] = part.uc[i] * ao
    print(f'  {A.name}: ' + ', '.join(f'{p.mat}={len(p.idx) // 3} tris' for p in A.parts.values()) + f'  ({time.time() - t0:.1f}s)')


def b64(arr):
    return base64.b64encode(arr.tobytes()).decode('ascii')


def export():
    data = {'version': 1, 'assets': {}}
    for A in ASSETS:
        parts = []
        for part in A.parts.values():
            if not part.idx:
                continue
            big = len(part.up) >= 65536
            entry = {
                'mat': part.mat,
                'pos': b64(array('f', [c for p in part.up for c in p])),
                'nrm': b64(array('b', [max(-127, min(127, round(c * 127))) for n in part.un for c in n])),
                'col': b64(array('B', [max(0, min(255, round(c * 255))) for col in part.uc for c in col])),
                'idx': b64(array('I' if big else 'H', part.idx)),
                'i32': big,
            }
            if any(u is not None for u in part.uu):
                entry['uv'] = b64(array('f', [c for u in part.uu for c in (u or (0, 0))]))
            parts.append(entry)
        data['assets'][A.name] = parts
    with open(OUT, 'w', encoding='ascii') as fh:
        fh.write('// Generated by prototypes/blender/build_assets.py - do not edit by hand.\n')
        fh.write('window.VERDANT_ASSETS = ' + json.dumps(data, separators=(',', ':')) + ';\n')
    print(f'wrote {OUT} ({os.path.getsize(OUT) / 1e6:.2f} MB)')


def main():
    t0 = time.time()
    pokecenter()
    cottage()
    lamp()
    bridge()
    fence()
    wall_module()
    rocks()
    for v in range(3):
        round_tree(v)
    for v in range(2):
        pine_tree(v)
    print(f'built geometry in {time.time() - t0:.1f}s')
    for A in ASSETS:
        finalize(A)
    export()
    print(f'total {time.time() - t0:.1f}s')


main()
