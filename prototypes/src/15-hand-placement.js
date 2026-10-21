import './14-buildings.js'; // first: the modules run in file-number order (see main.js)
import { V3, rnd, rr, smooth } from './01-helpers.js';
import { I, SPREAD, START, VS, heroCam } from './02-hero-camera.js';
import { RV, riverInfo } from './04-river.js';
import { OLD_CLEAR, PATH_W, PLAZA_H, ROUTE_HALF, inCobble, inTallGrass, onBridge, pathD, raised, routeD, stairsH, terrainH } from './05-paths-raised-plaza-stairs-tall-grass.js';
import { instQueue } from './08-blender-assets.js';
import { ROCKS_IN_WATER, waterMat } from './11-water.js';
import { boxes, circles, trees } from './12-batched-props.js';
import { bush, fence, fillTree, lamp, planter, rock } from './13-flora.js';

// ============================================================ hand placement (traced from the reference)
const P0 = (px, py, h = 0) => I(px, py, h);
for (const [px, py] of [[50, 292], [535, 312], [608, 102], [652, 130], [690, 48], [1086, 82]]) { const [x, z] = P0(px, py, PLAZA_H); lamp(x, z, raised(x, z) ? PLAZA_H : undefined); }
{ const [x, z] = P0(1475, 470, 0); lamp(x, z); }
for (const [px, py, s, cols] of [[112, 290, 1], [190, 288, 1], [372, 262, 0.95], [575, 300, 1.25, ['#ffffff', '#ffffff', '#fff7c2']], [455, 228, 0.9], [835, 228, 0.9], [995, 248, 0.9], [1040, 215, 0.8]])
  { const [x, z] = P0(px, py, PLAZA_H); planter(x, z, s, undefined, cols); }

fence(P0(150, 412), P0(505, 448));
fence(P0(636, 470), P0(905, 605));
fence(P0(335, 682), P0(662, 945));
fence(P0(862, 205, PLAZA_H), P0(1030, 286, PLAZA_H), PLAZA_H);
fence(P0(1462, 556), P0(1625, 500));
fence(P0(60, 326, PLAZA_H), P0(205, 352, PLAZA_H), PLAZA_H);

const T = (px, py, h, kind, s) => { const [x, z] = P0(px, py, h); fillTree(x, z, s, kind === 'fir'); }; // the hero view's traced trees
T(600, 484, 0, 'oak', 1.0);
T(1138, 272, PLAZA_H, 'fir', 1.55);
T(190, 570, 0, 'fir', 1.35);
T(935, 905, 0, 'fir', 1.55);
T(1050, 940, 0, 'fir', 1.1);
T(470, 96, PLAZA_H, 'fir', 1.15);
T(405, 40, PLAZA_H, 'fir', 1.1);
T(20, 70, PLAZA_H, 'oak', 1.2);
T(735, 60, PLAZA_H, 'oak', 1.0);
T(1110, 45, PLAZA_H, 'oak', 1.15);
T(1200, 125, PLAZA_H, 'oak', 1.0);
T(1290, 75, PLAZA_H, 'oak', 1.15);
T(1560, 70, 0.9, 'oak', 1.3);
T(1640, 170, 0.9, 'oak', 1.15);
T(1650, 545, 0, 'oak', 1.2);
T(90, 650, 0, 'oak', 1.35);
T(200, 830, 0, 'oak', 1.45);
T(40, 880, 0, 'oak', 1.2);
T(300, 945, 0, 'oak', 1.1);
for (const [px, py, s, fl] of [[480, 905, 1.3, 0], [580, 935, 1.1, '#ffffff'], [800, 900, 1.1, 0], [1600, 640, 1.2, '#b89cff'], [1500, 595, 0.9, '#ffffff'], [1660, 780, 1.2, 0], [920, 335, 0.8, '#ffffff'], [1050, 420, 0.75, '#b89cff'], [835, 330, 0.9, 0], [1180, 300, 0.7, '#ffffff'], [1440, 410, 0.7, '#b89cff']])
  { const [x, z] = P0(px, py, 0.2); bush(x, z, s, fl); }
