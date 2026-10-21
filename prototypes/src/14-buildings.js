import './13-flora.js'; // first: the modules run in file-number order (see main.js)
import * as THREE from 'three';
import { V3, pick, rr } from './01-helpers.js';
import { I, SPREAD, VS } from './02-hero-camera.js';
import { BRIDGE, PLAZA_H, bridgeH, terrainH } from './05-paths-raised-plaza-stairs-tall-grass.js';
import { scene } from './06-renderer-scene-post.js';
import { add, houseTex, pcRoofTex, roofTex, sph, wallTex } from './07-materials-textures.js';
import { ASSETS, assetGroup } from './08-blender-assets.js';
import { boxes, circles, segs } from './12-batched-props.js';

// ============================================================ buildings
function pokeCenter() {
  const fl = I(70, 286, PLAZA_H), fr = I(460, 281, PLAZA_H);
  const W = Math.hypot(fr[0] - fl[0], fr[1] - fl[1]) / SPREAD, D = 4.3, H = 2.15; // traced width, before the spread
  const cx = (fl[0] + fr[0]) / 2, fz = (fl[1] + fr[1]) / 2, cz = fz - D / 2;
  const g = new THREE.Group(); g.position.set(cx, PLAZA_H, cz); scene.add(g);
  if (ASSETS) { g.add(assetGroup('pokecenter')); g.scale.x = W / 5.3; } else {
  const wallM = new THREE.MeshStandardMaterial({ map: houseTex, roughness: 0.92 });
  houseTex.repeat.set(2.5, 1.2);
  add(new THREE.BoxGeometry(W + 0.3, 0.14, D + 0.3), '#a59b89', g, 0, 0.07, 0);
  add(new THREE.BoxGeometry(W, H, D), 0, g, 0, 0.14 + H / 2, 0, { material: wallM });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.42, H, 0.42), '#b8ab94', g, sx * (W / 2 - 0.12), 0.14 + H / 2, sz * (D / 2 - 0.12));
  add(new THREE.BoxGeometry(W + 0.24, 0.2, D + 0.24), '#f5f1e8', g, 0, H + 0.24, 0);
  const rt = pcRoofTex.clone(); rt.needsUpdate = true; rt.repeat.set(9, 3);
  const roofM = new THREE.MeshStandardMaterial({ map: rt, roughness: 0.6 });
  add(new THREE.SphereGeometry(1, 48, 18, 0, Math.PI * 2, 0, Math.PI / 2), 0, g, 0, H + 0.33, 0, { s: [W / 2 + 0.1, 1.55, D / 2 + 0.1], material: roofM });
  add(new THREE.TorusGeometry(1, 0.04, 6, 48), '#f5f1e8', g, 0, H + 0.34, 0, { r: [Math.PI / 2, 0, 0], s: [W / 2 + 0.12, D / 2 + 0.12, 1] });
  // front hood with the emblem
  const hood = new THREE.CylinderGeometry(1.05, 1.05, 1.1, 32, 1, false, -Math.PI / 2, Math.PI); hood.rotateX(-Math.PI / 2);
  const ht = pcRoofTex.clone(); ht.needsUpdate = true; ht.repeat.set(3, 1);
  add(hood, 0, g, 0, H + 0.33, D / 2 - 0.05, { material: new THREE.MeshStandardMaterial({ map: ht, roughness: 0.6 }) });
  const fz2 = D / 2 + 0.52;
  add(new THREE.CircleGeometry(1.05, 32, 0, Math.PI), '#e14836', g, 0, H + 0.33, fz2 - 0.01, { shadow: false });
  add(new THREE.TorusGeometry(1.05, 0.08, 8, 32, Math.PI), '#f5f1e8', g, 0, H + 0.33, fz2);
  add(new THREE.CircleGeometry(0.52, 32), '#ffffff', g, 0, H + 0.82, fz2 + 0.02, { shadow: false });
  add(new THREE.TorusGeometry(0.37, 0.085, 10, 32), '#e2473b', g, 0, H + 0.82, fz2 + 0.05);
  add(new THREE.CircleGeometry(0.16, 24), '#ffffff', g, 0, H + 0.82, fz2 + 0.07, { shadow: false });
  add(new THREE.TorusGeometry(0.16, 0.035, 8, 24), '#666', g, 0, H + 0.82, fz2 + 0.075);
  // glass door
  const dw = W * 0.3;
  add(new THREE.BoxGeometry(dw + 0.24, 1.95, 0.16), '#f5f1e8', g, 0, 1.11, D / 2 + 0.03);
  add(new THREE.PlaneGeometry(dw, 1.78), '#8fe9ff', g, 0, 1.03, D / 2 + 0.12, { mat: { emissive: '#36c6ff', emissiveIntensity: 1.25, roughness: 0.15 }, shadow: false });
  add(new THREE.BoxGeometry(0.04, 1.78, 0.03), '#dff8ff', g, 0, 1.03, D / 2 + 0.13, { shadow: false });
  add(new THREE.BoxGeometry(dw * 0.3, 0.05, 0.03), '#bff2ff', g, -dw * 0.25, 1.1, D / 2 + 0.13, { shadow: false, mat: { emissive: '#ffffff', emissiveIntensity: 0.6 } });
  add(new THREE.BoxGeometry(dw + 0.5, 0.08, 0.3), '#c9a774', g, 0, 0.18, D / 2 + 0.2);
  for (const sx of [-1, 1]) {
    const wx = sx * W * 0.31;
    add(new THREE.BoxGeometry(W * 0.27, 1.25, 0.12), '#6d4527', g, wx, 1.22, D / 2 + 0.02);
    add(new THREE.PlaneGeometry(W * 0.24, 1.07), '#ffe9b0', g, wx, 1.22, D / 2 + 0.09, { mat: { emissive: '#ffc35a', emissiveIntensity: 0.75 }, shadow: false });
    for (const k of [-1, 0, 1]) add(new THREE.BoxGeometry(0.04, 1.07, 0.03), '#6d4527', g, wx + k * W * 0.08, 1.22, D / 2 + 0.1, { shadow: false });
    add(new THREE.BoxGeometry(W * 0.24, 0.04, 0.03), '#6d4527', g, wx, 1.45, D / 2 + 0.1, { shadow: false });
    add(new THREE.PlaneGeometry(1.4, 1.0), '#ffe9b0', g, sx * (W / 2 + 0.01), 1.25, 0.4, { r: [0, sx * Math.PI / 2, 0], mat: { emissive: '#ffc35a', emissiveIntensity: 0.5 }, shadow: false });
    add(new THREE.BoxGeometry(0.16, 0.26, 0.16), '#fff1c0', g, sx * (dw / 2 + 0.32), 1.62, D / 2 + 0.16, { mat: { emissive: '#ffc35a', emissiveIntensity: 2.4 }, shadow: false });
    add(new THREE.BoxGeometry(0.2, 0.05, 0.2), '#2a2e33', g, sx * (dw / 2 + 0.32), 1.77, D / 2 + 0.16);
  }
  }
  boxes.push({ x0: cx - W / 2 - 0.15, x1: cx + W / 2 + 0.15, z0: cz - D / 2 - 0.15, z1: cz + D / 2 + 0.15 });
  return { cx, cz, fz, W, D };
}
function cottage(cx, cz, rot, o = {}) {
  const y = o.y ?? terrainH(cx, cz), g = new THREE.Group(); g.position.set(cx, y, cz); g.rotation.y = rot; scene.add(g);
  const W = o.w || 2.9, D = o.d || 3.4, H = o.h || 1.95, RH = o.rh || 1.45;
  if (ASSETS) { g.add(assetGroup('cottage', { roof: o.roof, shutter: o.shutter || '#3f7d3c' })); g.scale.set(W / 2.9, H / 1.95, D / 3.4); } else {
  add(new THREE.BoxGeometry(W + 0.24, 0.16, D + 0.24), '#a59b89', g, 0, 0.08, 0);
  const ht = houseTex.clone(); ht.needsUpdate = true; ht.repeat.set(W / 2.2, H / 2.2);
  const wm = new THREE.MeshStandardMaterial({ map: ht, roughness: 0.92 });
  add(new THREE.BoxGeometry(W, H, D), 0, g, 0, 0.16 + H / 2, 0, { material: wm });
  const tri = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, RH)]);
  const gt = houseTex.clone(); gt.needsUpdate = true; gt.repeat.set(0.4, 0.4);
  for (const s of [-1, 1]) add(new THREE.ShapeGeometry(tri), 0, g, 0, 0.16 + H, s * D / 2, { r: [0, s < 0 ? Math.PI : 0, 0], material: new THREE.MeshStandardMaterial({ map: gt, roughness: 0.92 }) });
  const half = W / 2 + 0.28, slant = Math.hypot(half, RH + 0.2), ang = Math.atan2(RH + 0.2, half);
  const rt = roofTex.clone(); rt.needsUpdate = true; rt.repeat.set(1.6, 2.2);
  const rm = new THREE.MeshStandardMaterial({ map: rt, color: o.roof || '#ffffff', roughness: 0.65 });
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(slant, 0.16, D + 0.5), 0, g, s * half / 2, 0.16 + H + RH / 2 - 0.02, 0, { r: [0, 0, -s * ang], material: rm });
  add(new THREE.CylinderGeometry(0.1, 0.1, D + 0.55, 10), o.ridge || '#9b3f22', g, 0, 0.16 + H + RH + 0.08, 0, { r: [Math.PI / 2, 0, 0] });
  if (o.chimney !== false) add(new THREE.BoxGeometry(0.45, 1.2, 0.45), 0, g, W / 4, 0.16 + H + RH * 0.6, -D / 5, { material: new THREE.MeshStandardMaterial({ map: wallTex }) });
  // arched door
  add(new THREE.BoxGeometry(0.72, 1.15, 0.1), '#7e4e2b', g, 0, 0.74, D / 2 + 0.03);
  add(new THREE.CylinderGeometry(0.36, 0.36, 0.1, 18, 1, false, -Math.PI / 2, Math.PI), '#7e4e2b', g, 0, 1.31, D / 2 + 0.03, { r: [-Math.PI / 2, 0, 0] });
  add(new THREE.TorusGeometry(0.4, 0.05, 6, 18, Math.PI), '#b8ab94', g, 0, 1.31, D / 2 + 0.06);
  sph(0.035, '#e8c35a', g, 0.22, 0.8, D / 2 + 0.1);
  // round gable window
  add(new THREE.CircleGeometry(0.24, 20), '#ffe7b0', g, 0, 0.16 + H + RH * 0.38, D / 2 + 0.02, { mat: { emissive: '#ffc35a', emissiveIntensity: 0.7 }, shadow: false });
  add(new THREE.TorusGeometry(0.25, 0.045, 6, 20), '#6d4527', g, 0, 0.16 + H + RH * 0.38, D / 2 + 0.04);
  const win = (x, zf, side) => {
    const gg = new THREE.Group(); gg.position.set(x, 1.18, zf); gg.rotation.y = side; g.add(gg);
    add(new THREE.PlaneGeometry(0.52, 0.66), '#ffe6ad', gg, 0, 0, 0.01, { mat: { emissive: '#ffbe55', emissiveIntensity: 0.7 }, shadow: false });
    add(new THREE.BoxGeometry(0.6, 0.05, 0.05), '#f2efe6', gg, 0, 0, 0.03, { shadow: false });
    add(new THREE.BoxGeometry(0.05, 0.7, 0.05), '#f2efe6', gg, 0, 0, 0.03, { shadow: false });
    for (const k of [-1, 1]) add(new THREE.BoxGeometry(0.22, 0.72, 0.05), o.shutter || '#3f7d3c', gg, k * 0.38, 0, 0.04);
    add(new THREE.BoxGeometry(0.66, 0.14, 0.2), '#8a5a32', gg, 0, -0.42, 0.1);
    for (let i = 0; i < 6; i++) sph(0.07, pick(['#ff6f8f', '#ffd23f', '#ffffff', '#ff8a3d']), gg, -0.25 + i * 0.1, -0.31, 0.14, 1, 1, 1, { shadow: false });
  };
  win(W * 0.3, D / 2 + 0.01, 0);
  for (const zz of [-D * 0.22, D * 0.22]) win(-W / 2 - 0.01, zz, -Math.PI / 2);
  win(W / 2 + 0.01, 0, Math.PI / 2);
  }
  const c = Math.abs(Math.cos(rot)), sn = Math.abs(Math.sin(rot));
  const hx = (W / 2 + 0.15) * c + (D / 2 + 0.15) * sn, hz = (D / 2 + 0.15) * c + (W / 2 + 0.15) * sn;
  boxes.push({ x0: cx - hx * 0.92, x1: cx + hx * 0.92, z0: cz - hz * 0.92, z1: cz + hz * 0.92 });
  return { door: [cx + Math.sin(rot) * (D / 2 + 0.5), cz + Math.cos(rot) * (D / 2 + 0.5)] };
}
const PC = pokeCenter();
const CF = I(980, 222, PLAZA_H);
const COT = cottage(CF[0] - Math.sin(0.5) * 1.7, CF[1] - Math.cos(0.5) * 1.7, 0.5, { y: PLAZA_H });
{ const p = I(500, 30, PLAZA_H); cottage(p[0], p[1] - 1.8, 0, { y: PLAZA_H, w: 2.6, d: 2.8, roof: '#c7d5ff', shutter: '#3d5f8d', ridge: '#566b9a' }); }
{ const p = I(20, 320, PLAZA_H); cottage(p[0] - 1.2, p[1], Math.PI / 2, { y: PLAZA_H, w: 2.8, d: 3.2, shutter: '#7a3d3d' }); }
{ const p = I(980, 20, PLAZA_H); cottage(p[0] - 1, p[1] - 2.5, 0.25, { y: PLAZA_H, w: 2.6, d: 3, roof: '#ffe0c8' }); }
cottage(VS(-15), VS(-12), 0.1, { y: PLAZA_H, w: 3, d: 3.2, shutter: '#4a6d3a' });
cottage(17, -13, -0.4, { w: 3.2, d: 3.4, roof: '#ffd9c0' });

