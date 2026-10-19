"""Verdant Town characters, Pokémon and town props (trees, bushes, rocks, bench, signs), sculpted as signed distance fields.

Run from prototypes/:
    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P blender/build_characters.py [-- name ...]

Every model part is a list of SDF operations (smooth unions, carves, colour paints) evaluated with numpy.
The field is meshed with surface nets, decimated by Blender, snapped back onto the field and shaded from it:
normals are the field gradient, vertex colours come from the paint layers, ambient occlusion is sampled from
the whole model's field. Face details (eyes, highlights, cheeks, mouths) are separate meshes laid on the surface.
Writes prototypes/verdant-chars.js (window.VERDANT_CHARS): characters as rigged parts (assets + rigs), props
as town assets (props, mostly instanced). Packed like verdant-assets.js, except positions are int16 scaled by q.
"""
import base64
import json
import math
import os
import sys
import time
from array import array

import bmesh
import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'verdant-chars.js'))


# ---------------------------------------------------------------- small math
def hexc(h):
    return np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)])


def V(*a):
    return np.array(a, dtype=float)


def unit(v):
    v = np.asarray(v, dtype=float)
    return v / max(float(np.linalg.norm(v)), 1e-12)


def rows_unit(a):
    return a / np.maximum(np.linalg.norm(a, axis=1, keepdims=True), 1e-12)


def frame(y, z=(0, 0, 1)):
    """Columns are local x, y, z: local y along `y`, local z as close to `z` as possible."""
    y = unit(y)
    z = np.asarray(z, dtype=float) - y * np.dot(z, y)
    if np.linalg.norm(z) < 1e-6:
        z = np.array([1.0, 0, 0]) - y * y[0]
    z = unit(z)
    return np.stack([np.cross(y, z), y, z], 1)


def euler(x=0.0, y=0.0, z=0.0):
    """three.js 'XYZ' Euler as a 3x3 matrix."""
    cx, sx, cy, sy, cz, sz = math.cos(x), math.sin(x), math.cos(y), math.sin(y), math.cos(z), math.sin(z)
    return (np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]]) @ np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
            @ np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]]))


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def smin(a, b, k):
    if k <= 0:
        return np.minimum(a, b)
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b + (a - b) * h - k * h * (1 - h)


def smax(a, b, k):
    return -smin(-a, -b, k)


def chaikin(pts, it=2):
    pts = np.asarray(pts, dtype=float)
    for _ in range(it):
        q = [pts[0]]
        for a, b in zip(pts[:-1], pts[1:]):
            q += [0.75 * a + 0.25 * b, 0.25 * a + 0.75 * b]
        q.append(pts[-1])
        pts = np.array(q)
    return pts


# ---------------------------------------------------------------- SDF primitives (each maps an (N,3) array to N distances)
class Prim:
    def __init__(self, f, lo, hi):
        self.f, self.lo, self.hi = f, np.asarray(lo, float), np.asarray(hi, float)


def _bounds(c, e):
    c = np.asarray(c, float)
    return c - e, c + e


def ellipsoid(c, r, R=None):
    c, r = V(*c), V(*r)
    R = np.eye(3) if R is None else R

    def f(P):
        q = (P - c) @ R
        k0 = np.linalg.norm(q / r, axis=1)
        k1 = np.linalg.norm(q / (r * r), axis=1)
        return k0 * (k0 - 1) / np.maximum(k1, 1e-12)
    return Prim(f, *_bounds(c, r.max()))


def sphere(c, r):
    return ellipsoid(c, (r, r, r))


def squash(p, c, R, s):
    """Scale primitive p by s (<= 1 per axis) in frame R around c."""
    c, s = np.asarray(c, float), V(*s)
    return Prim(lambda P: p.f(c + (((P - c) @ R) / s) @ R.T) * s.min(), p.lo, p.hi)


def cone(a, b, r1, r2, flat=None, zdir=(0, 0, 1)):
    """Round cone from a (radius r1) to b (radius r2); `flat` squashes it across zdir."""
    a, b = V(*a), V(*b)
    ba = b - a
    l2 = float(ba @ ba)
    rr = r1 - r2
    a2 = l2 - rr * rr
    il2 = 1.0 / l2

    def f(P):
        pa = P - a
        y = pa @ ba
        z = y - l2
        x2 = np.sum((pa * l2 - np.outer(y, ba)) ** 2, axis=1)
        y2, z2 = y * y * l2, z * z * l2
        k = np.sign(rr) * rr * rr * x2
        d_tip = np.sqrt(x2 + z2) * il2 - r2
        d_base = np.sqrt(x2 + y2) * il2 - r1
        d_side = (np.sqrt(np.maximum(x2 * a2 * il2, 0)) + y * rr) * il2 - r1
        return np.where(np.sign(z) * a2 * z2 > k, d_tip, np.where(np.sign(y) * a2 * y2 < k, d_base, d_side))
    m = max(r1, r2)
    p = Prim(f, np.minimum(a, b) - m, np.maximum(a, b) + m)
    return squash(p, (a + b) / 2, frame(ba, zdir), (1, 1, flat)) if flat else p


def chain(pts, radii, k=0.0, flat=None, zdir=(0, 0, 1)):
    return union([cone(pts[i], pts[i + 1], radii[i], radii[i + 1], flat, zdir) for i in range(len(pts) - 1)], k)


def rbox(c, b, r=0.0, R=None):
    c, b = V(*c), V(*b)
    R = np.eye(3) if R is None else R

    def f(P):
        q = np.abs((P - c) @ R) - (b - r)
        return np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(axis=1), 0) - r
    return Prim(f, *_bounds(c, float(np.linalg.norm(b))))


def rcyl(c, ra, h, rb=0.0, R=None):
    """Rounded cylinder along local y: radius ra, half height h, edge rounding rb."""
    c = V(*c)
    R = np.eye(3) if R is None else R

    def f(P):
        q = (P - c) @ R
        dx = np.hypot(q[:, 0], q[:, 2]) - ra + rb
        dy = np.abs(q[:, 1]) - h + rb
        return np.minimum(np.maximum(dx, dy), 0) + np.hypot(np.maximum(dx, 0), np.maximum(dy, 0)) - rb
    return Prim(f, *_bounds(c, math.hypot(ra, h)))


def torus(c, R0, r, R=None):
    c = V(*c)
    R = np.eye(3) if R is None else R

    def f(P):
        q = (P - c) @ R
        return np.hypot(np.hypot(q[:, 0], q[:, 2]) - R0, q[:, 1]) - r
    return Prim(f, *_bounds(c, R0 + r))


