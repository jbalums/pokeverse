import './15-hand-placement.js'; // first: the modules run in file-number order (see main.js)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash2, pick, rnd, rr, seed, setSeed, smooth } from './01-helpers.js';
import { K, KX, K_DIRT, K_FIELDS, K_FOUNT, K_PLAZA_R, K_WALK, ROOM_X, inKField, inRect, kDirt, kPaved, kRect, kalosH } from './03-fleurville-map.js';
import { TX, terrainH } from './05-paths-raised-plaza-stairs-tall-grass.js';
import { scene } from './06-renderer-scene-post.js';
import { SPH, add, canvasTex, cobbleTex, houseTex, roofTex, sph, stones, tileTex, wallTex } from './07-materials-textures.js';
import { ASSETS, CHUNK, assetGroup, flushInstances, leafMat } from './08-blender-assets.js';
import { groundMat } from './09-terrain.js';
import { BOX, CYL, LEAF_BALLS, addB, batches, boxes, circles, foliageColor, segs, trees } from './12-batched-props.js';
import { FLORA_MODELS, KIT_SPECIES, TREE_KIT, bush, fence, fillTree, kitTree, lamp } from './13-flora.js';
import { say } from './26-key-bindings.js';
import { bag, healParty } from './28-evolution-data.js';
import { openShop } from './31-poke-mart.js';

// ============================================================ Fleurville Town: ground, buildings, gardens, walls, trees
// (built here so its trees, hedges and street furniture join the batched draw calls below; the random seed is restored
//  afterwards so Verdant Town's grass and flowers stay where they were)
const VERDANT_SEED = seed;
const kBoxes = [], KDOORS = [], KAL = { started: false, busy: false, blades: null, spray: null, gift: false };
const KFADE = []; // buildings that turn see-through while the player walks behind them (the camera looks north)
function kFade(g, r) {
  g.traverse(o => {
    if (!o.isMesh) return;
    const ms = [o.material].flat().map(m => { const c = m.clone(); c.userData.o = { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite }; return c; });
    o.material = Array.isArray(o.material) ? ms : ms[0];
  });
  KFADE.push({ g, r, op: 1 });
}
const kBox = (r, pad = 0.1) => { kBoxes.push(r); boxes.push({ x0: r[0] - pad, x1: r[2] + pad, z0: r[1] - pad, z1: r[3] + pad }); };
const paveTex = canvasTex(512, 512, (c, w, h) => stones(c, w, h, 16, 26, 52, ['#cfa58e', '#c49983', '#d8b39c', '#bb8f79', '#cba08a', '#d2ac96'], '#8d6b5c', 5));
const greenRoofTex = tileTex(['#3f7d4a', '#457f50', '#38704a', '#4a8a55', '#3a7648'], '#1f4a2c', 'rgba(220,255,220,.22)');
const blueRoofTex = tileTex(['#3f6fb8', '#4878c0', '#3866ad', '#5282c8', '#3a6bb2'], '#1d3766', 'rgba(220,235,255,.25)');
const stripeTex = canvasTex(128, 32, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#fdf7ee' : '#d8423a'; c.fillRect(i * w / 8, 0, w / 8, h); } });
const signTex = (text, bg = '#2f5a3a', fg = '#f6e7b0') => canvasTex(512, 96, (c, w, h) => {
  c.fillStyle = bg; c.fillRect(0, 0, w, h); c.strokeStyle = fg; c.lineWidth = 6; c.strokeRect(9, 9, w - 18, h - 18);
  c.fillStyle = fg; c.font = 'bold 52px Nunito, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + 3, w - 44);
});
const texMat = (tex, rx, ry, o = {}) => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.75, ...o }); };
const KMAT = { wall: new THREE.MeshStandardMaterial({ color: '#f4eee2', roughness: 0.9, side: THREE.DoubleSide }),
  glass: new THREE.MeshStandardMaterial({ color: '#cdeedc', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide }) };
