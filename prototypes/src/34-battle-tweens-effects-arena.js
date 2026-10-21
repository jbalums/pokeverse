import './33-wild-pokemon-models.js'; // first: the modules run in file-number order (see main.js)
import * as THREE from 'three';
import { V3, clamp, pick, rnd, rr, squash } from './01-helpers.js';
import { scene } from './06-renderer-scene-post.js';
import { SPH, canvasTex, detailTex } from './07-materials-textures.js';
import { AMAT, ASSETS } from './08-blender-assets.js';
import { _v } from './12-batched-props.js';
import { SHORT_GEO, TALL_GEO, scatter } from './17-instanced-grass-reeds-flowers.js';
import { $ } from './25-input.js';
import { SPECIES } from './27-pokemon-data.js';
import { nm } from './28-evolution-data.js';
import { SND, rf } from './37-battle-sound-effects.js';
import { vh, vw } from './41-loop.js';
import { SET } from './43-settings.js';

// ============================================================ battle: tweens, effects, arena
const BT = { active: false, scene: null, cam: null, foe: null, me: null, foeModel: null, meModel: null, opts: {}, tries: 0 };const B_ME = new V3(-2.9, 0.16, 2.5), B_FOE = new V3(3.7, 0.16, -4.0), B_CAM = new V3(-2.3, 3.1, 9.2), B_LOOK = new V3(0.0, 0.45, -1.6);
const tweens = [];
const tween = (dur, fn) => new Promise(res => tweens.push({ t: 0, dur, fn, res }));
const wait = s => tween(s, () => {});
const easeIO = t => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
const easeBack = t => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
// Full-body battle pose on the group between a battler's pivot and its model: z forward (toward the foe), y up, lean (+ pitches
// forward about the feet), roll, sy squash/stretch, sc uniform swell. Keys are {t: 0..1, ...}; missing fields mean rest.
// A pose starts from wherever the body is now and the newest call wins, but every call still resolves on time.
const POSE_REST = { z: 0, y: 0, lean: 0, roll: 0, sy: 1, sc: 1 };
function setPose(p, z, y, lean, roll, sy, sc) {
  p.position.set(0, y, z); p.rotation.x = lean; p.rotation.z = roll;
  p.userData.sy = sy; p.userData.sc = sc; squash(p, sy, sc);
}
function pose(m, dur, keys) {
  const p = m.userData.pose, id = m.userData.poseId = (m.userData.poseId || 0) + 1;
  const ks = [{ t: 0, z: p.position.z, y: p.position.y, lean: p.rotation.x, roll: p.rotation.z, sy: p.userData.sy ?? 1, sc: p.userData.sc ?? 1 }, ...keys.map(k => ({ ...POSE_REST, ...k }))];
  let i = 1;
  return tween(dur, t => {
    if (m.userData.poseId !== id) return;
    while (i < ks.length - 1 && t > ks[i].t) i++;
    const a = ks[i - 1], b = ks[i], u = b.t > a.t ? easeIO(clamp((t - a.t) / (b.t - a.t), 0, 1)) : 1;
    setPose(p, keyAt(a, b, 'z', u), keyAt(a, b, 'y', u), keyAt(a, b, 'lean', u), keyAt(a, b, 'roll', u), keyAt(a, b, 'sy', u), keyAt(a, b, 'sc', u));
  });
}
const keyAt = (a, b, k, u) => a[k] + (b[k] - a[k]) * u;
function tickTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i]; tw.t = Math.min(tw.dur, tw.t + dt); tw.fn(tw.dur ? tw.t / tw.dur : 1);
    if (tw.t >= tw.dur) { tweens.splice(i, 1); tw.res(); }
  }
}
const dotTex = canvasTex(32, 32, c => { const gr = c.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 32, 32); });
const blobTex = canvasTex(64, 64, c => { const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); });
const fx = [];
function burst(p, color, o = {}) {
  const n = o.n ?? 26, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), vel = [];
  for (let i = 0; i < n; i++) { pos.set([p.x, p.y, p.z], i * 3); vel.push(new V3(rr(-1, 1), rr(-0.2, 1) * (o.up ?? 1), rr(-1, 1)).normalize().multiplyScalar(rr(0.4, 1) * (o.speed ?? 2))); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: dotTex, color, size: o.size ?? 0.18, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  BT.scene.add(pts);
  fx.push({ obj: pts, vel, t: 0, life: o.life ?? 0.7, grav: o.grav ?? -3, to: o.to });
}
function bolt(p, from = p.clone().add(new V3(0, 4, 0)), color = '#fff7b0', width = 0.05) { // jagged lightning from `from` to `p`
  const pts = [], n = 9, side = new V3().subVectors(p, from).cross(new V3(0, 1, 0.3)).normalize();
  for (let i = 0; i <= n; i++) { const j = i > 0 && i < n ? 1 : 0; pts.push(from.clone().lerp(p, i / n).addScaledVector(side, rr(-0.32, 0.32) * j).add(new V3(0, rr(-0.2, 0.2) * j, 0))); }
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 48, width, 6), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  m.material.color.multiplyScalar(3); BT.scene.add(m);
  fx.push({ obj: m, t: 0, life: 0.35, flicker: true });
}

