import './04-river.js'; // first: the modules run in file-number order (see main.js)
import { catmull, clamp, inPoly, segD, smooth } from './01-helpers.js';
import { I, VS } from './02-hero-camera.js';
import { ROOM_X, inKField, inKalos, inRect, kalosH } from './03-fleurville-map.js';
import { RV, riverInfo } from './04-river.js';

// ============================================================ paths, raised plaza, stairs, tall grass
const extend = (pts, dist) => { const a = pts[pts.length - 2], b = pts[pts.length - 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [...pts, [b[0] + (b[0] - a[0]) / l * dist, b[1] + (b[1] - a[1]) / l * dist]]; };
// The old glade off the road, where the clearing first stood: the trail and the core forest fill still leave it open, so moving
// the clearing up Route 1 doesn't reshuffle the core's shared random stream.
const OLD_CLEAR = { x: VS(19), z: VS(3), r: 5.5 };
const OLD_FILL = [-34, -28, 34, 18].map(VS); // where the core forest fill samples the ground: Route 1 may not reshape it (see terrainH)
const PATHS = [
  catmull([I(560, 450), I(655, 420), I(755, 398), I(880, 478), I(1010, 530), I(1100, 576)], 6),
  catmull(extend([I(1425, 500), I(1500, 452), I(1565, 407), I(1650, 352)], 18), 6),
  catmull([I(1607, 380), [15, 1.2], [OLD_CLEAR.x - 2.5, OLD_CLEAR.z]], 6), // trail from the road into the old glade
];
const PATH_W = 1.0;
function pathD(x, z) {
  let m = 1e9;
  for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) { const d = segD(x, z, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]); if (d < m) m = d; }
  return m;
}
// Route 1 (Meadow Route) carries on from the end of the road, north on the east side of the river, to the Woodland Clearing.
// Walking, tall grass and the path are functions of routeD alone, so collision and encounters never wait for a streamed cell.
const ROUTE_HALF = 5; // walkable half width of the route corridor; the forest starts just past it
const ROUTE1_CTRL = (([x, z]) => [[x, z], [x + 4, z - 20], [x - 3, z - 45], [x + 6, z - 70], [x + 2, z - 95], [x + 10, z - 115]])(PATHS[1].at(-1));
const ROUTE1 = catmull(ROUTE1_CTRL, 6);
const ROUTE1_BOX = ROUTE1.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [1e9, 1e9, -1e9, -1e9]);
function routeD(x, z) {
  const m = ROUTE_HALF + 2;
  if (x < ROUTE1_BOX[0] - m || x > ROUTE1_BOX[2] + m || z < ROUTE1_BOX[1] - m || z > ROUTE1_BOX[3] + m) return 1e9;
  let d = 1e9;
  for (let i = 0; i < ROUTE1.length - 1; i++) d = Math.min(d, segD(x, z, ...ROUTE1[i], ...ROUTE1[i + 1]));
  return d;
}
const CLEAR = { x: ROUTE1.at(-1)[0], z: ROUTE1.at(-1)[1] - 7, r: 6.5 }; // the Woodland Clearing at the end of Route 1: the signal device stands in it
// three tall-grass patches beside the path, a quarter, half and three quarters of the way up (alternating sides)
const ROUTE_GRASS = [0.25, 0.5, 0.75].map((f, i) => {
  const k = Math.round(f * (ROUTE1.length - 1)), a = ROUTE1[k - 1], b = ROUTE1[k + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]), s = i % 2 ? -1 : 1;
  return [ROUTE1[k][0] + s * (b[1] - a[1]) / l * 2.5, ROUTE1[k][1] - s * (b[0] - a[0]) / l * 2.5, 3.5];
});
const inRouteGrass = (x, z) => ROUTE_GRASS.some(([gx, gz, r]) => (x - gx) ** 2 + (z - gz) ** 2 < r * r) && routeD(x, z) > PATH_W + 0.3;
const VERDANT_WALK = [-24, -20, 26, 14].map(VS); // the town and the meadow by the road
const verdantWalkable = (x, z) => inRect(x, z, VERDANT_WALK) || routeD(x, z) < ROUTE_HALF || Math.hypot(x - CLEAR.x, z - CLEAR.z) < CLEAR.r;
const PLAZA_H = 1.0;
// Test Grounds (testing only): a flat lot far west of Verdant, beyond the camera's far plane like Fleurville, so the story maps carry
// no test props. It holds the warp pads to every map and room, the Character Gallery and (east wing) the low-poly tree kit.
// G goes there and back; ?map=test starts there.
const TX = -300, T_WALK = [TX - 14, -14, TX + 30, 10], T_SPAWN = [TX, 8];
const inTest = x => x < TX + 60;
// Character Gallery: every trainer / NPC model stands in rows at the north end of the Test Grounds
const GALLERY = { x0: TX - 11, x1: TX + 11, z0: -13, z1: -1, h: 0 };
const galleryD = (x, z) => Math.max(GALLERY.x0 - x, x - GALLERY.x1, GALLERY.z0 - z, z - GALLERY.z1); // < 0 inside
const STA = I(620, 345, PLAZA_H), STB = I(705, 298, PLAZA_H);
const EDGE = [I(150, 415, PLAZA_H), I(505, 450, PLAZA_H), STA, STB, I(812, 262, PLAZA_H), I(1085, 338, PLAZA_H), I(1205, 352, PLAZA_H)];
EDGE.unshift([EDGE[0][0] - 40, EDGE[0][1] + 0.4]);
const RAISE = [...EDGE];
for (const p of RV) if (p[1] < EDGE[EDGE.length - 1][1] - 0.3) RAISE.push([p[0] - p[3] - 0.2, p[1]]);
RAISE.push([RAISE[RAISE.length - 1][0], -400], [-80, -400]); // far north, so the plaza level never ends in a cliff beside Route 1
const raised = (x, z) => inPoly(x, z, RAISE);
const STAIR = (() => {
  const ux = STB[0] - STA[0], uz = STB[1] - STA[1], len = Math.hypot(ux, uz);
  let nx = uz / len, nz = -ux / len;
  if (inPoly((STA[0] + STB[0]) / 2 + nx * 0.3, (STA[1] + STB[1]) / 2 + nz * 0.3, RAISE)) { nx = -nx; nz = -nz; }
  return { ax: STA[0], az: STA[1], ux: ux / len, uz: uz / len, nx, nz, len, run: 1.3, steps: 5 };
})();
function stairsH(x, z) {
  const dx = x - STAIR.ax, dz = z - STAIR.az, v = dx * STAIR.ux + dz * STAIR.uz, u = dx * STAIR.nx + dz * STAIR.nz;
  if (v < 0.02 || v > STAIR.len - 0.02 || u <= 0 || u >= STAIR.run) return null;
  return PLAZA_H * (1 - Math.ceil(u / STAIR.run * STAIR.steps) / STAIR.steps);
}
const COBBLE_X = I(830, 200, PLAZA_H)[0] - 0.4;
const inCobble = (x, z) => x < COBBLE_X && z > VS(-16) && x > VS(-22) && raised(x, z);
const TALL = [[170, 462], [500, 458], [630, 482], [900, 618], [865, 715], [700, 715], [560, 800], [330, 692], [250, 640], [160, 560]].map(p => I(p[0], p[1], 0));
const inTallGrass = (x, z) => inKalos(x) ? inKField(x, z) : inPoly(x, z, TALL) && pathD(x, z) > PATH_W + 0.3 || inRouteGrass(x, z);
const MOUND = I(1000, 372, 0.2);
const HILL_A = I(1285, 300, 0), HILL_B = I(1672, 262, 0);
function hillH(x, z) {
  if (x < HILL_A[0] - 0.6) return 0;
  const tx = HILL_B[0] - HILL_A[0], tz = HILL_B[1] - HILL_A[1], l = Math.hypot(tx, tz);
  const north = -((x - HILL_A[0]) * (-tz / l) + (z - HILL_A[1]) * (tx / l)); // signed distance to the north of the line
  return 1.0 * smooth(-0.2, 2.6, north) * smooth(HILL_A[0] - 0.6, HILL_A[0] + 0.6, x);
}
const noise = (x, z) => Math.sin(x * 0.31 + 1.3) * Math.cos(z * 0.27) * 0.12 + Math.sin(x * 0.83 + z * 0.61) * 0.05 + Math.cos(x * 0.57 - z * 0.91) * 0.04;

