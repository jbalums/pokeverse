"""Pikachu v002 quality test, built headless in Blender 5.4.

Run:  blender -b --factory-startup --python tools/production/build_pikachu_v002.py -- --output <dir>

Pipeline: signed-distance sculpt (numpy, smooth unions) -> OpenVDB -> mesh ->
Quadriflow retopology -> UVs -> baked albedo (feature masks evaluated on baked
rest positions) -> armature + heat weights -> baked idle/walk actions -> GLB.
Previews use the same view-independent toon math as the Unreal material.

Axes match v001 so the GLB is a drop-in: metres, +X forward, +Z up, "_l" bones
on -Y. Blender's glTF exporter maps (x,y,z) -> (x,z,-y), the v001 convention.
"""
import argparse
import json
import math
import sys
import time
from pathlib import Path

import bpy
import numpy as np
import openvdb
from mathutils import Quaternion, Vector

FPS = 30
VOXEL = 0.0025
ORIGIN = np.array([-0.42, -0.27, -0.01])
SIZE = np.array([0.64, 0.54, 0.84])
HEAD_C = np.array([0.0, 0.0, 0.42])
LIGHT = Vector((0.55, -0.45, 0.70)).normalized()  # toon key light, model space
EAR_BASE, EAR_MID, EAR_TIP = (-0.005, 0.095, 0.51), (-0.017, 0.15, 0.645), (-0.03, 0.205, 0.78)
# Lightning tail outline in (back, up) metres, lying in the sagittal X-Z plane.
TAIL = [(0.06, 0.15), (0.14, 0.21), (0.1133, 0.25), (0.10, 0.27), (0.22, 0.37), (0.18, 0.42), (0.29, 0.54),
        (0.37, 0.49), (0.27, 0.37), (0.30, 0.32), (0.20375, 0.25), (0.19, 0.24), (0.22, 0.20), (0.09, 0.12)]
SRGB = {"yellow": (252, 208, 45), "yellow_low": (238, 172, 34), "yellow_top": (255, 224, 78),
        "brown": (128, 72, 34), "black": (34, 28, 32), "eye_low": (64, 52, 70), "white": (252, 252, 248),
        "cheek": (228, 52, 44), "mouth": (92, 38, 32)}
SRGB = {k: np.array(v, np.float32) / 255 for k, v in SRGB.items()}


# ---------------------------------------------------------------- SDF sculpt
def axes():
    n = np.round(SIZE / VOXEL).astype(int) + 1
    return [ORIGIN[i] + VOXEL * np.arange(n[i], dtype=np.float32) for i in range(3)]


def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b + (a - b) * h - k * h * (1 - h)


def ellipsoid(c, r, yaw=0.0):
    def f(X, Y, Z):
        dx, dy, dz = X - c[0], Y - c[1], Z - c[2]
        if yaw:
            dx, dy = math.cos(yaw) * dx + math.sin(yaw) * dy, -math.sin(yaw) * dx + math.cos(yaw) * dy
        px, py, pz = dx / r[0], dy / r[1], dz / r[2]
        k0 = np.sqrt(px * px + py * py + pz * pz)
        k1 = np.sqrt((px / r[0]) ** 2 + (py / r[1]) ** 2 + (pz / r[2]) ** 2)
        return k0 * (k0 - 1) / np.maximum(k1, 1e-6)
    lo = np.array(c) - max(r) * 1.1
    return f, lo, np.array(c) + max(r) * 1.1