// ------------------------------------------------------------ move effects toolkit
const GLOW_SPRITE_GEO = new THREE.Sprite().geometry; // sprites share this; disposal skips it
const easeOut = t => 1 - (1 - t) ** 3;
const addFx = (obj, life, upd) => { BT.scene.add(obj); fx.push({ obj, t: 0, life, upd }); return obj; };
const glowMat = (color, opacity = 1, additive = true) => new THREE.SpriteMaterial({ map: dotTex, color, transparent: true, opacity, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, toneMapped: !additive });
const at = (m, h = 0.55, f = 0.2) => { // a point on the front of a battler, 0 feet .. ~1 head, following its pose (thrusts, knockbacks)
  const p = m.userData.pose; p.updateWorldMatrix(true, false); return p.localToWorld(new V3(0, h, f));
};
function glow(p, color, size, life, grow = 0.5) { // soft light ball that swells and fades
  const s = new THREE.Sprite(glowMat(color)); s.position.copy(p); s.scale.setScalar(size);
  return addFx(s, life, k => { s.scale.setScalar(size * (1 + grow * k)); s.material.opacity = 1 - k * k; });
}
function lightFlash(p, color, power = 6, life = 0.35) { const l = new THREE.PointLight(color, power, 7, 2); l.position.copy(p); addFx(l, life, k => (l.intensity = power * (1 - k))); }
function ring(p, color, r = 1.6, life = 0.45, tilt = 0) { // expanding shockwave ring, flat on the ground unless tilted
  const m = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 56), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  m.rotation.x = -Math.PI / 2 + tilt; m.position.copy(p);
  return addFx(m, life, k => { m.scale.setScalar(0.15 + r * easeOut(k)); m.material.opacity = 1 - k; });
}
function smoke(p, color, size, life) { // soft opaque puff (normal blending, so it can darken)
  const s = new THREE.Sprite(glowMat(color, 0.9, false)); s.position.copy(p); s.scale.setScalar(size * 0.4);
  return addFx(s, life, k => { s.scale.setScalar(size * (0.4 + 0.9 * easeOut(k))); s.material.opacity = 0.9 * (1 - k); s.position.y += 0.004; });
}
function shake(amount, dur = 0.3) { if (SET.calm) return; BT.shake = Math.max(BT.shake || 0, amount); BT.shakeLeft = dur; BT.shakeDur = dur; }
function screenFlash(color, dur = 0.3) {
  if (SET.calm) return;
  let el = $('bflash'); if (!el) { el = document.createElement('div'); el.id = 'bflash'; el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;opacity:0;mix-blend-mode:screen'; document.body.appendChild(el); }
  el.style.transition = 'none'; el.style.background = color; el.style.opacity = '0.75'; void el.offsetWidth;
  el.style.transition = `opacity ${dur}s ease-out`; el.style.opacity = '0';
}
async function projectile(from, to, { color, size = 0.4, dur = 0.42, arc = 0.35, trail = color, trailN = 3, core = '#ffffff', spin = 0 } = {}) {
  const g = new THREE.Group(), outer = new THREE.Sprite(glowMat(color)), inner = new THREE.Sprite(glowMat(core));
  outer.scale.setScalar(size); inner.scale.setScalar(size * 0.45); g.add(outer, inner); BT.scene.add(g);
  const light = new THREE.PointLight(color, 2.5, 4, 2); g.add(light);
  let n = 0;
  await tween(dur, t => {
    g.position.lerpVectors(from, to, t); g.position.y += Math.sin(t * Math.PI) * arc;
    if (spin) g.position.add(new V3(Math.cos(t * spin) * 0.15, Math.sin(t * spin) * 0.15, 0));
    if (trail && n++ % 2 === 0) burst(g.position, trail, { n: trailN, speed: 0.35, grav: 0.4, life: 0.35, size: size * 0.45 });
  });
  BT.scene.remove(g); outer.material.dispose(); inner.material.dispose();
  return to;
}
function impact(dm, color, strength = 1) { // the shared "hit" beat: sparks, a ground ring, a light pop and a little camera kick
  const p = at(dm); SND.hit(strength);
  burst(p, color, { n: Math.round(26 * strength), speed: 3.2, grav: 0, life: 0.45, size: 0.22 });
  burst(p, '#ffffff', { n: 10, speed: 4, grav: 0, life: 0.25, size: 0.16 });
  glow(p, color, 1.1 * strength, 0.28, 0.8);
  ring(new V3(dm.position.x, 0.08, dm.position.z), color, 1.7 * strength, 0.45);
  lightFlash(p, color, 5 * strength, 0.3);
  shake(0.1 * strength, 0.28);
  knock(dm, strength);
}
// The defender takes the hit: snapped back along the line it came from (a battler faces its foe, so that is local -z), tilted
// and squashed, with a hit-stop freeze. hitAnim() then recovers it. Random tilt side uses Math.random, never rnd().
function knock(dm, strength = 1) {
  const k = Math.min(strength, 2), side = Math.random() < 0.5 ? -1 : 1;
  BT.stop = Math.max(BT.stop || 0, 0.05 + 0.04 * k);
  dm.userData.hit = { z: -0.18 * k, lean: -0.22 * k, roll: side * 0.12 * k, sy: 1 - 0.12 * k };
  pose(dm, 0.06, [{ t: 0.4, ...dm.userData.hit }, { t: 1, ...dm.userData.hit }]);
}
const faceDir = (am, dm) => new V3().subVectors(dm.position, am.position).setY(0).normalize();
// Attack phases, shared by every move: anticipation (crouch / rear back, squash), action (lunge / thrust, stretch), recovery
// (settle home with an overshoot). The lean pivots at the feet, so the head and front limbs lead the motion.
const CROUCH = [{ t: 1, lean: -0.25, sy: 0.82, y: -0.02 }];
const LUNGE = [{ t: 1, lean: 0.35, sy: 1.15, z: 0.05 }];
const SNAP_LUNGE = [{ t: 0.3, lean: -0.15, sy: 0.85 }, { t: 1, lean: 0.35, sy: 1.15, z: 0.05 }];
const SETTLE = [{ t: 0.55, lean: -0.08, sy: 0.93 }, { t: 0.8, lean: 0.03, sy: 1.03 }, { t: 1 }];
const wag = (am, dur, gain = 3) => { const u = am.userData.inner.userData; tween(dur, t => (u.wag = gain * Math.sin(t * Math.PI))).then(() => (u.wag = 0)); }; // tail and wings trail the body
async function windUp(am, dm, back = 0.25, dur = 0.14) { // crouch and lean back before a strike
  const a = am.position.clone(), d = faceDir(am, dm);
  pose(am, dur, CROUCH);
  await tween(dur, t => am.position.copy(a).addScaledVector(d, -back * easeOut(t)));
  return a;
}
async function dash(am, dm, home, frac = 0.62, dur = 0.14, ghosts = false) { // rush in, (caller hits), comes back with dashBack
  const d = new V3().subVectors(dm.position, home).multiplyScalar(frac), from = am.position.clone(), to = home.clone().add(d);
  const p = am.userData.pose; pose(am, dur, p.rotation.x < -0.1 ? LUNGE : SNAP_LUNGE); wag(am, dur + 0.2);
  let n = 0;
  await tween(dur, t => {
    am.position.copy(from).lerp(to, easeIO(t));
    if (ghosts && n++ % 2 === 0) glow(at(am, 0.45), '#ffffff', 0.9, 0.25, -0.3);
  });
}
const dashBack = (am, home, dur = 0.22) => { const from = am.position.clone(); pose(am, dur, SETTLE); return tween(dur, t => am.position.copy(from).lerp(home, easeIO(t))); };
// Cast pose for special moves: rear up and stretch while the energy gathers, then thrust at the foe on the last beat, so a
// caller that reads at(am, ...) after `await charge` fires from the thrust mouth or cheeks. Recovery runs on its own.
const CAST = [{ t: 0.7, lean: -0.28, sy: 1.12, y: 0.04 }, { t: 1, lean: 0.3, sy: 0.9, z: 0.08 }];
async function charge(am, color, dur = 0.45) { // gather energy: sparks pulled in while the body rears back, then the thrust
  const p = at(am); SND.charge(dur);
  glow(p, color, 1.4, dur, -0.6);
  for (let i = 0; i < 3; i++) setTimeout(() => burst(p.clone().add(new V3(rr(-0.8, 0.8), rr(-0.3, 0.8), rr(-0.8, 0.8))), color, { n: 8, to: p, speed: 1, life: dur * 0.8, size: 0.16 }), i * dur * 250);
  await pose(am, dur, CAST);
  pose(am, 0.45, SETTLE);
}
// Specials without a charge get the same three phases, squeezed into a short pose that runs alongside the move's first beat.
const cast = am => pose(am, 0.4, [{ t: 0.3, lean: -0.22, sy: 1.1, y: 0.03 }, { t: 0.5, lean: 0.25, sy: 0.92, z: 0.06 }, ...SETTLE.map(k => ({ ...k, t: 0.5 + k.t * 0.5 }))]);
function slash(p, color, angle, delay = 0, len = 1.3) { // a bright claw streak that draws itself across the target
  setTimeout(() => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.07), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.material.color.multiplyScalar(2.5); m.position.copy(p); m.lookAt(BT.cam.position); m.rotateZ(angle);
    addFx(m, 0.32, k => { m.scale.set(Math.min(1, k * 4), 1 - k * 0.5, 1); m.material.opacity = k < 0.5 ? 1 : 2 - k * 2; });
  }, delay * 1000);
}
function vine(from, to, color = '#3fa83a', bend = 0.8, life = 0.7) { // a curved vine that grows out, cracks and pulls back
  const side = new V3().subVectors(to, from).cross(new V3(0, 1, 0)).normalize().multiplyScalar(bend);
  const mid = from.clone().lerp(to, 0.5).add(side).add(new V3(0, 0.9, 0));
  const geo = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(from, mid, to), 40, 0.045, 6), total = geo.index.count;
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: color, emissiveIntensity: 0.25 }));
  return addFx(m, life, k => geo.setDrawRange(0, growTo(total, k < 0.6 ? k / 0.35 : (1 - k) / 0.4)));
}
const growTo = (total, f) => Math.floor(total * clamp(f, 0, 1) / 3) * 3; // index count for a tube drawn f of the way (whole triangles)
function wrap(dm, color, life = 0.9) { // silk / wind coiling up around the target
  const g = new THREE.Group(), s = dm.userData.s;
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.42 * s, 0.025, 6, 48), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    t.rotation.x = Math.PI / 2 + rr(-0.25, 0.25); t.position.y = (0.2 + i * 0.28) * s; g.add(t);
  }
  g.position.copy(dm.position);
  return addFx(g, life, k => g.children.forEach((t, i) => { t.rotation.z += 0.25; t.scale.setScalar(1.4 - easeOut(Math.min(1, k * 2)) * 0.5); t.material.opacity = k < 0.7 ? 1 : (1 - k) / 0.3; }));
}