def _poly2(px, py, pts):
    d = (px - pts[0, 0]) ** 2 + (py - pts[0, 1]) ** 2
    s = np.ones_like(px)
    for i in range(len(pts)):
        j = i - 1
        ex, ey = pts[j, 0] - pts[i, 0], pts[j, 1] - pts[i, 1]
        wx, wy = px - pts[i, 0], py - pts[i, 1]
        t = np.clip((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1)
        d = np.minimum(d, (wx - ex * t) ** 2 + (wy - ey * t) ** 2)
        c1, c2, c3 = py >= pts[i, 1], py < pts[j, 1], ex * wy > ey * wx
        s = np.where((c1 & c2 & c3) | (~c1 & ~c2 & ~c3), -s, s)
    return s * np.sqrt(d)


def slab(c, R, pts, t, r=0.0):
    """2D polygon in local xy, extruded to half-thickness t along local z, edges rounded by r."""
    c, pts = V(*c), np.asarray(pts, float)

    def f(P):
        q = (P - c) @ R
        d2 = _poly2(q[:, 0], q[:, 1], pts) + r
        dz = np.abs(q[:, 2]) - t + r
        return np.minimum(np.maximum(d2, dz), 0) + np.hypot(np.maximum(d2, 0), np.maximum(dz, 0)) - r
    corners = np.array([(x, y, z) for x, y in pts for z in (-t, t)]) @ R.T + c
    return Prim(f, corners.min(0), corners.max(0))


def scatter(items, k):
    """Smooth union of many small ellipsoids (centre, frame, radii); each only touches points inside its own box."""
    def f(P):
        d = np.full(len(P), 1e9)
        for c, R, r in items:
            e = r.max() + k
            i = np.nonzero(np.abs(P[:, 0] - c[0]) < e)[0]
            i = i[np.all(np.abs(P[i, 1:] - c[1:]) < e, axis=1)]
            if len(i):
                q = (P[i] - c) @ R
                k0 = np.linalg.norm(q / r, axis=1)
                k1 = np.linalg.norm(q / (r * r), axis=1)
                d[i] = smin(d[i], k0 * (k0 - 1) / np.maximum(k1, 1e-12), k)
        return d
    cs = np.array([c for c, _, _ in items])
    e = max(r.max() for _, _, r in items) + k
    return Prim(f, cs.min(0) - e, cs.max(0) + e)


def half(c, n):
    """Half-space on the side of the plane through c facing away from n."""
    c, n = V(*c), unit(n)
    return Prim(lambda P: (P - c) @ n, c - 9, c + 9)


def union(ps, k=0.0):
    def f(P):
        d = ps[0].f(P)
        for p in ps[1:]:
            d = smin(d, p.f(P), k)
        return d
    return Prim(f, np.min([p.lo for p in ps], 0), np.max([p.hi for p in ps], 0))


def diff(a, b, k=0.0):
    return Prim(lambda P: smax(a.f(P), -b.f(P), k), a.lo, a.hi)


def inter(a, b, k=0.0):
    return Prim(lambda P: smax(a.f(P), b.f(P), k), a.lo, a.hi)


# ---------------------------------------------------------------- field utilities
def grad(fn, P, e):
    g = np.empty_like(P)
    for i in range(3):
        o = np.zeros(3)
        o[i] = e
        g[:, i] = fn(P + o) - fn(P - o)
    return g / (2 * e)


def project(fn, P, e, iters=3):
    for _ in range(iters):
        d = fn(P)
        g = grad(fn, P, e)
        P = P - (d / np.maximum(np.sum(g * g, 1), 0.25))[:, None] * g  # floored: near a thin part's axis the gradient vanishes
    return P


def colour(col, P):
    return col(P) if callable(col) else np.broadcast_to(hexc(col), (len(P), 3))


CORNERS = np.array([(i, j, k) for i in (0, 1) for j in (0, 1) for k in (0, 1)])
EDGES = [(a, b) for a in range(8) for b in range(a + 1, 8) if np.abs(CORNERS[a] - CORNERS[b]).sum() == 1]


def surface_nets(F, lo, h):
    inside = F < 0
    nx, ny, nz = F.shape
    n_in = sum(inside[i:nx - 1 + i, j:ny - 1 + j, k:nz - 1 + k].astype(np.int8) for i, j, k in CORNERS)
    active = (n_in > 0) & (n_in < 8)
    cells = np.argwhere(active)
    vid = np.full(active.shape, -1, np.int64)
    vid[active] = np.arange(len(cells))
    acc, num = np.zeros((len(cells), 3)), np.zeros(len(cells))
    for a, b in EDGES:
        ca, cb = cells + CORNERS[a], cells + CORNERS[b]
        fa, fb = F[ca[:, 0], ca[:, 1], ca[:, 2]], F[cb[:, 0], cb[:, 1], cb[:, 2]]
        m = (fa < 0) != (fb < 0)
        t = fa[m] / (fa[m] - fb[m])
        acc[m] += ca[m] + t[:, None] * (CORNERS[b] - CORNERS[a])
        num[m] += 1
    verts = lo + acc / num[:, None] * h
    quads = []
    e = inside[:-1, 1:-1, 1:-1] != inside[1:, 1:-1, 1:-1]
    i, j, k = np.nonzero(e)
    j, k = j + 1, k + 1
    quads.append(np.stack([vid[i, j - 1, k - 1], vid[i, j, k - 1], vid[i, j, k], vid[i, j - 1, k]], 1))
    e = inside[1:-1, :-1, 1:-1] != inside[1:-1, 1:, 1:-1]
    i, j, k = np.nonzero(e)
    i, k = i + 1, k + 1
    quads.append(np.stack([vid[i - 1, j, k - 1], vid[i - 1, j, k], vid[i, j, k], vid[i, j, k - 1]], 1))
    e = inside[1:-1, 1:-1, :-1] != inside[1:-1, 1:-1, 1:]
    i, j, k = np.nonzero(e)
    i, j = i + 1, j + 1
    quads.append(np.stack([vid[i - 1, j - 1, k], vid[i, j - 1, k], vid[i, j, k], vid[i - 1, j, k]], 1))
    q = np.concatenate(quads)
    return verts, np.concatenate([q[:, [0, 1, 2]], q[:, [0, 2, 3]]])


def fix_winding(P, T, N):
    a, b, c = P[T[:, 0]], P[T[:, 1]], P[T[:, 2]]
    bad = np.sum(np.cross(b - a, c - a) * (N[T[:, 0]] + N[T[:, 1]] + N[T[:, 2]]), 1) < 0
    T = T.copy()
    T[bad] = T[bad][:, ::-1]
    return T


def decimate(P, T, target, sym, keep=None):
    """Blender collapse decimation; vertices listed in `keep` (colour borders) are protected."""
    if len(T) <= target:
        return P, T
    me = bpy.data.meshes.new('tmp')
    me.from_pydata(P.tolist(), [], T.tolist())
    ob = bpy.data.objects.new('tmp', me)
    bpy.context.scene.collection.objects.link(ob)
    mod = ob.modifiers.new('dec', 'DECIMATE')
    mod.ratio = target / len(T)
    mod.use_collapse_triangulate = True
    if keep is not None and len(keep):
        ob.vertex_groups.new(name='keep').add(keep.tolist(), 1.0, 'REPLACE')
        mod.vertex_group, mod.invert_vertex_group, mod.vertex_group_factor = 'keep', True, 0.25
    if sym:
        mod.use_symmetry, mod.symmetry_axis = True, 'X'
    ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
    m2 = ev.to_mesh()
    m2.calc_loop_triangles()
    co = np.empty(len(m2.vertices) * 3, np.float32)
    m2.vertices.foreach_get('co', co)
    tri = np.empty(len(m2.loop_triangles) * 3, np.int32)
    m2.loop_triangles.foreach_get('vertices', tri)
    ev.to_mesh_clear()
    bpy.data.objects.remove(ob)
    bpy.data.meshes.remove(me)
    return co.reshape(-1, 3).astype(float), tri.reshape(-1, 3).astype(np.int64)


def refine(P, T, lmax):
    """Split edges longer than lmax, so smooth areas the decimator emptied get even triangles again (new points need projecting)."""
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in P.tolist()]
    for t in T.tolist():
        try:
            bm.faces.new([vs[i] for i in t])
        except ValueError:  # duplicate face
            pass
    for _ in range(3):
        # flip slivers first so splits don't cascade; only across near-flat edges, or thin parts get bridged through
        bmesh.ops.beautify_fill(bm, faces=bm.faces, edges=[e for e in bm.edges if e.calc_face_angle(math.pi) < 0.35])
        long_ = [e for e in bm.edges if e.calc_length() > lmax]
        if not long_:
            break
        bmesh.ops.subdivide_edges(bm, edges=long_, cuts=1, use_grid_fill=False)
        bmesh.ops.triangulate(bm, faces=bm.faces, quad_method='BEAUTY', ngon_method='BEAUTY')
    bm.verts.index_update()
    P = np.array([v.co[:] for v in bm.verts])
    T = np.array([[v.index for v in f.verts] for f in bm.faces], dtype=np.int64)
    bm.free()
    return P, T


def uv_sphere(nu=28, nv=16):
    th = np.linspace(0, np.pi, nv + 1)[:, None]
    ph = np.linspace(0, 2 * np.pi, nu, endpoint=False)[None, :]
    U = np.stack([np.sin(th) * np.cos(ph), np.cos(th) * np.ones_like(ph), np.sin(th) * np.sin(ph)], -1).reshape(-1, 3)
    T = []
    for i in range(nv):
        for j in range(nu):
            a, b = i * nu + j, i * nu + (j + 1) % nu
            T += [(a, a + nu, b + nu), (a, b + nu, b)]
    return U, np.array(T)


# ---------------------------------------------------------------- models and parts
MODELS = []


class Model:
    def __init__(self, name, ao=1.0, prop=False):
        """prop=True: a static, instanced town asset (one entry, no rig)."""
        self.name, self.parts, self.ao, self.prop = name, [], ao, prop
        MODELS.append(self)

    def part(self, name, pivot=(0, 0, 0), parent=None, h=0.008, tris=8000, sym=True, mat='body', borders=True):
        return Part(self, name, pivot, parent, h, tris, sym, mat, borders)

    def dist(self, P):
        d = P[:, 1] + 0.03  # the ground the model stands on, pushed down so soles don't go black
        for p in self.parts:
            d = np.minimum(d, p.dist(P))
        return d


