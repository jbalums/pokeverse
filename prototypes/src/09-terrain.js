import './08-blender-assets.js'; // first: the modules run in file-number order (see main.js)
import * as THREE from 'three';
import { V3, clamp, hash2, smooth } from './01-helpers.js';
import { VS } from './02-hero-camera.js';
import { riverInfo } from './04-river.js';
import { PATH_W, inCobble, inTallGrass, pathD, raised, routeD, stairsH, terrainH } from './05-paths-raised-plaza-stairs-tall-grass.js';
import { scene } from './06-renderer-scene-post.js';
import { cobbleTex, detailTex } from './07-materials-textures.js';
import { CHUNK } from './08-blender-assets.js';

// ============================================================ terrain
const TX0 = VS(-36), TX1 = VS(36), TZ0 = VS(-30), TZ1 = VS(20), TRES = 0.16;
function groundMat(cobTex) { // vertex-coloured grass with a detail texture; vertices flagged aCob = 1 show the paving texture instead
  const tm = new THREE.MeshLambertMaterial({ vertexColors: true });
  tm.onBeforeCompile = s => {
    s.uniforms.uDetail = { value: detailTex }; s.uniforms.uCob = { value: cobTex };
    s.vertexShader = 'attribute float aCob; varying float vCob; varying vec2 vWXZ;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vCob = aCob; vWXZ = position.xz;');
    s.fragmentShader = 'uniform sampler2D uDetail; uniform sampler2D uCob; varying float vCob; varying vec2 vWXZ;\n' + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec3 det = texture2D(uDetail, vWXZ * 0.55).rgb * texture2D(uDetail, vWXZ * 0.13 + 0.37).rgb;
      vec3 cob = texture2D(uCob, vWXZ * 0.42).rgb;
      diffuseColor.rgb = mix(diffuseColor.rgb * det * 1.28, cob * 1.04, vCob);`);
  };
  return tm;
}
// The ground is built in CHUNK cells (one mesh each), so the camera culls the cells it can't see.
const cellOf = v => Math.floor(v / CHUNK), cellKey = (cx, cz) => cx + ',' + cz;
const CORE_RECT = [TX0, TZ0, TX1, TZ1]; // core cells (overlapping it) are built once at start-up, at full ground resolution
const isCoreCell = (cx, cz) => (cx + 1) * CHUNK > CORE_RECT[0] && cx * CHUNK < CORE_RECT[2] && (cz + 1) * CHUNK > CORE_RECT[1] && cz * CHUNK < CORE_RECT[3];
const GROUND = []; // every walkable ground mesh, for click-to-walk
const GROUND_MAT = groundMat(cobbleTex);
const C = s => new THREE.Color(s);
const grassA = C('#7cb843'), grassB = C('#62a235'), grassC = C('#a2cf55'), grassD = C('#4f8f2e');
const dirtA = C('#d6ad74'), dirtB = C('#e5c48f'), rockA = C('#8e8a7f'), rockB = C('#6c6a60'), moss = C('#6f9a3a'), bed = C('#2f5650'), tallC = C('#3f7f2a');
function terrainCell(cx, cz, res) {
  // Heights come from terrainH on a grid with one extra sample past each edge, so slopes and normals at a cell's edge match
  // its neighbour's exactly (no lighting seam). A skirt ring (the edge vertices again, 0.4 m lower) hides cracks where a
  // cell meets one of another resolution.
  const n = Math.round(CHUNK / res), step = CHUNK / n, x0 = cx * CHUNK, z0 = cz * CHUNK, W = n + 3;
  const H = new Float32Array(W * W);
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) H[j * W + i] = terrainH(x0 + (i - 1) * step, z0 + (j - 1) * step);
  const pos = new Float32Array(W * W * 3), nrm = new Float32Array(W * W * 3), cols = new Float32Array(W * W * 3), cob = new Float32Array(W * W);
  const c = new THREE.Color(), t = new THREE.Color(), nv = new V3();
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
    const gi = clamp(i - 1, 0, n), gj = clamp(j - 1, 0, n), v = j * W + i, k = (gj + 1) * W + gi + 1;
    const x = x0 + gi * step, z = z0 + gj * step, h = H[k];
    const hL = H[k - 1], hR = H[k + 1], hU = H[k - W], hD = H[k + W];
    pos.set([x, gi === i - 1 && gj === j - 1 ? h : h - 0.4, z], v * 3);
    nv.set(-(hR - hL) / (2 * step), 1, -(hD - hU) / (2 * step)).normalize(); nrm.set([nv.x, nv.y, nv.z], v * 3);
    const slope = Math.hypot(hR - hL, hD - hU) / (2 * step);
    const hv = hash2(x, z), r = riverInfo(x, z);
    if (inCobble(x, z) || stairsH(x, z) !== null) { cob[v] = 1; c.set('#cfc5b2'); }
    else if (r.d < r.hw + 0.15 && h < r.level + 0.05) c.copy(bed).lerp(rockB, hv * 0.4);
    else if (slope > 1.25) { c.copy(rockA).lerp(rockB, hv * 0.7 + smooth(1.2, 3, slope) * 0.3); if (hU < h + 0.05) c.lerp(moss, 0.25); }
    else {
      const big = Math.sin(x * 0.55 + Math.cos(z * 0.4)) * Math.cos(z * 0.47 - x * 0.2);
      c.copy(grassA).lerp(grassB, smooth(-0.5, 0.7, big)).lerp(grassC, smooth(0.2, 1, -big) * 0.55 + hv * 0.12);
      if (inTallGrass(x, z)) c.lerp(tallC, 0.55);
      if (!raised(x, z)) {
        const pd = Math.min(pathD(x, z), routeD(x, z)) + (Math.sin(x * 4.1) * Math.cos(z * 3.7)) * 0.18 + (hv - 0.5) * 0.22;
        if (pd < PATH_W + 0.45) c.lerp(t.copy(dirtA).lerp(dirtB, smooth(PATH_W, 0, pd) * 0.6 + hv * 0.2), 1 - smooth(PATH_W - 0.1, PATH_W + 0.45, pd));
      }
      if (r.d < r.hw + 1.1) c.lerp(grassD, (1 - smooth(r.hw + 0.3, r.hw + 1.1, r.d)) * 0.5);
    }
    c.multiplyScalar(0.94 + hv * 0.1);
    cols[v * 3] = c.r; cols[v * 3 + 1] = c.g; cols[v * 3 + 2] = c.b;
  }
  const idx = [];
  for (let j = 0; j < W - 1; j++) for (let i = 0; i < W - 1; i++) { const a = j * W + i, b = a + 1, d = a + W; idx.push(a, d, b, b, d, d + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.setAttribute('aCob', new THREE.BufferAttribute(cob, 1));
  g.setIndex(idx); g.userData.owned = true;
  const m = new THREE.Mesh(g, GROUND_MAT); m.receiveShadow = true; m.userData.cell = [cx, cz];
  return m;
}
for (let cz = cellOf(TZ0); cz <= cellOf(TZ1 - 1e-6); cz++) for (let cx = cellOf(TX0); cx <= cellOf(TX1 - 1e-6); cx++) {
  const m = terrainCell(cx, cz, TRES); scene.add(m); GROUND.push(m);
}

export { GROUND, TX0, TX1, TZ0, TZ1, cellKey, cellOf, groundMat, isCoreCell, terrainCell };
