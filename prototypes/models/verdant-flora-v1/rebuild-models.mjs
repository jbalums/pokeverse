import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..'), scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'verdant-flora-'));
const srcPath = path.join(root, 'prototypes/verdant-town-3d.html');
const html = fs.readFileSync(srcPath, 'utf8');
const source = html.split('// FLORA_MODEL_SOURCE_BEGIN')[1].split('// FLORA_MODEL_SOURCE_END')[0].replace(/\r\n/g, '\n');
const threeURL = pathToFileURL(path.join(root, 'prototypes/vendor/three/build/three.module.js')).href;
const THREE = await import(threeURL);
const utilsPath = path.join(root, 'prototypes/vendor/three/examples/jsm/utils/BufferGeometryUtils.js');
const utils = fs.readFileSync(utilsPath, 'utf8').replace("from 'three';", `from '${threeURL}';`);
const { mergeGeometries } = await import('data:text/javascript;base64,' + Buffer.from(utils).toString('base64'));
const build = new Function('THREE', 'mergeGeometries', `${source}\nreturn buildFloraModels();`);
const models = build(THREE, mergeGeometries), repeated = build(THREE, mergeGeometries);
const output = path.join(root, 'prototypes/models/verdant-flora-v1');
fs.mkdirSync(output, { recursive: true });
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function inspect(name, geo, budget) {
  const P = geo.attributes.position, N = geo.attributes.normal, C = geo.attributes.color, I = geo.index;
  assert(P && N && C && I && I.count % 3 === 0, name + ': attributes');
  assert(I.count / 3 <= budget, `${name}: ${I.count / 3} > ${budget} triangles`);
  assert.equal(P.count, N.count); assert.equal(P.count, C.count);
  for (const attr of [P, N, C]) for (const x of attr.array) assert(Number.isFinite(x), name + ': non-finite');
  for (let i = 0; i < N.count; i++) { const len = Math.hypot(N.getX(i), N.getY(i), N.getZ(i)); assert(len > 0.99 && len < 1.01, `${name}: normal ${i} ${len}`); }
  for (const x of C.array) assert(x >= 0 && x <= 1, name + ': color range');
  let area = 0, degenerate = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < I.count; i += 3) {
    for (let j = 0; j < 3; j++) assert(I.getX(i + j) < P.count, name + ': index range');
    a.fromBufferAttribute(P, I.getX(i)); b.fromBufferAttribute(P, I.getX(i + 1)); c.fromBufferAttribute(P, I.getX(i + 2));
    const n = b.sub(a).cross(c.sub(a)).length(); if (n < 1e-10) degenerate++; area += n * 0.5;
  }
  assert.equal(degenerate, 0, name + ': degenerate triangles'); assert(area > 0);
  geo.computeBoundingBox(); const box = geo.boundingBox;
  return { triangles: I.count / 3, vertices: P.count, min: box.min.toArray(), max: box.max.toArray(), surfaceArea: +area.toFixed(5) };
}
function glb(name, geo) {
  geo.computeBoundingBox();
  const chunks = [], views = [], accessors = []; let offset = 0;
  function accessor(array, type, componentType, target, min, max) {
    const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
    const padding = (4 - bytes.length % 4) % 4;
    chunks.push(bytes, Buffer.alloc(padding));
    const view = views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target }) - 1;
    offset += bytes.length + padding;
    return accessors.push({ bufferView: view, componentType, count: array.length / (type === 'VEC3' ? 3 : 1), type,
      ...(min ? { min, max } : {}) }) - 1;
  }
  const attrs = {};
  attrs.POSITION = accessor(geo.attributes.position.array, 'VEC3', 5126, 34962, geo.boundingBox.min.toArray(), geo.boundingBox.max.toArray());
  attrs.NORMAL = accessor(geo.attributes.normal.array, 'VEC3', 5126, 34962);
  attrs.COLOR_0 = accessor(geo.attributes.color.array, 'VEC3', 5126, 34962);
  const index = accessor(geo.index.array, 'SCALAR', geo.index.array instanceof Uint32Array ? 5125 : 5123, 34963);
  const bin = Buffer.concat(chunks);
  const document = { asset: { version: '2.0', generator: 'Verdant Town authored flora v1', copyright: 'Original project-authored geometry' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name, mesh: 0 }],
    meshes: [{ name, primitives: [{ attributes: attrs, indices: index, material: 0, mode: 4 }] }],
    materials: [{ name: 'Flora vertex colours', doubleSided: !!geo.userData.doubleSided, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.95 } }],
    buffers: [{ byteLength: bin.length }], bufferViews: views, accessors,
    extras: { units: 'metres', upAxis: '+Y', groundPivot: true, source: 'prototypes/verdant-town-3d.html:buildFloraModels' } };
  let json = Buffer.from(JSON.stringify(document)); json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
  const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + bin.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(json.length); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jh, json, bh, bin]);
}
const manifest = { version: 1, created: '2026-10-21', units: 'metres', upAxis: '+Y', material: 'Opaque vertex-coloured, no textures',
  provenance: { type: 'Original deterministic procedural geometry authored for this project', provider: null, license: 'Project-owned; no third-party model geometry',
    source: 'prototypes/verdant-town-3d.html:buildFloraModels', sourceSHA256: sha(source),
    approvedReference: 'approved-vegetation-reference.png',
    design: 'Layered folded almond leaves, drooping fir tiers, broad curved grass, cupped flowers; match approved screenshot edit.' },
  validation: { finiteAttributes: true, unitNormals: true, validIndices: true, nondegenerateTriangles: true, deterministic: true, browserTested: false }, models: [] };