class Part:
    def __init__(self, model, name, pivot, parent, h, tris, sym, mat, borders):
        self.model, self.name, self.pivot, self.parent = model, name, V(*pivot), parent
        self.h, self.tris, self.sym, self.mat, self.borders = h, tris, sym, mat, borders
        self.ops, self.extras = [], []
        model.parts.append(self)

    # --- authoring
    def add(self, p, col, k=0.0, kc=0.004):
        self.ops.append(('add', p, col, k, kc))

    def sub(self, p, k=0.0, col=None, kc=0.004):
        self.ops.append(('sub', p, col, k, kc))

    def paint(self, p, col, soft=0.004):
        self.ops.append(('paint', p, col, soft, 0))

    def eval(self, P, colours=False):
        d = np.full(len(P), 1e9)
        c = np.zeros((len(P), 3)) if colours else None
        for kind, p, col, k, kc in self.ops:
            if kind == 'paint' and not colours:
                continue
            di = p.f(P)
            if kind == 'add':
                if colours:
                    c += (colour(col, P) - c) * np.clip(0.5 + 0.5 * (d - di) / kc, 0, 1)[:, None]
                d = smin(d, di, k)
            elif kind == 'sub':
                if colours and col is not None:
                    c += (colour(col, P) - c) * np.clip(1 - 0.5 * di / kc, 0, 1)[:, None]
                d = smax(d, -di, k)
            else:
                c += (colour(col, P) - c) * smoothstep(k, -k, di)[:, None]
        return d, c

    def dist(self, P):
        return self.eval(P)[0]

    # --- surface details
    def frame_at(self, p0, up=(0, 1, 0)):
        e = self.h * 0.5
        p = project(self.dist, V(*p0)[None], e, 8)[0]
        n = unit(grad(self.dist, p[None], e)[0])
        y = unit(np.asarray(up, float) - n * np.dot(up, n))
        return p, np.stack([np.cross(y, n), y, n], 1)

    def blob(self, c, R, r, col, mat='body', res=(28, 16)):
        U, T = uv_sphere(*res)
        r = V(*r)
        P = c + (U * r) @ R.T
        N = rows_unit((U / r) @ R.T)
        C = col(U) if callable(col) else colour(col, P)
        self.extras.append((mat, P, fix_winding(P, T, N), N, np.array(C)))

    def eye(self, p0, rx, ry, depth, top, bottom, sclera=None, embed=0.5, up=(0, 1, 0), tilt=0.0):
        p, R = self.frame_at(p0, up)
        if tilt:
            R = R @ euler(0, 0, tilt)
        n = R[:, 2]
        if sclera:
            self.blob(p - n * depth * embed, R, (rx * 1.3, ry * 1.12, depth), sclera, 'eye')
            p = p + n * depth * 0.2
        c = p - n * depth * embed
        top, bottom = hexc(top), hexc(bottom)
        self.blob(c, R, (rx, ry, depth), lambda U: top + (bottom - top) * smoothstep(0.2, -0.9, U[:, 1])[:, None], 'eye')
        for hx, hy, s in ((-0.3, 0.4, 0.36), (0.32, -0.42, 0.15)):
            lz = math.sqrt(max(0.0, 1 - hx * hx - hy * hy))
            q = c + R @ V(hx * rx, hy * ry, lz * depth)
            nn = unit(R @ V(hx / rx, hy / ry, lz / depth))
            Rh = np.stack([np.cross(unit(R[:, 1] - nn * np.dot(R[:, 1], nn)), nn), unit(R[:, 1] - nn * np.dot(R[:, 1], nn)), nn], 1)
            self.blob(q - nn * 0.002, Rh, (s * rx, s * rx * 1.15, 0.006), '#ffffff', 'hi', (16, 10))

    def _lay(self, p, R, uv, T, col, lift, mat='body'):
        e = self.h * 0.5
        P = p + uv[:, :1] * R[:, 0] + uv[:, 1:2] * R[:, 1]
        P = project(self.dist, P, e, 5)
        N = rows_unit(grad(self.dist, P, e))
        P = P + N * lift
        self.extras.append((mat, P, fix_winding(P, T, N), N, np.array(colour(col, P))))

    def decal(self, p0, rx, ry, col, up=(0, 1, 0), lift=0.0012, flat_top=None, rings=5, segs=32, mat='body'):
        p, R = self.frame_at(p0, up)
        uv, T = [(0.0, 0.0)], []
        for i in range(1, rings + 1):
            for j in range(segs):
                a = 2 * math.pi * j / segs
                u, v = rx * i / rings * math.cos(a), ry * i / rings * math.sin(a)
                uv.append((u, v * flat_top if flat_top is not None and v > 0 else v))
        T += [(0, 1 + j, 1 + (j + 1) % segs) for j in range(segs)]
        for i in range(1, rings):
            b0, b1 = 1 + (i - 1) * segs, 1 + i * segs
            for j in range(segs):
                j1 = (j + 1) % segs
                T += [(b0 + j, b1 + j, b1 + j1), (b0 + j, b1 + j1, b0 + j1)]
        self._lay(p, R, np.array(uv), np.array(T), col, lift, mat)

    def stroke(self, p0, pts, width, col, taper=0.5, up=(0, 1, 0), n=28, lift=0.0016, mat='body'):
        p, R = self.frame_at(p0, up)
        pts = chaikin(pts)
        seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
        s = np.concatenate([[0], np.cumsum(seg)]) / seg.sum()
        t = np.linspace(0, 1, n)
        q = np.stack([np.interp(t, s, pts[:, 0]), np.interp(t, s, pts[:, 1])], 1)
        tg = rows_unit(np.gradient(q, axis=0))
        o = np.stack([-tg[:, 1], tg[:, 0]], 1)
        w = width * 0.5 * (1 - taper + taper * np.sin(np.pi * t))
        uv = np.concatenate([q + o * w[:, None], q - o * w[:, None]])
        T = []
        for i in range(n - 1):
            T += [(i, i + n, i + 1), (i + 1, i + n, i + n + 1)]
        self._lay(p, R, uv, np.array(T), col, lift, mat)

    def tube(self, pts, r, col, segs=8, mat='body'):
        pts = chaikin(pts)
        rings, nrm = [], []
        for i, p in enumerate(pts):
            t = unit(pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)])
            u = unit(np.cross(t, (0, 1, 0) if abs(t[1]) < 0.9 else (1, 0, 0)))
            v = np.cross(t, u)
            ri = r * (1 - 0.6 * i / (len(pts) - 1))
            for j in range(segs):
                a = 2 * math.pi * j / segs
                d = u * math.cos(a) + v * math.sin(a)
                rings.append(p + d * ri)
                nrm.append(d)
        T = []
        for i in range(len(pts) - 1):
            for j in range(segs):
                a, b = i * segs + j, i * segs + (j + 1) % segs
                T += [(a, b, b + segs), (a, b + segs, a + segs)]
        P, N = np.array(rings), np.array(nrm)
        self.extras.append((mat, P, fix_winding(P, np.array(T), N), N, np.array(colour(col, P))))

    # --- meshing
    def mesh(self):
        h = self.h
        adds = [p for kind, p, *_ in self.ops if kind == 'add']
        lo = np.min([p.lo for p in adds], 0) - 3 * h
        hi = np.max([p.hi for p in adds], 0) + 3 * h
        n = np.ceil((hi - lo) / h).astype(int) + 1
        xs, ys, zs = (lo[i] + np.arange(n[i]) * h for i in range(3))
        Y, Z = np.meshgrid(ys, zs, indexing='ij')
        yz = np.stack([Y.ravel(), Z.ravel()], 1)
        F = np.empty(tuple(n))
        step = max(1, 1_200_000 // len(yz))
        for i0 in range(0, n[0], step):
            xsl = xs[i0:i0 + step]
            P = np.empty((len(xsl) * len(yz), 3))
            P[:, 0] = np.repeat(xsl, len(yz))
            P[:, 1:] = np.tile(yz, (len(xsl), 1))
            F[i0:i0 + len(xsl)] = self.dist(P).reshape(len(xsl), n[1], n[2])
        P, T = surface_nets(F, lo, h)
        e = h * 0.5
        P = project(self.dist, P, e, 2)
        T = fix_winding(P, T, grad(self.dist, P, e))
        C = self.eval(P, colours=True)[1]
        E = np.concatenate([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]]])
        border = E[np.abs(C[E[:, 0]] - C[E[:, 1]]).max(1) > 0.05]
        keep = np.unique(border)
        keep = np.unique(E[np.isin(E[:, 0], keep)])  # plus one ring around the border
        P, T = decimate(P, T, self.tris, self.sym, keep if self.borders else None)
        P, T = refine(P, T, 5.5 * h)
        P = project(self.dist, P, e, 3)
        N = rows_unit(grad(self.dist, P, e))
        return P, fix_winding(P, T, N), N, self.eval(P, colours=True)[1]  # refine's edge flips can turn faces


def sdf_ao(M, P, N):
    occ, w = np.zeros(len(P)), 1.0
    for i in range(1, 6):
        d = 0.022 * i * M.ao
        occ += w * np.maximum(d - M.dist(P + N * d), 0) / d
        w *= 0.6
    return np.clip(1 - 0.3 * occ, 0.5, 1)


# ---------------------------------------------------------------- palette
SKIN = '#f8d6bd'
INK = '#3a221a'
BLUSH = '#fbb0a0'


def shade(base, y0, y1, lo=0.82, hi=1.08):
    """Vertex colour that brightens with height, like soft top light on hair and fur."""
    b = hexc(base)
    return lambda P: np.clip(b[None] * (lo + (hi - lo) * smoothstep(y0, y1, P[:, 1]))[:, None], 0, 1)


# ---------------------------------------------------------------- Pokémon
YEL = '#fbd13f'
BROWN = '#8a5426'


def pikachu():
    M = Model('pikachu')
    b = M.part('body', h=0.007, tris=12000)
    fur = shade(YEL, 0.0, 1.0, 0.9, 1.04)
    b.add(ellipsoid((0, 0.3, -0.01), (0.25, 0.26, 0.22)), fur)
    b.add(ellipsoid((0, 0.2, 0.01), (0.27, 0.19, 0.23)), fur, k=0.08)
    b.add(ellipsoid((0, 0.72, 0.03), (0.35, 0.3, 0.3)), fur, k=0.1)
    for s in (-1, 1):
        b.add(ellipsoid((s * 0.16, 0.63, 0.1), (0.18, 0.15, 0.16)), fur, k=0.06)
        ea, eb = V(s * 0.18, 0.94, -0.01), V(s * 0.4, 1.37, -0.08)
        b.add(cone(ea, eb, 0.095, 0.014, flat=0.45), fur, k=0.05)
        b.paint(inter(cone(ea, eb, 0.14, 0.05), half(ea + (eb - ea) * 0.62, ea - eb)), '#2b2220', soft=0.006)
        b.add(cone((s * 0.2, 0.44, 0.08), (s * 0.15, 0.35, 0.2), 0.062, 0.052), fur, k=0.035)
        b.add(ellipsoid((s * 0.12, 0.06, 0.07), (0.085, 0.06, 0.12)), fur, k=0.05)
    for y0 in (0.44, 0.31):
        b.stroke((0, y0, -0.5), [(-0.15, -0.02), (0, 0.012), (0.15, -0.02)], 0.05, BROWN, taper=0.85, up=(0, 1, 0))
    for s in (-1, 1):
        b.eye((s * 0.14, 0.77, 0.5), 0.058, 0.072, 0.04, '#1b1512', '#5a3a26')
        b.decal((s * 0.23, 0.635, 0.5), 0.072, 0.066, '#ef4b3c')
    b.decal((0, 0.705, 0.5), 0.018, 0.011, '#2b1d17')
    b.stroke((0, 0.67, 0.5), [(-0.055, 0.012), (-0.028, -0.014), (0, 0.004), (0.028, -0.014), (0.055, 0.012)], 0.011, '#5b2c22', taper=0.4)
    t = M.part('tail', pivot=(0, 0.2, -0.2), h=0.006, tris=1800, sym=False)
    bolt = [(0, 0), (0.07, 0), (0.12, 0.16), (0.26, 0.13), (0.33, 0.36), (0.5, 0.32), (0.62, 0.7), (0.3, 0.74), (0.26, 0.5), (0.12, 0.53), (0.07, 0.32), (-0.04, 0.34)]
    R = np.stack([V(0, 0, -1), V(0, 1, 0), V(1, 0, 0)], 1)
    t.add(slab((0, 0.16, -0.18), R, [(x * 0.95, y * 0.95) for x, y in bolt], 0.034, 0.02), YEL)
    t.paint(half((0, 0.3, 0), (0, 1, 0)), BROWN, soft=0.006)