function terrainH(x, z) {
  if (x > ROOM_X - 40 || inTest(x)) return 0; // interiors, Test Grounds
  if (inKalos(x)) return kalosH(x, z);
  let h;
  const st = stairsH(x, z);
  if (st !== null) h = st;
  else if (raised(x, z)) h = PLAZA_H + (inCobble(x, z) ? 0 : noise(x, z) * 0.6);
  else {
    const pd0 = pathD(x, z), out = Math.max(OLD_FILL[0] - x, x - OLD_FILL[2], OLD_FILL[1] - z, z - OLD_FILL[3]);
    const pd = out > 0 ? pd0 + (Math.min(pd0, routeD(x, z)) - pd0) * smooth(0, 3, out) : pd0; // Route 1 smooths the ground only outside the core fill (blended over 3 m), so the fill's draws never change
    h = noise(x, z) * (0.25 + 0.75 * smooth(PATH_W, PATH_W + 1.6, pd));
    h += 0.32 * smooth(1.9, 0.2, Math.hypot(x - MOUND[0], z - MOUND[1]));
    h += hillH(x, z);
  }
  const r = riverInfo(x, z);
  if (r.d < r.hw + 0.7) {
    const bed = r.level - 0.55;
    h = bed + (h - bed) * smooth(r.hw - 0.35, r.hw + 0.7, r.d);
  }
  return h;
}

