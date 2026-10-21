import './12-batched-props.js'; // first: the modules run in file-number order (see main.js)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash2, hash3, pick, rnd, rr, seed, setSeed, smooth } from './01-helpers.js';
import { terrainH } from './05-paths-raised-plaza-stairs-tall-grass.js';
import { scene } from './06-renderer-scene-post.js';
import { add } from './07-materials-textures.js';
import { ASSETS, instQueue, placeAsset } from './08-blender-assets.js';
import { BOX, CYL, LEAF_BALLS, ROCK_GEOS, addB, circles, segs, trees } from './12-batched-props.js';

// ============================================================ approved layered-leaf flora (20 October 2026)
// The editable model source lives here. The reusable GLBs in models/verdant-flora-v1 are exported from this SAME builder.
// Closed folded leaves, curved ribbons and cupped petals share one botanical style; no textures, alpha cards or paid generation.
// FLORA_MODEL_SOURCE_BEGIN
function buildFloraModels() {
  const models = {}, tau = Math.PI * 2, v = new THREE.Vector3(), q = new THREE.Quaternion(), m = new THREE.Matrix4();
  const noise = n => { const a = Math.sin(n * 127.1 + 19.7) * 43758.5453; return a - Math.floor(a); };
  const palette = ['#26583a', '#36733c', '#4a8d3e', '#67a843', '#88bd4d'];
  // A closed, shallow folded almond: 40 triangles, a curved midrib, broad shoulders and a tapered drooping tip.
  // All foliage uses this same shape at different scales, including the tree crowns, bushes, clover and flower leaves.
  function leafShape(droop = 0.32, broad = 1) {
    const pos = [0, 0, 0, -0.18 * broad, 0.035, 0.22, 0, 0.105, 0.22, 0.18 * broad, 0.035, 0.22,
      -0.285 * broad, -droop * 0.05, 0.52, 0, 0.12 - droop * 0.05, 0.52, 0.285 * broad, -droop * 0.05, 0.52,
      -0.17 * broad, -droop * 0.45, 0.8, 0, 0.075 - droop * 0.45, 0.8, 0.17 * broad, -droop * 0.45, 0.8, 0, -droop, 1];
    const top = [0, 1, 2, 0, 2, 3];
    for (let a = 1; a <= 4; a += 3) top.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
    top.push(7, 10, 8, 8, 10, 9); const idx = [...top];
    for (let i = 0; i < 11; i++) pos.push(pos[i * 3], pos[i * 3 + 1] - 0.018, pos[i * 3 + 2]);
    for (let i = 0; i < top.length; i += 3) idx.push(top[i + 2] + 11, top[i + 1] + 11, top[i] + 11);
    const rim = [0, 1, 4, 7, 10, 9, 6, 3];
    for (let i = 0; i < rim.length; i++) { const a = rim[i], b = rim[(i + 1) % rim.length]; idx.push(a, a + 11, b, b, a + 11, b + 11); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  function grassRibbon() { // eight triangles per blade; broad, folded and bent, rather than a three-sided needle
    const pos = [0, 0, 0, -0.11, 0.035, 0.32, 0, 0.07, 0.32, 0.11, 0.035, 0.32,
      -0.075, -0.04, 0.7, 0, 0, 0.7, 0.075, -0.04, 0.7, 0, -0.17, 1];
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex([0, 1, 2, 0, 2, 3, 1, 4, 2, 2, 4, 5, 2, 5, 3, 3, 5, 6, 4, 7, 5, 5, 7, 6]); g.computeVertexNormals(); return g;
  }
  const leaf = leafShape(), petal = leafShape(-0.14, 1.35), blade = grassRibbon();
  const stem = new THREE.CylinderGeometry(0.65, 1, 1, 5), seed = new THREE.SphereGeometry(1, 7, 4);
  function part(parts, geo, col, pos, scale = [1, 1, 1], rot = [0, 0, 0]) { parts.push({ geo, col, pos, scale, rot }); }
  function merge(parts) {
    const geometries = parts.map(p => {
      const g = p.geo.clone(); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      g.applyMatrix4(m.compose(v.set(...p.pos), q.setFromEuler(new THREE.Euler(...p.rot, 'YXZ')), new THREE.Vector3(...p.scale)));
      const P = g.attributes.position, N = g.attributes.normal, colors = new Float32Array(P.count * 3), c = new THREE.Color(p.col);
      for (let i = 0; i < P.count; i++) {
        // Gentle midrib / underside shading, no per-vertex speckle or large flat triangle patches.
        const k = 0.87 + Math.max(0, N.getY(i)) * 0.13;
        colors.set([c.r * k, c.g * k, c.b * k], i * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); return g;
    });
    const geo = mergeGeometries(geometries); geometries.forEach(g => g.dispose()); geo.computeBoundingBox(); geo.computeBoundingSphere(); return geo;
  }
  function limb(parts, a, b, radius, color = '#775039') {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), d = end.sub(start), len = d.length();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    const rot = new THREE.Euler().setFromQuaternion(q, 'YXZ');
    part(parts, stem, color, start.addScaledVector(d, len / 2).toArray(), [radius, len, radius], [rot.x, rot.y, rot.z]);
  }
  function crown(parts, center, radius, variant, pink = false, far = false) {
    const rings = far ? [5, 3] : [8, 5, 3];
    rings.forEach((n, tier) => {
      const r = radius * (1.12 - tier * (far ? 0.35 : 0.27));
      for (let j = 0; j < n; j++) {
        const a = j / n * tau + tier * 0.73 + variant, h = noise(j + tier * 71 + variant * 11);
        const col = pink ? ['#d778a4', '#e998b9', '#f5bad0'][Math.min(2, tier)] : palette[Math.min(4, tier + 1 + (h > 0.5 ? 1 : 0))];
        part(parts, leaf, col, [center[0] + Math.sin(a) * r * 0.10, center[1] + tier * radius * 0.32, center[2] + Math.cos(a) * r * 0.10],
          [r * (far ? 1.85 : 1.55), r, r * 1.25], [0.08 + h * 0.12, a, 0]);
      }
    });
    // A small overlapping terminal leaf closes the rosette centre without adding a spherical crown filler.
    part(parts, leaf, pink ? '#f5bad0' : '#88bd4d', [center[0], center[1] + radius * (far ? 0.37 : 0.69), center[2]],
      [radius * 0.7, radius * 0.4, radius * 0.55], [0.1, variant + 1, 0]);
  }
  function tree(variant, pink = false, far = false) {
    const parts = [], wide = variant === 1 ? 1.12 : variant === 2 ? 0.86 : 1, tall = variant === 2 ? 1.12 : 1;
    limb(parts, [0, 0, 0], [0.055, 1.85 * tall, 0], 0.145, pink ? '#805441' : '#775039');
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * tau + variant * 0.67, r = (0.52 + (i % 2) * 0.10) * wide;
      const c = [Math.sin(a) * r, (1.72 + i * 0.1) * tall, Math.cos(a) * r];
      limb(parts, [0.02, 1.02, 0], [c[0], c[1] + 0.18, c[2]], 0.065);
      crown(parts, c, (0.68 + noise(i + variant * 19) * 0.09) * wide, a, pink, far);
    }
    crown(parts, [0.02, 2.24 * tall, -0.05], 0.72 * wide, variant + 0.4, pink, far);
    for (let i = 0; i < 3; i++) { const a = i * tau / 3; limb(parts, [0, 0.22, 0], [Math.sin(a) * 0.26, 0.018, Math.cos(a) * 0.26], 0.065); }
    return merge(parts);
  }
  function fir(variant, far = false) {
    const parts = [], wide = variant === 1 ? 0.83 : 1, tall = variant === 1 ? 1.12 : variant === 2 ? 0.83 : 1;
    limb(parts, [0, 0, 0], [0, 2.54 * tall, 0], 0.105, '#705039');
    for (let tier = 0; tier < 5; tier++) {
      const n = far ? 5 : 8, r = (1.0 - tier * 0.165) * wide;
      for (let j = 0; j < n; j++) {
        const a = j / n * tau + tier * 0.43 + variant;
        part(parts, leaf, ['#245b3d', '#2f7041', '#3e8345', '#50934b', '#6ba751'][tier], [Math.sin(a) * 0.045, (1.05 + tier * 0.4) * tall, Math.cos(a) * 0.045],
          [r * (far ? 2.15 : 1.65), r * 1.1, r * 1.18], [0.30, a, 0]);
      }
    }
    part(parts, leaf, '#76ad53', [0, 2.48 * tall, 0], [0.3, 0.34, 0.38], [-1.2, 0.3, 0]);
    return merge(parts);
  }
  function grass(blades, tall = false, spread = 0.12) {
    const parts = [];
    for (let i = 0; i < blades; i++) {
      const a = i * 2.39996, h = 0.62 + noise(i * 13 + blades) * 0.38;
      const lean = Math.PI / 2 - 1.4 + (tall ? 0.025 : noise(i + 7) * 0.18);
      part(parts, blade, ['#39763c', '#55953e', '#78b34a'][i % 3], [Math.sin(a) * spread * noise(i), 0.02, Math.cos(a) * spread * noise(i + 4)],
        [tall ? 0.46 : 0.62, h, h], [-Math.PI / 2 + lean * 0.9, a, 0]); // 10% less outward lean, keeping curved tips
    }
    return merge(parts);
  }
  function flower(parts, x, z, h, color, petals = 6, size = 0.12) {
    limb(parts, [x, 0, z], [x + 0.018, h, z], 0.012, '#4c823f');
    for (let j = 0; j < 2; j++) part(parts, leaf, j ? '#609e42' : '#47873e', [x, h * (0.28 + j * 0.16), z], [0.15, 0.15, 0.22], [-0.3, j * 3 + x * 7, 0]);
    for (let j = 0; j < petals; j++) part(parts, petal, color, [x + 0.018, h, z], [size * 1.45, size * 0.65, size], [0, j / petals * tau, 0]);
    part(parts, seed, '#efbf42', [x + 0.018, h + 0.022, z], [size * 0.3, 0.035, size * 0.3]);
  }
  function flowers(color, petals, height, size, count = 3) {
    const parts = [];
    for (let i = 0; i < count; i++) { const a = i * 2.4; flower(parts, Math.sin(a) * 0.11, Math.cos(a) * 0.1, height * (0.78 + noise(i + 11) * 0.32), color, petals, size); }
    return merge(parts);
  }
  function lavender() {
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.11, z = i % 2 * 0.1, h = 0.45 + i * 0.055;
      limb(parts, [x, 0, z], [x, h, z], 0.009, '#548745');
      for (let j = 0; j < 3; j++) part(parts, leaf, '#508b46', [x, 0.04 + j * 0.07, z], [0.11, 0.13, 0.20], [-0.7, j * 2.4 + i, 0]);
      for (let j = 0; j < 5; j++) for (let k = 0; k < 2; k++) part(parts, petal, ['#9070c6', '#ad8cdd', '#c1a5eb'][j % 3], [x, h - 0.2 + j * 0.052, z], [0.095 - j * 0.009, 0.075, 0.073 - j * 0.006], [-0.5, k * Math.PI + j, 0]);
    }
    return merge(parts);
  }
  function clover() {
    const parts = [];
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4, r = Math.sqrt(i / 7) * 0.23, x = Math.sin(a) * r, z = Math.cos(a) * r;
      for (let j = 0; j < 3; j++) part(parts, leaf, ['#4d8c41', '#6ca546', '#80b450'][i % 3], [x, 0.07 + noise(i) * 0.04, z], [0.24, 0.10, 0.14], [0, a + j * tau / 3, 0]);
    }
    return merge(parts);
  }
  function fern() {
    const parts = [];
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * tau, length = 0.39 + noise(i) * 0.14;
      limb(parts, [0, 0.015, 0], [Math.sin(a) * length, 0.23, Math.cos(a) * length], 0.009, '#659746');
      for (let j = 1; j < 4; j++) for (const side of [-1, 1]) {
        const t = j / 4, w = 0.21 * (1 - t * 0.62);
        part(parts, leaf, ['#397444', '#528d47', '#77a64d'][j % 3], [Math.sin(a) * length * t, 0.05 + t * 0.22, Math.cos(a) * length * t], [w * 0.72, w * 0.7, w], [-0.15, a + side * 0.95, 0]);
      }
    }
    return merge(parts);
  }
  function shrub(variant) {
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const a = i * tau / 3; crown(parts, [Math.sin(a) * 0.19, 0.20 + (i % 2) * 0.1, Math.cos(a) * 0.19], 0.34, variant + a, false, true);
    }
    if (variant === 1) for (let i = 0; i < 8; i++) {
      // Attach berries to the actual upper leaf midribs, rather than floating above the shrub.
      const cluster = i % 3, ca = cluster * tau / 3, j = Math.floor(i / 3), a = j / 3 * tau + 0.73 + variant + ca;
      const r = 0.34 * 0.77, tilt = 0.08 + noise(j + 71 + (variant + ca) * 11) * 0.12;
      const p = new THREE.Vector3(0, (0.12 - 0.32 * 0.05) * r, 0.52 * r * 1.25).applyEuler(new THREE.Euler(tilt, a, 0, 'YXZ'));
      p.add(new THREE.Vector3(Math.sin(ca) * 0.19 + Math.sin(a) * r * 0.1, 0.20 + (cluster % 2) * 0.1 + 0.34 * 0.32 + 0.045, Math.cos(ca) * 0.19 + Math.cos(a) * r * 0.1));
      part(parts, seed, i % 2 ? '#d95653' : '#bd3d4b', p.toArray(), [0.043, 0.05, 0.043]);
    }
    if (variant === 2) for (let i = 0; i < 2; i++) { const a = i * 2.4; flower(parts, Math.sin(a) * 0.26, Math.cos(a) * 0.26, 0.59 + noise(i) * 0.05, '#f4b9d1', 4, 0.085); }
    return merge(parts);
  }
  function reeds(cattail) {
    const parts = [];
    for (let i = 0; i < 7; i++) { const a = i * 2.4, h = 0.58 + noise(i) * 0.25;
      part(parts, blade, i % 2 ? '#75a54c' : '#508443', [Math.sin(a) * 0.1, 0, Math.cos(a) * 0.1], [0.46, h, h], [-1.27 + noise(i + 4) * 0.25, a, 0]); }
    if (cattail) for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.12, h = 0.95 + i * 0.09;
      limb(parts, [x, 0, 0], [x + 0.035, h, 0], 0.014, '#758b43');
      part(parts, seed, '#90633f', [x + 0.03, h - 0.08, 0], [0.044, 0.15, 0.044]);
    }
    return merge(parts);
  }
  function mushrooms() {
    const parts = [];
    for (let i = 0; i < 3; i++) { const x = (i - 1) * 0.12, z = i % 2 * 0.1, h = 0.12 + i * 0.045;
      limb(parts, [x, 0, z], [x, h, z], 0.024, '#e8d6ae'); part(parts, seed, i % 2 ? '#d5a35c' : '#b97d4a', [x, h, z], [0.09 + i * 0.017, 0.05, 0.09 + i * 0.017]); }
    return merge(parts);
  }
  const register = (name, label, category, geo, lod = null) => {
    geo.userData.floraNatural = true;
    geo.userData.doubleSided = category === 'groundcover' || category === 'waterside';
    models[name] = { label, category, geo, lod };
  };
  register('oak', 'Layered oak', 'tree', tree(0), tree(0, false, true));
  register('oak_wide', 'Spreading oak', 'tree', tree(1), tree(1, false, true));
  register('oak_tall', 'Upright oak', 'tree', tree(2), tree(2, false, true));
  const sapling = tree(2); sapling.scale(0.64, 0.72, 0.64); sapling.computeBoundingBox(); sapling.computeBoundingSphere();
  register('sapling', 'Young broadleaf', 'tree', sapling);
  register('fir', 'Layered fir', 'tree', fir(0), fir(0, true));
  register('fir_slender', 'Slender fir', 'tree', fir(1), fir(1, true));
  register('fir_young', 'Young fir', 'tree', fir(2), fir(2, true));
  register('blossom', 'Pink blossom', 'tree', tree(0, true), tree(0, true, true));
  register('blossom_wide', 'Spreading blossom', 'tree', tree(1, true), tree(1, true, true));
  register('grass_meadow', 'Meadow grass', 'groundcover', grass(6));
  register('grass_fan', 'Fan grass', 'groundcover', grass(5, false, 0.07));
  register('grass_tall', 'Encounter grass', 'groundcover', grass(7, true));
  const wheat = grass(7, true), wheatColors = wheat.attributes.color, gold = new THREE.Color('#d5bc62');
  for (let i = 0; i < wheatColors.count; i++) { const k = 0.82 + (i % 3) * 0.07; wheatColors.setXYZ(i, gold.r * k, gold.g * k, gold.b * k); }
  register('wheat', 'Golden field grass', 'groundcover', wheat);
  register('clover', 'Clover patch', 'groundcover', clover());
  register('daisy', 'White daisies', 'flower', flowers('#fff3d8', 7, 0.33, 0.115));
  register('cosmos', 'Pink cosmos', 'flower', flowers('#e89abd', 6, 0.41, 0.125));
  register('buttercup', 'Golden wildflowers', 'flower', flowers('#efc64b', 5, 0.26, 0.09));
  register('blue_flower', 'Blue wildflowers', 'flower', flowers('#a1bde2', 5, 0.34, 0.10));
  register('lavender', 'Lavender spires', 'flower', lavender());
  register('bush', 'Layered bush', 'undergrowth', shrub(0));
  register('berry_bush', 'Berry bush', 'undergrowth', shrub(1));
  register('flower_bush', 'Flowering bush', 'undergrowth', shrub(2));
  register('fern', 'Woodland fern', 'undergrowth', fern());
  register('mushrooms', 'Mushroom cluster', 'undergrowth', mushrooms());
  register('reeds', 'River reeds', 'waterside', reeds(false));
  register('cattails', 'Cattails', 'waterside', reeds(true));
  [leaf, petal, blade, stem, seed].forEach(g => g.dispose());
  return models;
}
// FLORA_MODEL_SOURCE_END
const FLORA_MODELS = buildFloraModels();
const KIT_SPECIES = Object.fromEntries(Object.entries(FLORA_MODELS).filter(([, p]) => p.category === 'tree').map(([k, p]) => [k, p.geo]));
const TREE_KIT = Object.fromEntries(Object.entries(FLORA_MODELS).map(([k, p]) => ['kit_' + k, [{ mat: 'base', geo: p.geo, lod: p.lod }]]));
// Battle backdrops and old prop names use the same models, without rewriting any supporting asset archives.
if (ASSETS) {
  ['oak', 'oak_wide', 'oak_tall'].forEach((k, i) => { ASSETS['tree_round_' + i] = TREE_KIT['kit_' + k]; });
  ['fir', 'fir_slender'].forEach((k, i) => { ASSETS['tree_pine_' + i] = TREE_KIT['kit_' + k]; });
  ['bush', 'berry_bush', 'flower_bush'].forEach((k, i) => { ASSETS['bush_' + i] = TREE_KIT['kit_' + k]; });
}
function kitTree(kind, x, z, s = 1, h0) { // hashed from the spot, not rnd(): adding kit trees never reshuffles the rest of the world
  const h = hash2(x, z), k = hash2(z, x);
  placeAsset('kit_' + kind, x, h0 ?? terrainH(x, z), z, h * 6.28, s * (0.95 + k * 0.1), s * (0.9 + h * 0.2));
  instQueue['kit_' + kind].at(-1).tint = new THREE.Color(0.88 + h * 0.22, 0.9 + k * 0.18, 0.88 + h * 0.16);
  circles.push({ x, z, r: 0.18 * s }); trees.push([x, z, 0.9 * s]);
}
function fillTree(x, z, s, pine, alt = 0) { // forest fill: a kit tree sized like the sculpted one it replaces (fir ~2.7 m, oak ~3.3 m at s = 1)
  for (let i = pine ? 2 : 3; i--;) rnd(); // the draws the sculpted tree made, so grass, flowers and rocks placed after keep their spots
  const variants = pine ? ['fir', 'fir', 'fir_slender', 'fir_young'] : hash2(z, x) < alt ? ['blossom', 'blossom_wide'] : ['oak', 'oak', 'oak_wide', 'oak_tall'];
  kitTree(variants[Math.floor(hash2(x + 7, z - 3) * variants.length)], x, z, s * (pine ? 0.95 : 1.05));
  trees.at(-1)[2] = (pine ? 0.8 : 1.0) * s; // the old spacing radius too: later spots are tested against it, and a changed test changes the draws
}
function bush(x, z, s = 1, flowers = 0, h0) {
  const y = h0 ?? terrainH(x, z); rnd(); // retain the former bush colour draw in the shared placement stream
  const shrub = ['bush', 'berry_bush', 'bush'][Math.floor(rnd() * 3)];
  placeAsset('kit_' + shrub, x, y, z, rnd() * 6.28, s * rr(0.95, 1.1), s, s * rr(0.95, 1.1));
  const fcol = typeof flowers === 'string' ? flowers : pick(['#ffffff', '#ffffff', '#ff9ec0', '#b89cff', '#ffd23f']);
  for (let i = 0; i < (flowers ? 9 : 0); i++) {
    const a = rnd() * 6.28, r = rr(0.25, 0.55) * s;
    addB('flora', FLORA_MODELS[typeof fcol === 'string' && fcol === '#ffffff' ? 'daisy' : 'cosmos'].geo, null,
      [x + Math.cos(a) * r, y + rr(0.32, 0.45) * s, z + Math.sin(a) * r], [0, a, 0], [0.34 * s, 0.34 * s, 0.34 * s]);
    setSeed((seed + Math.imul(0x6D2B79F5, LEAF_BALLS[2].index.count / 3)) | 0); // preserve old per-face jitter draws without allocating old flowers
  }
}
function rock(x, z, s, y = terrainH(x, z) - s * 0.25) {
  if (ASSETS) return placeAsset('rock_' + Math.floor(rnd() * 4), x, y, z, rnd() * 6.28, s * rr(1, 1.3), s, s * rr(0.9, 1.15), rr(-0.15, 0.15), rr(-0.15, 0.15));
  addB('rock', pick(ROCK_GEOS), (p, nrm, out) => {
    out.set('#8f8b80').multiplyScalar(0.8 + hash3(Math.round(p.x * 7), Math.round(p.y * 7), Math.round(p.z * 7)) * 0.3);
    out.lerp(_cMoss, smooth(0.45, 0.85, nrm.y) * 0.75);
  }, [x, y, z], [rr(-0.2, 0.2), rnd() * 6, rr(-0.2, 0.2)], [s * rr(1, 1.3), s, s * rr(0.9, 1.15)]);
}
const _cMoss = new THREE.Color('#6d9a37');
function fence(a, b, ha = null) {
  const [ax, az] = a, [bx, bz] = b, len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 1.05)), ang = Math.atan2(bz - az, bx - ax);
  const pts = [];
  for (let i = 0; i <= n; i++) { const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n; pts.push([x, z, ha ?? terrainH(x, z)]); }
  if (ASSETS) {
    for (let i = 0; i < n; i++) { const [x0, z0, y0] = pts[i], [x1, z1, y1] = pts[i + 1], l = Math.hypot(x1 - x0, z1 - z0); placeAsset('fence', x0, y0, z0, -ang, l, 1, 1, 0, Math.atan2(y1 - y0, l)); }
    placeAsset('fence_post', pts[n][0], pts[n][2], pts[n][1], -ang);
    segs.push([ax, az, bx, bz]); return;
  }
  for (const [x, z, y] of pts) {
    addB('wood', BOX, '#86592f', [x, y + 0.38, z], [0, -ang, 0], [0.13, 0.86, 0.13]);
    addB('wood', BOX, '#6b4624', [x, y + 0.83, z], [0, -ang, 0], [0.16, 0.05, 0.16]);
  }
  for (let i = 0; i < n; i++) {
    const [x0, z0, y0] = pts[i], [x1, z1, y1] = pts[i + 1], l = Math.hypot(x1 - x0, z1 - z0), tilt = Math.atan2(y1 - y0, l);
    for (const h of [0.3, 0.62]) addB('wood', BOX, '#9a6a3c', [(x0 + x1) / 2, (y0 + y1) / 2 + h, (z0 + z1) / 2], [0, -ang, tilt], [l + 0.06, 0.09, 0.06]);
  }
  segs.push([ax, az, bx, bz]);
}
function lamp(x, z, h0) {
  const y = h0 ?? terrainH(x, z);
  if (ASSETS) { placeAsset('lamp', x, y, z, rnd() * 1.57); circles.push({ x, z, r: 0.12 }); return; }
  addB('metal', CYL, '#2a2e33', [x, y + 1.1, z], [0, 0, 0], [0.045, 2.2, 0.045]);
  addB('metal', CYL, '#2a2e33', [x, y + 0.1, z], [0, 0, 0], [0.11, 0.2, 0.11]);
  addB('metal', CYL, '#2a2e33', [x, y + 2.55, z], [0, Math.PI / 4, 0], [0.18, 0.06, 0.18]);
  addB('metal', new THREE.ConeGeometry(1, 1, 4), '#2a2e33', [x, y + 2.66, z], [0, Math.PI / 4, 0], [0.2, 0.18, 0.2]);
  add(new THREE.BoxGeometry(0.2, 0.3, 0.2), '#fff3c4', scene, x, y + 2.37, z, { mat: { emissive: '#ffc35a', emissiveIntensity: 2.6 }, shadow: false });
  circles.push({ x, z, r: 0.12 });
}
function planter(x, z, s = 1, h0, flowerCols = ['#ff8a3d', '#ffd23f', '#ffffff', '#ff6f8f']) {
  const y = h0 ?? terrainH(x, z);
  addB('wood', BOX, '#8a5a32', [x, y + 0.18 * s, z], [0, 0, 0], [0.62 * s, 0.36 * s, 0.42 * s]);
  bush(x, z, 0.62 * s, 0, y + 0.28 * s);
  for (let i = 0; i < 5; i++) addB('flora', FLORA_MODELS[['daisy', 'cosmos', 'buttercup'][i % 3]].geo, null,
    [x + rr(-0.22, 0.22) * s, y + 0.49 * s, z + rr(-0.12, 0.12) * s], [0, rnd() * 6.28, 0], [0.5 * s, 0.55 * s, 0.5 * s]);
  setSeed((seed + Math.imul(0x6D2B79F5, 12 * (4 + LEAF_BALLS[2].index.count / 3) - 15)) | 0); // retain the downstream world placement stream
  circles.push({ x, z, r: 0.32 * s });
}

export { FLORA_MODELS, KIT_SPECIES, TREE_KIT, bush, fence, fillTree, kitTree, lamp, planter, rock };