def bulbasaur():
    M = Model('bulbasaur')
    b = M.part('body', h=0.0085, tris=11000)
    skin = shade('#86d3b6', 0.0, 0.9, 0.86, 1.04)
    b.add(ellipsoid((0, 0.36, -0.06), (0.34, 0.27, 0.38)), skin)
    b.add(ellipsoid((0, 0.53, 0.3), (0.38, 0.29, 0.3)), skin, k=0.08)
    b.add(ellipsoid((0, 0.46, 0.42), (0.3, 0.18, 0.18)), skin, k=0.06)
    for s in (-1, 1):
        b.add(cone((s * 0.24, 0.73, 0.27), (s * 0.34, 0.88, 0.2), 0.075, 0.018, flat=0.6), skin, k=0.04)
        for z0, z1 in ((0.22, 0.27), (-0.28, -0.25)):
            b.add(cone((s * 0.22, 0.32, z0), (s * 0.26, 0.08, z1), 0.105, 0.095), skin, k=0.05)
            b.add(ellipsoid((s * 0.26, 0.055, z1 + 0.03), (0.105, 0.06, 0.12)), skin, k=0.04)
        for dx in (-0.045, 0, 0.045):
            b.add(sphere((s * 0.26 + dx, 0.045, 0.39), 0.026), '#f4f1e6', k=0.006)
    for c, r in (((0.12, 0.79, 0.3), 0.06), ((-0.16, 0.77, 0.36), 0.05), ((0.04, 0.8, 0.14), 0.045), ((0.32, 0.52, -0.08), 0.07),
                 ((-0.33, 0.46, 0.04), 0.06), ((0.24, 0.58, -0.3), 0.05), ((-0.22, 0.62, -0.26), 0.055), ((0.36, 0.38, 0.12), 0.045)):
        b.paint(sphere(c, r), '#55a68f', soft=0.005)
    for s in (-1, 1):
        b.eye((s * 0.2, 0.585, 0.6), 0.06, 0.072, 0.04, '#8a1a22', '#e5585a', sclera='#f8f6f0')
        b.decal((s * 0.04, 0.515, 0.7), 0.012, 0.008, '#2c3d36')
    b.stroke((0, 0.44, 0.7), [(-0.17, 0.035), (-0.09, -0.015), (0, -0.028), (0.09, -0.015), (0.17, 0.035)], 0.014, '#2f3b36', taper=0.6)
    bu = M.part('bulb', pivot=(0, 0.62, -0.12), h=0.0075, tris=5000)
    leaf = lambda P: np.clip(hexc('#3c8f45')[None] * (0.95 + 0.0 * P[:, :1]) + (hexc('#9ad85f') - hexc('#3c8f45'))[None] * smoothstep(0.62, 1.12, P[:, 1])[:, None], 0, 1)
    bu.add(ellipsoid((0, 0.8, -0.12), (0.3, 0.27, 0.3)), leaf)
    for i in range(6):
        a = i * math.pi / 3 + 0.3
        d = V(math.cos(a), 0, math.sin(a))
        bu.add(ellipsoid(V(0, 0.82, -0.12) + d * 0.15, (0.16, 0.27, 0.16), frame(unit(V(0, 1, 0) + d * 0.35), d)), leaf, k=0.025)
    bu.add(cone((0, 0.98, -0.12), (0, 1.16, -0.15), 0.13, 0.03), leaf, k=0.08)


def charmander():
    M = Model('charmander')
    b = M.part('body', h=0.0072, tris=12000)
    o = shade('#f98b3e', 0.0, 1.0, 0.9, 1.05)
    b.add(cone((0, 0.3, 0), (0, 0.6, 0.0), 0.24, 0.19), o)
    b.add(ellipsoid((0, 0.92, 0.05), (0.285, 0.26, 0.27)), o, k=0.07)
    b.add(ellipsoid((0, 0.86, 0.22), (0.21, 0.155, 0.17)), o, k=0.07)
    for s in (-1, 1):
        b.add(cone((s * 0.19, 0.58, 0.05), (s * 0.27, 0.45, 0.17), 0.06, 0.05), o, k=0.03)
        b.add(ellipsoid((s * 0.28, 0.42, 0.2), (0.055, 0.06, 0.06)), o, k=0.02)
        for dz in (-0.03, 0.02):
            b.add(cone((s * 0.29, 0.4, 0.21 + dz), (s * 0.3, 0.37, 0.25 + dz), 0.016, 0.006), '#f6f0e2', k=0.004)
        b.add(cone((s * 0.13, 0.26, 0.02), (s * 0.15, 0.08, 0.06), 0.1, 0.09), o, k=0.05)
        b.add(ellipsoid((s * 0.15, 0.055, 0.1), (0.1, 0.055, 0.13)), o, k=0.04)
        for dx in (-0.045, 0, 0.045):
            b.add(cone((s * 0.15 + dx, 0.05, 0.2), (s * 0.15 + dx * 1.2, 0.03, 0.245), 0.02, 0.006), '#f6f0e2', k=0.006)
    b.add(chain([V(0, 0.3, -0.16), V(0, 0.22, -0.4), V(0, 0.3, -0.6), V(0, 0.5, -0.7), V(0, 0.68, -0.68)], [0.09, 0.07, 0.055, 0.048, 0.045], k=0.02), o, k=0.06)
    b.paint(ellipsoid((0, 0.36, 0.15), (0.17, 0.24, 0.12)), '#f9dc98', soft=0.006)
    for s in (-1, 1):
        b.eye((s * 0.12, 0.965, 0.5), 0.055, 0.074, 0.036, '#18213f', '#3f63b8', tilt=-s * 0.08)
        b.decal((s * 0.035, 0.9, 0.5), 0.01, 0.007, '#6b2f17')
    b.stroke((0, 0.835, 0.5), [(-0.11, 0.03), (-0.05, -0.006), (0, -0.012), (0.05, -0.006), (0.11, 0.03)], 0.013, '#6b2f17', taper=0.6)


def pidgey():
    M = Model('pidgey')
    b = M.part('body', h=0.0072, tris=10000)
    br = shade('#bd8752', 0.1, 1.0, 0.88, 1.05)
    cream = '#f6e4bc'
    b.add(ellipsoid((0, 0.42, 0), (0.3, 0.32, 0.32)), br)
    b.add(ellipsoid((0, 0.78, 0.08), (0.24, 0.23, 0.24)), br, k=0.1)
    b.paint(ellipsoid((0, 0.36, 0.2), (0.22, 0.26, 0.17)), cream, soft=0.01)
    b.paint(ellipsoid((0, 0.72, 0.26), (0.19, 0.14, 0.12)), cream, soft=0.008)
    for i, (dx, col) in enumerate(((-0.05, '#e3755c'), (0, '#f0c060'), (0.05, '#e3755c'))):
        b.add(cone((dx * 0.6, 0.97, 0.02 + abs(dx)), (dx * 1.8, 1.16 - abs(dx), -0.14), 0.05, 0.012, flat=0.55, zdir=(1, 0, 0)), col, k=0.03)
    b.add(cone((0, 0.77, 0.3), (0, 0.72, 0.41), 0.045, 0.01), '#5a5a5a', k=0.01)
    for dx in (-0.08, 0, 0.08):
        b.add(cone((dx * 0.5, 0.36, -0.26), (dx * 2, 0.27, -0.52), 0.07, 0.035, flat=0.4, zdir=(0, 1, 0)), '#8b5a33', k=0.03)
    for s in (-1, 1):
        b.add(cone((s * 0.1, 0.14, 0.06), (s * 0.1, 0.02, 0.1), 0.028, 0.022), '#eaa07c', k=0.02)
        for a in (-0.5, 0, 0.5):
            b.add(cone((s * 0.1, 0.02, 0.1), (s * 0.1 + math.sin(a) * 0.07, 0.015, 0.1 + math.cos(a) * 0.07), 0.018, 0.012), '#eaa07c', k=0.01)
    for s in (-1, 1):
        b.eye((s * 0.11, 0.82, 0.4), 0.042, 0.052, 0.03, '#141414', '#3a2a20')
        b.stroke((s * 0.17, 0.8, 0.3), [(-s * 0.02, 0.02), (s * 0.05, 0.0), (s * 0.11, -0.03)], 0.04, '#2a2422', taper=0.7, up=(0, 1, 0))
    for s, nm in ((-1, 'wingL'), (1, 'wingR')):
        w = M.part(nm, pivot=(s * 0.27, 0.52, -0.02), parent='body', h=0.0065, tris=1800, sym=False)
        Rw = frame(unit(V(s * 0.25, -1, -0.15)), (s, 0, 0))
        w.add(ellipsoid((s * 0.34, 0.42, -0.06), (0.11, 0.22, 0.05), Rw), '#93603a')
        for j in range(3):
            w.add(cone((s * 0.34, 0.36 - j * 0.03, -0.1 - j * 0.06), (s * 0.38, 0.2 - j * 0.02, -0.18 - j * 0.07), 0.05, 0.02, flat=0.4, zdir=(s, 0, 0)), '#7b4c2c', k=0.02)
        w.paint(ellipsoid((s * 0.38, 0.48, 0.0), (0.08, 0.12, 0.1)), '#c8955f', soft=0.01)