async function beam(from, to, { color, core = '#ffffff', width = 0.18, dur = 0.75, swirl = null, sparks = color } = {}) { // a solid energy beam
  const len = from.distanceTo(to), dir = new V3().subVectors(to, from).normalize(), mid = from.clone().lerp(to, 0.5), g = new THREE.Group();
  const tube = (r, c, o) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 20, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.material.color.multiplyScalar(1.8); g.add(m); return m;
  };
  const outer = tube(width, color, 0.55), inner = tube(width * 0.42, core, 1);
  g.position.copy(mid); g.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir);
  addFx(g, dur, k => { const w = k < 0.12 ? k / 0.12 : k > 0.8 ? (1 - k) / 0.2 : 1 + Math.sin(k * 70) * 0.1; outer.scale.set(w, 1, w); inner.scale.set(w, 1, w); });
  glow(from, color, width * 9, dur, 0.1); glow(to, color, width * 10, dur, 0.3); lightFlash(to, color, 7, dur);
  let n = 0;
  await tween(dur, t => {
    if (n++ % 2) return;
    burst(to, sparks, { n: 7, speed: 3, grav: 0, life: 0.4, size: 0.22 });
    if (swirl) burst(from.clone().lerp(to, rnd()), swirl, { n: 3, speed: 0.8, grav: 0, life: 0.3, size: 0.2 });
  });
}
async function stream(from, to, colors, { dur = 0.8, size = 0.32, spread = 0.18, smokeColor = null, additive = true } = {}) { // flamethrower / water gun / sand spray
  let n = 0;
  await tween(dur, () => {
    for (let j = 0; j < 3; j++) { // each puff flies the whole way, swelling and widening like a real jet
      const s = new THREE.Sprite(glowMat(colors[(n + j) % colors.length], 1, additive)), aim = to.clone().add(new V3(rr(-spread, spread), rr(-spread, spread), rr(-spread, spread)));
      const wob = new V3(rr(-1, 1), rr(-1, 1), rr(-1, 1)).multiplyScalar(0.25), life = rr(0.3, 0.4);
      addFx(s, life, k => { s.position.lerpVectors(from, aim, k).addScaledVector(wob, Math.sin(k * Math.PI)); s.scale.setScalar(size * (0.4 + k * 1.6)); s.material.opacity = k < 0.8 ? 1 : (1 - k) / 0.2; });
    }
    if (smokeColor && n % 4 === 0) smoke(to.clone().add(new V3(rr(-0.3, 0.3), rr(0, 0.5), rr(-0.3, 0.3))), smokeColor, 0.8, 0.7);
    n++;
  });
}
function rocks(dm, color = '#8a7a5a', n = 5) { // boulders crash down around and onto the target
  const s = dm.userData.s;
  for (let i = 0; i < n; i++) setTimeout(() => {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(rr(0.18, 0.32) * s, 0), new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true }));
    const x = dm.position.x + rr(-0.6, 0.6), z = dm.position.z + rr(-0.5, 0.5); m.castShadow = true;
    addFx(m, 0.55, k => {
      const f = Math.min(1, k / 0.55); m.position.set(x, 4.5 * (1 - f * f) + 0.2, z); m.rotation.set(k * 9, k * 7, 0);
      if (f >= 1 && !m.userData.hit) { m.userData.hit = 1; SND.rock(rf(0.6, 1)); smoke(m.position.clone(), '#c9b48a', 1, 0.6); burst(m.position, '#b49a6a', { n: 10, up: 2, grav: 4, speed: 1.6, life: 0.5 }); shake(0.08, 0.2); }
    });
  }, i * 90);
}
function crystals(dm, color = '#bff4ff', n = 7) { // ice spikes bursting out around the target
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, r = rr(0.35, 0.6) * dm.userData.s, h = rr(0.5, 0.95) * dm.userData.s;
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85, emissive: color, emissiveIntensity: 0.5 }));
    m.position.set(dm.position.x + Math.cos(a) * r, 0.2, dm.position.z + Math.sin(a) * r); m.rotation.set(rr(-0.4, 0.4), a, rr(-0.4, 0.4));
    addFx(m, 1.1, k => { const g = easeOut(Math.min(1, k * 5)); m.scale.set(g, g * h / 0.16 * 0.6, g); m.material.opacity = k < 0.75 ? 0.85 : 0.85 * (1 - k) / 0.25; });
  }
}
function soundWaves(am, dm, color, n = 4) { // rings pulsing from the attacker toward the target (Growl, Bug Buzz, Dark Pulse)
  const p = at(am, 0.6), dir = faceDir(am, dm);
  return Promise.all([...Array(n)].map((_, i) => wait(i * 0.12).then(() => { const r = ring(p.clone().addScaledVector(dir, 0.4), color, 2.6, 0.6); r.lookAt(r.position.clone().add(dir)); })));
}
async function lift(dm, height = 0.5, dur = 0.9, color = '#ff7ab8') { // psychic grip: the target floats up, wobbles, is slammed down
  const y = dm.position.y, s = dm.userData.s; glow(at(dm), color, 2.2 * s, dur, 0.2);
  await tween(dur, t => { dm.position.y = y + Math.sin(Math.min(1, t * 1.4) * Math.PI * 0.5) * height * (t < 0.8 ? 1 : (1 - t) / 0.2); dm.rotation.z = Math.sin(t * 30) * 0.08; });
  dm.position.y = y; dm.rotation.z = 0;
}

