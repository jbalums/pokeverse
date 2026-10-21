import * as THREE from 'three';

// ============================================================ helpers
let seed = 20261016;
function rnd() { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const rr = (a, b) => a + (b - a) * rnd();
const pick = a => a[Math.floor(rnd() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Shared squash and stretch: sy > 1 stretches, sy < 1 squashes, the other two axes keep the volume.
function squash(o, sy, base = 1) { const k = base / Math.sqrt(sy); o.scale.set(k, base * sy, k); }
function approach(v, target, step) { return v < target ? Math.min(target, v + step) : Math.max(target, v - step); }
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hash2 = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
const hash3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 269.5 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
const V3 = THREE.Vector3;
function segD(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return Math.hypot(ax + dx * t - px, az + dz * t - pz);
}
function inPoly(x, z, P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const xi = P[i][0], zi = P[i][1], xj = P[j][0], zj = P[j][1];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
}
// Catmull-Rom through [x, z, ...extras]; extras are interpolated linearly
function catmull(pts, n = 8) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      const q = [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
      for (let e = 2; e < p1.length; e++) q.push(p1[e] + (p2[e] - p1[e]) * t);
      out.push(q);
    }
  }
  out.push([...pts[pts.length - 1]]);
  return out;
}

// other modules assign these through their setters (an imported binding is read-only)
function setSeed(v) { return (seed = v); }
export { V3, approach, catmull, clamp, hash2, hash3, inPoly, pick, rnd, rr, seed, segD, setSeed, smooth, squash, wrapAngle };