def rattata():
    M = Model('rattata')
    b = M.part('body', h=0.0072, tris=11000)
    pu = shade('#a97ccc', 0.0, 0.8, 0.86, 1.05)
    cream = '#f3e3b8'
    b.add(ellipsoid((0, 0.28, -0.1), (0.27, 0.23, 0.34)), pu)
    b.add(ellipsoid((0, 0.48, 0.24), (0.25, 0.23, 0.25)), pu, k=0.08)
    b.add(ellipsoid((0, 0.41, 0.42), (0.13, 0.1, 0.11)), cream, k=0.05)
    b.add(sphere((0, 0.445, 0.525), 0.03), '#e86f9a', k=0.008)
    b.paint(ellipsoid((0, 0.2, 0.1), (0.2, 0.16, 0.22)), cream, soft=0.01)
    for s in (-1, 1):
        Re = frame(unit(V(s * 0.45, 1, -0.1)), (s * 0.2, 0.1, 1))
        b.add(ellipsoid((s * 0.21, 0.7, 0.16), (0.13, 0.16, 0.05), Re), pu, k=0.03)
        b.paint(ellipsoid(V(s * 0.21, 0.71, 0.16) + Re[:, 2] * 0.045, (0.085, 0.11, 0.03), Re), '#f0cfa6', soft=0.006)
        for z in (0.14, -0.3):
            b.add(cone((s * 0.15, 0.22, z), (s * 0.17, 0.06, z + 0.02), 0.075, 0.06), pu, k=0.05)
            b.add(ellipsoid((s * 0.17, 0.045, z + 0.05), (0.07, 0.045, 0.095)), cream, k=0.03)
        b.add(rbox((s * 0.024, 0.325, 0.49), (0.019, 0.04, 0.012), 0.008), '#ffffff', k=0.004)
    curl = chaikin([V(0, 0.25, -0.4), V(0, 0.2, -0.62), V(0, 0.36, -0.78), V(0, 0.58, -0.7), V(0, 0.56, -0.52), V(0, 0.44, -0.56)], 2)
    b.add(chain(list(curl), list(np.linspace(0.042, 0.024, len(curl)))), pu, k=0.03)
    for s in (-1, 1):
        b.eye((s * 0.12, 0.54, 0.5), 0.058, 0.074, 0.038, '#7a1020', '#e2404f')
        for k in range(3):
            a, y = 0.08 * (k - 1), 0.43 - 0.02 * (k - 1)
            b.tube([V(s * 0.11, y, 0.46), V(s * 0.18, y + 0.006 + a * 0.3, 0.465), V(s * 0.26, y + a, 0.44)], 0.005, '#4a3a3a')


def grub(b, body, belly, ring=None):
    for i in range(4):
        z, r = -0.54 + i * 0.19, 0.15 + i * 0.022
        b.add(ellipsoid((0, r, z), (r, r, r * 0.92)), body if not (ring and i % 2) else ring, k=0.05)
        for s in (-1, 1):
            b.add(ellipsoid((s * r * 0.62, 0.035, z + 0.02), (0.045, 0.035, 0.05)), belly, k=0.02)


def caterpie():
    M = Model('caterpie')
    b = M.part('body', h=0.0072, tris=10000)
    g = shade('#87cc4f', 0.0, 0.7, 0.88, 1.05)
    grub(b, g, '#f2de78')
    b.add(ellipsoid((0, 0.42, 0.33), (0.27, 0.27, 0.25)), g, k=0.06)
    for i in range(4):
        z, r = -0.54 + i * 0.19, 0.15 + i * 0.022
        for s in (-1, 1):
            b.paint(sphere((s * r * 0.95, r * 1.05, z), 0.05), '#f6e27a', soft=0.004)
    b.paint(sphere((0, 0.2, -0.7), 0.08), '#f6e27a', soft=0.006)
    for s in (-1, 1):
        b.add(cone((s * 0.06, 0.64, 0.28), (s * 0.08, 0.84, 0.18), 0.04, 0.022), '#e2473b', k=0.03)
        b.add(cone((s * 0.08, 0.84, 0.18), (s * 0.15, 0.9, 0.12), 0.022, 0.012), '#e2473b', k=0.01)
        b.eye((s * 0.13, 0.48, 0.6), 0.052, 0.062, 0.034, '#141414', '#2e2e2e', sclera='#f8e47a')
    b.decal((0, 0.34, 0.6), 0.055, 0.03, '#f6e27a')


def weedle():
    M = Model('weedle')
    b = M.part('body', h=0.0072, tris=10000)
    grub(b, shade('#dc9a4d', 0.0, 0.7, 0.88, 1.05), '#f2c98a', ring=shade('#c47f3c', 0.0, 0.7, 0.88, 1.05))
    b.add(ellipsoid((0, 0.4, 0.31), (0.25, 0.25, 0.24)), shade('#dc9a4d', 0.0, 0.7, 0.88, 1.05), k=0.06)
    b.add(ellipsoid((0, 0.36, 0.53), (0.12, 0.1, 0.08)), '#f08fb2', k=0.03)
    b.add(cone((0, 0.6, 0.27), (0, 0.84, 0.2), 0.065, 0.008), '#f6f6f2', k=0.02)
    b.add(cone((0, 0.18, -0.68), (0, 0.24, -0.92), 0.05, 0.008), '#f6f6f2', k=0.02)
    for s in (-1, 1):
        b.eye((s * 0.12, 0.5, 0.55), 0.034, 0.044, 0.026, '#141414', '#2e2e2e')


def oddish():
    M = Model('oddish')
    b = M.part('body', h=0.0072, tris=9000)
    bl = shade('#5374c6', 0.0, 0.8, 0.86, 1.06)
    b.add(ellipsoid((0, 0.36, 0), (0.32, 0.3, 0.3)), bl)
    b.add(cone((0, 0.55, 0), (0, 0.68, -0.01), 0.16, 0.06), bl, k=0.12)
    for s in (-1, 1):
        b.add(ellipsoid((s * 0.13, 0.06, 0.08), (0.09, 0.065, 0.12)), '#3f5ba6', k=0.05)
        b.eye((s * 0.11, 0.42, 0.5), 0.05, 0.064, 0.034, '#8c1428', '#f04656')
    b.stroke((0, 0.33, 0.5), [(-0.04, 0.008), (0, -0.012), (0.04, 0.008)], 0.011, '#2a2350', taper=0.5)
    lv = M.part('leaves', pivot=(0, 0.64, 0), parent='body', h=0.006, tris=4500)
    for i in range(5):
        a = i * 2 * math.pi / 5 + 0.3
        d = V(math.cos(a), 0, math.sin(a))
        ax = unit(d * 0.75 + V(0, 1, 0))
        nrm = unit(np.cross(ax, np.cross(V(0, 1, 0), d)))
        Rl = frame(ax, nrm)
        mid = V(0, 0.66, 0) + ax * 0.2
        col = '#4fb048' if i % 2 else '#45a241'
        lv.add(union([ellipsoid(mid, (0.12, 0.2, 0.028), Rl), cone(mid + ax * 0.05, mid + ax * 0.27, 0.06, 0.008, flat=0.3, zdir=nrm)], 0.04), col, k=0.03)
        lv.paint(inter(rbox(mid, (0.006, 0.26, 0.06), 0.004, Rl), sphere(mid, 0.3)), '#3a8c3a', soft=0.003)


# ---------------------------------------------------------------- people (pivots match the game's walk animation rig)
def hair_shell(face_lo=1.86):
    cap = ellipsoid((0, 1.79, -0.035), (0.458, 0.445, 0.445))
    window = ellipsoid((0, 1.53, 0.33), (0.37, face_lo - 1.53, 0.42))
    return diff(cap, window, 0.03)


def bangs(xs, y_top=2.05, y_tip=1.86, z_tip=0.42, r=0.1):
    return [cone((x * 0.6, y_top, 0.26), (x, y_tip - abs(x) * 0.25, z_tip - abs(x) * 0.25), r, 0.032) for x in xs]