let kGround;
{
  const x0 = KX - 30, x1 = KX + 30, z0 = -24, z1 = 26, R = 0.15, SX = Math.round((x1 - x0) / R), SZ = Math.round((z1 - z0) / R);
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, SX, SZ); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const p = g.attributes.position, n = p.count, cols = new Float32Array(n * 3), cob = new Float32Array(n), c = new THREE.Color(), C = s => new THREE.Color(s);
  const grassA = C('#7cb843'), grassB = C('#62a235'), grassC = C('#a2cf55'), dirtA = C('#d6ad74'), dirtB = C('#e5c48f'), soilA = C('#8a7a3c'), soilB = C('#a2944a');
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), z = p.getZ(i), hv = hash2(x, z); p.setY(i, kalosH(x, z));
    if (kPaved(x, z)) { cob[i] = 1; c.set('#d8b8a2'); }
    else if (kDirt(x, z)) c.copy(dirtA).lerp(dirtB, hv * 0.5);
    else if (inKField(x, z)) c.copy(soilA).lerp(soilB, hv);
    else { const big = Math.sin(x * 0.55 + Math.cos(z * 0.4)) * Math.cos(z * 0.47 - x * 0.2); c.copy(grassA).lerp(grassB, smooth(-0.5, 0.7, big)).lerp(grassC, smooth(0.2, 1, -big) * 0.55 + hv * 0.12); }
    c.multiplyScalar(0.94 + hv * 0.1); cols.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.setAttribute('aCob', new THREE.BufferAttribute(cob, 1)); g.computeVertexNormals();
  kGround = new THREE.Mesh(g, groundMat(paveTex)); kGround.receiveShadow = true; scene.add(kGround);
  // the fountain plaza: grey flagstones inside a darker border, with an inner ring around the basin
  const flat = { r: [-Math.PI / 2, 0, 0], shadow: false };
  add(new THREE.CircleGeometry(K_PLAZA_R, 56), 0, scene, K_FOUNT[0], 0.04, K_FOUNT[1], { ...flat, material: texMat(cobbleTex, 2.6, 2.6, { roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1 }) });
  for (const [a, b, col] of [[K_PLAZA_R - 0.28, K_PLAZA_R, '#8e8a80'], [2.05, 2.25, '#a39d90']]) add(new THREE.RingGeometry(a, b, 56), col, scene, K_FOUNT[0], 0.045, K_FOUNT[1], { ...flat, mat: { polygonOffset: true, polygonOffsetFactor: -2 } });
  circles.push({ x: K_FOUNT[0], z: K_FOUNT[1], r: 1.75 });
}
function gable(g, W, D, y, RH, roof, gableMat) { // pitched roof, ridge along local x
  const half = D / 2 + 0.28, slant = Math.hypot(half, RH), ang = Math.atan2(RH, half);
  for (const s of [-1, 1]) add(BOX, 0, g, 0, y + RH / 2, s * half / 2, { s: [W + 0.36, 0.12, slant], r: [s * ang, 0, 0], material: roof });
  const tri = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, RH * 0.97)]));
  for (const s of [-1, 1]) add(tri, 0, g, s * W / 2, y, 0, { r: [0, s * Math.PI / 2, 0], material: gableMat });
  add(CYL, '#e8e0cc', g, 0, y + RH + 0.05, 0, { s: [0.07, W + 0.42, 0.07], r: [0, 0, Math.PI / 2] });
}
function hipRoof(w, d, h) { // four-sided roof, ridge along x; uv projected from above so tile textures run down the slopes
  const a = w / 2, b = d / 2, r = Math.max(0, a - b), P = [[-a, 0, b], [a, 0, b], [a, 0, -b], [-a, 0, -b]], R0 = [-r, h, 0], R1 = [r, h, 0];
  const tris = [P[0], P[1], R1, P[0], R1, R0, P[2], P[3], R0, P[2], R0, R1, P[1], P[2], R1, P[3], P[0], R0];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(tris.flatMap(([x, , z]) => [x * 0.45, z * 0.45]), 2));
  g.computeVertexNormals(); return g;
}
function kWin(g, x, y, z, w = 0.55, h = 0.75, frame = '#2f5a3a', ry = 0) {
  const gg = new THREE.Group(); gg.position.set(x, y, z); gg.rotation.y = ry; g.add(gg);
  add(BOX, frame, gg, 0, 0, 0, { s: [w + 0.12, h + 0.12, 0.06] });
  add(new THREE.PlaneGeometry(w, h), '#ffe6ad', gg, 0, 0, 0.035, { mat: { emissive: '#ffbe55', emissiveIntensity: 0.55 }, shadow: false });
  add(BOX, frame, gg, 0, 0, 0.045, { s: [0.04, h, 0.02], shadow: false }); add(BOX, frame, gg, 0, h * 0.12, 0.045, { s: [w, 0.04, 0.02], shadow: false });
}
function kDoor(g, x, z, w = 0.8, h = 1.4, color = '#2f5a3a', ry = 0, y = 0.14) {
  const gg = new THREE.Group(); gg.position.set(x, y, z); gg.rotation.y = ry; g.add(gg);
  add(BOX, '#e8e0cc', gg, 0, h / 2 + 0.04, 0, { s: [w + 0.2, h + 0.12, 0.08] });
  add(BOX, color, gg, 0, h / 2, 0.03, { s: [w, h, 0.06] });
  add(new THREE.PlaneGeometry(w * 0.66, h * 0.36), '#cdeeff', gg, 0, h * 0.7, 0.065, { mat: { emissive: '#ffd27a', emissiveIntensity: 0.4, roughness: 0.2 }, shadow: false });
  sph(0.035, '#e8c35a', gg, w * 0.32, h * 0.46, 0.08);
}
// a street shop on a traced px rect, facing south (+z) onto the road; returns nothing, registers its door
function kShop(r, o = {}) {
  const [x0, z0, x1, z1] = kRect(...r), W = x1 - x0, D = z1 - z0, H = o.h || 2.4, RH = o.rh || 1.25, trim = o.trim || '#2f5a3a';
  const g = new THREE.Group(); g.position.set((x0 + x1) / 2, 0.03, (z0 + z1) / 2); scene.add(g);
  add(BOX, '#b9b09c', g, 0, 0.07, 0, { s: [W + 0.2, 0.14, D + 0.2] });
  add(BOX, 0, g, 0, 0.14 + H / 2, 0, { s: [W, H, D], material: KMAT.wall });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(BOX, trim, g, sx * (W / 2 - 0.05), 0.14 + H / 2, sz * (D / 2 - 0.05), { s: [0.16, H, 0.16] });
  add(BOX, trim, g, 0, 0.14 + H, 0, { s: [W + 0.1, 0.12, D + 0.1] });
  const roof = texMat(o.roofTex || greenRoofTex, (o.ridgeZ ? D : W) / 1.6, 1.4, { roughness: 0.65 });
  const rg = new THREE.Group(); g.add(rg);
  if (o.ridgeZ) { rg.rotation.y = Math.PI / 2; gable(rg, D, W, 0.2 + H, RH, roof, KMAT.wall); } else gable(rg, W, D, 0.2 + H, RH, roof, KMAT.wall);
  const fz = D / 2 + 0.01, dx = o.doorX ?? 0;
  kDoor(g, dx, fz, 0.8, 1.45, trim);
  for (let x = -W / 2 + 0.75; x < W / 2 - 0.5; x += 1.15) if (Math.abs(x - dx) > 0.85) kWin(g, x, 1.0, fz, 0.8, 0.95, trim);
  if (o.sign) add(new THREE.PlaneGeometry(Math.min(W - 0.4, 2.6), Math.min(W - 0.4, 2.6) * 0.19), 0, g, 0, 0.14 + H - 0.42, fz + 0.03,
    { shadow: false, material: new THREE.MeshStandardMaterial({ map: signTex(o.sign, o.signBg, o.signFg), roughness: 0.6 }) });
  if (o.awning) { // striped canvas awning over the shop windows
    const aw = W * 0.86, am = texMat(stripeTex, aw / 0.9, 1, { roughness: 0.8, side: THREE.DoubleSide });
    add(BOX, 0, g, 0, 1.72, fz + 0.4, { s: [aw, 0.035, 0.88], r: [0.42, 0, 0], material: am });
    add(BOX, 0, g, 0, 1.47, fz + 0.81, { s: [aw, 0.17, 0.03], material: am });
  }
  if (!o.noBox) kBox([x0, z0, x1, z1]);
  kFade(g, [x0, z0, x1, z1]);
  if (o.room) linkRoom(room(o.room), g.position.x + dx, z1 + 0.45);
  else if (o.door) KDOORS.push({ x: g.position.x + dx, z: z1 + 0.45, name: o.sign || 'Door', lines: o.door });
  return g;
}
// ------------------------------------------------------------ interiors
// Every room is built 40 m apart east of x = 600 (far beyond the town and the camera's far plane), on a dark floor so
// nothing but the room shows. Walking into a door fades the player inside; walking back out over the doormat returns them.
const ROOMS = [], RNPC = [], ROOM_BG = new THREE.Color('#1b1714');
const roomAt = (x, z) => x > ROOM_X - 40 ? ROOMS.find(r => inRect(x, z, r.rect, 1.5)) || null : null;
const RB = (x, y, z, sx, sy, sz, col, geo = BOX) => addB('wood', geo, col, [x, y, z], [0, 0, 0], [sx, sy, sz]);
const solid = (x, z, w, d) => boxes.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
const FLOORS = {
  wood: canvasTex(256, 256, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = pick(['#a8774a', '#9a6a3f', '#b4835a', '#946238', '#a06f45']); c.fillRect(0, i * h / 8, w, h / 8 - 3); c.fillStyle = 'rgba(60,35,15,.45)'; c.fillRect(rnd() * w, i * h / 8, 3, h / 8); } }),
  tile: canvasTex(256, 256, (c, w, h) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.fillStyle = (i + j) % 2 ? '#f4f1ea' : '#cfdbe9'; c.fillRect(i * 32 + 1, j * 32 + 1, 30, 30); } }),
  check: canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#bbb'; c.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.fillStyle = (i + j) % 2 ? '#f2eee4' : '#3c3a38'; c.fillRect(i * 32 + 1, j * 32 + 1, 30, 30); } }),
};
const PAINT = ['#7fb2e6', '#e8a33a', '#b48cff'].map(sky => canvasTex(128, 96, (c, w, h) => { // little landscapes for the walls
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, sky); g.addColorStop(1, '#fff6dc'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = '#ffe9a0'; c.beginPath(); c.arc(w * 0.75, h * 0.3, 10, 0, 7); c.fill();
  for (const [y, col] of [[0.62, '#6fa84a'], [0.75, '#4d8a36']]) { c.fillStyle = col; c.beginPath(); c.moveTo(0, h); for (let x = 0; x <= w; x += 8) c.lineTo(x, h * y + Math.sin(x * 0.08 + y * 9) * 7); c.lineTo(w, h); c.fill(); }
}));
function shelf(x, z, w, items, o = {}) { // shelving unit, back to a wall; `side` turns it to stand against the left (1) or right (-1) wall
  const h = o.h || 1.8, d = 0.45, s = o.side || 0, [sx, sz] = s ? [d, w] : [w, d];
  RB(x, h / 2, z, sx, h, sz, o.col || '#7a5230'); solid(x, z, sx, sz);
  for (let k = 0; k < (o.rows || 3); k++) for (let t = -w / 2 + 0.18; t < w / 2 - 0.1; t += o.step || 0.24) {
    const y = 0.35 + k * (h - 0.4) / (o.rows || 3), iw = o.thin ? 0.08 : 0.17, ih = o.thin ? rr(0.22, 0.32) : rr(0.14, 0.24);
    if (s) RB(x + s * (d / 2 + 0.03), y + ih / 2, z + t, 0.12, ih, iw, pick(items)); else RB(x + t, y + ih / 2, z + d / 2 + 0.03, iw, ih, 0.12, pick(items));
  }
}
function counter(x, z, w, d, col = '#8a5a32', top = '#efe8da') { RB(x, 0.48, z, w, 0.96, d, col); RB(x, 0.99, z, w + 0.08, 0.06, d + 0.08, top); solid(x, z, w, d); }
function sofa(x, z, w, col) { RB(x, 0.24, z, w, 0.42, 0.75, col); RB(x, 0.62, z - 0.3, w, 0.62, 0.16, col); for (const s of [-1, 1]) RB(x + s * w / 2, 0.42, z, 0.16, 0.5, 0.75, col); solid(x, z, w + 0.1, 0.8); }
function plant(x, z, s = 1, fl = 0) { RB(x, 0.2, z, 0.42 * s, 0.4, 0.42 * s, '#b8673a', CYL); bush(x, z, 0.75 * s, fl, 0.32); circles.push({ x, z, r: 0.3 * s }); }
function room(spec) {
  const cx = ROOM_X + ROOMS.length * 40, { W, D } = spec, x0 = cx - W / 2, x1 = cx + W / 2, z0 = -D / 2, z1 = D / 2;
  const g = new THREE.Group(); g.position.set(cx, 0, 0); scene.add(g);
  const flat = { r: [-Math.PI / 2, 0, 0], shadow: false }, wallM = new THREE.MeshStandardMaterial({ color: spec.wall, roughness: 0.95 }), trim = spec.trim;
  add(new THREE.PlaneGeometry(40, 40), ROOM_BG.getStyle(), g, 0, -0.03, 0, flat);
  add(new THREE.PlaneGeometry(W, D), 0, g, 0, 0.004, 0, { ...flat, material: texMat(FLOORS[spec.floor], W / 2, D / 2, { roughness: 0.8 }) });
  add(BOX, 0, g, 0, 1.45, z0 - 0.1, { s: [W + 0.4, 2.9, 0.2], material: wallM, shadow: false }); // walls cast no shadow, so the sun never darkens the room
  for (const s of [-1, 1]) {
    add(BOX, 0, g, s * (W / 2 + 0.1), 1.45, 0.1, { s: [0.2, 2.9, D + 0.2], material: wallM, shadow: false });
    add(BOX, trim, g, s * (W / 2 - 0.01), 0.45, 0, { s: [0.04, 0.9, D] });
    add(BOX, trim, g, s * (W / 4 + 0.4), 0.3, z1 + 0.1, { s: [W / 2 - 0.8, 0.6, 0.2] }); // low front wall either side of the door
  }
  add(BOX, trim, g, 0, 0.45, z0 + 0.01, { s: [W, 0.9, 0.04] });
  add(BOX, trim, g, 0, 2.86, z0 + 0.02, { s: [W, 0.1, 0.06] });
  add(new THREE.PlaneGeometry(1.5, 0.9), '#b8423a', g, 0, 0.012, z1 - 0.3, flat);
  for (const x of spec.windows ?? [-W / 4, W / 4]) kWin(g, x, 1.75, z0 + 0.02, 0.9, 0.85, trim);
  for (const [x, y, i] of spec.paintings ?? []) { add(BOX, '#6d4527', g, x, y, z0 + 0.03, { s: [0.95, 0.75, 0.04] }); add(new THREE.PlaneGeometry(0.82, 0.62), 0, g, x, y, z0 + 0.06, { shadow: false, material: new THREE.MeshStandardMaterial({ map: PAINT[i % 3] }) }); }
  if (spec.rug) { const [x, z, w, d, col] = spec.rug; add(new THREE.PlaneGeometry(w + 0.2, d + 0.2), '#e8d9a8', g, x, 0.008, z, flat); add(new THREE.PlaneGeometry(w, d), col, g, x, 0.01, z, flat); }
  segs.push([x0, z0, x1, z0], [x0, z0, x0, z1 + 0.2], [x1, z0, x1, z1 + 0.2], [x0, z1 + 0.1, cx - 0.8, z1 + 0.1], [cx + 0.8, z1 + 0.1, x1, z1 + 0.1]);
  const r = { name: spec.name, cx, rect: [x0, z0, x1, z1], walk: [x0 + 0.05, z0 + 0.05, x1 - 0.05, z1 + 0.7], door: null };
  ROOMS.push(r); spec.build?.(cx, z0, z1, g);
  for (const [k, dx, dz, face, name, lines, extra = {}] of spec.npcs || [])
    RNPC.push([k, cx + dx, dz, face, name, lines, extra.patrol ? { ...extra, patrol: extra.patrol.map(([a, b]) => [cx + a, b]) } : extra]);
  return r;
}
function linkRoom(r, x, z) { r.door = { x, z }; KDOORS.push({ x, z, room: r }); }
const GOODS = ['#e2473b', '#3f6fb8', '#ffd23f', '#6fbf45', '#ffffff', '#b48cff'], BREAD = ['#c98a45', '#b8763a', '#dca35a', '#a8662e'];
const ROOM_SPEC = {
  pc: { name: 'Pokémon Center', W: 10, D: 7, floor: 'tile', wall: '#f8f3ec', trim: '#d8423a', windows: [2.6], rug: [0, 1.2, 3.2, 2.2, '#e86a5a'], paintings: [[-2.4, 1.85, 0]],
    build(cx) {
      counter(cx, -1.9, 4.6, 0.6, '#f4f0ea', '#e2473b');
      RB(cx + 1.4, 0.55, -3.05, 1.1, 1.1, 0.55, '#dfe6ee'); // healing machine, six Poké Ball slots
      for (let i = 0; i < 6; i++) RB(cx + 1.05 + (i % 3) * 0.35, 1.16, -3.12 + Math.floor(i / 3) * 0.2, 0.13, 0.13, 0.13, i % 2 ? '#ffffff' : '#e2473b', SPH);
      for (const x of [-4.1, -3.2]) { RB(cx + x, 0.45, -3.0, 0.7, 0.9, 0.5, '#cfd6de'); RB(cx + x, 1.2, -3.05, 0.6, 0.5, 0.08, '#2a3a4a'); add(new THREE.PlaneGeometry(0.5, 0.38), '#7fd8ff', scene, cx + x, 1.2, -2.99, { mat: { emissive: '#36c6ff', emissiveIntensity: 0.9 }, shadow: false }); solid(cx + x, -3.0, 0.7, 0.5); }
      sofa(cx + 3.4, 2.3, 2.2, '#e86a5a'); plant(cx - 4.4, 2.8); plant(cx + 4.4, -2.9);
    },
    npcs: [['nurse', 0, -2.6, 0, 'Nurse Joy', ['Welcome to the Fleurville Pokémon Center!', 'Let me take care of your Pokémon.', '...Thank you for waiting. Your Pokémon are fighting fit!'], { after: () => healParty() }],
      ['youngster', -3.65, -2.1, Math.PI, 'Youngster', ['This PC lets you trade with people all over the world!', "...Well, it will. It's still installing updates."]],
      ['breederM', 2.8, 1.2, -0.6, 'Pokémon Breeder', ['Rest is part of training too.', 'A happy Pokémon fights twice as hard!']]] },
  mart: { name: 'Poké Mart', W: 8, D: 6, floor: 'tile', wall: '#eef3fb', trim: '#2a62c4',
    build(cx) { counter(cx - 2.6, 0.2, 0.7, 2.4, '#3f6fb8'); shelf(cx + 0.6, -2.65, 5.2, GOODS); shelf(cx + 1.2, 0.3, 3.2, GOODS, { h: 1.3, rows: 2 }); plant(cx + 3.5, 2.4); },
    npcs: [['clerk', -3.35, 0.2, Math.PI / 2, 'Poké Mart clerk', ['Bienvenue to the Poké Mart!', 'Evolution stones just came in, and we stock medicine for poison, paralysis and sleep. Take a look!'], { after: () => { if (KAL.gift) return openShop(); KAL.gift = true; bag.ball = (bag.ball || 0) + 3; /* a new game's bag has no Poké Balls yet */ say('', ['You received 3 Poké Balls! A welcome gift for our first customer.'], null, openShop); } }],
      ['backpacker', 1.4, 1.35, Math.PI, 'Backpacker', ['Potions, Repels, Escape Ropes... check.', "I'm hiking all the way to Lumiose!"]]] },
  cafe: { name: 'Café Soleil', W: 8, D: 6, floor: 'check', wall: '#f3e6cf', trim: '#6d4527', paintings: [[-2, 1.8, 1]], windows: [1.8],
    build(cx) {
      counter(cx + 2.0, -1.9, 3.0, 0.6, '#6d4527', '#2f2a26'); RB(cx + 2.9, 1.22, -1.95, 0.5, 0.45, 0.4, '#b8bcc2'); shelf(cx + 2.0, -2.75, 3.4, ['#7a3b2a', '#3f7d4a', '#e8c35a', '#ffffff'], { h: 1.0, rows: 1, thin: true, step: 0.14 });
      for (const [x, z] of [[-2.4, -1.2], [-2.4, 1.3], [0.6, 1.0]]) kTableW(cx + x, z, false); plant(cx - 3.5, -2.5, 1, '#ffffff');
    },
    npcs: [['garcon', 2.0, -2.6, 0, 'Barista', ['One café au lait, coming right up!', 'Our beans are roasted by a Charmander. True story.']],
      ['alexa', -1.6, -1.6, -2.2, 'Alexa', ["I'm a journalist from Lumiose. I'm writing about Fleurville's fountain.", 'Know any good stories? A legendary Roselia, perhaps?']],
      ['pokefan', 1.4, 1.6, -1.6, 'Pokéfan', ['This café has the cutest Pokémon latte art!', "Today's is a Pikachu. I can't bear to drink it!"]]] },
  bakery: { name: 'Boulangerie', W: 7, D: 5.5, floor: 'wood', wall: '#fbeedd', trim: '#8a5a32', paintings: [[0, 1.85, 2]],
    build(cx) {
      counter(cx, -1.0, 4.0, 0.7, '#e8dcc6', '#c9e8f0'); for (let i = 0; i < 14; i++) RB(cx - 1.8 + i * 0.27, 1.1, -1.0 + rr(-0.15, 0.15), 0.22, 0.12, 0.13, pick(BREAD), SPH);
      shelf(cx, -2.5, 5.0, BREAD, { col: '#9a6a3f' }); plant(cx + 3.0, 2.0, 0.9);
    },
    npcs: [['chef', 0, -1.75, 0, 'Baker', ['Fresh from the oven! Croissants, baguettes, pain au chocolat...', 'The flour comes from the windmill up the road.']],
      ['roller', 1.6, 0.9, Math.PI, 'Roller Skater', ['I skate here every morning for a croissant.', 'Best fuel for a Trainer!']]] },
  boutique: { name: 'Boutique', W: 7, D: 5.5, floor: 'wood', wall: '#f7e9ef', trim: '#2f5a3a', windows: [-1.6],
    build(cx) {
      for (const x of [-1.9, 1.2]) { RB(cx + x, 1.45, 0.2, 1.8, 0.05, 0.05, '#c9a774'); for (const s of [-1, 1]) RB(cx + x + s * 0.9, 0.73, 0.2, 0.05, 1.45, 0.05, '#c9a774');
        for (let i = 0; i < 7; i++) RB(cx + x - 0.75 + i * 0.25, 1.0, 0.2, 0.06, 0.8, 0.5, pick(['#e86a8a', '#3f6fb8', '#ffffff', '#2f2a26', '#e8c35a', '#7fb2e6'])); solid(cx + x, 0.2, 1.9, 0.55); }
      counter(cx + 2.4, -1.9, 1.6, 0.6, '#2f5a3a'); add(BOX, '#c9e2ee', scene, cx + 1.6, 1.4, -2.73, { s: [0.9, 1.6, 0.03], mat: { roughness: 0.1, metalness: 0.4 } }); plant(cx - 3.0, -2.3, 0.9, '#ff9ec0');
    },
    npcs: [['grace', 2.4, -2.5, 0, 'Saleswoman', ['Bienvenue to Boutique Élégance!', 'This season, everything is about berets and bold colours.']],
      ['artist', -0.4, 1.5, 2.6, 'Fashionista', ['Which goes better with a Furfrou: red or blue?', '...Both! I will take both!']]] },
  hats: { name: 'Chapeaux', W: 6, D: 5, floor: 'wood', wall: '#efe4d2', trim: '#6d3f22', windows: [0],
    build(cx) {
      for (const [x, z] of [[-2.0, -1.8], [-0.7, -1.8], [0.7, -1.8], [2.0, -1.8], [-1.6, 0.4], [1.6, 0.4]]) {
        RB(cx + x, 0.55, z, 0.06, 1.1, 0.06, '#3a3f44'); RB(cx + x, 0.04, z, 0.4, 0.06, 0.4, '#3a3f44');
        const c = pick(['#d8423a', '#2f2a26', '#3f6fb8', '#e8c35a', '#f2efe6']); RB(cx + x, 1.12, z, 0.34, 0.03, 0.34, c, CYL); RB(cx + x, 1.24, z, 0.17, 0.22, 0.17, c, CYL); circles.push({ x: cx + x, z, r: 0.25 });
      }
      counter(cx - 1.7, 1.6, 1.4, 0.6, '#6d3f22');
    },
    npcs: [['butler', -1.7, 0.95, 0, 'Hatter', ['A gentleman is never without a fine hat.', 'Try the top hat. Very Lumiose!']],
      ['twins', 0.9, 1.6, Math.PI, 'Little boy', ['I want the one with the Pikachu ears!', "Mom says I'm too little for a top hat."]]] },
  books: { name: 'Librairie', W: 7, D: 5.5, floor: 'wood', wall: '#efe6d6', trim: '#3f2a1c', windows: [],
    build(cx) {
      const BK = ['#7a2f2a', '#2f4f7a', '#3f6a3a', '#c9a24a', '#5a3a6a', '#e8e0cc'];
      shelf(cx, -2.5, 6.6, BK, { h: 2.4, rows: 4, thin: true, step: 0.11 }); shelf(cx - 3.25, 0.4, 3.0, BK, { h: 2.0, rows: 4, thin: true, step: 0.11, side: 1 });
      RB(cx + 0.6, 0.72, 0.4, 1.8, 0.06, 0.9, '#8a5a32'); for (const s of [-1, 1]) for (const t of [-1, 1]) RB(cx + 0.6 + s * 0.8, 0.36, 0.4 + t * 0.35, 0.06, 0.72, 0.06, '#6d4527'); solid(cx + 0.6, 0.4, 1.8, 0.9);
      for (let i = 0; i < 4; i++) RB(cx + 0.1 + i * 0.35, 0.78, 0.4 + rr(-0.2, 0.2), 0.22, 0.06, 0.3, pick(BK)); counter(cx + 2.6, -1.4, 1.2, 0.6, '#6d4527');
    },
    npcs: [['scientistF', 2.6, -2.0, 0, 'Librarian', ['Shh! This is a library... well, a bookshop. Still, shh!', 'The Mega Evolution books are on the left. Very popular.']],
      ['schoolboy', 0.6, 1.2, Math.PI, 'Student', ['I need to read about type matchups for my test.', 'Fire beats Grass, Water beats Fire... what beats Fairy again?']]] },
  florist: { name: 'Fleuriste', W: 7, D: 5.5, floor: 'tile', wall: '#f1f7ec', trim: '#3f7d4a',
    build(cx) {
      for (let i = 0; i < 9; i++) { const x = cx - 3 + i * 0.75, z = -2.3; RB(x, 0.22, z, 0.26, 0.44, 0.26, '#8a9aa6', CYL); bush(x, z, 0.5, pick(['#ff5a7a', '#ffd23f', '#ffffff', '#b48cff', '#ff8a3d']), 0.3); }
      for (let i = 0; i < 4; i++) { const z = -1.2 + i * 0.8; for (const s of [-1, 1]) { RB(cx + s * 3.05, 0.22, z, 0.26, 0.44, 0.26, '#8a9aa6', CYL); bush(cx + s * 3.05, z, 0.5, pick(['#ff9ec0', '#ffffff', '#e8384f', '#ffd23f']), 0.3); } }
      solid(cx, -2.3, 6.8, 0.5); for (const s of [-1, 1]) solid(cx + s * 3.05, 0, 0.5, 3.4); counter(cx + 1.4, 0.5, 1.6, 0.7, '#3f7d4a');
    },
    npcs: [['mable', 1.4, -0.15, 0, 'Florist', ['Every Flabébé needs the perfect flower.', 'The red roses? Madame Fleur grows them. Magnifique!']],
      ['youngster', -1.2, 1.4, Math.PI, 'Youngster', ["I'm buying flowers for my mom's birthday.", "Shh, don't tell her!"]]] },
  crepe: { name: 'Crêperie', W: 7, D: 6, floor: 'check', wall: '#fbf1e2', trim: '#d8423a', paintings: [[-2.2, 1.85, 1]], windows: [1.6],
    build(cx) {
      counter(cx + 1.6, -1.9, 3.0, 0.7, '#d8423a', '#3a3f44'); for (const x of [0.8, 1.8]) RB(cx + x, 1.04, -1.9, 0.5, 0.03, 0.5, '#202020', CYL);
      for (const [x, z] of [[-2.2, -0.6], [-1.2, 1.6], [1.6, 1.2]]) kTableW(cx + x, z, false); plant(cx - 3.0, -2.4, 0.9, '#ffd23f');
    },
    npcs: [['waitress', 1.6, -2.65, 0, 'Crêpe cook', ['One Oran Berry crêpe, extra sweet!', 'Want to know the secret? A pinch of Combee honey.']],
      ['hiker', -0.4, 0.3, -2.2, 'Hiker', ['Nothing beats a crêpe after climbing a mountain!', "I've had six today. Don't judge."]]] },
  manor: { name: 'Fleur Manor', W: 12, D: 8, floor: 'wood', wall: '#efe2cc', trim: '#6d3f22', rug: [0, 0.6, 5, 3.2, '#9b3f3a'], paintings: [[-4, 1.9, 0], [4, 1.9, 2], [-2.2, 1.95, 1]], windows: [-5, 5],
    build(cx) {
      RB(cx, 0.65, -3.75, 2.2, 1.3, 0.5, '#d8d0c0'); RB(cx, 0.45, -3.5, 1.1, 0.8, 0.06, '#2a2420'); RB(cx, 1.36, -3.7, 2.5, 0.1, 0.65, '#efe8da'); solid(cx, -3.75, 2.2, 0.5);
      add(new THREE.PlaneGeometry(0.9, 0.5), '#ff9a3a', scene, cx, 0.32, -3.45, { mat: { emissive: '#ff7a1a', emissiveIntensity: 1.6 }, shadow: false });
      sofa(cx - 1.4, -1.0, 2.0, '#6d3f6a'); sofa(cx + 1.4, -1.0, 2.0, '#6d3f6a'); RB(cx, 0.32, 0.6, 1.3, 0.08, 0.7, '#6d4527'); solid(cx, 0.6, 1.3, 0.7);
      RB(cx + 4.4, 0.5, 2.6, 1.6, 1.0, 1.0, '#1f1a18'); RB(cx + 4.4, 1.02, 2.15, 1.5, 0.04, 0.12, '#f5f1e8'); solid(cx + 4.4, 2.6, 1.6, 1.0); // grand piano (well, an upright)
      plant(cx - 5.3, -3.3, 1.2, '#ff5a7a'); plant(cx + 5.3, -3.3, 1.2, '#ffffff'); shelf(cx - 5.75, 1.2, 3.0, ['#7a2f2a', '#2f4f7a', '#c9a24a'], { h: 2.2, rows: 4, thin: true, step: 0.11, side: 1 });
    },
    npcs: [['richboy', -0.2, 1.9, Math.PI, 'Young master', ['Father says I shall run Fleur Manor one day.', 'I would rather be a Pokémon Trainer like you!']],
      ['maid', 2.6, -2.6, 0, 'Head maid', ['Welcome to Fleur Manor.', 'Please wipe your shoes. These rugs came from Kalos Palace.'], { patrol: [[2.6, -2.6], [-2.6, -2.6]] }]] },
};
const K_SHOPS = [
  [[235, 240, 300, 330], { sign: 'BOUTIQUE', room: ROOM_SPEC.boutique }],
  [[300, 240, 410, 330], { sign: 'BOULANGERIE', awning: true, room: ROOM_SPEC.bakery }],
  [[668, 240, 765, 330], { sign: 'CAFÉ SOLEIL', awning: true, room: ROOM_SPEC.cafe }],
  [[765, 240, 832, 330], { sign: 'CHAPEAUX', room: ROOM_SPEC.hats }],
  [[250, 405, 320, 472], { sign: 'LIBRAIRIE', room: ROOM_SPEC.books }],
  [[320, 405, 410, 472], { sign: 'FLEURISTE', awning: true, room: ROOM_SPEC.florist }],
  [[750, 408, 832, 472], { sign: 'POKé MART', roofTex: blueRoofTex, trim: '#2a4f8f', signBg: '#2a62c4', signFg: '#ffffff', room: ROOM_SPEC.mart }],
  [[62, 108, 145, 236], { sign: 'CRÊPERIE', ridgeZ: true, awning: true, h: 2.2, rh: 1.55, room: ROOM_SPEC.crepe }],
];
for (const [r, o] of K_SHOPS) kShop(r, o);
kBox(kRect(662, 386, 748, 474)); // Pokémon Center footprint (the X/Y model streams in later)
linkRoom(room(ROOM_SPEC.pc), K(705, 0)[0], K(0, 474)[1] + 0.45);
{ // Fleur Manor: two storeys, hipped tile roof with dormers, a columned porch
  const r = kRect(462, 128, 602, 228), W = r[2] - r[0], D = r[3] - r[1], H = 3.4, cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2;
  const g = new THREE.Group(); g.position.set(cx, 0.03, cz); scene.add(g);
  add(BOX, '#b9b09c', g, 0, 0.1, 0, { s: [W + 0.3, 0.2, D + 0.3] });
  add(BOX, 0, g, 0, 0.2 + H / 2, 0, { s: [W, H, D], material: texMat(houseTex, W / 2.4, H / 2.4, { roughness: 0.92 }) });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(BOX, '#f5f1e8', g, sx * (W / 2 - 0.1), 0.2 + H / 2, sz * (D / 2 - 0.1), { s: [0.32, H, 0.32] });
  for (const y of [1.85, 0.2 + H]) add(BOX, '#f5f1e8', g, 0, y, 0, { s: [W + 0.12, 0.12, D + 0.12] });
  add(hipRoof(W + 0.7, D + 0.7, 2.1), 0, g, 0, 0.26 + H, 0, { material: texMat(roofTex, 1, 1, { color: '#e09a86', roughness: 0.65, side: THREE.DoubleSide }) });
  for (const x of [-W * 0.3, 0, W * 0.3]) { // dormers on the front slope
    add(BOX, '#f4eee2', g, x, 0.26 + H + 0.45, D / 2 - 0.05, { s: [0.75, 0.75, 0.7] });
    add(new THREE.ConeGeometry(0.62, 0.42, 4), '#9b3f22', g, x, 0.26 + H + 1.03, D / 2 - 0.05, { r: [0, Math.PI / 4, 0], s: [1, 1, 0.85] });
    kWin(g, x, 0.26 + H + 0.42, D / 2 + 0.31, 0.38, 0.42, '#f5f1e8');
  }
  for (const sx of [-1, 1]) add(BOX, 0, g, sx * W * 0.36, 0.26 + H + 1.6, -0.6, { s: [0.5, 1.5, 0.5], material: texMat(wallTex, 0.4, 0.8) });
  for (const y of [1.1, 2.7]) for (const x of [-2.75, -1.75, -0.8, 0.8, 1.75, 2.75]) kWin(g, x * W / 7, y, D / 2 + 0.01, 0.5, 0.82, '#f5f1e8');
  kWin(g, 0, 2.7, D / 2 + 0.01, 0.5, 0.82, '#f5f1e8');
  kDoor(g, 0, D / 2 + 0.02, 1.15, 1.75, '#6d3f22', 0, 0.2);
  for (const sx of [-1, 1]) add(CYL, '#f5f1e8', g, sx * 0.85, 1.25, D / 2 + 0.8, { s: [0.11, 2.1, 0.11] });
  add(BOX, '#f5f1e8', g, 0, 2.35, D / 2 + 0.45, { s: [2.2, 0.2, 1.05] });
  add(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-1.1, 0), new THREE.Vector2(1.1, 0), new THREE.Vector2(0, 0.45)])), '#f5f1e8', g, 0, 2.45, D / 2 + 0.98);
  for (let i = 0; i < 2; i++) add(BOX, '#d8d0c0', g, 0, 0.07 + i * 0.07, D / 2 + 0.95 - i * 0.25, { s: [2.4 - i * 0.3, 0.14, 0.5] });
  kBox(r); kFade(g, r); circles.push({ x: cx - 0.85, z: cz + D / 2 + 0.8, r: 0.14 }, { x: cx + 0.85, z: cz + D / 2 + 0.8, r: 0.14 });
  linkRoom(room(ROOM_SPEC.manor), cx, r[3] + 0.45);
}
{ // Sycamore's greenhouse: stone base, glass walls and a ribbed glass vault
  const r = kRect(680, 5, 800, 132), W = r[2] - r[0], D = r[3] - r[1], cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2, B = 0.85, G = 1.5;
  const g = new THREE.Group(); g.position.set(cx, 0.03, cz); scene.add(g);
  add(BOX, 0, g, 0, B / 2, 0, { s: [W, B, D], material: texMat(houseTex, W / 2.2, 0.4) });
  add(BOX, 0, g, 0, B + G / 2, 0, { s: [W - 0.08, G, D - 0.08], material: KMAT.glass, shadow: false });
  for (let x = -W / 2; x <= W / 2 + 0.01; x += W / 6) for (const s of [-1, 1]) add(BOX, '#2f5a3a', g, x, B + G / 2, s * D / 2, { s: [0.08, G, 0.08] });
  for (let z = -D / 2; z <= D / 2 + 0.01; z += D / 6) for (const s of [-1, 1]) add(BOX, '#2f5a3a', g, s * W / 2, B + G / 2, z, { s: [0.08, G, 0.08] });
  const vault = new THREE.Group(); vault.position.y = B + G; vault.scale.y = 0.62; g.add(vault);
  add(new THREE.CylinderGeometry(W / 2, W / 2, D, 28, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), 0, vault, 0, 0, 0, { material: KMAT.glass, shadow: false });
  for (let z = -D / 2; z <= D / 2 + 0.01; z += D / 8) add(new THREE.TorusGeometry(W / 2, 0.05, 6, 28, Math.PI), '#2f5a3a', vault, 0, 0, z);
  add(BOX, '#2f5a3a', vault, 0, W / 2, 0, { s: [0.1, 0.1, D] });
  for (const s of [-1, 1]) add(new THREE.CircleGeometry(W / 2, 28, 0, Math.PI), 0, vault, 0, 0, s * D / 2, { material: KMAT.glass, shadow: false });
  kDoor(g, 0, D / 2 + 0.02, 1.0, 1.7, '#2f5a3a');
  for (let i = 0; i < 9; i++) bush(cx + rr(-W / 2 + 0.7, W / 2 - 0.7), cz + rr(-D / 2 + 0.7, D / 2 - 1.2), rr(0.55, 0.9), pick(['#ff6f8f', '#ffd23f', '#b89cff', '#ffffff', 0]));
  for (const [x, z] of [[-W / 3, -D / 4], [W / 4, -D / 5]]) fillTree(cx + x, cz + z, 0.8, false);
  kBox(r); KDOORS.push({ x: cx, z: r[3] + 0.5, name: 'Greenhouse', lines: ["PROF. SYCAMORE'S GREENHOUSE", 'Rare Berry trees and flowers from all over Kalos grow inside.'] });
}
{ // the windmill in the manor grounds; its sails turn in kalosTick
  const [x, z] = K(650, 80), g = new THREE.Group(); g.position.set(x, 0.03, z); scene.add(g);
  add(new THREE.CylinderGeometry(0.85, 1.15, 4.2, 18), 0, g, 0, 2.1, 0, { material: texMat(wallTex, 3, 2, { roughness: 0.95 }) });
  add(new THREE.ConeGeometry(1.2, 1.3, 18), '#8e3a20', g, 0, 4.85, 0);
  kDoor(g, 0, 1.13, 0.6, 1.1, '#6d4527', 0, 0);
  kWin(g, 0, 2.9, 0.98, 0.32, 0.42, '#6d4527');
  const hub = new THREE.Group(); hub.position.set(0, 3.95, 1.0); g.add(hub);
  sph(0.18, '#5a4030', hub, 0, 0, 0.08);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Group(); b.rotation.z = i * Math.PI / 2; hub.add(b);
    add(BOX, '#6d4527', b, 0, 1.25, 0.1, { s: [0.08, 2.5, 0.06] });
    add(BOX, '#efe6d2', b, 0.18, 1.4, 0.08, { s: [0.32, 2.1, 0.03] });
  }
  KAL.blades = hub; circles.push({ x, z, r: 1.2 }); kBoxes.push([x - 1.2, z - 1.2, x + 1.2, z + 1.2]);
}
function kWall(a, b, h = 0.6) { // low stone wall with capped pillars every ~4 m (batched)
  const [ax, az] = K(...a), [bx, bz] = K(...b), L = Math.hypot(bx - ax, bz - az), ang = -Math.atan2(bz - az, bx - ax);
  addB('stone', BOX, '#cdbfa6', [(ax + bx) / 2, h / 2, (az + bz) / 2], [0, ang, 0], [L, h, 0.34]);
  addB('stone', BOX, '#e9e1cf', [(ax + bx) / 2, h + 0.04, (az + bz) / 2], [0, ang, 0], [L + 0.06, 0.08, 0.42]);
  const n = Math.max(1, Math.round(L / 4));
  for (let i = 0; i <= n; i++) {
    const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n;
    addB('stone', BOX, '#c4b59a', [x, h * 0.65, z], [0, ang, 0], [0.48, h * 1.3, 0.48]);
    addB('stone', BOX, '#ece4d2', [x, h * 1.3 + 0.05, z], [0, ang, 0], [0.58, 0.1, 0.58]);
  }
  segs.push([ax, az, bx, bz]);
}
function kHedge(a, b, roses = null, h = 0.8) { // clipped hedge, optionally studded with roses (batched)
  const [ax, az] = K(...a), [bx, bz] = K(...b), L = Math.hypot(bx - ax, bz - az), fc = foliageColor('#3f8a3a', 0, h + 0.25);
  addB('leaf', BOX, fc, [(ax + bx) / 2, h / 2, (az + bz) / 2], [0, -Math.atan2(bz - az, bx - ax), 0], [L, h, 0.55]);
  for (let s = 0.2; s < L; s += 0.6) {
    const x = ax + (bx - ax) * s / L, z = az + (bz - az) * s / L;
    addB('leaf', pick(LEAF_BALLS), fc, [x, h - 0.06, z], [rnd(), rnd() * 6, 0], [0.36, 0.24, 0.36]);
    if (roses) for (let i = 0; i < 4; i++) addB('flower', LEAF_BALLS[2], pick(roses), [x + rr(-0.3, 0.3), h + rr(-0.35, 0.12), z + rr(-0.3, 0.3)], [0, 0, 0], [0.07, 0.06, 0.07], 0.02);
  }
  segs.push([ax, az, bx, bz]);
}
function kRoses(r) { // a bed of rose bushes
  const [x0, z0, x1, z1] = kRect(...r);
  for (let x = x0 + 0.35; x < x1 - 0.2; x += 0.62) for (let z = z0 + 0.35; z < z1 - 0.2; z += 0.62) bush(x + rr(-0.08, 0.08), z + rr(-0.08, 0.08), rr(0.45, 0.6), pick(['#ff5a7a', '#e8384f', '#ff9ec0', '#ffffff']));
  kBox([x0, z0, x1, z1], 0.05);
}
const PARASOL = new THREE.ConeGeometry(1, 1, 10);
function kTable(px, py, parasol = true) { kTableW(...K(px, py), parasol); }
function kTableW(x, z, parasol = true) { // café table with three chairs (batched)
  const y = terrainH(x, z);
  addB('wood', CYL, '#f5f1e8', [x, y + 0.74, z], [0, 0, 0], [0.42, 0.05, 0.42]);
  addB('wood', CYL, '#3a3f44', [x, y + 0.37, z], [0, 0, 0], [0.05, 0.74, 0.05]);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.09 + rnd(), cx = x + Math.cos(a) * 0.62, cz = z + Math.sin(a) * 0.62;
    addB('wood', BOX, '#2f5a3a', [cx, y + 0.44, cz], [0, -a, 0], [0.36, 0.05, 0.36]);
    addB('wood', BOX, '#2f5a3a', [cx + Math.cos(a) * 0.17, y + 0.66, cz + Math.sin(a) * 0.17], [0, -a, 0], [0.04, 0.42, 0.36]);
    for (const [u, v] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) addB('wood', BOX, '#2a2e33', [cx + (Math.cos(a) * u - Math.sin(a) * v) * 0.14, y + 0.21, cz + (Math.sin(a) * u + Math.cos(a) * v) * 0.14], [0, 0, 0], [0.03, 0.42, 0.03]);
  }
  if (parasol) {
    addB('wood', CYL, '#e8e0cc', [x, y + 1.35, z], [0, 0, 0], [0.025, 1.25, 0.025]);
    addB('wood', PARASOL, pick(['#d8423a', '#f2efe6', '#3f7d4a', '#e8a33a']), [x, y + 2.15, z], [0, 0, 0], [0.8, 0.3, 0.8]);
  }
  circles.push({ x, z, r: 0.78 });
}
function kBench(px, py, rot = 0) {
  const [x, z] = K(px, py);
  if (ASSETS) { const g = assetGroup('bench'); g.position.set(x, kalosH(x, z), z); g.rotation.y = rot; scene.add(g); }
  const c = Math.cos(rot), s = Math.sin(rot); segs.push([x - c * 0.75, z + s * 0.75, x + c * 0.75, z - s * 0.75]);
}
// town walls (gaps for the roads), the manor grounds wall, hedges, rose beds
for (const [a, b] of [[[218, 236], [218, 600]], [[866, 236], [866, 600]], [[218, 600], [658, 600]], [[724, 600], [866, 600]],
  [[582, 8], [582, 126]], [[582, 8], [866, 8]], [[866, 8], [866, 178]]]) kWall(a, b);