// bridge (local x runs along the deck)
const BRIDGE = (() => {
  const a = I(1095, 578, 0.15), b = I(1430, 498, 0.15);
  const ux0 = b[0] - a[0], uz0 = b[1] - a[1], l = Math.hypot(ux0, uz0), ux = ux0 / l, uz = uz0 / l, ext = 0.3;
  return { ax: a[0] - ux * ext, az: a[1] - uz * ext, ux, uz, nx: -uz, nz: ux, len: l + ext * 2, w: 1.5 };
})();
function bridgeLocal(x, z) { const dx = x - BRIDGE.ax, dz = z - BRIDGE.az; return [dx * BRIDGE.ux + dz * BRIDGE.uz, dx * BRIDGE.nx + dz * BRIDGE.nz]; }
const onBridge = (x, z) => { const [lx, lz] = bridgeLocal(x, z); return lx > 0 && lx < BRIDGE.len && Math.abs(lz) < BRIDGE.w / 2; };
const bridgeH = lx => 0.08 + 0.32 * Math.sin(Math.PI * clamp(lx / BRIDGE.len, 0, 1));
const walkH = (x, z) => onBridge(x, z) ? bridgeH(bridgeLocal(x, z)[0]) + 0.05 : terrainH(x, z);

export { BRIDGE, CLEAR, EDGE, GALLERY, HILL_A, MOUND, OLD_CLEAR, OLD_FILL, PATH_W, PLAZA_H, ROUTE1, ROUTE_GRASS, ROUTE_HALF, STA,
  STAIR, TX, T_SPAWN, T_WALK, VERDANT_WALK, bridgeH, galleryD, hillH, inCobble, inRouteGrass, inTallGrass, inTest, noise, onBridge,
  pathD, raised, routeD, stairsH, terrainH, verdantWalkable, walkH };