for (const [px, py, s] of [[100, 360, 0.8], [250, 378, 0.9], [380, 392, 0.85], [600, 335, 0.7]]) { const [x, z] = P0(px, py, PLAZA_H); bush(x, z, s, '#ffffff', PLAZA_H); }
for (const [px, py, s] of [[722, 748, 0.36], [776, 772, 0.3], [700, 776, 0.22], [380, 895, 0.6], [1105, 800, 0.4], [1160, 870, 0.45], [1150, 470, 0.35], [1195, 520, 0.3]]) { const [x, z] = P0(px, py, 0); rock(x, z, s); }
for (const [px, py, s] of [[1265, 728, 0.3], [1240, 842, 0.3], [1350, 835, 0.34], [1300, 885, 0.26], [1530, 722, 0.3], [1585, 760, 0.26], [1270, 470, 0.18]]) {
  const [x, z] = P0(px, py, -0.7); rock(x, z, s, -0.72); ROCKS_IN_WATER.push(new V3(x, z, s * 1.1));
}
ROCKS_IN_WATER.forEach((r, i) => waterMat.uniforms.uRocks.value[i].copy(r));
// rocky banks
for (let i = 0; i < RV.length; i += 1) {
  const p = RV[i]; if (p[1] < VS(-9) || p[1] > VS(14)) continue;
  for (const side of [-1, 1]) {
    const a = RV[Math.max(0, i - 1)], b = RV[Math.min(RV.length - 1, i + 1)], tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz);
    const off = p[3] + rr(0.1, 0.45), x = p[0] + side * (tz / l) * off, z = p[1] - side * (tx / l) * off;
    if (onBridge(x, z) || rnd() < 0.35) continue;
    rock(x, z, rr(0.2, 0.42), Math.max(terrainH(x, z), p[2]) - 0.12);
  }
}

// forest fill outside the reference frame
function inHeroView(x, z, h = 0) { const v = new V3(x / SPREAD, h, z / SPREAD).project(heroCam); return Math.abs(v.x) < 1.04 && Math.abs(v.y) < 1.06; }
function freeSpot(x, z, r = 1) {
  const ri = riverInfo(x, z); if (ri.d < ri.hw + 1.0 || Math.hypot(x - OLD_CLEAR.x, z - OLD_CLEAR.z) < OLD_CLEAR.r) return false; // the old glade
  if (pathD(x, z) < PATH_W + 0.9 || inTallGrass(x, z) || stairsH(x, z) !== null || inCobble(x, z) || onBridge(x, z)) return false;
  for (const b of boxes) if (x > b.x0 - 1 && x < b.x1 + 1 && z > b.z0 - 1 && z < b.z1 + 1) return false;
  for (const [tx, tz, tr] of trees) if (Math.hypot(tx - x, tz - z) < tr + r) return false;
  const h = terrainH(x, z);
  for (const [dx, dz] of [[0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]]) if (Math.abs(terrainH(x + dx, z + dz) - h) > 0.3) return false;
  return true;
}
for (let i = 0; i < 1500 * SPREAD; i++) {
  const x = rr(VS(-34), VS(34)), z = rr(VS(-28), VS(18));
  if (inHeroView(x, z) || !freeSpot(x, z, 0.9)) continue;
  const d = Math.hypot(x - START[0], (z - START[1]) * 1.3);
  if (rnd() > smooth(VS(7), VS(16), d) * 0.9) continue;
  const s = rr(0.95, 1.5);
  fillTree(x, z, s, rnd() < 0.45);
}
for (let i = 0; i < 160 * SPREAD; i++) { const x = rr(VS(-26), VS(26)), z = rr(VS(-20), VS(14)); if (!inHeroView(x, z) && freeSpot(x, z, 0.4)) bush(x, z, rr(0.6, 1.1), rnd() < 0.5); }
// Route 1 cuts through the edge of the core forest: the fill above stays exactly as it was (its draws feed everything after it),
// then the trees and shrubs standing in the corridor are taken out (their trunks stop blocking, the minimap drops them).
for (const [name, list] of Object.entries(instQueue)) if (name.startsWith('kit_')) instQueue[name] = list.filter(m => routeD(m.elements[12], m.elements[14]) > ROUTE_HALF);
for (const c of circles) if (routeD(c.x, c.z) < ROUTE_HALF) c.cleared = true;

export { inHeroView };
