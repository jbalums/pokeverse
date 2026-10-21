import './09-terrain.js'; // first: the modules run in file-number order (see main.js)
import * as THREE from 'three';
import { EDGE, PLAZA_H, STA, STAIR, raised } from './05-paths-raised-plaza-stairs-tall-grass.js';
import { camera, scene } from './06-renderer-scene-post.js';
import { add, cobbleTex, wallTex } from './07-materials-textures.js';
import { ASSETS, CHUNK, LOD_R, placeAsset } from './08-blender-assets.js';
import { GROUND, cellKey, cellOf, isCoreCell, terrainCell } from './09-terrain.js';
import { cellRand, fillCell } from './18-cell-content.js';
import { P } from './19-characters.js';
import { MINI_TILES, miniTile } from './23-hud-minimap.js';
import { camLook } from './41-loop.js';
import { tick } from './44-game-menu.js';

// ============================================================ streaming: Verdant cells outside the core are built near the camera, dropped far from it
// A cell is wanted while it lies within the fog radius of the camera and the (slightly widened) view could show it. Wanted cells
// are built nearest first, one a frame; on a snap frame (start-up, teleport, loaded save) all at once, and any cell nearer than the
// fog's start at once too, so a fast turn never shows a hole. Every cell is rebuilt the same from its coordinates, so nothing is kept.
const STREAM_RES = 0.25, VERDANT_CELLS = { cx0: -12, cx1: 11, cz0: -14, cz1: 3 }; // inclusive; x stays well inside +-240 (Fleurville, Test Grounds)
const streamable = (cx, cz) => cx >= VERDANT_CELLS.cx0 && cx <= VERDANT_CELLS.cx1 && cz >= VERDANT_CELLS.cz0 && cz <= VERDANT_CELLS.cz1 && !isCoreCell(cx, cz);
const CELLS = { cells: new Map(), built: 0, disposed: 0 };
function buildCell(cx, cz) {
  const group = new THREE.Group(), ground = terrainCell(cx, cz, STREAM_RES);
  group.add(ground); scene.add(group); GROUND.push(ground);
  const { trees, pairs } = fillCell(cx, cz, cellRand(cx, cz), group), key = cellKey(cx, cz);
  if (!MINI_TILES.has(key)) MINI_TILES.set(key, miniTile(cx, cz, trees));
  const c = { cx, cz, group, ground, lod: pairs, trees, near: null };
  CELLS.cells.set(key, c); CELLS.built++; return c;
}
function disposeCell(c) { // shared kit / flora geometries and materials stay; only what the cell made goes
  scene.remove(c.group); GROUND.splice(GROUND.indexOf(c.ground), 1);
  c.group.traverse(o => { if (o.geometry?.userData.owned) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); });
  CELLS.cells.delete(cellKey(c.cx, c.cz)); CELLS.disposed++;
}
const cellDistTo = (cx, cz, x, z) => Math.hypot(Math.max(cx * CHUNK - x, 0, x - (cx + 1) * CHUNK), Math.max(cz * CHUNK - z, 0, z - (cz + 1) * CHUNK));
const cellDist = c => { const [cx, cz] = typeof c === 'string' ? c.split(',').map(Number) : [c.cx, c.cz]; return cellDistTo(cx, cz, camera.position.x, camera.position.z); }; // from the camera's ground point
const _frustum = new THREE.Frustum(), _pv = new THREE.Matrix4(), _cellBox = new THREE.Box3();
function wantedCells() {
  camera.updateMatrixWorld(); _frustum.setFromProjectionMatrix(_pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const R = scene.fog.far, x = camera.position.x, z = camera.position.z, m = CHUNK / 2, out = [];
  for (let cz = cellOf(z - R); cz <= cellOf(z + R); cz++) for (let cx = cellOf(x - R); cx <= cellOf(x + R); cx++) {
    if (!streamable(cx, cz) || cellDistTo(cx, cz, x, z) > R) continue;
    _cellBox.min.set(cx * CHUNK - m, -2, cz * CHUNK - m); _cellBox.max.set((cx + 1) * CHUNK + m, 8, (cz + 1) * CHUNK + m);
    if (_frustum.intersectsBox(_cellBox)) out.push(cellKey(cx, cz));
  }
  return out;
}
function cellTick(snap) {
  for (const c of [...CELLS.cells.values()]) if (cellDist(c) > scene.fog.far + 2 * CHUNK) disposeCell(c);
  const todo = wantedCells().filter(k => !CELLS.cells.has(k)).map(k => k.split(',').map(Number))
    .sort((a, b) => cellDistTo(...a, camLook.x, camLook.z) - cellDistTo(...b, camLook.x, camLook.z));
  todo.forEach(([cx, cz], i) => { if (snap || i === 0 || cellDistTo(cx, cz, camera.position.x, camera.position.z) < scene.fog.near) buildCell(cx, cz); });
  for (const c of CELLS.cells.values()) { // full-detail trees only near the player, as lodTick does for the core
    const near = cellDistTo(c.cx, c.cz, P.pos.x, P.pos.z) < LOD_R; if (near === c.near) continue;
    c.near = near; for (const [hi, lo] of c.lod) { hi.visible = near; lo.visible = !near; }
  }
}
const frames = async n => { while (n-- > 0) tick(); }; // debug checks: step the world n frames now (rAF stalls in a hidden pane)

// retaining walls along the plaza edge (skipping the stairs) + stone steps
function wallSeg(a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
  let nx = -dz / L, nz = dx / L;
  if (raised((a[0] + b[0]) / 2 + nx * 0.3, (a[1] + b[1]) / 2 + nz * 0.3)) { nx = -nx; nz = -nz; }
  if (ASSETS) { // 2 m stone modules, front face toward the low side
    const flip = (-dz * nx + dx * nz) < 0, A = flip ? b : a, ux = (flip ? -dx : dx) / L, uz = (flip ? -dz : dz) / L;
    const n = Math.max(1, Math.round(L / 2)), seg = L / n;
    for (let i = 0; i < n; i++) placeAsset('wall', A[0] + ux * seg * i + nx * 0.06, 0, A[1] + uz * seg * i + nz * 0.06, -Math.atan2(uz, ux), seg / 2 * 1.01, 1, 1);
    return;
  }
  const tex = wallTex.clone(); tex.needsUpdate = true; tex.repeat.set(L / 1.7, 1);
  const top = PLAZA_H + 0.06, bot = -0.45;
  add(new THREE.BoxGeometry(L + 0.12, top - bot, 0.32), 0, scene, (a[0] + b[0]) / 2 + nx * 0.1, (top + bot) / 2, (a[1] + b[1]) / 2 + nz * 0.1,
    { r: [0, -Math.atan2(dz, dx), 0], material: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }) });
}
for (let i = 0; i < EDGE.length - 1; i++) if (EDGE[i] !== STA) wallSeg(EDGE[i], EDGE[i + 1]);
{
  const s = STAIR, tex = cobbleTex.clone(); tex.needsUpdate = true; tex.repeat.set(1.2, 0.25);
  const stepMat = new THREE.MeshStandardMaterial({ map: tex, color: '#efe8da', roughness: 0.9 });
  for (let i = 0; i < s.steps - 1; i++) {
    const top = PLAZA_H * (1 - (i + 1) / s.steps), d = s.run / s.steps, u = d * (i + 0.5);
    add(new THREE.BoxGeometry(s.len, top + 0.4, d + 0.02), 0, scene, s.ax + s.ux * s.len / 2 + s.nx * u, (top - 0.4) / 2, s.az + s.uz * s.len / 2 + s.nz * u,
      { r: [0, -Math.atan2(s.uz, s.ux), 0], material: stepMat });
  }
  for (const v of [-0.08, s.len + 0.08]) { // low cheek walls
    const x0 = s.ax + s.ux * v, z0 = s.az + s.uz * v;
    for (let i = 0; i < s.steps; i++) {
      const top = PLAZA_H * (1 - i / s.steps) + 0.12, u = s.run / s.steps * (i + 0.5);
      add(new THREE.BoxGeometry(0.22, top + 0.4, s.run / s.steps + 0.02), '#a49d8f', scene, x0 + s.nx * u, (top - 0.4) / 2, z0 + s.nz * u, { r: [0, -Math.atan2(s.uz, s.ux), 0] });
    }
  }
}

export { CELLS, cellDist, cellTick, frames, streamable, wantedCells };