def round_cone(a, b, r1, r2, flat=1.0):
    """Capsule with radii r1->r2; flat<1 squashes it along the axis-orthogonal X."""
    a, b = np.array(a, float), np.array(b, float)
    ba = b - a
    l2, rr = ba @ ba, r1 - r2
    a2, il2 = l2 - rr * rr, 1 / l2
    n = np.array([1.0, 0, 0]) - ba * (ba[0] / l2)
    n /= np.linalg.norm(n)

    def f(X, Y, Z):
        px, py, pz = X - a[0], Y - a[1], Z - a[2]
        if flat != 1.0:
            dn = (px * n[0] + py * n[1] + pz * n[2]) * (1 / flat - 1)
            px, py, pz = px + dn * n[0], py + dn * n[1], pz + dn * n[2]
        y = px * ba[0] + py * ba[1] + pz * ba[2]
        z = y - l2
        x2 = (px * l2 - ba[0] * y) ** 2 + (py * l2 - ba[1] * y) ** 2 + (pz * l2 - ba[2] * y) ** 2
        y2, z2, k = y * y * l2, z * z * l2, math.copysign(1, rr) * rr * rr * x2
        return np.where(np.sign(z) * a2 * z2 > k, np.sqrt(x2 + z2) * il2 - r2,
                        np.where(np.sign(y) * a2 * y2 < k, np.sqrt(x2 + y2) * il2 - r1,
                                 (np.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1))
    pad = max(r1, r2) * 1.1
    return f, np.minimum(a, b) - pad, np.maximum(a, b) + pad


def polygon2d(px, pz, V):
    d = (px - V[0][0]) ** 2 + (pz - V[0][1]) ** 2
    s = np.ones(np.broadcast(px, pz).shape, np.float32)
    j = len(V) - 1
    for i in range(len(V)):
        ex, ez = V[j][0] - V[i][0], V[j][1] - V[i][1]
        wx, wz = px - V[i][0], pz - V[i][1]
        t = np.clip((wx * ex + wz * ez) / (ex * ex + ez * ez), 0, 1)
        d = np.minimum(d, (wx - ex * t) ** 2 + (wz - ez * t) ** 2)
        c1, c2, c3 = pz >= V[i][1], pz < V[j][1], ex * wz > ez * wx
        s = np.where((c1 & c2 & c3) | (~c1 & ~c2 & ~c3), -s, s)
        j = i
    return s * np.sqrt(d)


def tail_sdf(X, Y, Z, rounding=0.006):
    half = 0.019 - 0.008 * np.clip((Z - 0.12) / 0.42, 0, 1)  # thicker at the root
    d2 = polygon2d(-X, Z, TAIL) + rounding
    wy = np.abs(Y) - (half - rounding)
    return np.sqrt(np.maximum(d2, 0) ** 2 + np.maximum(wy, 0) ** 2) + np.minimum(np.maximum(d2, wy), 0) - rounding


def sculpt():
    xs, ys, zs = axes()
    d = np.full((len(xs), len(ys), len(zs)), 1.0, np.float32)

    def add(prim, k):
        f, lo, hi = prim
        lo, hi = lo - (2 * k + 0.01), hi + (2 * k + 0.01)
        sl = [slice(max(0, int((lo[i] - ORIGIN[i]) / VOXEL)), int((hi[i] - ORIGIN[i]) / VOXEL) + 2) for i in range(3)]
        X, Y, Z = xs[sl[0]][:, None, None], ys[sl[1]][None, :, None], zs[sl[2]][None, None, :]
        d[sl[0], sl[1], sl[2]] = smin(d[sl[0], sl[1], sl[2]], f(X, Y, Z).astype(np.float32), k)

    add(ellipsoid((-0.01, 0, 0.15), (0.125, 0.135, 0.12)), 0.02)       # belly / hips
    add(ellipsoid((0.0, 0, 0.26), (0.095, 0.105, 0.09)), 0.06)          # chest
    add(ellipsoid(tuple(HEAD_C), (0.145, 0.175, 0.14)), 0.05)           # head
    for s in (-1, 1):
        add(ellipsoid((0.035, s * 0.085, 0.385), (0.10, 0.10, 0.085)), 0.04)               # cheek mass
        add(ellipsoid((-0.02, s * 0.085, 0.10), (0.085, 0.07, 0.08)), 0.03)                # haunch
        add(ellipsoid((0.05, s * 0.095, 0.028), (0.085, 0.048, 0.03), s * 0.2), 0.025)    # foot, toes out
        add(round_cone((0.03, s * 0.095, 0.285), (0.105, s * 0.105, 0.215), 0.04, 0.031), 0.025)  # arm
        add(ellipsoid((0.12, s * 0.098, 0.205), (0.036, 0.03, 0.03)), 0.015)             # paw
        base, mid, tip = (np.array(p) * (1, s, 1) for p in (EAR_BASE, EAR_MID, EAR_TIP))
        add(round_cone(base, mid, 0.036, 0.046, 0.55), 0.02)
        add(round_cone(mid, tip, 0.046, 0.003, 0.55), 0.01)
    add((tail_sdf, np.array([-0.40, -0.03, 0.10]), np.array([-0.04, 0.03, 0.56])), 0.02)
    d[:, :, zs < 0] = np.maximum(d[:, :, zs < 0], -zs[zs < 0][None, None, :])  # flat soles
    return np.clip(0.5 - d / (4 * VOXEL), 0, 1).astype(np.float32)


def sculpt_mesh(work):
    t = time.time()
    density = sculpt()
    grid = openvdb.FloatGrid()
    grid.copyFromArray(density)
    grid.transform = openvdb.createLinearTransform(voxelSize=VOXEL)
    grid.name = "density"
    vdb = work / "pikachu_sdf.vdb"
    openvdb.write(str(vdb), grids=[grid])
    vol = bpy.data.volumes.new("PikachuSDF")
    vol.filepath = str(vdb)
    vol_obj = bpy.data.objects.new("PikachuSDF", vol)
    vol_obj.location = ORIGIN.tolist()
    bpy.context.scene.collection.objects.link(vol_obj)
    holder = bpy.data.objects.new("Pikachu", bpy.data.meshes.new("tmp"))
    bpy.context.scene.collection.objects.link(holder)
    mod = holder.modifiers.new("v2m", "VOLUME_TO_MESH")
    mod.object, mod.grid_name, mod.threshold, mod.resolution_mode, mod.adaptivity = vol_obj, "density", 0.5, "GRID", 0
    dg = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(holder.evaluated_get(dg))
    holder.modifiers.clear()
    holder.data = mesh
    bpy.data.objects.remove(vol_obj)
    print(f"[v002] sculpt {time.time() - t:.1f}s, dense faces {len(mesh.polygons)}")
    return holder


def decimate(obj, triangles=16000):
    """Collapse the heat-weighted dense mesh; vertex weights interpolate along.

    ponytail: Quadriflow rejects even clean manifold input in this 5.4 alpha
    build and heat weighting fails on the collapsed mesh, hence this order.
    Swap in quad retopology when Quadriflow works again.
    """
    dense = obj.data
    dec = obj.modifiers.new("decimate", "DECIMATE")
    dec.decimate_type, dec.use_symmetry, dec.symmetry_axis = "COLLAPSE", True, "Y"
    dec.ratio = triangles / (2 * len(dense.polygons))
    obj.modifiers.move(obj.modifiers.find("decimate"), 0)
    dg = bpy.context.evaluated_depsgraph_get()
    low = bpy.data.meshes.new_from_object(obj.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    obj.modifiers.remove(dec)
    obj.data = low
    bpy.data.meshes.remove(dense)
    low.shade_smooth()
    unweighted = sum(sum(g.weight for g in v.groups) < 1e-4 for v in low.vertices)
    assert not unweighted, f"{unweighted} vertices lost bone weights"
    print(f"[v002] game mesh triangles {sum(len(p.vertices) - 2 for p in low.polygons)}")


def activate(obj, *others):
    bpy.ops.object.mode_set(mode="OBJECT") if bpy.context.object and bpy.context.object.mode != "OBJECT" else None
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in (obj, *others):
        o.select_set(True)
    bpy.context.view_layer.objects.active = obj


# ---------------------------------------------------------------- texture
def bake(obj, work, size=2048):
    activate(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004)
    bpy.ops.object.mode_set(mode="OBJECT")
    lo = np.array([min(v.co[i] for v in obj.data.vertices) for i in range(3)]) - 0.01
    span = np.array([max(v.co[i] for v in obj.data.vertices) for i in range(3)]) + 0.01 - lo

    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "OPTIX"
        prefs.get_devices()
        for dev in prefs.devices:
            dev.use = True
        sc.cycles.device = "GPU"
    except Exception as exc:  # CPU bake is fine, only slower
        print("[v002] GPU bake unavailable:", exc)
    mat = bpy.data.materials.new("BakeTmp")
    obj.data.materials.append(mat)
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    images = {}
    for kind in ("POS", "AO"):
        img = bpy.data.images.new("bake_" + kind, size, size, alpha=True, float_buffer=True)
        img.colorspace_settings.name = "Non-Color"
        node = nt.nodes.new("ShaderNodeTexImage")
        node.image = img
        nt.nodes.active = node
        if kind == "POS":
            coord = nt.nodes.new("ShaderNodeTexCoord")
            sub, mul = nt.nodes.new("ShaderNodeVectorMath"), nt.nodes.new("ShaderNodeVectorMath")
            emit = nt.nodes.new("ShaderNodeEmission")
            sub.operation, mul.operation = "SUBTRACT", "MULTIPLY"
            sub.inputs[1].default_value = lo.tolist()
            mul.inputs[1].default_value = (1 / span).tolist()
            nt.links.new(coord.outputs["Object"], sub.inputs[0])
            nt.links.new(sub.outputs[0], mul.inputs[0])
            nt.links.new(mul.outputs[0], emit.inputs["Color"])
            nt.links.new(emit.outputs[0], out.inputs["Surface"])
            sc.cycles.samples = 1
            bpy.ops.object.bake(type="EMIT", margin=16, use_clear=True)
        else:
            nt.links.new(nt.nodes.new("ShaderNodeBsdfDiffuse").outputs[0], out.inputs["Surface"])
            sc.world = sc.world or bpy.data.worlds.new("World")
            sc.world.light_settings.distance = 0.05
            sc.cycles.samples = 64
            bpy.ops.object.bake(type="AO", margin=16, use_clear=True)
        px = np.empty(size * size * 4, np.float32)
        img.pixels.foreach_get(px)
        images[kind] = px.reshape(size, size, 4)
        node.image = None
    obj.data.materials.clear()
    bpy.data.materials.remove(mat)
    pos = images["POS"][..., :3] * span + lo
    albedo = paint(pos, images["AO"][..., 0], images["POS"][..., 3] > 0)
    img = bpy.data.images.new("Pikachu_albedo", size, size, alpha=False)
    img.pixels.foreach_set(np.concatenate([albedo, np.ones((size, size, 1), np.float32)], 2).ravel())
    img.filepath_raw = str(work / "Pikachu_albedo.png")
    img.file_format = "PNG"
    img.save()
    img.pack()
    return img


def cover(dist, aa):
    """Anti-aliased coverage of a region whose signed distance is <0 inside."""
    return np.clip(0.5 - dist / aa, 0, 1)[..., None]


def paint(P, ao, valid):
    x, y, z = P[..., 0], P[..., 1], P[..., 2]
    up = np.clip((z - 0.05) / 0.55, 0, 1)[..., None]
    col = np.where(up < 0.45, SRGB["yellow_low"] + (SRGB["yellow"] - SRGB["yellow_low"]) * (up / 0.45),
                   SRGB["yellow"] + (SRGB["yellow_top"] - SRGB["yellow"]) * ((up - 0.45) / 0.55))
    col = col * (0.80 + 0.20 * np.clip(ao, 0, 1) ** 0.7)[..., None]

    def put(mask, rgb):
        nonlocal col
        col = col + (rgb - col) * mask

    # Tail and its brown root; back stripes.
    tail = cover(tail_sdf(x, y, z) - 0.006, 0.002)
    put(tail * cover(z - 0.245 + 0.04 * (-x - 0.2), 0.004), SRGB["brown"])
    for zc in (0.255, 0.185):
        put(cover((np.sqrt((y / 0.085) ** 2 + ((z - zc) / 0.017) ** 2) - 1) * 0.017, 0.0015) * (x < -0.03)[..., None] * (1 - tail),
            SRGB["brown"])
    # Ear tips.
    for s in (-1, 1):
        b, t = np.array(EAR_BASE) * (1, s, 1), np.array(EAR_TIP) * (1, s, 1)
        ax = t - b
        tt = ((P - b) @ ax) / (ax @ ax)
        near = (np.abs(y) > 0.06) & (z > 0.5)
        put(cover((0.64 - tt) * 0.29, 0.002) * near[..., None], SRGB["black"])
    # Face decals in head yaw/pitch degrees (radial projection from head centre).
    v = P - HEAD_C
    yaw = np.degrees(np.arctan2(v[..., 1], v[..., 0]))
    pitch = np.degrees(np.arctan2(v[..., 2], np.hypot(v[..., 0], v[..., 1])))
    face = ((z > 0.28) & (v[..., 0] > 0) & (np.linalg.norm(v, axis=-1) < 0.21))[..., None]
    aa = 0.35  # degrees, about one texel

    def ell(y0, p0, ry, rp):
        return (np.sqrt(((yaw - y0) / ry) ** 2 + ((pitch - p0) / rp) ** 2) - 1) * min(ry, rp)

    for s in (-1, 1):
        put(cover(ell(s * 54, -13, 12, 12), aa) * face, SRGB["cheek"])
        eye = cover(ell(s * 25, 7, 8, 11), aa) * face
        put(eye, SRGB["black"] + (SRGB["eye_low"] - SRGB["black"]) * np.clip((4 - pitch) / 8, 0, 1)[..., None])
        put(cover(ell(s * 23, 11.5, 3.3, 3.8), aa) * face, SRGB["white"])
    put(cover(ell(0, -3, 1.8, 1.2), aa) * face, SRGB["black"])
    mouth = np.array([(-7.5, -12.0), (-4.5, -15.4), (-1.6, -15.0), (0, -12.9), (1.6, -15.0), (4.5, -15.4), (7.5, -12.0)])
    dist = np.full(yaw.shape, 1e3, np.float32)
    for (y0, p0), (y1, p1) in zip(mouth, mouth[1:]):
        ex, ep = y1 - y0, p1 - p0
        t = np.clip(((yaw - y0) * ex + (pitch - p0) * ep) / (ex * ex + ep * ep), 0, 1)
        dist = np.minimum(dist, np.hypot(yaw - y0 - ex * t, pitch - p0 - ep * t))
    put(cover(dist - 0.6, aa) * face, SRGB["mouth"])
    col = np.where(valid[..., None], col, SRGB["yellow"])
    return np.clip(col, 0, 1).astype(np.float32)


# ---------------------------------------------------------------- materials
def toon_material(name, image=None, color=None, outline=False):
    mat = bpy.data.materials.new(name)
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(emit.outputs[0], out.inputs["Surface"])
    if outline:
        emit.inputs["Color"].default_value = (*color, 1)
        mat.use_backface_culling = True
        return mat
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = image
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    dot = nt.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = LIGHT
    nt.links.new(geo.outputs["Normal"], dot.inputs[0])
    band = nt.nodes.new("ShaderNodeMapRange")
    band.interpolation_type = "SMOOTHSTEP"
    band.inputs["From Min"].default_value, band.inputs["From Max"].default_value = 0.02, 0.10
    nt.links.new(dot.outputs["Value"], band.inputs["Value"])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    sock = lambda node, name, kind="inputs": next(s for s in getattr(node, kind) if s.name == name and s.type == "RGBA")
    sock(mix, "A").default_value = (0.66, 0.58, 0.76, 1)  # cool lilac shadow tint
    sock(mix, "B").default_value = (1, 1, 1, 1)
    nt.links.new(band.outputs["Result"], mix.inputs["Factor"])
    shade = nt.nodes.new("ShaderNodeVectorMath")
    shade.operation = "MULTIPLY"
    nt.links.new(tex.outputs["Color"], shade.inputs[0])
    nt.links.new(sock(mix, "Result", "outputs"), shade.inputs[1])
    # Thin warm rim on the lit side.
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    rim = nt.nodes.new("ShaderNodeMapRange")
    rim.interpolation_type = "SMOOTHSTEP"
    rim.inputs["From Min"].default_value, rim.inputs["From Max"].default_value = 0.62, 0.80
    rim.inputs["To Max"].default_value = 0.22
    nt.links.new(lw.outputs["Facing"], rim.inputs["Value"])
    rim_lit = nt.nodes.new("ShaderNodeMath")
    rim_lit.operation = "MULTIPLY"
    nt.links.new(rim.outputs["Result"], rim_lit.inputs[0])
    nt.links.new(band.outputs["Result"], rim_lit.inputs[1])
    add = nt.nodes.new("ShaderNodeVectorMath")
    add.operation = "ADD"
    nt.links.new(shade.outputs[0], add.inputs[0])
    nt.links.new(rim_lit.outputs[0], add.inputs[1])
    nt.links.new(add.outputs[0], emit.inputs["Color"])
    return mat


def export_material(name, image=None, color=None):
    mat = bpy.data.materials.new(name)
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = 1.0
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.0
    if image:
        tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = image
        mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = (*color, 1)
    return mat


# ---------------------------------------------------------------- rig
def bones():
    rows = [("root", (0, 0, 0), (0, 0, 0.06), None, False),
            ("pelvis", (0, 0, 0.12), (0, 0, 0.21), "root", True),
            ("chest", (0, 0, 0.21), (0, 0, 0.31), "pelvis", True),
            ("head", (0, 0, 0.31), (0, 0, 0.56), "chest", True),
            ("tail_base", (-0.07, 0, 0.13), (-0.165, 0, 0.215), "pelvis", True),
            ("tail_mid", (-0.165, 0, 0.215), (-0.22, 0, 0.33), "tail_base", True),
            ("tail_tip", (-0.22, 0, 0.33), (-0.31, 0, 0.48), "tail_mid", True)]
    for side, s in (("l", -1), ("r", 1)):
        m = lambda p: (p[0], s * p[1], p[2])
        rows += [("ear_" + side, m(EAR_BASE), m(EAR_MID), "head", True),
                 ("ear_tip_" + side, m(EAR_MID), m(EAR_TIP), "ear_" + side, True),
                 ("arm_" + side, m((0.03, 0.095, 0.285)), m((0.075, 0.11, 0.235)), "chest", True),
                 ("hand_" + side, m((0.075, 0.11, 0.235)), m((0.13, 0.10, 0.20)), "arm_" + side, True),
                 ("leg_" + side, m((-0.015, 0.08, 0.15)), m((0.0, 0.09, 0.08)), "pelvis", True),
                 ("shin_" + side, m((0.0, 0.09, 0.08)), m((0.02, 0.095, 0.035)), "leg_" + side, True),
                 ("foot_" + side, m((0.02, 0.095, 0.035)), m((0.125, 0.105, 0.02)), "shin_" + side, True),
                 ("cheek_fx_" + side, m((0.11, 0.13, 0.38)), m((0.14, 0.13, 0.38)), "head", False)]
    return rows


def build_rig(mesh_obj):
    arm = bpy.data.objects.new("Pikachu_Rig", bpy.data.armatures.new("Pikachu_Rig_v002"))
    bpy.context.scene.collection.objects.link(arm)
    activate(arm)
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.data.edit_bones
    for name, head, tail, parent, deform in bones():
        b = eb.new(name)
        b.head, b.tail, b.use_deform = head, tail, deform
        if parent:
            b.parent = eb[parent]
            b.use_connect = (Vector(eb[parent].tail) - Vector(head)).length < 1e-6
    bpy.ops.object.mode_set(mode="OBJECT")
    activate(arm, mesh_obj)
    mesh_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    # Every vertex needs an influence; heat weighting can miss isolated islands.
    groups = {g.index: g.name for g in mesh_obj.vertex_groups}
    unweighted = [v.index for v in mesh_obj.data.vertices if sum(g.weight for g in v.groups) < 1e-4]
    assert not unweighted, f"{len(unweighted)} vertices without bone weights"
    return arm, groups


def world_rot(pb, axis, deg):
    rest = pb.bone.matrix_local.to_quaternion()
    return Quaternion(rest.inverted() @ Vector(axis), math.radians(deg))


def world_loc(pb, offset):
    return pb.bone.matrix_local.to_quaternion().inverted() @ Vector(offset)


PITCH, ROLL, YAW = (0, 1, 0), (1, 0, 0), (0, 0, 1)  # +PITCH tips a down-pointing limb backward


def pose_idle(t, dur):
    p = 2 * math.pi * t / dur
    flick = math.exp(-((t - 1.25) / 0.07) ** 2)  # one quick ear twitch per loop
    return {
        "pelvis": ([(PITCH, 0)], (0, 0, 0.003 * (1 - math.cos(p)))),
        "chest": ([(PITCH, -2.0 * math.sin(p))], None),
        "head": ([(ROLL, 3.0 * math.sin(p + 0.5)), (YAW, 4.0 * math.sin(p)), (PITCH, -1.5 * math.sin(2 * p))], None),
        "ear_l": ([(ROLL, -3.0 * math.sin(p + 0.6))], None),
        "ear_r": ([(ROLL, 3.0 * math.sin(p + 0.6)), (PITCH, 16 * flick)], None),
        "ear_tip_r": ([(PITCH, -10 * math.exp(-((t - 1.33) / 0.08) ** 2))], None),
        "arm_l": ([(PITCH, 3 * math.sin(p))], None), "arm_r": ([(PITCH, 3 * math.sin(p))], None),
        "tail_base": ([(YAW, 6 * math.sin(p))], None),
        "tail_mid": ([(YAW, 5 * math.sin(p - 0.7))], None),
        "tail_tip": ([(YAW, 7 * math.sin(p - 1.4))], None),
    }


def pose_walk(t, dur):
    p = 2 * math.pi * t / dur
    pose = {
        "pelvis": ([(ROLL, 3.5 * math.sin(p)), (YAW, -5 * math.sin(p))], (0, 0, 0.012 * math.cos(2 * p))),
        "chest": ([(PITCH, 6), (YAW, 7 * math.sin(p))], None),
        "head": ([(PITCH, -4 + 2.5 * math.cos(2 * p - 0.6)), (ROLL, -2.5 * math.sin(p))], None),
        "tail_base": ([(YAW, 11 * math.sin(p - 0.4)), (PITCH, 3 * math.cos(2 * p))], None),
        "tail_mid": ([(YAW, 9 * math.sin(p - 1.1))], None),
        "tail_tip": ([(YAW, 12 * math.sin(p - 1.8))], None),
    }
    for side, off in (("l", 0.0), ("r", math.pi)):
        q = p + off
        swing = -28 * math.sin(q)                      # negative pitch = foot forward
        lift = max(0.0, math.cos(q))                   # swing phase: leg travelling forward
        pose["leg_" + side] = ([(PITCH, swing)], None)
        pose["shin_" + side] = ([(PITCH, 40 * lift ** 1.5)], None)
        pose["foot_" + side] = ([(PITCH, -swing - 40 * lift ** 1.5 + 10 * math.sin(q))], None)
        pose["arm_" + side] = ([(PITCH, 24 * math.sin(q))], None)
        sgn = -1 if side == "l" else 1
        pose["ear_" + side] = ([(PITCH, 5 * math.cos(2 * p - 1.0)), (ROLL, sgn * 3 * math.cos(2 * p - 1.2))], None)
        pose["ear_tip_" + side] = ([(PITCH, 6 * math.cos(2 * p - 1.8))], None)
    return pose


def bake_actions(arm):
    arm.animation_data_create()
    sc = bpy.context.scene
    sc.render.fps = FPS
    actions = []
    for name, dur, fn in (("Pikachu_Idle", 2.0, pose_idle), ("Pikachu_Walk", 0.8, pose_walk)):
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        arm.animation_data.action = act
        frames = round(dur * FPS)
        for f in range(frames + 1):
            pose = fn(f / FPS, dur)
            for pb in arm.pose.bones:
                pb.rotation_mode = "QUATERNION"
                rots, loc = pose.get(pb.name, ([], None))
                q = Quaternion()
                for axis, deg in rots:
                    q = q @ world_rot(pb, axis, deg)
                pb.rotation_quaternion = q
                pb.location = world_loc(pb, loc) if loc else Vector()
                pb.keyframe_insert("rotation_quaternion", frame=f)
                pb.keyframe_insert("location", frame=f)
        actions.append((act, frames))
    return actions


# ---------------------------------------------------------------- render
def setup_render(width, height):
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = width, height
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    if hasattr(sc.eevee, "taa_render_samples"):
        sc.eevee.taa_render_samples = 32
    sc.world = sc.world or bpy.data.worlds.new("World")
    sc.world.use_nodes = True
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.80, 0.79, 0.73, 1)
    cam = sc.camera or bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
    if not sc.camera:
        sc.collection.objects.link(cam)
        sc.camera = cam
    return cam


def shoot(cam, path, direction, target=(-0.08, 0, 0.39), ortho=1.02, persp_mm=None, dist=3.0):
    d = Vector(direction).normalized()
    cam.location = Vector(target) + d * dist
    cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    cam.data.type = "PERSP" if persp_mm else "ORTHO"
    cam.data.ortho_scale = ortho
    if persp_mm:
        cam.data.lens = persp_mm
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    return path


def read_png(path):
    img = bpy.data.images.load(str(path))
    w, h = img.size
    px = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(h, w, 4)


def sheet(paths, out):
    tiles = [read_png(p) for p in paths]
    img_arr = np.concatenate(tiles, axis=1)
    h, w = img_arr.shape[:2]
    img = bpy.data.images.new(out.stem, w, h, alpha=True)
    img.pixels.foreach_set(img_arr.ravel())
    img.filepath_raw, img.file_format = str(out), "PNG"
    img.save()
    bpy.data.images.remove(img)
    for p in paths:
        p.unlink()


def set_frame(arm, act, frame):
    arm.animation_data.action = act
    bpy.context.scene.frame_set(frame)


# ---------------------------------------------------------------- main
def main():
    args = argparse.ArgumentParser()
    args.add_argument("--output", type=Path, required=True)
    args.add_argument("--no-renders", action="store_true")
    opt = args.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    out = opt.output.resolve()
    out.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    t0 = time.time()

    body = sculpt_mesh(out)
    (out / "pikachu_sdf.vdb").unlink()
    arm, groups = build_rig(body)
    decimate(body)
    albedo = bake(body, out)
    body.data.materials.append(export_material("Pikachu_Body", image=albedo))
    body.data.materials.append(export_material("Pikachu_Outline", color=(0.05, 0.03, 0.02)))
    shell = body.modifiers.new("Outline", "SOLIDIFY")
    shell.thickness, shell.offset, shell.use_flip_normals, shell.material_offset = 0.0045, 1.0, True, 1
    shell.use_rim = False
    body.modifiers.move(body.modifiers.find("Outline"), 0)
    actions = bake_actions(arm)

    activate(arm, body)
    bpy.ops.export_scene.gltf(filepath=str(out / "Pikachu.glb"), export_format="GLB", use_selection=True,
                              export_yup=True, export_apply=True, export_animations=True,
                              export_animation_mode="ACTIONS", export_force_sampling=True, export_skins=True,
                              export_def_bones=False, export_materials="EXPORT", export_image_format="AUTO")

    # Swap to toon preview materials (the export ones stay in the .blend with fake users).
    for slot, mat in zip(body.material_slots, (toon_material("Pikachu_Toon", image=albedo),
                                               toon_material("Pikachu_Toon_Outline", color=(0.05, 0.03, 0.02), outline=True))):
        slot.material.use_fake_user = True
        slot.material = mat

    dg = bpy.context.evaluated_depsgraph_get()
    tris_body = sum(len(p.vertices) - 2 for p in body.data.polygons)
    eval_mesh = body.evaluated_get(dg).data
    bb = [[min(v.co[i] for v in body.data.vertices), max(v.co[i] for v in body.data.vertices)] for i in range(3)]
    report = {"id": "Pikachu_v002", "blender": bpy.app.version_string, "build_seconds": None,
              "triangles_body": tris_body, "triangles_with_outline_shell": sum(len(p.vertices) - 2 for p in eval_mesh.polygons),
              "vertices_body": len(body.data.vertices), "bones": [b.name for b in arm.data.bones],
              "deform_bones": sum(b.use_deform for b in arm.data.bones), "weighted_groups": sorted(groups.values()),
              "actions": [{"name": a.name, "frames": n + 1, "seconds": n / FPS, "loop": True} for a, n in actions],
              "bounds_m": bb, "dimensions_cm": [round((hi - lo) * 100, 2) for lo, hi in bb],
              "texture": "Pikachu_albedo.png 2048x2048 sRGB", "toon_light_model_space": list(LIGHT)}
    assert 0.74 < bb[2][1] < 0.82 and bb[2][0] > -0.001, "height/ground check"
    assert tris_body < 20000 and len(actions) == 2

    if not opt.no_renders:
        cam = setup_render(600, 800)
        idle, walk = actions[0][0], actions[1][0]
        set_frame(arm, idle, 0)
        views = [("front", (1, 0, 0.12)), ("three_quarter", (1, -0.85, 0.3)), ("side", (0, -1, 0.08)),
                 ("back_three_quarter", (-0.8, -0.75, 0.25))]
        sheet([shoot(cam, out / f"_t_{n}.png", d) for n, d in views], out / "Pikachu_v002_turnaround.png")
        setup_render(1200, 1200)
        shoot(cam, out / "Pikachu_v002_hero.png", (1, -0.9, 0.42), target=(-0.06, 0, 0.38), persp_mm=85, dist=2.6)
        setup_render(400, 520)
        tiles = []
        for i in range(6):
            set_frame(arm, walk, round(i * 24 / 6))
            tiles.append(shoot(cam, out / f"_w_{i}.png", (0.35, -1, 0.15), ortho=1.05))
        sheet(tiles, out / "Pikachu_v002_walk_sheet.png")
        tiles = []
        for i, f in enumerate((0, 15, 30, 38, 45)):
            set_frame(arm, idle, f)
            tiles.append(shoot(cam, out / f"_i_{i}.png", (1, -0.6, 0.2), ortho=1.05))
        sheet(tiles, out / "Pikachu_v002_idle_sheet.png")
        set_frame(arm, idle, 0)

    report["build_seconds"] = round(time.time() - t0, 1)
    (out / "build-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    bpy.ops.wm.save_as_mainfile(filepath=str(out / "Pikachu.blend"), compress=True)
    print("[v002] done", json.dumps({k: report[k] for k in ("triangles_body", "dimensions_cm", "build_seconds")}))


if __name__ == "__main__":
    main()
