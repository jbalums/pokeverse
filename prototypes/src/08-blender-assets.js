import './07-materials-textures.js'; // first: the modules run in file-number order (see main.js)
import * as THREE from 'three';
import { V3 } from './01-helpers.js';
import { GLSL_NOISE, scene } from './06-renderer-scene-post.js';
import { TREE_KIT } from './13-flora.js';
import { P } from './19-characters.js';

// ============================================================ Blender assets (prototypes/blender/build_assets.py -> verdant-assets.js)
const leafMat = new THREE.MeshLambertMaterial({ vertexColors: true });
leafMat.onBeforeCompile = s => {
  s.vertexShader = 'varying vec3 vLW;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    #ifdef USE_INSTANCING
      vLW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
    #else
      vLW = (modelMatrix * vec4(transformed, 1.0)).xyz;
    #endif`);
  s.fragmentShader = 'varying vec3 vLW;\n' + GLSL_NOISE + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
    float ln = vn3(vLW * 5.0) * 0.5 + vn3(vLW * 14.0) * 0.5;
    diffuseColor.rgb *= 0.72 + 0.6 * ln * ln + 0.1 * ln;`);
};
const AMAT = {
  base: new THREE.MeshLambertMaterial({ vertexColors: true }),
  glow_warm: new THREE.MeshStandardMaterial({ color: '#ffe9b0', emissive: '#ffc35a', emissiveIntensity: 0.8 }),
  glow_blue: new THREE.MeshStandardMaterial({ color: '#9feeff', emissive: '#36c6ff', emissiveIntensity: 1.3, roughness: 0.2 }),
  lamp_glow: new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffc35a', emissiveIntensity: 2.6 }),
};
AMAT.roof = AMAT.shutter = AMAT.base;
const NO_SHADOW = new Set(['glow_warm', 'glow_blue', 'lamp_glow']);
function decodeAssets(src) {
  const lin = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; lin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  const unb64 = (str, Arr) => { const bin = atob(str), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new Arr(u8.buffer); };
  const out = {};
  for (const [name, parts] of Object.entries(src)) out[name] = parts.map(p => {
    const g = new THREE.BufferGeometry(), c8 = unb64(p.col, Uint8Array), col = new Float32Array(c8.length);
    for (let i = 0; i < c8.length; i++) col[i] = lin[c8[i]];
    g.setAttribute('position', new THREE.BufferAttribute(p.q ? Float32Array.from(unb64(p.pos, Int16Array), v => v * p.q) : unb64(p.pos, Float32Array), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(unb64(p.nrm, Int8Array), 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (p.uv) g.setAttribute('uv', new THREE.BufferAttribute(unb64(p.uv, Float32Array), 2));
    g.setIndex(new THREE.BufferAttribute(unb64(p.idx, p.i32 ? Uint32Array : Uint16Array), 1));
    return { mat: p.mat, geo: g };
  });
  return out;
}
const ASSETS = window.VERDANT_ASSETS ? decodeAssets({ ...window.VERDANT_ASSETS.assets, ...window.VERDANT_CHARS.props }) : null; // sculpted trees, bushes, rocks and street props come with the characters
function assetGroup(name, tint = {}) {
  const g = new THREE.Group();
  for (const p of ASSETS[name]) {
    let m = AMAT[p.mat] || AMAT.base;
    if (tint[p.mat]) { m = m.clone(); m.color = new THREE.Color(tint[p.mat]); }
    const mesh = new THREE.Mesh(p.geo, m);
    mesh.castShadow = !NO_SHADOW.has(p.mat); mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}
const instQueue = {};
function placeAsset(name, x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) {
  (instQueue[name] ||= []).push(new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V3(sx, sy, sz)));
}
function lodGeo(geo, cells = 16) { // low-detail copy by vertex clustering: snap vertices to a grid, merge each cell into one averaged vertex, drop collapsed triangles
  geo.computeBoundingBox(); const b = geo.boundingBox, s = b.getSize(new V3()), cell = Math.max(s.x, s.y, s.z) / cells;
  const P = geo.attributes.position, N = geo.attributes.normal, C = geo.attributes.color, src = geo.index.array;
  const ids = new Map(), map = new Int32Array(P.count), acc = [];
  for (let i = 0; i < P.count; i++) {
    const k = Math.floor((P.getX(i) - b.min.x) / cell) + Math.floor((P.getY(i) - b.min.y) / cell) * 1024 + Math.floor((P.getZ(i) - b.min.z) / cell) * 1048576;
    let c = ids.get(k); if (c === undefined) { c = acc.length / 10; ids.set(k, c); acc.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 0); }
    map[i] = c; const o = c * 10;
    acc[o] += P.getX(i); acc[o + 1] += P.getY(i); acc[o + 2] += P.getZ(i); acc[o + 3] += N.getX(i); acc[o + 4] += N.getY(i); acc[o + 5] += N.getZ(i);
    acc[o + 6] += C.getX(i); acc[o + 7] += C.getY(i); acc[o + 8] += C.getZ(i); acc[o + 9]++;
  }
  const n = acc.length / 10, pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 3), tri = [];
  for (let c = 0; c < n; c++) {
    const o = c * 10, w = acc[o + 9];
    let l = Math.hypot(acc[o + 3], acc[o + 4], acc[o + 5]);
    if (l < 1e-4) { acc[o + 3] = acc[o + 5] = 0; acc[o + 4] = l = 1; } // two-sided faces cancelled out: face up (a zero normal is NaN in the shader)
    for (let j = 0; j < 3; j++) { pos[c * 3 + j] = acc[o + j] / w; nrm[c * 3 + j] = acc[o + 3 + j] / l; col[c * 3 + j] = acc[o + 6 + j] / w; }
  }
  for (let i = 0; i < src.length; i += 3) { const a = map[src[i]], bb = map[src[i + 1]], c = map[src[i + 2]]; if (a !== bb && bb !== c && a !== c) tri.push(a, bb, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(tri); return g;
}
// Instanced props (trees, bushes, rocks) go in per-cell instanced meshes, so the camera and the sun's shadow camera both cull what they can't see.
// Big parts (tree crowns ~12-15k triangles) also get a vertex-clustered copy (~2-4k) that stands in beyond LOD_R from the player.
const CHUNK = 16, LOD_R = 17, LOD_CHUNKS = [];
function flushInstances() {
  for (const [name, list] of Object.entries(instQueue)) {
    const cells = new Map();
    for (const m of list) { const k = Math.floor(m.elements[12] / CHUNK) + ',' + Math.floor(m.elements[14] / CHUNK); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(m); }
    for (const ms of cells.values()) {
      const pairs = instanceInto(name, ms);
      if (pairs.length) LOD_CHUNKS.push({ pts: ms.map(m => [m.elements[12], m.elements[14]]), pairs, near: null });
    }
  }
}
function instanceInto(name, ms, parent = scene, lodOf = p => p.lod) { // one cell's instances of a prop -> its InstancedMeshes; returns the [full, low-detail] pairs
  const pairs = [];
  for (const p of TREE_KIT[name] ?? ASSETS[name]) {
    if (p.lod === undefined) p.lod = p.geo.index.count > 12000 ? lodGeo(p.geo) : null;
    const lod = lodOf(p);
    const make = geo => {
      const im = new THREE.InstancedMesh(geo, AMAT[p.mat] || AMAT.base, ms.length);
      ms.forEach((m, i) => { im.setMatrixAt(i, m); if (m.tint) im.setColorAt(i, m.tint); }); // tint: per-instance colour variety at no draw-call cost
      im.castShadow = !NO_SHADOW.has(p.mat); im.receiveShadow = true; // frustumCulled stays on: InstancedMesh culls by its instances' bounds
      parent.add(im); return im;
    };
    const hi = make(p.geo); if (lod) pairs.push([hi, make(lod)]);
  }
  return pairs;
}
const FAR_GEO = new Map(); // forest-fill trees are mostly seen far off in the fog: a much coarser far copy than the kit's own
const farLod = p => FAR_GEO.get(p.geo) ?? FAR_GEO.set(p.geo, lodGeo(p.geo, 6)).get(p.geo);
function lodTick() { // swap each cell between full and low detail by its trees' distance from the player
  for (const c of LOD_CHUNKS) {
    const near = c.pts.some(([x, z]) => Math.hypot(x - P.pos.x, z - P.pos.z) < LOD_R); if (near === c.near) continue; // full detail while any of its trees is close
    c.near = near; for (const [hi, lo] of c.pairs) { hi.visible = near; lo.visible = !near; }
  }
}

export { AMAT, ASSETS, CHUNK, FAR_GEO, LOD_CHUNKS, LOD_R, assetGroup, decodeAssets, farLod, flushInstances, instQueue,
  instanceInto, leafMat, lodTick, placeAsset };
