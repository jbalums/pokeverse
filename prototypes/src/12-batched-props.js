import './11-water.js'; // first: the modules run in file-number order (see main.js)
import * as THREE from 'three';
import { V3, clamp, hash3, rnd, smooth } from './01-helpers.js';
import { SUN_DIR } from './06-renderer-scene-post.js';

// ============================================================ batched props (one draw call per material)
const batches = {};
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color(), _v = new V3(), _n = new V3();
// colorFn(worldPos, worldNormal, out) fills `out` (a THREE.Color); a plain color string is used flat with per-face jitter
function addB(key, geo, color, pos, rot = [0, 0, 0], scl = [1, 1, 1], jitter = 0.06) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (color === null && g.hasAttribute('color')) { // keep the new flora's authored stem, leaf, petal and pollen colours
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    g.applyMatrix4(_m.compose(_v.set(...pos), _q.setFromEuler(_e.set(...rot)), new V3(...scl)));
    (batches[key] ||= []).push(g); return;
  }
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  g.applyMatrix4(_m.compose(_v.set(...pos), _q.setFromEuler(_e.set(...rot)), new V3(...scl)));
  const P = g.attributes.position, N = g.attributes.normal, n = P.count, cols = new Float32Array(n * 3);
  const base = typeof color === 'string' ? new THREE.Color(color) : null;
  let j = 1;
  for (let i = 0; i < n; i++) {
    if (base) { if (i % 3 === 0) j = 1 + (rnd() - 0.5) * jitter * 2; _c.copy(base).multiplyScalar(j); }
    else color(_v.fromBufferAttribute(P, i), _n.fromBufferAttribute(N, i), _c);
    cols[i * 3] = _c.r; cols[i * 3 + 1] = _c.g; cols[i * 3 + 2] = _c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  (batches[key] ||= []).push(g);
}
function blobGeo(wseg, hseg, amp, sy = 1) {
  const g = new THREE.SphereGeometry(1, wseg, hseg), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + (hash3(Math.round(x * 50), Math.round(y * 50), Math.round(z * 50)) - 0.5) * amp + Math.sin(x * 5 + z * 3) * amp * 0.25;
    p.setXYZ(i, x * k, y * k * sy, z * k);
  }
  g.computeVertexNormals();
  return g;
}
const LEAF_BALLS = [blobGeo(12, 9, 0.22), blobGeo(12, 9, 0.28), blobGeo(10, 8, 0.25)];
const ROCK_GEOS = [blobGeo(9, 7, 0.5, 0.7), blobGeo(8, 6, 0.45, 0.65), blobGeo(10, 7, 0.38, 0.75)];
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10);
const SUNC = new THREE.Color('#f2f08a');

const boxes = [], circles = [], segs = [], trees = [];
function foliageColor(base, y0, hgt) {
  const b = new THREE.Color(base), dark = b.clone().multiplyScalar(0.6), warm = b.clone().lerp(SUNC, 0.55);
  return (p, nrm, out) => {
    const t = clamp((p.y - y0) / hgt, 0, 1);
    out.copy(dark).lerp(b, smooth(0, 0.75, t)).lerp(warm, Math.max(0, nrm.dot(SUN_DIR)) * 0.32 * t);
    out.multiplyScalar(0.92 + hash3(Math.round(p.x * 9), Math.round(p.y * 9), Math.round(p.z * 9)) * 0.16);
  };
}

export { BOX, CYL, LEAF_BALLS, ROCK_GEOS, _v, addB, batches, boxes, circles, foliageColor, segs, trees };
