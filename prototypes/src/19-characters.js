import './18-cell-content.js'; // first: the modules run in file-number order (see main.js)
import * as THREE from 'three';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { V3, clamp } from './01-helpers.js';
import { BU, I, START } from './02-hero-camera.js';
import { FOLK } from './03-fleurville-map.js';
import { PLAZA_H, terrainH, walkH } from './05-paths-raised-plaza-stairs-tall-grass.js';
import { scene } from './06-renderer-scene-post.js';
import { add } from './07-materials-textures.js';
import { decodeAssets } from './08-blender-assets.js';
import { circles } from './12-batched-props.js';
import { BENCH, BENCH_ROT, COT, PC, POST, SIGN } from './14-buildings.js';
import { loadFolkModel } from './24-fleurville-hud-travel.js';
import { SPECIES } from './27-pokemon-data.js';
import { healParty } from './28-evolution-data.js';
import { retireBulbasaur, startBattle } from './40-battle-flow.js';

// ============================================================ characters (prototypes/blender/build_characters.py -> verdant-chars.js)
const CHARS = decodeAssets(window.VERDANT_CHARS.assets), RIGS = window.VERDANT_CHARS.rigs;
const CMAT = {
  body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }),
  eye: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15 }),
  hi: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
};
CMAT.body.onBeforeCompile = s => { // soft rim light: the reference's figures glow at the edges like vinyl toys
  s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
    float rim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
    totalEmissiveRadiance += diffuseColor.rgb * rim * 0.45;`);
};
function rig(name) {
  const root = new THREE.Group(), parts = {};
  for (const p of RIGS[name]) {
    const g = new THREE.Group(); g.position.fromArray(p.at);
    (p.parent ? parts[p.parent] : root).add(g); parts[p.name] = g;
    for (const { mat, geo } of CHARS[`${name}.${p.name}`]) {
      const m = new THREE.Mesh(geo, CMAT[mat]); m.castShadow = mat !== 'hi'; m.receiveShadow = true; g.add(m);
    }
  }
  return { root, parts };
}
function humanJoint(root, name) {
  const bone = root.getObjectByName(name); if (!bone?.isBone) return null;
  const rest = bone.quaternion.clone(), inv = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
  const axes = [new V3(1, 0, 0), new V3(0, 1, 0), new V3(0, 0, 1)].map(v => v.applyQuaternion(inv));
  const angles = { x: 0, y: 0, z: 0 }, rotation = {}, q = new THREE.Quaternion();
  for (const axis of ['x', 'y', 'z']) Object.defineProperty(rotation, axis, {
    get: () => angles[axis],
    set: value => {
      angles[axis] = value;
      bone.quaternion.copy(rest);
      ['x', 'y', 'z'].forEach((key, i) => bone.quaternion.multiply(q.setFromAxisAngle(axes[i], angles[key])));
    },
  });
  return { rotation, bone };
}
function humanBody(root) {
  // Keep gait offsets separate from navigation, imported scale and bind transforms.
  const body = new THREE.Group(); body.add(...root.children.slice()); root.add(body); return body;
}
function makeHuman(name) {
  const g = typeof XY !== 'undefined' && xy(name);
  if (g && ['LThigh', 'RThigh', 'LArmA', 'RArmA', 'Head'].every(n => g.getObjectByName(n)?.isBone)) {
    g.updateMatrixWorld(true);
    for (const [side, outward] of [['L', 1], ['R', -1]]) {
      const arm = g.getObjectByName(`${side}ArmA`), elbow = g.getObjectByName(`${side}ForeArm`);
      if (!elbow?.isBone) continue;
      const from = elbow.getWorldPosition(new V3()).sub(arm.getWorldPosition(new V3()));
      if (from.lengthSq() < 1e-8) continue;
      const inv = arm.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      const to = new V3(outward * 0.12, -1, 0.04).normalize().applyQuaternion(inv);
      arm.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(from.normalize().applyQuaternion(inv), to));
      g.updateMatrixWorld(true);
    }
    // Capture axes after lowering the arms: elbows now bend forward, not sideways from the T-pose.
    const body = humanBody(g); g.updateMatrixWorld(true);
    const pair = suffix => ['L', 'R'].map(side => humanJoint(g, side + suffix));
    const c = { root: g, body, legs: pair('Thigh'), knees: pair('Leg'), feet: pair('Foot'),
      arms: pair('ArmA'), elbows: pair('ForeArm'), wrists: pair('Hand'),
      hips: humanJoint(g, 'Hips'), spine: humanJoint(g, 'Spine1'), head: humanJoint(g, 'Head'), phase: 0, idle: 0 };
    c.groundPoint = new V3();
    c.ground = ['LFoot', 'LToe', 'RFoot', 'RToe'].map(n => g.getObjectByName(n)).filter(b => b?.isBone)
      .map(bone => ({ bone, y: g.worldToLocal(bone.getWorldPosition(new V3())).y }));
    c.legLen = g.worldToLocal(g.getObjectByName('LThigh').getWorldPosition(new V3())).y - Math.min(...c.ground.map(x => x.y));
    animWalk(c, 0, 0); return c;
  }
  const { root, parts: p } = rig(name), body = humanBody(root);
  p.armL.rotation.z = -0.12; p.armR.rotation.z = 0.12;
  const c = { root, body, legs: [p.legL, p.legR], arms: [p.armL, p.armR], head: p.head, phase: 0, idle: 0 };
  root.updateMatrixWorld(true); c.legLen = p.legL.getWorldPosition(new V3()).y;
  animWalk(c, 0, 0); return c;
}
function animWalk(c, dt, speed) {
  dt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.05)) : 0;
  speed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  const blend = 1 - Math.exp(-dt * 10);
  c.amt = THREE.MathUtils.lerp(c.amt || 0, speed > 0.05 ? Math.min(1, speed / 1.1) : 0, blend);
  c.run = THREE.MathUtils.lerp(c.run || 0, THREE.MathUtils.smoothstep(speed, 2.6, 4.6), blend);
  // Smoothed acceleration pitches the body: forward when setting off, back when pulling up.
  if (dt > 0) c.acc = THREE.MathUtils.lerp(c.acc || 0, (speed - (c.lastSpeed ?? speed)) / dt, 1 - Math.exp(-dt * 6));
  c.lastSpeed = speed;
  c.idle += dt;
  const amount = c.amt, stride = THREE.MathUtils.lerp(0.46, 0.72, c.run), armSwing = THREE.MathUtils.lerp(0.24, 0.48, c.run);
  // Planted foot: in stance the foot's offset ahead of the hip (legLen * reach * step) sweeps linearly from +1 to -1 over half a
  // cycle, so it moves back at exactly the ground speed and stays put; the swing brings it forward again on an eased curve.
  // Running lengthens the step instead of spinning the limbs faster. The cap keeps tiny shuffles from blurring.
  const leg = (c.legLen || 0.55) * c.root.scale.y, reach = Math.sin(stride) * Math.max(amount, 0.05);
  c.phase = (c.phase + dt * Math.min(14, Math.PI / 2 * speed / (leg * reach))) % (Math.PI * 2);
  for (let i = 0; i < 2; i++) {
    const phase = c.phase + i * Math.PI, q = ((phase - Math.PI / 2) / (Math.PI * 2) % 1 + 1) % 1, stance = q < 0.5;
    const step = stance ? 1 - 4 * q : -Math.cos((q - 0.5) * Math.PI * 2), lift = stance ? 0 : Math.sin((q - 0.5) * Math.PI * 2) ** 2;
    const knee = lift * THREE.MathUtils.lerp(0.8, 1.15, c.run) * amount, angle = Math.asin(step * Math.sin(stride) * amount);
    c.legs[i].rotation.x = -angle;
    if (c.knees?.[i]) c.knees[i].rotation.x = knee;
    if (c.feet?.[i]) c.feet[i].rotation.x = stance ? angle : angle * 0.5 - knee * 0.45; // sole flat on the ground while planted
    // Opposite arm follows the step with a slight delay; elbows and wrists soften the reversal.
    c.arms[i].rotation.x = Math.sin(phase - 0.22) * armSwing * amount;
    if (c.elbows?.[i]) c.elbows[i].rotation.x = -(0.16 + c.run * 0.75 + Math.max(0, -step) * 0.25 * amount);
    if (c.wrists?.[i]) c.wrists[i].rotation.x = Math.sin(phase - 0.65) * 0.065 * amount;
  }
  const sway = Math.sin(c.phase) * amount, lean = c.run * 0.09 * amount + clamp(c.acc * 0.02, -0.07, 0.09);
  const breath = Math.sin(c.idle * 2.2) * (1 - amount);
  c.body.position.x = sway * 0.018;
  // Lowest when a foot lands (legs spread, phase pi/2), highest mid-stride. Rigs with foot bones get this from the grounding below.
  c.body.position.y = (c.ground?.length ? 0 : (1 + Math.cos(c.phase * 2)) * THREE.MathUtils.lerp(0.014, 0.026, c.run) * amount) + breath * 0.003;
  c.body.rotation.x = lean; c.body.rotation.z = sway * 0.025;
  if (c.hips) { c.hips.rotation.y = sway * 0.035; c.hips.rotation.z = -sway * 0.02; }
  if (c.spine) {
    c.spine.rotation.y = -sway * 0.065;
    c.spine.rotation.x = -lean * 0.3 + breath * 0.015;
  }
  c.head.rotation.x = -lean * 0.5 - breath * 0.008;
  c.head.rotation.y = sway * 0.025;
  if (c.ground?.length) {
    // Ground the lowest heel/toe after bending, so shorter posed legs do not make the character float.
    c.root.updateMatrixWorld(true);
    let gap = Infinity;
    for (const { bone, y } of c.ground) gap = Math.min(gap, c.root.worldToLocal(bone.getWorldPosition(c.groundPoint)).y - y);
    c.body.position.y -= gap;
  }
}
// Pokémon X/Y model rips in models/xy/<Name>/ (private, gitignored). Missing files fall back to the sculpts.
const XY = {};
// Some rips carry two versions of a body part and the real game shrinks one of them to nothing by pose.
// Pidgey has folded wings along its body (the "Feeler" joints) next to the spread flying wings; it hovers here, so the folded pair goes.
// Names are the restored joint names (see the loader below), not the raw "jointN" sids.
const XY_HIDE = { pidgey: ['_46_LFeeler1', '_54_RFeeler1'] };
function relaxPikachuArms(scene) {
  // The X/Y mesh has raised arms in its bind pose. Aim each arm down from
  // its existing pose, using the parent's axes rather than assuming bone axes.
  scene.updateMatrixWorld(true);
  for (const [side, outward] of [['L', 1], ['R', -1]]) {
    const arm = scene.getObjectByName(`${side}Arm`), hand = scene.getObjectByName(`${side}Hand`);
    if (!arm?.isBone || !hand?.isBone) continue;
    const from = hand.getWorldPosition(new V3()).sub(arm.getWorldPosition(new V3()));
    if (from.lengthSq() < 1e-8) continue;
    const parentInv = arm.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    from.normalize().applyQuaternion(parentInv);
    const to = new V3(outward * 0.18, -1, 0.12).normalize().applyQuaternion(parentInv);
    arm.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(from, to));
    scene.updateMatrixWorld(true);
  }
}
// Pokédex 3D Pro / Sun-Moon move-effect and shadow-card materials (Lugia's aura sphere, Raikou's bolts, the shadow_w ground
// card every model carries...). Drawn without the 3DS blend modes they hide the Pokémon, so they are not drawn.
// Flame body parts (Ponyta's mane, Fire_Mat...) are deliberately not listed.
const EFFECT_MAT = /^(shadow_w$|.*_shadow$|glow|shock|flash|circle|wind|ef|effect$|aura|ap_|sp_|spa_|lightmat|water_?circle|wateripple|water_center|water\d*mat$|ringfire|thun|thuder|kemuri|model_shock)/i;
const _blackCache = new WeakMap();
function mostlyBlack(img) { // ≥70% of sampled pixels are pure black
  if (!img?.width) return false;
  if (!_blackCache.has(img)) {
    const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 32, 32);
    const d = x.getImageData(0, 0, 32, 32).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 24) n++;
    _blackCache.set(img, n / 1024 >= 0.7);
  }
  return _blackCache.get(img);
}
function cleanClip(clip) { // joints scaled to zero decompose to NaN rotations in some rips (Grimer, Muk...); hold the nearest good key instead
  for (const t of clip.tracks) {
    const n = t.getValueSize(), v = t.values, ok = i => { for (let j = 0; j < n; j++) if (!Number.isFinite(v[i + j])) return false; return true; };
    let first = -1, last = -1;
    for (let i = 0; i < v.length; i += n) if (ok(i)) { if (first < 0) first = i; last = i; } else if (last >= 0) v.copyWithin(i, last, last + n);
    for (let i = 0; first > 0 && i < first; i += n) v.copyWithin(i, first, first + n);
  }
  clip.tracks = clip.tracks.filter(t => t.values.every(Number.isFinite));
  return clip;
}
function quietClip(root, clip, keepHops = false, keepTurns = false) {
  // Pokédex 3D Pro clips chain a calm idle with a big hop, and legendaries open with an "appear" intro where the body is
  // scaled to nothing inside an orb. Keep the longest stretch where the body is full size (and, in town, stays down).
  // Some idles also wander off and turn around (Oddish runs a lap, showing its back for half the loop), so frames where
  // most joints have turned away from the rest pose are dropped too, unless the viewer wants the full motion.
  const bones = []; root.traverse(o => o.isBone && bones.push(o)); root.updateMatrixWorld(true);
  const rest = bones.map(b => b.getWorldQuaternion(new THREE.Quaternion()).invert()), q = new THREE.Quaternion(), f = new V3();
  const turn = () => bones.map((b, i) => (f.set(0, 0, 1).applyQuaternion(b.getWorldQuaternion(q).multiply(rest[i])), Math.abs(Math.atan2(f.x, f.z)))).sort((a, b) => a - b)[bones.length >> 1] || 0;
  const m = new THREE.AnimationMixer(root); m.clipAction(clip).play();
  const N = 40, lows = [], tall = [], turned = [];
  for (let k = 0; k <= N; k++) { m.setTime(clip.duration * k / N); const b = bodyBounds(root); lows.push(b.min.y); tall.push(b.max.y - b.min.y); turned.push(!keepTurns && turn() > 0.6); }
  m.stopAllAction(); m.uncacheRoot(root);
  const ground = Math.min(...lows), typical = [...tall].sort((a, b) => a - b)[N >> 1], tol = typical * 0.08; let best = [0, -1], start = 0;
  const calm = k => (keepHops || lows[k] - ground <= tol) && tall[k] >= typical * 0.6 && !turned[k];
  lows.forEach((y, k) => { if (!calm(k)) start = k + 1; else if (k - start > best[1] - best[0]) best = [start, k]; });
  // hops may stay inside the loop, but it starts and ends on the ground: Eevee's stretch began mid-somersault, so the
  // model was fitted to a ball in the air and every loop snapped it back up there
  while (best[0] < best[1] && lows[best[0]] - ground > tol) best[0]++;
  while (best[1] > best[0] && lows[best[1]] - ground > tol) best[1]--;
  if (best[1] - best[0] >= N * 0.9) return clip; // already calm
  const fps = 30;
  if ((best[1] - best[0]) * clip.duration / N < 1) { // never calm for a second (Magikarp flops throughout): hold the best calm frame
    const k = Math.max(0, lows.findIndex((y, i) => y - ground <= tol && tall[i] >= typical * 0.6 && !turned[i])), fr = Math.round(k * clip.duration / N * fps);
    return THREE.AnimationUtils.subclip(clip, clip.name + '-pose', fr, fr + 1, fps);
  }
  const a = Math.round(best[0] * clip.duration / N * fps), b = Math.round(best[1] * clip.duration / N * fps);
  return THREE.AnimationUtils.subclip(clip, clip.name + '-idle', a, b, fps);
}
function bodyBounds(root) { // meshes near the biggest one, so thrown props, effect cards and stray bits don't shrink the fit
  // (skinned meshes cache their bounds, so the cache is dropped to measure the current pose)
  root.updateMatrixWorld(true); root.traverse(o => { if (o.isSkinnedMesh) { o.skeleton.update(); o.boundingBox = null; } });
  const parts = []; root.traverse(o => { if (o.isMesh && o.visible && [o.material].flat().some(m => m.visible && m.blending !== THREE.AdditiveBlending)) parts.push([o.geometry.attributes.position.count, new THREE.Box3().setFromObject(o)]); });
  if (!parts.length) return new THREE.Box3().setFromObject(root);
  const [mainCount, main] = parts.reduce((a, b) => (b[0] > a[0] ? b : a)), c = main.getCenter(new V3()), reach = main.getSize(new V3()).length();
  const box = new THREE.Box3(); // big parts (Zubat's wings) always count; small far ones are props and effects
  for (const [n, b] of parts) if (n >= mainCount * 0.15 || b.getCenter(new V3()).distanceTo(c) < reach) box.union(b);
  return box;
}
function prepXY(name, scene, animated, height) { // runs after textures load, so effect parts can be told apart by texture file name; height sizes species with no sculpt to match
  const fire = new V3(), tmp = new V3(); let nFire = 0;
  if (name === 'pikachu' && !animated) relaxPikachuArms(scene); // pose the template so followers, battles and portraits all inherit it
  scene.updateMatrixWorld(true);
  scene.traverse(o => o.isSkinnedMesh && o.skeleton.update()); // skinned bounds read bone matrices, which are only filled at render time
  scene.traverse(o => {
    if (!o.isMesh) return;
    if (/Vine|Eff/i.test(o.name)) { o.visible = false; return; } // move-effect meshes (Vine Whip etc.) sit folded out in the rest pose
    const geo = o.geometry; if (!geo.attributes.uv && geo.attributes.uv1) geo.setAttribute('uv', geo.attributes.uv1); // ColladaMax exports put the only UV set in channel 1
    const mats = [o.material].flat().map(m => {
      m.map && (m.map.colorSpace = THREE.SRGBColorSpace);
      // Bulbasaur's iris overlays the white eye; discard its transparent red
      // background so the sclera underneath remains visible, including in shadows.
      const iris = name === 'bulbasaur' && /_Iris1\.png(?:[?#]|$)/i.test(m.map?.image?.src || '');
      const s = new THREE.MeshStandardMaterial({ map: m.map, roughness: 0.6, alphaTest: iris ? 0.5 : FOLK[name] ? 0.3 : 0 }); s.onBeforeCompile = CMAT.body.onBeforeCompile;
      if (mostlyBlack(m.map?.image)) // overlay layers (Pikachu's cheek glow) are colour on black, added on top by the 3DS; drawn solid they paint a black ring
        Object.assign(s, { blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
      s.userData.fire = /Fire/i.test(m.map?.image?.src || ''); // X/Y flame cards have no alpha; the game draws its own flame there
      s.visible = !s.userData.fire && !EFFECT_MAT.test(m.name);
      return s;
    });
    (geo.groups.length ? geo.groups : [{ start: 0, count: geo.index ? geo.index.count : geo.attributes.position.count, materialIndex: 0 }]).forEach(gr => {
      if (!mats[gr.materialIndex].userData.fire) return;
      for (let i = gr.start; i < gr.start + gr.count; i++) { fire.add(tmp.fromBufferAttribute(geo.attributes.position, geo.index ? geo.index.getX(i) : i).applyMatrix4(o.matrixWorld)); nFire++; }
    });
    o.material = mats.length === 1 ? mats[0] : mats;
    o.castShadow = o.receiveShadow = true; o.frustumCulled = false;
  });
  let calm = null;
  if (animated) { // measure the idle pose, not the rest pose
    // ColladaLoader targets tracks by node uuid, which SkeletonUtils.clone does not keep, so clones never played the idle and froze
    // in the template's first frame (Eevee mid-somersault, curled in a ball). Target unique node names instead.
    const byId = {}, uses = {}; scene.traverse(o => { byId[o.uuid] = o; uses[o.name] = (uses[o.name] || 0) + 1; });
    for (const t of scene.animations[0].tracks) {
      const dot = t.name.indexOf('.'), o = byId[t.name.slice(0, dot)];
      if (o?.name && uses[o.name] === 1 && !/[.\[\]:\/]/.test(o.name)) t.name = o.name + t.name.slice(dot);
    }
    calm = quietClip(scene, scene.animations[0]); // followers: no hops, so a walking Pokémon doesn't jump on the spot
    scene.animations[0] = quietClip(scene, scene.animations[0], true); // full idle (head, arms, tail, the odd hop) so they look alive; only orb intros and turn-arounds are cut
    const m = new THREE.AnimationMixer(scene); m.clipAction(scene.animations[0]).play(); m.update(0);
  }
  const box = bodyBounds(scene);
  const want = height ? null : new THREE.Box3().setFromObject(rig(FOLK[name]?.[1] || name).root), H = height ?? want.max.y - want.min.y;
  const k = H / (box.max.y - box.min.y), c = box.getCenter(new V3());
  const g = new THREE.Group(), fit = new THREE.Group(); fit.add(scene); fit.scale.setScalar(k); g.add(fit);
  scene.position.set(-c.x, -box.min.y, -c.z);
  if (nFire) g.userData.fire = fire.divideScalar(nFire).add(scene.position).multiplyScalar(k);
  // bone names in the rips are generic (Bone14, joint21), so tail and wing chains are found by position:
  // the tip furthest out, then its parents while they stay out there. Stored as traversal indices so clones can find them.
  if (animated) { g.userData.clips = scene.animations; g.userData.calm = calm; g.userData.chains = { legs: legChains(g) }; return g; } // Pokédex 3D Pro idle clip moves tail and wings itself
  const bones = []; g.traverse(o => o.isBone && bones.push(o));
  for (const b of bones) if (XY_HIDE[name]?.includes(b.name)) b.scale.setScalar(1e-4);
  g.updateMatrixWorld(true);
  const at = bones.map(b => b.getWorldPosition(new V3()));
  const chain = (score, keep, worldAxis) => {
    if (!bones.length) return null;
    let b = bones[at.reduce((best, p, i) => (score(p) > score(at[best]) ? i : best), 0)]; const list = [b];
    while (b.parent?.isBone && keep(at[bones.indexOf(b.parent)])) list.unshift(b = b.parent);
    return { idx: list.map(x => bones.indexOf(x)), axis: list.map(x => worldAxis.clone().applyQuaternion(x.getWorldQuaternion(new THREE.Quaternion()).invert()).toArray()) };
  };
  g.userData.chains = {
    tail: chain(p => -p.z, p => p.z < -0.12 * H, new V3(0, 0, 1)), // side-to-side tilt, like the sculpt's tail.rotation.z
    wingL: chain(p => p.x, p => p.x > 0.1 * H, new V3(0, 0, 1)),
    wingR: chain(p => -p.x, p => p.x < -0.1 * H, new V3(0, 0, 1)), // same axis: the caller already mirrors the angle per side
    ears: chain(p => p.y, p => p.y > 0.8 * H, new V3(1, 0, 0)), // the highest tip (an ear on Pikachu), twitched forward and back
    legs: legChains(g),
  };
  return g;
}
function legChains(g) { // walkers: thigh and knee joints by name (both rip sources call them LThigh/LLeg), bent about the side axis;
  // when the hands rest on the ground (Bulbasaur) the arms are front legs too
  const bones = []; g.traverse(o => o.isBone && bones.push(o)); g.updateMatrixWorld(true);
  const find = names => { const idx = names.map(n => bones.findIndex(b => b.name === n)); return idx.includes(-1) ? null : idx; };
  const q = new THREE.Quaternion(), side = new V3(1, 0, 0), y = i => bones[i].getWorldPosition(new V3()).y;
  const joints = idx => idx.map(i => ({ idx: [i], axis: [side.clone().applyQuaternion(bones[i].getWorldQuaternion(q).invert()).toArray()] }));
  const hind = find(['LThigh', 'LLeg', 'RThigh', 'RLeg']), front = find(['LArm', 'LForeArm', 'RArm', 'RForeArm']), hand = find(['LHand']);
  if (!hind) return null;
  const len = y(hind[0]); // hip height, with the feet on the ground
  return { len, j: joints(hind), front: front && hand && y(hand[0]) < len * 0.5 ? joints(front) : null };
}
{ // the manager also tracks the textures, so party portraits are not drawn before they arrive
  const mgr = new THREE.LoadingManager(), texDone = new Promise(r => (mgr.onLoad = mgr.onError = r)), loader = new ColladaLoader(mgr);
  const files = { pikachu: 'Pikachu', bulbasaur: 'Bulbasaur', charmander: 'Charmander', pidgey: 'Pidgey', rattata: 'Rattata', caterpie: 'Caterpie', weedle: 'Weedle', oddish: 'Oddish',
    player: 'Serena', calem: FOLK.calem[0], girl:'Shauna', kid: 'Trevor', elder: 'Gardener', nurse: 'Nurse' }; // humans: unzipped from models/xy-zips
  const HUMANS = new Set(['player', 'calem', 'girl', 'kid', 'elder', 'nurse']);
  // Pokémon prefer the Pokédex 3D Pro rips in models/p3d/<Name>/: anim.dae is the model plus its idle animation.
  const fromXY = n => loader.loadAsync(encodeURI(`models/xy/${n.includes('/') ? n : n + '/model.dae'}`)).then(c => {
    // ColladaLoader names joints by sid, which ColladaMax rips set to "BoneN"; restore the joint names (LThigh, Head...)
    const names = {}; for (const d of Object.values(c.library.nodes)) if (d.type === 'JOINT' && d.sid) names[d.sid] = d.name;
    c.scene.traverse(o => o.isBone && names[o.name] && (o.name = names[o.name]));
    return [c.scene, false];
  });
  const DEX_NO = { pikachu: 25, bulbasaur: 1, charmander: 4, pidgey: 16, rattata: 19, caterpie: 10, weedle: 13, oddish: 43 };
  const fromP3D = (n, k) => loader.loadAsync(`models/p3d/${String(DEX_NO[k]).padStart(4, '0')}/anim.dae`).then(c => (c.scene.animations?.forEach(cleanClip), [c.scene, c.scene.animations?.length > 0]));
  const got = await Promise.all(Object.entries(files).map(([k, n]) =>
    (HUMANS.has(k) ? fromXY(n) : fromP3D(n, k).catch(() => fromXY(n))).then(([s, anim]) => [k, s, anim], () => null)));
  if (got.some(Boolean)) await texDone;
  for (const [n, s, anim] of got.filter(Boolean)) XY[n] = prepXY(n, s, anim);}
const XY_MIXERS = new Set();
function tickXYMixers(dt) { // a mixer runs while its model is in a scene; it is dropped once the model leaves one (or never joins within 5 s)
  for (const m of XY_MIXERS) {
    const root = m.getRoot(); let o = root; while (o.parent) o = o.parent;
    if (o.isScene) { m.update(dt); root.userData.placed = true; }
    else if (root.userData.placed || (root.userData.age = (root.userData.age || 0) + dt) > 5) XY_MIXERS.delete(m);
  }
}
function xy(name, follower = false) {
  const t = XY[name]; if (!t) return null;
  const g = SkeletonUtils.clone(t), bones = []; g.traverse(o => o.isBone && bones.push(o));
  const live = c => c && { userData: { chain: c.idx.map((i, k) => ({ b: bones[i], rest: bones[i].quaternion.clone(), axis: new V3().fromArray(c.axis[k]) })) } };
  const { tail, wingL, wingR, ears, legs } = t.userData.chains;
  g.userData = { fire: t.userData.fire, chains: { tail: live(tail), wingL: live(wingL), wingR: live(wingR), ears: live(ears), legs: legs && { len: legs.len, j: legs.j.map(c => live(c).userData.chain[0]), front: legs.front?.map(c => live(c).userData.chain[0]) } } };
  if (t.userData.clips?.length) { // Pokédex 3D Pro idle, started at a random point so a group doesn't move in sync
    const clip = (follower && t.userData.calm) || t.userData.clips[0];
    const m = new THREE.AnimationMixer(g); m.clipAction(clip).play(); m.setTime(Math.random() * clip.duration); XY_MIXERS.add(m);
  }
  return g;
}
const _swingQ = new THREE.Quaternion();
function swing(o, a) { // sculpt parts turn as one piece; X/Y bone chains bend a share of the angle at each joint
  const ch = o.userData.chain; if (!ch) { o.rotation.z = a; return; }
  for (const c of ch) c.b.quaternion.copy(c.rest).multiply(_swingQ.setFromAxisAngle(c.axis, a / ch.length));
}
function bend(c, a) { // one joint, on top of the pose the idle clip set this frame (or the last one, when no mixer is running)
  const q = c.b.quaternion; if (!c.out?.equals(q)) (c.base ??= new THREE.Quaternion()).copy(q);
  q.copy(c.base).multiply(_swingQ.setFromAxisAngle(c.axis, a)); (c.out ??= new THREE.Quaternion()).copy(q);
}

function makePikachu() { const x = xy('pikachu', true); if (x) { x.userData.tail = x.userData.chains.tail || new THREE.Group(); return x; } const { root, parts } = rig('pikachu'); root.userData.tail = parts.tail; return root; }
function makeBulbasaur() { return xy('bulbasaur') || rig('bulbasaur').root; }
function makeCharmander() {
  const g = xy('charmander', true) || rig('charmander').root, flame = new THREE.Group(); flame.position.copy(g.userData.fire || new V3(0, 0.8, -0.68)); g.add(flame);
  add(new THREE.ConeGeometry(0.1, 0.32, 10), '#ff9a2e', flame, 0, 0, 0, { mat: { emissive: '#ff6a00', emissiveIntensity: 3 }, shadow: false });
  add(new THREE.ConeGeometry(0.055, 0.2, 10), '#fff27a', flame, 0, -0.03, 0.02, { mat: { emissive: '#ffe24a', emissiveIntensity: 3 }, shadow: false });
  flame.add(new THREE.PointLight('#ff8a2a', 2.5, 3, 2));
  g.userData.flame = flame;
  return g;
}

// player + followers
const player = makeHuman('player');
const P = { pos: new V3(START[0], 0, START[1]), face: Math.PI / 2 + 0.25, speed: 0, v: 0 };
player.root.position.copy(P.pos); player.root.rotation.y = P.face; scene.add(player.root);
// the trainer picked at onboarding; null until then (new game, or a save from before onboarding existed)
const TRAINERS = { serena: 'player', calem: 'calem', tierno: 'tierno', viola: 'viola', grant: 'grant', korrina: 'korrina', valerie: 'valerie', emma: 'emma' }; // character -> XY model key
let trainer = null, shownChar = 'serena', wantChar = 'serena';
async function setTrainer(char) { // swaps the player model in place; everything else only holds `player` and `player.root`
  if (!Object.hasOwn(TRAINERS, char)) char = 'serena';
  wantChar = char;
  if (!XY[TRAINERS[char]] && FOLK[TRAINERS[char]]) await loadFolkModel(TRAINERS[char]); // the extra trainers load on first pick
  if (char !== wantChar) return; // a later pick arrived while this one loaded
  if (!XY[TRAINERS[char]]) char = 'serena';
  if (char === shownChar) return; shownChar = char;
  scene.remove(player.root);
  Object.assign(player, makeHuman(TRAINERS[char]));
  player.root.position.copy(P.pos); player.root.rotation.y = P.face; scene.add(player.root);
}
// the follower is the party lead (Pikachu until the party is known); setFollower swaps the model, PK keeps its place and motion
const FOLLOW_STYLE = { PIKACHU: ['bound', 0.85], BULBASAUR: ['bound', 0.8], CHARMANDER: ['waddle', 0.72] }; // [gait, scale]; others waddle (or hover) at 0.75
let pika = makePikachu(), followKey = 'PIKACHU'; scene.add(pika);
const PIKA0 = I(795, 486, 0);
const follower = (x, z, face) => ({ pos: new V3(x, 0, z), face, v: 0, ph: 0, amt: 0, roll: 0, look: 0, idleT: 2, act: null, actT: 0, dir: 1 });
const PK = follower(PIKA0[0], PIKA0[1], P.face);
function styleFollower(o, key) {
  const [gait, base] = FOLLOW_STYLE[key] || [o.userData.flies ? 'hover' : 'waddle', 0.75];
  Object.assign(o.userData, { gait, base }); o.scale.setScalar(base); o.rotation.order = 'YXZ'; o.rotation.y = PK.face;
}
styleFollower(pika, 'PIKACHU');
function setFollower(key) {
  if (!key || key === followKey || !SPECIES[key]) return;
  if (SPECIES[key].auto && !XY[key]) return; // its model is still loading: loadSpeciesModel re-renders the party when it lands
  const o = SPECIES[key].make(); if (!o) return;
  scene.remove(pika); pika = o; followKey = key;
  styleFollower(pika, key); pika.position.copy(PK.pos); scene.add(pika);
}

const npcs = [];
function npc(h, x, z, face, name, lines, extra = {}) {
  h.root.position.set(x, walkH(x, z), z); h.root.rotation.y = face; scene.add(h.root);
  const n = { h, x, z, face, baseFace: face, name, lines, ...extra }; npcs.push(n); return n;
}
npc(makeHuman('nurse'), PC.cx, PC.fz + 0.32, 0, 'Nurse',
  ['Welcome to the Pokémon Center!', 'We restore your tired Pokémon to full health.', '...All done! Your Pokémon are fighting fit. We hope to see you again!'], { after: () => healParty() });
const elder = npc(makeHuman('elder'),
  BENCH[0] + Math.sin(BENCH_ROT) * 0.05 + Math.cos(BENCH_ROT) * 0.3, BENCH[1] + Math.cos(BENCH_ROT) * 0.05 - Math.sin(BENCH_ROT) * 0.3, BENCH_ROT, 'Old man',
  ['Back in my day there was no bridge here.', 'We hopped across the river stones. Builds character!']);
npcs.forEach(n => n.h.root.scale.setScalar(0.85));
elder.h.body.position.y = -0.3; elder.h.legs.forEach(l => (l.rotation.x = -1.4)); elder.sit = true;
{ const k = I(680, 228, PLAZA_H); npc(makeHuman('kid'), k[0], k[1], 0.9, 'Kid',
  ['My egg is going to hatch any day now!', "Grandpa says to keep it warm, so I'm sitting it by the lamp."]); }
const GA = I(1490, 455, 0), GB = I(1622, 368, 0), G0 = I(1530, 410, 0);
const girl = npc(makeHuman('girl'), G0[0], G0[1], 2.2, 'Hiker Mia',
  ["My Charmander's tail flame shows how it feels.", "It's blazing today, so we're heading up Meadow Route!"], { patrol: [GA, GB], leg: 1, wait: 0 });
const charm = makeCharmander(); charm.scale.setScalar(0.72); scene.add(charm);
const CH0 = I(1606, 397, 0);
const CH = follower(CH0[0], CH0[1], 2.2);
Object.assign(charm.userData, { gait: 'waddle', base: 0.72 }); charm.rotation.order = 'YXZ';
const bulba = makeBulbasaur(); bulba.scale.setScalar(1.05); scene.add(bulba);
bulba.position.set(BU[0], terrainH(...BU), BU[1]); bulba.rotation.y = 0.5;
circles.push({ x: BU[0], z: BU[1], r: 0.4 });

const interactables = [
  ...npcs.map(n => ({ get x() { return n.x; }, get z() { return n.z; }, r: 1.6, name: n.name, lines: n.lines, npc: n, after: n.after, top: 2.5 })),
  { x: SIGN[0], z: SIGN[1], r: 1.3, name: 'Sign', lines: ['POKéMON CENTER', 'Heal your Pokémon! Open all day, every day.'], top: 1.5 },
  { x: POST[0], z: POST[1], r: 1.4, name: 'Signpost', lines: ['← Verdant Town      Meadow Route →', 'Mind the tall grass. Wild Pokémon live there!'], top: 2 },
  { x: BU[0], z: BU[1], r: 1.8, name: 'Bulbasaur', lines: ['Bulba... Bulbasaur!', 'This wild Bulbasaur fled here from the stream. It is trembling, and lashes out at anyone who comes close!'], top: 1.4,
    after: () => startBattle('BULBASAUR', 5, { intro: 'The frightened wild BULBASAUR attacks!', onWin: retireBulbasaur }) },
  { x: COT.door[0], z: COT.door[1], r: 1.1, name: 'Door', lines: ["It's locked. Smells like fresh bread inside..."], top: 2.2 },
];

// other modules assign these through their setters (an imported binding is read-only)
function setTrainerProfile(v) { return (trainer = v); }
export { CH, EFFECT_MAT, P, PK, TRAINERS, XY, XY_MIXERS, animWalk, bend, bodyBounds, bulba, charm, cleanClip, followKey, girl,
  interactables, makeBulbasaur, makeCharmander, makeHuman, makePikachu, mostlyBlack, npc, npcs, pika, player, prepXY, quietClip,
  rig, setFollower, setTrainer, setTrainerProfile, swing, tickXYMixers, trainer, xy };