def human(name, o):
    M = Model(name)
    shirt, pants = o['shirt'], o.get('pants', '#2f3a52')
    T = M.part('torso', h=0.011, tris=3500)
    sq = lambda p, s=0.82: squash(p, (0, 1.0, 0), np.eye(3), (1, 1, s))
    T.add(sq(cone((0, 0.86, 0), (0, 1.3, 0), 0.255, 0.2)), shirt)
    T.add(sq(ellipsoid((0, 1.31, 0), (0.29, 0.13, 0.22)), 0.9), shirt, k=0.06)
    T.add(cone((0, 1.36, 0), (0, 1.6, 0), 0.085, 0.08), SKIN, k=0.02)
    if o.get('skirt'):
        T.add(sq(inter(cone((0, 0.98, 0), (0, 0.46, 0), 0.21, 0.4), half((0, 0.52, 0), (0, -1, 0)), 0.03), 0.86), o['skirt'], k=0.03)
    else:
        T.add(sq(ellipsoid((0, 0.76, 0), (0.25, 0.16, 0.21))), pants, k=0.03)
    if o.get('collar'):
        T.add(torus((0, 1.41, 0.015), 0.135, 0.032, euler(0.28, 0, 0)), o['collar'], k=0.01)
    if o.get('apron'):
        T.paint(rbox((0, 0.92, 0.3), (0.17, 0.32, 0.12), 0.04), o['apron'], soft=0.006)
    if o.get('bag'):
        b2 = o.get('bag2', o['bag'])
        T.add(rbox((0, 1.06, -0.28), (0.23, 0.26, 0.12), 0.08), o['bag'], k=0.02)
        T.add(rbox((0, 1.22, -0.3), (0.24, 0.12, 0.135), 0.07), b2, k=0.01)
        T.add(rbox((0, 0.93, -0.41), (0.15, 0.1, 0.035), 0.03), b2, k=0.01)
        for s in (-1, 1):
            T.add(chain([V(s * 0.14, 1.36, -0.2), V(s * 0.15, 1.44, 0.0), V(s * 0.16, 1.3, 0.17), V(s * 0.17, 1.0, 0.205)], [0.028] * 4, k=0.01), b2, k=0.006)
    if o.get('belt'):
        T.paint(rbox((0, 0.86, 0), (0.4, 0.025, 0.4)), o['belt'], soft=0.004)
    for s, nm in ((-1, 'armL'), (1, 'armR')):
        A = M.part(nm, pivot=(s * 0.33, 1.3, 0), parent='torso', h=0.009, tris=1000, sym=False)
        x = s * 0.33
        long_ = o.get('long_sleeves')
        A.add(cone((x, 1.33, 0), (x, 1.08 if not long_ else 0.92, 0), 0.1, 0.088), o.get('sleeve', shirt))
        if not long_:
            A.add(cone((x, 1.1, 0), (x, 0.9, 0), 0.07, 0.065), SKIN, k=0.015)
        A.add(ellipsoid((x, 0.81, 0.01), (0.072, 0.088, 0.075)), SKIN, k=0.03)
        A.add(ellipsoid((x - s * 0.035, 0.84, 0.06), (0.03, 0.042, 0.03)), SKIN, k=0.015)
    for s, nm in ((-1, 'legL'), (1, 'legR')):
        L = M.part(nm, pivot=(s * 0.14, 0.72, 0), parent='torso', h=0.009, tris=1100, sym=False)
        x = s * 0.14
        L.add(cone((x, 0.76, 0), (x, 0.48, 0), 0.125, 0.11), o['skirt'] and SKIN or pants)
        L.add(cone((x, 0.5, 0), (x, 0.16, 0), 0.085, 0.075), o.get('socks', SKIN), k=0.02)
        shoe = o.get('shoes', '#e2473b')
        L.add(ellipsoid((x, 0.085, 0.05), (0.11, 0.085, 0.165)), shoe, k=0.03)
        L.add(ellipsoid((x, 0.1, 0.14), (0.095, 0.07, 0.08)), shoe, k=0.03)
        L.paint(half((0, 0.035, 0), (0, 1, 0)), o.get('sole', '#f4f1ea'), soft=0.004)
    H = M.part('head', pivot=(0, 1.74, 0), parent='torso', h=0.0085, tris=8000)
    H.add(ellipsoid((0, 1.76, 0), (0.43, 0.41, 0.4)), SKIN)
    H.add(ellipsoid((0, 1.62, 0.07), (0.37, 0.28, 0.31)), SKIN, k=0.12)
    for s in (-1, 1):
        H.add(ellipsoid((s * 0.415, 1.7, 0), (0.055, 0.085, 0.06)), SKIN, k=0.03)
    eyes = o.get('eye', '#6b4a2e')  # face details first, so they land on the face and not on hats or beards
    for s in (-1, 1):
        H.eye((s * 0.155, 1.715, 0.6), 0.057, 0.082, 0.034, '#22160f', eyes)
        H.decal((s * 0.255, 1.6, 0.6), 0.06, 0.036, BLUSH)
        if o.get('brows'):
            H.stroke((s * 0.16, 1.845, 0.6), [(-0.05, -0.006), (0, 0.008), (0.05, -0.004)], 0.02, o['brows'], taper=0.6)
    if o.get('mouth', 'smile') == 'open':
        H.decal((0, 1.56, 0.6), 0.05, 0.034, '#a8443c', flat_top=0.12)
        H.decal((0, 1.545, 0.6), 0.026, 0.012, '#f08a86', lift=0.0022)
    elif o.get('mouth', 'smile') == 'smile':
        H.stroke((0, 1.565, 0.6), [(-0.05, 0.014), (-0.02, -0.006), (0.02, -0.006), (0.05, 0.014)], 0.016, '#7a3b2e', taper=0.5)
    o['style'](H, shade(o['hair'], 1.45, 2.2, 0.8, 1.12), o)


def style_cap(H, hair, o):
    H.add(diff(ellipsoid((0, 1.76, -0.04), (0.448, 0.425, 0.435)), ellipsoid((0, 1.5, 0.33), (0.37, 0.34, 0.42)), 0.03), hair, k=0.01)
    for s in (-1, 1):
        H.add(cone((s * 0.36, 1.84, 0.2), (s * 0.4, 1.63, 0.24), 0.075, 0.02), hair, k=0.02)
    H.add(union([cone((x, 1.86, 0.4), (x * 1.12, 1.79, 0.44), 0.05, 0.015) for x in (-0.14, 0.0, 0.13)], 0.02), hair, k=0.015)
    red = '#e23a2f'
    crown = inter(ellipsoid((0, 1.86, -0.01), (0.468, 0.43, 0.472)), half((0, 1.86, 0), unit(V(0, -1, -0.2))), 0.02)
    H.add(crown, red, k=0.008)
    H.add(inter(ellipsoid((0, 1.875, 0.36), (0.31, 0.03, 0.27), euler(0.16, 0, 0)), half((0, 0, 0.12), (0, 0, -1))), red, k=0.02)
    H.paint(inter(rbox((0, 2.03, 0.4), (0.2, 0.15, 0.2), 0.05), half((0, 1.905, 0), (0, -1, 0))), '#f6f4ee', soft=0.004)
    H.add(sphere((0, 2.28, -0.01), 0.038), red, k=0.01)


def style_straw(H, hair, o):
    H.add(hair_shell(1.9), hair, k=0.01)
    H.add(union(bangs((-0.24, -0.1, 0.05, 0.19)), 0.03), hair, k=0.02)
    for s in (-1, 1):
        H.add(cone((s * 0.38, 1.82, 0.12), (s * 0.37, 1.5, 0.16), 0.1, 0.03), hair, k=0.03)
    H.add(chain([V(0, 1.66, -0.38), V(0, 1.45, -0.43), V(0, 1.24, -0.38)], [0.1, 0.085, 0.05], k=0.02), hair, k=0.04)
    straw = lambda P: np.clip(hexc('#e8c47a')[None] * (0.96 + 0.04 * np.sin(np.hypot(P[:, 0], P[:, 2] + 0.02) * 90))[:, None], 0, 1)
    Rh = euler(0.12, 0, 0)
    H.add(rcyl((0, 2.12, -0.02), 0.36, 0.15, 0.09, Rh), straw, k=0.01)
    H.add(rcyl((0, 2.0, 0.0), 0.8, 0.022, 0.02, Rh), straw, k=0.03)
    H.paint(rcyl((0, 2.07, -0.01), 0.4, 0.035, 0.0, Rh), '#d6453a', soft=0.004)


def style_nurse(H, hair, o):
    H.add(hair_shell(1.88), hair, k=0.01)
    H.add(union(bangs((-0.22, -0.08, 0.08, 0.22), r=0.11), 0.03), hair, k=0.02)
    for s in (-1, 1):
        H.add(ellipsoid((s * 0.42, 1.6, -0.12), (0.14, 0.17, 0.14)), hair, k=0.06)
        H.add(cone((s * 0.36, 1.82, 0.14), (s * 0.38, 1.55, 0.18), 0.09, 0.03), hair, k=0.03)
    Rc = euler(-0.45, 0, 0)
    H.add(rbox((0, 2.12, 0.12), (0.2, 0.095, 0.05), 0.04, Rc), '#fbfbf8', k=0.02)
    for b_ in ((0.012, 0.05), (0.05, 0.012)):
        H.paint(rbox((0, 2.13, 0.17), (b_[0], b_[1], 0.06), 0.004, Rc), '#e2473b', soft=0.003)


def style_kid(H, hair, o):
    H.add(hair_shell(1.92), hair, k=0.01)
    H.add(union(bangs((-0.25, -0.12, 0.0, 0.13, 0.25), y_tip=1.9, r=0.09), 0.025), hair, k=0.02)
    for a in range(7):
        ang = a * 0.9 - 2.7
        d = unit(V(math.sin(ang) * 0.8, 0.9, math.cos(ang) * 0.6 - 0.3))
        H.add(cone(V(0, 1.85, -0.05) + d * 0.32, V(0, 1.85, -0.05) + d * 0.56, 0.1, 0.02), hair, k=0.04)


def style_elder(H, hair, o):
    white = shade('#eeeeec', 1.3, 2.0, 0.86, 1.02)
    for s in (-1, 1):
        H.add(ellipsoid((s * 0.39, 1.72, -0.1), (0.1, 0.13, 0.17)), white, k=0.05)
        H.add(ellipsoid((s * 0.16, 1.87, 0.35), (0.08, 0.034, 0.045), euler(0, 0, -s * 0.2)), white, k=0.01)
        H.add(ellipsoid((s * 0.075, 1.6, 0.4), (0.095, 0.04, 0.05), euler(0, 0, s * 0.25)), white, k=0.02)
    H.add(union([ellipsoid((0, 1.5, 0.27), (0.25, 0.2, 0.17)), ellipsoid((0, 1.38, 0.25), (0.15, 0.14, 0.13))], 0.06), white, k=0.04)
    H.add(ellipsoid((0, 1.69, 0.4), (0.05, 0.045, 0.05)), '#efc2a6', k=0.02)


