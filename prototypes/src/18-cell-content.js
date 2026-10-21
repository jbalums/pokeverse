import './17-instanced-grass-reeds-flowers.js'; // first: the modules run in file-number order (see main.js)
import * as THREE from 'three';
import { V3, hash2 } from './01-helpers.js';
import { inRect } from './03-fleurville-map.js';
import { riverInfo } from './04-river.js';
import { CLEAR, OLD_FILL, PATH_W, ROUTE_GRASS, ROUTE_HALF, inRouteGrass, routeD, terrainH } from './05-paths-raised-plaza-stairs-tall-grass.js';
import { scene } from './06-renderer-scene-post.js';
import { CHUNK, LOD_CHUNKS, farLod, instanceInto } from './08-blender-assets.js';
import { TX0, TX1, TZ0, TZ1, cellOf } from './09-terrain.js';
import { GRASS_DENSITY, SHORT_GEO, TALL_GEO, instancedCells, swayMaterial } from './17-instanced-grass-reeds-flowers.js';

// ============================================================ cell content: forest and ground cover for streamed cells
// Each cell draws from its own random stream (never the shared rnd()), so it comes back the same whenever it is rebuilt.
const cellRand = (cx, cz) => { // mulberry32, seeded by the cell
  let a = (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663)) >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
const CELL_SWAY = swayMaterial(true), _cq = new THREE.Quaternion(), _ce = new THREE.Euler(), _co = new THREE.Object3D(), _cc = new THREE.Color(), _white = new THREE.Color('#ffffff');
const TUFT_COLS = ['#6fb03f', '#5a9e34', '#86c04c', '#529530', '#97c955'], TALL_COLS = ['#3c8a2c', '#4a9c37', '#57ad41', '#357b28', '#62b546'];
function fillCell(cx, cz, rand, parent) { // trees on a jittered 2.4 m grid, short tufts, Route 1's tall grass; skips the core fill, the corridor, the clearing and the river
  const x0 = cx * CHUNK, z0 = cz * CHUNK, G = 2.4, trees = [], kits = {}, tufts = [], tall = [];
  const open = (x, z, pad) => !inRect(x, z, OLD_FILL) && routeD(x, z) > ROUTE_HALF + pad && Math.hypot(x - CLEAR.x, z - CLEAR.z) > CLEAR.r + pad && (r => r.d > r.hw + 1)(riverInfo(x, z));
  for (let gz = z0 + G / 2; gz < z0 + CHUNK; gz += G) for (let gx = x0 + G / 2; gx < x0 + CHUNK; gx += G) {
    const x = gx + (rand() - 0.5) * 1.6, z = gz + (rand() - 0.5) * 1.6, keep = rand() < 0.85, pine = rand() < 0.45, alt = rand() < 0.5, s = 0.95 + rand() * 0.55;
    if (!keep || !open(x, z, 1)) continue;
    const name = 'kit_' + (pine ? (alt ? 'fir_slender' : 'fir') : (alt ? 'oak_tall' : 'oak')), h = hash2(x, z), k = hash2(z, x), sx = s * (pine ? 0.95 : 1.05);
    const m = new THREE.Matrix4().compose(new V3(x, terrainH(x, z), z), _cq.setFromEuler(_ce.set(0, h * 6.28, 0)), new V3(sx * (0.95 + k * 0.1), sx * (0.9 + h * 0.2), sx * (0.95 + k * 0.1)));
    m.tint = new THREE.Color(0.88 + h * 0.22, 0.9 + k * 0.18, 0.88 + h * 0.16); // as kitTree
    (kits[name] ||= []).push(m); trees.push([x, z, (pine ? 0.8 : 1.0) * s]);
  }
  const blade = (list, geo, cols, x, z, y0, s, w) => { // one grass instance, coloured like scatter() does
    _co.position.set(x, terrainH(x, z) + y0, z); _co.rotation.set(0, rand() * 6.28, 0); _co.scale.set(w + rand() * 0.4, s, w + rand() * 0.4); _co.updateMatrix();
    _cc.set(cols[Math.floor(rand() * cols.length)]); if (geo.userData.floraNatural) _cc.lerp(_white, 0.9);
    list.push([_co.matrix.clone(), _cc.multiplyScalar(0.92 + rand() * 0.13).clone()]);
  };
  for (let i = 0; i < 120; i++) {
    const x = x0 + rand() * CHUNK, z = z0 + rand() * CHUNK;
    if (rand() > GRASS_DENSITY || inRect(x, z, OLD_FILL) || routeD(x, z) < PATH_W + 0.2 || inRouteGrass(x, z) || trees.some(([tx, tz]) => (tx - x) ** 2 + (tz - z) ** 2 < 0.8)) continue;
    blade(tufts, SHORT_GEO, TUFT_COLS, x, z, -0.02, 0.22 + rand() * 0.26, 0.9);
  }
  for (const [gx, gz, r] of ROUTE_GRASS) { // about 6 blades per m² where a patch overlaps this cell
    const bx0 = Math.max(x0, gx - r), bx1 = Math.min(x0 + CHUNK, gx + r), bz0 = Math.max(z0, gz - r), bz1 = Math.min(z0 + CHUNK, gz + r);
    if (bx0 >= bx1 || bz0 >= bz1) continue;
    for (let i = Math.round((bx1 - bx0) * (bz1 - bz0) * 6); i--;) {
      const x = bx0 + rand() * (bx1 - bx0), z = bz0 + rand() * (bz1 - bz0);
      if (inRouteGrass(x, z)) blade(tall, TALL_GEO, TALL_COLS, x, z, -0.03, 0.7 + rand() * 0.45, 1);
    }
  }
  const pairs = Object.entries(kits).flatMap(([name, ms]) => instanceInto(name, ms, parent, farLod));
  instancedCells(SHORT_GEO, CELL_SWAY, tufts, parent); instancedCells(TALL_GEO, CELL_SWAY, tall, parent);
  return { trees, pairs };
}
// core cells reach past the old forest fill (to the 16 m grid): fill that band the same way, so the forest has no bald edge
for (let cz = cellOf(TZ0); cz <= cellOf(TZ1 - 1e-6); cz++) for (let cx = cellOf(TX0); cx <= cellOf(TX1 - 1e-6); cx++) {
  const { trees, pairs } = fillCell(cx, cz, cellRand(cx, cz), scene);
  if (pairs.length) LOD_CHUNKS.push({ pts: trees.map(([x, z]) => [x, z]), pairs, near: null });
}

export { cellRand, fillCell };