// bridge
{
  const B = BRIDGE, g = new THREE.Group(); g.position.set(B.ax, 0, B.az); g.rotation.y = -Math.atan2(B.uz, B.ux); scene.add(g);
  if (ASSETS) { g.add(assetGroup('bridge')); g.scale.x = B.len / 5.1; } else {
  const wood = ['#a8774a', '#9a6a3f', '#b4835a', '#946238', '#a0703f'];
  for (let x = 0.1; x < B.len; x += 0.25) {
    const y = bridgeH(x), dy = (bridgeH(x + 0.05) - bridgeH(x - 0.05)) / 0.1;
    add(new THREE.BoxGeometry(0.23, 0.07, B.w + rr(-0.06, 0.06)), pick(wood), g, x, y, rr(-0.03, 0.03), { r: [0, rr(-0.02, 0.02), Math.atan(dy)] });
  }
  for (const z of [-B.w / 2 + 0.15, B.w / 2 - 0.15]) for (let x = 0; x < B.len; x += 0.5) {
    const y = bridgeH(x + 0.25) - 0.13, dy = (bridgeH(x + 0.3) - bridgeH(x + 0.2)) / 0.1;
    add(new THREE.BoxGeometry(0.52, 0.16, 0.14), '#6b4627', g, x + 0.25, y, z, { r: [0, 0, Math.atan(dy)] });
  }
  const posts = [0.12, B.len / 2, B.len - 0.12];
  for (const z of [-B.w / 2 + 0.05, B.w / 2 - 0.05]) {
    for (const x of posts) {
      const top = bridgeH(x) + 0.78, bot = x === posts[1] ? bridgeH(x) - 0.2 : -0.4;
      add(new THREE.CylinderGeometry(0.075, 0.08, top - bot, 10), '#86592f', g, x, (top + bot) / 2, z);
      add(new THREE.CylinderGeometry(0.095, 0.095, 0.06, 10), '#6b4624', g, x, top + 0.03, z);
    }
    for (const h of [0.72, 0.42]) for (let i = 0; i < 2; i++) {
      const a = posts[i], b = posts[i + 1], pts = [];
      for (let k = 0; k <= 12; k++) { const x = a + (b - a) * k / 12; pts.push(new V3(x, bridgeH(x) + h - Math.sin(Math.PI * k / 12) * 0.1, z)); }
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.022, 6), '#efe2c2', g, 0, 0, 0, { shadow: false });
    }
  }
  }
  const wpt = (lx, lz) => [B.ax + B.ux * lx + B.nx * lz, B.az + B.uz * lx + B.nz * lz];
  for (const s of [-1, 1]) segs.push([...wpt(0, s * (B.w / 2 - 0.02)), ...wpt(B.len, s * (B.w / 2 - 0.02))]);
}