PEOPLE = {
    'player': dict(shirt='#3a6fd0', sleeve='#f4f4f4', pants='#26324a', hair='#2b1d14', style=style_cap, bag='#2e8bd6', bag2='#1f6db0', collar='#f4f4f4', brows='#3b2418'),
    'nurse': dict(shirt='#fbfbf8', skirt='#ffc6d6', hair='#f39ac0', style=style_nurse, shoes='#ffffff', socks='#ffe3ea', apron='#ffffff', eye='#3a6fb0'),
    'elder': dict(shirt='#cdb98f', pants='#6b5a44', hair='#dedede', style=style_elder, shoes='#5a3b26', socks='#6b5a44', mouth=None, long_sleeves=True),
    'kid': dict(shirt='#ffffff', pants='#2c3442', hair='#5a3a24', style=style_kid, bag='#3aa0d8', shoes='#3a3a3a', mouth='open', brows='#3b2418'),
    'girl': dict(shirt='#f5f5f5', sleeve='#e2473b', skirt='#3c5fa8', hair='#5b3420', style=style_straw, bag='#3c7fd0', shoes='#7a4a2a', mouth='open'),
}
for k_, v_ in PEOPLE.items():
    v_.setdefault('skirt', None)


# ---------------------------------------------------------------- leafy props (instanced in the town)
def surface_basis(n, up=(0, 1, 0)):
    y = np.asarray(up, float) - n * np.dot(up, n)
    y = unit(y if np.linalg.norm(y) > 1e-3 else V(0, 0, 1))
    return np.stack([np.cross(y, n), y, n], 1)


def leaf_scale(base, p0, size, rng):
    """One leaf scale on the surface nearest p0, lower edge flared out like the reference trees."""
    p = project(base.f, p0[None], 0.01, 14)[0]
    nrm = unit(grad(base.f, p[None], 0.01)[0])
    s = size * rng.uniform(0.8, 1.2)
    R = surface_basis(nrm) @ euler(-0.42, 0, rng.uniform(-0.4, 0.4))
    return p - nrm * s * 0.08, R, V(s, s * 0.85, s * 0.5)


def leaf_crown(base, centre, n, size, rng, below=-0.55):
    """Overlapping leaf scales over a canopy field."""
    items, gold = [], (1 + 5 ** 0.5) / 2
    for i in range(n):
        y = 1 - 2 * (i + 0.5) / n
        if y < below:
            continue
        r, a = math.sqrt(1 - y * y), 2 * math.pi * i / gold
        items.append(leaf_scale(base, centre + V(r * math.cos(a), y, r * math.sin(a)) * 2.5, size, rng))
    return scatter(items, 0.008)


def foliage(base, y0, y1, dark='#1a5020', mid='#2f7429', light='#69a841'):
    """Leaf colour: brighter toward the top and on scale crowns, darker in the gaps between scales."""
    d, m, l = hexc(dark), hexc(mid), hexc(light)
    def f(P):
        t = smoothstep(y0, y1, P[:, 1])[:, None]
        crown = smoothstep(-0.01, 0.07, base.f(P))[:, None]
        wob = (np.sin(P[:, 0] * 7.1 + 1.3) * np.sin(P[:, 1] * 6.3) * np.sin(P[:, 2] * 7.7 + 0.4))[:, None]
        c = d + (m - d) * t + (l - m) * crown * (0.35 + 0.5 * t)
        return np.clip(c * (1 + 0.06 * wob), 0, 1)
    return f


def round_tree(v):
    rng = np.random.default_rng(31 + v)
    M = Model(f'tree_round_{v}', ao=2.5, prop=True)
    tr = M.part('trunk', h=0.016, tris=1500, mat='base', borders=False)
    bark = lambda P: np.clip(hexc('#7a5232')[None] * (0.84 + 0.12 * np.sin(np.arctan2(P[:, 2], P[:, 0]) * 9 + P[:, 1] * 3))[:, None], 0, 1)
    lean = V(rng.uniform(-0.1, 0.1), 0, rng.uniform(-0.1, 0.1))
    tr.add(chain([V(0, 0, 0), V(0, 0.8, 0) + lean * 0.5, V(0, 1.6, 0) + lean], [0.2, 0.15, 0.11], k=0.05), bark)
    for i in range(5):
        a = i * 2 * math.pi / 5 + rng.uniform(-0.3, 0.3)
        tr.add(cone((math.cos(a) * 0.05, 0.3, math.sin(a) * 0.05), (math.cos(a) * 0.36, -0.02, math.sin(a) * 0.36), 0.11, 0.035), bark, k=0.08)
    for i in range(3):
        a = i * 2 * math.pi / 3 + rng.uniform(-0.4, 0.4)
        tr.add(cone(V(0, 1.3, 0) + lean * 0.8, (math.cos(a) * 0.45, 1.95, math.sin(a) * 0.45), 0.07, 0.04), bark, k=0.05)
    cy = 2.1
    blobs = [sphere((0, cy + 0.15, 0), 0.72)]
    for i in range(6):
        a = i * 2 * math.pi / 6 + rng.uniform(-0.3, 0.3)
        r = rng.uniform(0.5, 0.68)
        blobs.append(sphere((math.cos(a) * r, cy + rng.uniform(-0.25, 0.2), math.sin(a) * r), rng.uniform(0.48, 0.6)))
    for i in range(2):
        a = rng.uniform(0, 2 * math.pi)
        blobs.append(sphere((math.cos(a) * 0.25, cy + 0.62, math.sin(a) * 0.25), rng.uniform(0.4, 0.5)))
    base = union(blobs, 0.28)
    can = M.part('canopy', h=0.017, tris=9000, mat='base', borders=False)
    green = foliage(base, cy - 0.8, cy + 1.1)
    can.add(base, green)
    can.add(leaf_crown(base, V(0, cy, 0), 420, 0.18, rng), green, k=0.012)


def bush(v):
    rng = np.random.default_rng(71 + v)
    M = Model(f'bush_{v}', ao=1.6, prop=True)
    b = M.part('leaves', h=0.012, tris=2600, mat='base', borders=False)
    blobs = [sphere((0, 0.34, 0), 0.38)]
    for i in range(4):
        a = i * math.pi / 2 + rng.uniform(-0.4, 0.4)
        blobs.append(sphere((math.cos(a) * 0.3, rng.uniform(0.24, 0.32), math.sin(a) * 0.3), rng.uniform(0.25, 0.31)))
    base = union(blobs, 0.15)
    green = foliage(base, 0.0, 0.75, dark='#215a22', mid='#37802e', light='#74b247')
    b.add(base, green)
    b.add(leaf_crown(base, V(0, 0.3, 0), 140, 0.115, rng, below=-0.25), green, k=0.008)


def pine_tree(v):
    """Stacked soft cones, each with a scalloped rim of drooping lobes and its own leaf scales."""
    rng = np.random.default_rng(53 + v)
    M = Model(f'tree_pine_{v}', ao=2.2, prop=True)
    tr = M.part('trunk', h=0.014, tris=300, mat='base', borders=False)
    bark = lambda P: np.clip(hexc('#5e3f27')[None] * (0.84 + 0.12 * np.sin(np.arctan2(P[:, 2], P[:, 0]) * 9 + P[:, 1] * 3))[:, None], 0, 1)
    tr.add(cone((0, 0, 0), (0, 1.0, 0), 0.15, 0.09), bark)
    for i in range(4):
        a = i * math.pi / 2 + rng.uniform(-0.3, 0.3)
        tr.add(cone((math.cos(a) * 0.04, 0.24, math.sin(a) * 0.04), (math.cos(a) * 0.28, -0.02, math.sin(a) * 0.28), 0.08, 0.03), bark, k=0.06)
    tiers, n_t = [], 4 + v  # variant 1 is slimmer, with one more tier
    for k in range(n_t):
        y0, r, hgt = 0.55 + k * 2.24 / n_t, (1.0 - k * 0.76 / n_t) * (1 - 0.1 * v), 0.98 - k * 0.32 / n_t
        body = inter(cone((0, y0 + 0.2, 0), (0, y0 + hgt, 0), r * 0.7, 0.1), half((0, y0, 0), (0, -1, 0)), 0.08)
        n, off = 7 + k % 2 + int(3 * r), rng.uniform(0, 2 * math.pi)
        lobes = [sphere((math.cos(off + 2 * math.pi * i / n) * r * 0.7, y0 + 0.06, math.sin(off + 2 * math.pi * i / n) * r * 0.7), r * 0.26)
                 for i in range(n)]
        tiers.append((union([body] + lobes, 0.14), y0, r, hgt))
    base = union([t for t, *_ in tiers], 0.03)
    can = M.part('canopy', h=0.015, tris=3800, mat='base', borders=False)
    tone = [('#1a4a28', '#2d7240', '#6aab52'), ('#1c4a26', '#327a3a', '#74b250')][v % 2]
    green = foliage(base, 0.4, 3.0, *tone)
    can.add(base, green)
    for k, (t, y0, r, hgt) in enumerate(tiers):  # shingled rows of scales: the scalloped rim, then up the slope the next tier leaves visible
        top = k == n_t - 1
        rows = [(y0 + 0.06, r)] + [(y, r * 0.7 - (r * 0.7 - 0.1) * (y - y0 - 0.2) / (hgt - 0.2))
                                    for y in np.linspace(y0 + 0.2, y0 + 0.2 + (hgt - 0.2) * (0.8 if top else 0.45), 4 if top else 2)]
        items, size = [], 0.12 + 0.05 * r
        for y, rad in rows:
            s = size * (0.55 + 0.45 * rad / r)
            n, off = max(4, int(2 * math.pi * rad / (s * 1.3))), rng.uniform(0, 2 * math.pi)
            items += [leaf_scale(t, V(math.cos(off + 2 * math.pi * i / n) * (rad + 0.15), y, math.sin(off + 2 * math.pi * i / n) * (rad + 0.15)), s, rng)
                      for i in range(n)]
        can.add(scatter(items, 0.008), green, k=0.01)


