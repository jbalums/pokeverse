import './03-fleurville-map.js'; // first: the modules run in file-number order (see main.js)
import { catmull, clamp } from './01-helpers.js';
import { I } from './02-hero-camera.js';

// ============================================================ river (traced cross-sections: y, left x, right x, water level)
const RIVER_PX = [[941, 1150, 1650, -0.7], [760, 1150, 1520, -0.7], [640, 1165, 1390, -0.7], [540, 1185, 1330, -0.7], [430, 1205, 1300, -0.7], [335, 1215, 1285, -0.7],
  [282, 1228, 1302, -0.15], [235, 1262, 1360, -0.15], [200, 1330, 1430, -0.15], [166, 1395, 1462, 0.55], [110, 1420, 1480, 0.55], [40, 1432, 1492, 0.55]];
let rvPts = RIVER_PX.map(([y, l, r, lv]) => { const a = I(l, y, lv), b = I(r, y, lv); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, lv, Math.abs(b[0] - a[0]) / 2]; });
for (let i = 0; i < rvPts.length; i++) { // horizontal slice -> perpendicular half width
  const a = rvPts[Math.max(0, i - 1)], b = rvPts[Math.min(rvPts.length - 1, i + 1)];
  rvPts[i][3] *= clamp(Math.abs(b[1] - a[1]) / Math.hypot(b[0] - a[0], b[1] - a[1]), 0.55, 1);
}
{ const s = rvPts[0], n = rvPts[rvPts.length - 1]; // extend past the frame, south then north
  rvPts = [[s[0] + 2.5, s[1] + 22, -0.7, 1.4], [s[0] + 1.5, s[1] + 7, -0.7, 1.7], ...rvPts, [n[0] + 0.8, n[1] - 8, 0.55, 0.55], [n[0] + 1.5, n[1] - 30, 0.55, 0.55]];
}
const RV = catmull(rvPts, 10);
const RI = { d: 0, level: 0, hw: 0, s: 0 };
const RV_S = [0]; for (let i = 1; i < RV.length; i++) RV_S.push(RV_S[i - 1] + Math.hypot(RV[i][0] - RV[i - 1][0], RV[i][1] - RV[i - 1][1]));
const RV_BOX = RV.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [1e9, 1e9, -1e9, -1e9]);
const RV_FAR = 14; // past every use of the distance: banks, reeds, flowers, and the brook sound's 12 m fade
function riverInfo(x, z) {
  if (x < RV_BOX[0] - RV_FAR || x > RV_BOX[2] + RV_FAR || z < RV_BOX[1] - RV_FAR || z > RV_BOX[3] + RV_FAR) { // far from the river: skip the segment scan (streamed cells sample this a lot)
    RI.d = 1e3; RI.level = -Infinity; RI.hw = 0; RI.s = 0; return RI;
  }
  let best = 1e9, bi = 0, bt = 0;
  for (let i = 0; i < RV.length - 1; i++) {
    const a = RV[i], b = RV[i + 1], dx = b[0] - a[0], dz = b[1] - a[1];
    let t = ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz); t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = a[0] + dx * t - x, ez = a[1] + dz * t - z, d2 = ex * ex + ez * ez;
    if (d2 < best) { best = d2; bi = i; bt = t; }
  }
  const a = RV[bi], b = RV[bi + 1];
  RI.d = Math.sqrt(best); RI.level = a[2] + (b[2] - a[2]) * bt; RI.hw = a[3] + (b[3] - a[3]) * bt; RI.s = RV_S[bi] + (RV_S[bi + 1] - RV_S[bi]) * bt;
  return RI;
}

export { RV, RV_S, riverInfo };