// Each move's choreography: the attacker's motion and the effects, ending on the impact beat (the caller then flinches the
// target and moves the HP bar). Status moves end after their visual; the caller applies the stat change.
const MOVE_FX = {
  async TACKLE(am, dm) { const home = await windUp(am, dm); SND.whoosh(0.16, 0.8, 0.35); await dash(am, dm, home, 0.62, 0.12); impact(dm, '#fff2c0', 1.1); await dashBack(am, home); },
  async SCRATCH(am, dm) {
    const home = await windUp(am, dm, 0.2); await dash(am, dm, home, 0.55, 0.12); SND.scratch();
    const p = at(dm); [-0.7, -0.45, -0.2].forEach((a, i) => slash(p.clone().add(new V3(i * 0.08 - 0.08, 0, 0)), '#ffffff', a + 1.2, i * 0.05));
    impact(dm, '#ffe7d6', 0.9); await dashBack(am, home);
  },
  async QUICK_ATTACK(am, dm) {
    const home = am.position.clone(); glow(at(am, 0.4), '#ffffff', 1.2, 0.2); SND.whoosh(0.14, 2.2, 0.5);
    await dash(am, dm, home, 0.7, 0.09, true); impact(dm, '#ffffff', 1); ring(at(dm), '#ffffff', 1.2, 0.3, Math.PI / 2);
    await dashBack(am, home, 0.18);
  },
  async THUNDER_SHOCK(am, dm) {
    await charge(am, '#ffe94a', 0.45); SND.zap(0.3);
    const from = at(am, 0.6), to = at(dm);
    for (let i = 0; i < 3; i++) { bolt(to, from, i ? '#fffbd0' : '#fff16a', i ? 0.045 : 0.085); await wait(0.07); }
    SND.thunder(0.8); bolt(to); bolt(to.clone().add(new V3(0.25, 0, 0)));
    screenFlash('rgba(255,240,140,.9)', 0.35); glow(to, '#fff16a', 1.8, 0.4, 0.4);
    burst(to, '#fff16a', { n: 40, speed: 3.4, grav: 0, life: 0.5 }); impact(dm, '#fff16a', 1.2);
  },
  async EMBER(am, dm) {
    await charge(am, '#ff7a1a', 0.3); [0, 1, 2].forEach(i => SND.whoosh(0.35, 0.6, 0.3, i * 0.12));
    const from = at(am, 0.6), to = at(dm);
    await Promise.all([0, 1, 2].map(i => wait(i * 0.12).then(() => projectile(from, to.clone().add(new V3(rr(-0.2, 0.2), rr(-0.15, 0.2), 0)), { color: '#ff6a1a', core: '#ffe680', size: 0.62, arc: 0.45 + i * 0.1, trail: '#ff8a2a', trailN: 5 }).then(p => {
      SND.boom(0.35); burst(p, '#ff6a1a', { n: 22, up: 2.5, grav: 2.5, speed: 1.3, life: 0.8, size: 0.26 }); burst(p, '#ffd23f', { n: 12, up: 2, grav: 2, speed: 1, life: 0.6 }); lightFlash(p, '#ff7a1a', 5, 0.35);
    }))));
    SND.fire(0.6); for (let i = 0; i < 6; i++) smoke(at(dm, rr(0.2, 0.8)).add(new V3(rr(-0.3, 0.3), 0, rr(-0.3, 0.3))), '#ffb04a', 0.6, 0.7);
    impact(dm, '#ff8a2a', 1.1);
  },
  async VINE_WHIP(am, dm) {
    cast(am); const from = at(am, 0.45), to = at(dm, 0.5);
    SND.whip(0.22); vine(from, to, '#3fa83a', 0.7); vine(from, to.clone().add(new V3(0, 0.2, 0)), '#58c24a', -0.7);
    await wait(0.24);
    slash(to, '#9dff7a', 0.9); slash(to, '#9dff7a', -0.9, 0.12);
    burst(to, '#7ddc4c', { n: 26, speed: 2.4, size: 0.22, life: 0.7 }); impact(dm, '#7ddc4c', 1); await wait(0.15); impact(dm, '#7ddc4c', 0.7);
  },
  async ABSORB(am, dm) {
    cast(am); SND.drain(1.0); const src = at(dm), dst = at(am); glow(src, '#8dff6a', 1.5, 0.9, -0.5); impact(dm, '#8dff6a', 0.6);
    await Promise.all([...Array(7)].map((_, i) => wait(i * 0.07).then(() => projectile(src.clone().add(new V3(rr(-0.3, 0.3), rr(-0.2, 0.3), rr(-0.3, 0.3))), dst, { color: '#8dff6a', size: 0.22, dur: 0.5, arc: rr(0.2, 0.7), trail: '#c8ffb0', trailN: 1 }))));
    glow(dst, '#b6ff9a', 1.6, 0.5); burst(dst, '#d6ffc0', { n: 20, up: 2, grav: 1, speed: 1, life: 0.8 });
  },
  async GUST(am, dm) {
    SND.wind(1.1); await pose(am, 0.25, [{ t: 0.15, sy: 0.85, lean: -0.1 }, { t: 0.5, y: 0.35, sy: 1.12, lean: -0.2 }, { t: 0.85, y: 0.05, sy: 0.92, lean: 0.25 }, { t: 1, lean: 0.15 }]); pose(am, 0.4, SETTLE);
    const from = at(am, 0.5), to = at(dm, 0.4);
    for (let i = 0; i < 4; i++) projectile(from, to.clone().add(new V3(rr(-0.3, 0.3), rr(-0.2, 0.3), 0)), { color: '#e8f4ff', core: '#ffffff', size: 0.5, dur: 0.38, arc: 0.1, trail: '#ffffff', spin: 14 + i * 3 });
    await wait(0.36); wrap(dm, '#dff1ff', 0.9);
    burst(to, '#cfe9c0', { n: 30, speed: 3, grav: -0.5, life: 0.8, size: 0.18 }); impact(dm, '#e8f4ff', 1);
  },
  async POISON_STING(am, dm) {
    cast(am); const from = at(am, 0.5), to = at(dm);
    [0, 1, 2].forEach(i => SND.sting(i * 0.08));
    await Promise.all([0, 1, 2].map(i => wait(i * 0.08).then(() => projectile(from, to.clone().add(new V3(rr(-0.15, 0.15), rr(-0.1, 0.15), 0)), { color: '#c25ae6', core: '#f2d0ff', size: 0.24, dur: 0.22, arc: 0.05, trail: '#e09cff', trailN: 1 }).then(p => burst(p, '#c25ae6', { n: 10, speed: 2, life: 0.4 })))));
    impact(dm, '#c25ae6', 0.8);
  },
  async ACID(am, dm) {
    await charge(am, '#b04ae0', 0.25);
    const from = at(am, 0.55), to = at(dm, 0.5);
    await Promise.all([0, 1, 2].map(i => wait(i * 0.1).then(() => projectile(from, to.clone().add(new V3(rr(-0.3, 0.3), 0, rr(-0.2, 0.2))), { color: '#9a3ad6', core: '#e8a8ff', size: 0.38, dur: 0.5, arc: 1.1, trail: '#b75ae6' }).then(p => { SND.splat(0.6); burst(p, '#a640e0', { n: 18, up: 2, grav: 4, speed: 1.4, life: 0.7, size: 0.22 }); }))));
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.75, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#8a2ec8', transparent: true, opacity: 0.6, depthWrite: false }));
    pool.position.set(dm.position.x, 0.18, dm.position.z); addFx(pool, 1.2, k => { pool.scale.setScalar(0.5 + easeOut(Math.min(1, k * 3)) * 0.8); pool.material.opacity = 0.6 * (1 - k); });
    impact(dm, '#b04ae0', 1);
  },
  async GROWL(am, dm) {
    SND.growl(0.65);
    const p = at(am, 0.6), dir = faceDir(am, dm);
    pose(am, 0.5, [{ t: 0.15, lean: -0.15, sc: 1.08, sy: 1.06 }, { t: 0.3, lean: 0.12, sc: 1.08, roll: 0.12 }, { t: 0.45, lean: 0.12, sc: 1.08, roll: -0.12 }, // chest puffs, head shakes
      { t: 0.6, lean: 0.12, sc: 1.06, roll: 0.1 }, { t: 0.75, lean: 0.1, sc: 1.04, roll: -0.08 }, { t: 1 }]);
    for (let i = 0; i < 4; i++) {
      const r = ring(p.clone().addScaledVector(dir, 0.4), i % 2 ? '#bfe3ff' : '#ffffff', 2.6, 0.6, Math.PI / 2);
      r.lookAt(r.position.clone().add(dir)); await wait(0.12);
    }
    const x = dm.position.x; await tween(0.35, t => (dm.position.x = x + Math.sin(t * 60) * 0.05 * (1 - t))); dm.position.x = x;
  },
  async TAIL_WHIP(am, dm) {
    [0, 0.15, 0.3, 0.45].forEach(d => SND.whoosh(0.13, 1.6, 0.22, d));
    const inner = am.userData.inner, r0 = inner.rotation.y; wag(am, 0.6, 4); // hips swing the tail at the foe
    pose(am, 0.6, [{ t: 0.12, roll: 0.15, sy: 0.95 }, { t: 0.37, roll: -0.15, sy: 0.95 }, { t: 0.62, roll: 0.15, sy: 0.95 }, { t: 0.87, roll: -0.1 }, { t: 1 }]);
    await tween(0.6, t => (inner.rotation.y = r0 + Math.sin(t * Math.PI * 4) * 0.55 * Math.sin(t * Math.PI)));
    inner.rotation.y = r0; burst(at(am, 0.4), '#ffd0e6', { n: 14, up: 1.5, grav: 1, speed: 1, life: 0.7 });
  },
  async STRING_SHOT(am, dm) {
    cast(am); const from = at(am, 0.5), to = at(dm, 0.5);
    for (let i = 0; i < 5; i++) {
      const pts = [from, from.clone().lerp(to, 0.5).add(new V3(rr(-0.3, 0.3), rr(0.1, 0.5), rr(-0.3, 0.3))), to.clone().add(new V3(rr(-0.25, 0.25), rr(-0.2, 0.3), 0))];
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.012, 4), total = geo.index.count;
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#f4f4f4', transparent: true }));
      addFx(m, 1.0, k => { geo.setDrawRange(0, growTo(total, k * 4)); m.material.opacity = k < 0.7 ? 1 : (1 - k) / 0.3; });
      SND.thwip(); await wait(0.05);
    }
    await wait(0.15); wrap(dm, '#ffffff', 1.0);
  },
  async SAND_ATTACK(am, dm) {
    SND.sand(0.8);
    const from = am.position.clone().add(new V3(0, 0.15, 0)), to = at(dm, 0.6), d = faceDir(am, dm);
    pose(am, 0.5, [{ t: 0.3, z: -0.15, lean: 0.3, sy: 0.88 }, { t: 0.55, z: -0.12, lean: 0.2 }, ...SETTLE.map(k => ({ ...k, t: 0.55 + k.t * 0.45 }))]); // kicks sand back over its shoulder
    await stream(from.clone().addScaledVector(d, 0.3), to, ['#d8b77a', '#c49a5a', '#e6cf9a'], { dur: 0.45, size: 0.22, spread: 0.35, additive: false });
    await wait(0.2); for (let i = 0; i < 5; i++) smoke(to.clone().add(new V3(rr(-0.4, 0.4), rr(-0.3, 0.3), rr(-0.2, 0.2))), '#d8c08a', 0.9, 0.9);
  },
  async SMOKESCREEN(am, dm) {
    cast(am); SND.whoosh(0.4, 0.6, 0.3); const to = await projectile(at(am, 0.5), at(dm, 0.3), { color: '#5a5a5a', core: '#9a9a9a', size: 0.4, dur: 0.4, arc: 0.6, trail: null });
    SND.puff(1.4); for (let i = 0; i < 12; i++) smoke(to.clone().add(new V3(rr(-0.7, 0.7), rr(-0.1, 0.9), rr(-0.5, 0.5))), pick(['#3c3c44', '#55555e', '#6c6c74']), rr(1.1, 1.8), rr(1.2, 1.7));
    await wait(0.5);
  },
  async GROWTH(am) {
    const p = at(am, 0.5); SND.sparkle(1.0); SND.rustle(0.8);
    glow(p, '#9cff6a', 2.2, 0.9, 0.3); ring(new V3(am.position.x, 0.1, am.position.z), '#9cff6a', 2.2, 0.8);
    for (let i = 0; i < 4; i++) setTimeout(() => burst(at(am, 0.1), '#c8ff8a', { n: 12, up: 3, grav: -1.5, speed: 1, life: 1 }), i * 120);
    await pose(am, 0.7, [{ t: 0.15, sy: 0.88, lean: 0.1 }, { t: 0.5, sc: 1.16, sy: 1.08, lean: -0.15 }, { t: 0.8, sc: 0.98, sy: 0.97 }, { t: 1 }]); // gathers itself, then swells upward
  },
  // ---- showcase moves
  async FLAMETHROWER(am, dm) {
    await charge(am, '#ff6a1a', 0.4);
    SND.fire(1.1); await stream(at(am, 0.6), at(dm, 0.5), ['#ff4a0a', '#ff8a1a', '#ffd23f', '#ff6a1a'], { dur: 0.9, size: 0.38, smokeColor: '#8a7a78' });
    for (let i = 0; i < 3; i++) burst(at(dm, 0.2 + i * 0.25), '#ff8a1a', { n: 16, up: 3, grav: 3, speed: 1.2, life: 0.8, size: 0.3 });
    screenFlash('rgba(255,150,60,.7)', 0.3); impact(dm, '#ff7a1a', 1.4);
  },
  async THUNDERBOLT(am, dm) {
    await charge(am, '#ffe94a', 0.6); SND.zap(0.45);
    const from = at(am, 0.6), to = at(dm);
    for (let i = 0; i < 5; i++) { bolt(to.clone().add(new V3(rr(-0.3, 0.3), 0, rr(-0.3, 0.3))), undefined, '#fffbd0', 0.09); bolt(to, from, '#fff16a', 0.07); await wait(0.06); }
    SND.thunder(1.3); screenFlash('rgba(255,245,150,.95)', 0.45); glow(to, '#fff16a', 2.6, 0.5, 0.4);
    for (let i = 0; i < 6; i++) setTimeout(() => bolt(to.clone().add(new V3(rr(-0.5, 0.5), rr(-0.3, 0.3), 0)), to.clone().add(new V3(rr(-0.5, 0.5), rr(0.3, 0.8), 0)), '#ffffaa', 0.03), i * 60);
    impact(dm, '#fff16a', 1.6);
  },
  async WATER_GUN(am, dm) {
    cast(am); SND.water(0.75); await stream(at(am, 0.55), at(dm, 0.5), ['#3a8cff', '#7ec4ff', '#d8f0ff'], { dur: 0.7, size: 0.3, spread: 0.12 });
    SND.splash(0.8); ring(new V3(dm.position.x, 0.1, dm.position.z), '#7ec4ff', 2, 0.6);
    burst(at(dm, 0.4), '#bfe6ff', { n: 30, up: 2.5, grav: 6, speed: 2, life: 0.8, size: 0.2 }); impact(dm, '#5aa8ff', 1);
  },
  async HYDRO_PUMP(am, dm) {
    await charge(am, '#3a8cff', 0.5);
    SND.water(0.95, 1.8); await beam(at(am, 0.6), at(dm, 0.5), { color: '#2a7cff', core: '#e6f6ff', width: 0.3, dur: 0.9, swirl: '#bfe6ff', sparks: '#9ad4ff' });
    SND.splash(1.6); for (let i = 0; i < 3; i++) ring(new V3(dm.position.x, 0.1, dm.position.z), '#7ec4ff', 2.4 + i, 0.7);
    burst(at(dm, 0.4), '#d8f0ff', { n: 50, up: 3, grav: 7, speed: 2.6, life: 1, size: 0.24 }); impact(dm, '#5aa8ff', 1.6);
  },
  async ICE_BEAM(am, dm) {
    await charge(am, '#9ef0ff', 0.45);
    SND.beam(0.8, 440, 3500); SND.frost(0.8); await beam(at(am, 0.6), at(dm, 0.5), { color: '#7fe0ff', core: '#ffffff', width: 0.2, dur: 0.8, swirl: '#e6fcff', sparks: '#e6fcff' });
    SND.crystal(); crystals(dm); screenFlash('rgba(200,245,255,.8)', 0.4); impact(dm, '#9ef0ff', 1.3);
  },
  async SOLAR_BEAM(am, dm) {
    const p = at(am, 0.6); glow(p, '#fff7a0', 3, 1.0, -0.5); SND.sparkle(1.6);
    for (let i = 0; i < 5; i++) setTimeout(() => burst(p.clone().add(new V3(rr(-1.5, 1.5), rr(0.5, 2), rr(-1.5, 1.5))), '#f6ff9a', { n: 10, to: p, speed: 2, life: 0.7, size: 0.2 }), i * 150);
    await charge(am, '#e6ff7a', 0.9);
    screenFlash('rgba(255,255,200,.9)', 0.4);
    SND.beam(0.95, 165, 2600); await beam(p, at(dm, 0.5), { color: '#d6ff5a', core: '#ffffff', width: 0.38, dur: 0.95, swirl: '#ffffcc', sparks: '#f6ff9a' });
    SND.boom(0.9); impact(dm, '#e6ff7a', 1.8); shake(0.25, 0.4);
  },
  async RAZOR_LEAF(am, dm) {
    cast(am); const from = at(am, 0.6), to = at(dm);
    for (let i = 0; i < 6; i++) SND.leaf(i * 0.07);
    await Promise.all([...Array(6)].map((_, i) => wait(i * 0.07).then(() => projectile(from, to.clone().add(new V3(rr(-0.3, 0.3), rr(-0.2, 0.3), 0)), { color: '#5fd04a', core: '#c8ff9a', size: 0.3, dur: 0.35, arc: rr(-0.3, 0.6), trail: '#7ddc4c', trailN: 1, spin: 20 }).then(p => slash(p, '#b8ff8a', rr(-1.2, 1.2), 0, 0.6)))));
    impact(dm, '#7ddc4c', 1.1);
  },
  async ROCK_SLIDE(am, dm) {
    await pose(am, 0.3, [{ t: 0.2, sy: 0.85, lean: -0.1 }, { t: 0.5, y: 0.3, sy: 1.12, lean: -0.15 }, { t: 1, sy: 0.85, lean: 0.15 }]); pose(am, 0.4, SETTLE); // rears up and stamps
    SND.rumble(1.1, 0.5); rocks(dm, '#8a7a5a', 6); await wait(0.75); impact(dm, '#c9a46a', 1.3);
  },
  async EARTHQUAKE(am, dm) {
    await pose(am, 0.35, [{ t: 0.15, sy: 0.82, lean: 0.05 }, { t: 0.5, y: 0.6, sy: 1.18 }, { t: 1, sy: 0.75, lean: 0.1 }]); pose(am, 0.45, SETTLE); // leaps and slams down
    SND.rumble(1.6); shake(0.35, 1.0);
    for (let i = 0; i < 4; i++) { ring(new V3(am.position.x, 0.08, am.position.z), '#c9a46a', 5 + i * 2, 0.8); await wait(0.1); }
    const y = dm.position.y;
    tween(0.7, t => (dm.position.y = y + Math.abs(Math.sin(t * Math.PI * 4)) * 0.18 * (1 - t))).then(() => (dm.position.y = y));
    for (let i = 0; i < 10; i++) smoke(new V3(dm.position.x + rr(-0.9, 0.9), 0.2, dm.position.z + rr(-0.7, 0.7)), '#c9b48a', 1.3, 1);
    await wait(0.4); impact(dm, '#c9a46a', 1.4);
  },
  async PSYCHIC(am, dm) {
    cast(am); SND.psychic(1.3); glow(at(am, 0.7), '#ff7ab8', 1.6, 0.8, 0.2); screenFlash('rgba(255,120,190,.55)', 0.5);
    for (let i = 0; i < 3; i++) ring(at(dm), '#ff7ab8', 2.2, 0.8, Math.PI / 2 * (i % 2));
    await lift(dm, 0.6, 0.9); impact(dm, '#ff7ab8', 1.3);
  },
  async SHADOW_BALL(am, dm) {
    await charge(am, '#7a3ac8', 0.5);
    const from = at(am, 0.6), to = at(dm), orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), new THREE.MeshBasicMaterial({ color: '#2a0f40' }));
    addFx(orb, 0.6, k => { orb.position.lerpVectors(from, to, k); orb.position.y += Math.sin(k * Math.PI) * 0.3; orb.rotation.y += 0.3; }); // dark heart inside the glow
    SND.dark(0.6, 0.6); const p = await projectile(from, to, { color: '#9a4af0', core: '#d8b0ff', size: 1.0, dur: 0.6, arc: 0.3, trail: '#8a4ad8', trailN: 4 });
    SND.boom(0.5); for (let i = 0; i < 8; i++) smoke(p.clone().add(new V3(rr(-0.5, 0.5), rr(-0.3, 0.6), rr(-0.4, 0.4))), '#2a1a3a', 1.2, 0.9);
    impact(dm, '#9a5ae8', 1.4);
  },
  async DRAGON_BREATH(am, dm) {
    await charge(am, '#6f35fc', 0.35);
    SND.fire(0.9, 0.6); SND.growl(0.85, 0.7); await stream(at(am, 0.6), at(dm, 0.5), ['#5a6cff', '#8a5aff', '#4ad8ff', '#b080ff'], { dur: 0.85, size: 0.4 });
    impact(dm, '#7a5aff', 1.3);
  },
  async DARK_PULSE(am, dm) {
    cast(am); SND.dark(1.2); glow(at(am, 0.6), '#3a1a4a', 2, 0.6, 0.6);
    await soundWaves(am, dm, '#7a2aa8', 6); await wait(0.25);
    for (let i = 0; i < 6; i++) smoke(at(dm, rr(0.2, 0.8)).add(new V3(rr(-0.4, 0.4), 0, rr(-0.3, 0.3))), '#201028', 1.1, 0.8);
    impact(dm, '#8a3ac8', 1.3);
  },
  async FLASH_CANNON(am, dm) {
    await charge(am, '#e6eaff', 0.5);
    screenFlash('rgba(255,255,255,.9)', 0.35);
    SND.beam(0.75, 330, 5000); await beam(at(am, 0.6), at(dm, 0.5), { color: '#c8d0ff', core: '#ffffff', width: 0.3, dur: 0.75, sparks: '#ffffff' });
    SND.clang(); impact(dm, '#e6eaff', 1.5);
  },
  async MOONBLAST(am, dm) {
    cast(am); SND.sparkle(1.0); const sky = at(am, 1).add(new V3(0, 2.2, 0)); glow(sky, '#ffc8f0', 2.5, 0.8, 0.3); lightFlash(sky, '#ffb0e8', 6, 0.8);
    await wait(0.45);
    SND.whoosh(0.55, 1.4, 0.4); const p = await projectile(sky, at(dm), { color: '#ff8ae0', core: '#fff0fb', size: 0.9, dur: 0.55, arc: 0.6, trail: '#ffd0f4', trailN: 4 });
    for (let i = 0; i < 5; i++) burst(p, pick(['#ffb0e8', '#ffffff', '#ffe0f8']), { n: 12, speed: 2.5, grav: 0, life: 0.8, size: 0.2 });
    SND.chime(); SND.boom(0.4); screenFlash('rgba(255,180,230,.7)', 0.4); impact(dm, '#ff8ae0', 1.4);
  },
  async KARATE_CHOP(am, dm) {
    const home = await windUp(am, dm, 0.3, 0.18); SND.whoosh(0.15, 1.8, 0.55); await dash(am, dm, home, 0.65, 0.12);
    slash(at(dm, 0.7), '#ffffff', Math.PI / 2 - 0.2, 0, 1.6); impact(dm, '#ff7a3a', 1.4); shake(0.18, 0.3);
    await dashBack(am, home);
  },
  async AIR_SLASH(am, dm) {
    cast(am); const from = at(am, 0.6), to = at(dm);
    [0, 1, 2].forEach(i => SND.whoosh(0.3, 2.6, 0.5, i * 0.1));
    await Promise.all([0, 1, 2].map(i => wait(i * 0.1).then(() => projectile(from, to.clone().add(new V3(0, (i - 1) * 0.15, 0)), { color: '#bfe2ff', core: '#ffffff', size: 0.35, dur: 0.3, arc: 0.1, trail: '#e8f4ff', trailN: 1 }).then(p => slash(p, '#e8f4ff', -0.5 + i * 0.5, 0, 1.4)))));
    impact(dm, '#bfe2ff', 1.2);
  },
  async SLUDGE_BOMB(am, dm) {
    await charge(am, '#a640e0', 0.35);
    SND.whoosh(0.6, 0.5, 0.35); const p = await projectile(at(am, 0.6), at(dm, 0.5), { color: '#8a2ec8', core: '#e0a0ff', size: 0.75, dur: 0.6, arc: 1.3, trail: '#a640e0', trailN: 4 });
    SND.splat(1.5); SND.boom(0.4); burst(p, '#a640e0', { n: 40, up: 2.5, grav: 5, speed: 2, life: 0.9, size: 0.28 });
    for (let i = 0; i < 5; i++) smoke(p.clone().add(new V3(rr(-0.4, 0.4), rr(0, 0.5), rr(-0.3, 0.3))), '#6a2a8a', 1, 0.9);
    impact(dm, '#b04ae0', 1.4);
  },
  async BUG_BUZZ(am, dm) {
    cast(am); SND.buzz(1.3); await soundWaves(am, dm, '#b8e04a', 6);
    const x = dm.position.x; await tween(0.45, t => (dm.position.x = x + Math.sin(t * 80) * 0.06 * (1 - t))); dm.position.x = x;
    impact(dm, '#b8e04a', 1.2);
  },
  async HYPER_BEAM(am, dm) {
    await charge(am, '#ffb04a', 0.8); screenFlash('rgba(255,220,160,.9)', 0.4);
    SND.beam(1.0, 110, 1800); await beam(at(am, 0.6), at(dm, 0.5), { color: '#ff9a2a', core: '#ffffff', width: 0.45, dur: 1.0, swirl: '#fff0c0', sparks: '#ffd28a' });
    for (let i = 0; i < 3; i++) ring(at(dm), '#ffb04a', 3 + i, 0.6, Math.PI / 2);
    SND.boom(1.4); impact(dm, '#ffb04a', 2); shake(0.35, 0.6);
  },
};
function tickFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.t += dt;
    if (f.vel) {
      const a = f.obj.geometry.attributes.position;
      for (let k = 0; k < a.count; k++) {
        const v = f.vel[k];
        if (f.to) v.lerp(_v.set(f.to.x - a.getX(k), f.to.y - a.getY(k), f.to.z - a.getZ(k)).normalize().multiplyScalar(3), Math.min(1, dt * 5));
        else v.y += f.grav * dt;
        a.setXYZ(k, a.getX(k) + v.x * dt, a.getY(k) + v.y * dt, a.getZ(k) + v.z * dt);
      }
      a.needsUpdate = true; f.obj.material.opacity = 1 - f.t / f.life;
    }
    if (f.flicker) f.obj.visible = Math.sin(f.t * 60) > -0.4;
    if (f.upd) f.upd(Math.min(1, f.t / f.life));
    if (f.t >= f.life) {
      BT.scene.remove(f.obj);
      f.obj.traverse(o => { if (o.geometry && o.geometry !== GLOW_SPRITE_GEO) o.geometry.dispose(); o.material?.dispose(); });
      fx.splice(i, 1);
    }
  }
}
function instancesInto(s, name, mats) {
  for (const p of ASSETS[name]) {
    const im = new THREE.InstancedMesh(p.lod ?? p.geo, AMAT[p.mat] || AMAT.base, mats.length); // the arena's backdrop trees stand 14-24 m off: low detail when there is one
    mats.forEach((m, i) => im.setMatrixAt(i, m));
    im.receiveShadow = true; im.frustumCulled = false;
    s.add(im);
  }
}
function buildArena() {
  const s = new THREE.Scene();
  s.background = canvasTex(4, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5fb0ea'); gr.addColorStop(0.6, '#acdcf6'); gr.addColorStop(1, '#e8f7ff'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  s.fog = new THREE.Fog('#cbe8f5', 16, 44);
  s.add(new THREE.HemisphereLight('#e2f1ff', '#7f9a52', 1.45), new THREE.AmbientLight('#fff4e0', 0.35));
  const sunB = new THREE.DirectionalLight('#fff0d2', 3);
  sunB.position.set(-6, 10, 7); sunB.castShadow = true; sunB.shadow.mapSize.set(1024, 1024); sunB.shadow.bias = -0.0005; sunB.shadow.normalBias = 0.02;
  Object.assign(sunB.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 });
  s.add(sunB);
  const gt = detailTex.clone(); gt.needsUpdate = true; gt.repeat.set(28, 28);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(48, 64).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#7ab443', map: gt }));
  ground.receiveShadow = true; s.add(ground);
  const pt = detailTex.clone(); pt.needsUpdate = true; pt.repeat.set(3, 3);
  for (const [p, r] of [[B_ME, 1.55], [B_FOE, 1.45]]) {
    const dirt = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.16, r + 0.28, 0.1, 48), new THREE.MeshLambertMaterial({ color: '#c9a46a', map: pt }));
    dirt.position.set(p.x, 0.05, p.z); dirt.receiveShadow = true; s.add(dirt);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.05, 0.16, 48), new THREE.MeshLambertMaterial({ color: '#a6d46e', map: pt }));
    top.position.set(p.x, 0.08, p.z); top.receiveShadow = true; s.add(top);
  }
  const clear = (x, z) => Math.hypot(x - B_ME.x, z - B_ME.z) > 2.1 && Math.hypot(x - B_FOE.x, z - B_FOE.z) > 2 && !(z > 1.2 && x < 1.5);
  const mv = ims => ims.forEach(im => { scene.remove(im); s.add(im); });
  mv(scatter(TALL_GEO, 900, () => { const a = rnd() * 6.28, r = rr(4.2, 14), x = Math.cos(a) * r, z = Math.sin(a) * r - 1.5; return clear(x, z) ? [x, z] : null; },
    (o, x, z) => { o.position.set(x, 0, z); o.rotation.set(0, rnd() * 6.28, 0); const k = rr(0.9, 1.4); o.scale.set(1.25, k, 1.25); }, ['#3c8a2c', '#4a9c37', '#57ad41', '#62b546']));
  mv(scatter(SHORT_GEO, 2600, () => { const x = rr(-12, 12), z = rr(-14, 6); return clear(x, z) || rnd() < 0.3 ? [x, z] : null; },
    (o, x, z) => { o.position.set(x, 0, z); o.rotation.set(0, rnd() * 6.28, 0); const k = rr(0.25, 0.5); o.scale.set(1.1, k, 1.1); }, ['#6fb03f', '#5a9e34', '#86c04c', '#97c955']));
  if (ASSETS) {
    const rounds = [[], [], []], pines = [[], []], q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < 46; i++) {
      const a = rr(Math.PI * 0.85, Math.PI * 2.15), r = rr(14, 24), x = Math.cos(a) * r, z = Math.sin(a) * r - 4, sc = rr(1.1, 1.8);
      const m = new THREE.Matrix4().compose(new V3(x, 0, z), q.setFromEuler(e.set(0, rnd() * 6.28, 0)), new V3(sc, sc, sc));
      (rnd() < 0.5 ? rounds[Math.floor(rnd() * 3)] : pines[Math.floor(rnd() * 2)]).push(m);
    }
    rounds.forEach((l, i) => l.length && instancesInto(s, 'tree_round_' + i, l));
    pines.forEach((l, i) => l.length && instancesInto(s, 'tree_pine_' + i, l));
  }
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (1.05 + i * 0.13), h = new THREE.Mesh(SPH, new THREE.MeshLambertMaterial({ color: pick(['#5f9a42', '#6aa64a', '#578f3c']) }));
    h.position.set(Math.cos(a) * 34, -3, Math.sin(a) * 34 - 6); h.scale.set(rr(9, 14), rr(5, 8), rr(7, 10)); s.add(h);
  }
  BT.scene = s;
  BT.cam = new THREE.PerspectiveCamera(36, 1, 0.1, 120);
}
function resizeBattle() {
  const a = vw / vh, tanV = Math.tan(18 * Math.PI / 180) * Math.max(1, 1.6 / a);
  BT.cam.aspect = a; BT.cam.fov = Math.min(70, Math.atan(tanV) * 360 / Math.PI); BT.cam.updateProjectionMatrix();
}
function spawnModel(mon, pos, look, scale) {
  // pivot (place, facing, size, shadow) > pose (full-body move animation, see pose()) > inner (model and its battle idle)
  const pivot = new THREE.Group(), pose = new THREE.Group(), inner = SPECIES[mon.key].make();
  pose.rotation.order = 'YXZ'; pose.add(inner); pivot.add(pose); pivot.position.copy(pos);
  pivot.rotation.y = Math.atan2(look.x - pos.x, look.z - pos.z);
  pivot.userData = { s: scale * SPECIES[mon.key].scale, inner, pose, base: pos.clone(), ph: rf(0, 6.28), rate: rf(0.85, 1.15) }; // Math.random, not rnd(): idle must not shift battle rolls
  pivot.scale.setScalar(pivot.userData.s);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  blob.position.y = 0.01; pivot.add(blob);
  BT.scene.add(pivot);
  return pivot;
}
const dropModel = m => m && BT.scene.remove(m);
const modelOf = m => m === BT.foe ? BT.foeModel : BT.meModel;
const who = m => m === BT.foe ? (BT.opts.trainer ? 'The foe ' : BT.opts.foeTitle ?? 'Wild ') + nm(m) : nm(m); // foeTitle: a story Pokémon's own epithet

export { BT, B_CAM, B_FOE, B_LOOK, B_ME, MOVE_FX, SETTLE, SNAP_LUNGE, bolt, buildArena, burst, dotTex, dropModel, easeBack, easeIO,
  fx, glow, knock, modelOf, pose, resizeBattle, spawnModel, tickFx, tickTweens, tween, wait, who };