# ---------------------------------------------------------------- street props: soft wood, iron and stone
def bench():
    """Iron frames and wooden planks are separate parts: planks touching the frame let the decimator bridge between them."""
    M = Model('bench', prop=True)
    f = M.part('frame', h=0.008, tris=3000, mat='base', sym=False, borders=False)
    iron = '#3a3a3e'
    for s in (-1, 1):
        x = s * 0.66
        f.add(chain([V(x, 0.0, 0.15), V(x, 0.42, 0.12)], [0.034, 0.028]), iron, k=0.03)
        f.add(chain([V(x, 0.0, -0.19), V(x, 0.43, -0.22), V(x, 0.88, -0.29)], [0.034, 0.03, 0.026]), iron, k=0.03)
        f.add(cone((x, 0.39, 0.16), (x, 0.39, -0.22), 0.026, 0.026), iron, k=0.03)
        for z in (0.16, -0.19):
            f.add(ellipsoid((x, 0.015, z), (0.045, 0.03, 0.065)), iron, k=0.02)
    w = M.part('planks', h=0.012, tris=12000, mat='base', sym=False, borders=False)
    for z, col in ((-0.12, '#ab7140'), (0.0, '#b47a46'), (0.12, '#a86e3d')):
        w.add(rbox((0, 0.452, z), (0.76, 0.036, 0.048), 0.03), col)
    for y, col in ((0.62, '#b07644'), (0.79, '#a96f3e')):
        w.add(rbox((0, y, -0.2 - (y - 0.62) * 0.15), (0.76, 0.055, 0.028), 0.026, euler(-0.15, 0, 0)), col)


def pc_sign():
    M = Model('sign', prop=True)
    s = M.part('sign', h=0.007, tris=10000, mat='base', sym=False)
    for x in (-0.36, 0.36):
        s.add(rbox((x, 0.48, 0), (0.045, 0.5, 0.045), 0.035), '#7a5132')
    s.add(rbox((0, 0.82, 0), (0.47, 0.34, 0.045), 0.04), '#94633a')
    s.add(rbox((0, 0.82, 0.03), (0.4, 0.27, 0.03), 0.025), '#f5ead0', k=0.006)
    c, ink, white = (0, 0.94, 0.5), '#3b3434', '#fbfbf6'  # Poké Ball emblem, then three lines of "text"
    s.decal(c, 0.15, 0.15, ink, lift=0.002, mat='base')
    s.decal(c, 0.125, 0.125, white, lift=0.004, mat='base')
    s.decal(c, 0.127, 0.127, '#e2473b', up=(0, -1, 0), flat_top=0.0, lift=0.006, mat='base')
    s.stroke(c, [(-0.125, 0), (0.125, 0)], 0.026, ink, taper=0, lift=0.008, mat='base')
    s.decal(c, 0.046, 0.046, ink, lift=0.01, mat='base')
    s.decal(c, 0.028, 0.028, white, lift=0.012, mat='base')
    for i in range(3):
        w = 0.55 - i * 0.1
        s.stroke((0, 0.75 - i * 0.07, 0.5), [(-w / 2, 0), (w / 2, 0)], 0.03, '#9a8b78', taper=0.15, mat='base')


def signpost():
    M = Model('signpost', prop=True)
    p = M.part('signpost', h=0.01, tris=4000, mat='base', sym=False)
    p.add(rbox((0, 0.86, 0), (0.065, 0.88, 0.065), 0.045), '#7a5132')
    arrow = [(-0.45, -0.12), (0.32, -0.12), (0.5, 0), (0.32, 0.12), (-0.45, 0.12)]
    for pos, ry, col in (((0.3, 1.45, 0.0), 0.5, '#cfa874'), ((-0.28, 1.12, 0.05), math.pi - 0.6, '#c49c69')):
        R = euler(0, ry, 0)
        p.add(slab(V(*pos) + R @ V(0, 0, 0.025), R, arrow, 0.035, 0.025), col)


def rock(v):
    rng = np.random.default_rng(91 + v)
    M = Model(f'rock_{v}', prop=True)
    r = M.part('rock', h=0.04, tris=500, mat='base', borders=False, sym=False)
    blobs = [ellipsoid((0, 0.05, 0), (0.95, 0.62, 0.85))]
    for i in range(3):
        a = i * 2 * math.pi / 3 + rng.uniform(-0.5, 0.5)
        blobs.append(ellipsoid((math.cos(a) * 0.45, rng.uniform(0.0, 0.2), math.sin(a) * 0.45), rng.uniform(0.4, 0.58, 3), euler(0, rng.uniform(0, 6.3), 0)))
    base = inter(union(blobs, 0.3), half((0, -0.25, 0), (0, -1, 0)), 0.12)

    def col(P):
        n = rows_unit(grad(base.f, P, 0.01))
        wob = np.sin(P[:, 0] * 5.1 + v) * np.sin(P[:, 1] * 4.3) * np.sin(P[:, 2] * 5.7 + 1.1)
        c = hexc('#8e8a80') + (hexc('#aaa596') - hexc('#8e8a80')) * (0.5 + 0.5 * wob)[:, None]
        c = c + (hexc('#5f5b54') - c) * (0.5 * smoothstep(0.0, -0.6, n[:, 1]))[:, None]
        return c + (hexc('#6e9a38') - c) * (0.85 * smoothstep(0.35, 0.8, n[:, 1]) * (0.75 + 0.25 * wob))[:, None]
    r.add(base, col)


# ---------------------------------------------------------------- build, AO, export
BUILDERS = {'pikachu': pikachu, 'bulbasaur': bulbasaur, 'charmander': charmander, 'pidgey': pidgey, 'rattata': rattata,
            'caterpie': caterpie, 'weedle': weedle, 'oddish': oddish}
for k_ in PEOPLE:
    BUILDERS[k_] = (lambda k=k_: human(k, PEOPLE[k]))
for v_ in range(3):
    BUILDERS[f'tree_round_{v_}'] = (lambda v=v_: round_tree(v))
    BUILDERS[f'bush_{v_}'] = (lambda v=v_: bush(v))
for v_ in range(2):
    BUILDERS[f'tree_pine_{v_}'] = (lambda v=v_: pine_tree(v))
for v_ in range(4):
    BUILDERS[f'rock_{v_}'] = (lambda v=v_: rock(v))
BUILDERS.update(bench=bench, sign=pc_sign, signpost=signpost)


def b64(arr):
    return base64.b64encode(arr.tobytes()).decode('ascii')


def build(M):
    out = {}
    for part in M.parts:
        t0 = time.time()
        P, T, N, C = part.mesh()
        groups = {part.mat: [(P, T, N, C)]}
        for mat, *g in part.extras:
            groups.setdefault(mat, []).append(tuple(g))
        entries = []
        for mat, gs in groups.items():
            base, Ps, Ts, Ns, Cs = 0, [], [], [], []
            for p, t, n, c in gs:
                Ps.append(p), Ts.append(t + base), Ns.append(n), Cs.append(c)
                base += len(p)
            P_, T_, N_, C_ = np.concatenate(Ps), np.concatenate(Ts), np.concatenate(Ns), np.concatenate(Cs)
            if mat != 'hi':
                C_ = C_ * sdf_ao(M, P_ + N_ * 0.002, N_)[:, None]
            big = len(P_) >= 65536
            local = P_ - part.pivot
            q = float(np.abs(local).max()) / 32767  # positions packed as int16 * q
            entries.append({
                'mat': mat,
                'q': q,
                'pos': b64(array('h', np.round(local / q).astype(int).ravel().tolist())),
                'nrm': b64(array('b', np.clip(np.round(N_ * 127), -127, 127).astype(int).ravel().tolist())),
                'col': b64(array('B', np.clip(np.round(C_ * 255), 0, 255).astype(int).ravel().tolist())),
                'idx': b64(array('I' if big else 'H', T_.ravel().tolist())),
                'i32': big,
            })
        out[f'{M.name}.{part.name}'] = entries
        print(f'  {M.name}.{part.name}: {len(T)} tris + {sum(len(g[1]) for g in part.extras)} detail tris ({time.time() - t0:.1f}s)')
    parents = {p.name: p for p in M.parts}
    rig = [{'name': p.name, 'parent': p.parent, 'at': (p.pivot - (parents[p.parent].pivot if p.parent else 0)).round(4).tolist()} for p in M.parts]
    return out, rig


def main():
    only = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    data = {'version': 1, 'assets': {}, 'rigs': {}, 'props': {}}
    if only and os.path.exists(OUT):  # rebuild a subset, keep the rest
        with open(OUT, encoding='ascii') as fh:
            data = json.loads(fh.read().split('=', 1)[1].rstrip().rstrip(';'))
        data.setdefault('props', {})
    t0 = time.time()
    for name in (only or BUILDERS):
        BUILDERS[name]()
    for M in MODELS:
        for k in [k for k in data['assets'] if k.startswith(M.name + '.')]:
            del data['assets'][k]
        assets, rig = build(M)
        if M.prop:
            data['props'][M.name] = [e for entries in assets.values() for e in entries]
        else:
            data['assets'].update(assets)
            data['rigs'][M.name] = rig
    with open(OUT, 'w', encoding='ascii') as fh:
        fh.write('// Generated by prototypes/blender/build_characters.py - do not edit by hand.\n')
        fh.write('window.VERDANT_CHARS = ' + json.dumps(data, separators=(',', ':')) + ';\n')
    print(f'wrote {OUT} ({os.path.getsize(OUT) / 1e6:.2f} MB) in {time.time() - t0:.1f}s')


main()