const geometryJSON = {};
for (const [name, model] of Object.entries(models)) {
  const stats = inspect(name, model.geo, model.category === 'tree' ? 3000 : 1700);
  if (name.startsWith('grass_') || name === 'wheat' || name === 'reeds') { assert(stats.max[1] > 0.5, name + ': upright blade height'); assert(stats.min[1] > -0.01, name + ': buried blades'); }
  for (const attribute of ['position', 'normal', 'color']) assert.deepEqual(model.geo.attributes[attribute].array, repeated[name].geo.attributes[attribute].array, name + ': deterministic');
  const bytes = glb(name, model.geo), filename = name + '.glb';
  fs.writeFileSync(path.join(output, filename), bytes);
  const entry = { name, label: model.label, category: model.category, file: filename, bytes: bytes.length, sha256: sha(bytes), ...stats };
  if (model.lod) { const lodStats = inspect(name + '.lod', model.lod, 1800); assert(lodStats.triangles < stats.triangles); const lodBytes = glb(name + '_lod', model.lod);
    fs.writeFileSync(path.join(output, name + '-lod.glb'), lodBytes); entry.lod = { file: name + '-lod.glb', bytes: lodBytes.length, sha256: sha(lodBytes), ...lodStats }; }
  manifest.models.push(entry);
  geometryJSON[name] = { label: model.label, category: model.category, position: Array.from(model.geo.attributes.position.array), normal: Array.from(model.geo.attributes.normal.array),
    color: Array.from(model.geo.attributes.color.array), index: Array.from(model.geo.index.array) };
}
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(scratch, 'meshes.json'), JSON.stringify(geometryJSON));
// Parse the complete current game module without starting a browser or evaluating its DOM/render loop.
const module = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
fs.writeFileSync(path.join(scratch, 'game-check.mjs'), module);
console.log(JSON.stringify({ modelCount: manifest.models.length, triangles: manifest.models.map(m => [m.name, m.triangles, m.lod?.triangles]), sourceSHA256: manifest.provenance.sourceSHA256, output }, null, 2));

const syntax = spawnSync(process.execPath, ['--check', path.join(scratch, 'game-check.mjs')], { encoding: 'utf8', windowsHide: true });
assert.equal(syntax.status, 0, syntax.stderr);
const renderArg = process.argv.indexOf('--render');
if (renderArg >= 0) {
  const blender = process.argv[renderArg + 1];
  assert(blender, 'Usage: node rebuild-models.mjs --render <absolute blender executable>');
  const rendered = spawnSync(blender, ['--background', '--factory-startup', '--threads', '6', '--python', path.join(here, 'render-models.py'), '--', path.join(scratch, 'meshes.json')], { cwd: root, stdio: 'inherit', windowsHide: true });
  assert.equal(rendered.status, 0, 'Blender rendering failed');
}
