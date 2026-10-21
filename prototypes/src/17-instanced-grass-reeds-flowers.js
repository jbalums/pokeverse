import './16-fleurville-world.js'; // first: the modules run in file-number order (see main.js)
import * as THREE from 'three';
import { hash2, pick, rnd, rr, seed, setSeed, smooth } from './01-helpers.js';
import { BU, SPREAD, VS } from './02-hero-camera.js';
import { KX, inKField, inKalos, inRect, kDirt, kPaved, kalosH } from './03-fleurville-map.js';
import { riverInfo } from './04-river.js';
import { HILL_A, MOUND, PATH_W, TX, hillH, inCobble, inTallGrass, inTest, onBridge, pathD, raised, stairsH, terrainH } from './05-paths-raised-plaza-stairs-tall-grass.js';
import { scene, uPlayer, uTime } from './06-renderer-scene-post.js';
import { add } from './07-materials-textures.js';
import { AMAT } from './08-blender-assets.js';
import { cellKey, cellOf } from './09-terrain.js';
import { boxes, trees } from './12-batched-props.js';
import { FLORA_MODELS } from './13-flora.js';
import { inHeroView } from './15-hand-placement.js';
import { kBoxes, signTex } from './16-fleurville-world.js';

// ============================================================ instanced grass, reeds, flowers
function swayMaterial(gradient) {
  const m = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, vertexColors: true });
  m.onBeforeCompile = s => {
    s.uniforms.uTime = uTime; s.uniforms.uPlayer = uPlayer;
    s.vertexShader = 'uniform float uTime; uniform vec3 uPlayer; varying float vGH;\n' + s.vertexShader.replace('#include <project_vertex>', `
      vGH = position.y;
      vec4 mvPosition = instanceMatrix * vec4(transformed, 1.0);
      float k = max(position.y, 0.0);
      vec2 dd = mvPosition.xz - uPlayer.xz; float dl = length(dd);
      float push = (1.0 - smoothstep(0.1, 0.75, dl)) * step(abs(mvPosition.y - uPlayer.y), 1.5);
      mvPosition.xz += dd / (dl + 0.001) * push * 0.42 * k;
      mvPosition.y -= push * 0.22 * k;
      mvPosition.x += sin(uTime * 1.7 + mvPosition.x * 0.8 + mvPosition.z * 0.5) * 0.09 * k;
      mvPosition.z += cos(uTime * 1.3 + mvPosition.x * 0.6) * 0.05 * k;
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`);
    s.fragmentShader = 'varying float vGH;\n' + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb *= ${gradient ? 'mix(0.83, 1.12, clamp(vGH, 0.0, 1.0))' : '1.0'};`);
  };
  m.customProgramCacheKey = () => 'verdant-flora-v1-' + (gradient ? 'gradient' : 'solid');
  return m;
}
const GRASS_DENSITY = 0.75 * 0.75 * 0.65; // another 35% reduction: 36.5625% of the original density
const GRASS_GEOMETRIES = new Set(['grass_meadow', 'grass_fan', 'grass_tall', 'wheat'].map(k => FLORA_MODELS[k].geo));
function scatter(geo, count, accept, place, colors, gradient = true) {
  const o = new THREE.Object3D(), c = new THREE.Color(), white = new THREE.Color('#ffffff'), all = [];
  let tries = 0;
  while (all.length < count && tries++ < count * 30) {
    const p = accept(); if (!p) continue;
    place(o, p[0], p[1]); o.updateMatrix();
    c.set(pick(colors)); if (geo.userData.floraNatural) c.lerp(white, 0.9); // authored colours need only a subtle instance tint
    all.push([o.matrix.clone(), c.multiplyScalar(rr(0.92, 1.05)).clone()]);
  }
  // Generate the full placement stream, then draw fewer grass clumps so other vegetation keeps its existing positions.
  if (GRASS_GEOMETRIES.has(geo)) all.length = Math.round(all.length * GRASS_DENSITY);
  return instancedCells(geo, swayMaterial(gradient), all);
}
function instancedCells(geo, mat, items, parent = scene) { // items: [matrix, colour?][] -> one InstancedMesh per CHUNK cell, so off-screen cells are culled
  const cells = new Map();
  for (const it of items) { const k = cellKey(cellOf(it[0].elements[12]), cellOf(it[0].elements[14])); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(it); }
  return [...cells.values()].map(list => {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([m, col], i) => { im.setMatrixAt(i, m); if (col) im.setColorAt(i, col); });
    im.receiveShadow = true; parent.add(im); return im;
  });
}
const groundFree = (x, z, pathPad) => {
  if (inCobble(x, z) || stairsH(x, z) !== null || onBridge(x, z)) return false;
  if (pathD(x, z) < PATH_W - 0.15 + pathPad) return false;
  const r = riverInfo(x, z); if (r.d < r.hw + 0.25) return false;
  for (const b of boxes) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return false;
  return true;
};
// tall grass patch
const TALL_GEO = FLORA_MODELS.grass_tall.geo;
scatter(TALL_GEO, 1400 * SPREAD, () => { const x = rr(VS(-10), VS(2)), z = rr(VS(-1), VS(6)); return inTallGrass(x, z) && Math.hypot(x - BU[0], z - BU[1]) > 0.55 ? [x, z] : null; },
  (o, x, z) => { o.position.set(x, terrainH(x, z) - 0.03, z); o.rotation.set(0, rnd() * 6.28, 0); const s = rr(0.7, 1.15); o.scale.set(rr(1, 1.3), s, rr(1, 1.3)); },
  ['#3c8a2c', '#4a9c37', '#57ad41', '#357b28', '#62b546']);
// short tufts everywhere (denser in view)
const SHORT_GEO = FLORA_MODELS.grass_meadow.geo;
scatter(SHORT_GEO, 3400 * SPREAD, () => {
  const x = rr(VS(-24), VS(26)), z = rr(VS(-20), VS(14));
  if (!inHeroView(x, z) && rnd() < 0.55) return null;
  if (inTallGrass(x, z) || !groundFree(x, z, rnd() * 0.5)) return null;
  if (hash2(Math.floor(x * 1.3), Math.floor(z * 1.3)) < 0.24) return null; // open turf between intentional clumps
  return [x, z];
}, (o, x, z) => { o.position.set(x, terrainH(x, z) - 0.02, z); o.rotation.set(0, rnd() * 6.28, 0); const s = rr(0.22, 0.48); o.scale.set(rr(0.9, 1.3), s, rr(0.9, 1.3)); },
  ['#6fb03f', '#5a9e34', '#86c04c', '#529530', '#97c955']);
// reeds on the far bank
scatter(FLORA_MODELS.reeds.geo, 150 * SPREAD, () => {
  const x = rr(VS(5), VS(16)), z = rr(VS(-7), VS(-1.5)), r = riverInfo(x, z);
  if (r.d < r.hw + 0.2 || r.d > r.hw + 2.6 || !groundFree(x, z, 0.3)) return null;
  return hillH(x, z) < 0.9 && x > HILL_A[0] - 1.5 ? [x, z] : null;
}, (o, x, z) => { o.position.set(x, terrainH(x, z), z); o.rotation.set(0, rnd() * 6, 0); const s = rr(0.8, 1.15); o.scale.set(1, s, 1); }, ['#6db544', '#7fc24c', '#5aa23a']);
// Three-dimensional flower CLUSTERS, not petal confetti. Species are grouped by a spatial hash into coherent beds.
const flowerSpots = [], fo = new THREE.Object3D();
for (let tries = 0; flowerSpots.length < 560 * SPREAD && tries < 35000 * SPREAD; tries++) {
  const x = rr(VS(-20), VS(22)), z = rr(VS(-14), VS(10));
  if (inTallGrass(x, z) || !groundFree(x, z, 0.55) || !groundFree(x + 0.24, z + 0.24, 0.35) || !groundFree(x - 0.24, z - 0.24, 0.35)) continue;
  const pd = pathD(x, z), r = riverInfo(x, z), md = Math.hypot(x - MOUND[0], z - MOUND[1]);
  const w = Math.max(1 - smooth(PATH_W + 0.3, PATH_W + 2.2, pd), 1 - smooth(r.hw + 0.3, r.hw + 2.0, r.d), 1 - smooth(0.5, 2.5, md), raised(x, z) ? 0.2 : 0.1) * (inHeroView(x, z) ? 1 : 0.35);
  if (rnd() < w && hash2(Math.floor(x * 1.4), Math.floor(z * 1.4)) > 0.33) flowerSpots.push([x, z, terrainH(x, z)]);
}
{
  const beds = Object.fromEntries(['daisy', 'cosmos', 'buttercup', 'blue_flower', 'lavender'].map(k => [k, []]));
  flowerSpots.forEach(([x, z, y]) => {
    const h = hash2(Math.floor(x * 0.65), Math.floor(z * 0.65)), purpleZone = Math.hypot(x - MOUND[0], z - MOUND[1]) < 2.2 || x > 7;
    const choices = purpleZone ? ['lavender', 'cosmos', 'daisy', 'blue_flower'] : ['daisy', 'daisy', 'buttercup', 'cosmos'];
    beds[choices[Math.floor(h * choices.length)]].push([x, y, z]);
  });
  for (const [name, points] of Object.entries(beds)) {
    if (!points.length) continue;
    instancedCells(FLORA_MODELS[name].geo, swayMaterial(false), points.map(([x, y, z]) => { const h = hash2(x, z), s = 0.66 + h * 0.42;
      fo.position.set(x, y, z); fo.rotation.set(0, h * Math.PI * 2, 0); fo.scale.set(s, s * (0.85 + hash2(z, x) * 0.25), s); fo.updateMatrix(); return [fo.matrix.clone()]; }));
  }
}
{ // Fleurville: wheat in rows across the fields (wild Pokémon hide there), short tufts on the lawns
  const VS = seed;
  scatter(FLORA_MODELS.wheat.geo, 2200, () => { const x = rr(KX - 17.5, KX + 3.6), z = rr(-20, -11.6); return inKField(x, z) && ((z % 0.62) + 0.62) % 0.62 < 0.4 ? [x, z] : null; },
    (o, x, z) => { o.position.set(x, kalosH(x, z) - 0.03, z); o.rotation.set(0, rnd() * 6.28, 0); const s = rr(0.85, 1.25); o.scale.set(rr(1, 1.3), s, rr(1, 1.3)); },
    ['#d9c64a', '#cbb83e', '#e6d35c', '#bfae3a', '#a9be48']);
  scatter(SHORT_GEO, 2300, () => { const x = rr(KX - 26, KX + 26), z = rr(-20, 22); return kPaved(x, z) || kDirt(x, z) || inKField(x, z) || kBoxes.some(r => inRect(x, z, r)) ? null : [x, z]; },
    (o, x, z) => { o.position.set(x, kalosH(x, z) - 0.02, z); o.rotation.set(0, rnd() * 6.28, 0); const s = rr(0.22, 0.48); o.scale.set(rr(0.9, 1.3), s, rr(0.9, 1.3)); },
    ['#6fb03f', '#5a9e34', '#86c04c', '#529530', '#97c955']);
  setSeed(VS);
}

{ // Groundcover uses a private random stream: adding plants never changes subsequent NPC / Pokémon placement.
  const savedSeed = seed; setSeed(0x464c4f52);
  const neutral = ['#ffffff', '#eff7e8', '#f8ffe9'];
  const place = (o, x, z) => { const s = rr(0.72, 1.1); o.position.set(x, terrainH(x, z), z); o.rotation.set(0, rnd() * Math.PI * 2, 0); o.scale.setScalar(s); };
  const underTree = () => {
    const [tx, tz] = trees[Math.floor(rnd() * trees.length)], a = rnd() * Math.PI * 2, r = rr(0.35, 1.2), x = tx + Math.sin(a) * r, z = tz + Math.cos(a) * r;
    if (inTest(x) || inKalos(x) || inTallGrass(x, z) || !groundFree(x, z, 0.65)) return null;
    return [x, z];
  };
  scatter(FLORA_MODELS.fern.geo, 100, underTree, place, neutral);
  scatter(FLORA_MODELS.clover.geo, 220, () => {
    const x = rr(VS(-21), VS(22)), z = rr(VS(-15), VS(12));
    return groundFree(x, z, 0.6) && !inTallGrass(x, z) && hash2(Math.floor(x), Math.floor(z)) > 0.48 ? [x, z] : null;
  }, place, neutral);
  scatter(FLORA_MODELS.grass_fan.geo, 170, () => {
    const p = underTree(); return p && groundFree(...p, 0.65) ? p : null;
  }, (o, x, z) => { place(o, x, z); o.scale.multiplyScalar(0.42); }, neutral);
  scatter(FLORA_MODELS.mushrooms.geo, 36, underTree, place, neutral, false);
  scatter(FLORA_MODELS.cattails.geo, 55, () => {
    const x = rr(VS(-8), VS(18)), z = rr(VS(-12), VS(10)), r = riverInfo(x, z);
    return r.d > r.hw + 0.35 && r.d < r.hw + 1.0 && groundFree(x, z, 0.75) && !inTallGrass(x, z) ? [x, z] : null;
  }, place, neutral);
  // A small, labelled plant nursery alongside the existing tree specimens.
  ['grass_meadow', 'grass_fan', 'grass_tall', 'clover', 'daisy', 'cosmos', 'buttercup', 'blue_flower', 'lavender', 'fern', 'berry_bush', 'cattails'].forEach((k, i) => {
    const x = TX + 15.5 + i % 6 * 2.4, z = 4.0 + Math.floor(i / 6) * 3.3, model = FLORA_MODELS[k];
    const mesh = new THREE.Mesh(model.geo, AMAT.base); mesh.position.set(x, 0, z); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
    add(new THREE.PlaneGeometry(2.2, 0.35), 0, scene, x, 0.025, z + 0.85, { r: [-Math.PI / 2, 0, 0], shadow: false,
      material: new THREE.MeshBasicMaterial({ map: signTex(model.label.toUpperCase(), '#1b2a44', '#9fe2ff') }) });
  });
  setSeed(savedSeed);
}

export { GRASS_DENSITY, SHORT_GEO, TALL_GEO, instancedCells, scatter, swayMaterial };