// signs
function pcSign(x, z, y, rot) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; scene.add(g);
  circles.push({ x, z, r: 0.35 });
  if (ASSETS) return g.add(assetGroup('sign'));
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.08, 0.95, 0.08), '#6f4b2c', g, s * 0.36, 0.47, 0);
  add(new THREE.BoxGeometry(0.92, 0.66, 0.08), '#86592f', g, 0, 0.82, 0);
  add(new THREE.PlaneGeometry(0.78, 0.52), '#f5ead0', g, 0, 0.82, 0.045, { shadow: false });
  add(new THREE.CircleGeometry(0.13, 24, 0, Math.PI), '#e2473b', g, 0, 0.94, 0.05, { shadow: false });
  add(new THREE.CircleGeometry(0.13, 24, Math.PI, Math.PI), '#ffffff', g, 0, 0.94, 0.05, { shadow: false });
  add(new THREE.RingGeometry(0.12, 0.145, 24), '#333', g, 0, 0.94, 0.052, { shadow: false });
  for (let i = 0; i < 3; i++) add(new THREE.PlaneGeometry(0.55 - i * 0.1, 0.03), '#8f8170', g, 0, 0.75 - i * 0.07, 0.05, { shadow: false });
}
const SIGN = I(470, 268, PLAZA_H);
pcSign(SIGN[0], SIGN[1], PLAZA_H, 0.25);
const POST = I(1108, 388, 0.3);
{
  const [x, z] = POST, y = terrainH(x, z), g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
  if (ASSETS) g.add(assetGroup('signpost')); else {
  add(new THREE.BoxGeometry(0.12, 1.7, 0.12), '#6f4b2c', g, 0, 0.85, 0);
  const arrow = new THREE.Shape([new THREE.Vector2(-0.45, -0.12), new THREE.Vector2(0.32, -0.12), new THREE.Vector2(0.5, 0), new THREE.Vector2(0.32, 0.12), new THREE.Vector2(-0.45, 0.12)]);
  const ag = new THREE.ExtrudeGeometry(arrow, { depth: 0.05, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1 });
  add(ag, '#cfa874', g, 0.3, 1.45, 0, { r: [0, 0.5, 0] });
  add(ag, '#c49c69', g, -0.28, 1.12, 0.05, { r: [0, Math.PI - 0.6, 0] });
  }
  circles.push({ x, z, r: 0.2 });
}
const BENCH = I(742, 192, PLAZA_H), BENCH_ROT = -0.75;
{
  const g = new THREE.Group(); g.position.set(BENCH[0], PLAZA_H, BENCH[1]); g.rotation.y = BENCH_ROT; scene.add(g);
  if (ASSETS) g.add(assetGroup('bench')); else {
  for (const z of [-0.12, 0, 0.12]) add(new THREE.BoxGeometry(1.5, 0.05, 0.1), '#9c6a3f', g, 0, 0.45, z);
  for (const y of [0.62, 0.78]) add(new THREE.BoxGeometry(1.5, 0.1, 0.04), '#9c6a3f', g, 0, y, -0.2, { r: [-0.15, 0, 0] });
  for (const s of [-1, 1]) { add(new THREE.BoxGeometry(0.06, 0.45, 0.36), '#2f2f2f', g, s * 0.66, 0.22, 0); add(new THREE.BoxGeometry(0.06, 0.4, 0.06), '#2f2f2f', g, s * 0.66, 0.65, -0.21); }
  }
  const c = Math.cos(BENCH_ROT), s = Math.sin(BENCH_ROT);
  segs.push([BENCH[0] - c * 0.75, BENCH[1] + s * 0.75, BENCH[0] + c * 0.75, BENCH[1] - s * 0.75]);
}

export { BENCH, BENCH_ROT, COT, PC, POST, SIGN };