const ROSES = ['#ff5a7a', '#e8384f', '#ff9ec0', '#ffffff'];
for (const [a, b, r] of [[[150, 162], [268, 162]], [[330, 162], [456, 162]], [[252, 566], [645, 566], ROSES], [[740, 566], [856, 566], ROSES],
  [[101, 86], [168, 86]], [[198, 86], [266, 86]], [[351, 86], [418, 86]], [[448, 86], [516, 86]],
  [[101, -32], [101, 86]], [[266, -32], [266, 86]], [[351, -32], [351, 86]], [[516, -32], [516, 86]], [[838, 250], [838, 560]]]) kHedge(a, b, r);
kRoses([412, 410, 462, 476]); kRoses([604, 410, 654, 470]);
fence(K(55, 240), K(55, 360)); fence(K(55, 360), K(212, 360));
for (const [px, py] of [[92, 270], [130, 270], [168, 270], [92, 318], [130, 318], [168, 318]]) kTable(px, py);
for (const [px, py] of [[432, 282], [432, 322], [630, 282], [630, 322]]) kTable(px, py, false);
for (const [px, py] of [[655, 505], [735, 505], [60, 262], [478, 240], [588, 240], [479, 304], [585, 304], [479, 410], [585, 410], [214, 170], [870, 170]]) lamp(...K(px, py));
for (const [px, py] of [[390, 174], [465, 455], [600, 455]]) kBench(px, py);
{ // town sign at the south gate
  const [x, z] = K(636, 615), g = new THREE.Group(); g.position.set(x, kalosH(x, z), z); scene.add(g);
  for (const s of [-1, 1]) add(BOX, '#6f4b2c', g, s * 0.62, 0.55, 0, { s: [0.1, 1.1, 0.1] });
  add(BOX, '#6f4b2c', g, 0, 0.95, 0, { s: [1.5, 0.5, 0.08] });
  add(new THREE.PlaneGeometry(1.38, 0.38), 0, g, 0, 0.95, 0.045, { shadow: false, material: new THREE.MeshStandardMaterial({ map: signTex('FLEURVILLE TOWN', '#f5ead0', '#5a3a1e') }) });
  circles.push({ x, z, r: 0.45 }); KDOORS.push({ x, z, name: 'Sign', lines: ['FLEURVILLE TOWN', 'Where flowers and friendships bloom.', 'Verdant Town lies to the south.'] });
}
{ // forest around the town, a few trees out on the meadows; nothing on roads, fields or buildings
  const KIN = kRect(205, 165, 880, 612), KCAFE = kRect(48, 100, 225, 366);
  const ok = (x, z) => !inRect(x, z, KIN) && !inRect(x, z, KCAFE, 0.6) && !kPaved(x, z) && !K_DIRT.some(r => inRect(x, z, r, 1.3)) && !K_FIELDS.some(r => inRect(x, z, r, 1.1))
    && !kBoxes.some(r => inRect(x, z, r, 1.2)) && trees.every(([tx, tz, tr]) => Math.abs(tx - x) > 3 || Math.hypot(tx - x, tz - z) > tr + 0.9);
  for (const [px, py] of [[196, 520], [42, 338], [36, 468]]) { const [x, z] = K(px, py); fillTree(x, z, rr(1.05, 1.3), false); }
  for (let i = 0; i < 2800; i++) {
    const x = rr(KX - 29, KX + 29), z = rr(-23.5, 25.5);
    if (!ok(x, z) || z > K_WALK[3] - 3 && z < K_WALK[3] + 9 && x > K_WALK[0] - 4 && x < K_WALK[2] + 4 || rnd() > (inRect(x, z, K_WALK) ? 0.03 : 0.8)) continue; // the camera looks north: keep the south edge open
    const s = rr(0.95, 1.5); fillTree(x, z, s, rnd() < 0.4, 0.25); // a few cherry blossoms among Fleurville's oaks
  }
  for (let i = 0; i < 70; i++) { const x = rr(KX - 21, KX + 22), z = rr(-14, 15.5); if (ok(x, z)) bush(x, z, rr(0.6, 1.0), rnd() < 0.5 ? pick(['#ffffff', '#ff9ec0', '#ffd23f']) : 0); }
}
setSeed(VERDANT_SEED);

const plainMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const MATS = { leaf: leafMat, rock: leafMat, flower: new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#2a2a2a' }) };
for (const k in batches) { // merged per material and per CHUNK cell (not across the whole world), so off-screen cells are culled
  const cells = new Map();
  for (const g of batches[k]) {
    g.computeBoundingSphere(); const c = g.boundingSphere.center, key = Math.floor(c.x / CHUNK) + ',' + Math.floor(c.z / CHUNK);
    if (!cells.has(key)) cells.set(key, []); cells.get(key).push(g);
  }
  for (const list of cells.values()) {
    const m = new THREE.Mesh(mergeGeometries(list), MATS[k] || plainMat);
    m.castShadow = k !== 'flower'; m.receiveShadow = true;
    scene.add(m);
  }
}
{ // All nine authored tree variants fit inside the existing east wing; G / ?map=test opens this comparison area.
  Object.keys(KIT_SPECIES).forEach((k, i) => {
    const x = TX + 17 + i % 3 * 4.7, z = -10 + Math.floor(i / 3) * 4.8, { geo, lod } = TREE_KIT['kit_' + k][0];
    kitTree(k, x, z, 1, 0);
    add(new THREE.PlaneGeometry(3.8, 0.5), 0, scene, x, 0.03, z + 1.8, { r: [-Math.PI / 2, 0, 0], shadow: false,
      material: new THREE.MeshBasicMaterial({ map: signTex(`${FLORA_MODELS[k].label.toUpperCase()} · ${geo.index.count / 3} TRIS${lod ? ` / FAR ${lod.index.count / 3}` : ''}`, '#1b2a44', '#9fe2ff') }) });
  });
}
flushInstances(); // without the Blender assets only kit trees are queued

export { KAL, KDOORS, KFADE, RNPC, ROOMS, ROOM_BG, kBoxes, kFade, kGround, kShop, roomAt, signTex, texMat };
