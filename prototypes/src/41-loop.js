import './40-battle-flow.js'; // first: the modules run in file-number order (see main.js)
import * as THREE from 'three';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { V3, approach, clamp, rnd, rr, squash, wrapAngle } from './01-helpers.js';
import { BU, CAM_DIST, CAM_FOV, REF_ASPECT, START, VS, viewFog } from './02-hero-camera.js';
import { inKalos, inRect } from './03-fleurville-map.js';
import { CLEAR, GALLERY, VERDANT_WALK, inTallGrass, inTest, terrainH, walkH } from './05-paths-raised-plaza-stairs-tall-grass.js';
import { DPR, FOG, HAZE, SKY, SUN_DIR, bloom, camera, composer, renderer, scene, sun, uPlayer, uTime } from './06-renderer-scene-post.js';
import { lodTick } from './08-blender-assets.js';
import { cellTick } from './10-streaming.js';
import { circles } from './12-batched-props.js';
import { KAL, roomAt } from './16-fleurville-world.js';
import { CH, P, PK, XY_MIXERS, animWalk, bend, bodyBounds, bulba, charm, girl, interactables, npcs, pika, player, swing } from './19-characters.js';
import { butterflies, markTick, pollen, questMarks, splashes, streamTick } from './21-side-quests.js';
import { tryMove } from './22-collision.js';
import { kalosTick, portalTick } from './24-fleurville-hud-travel.js';
import { $, keys, ui } from './25-input.js';
import { GP, VIEW, moveTarget, nearest, setMoveTarget, setNearest, setTyped, typed, zoom } from './26-key-bindings.js';
import { freshGame, rollWild } from './28-evolution-data.js';
import { loadDexModel } from './32-pokedex.js';
import { BT, resizeBattle } from './34-battle-tweens-effects-arena.js';
import { rf } from './37-battle-sound-effects.js';
import { startBattle } from './40-battle-flow.js';
import { locMusic, music } from './42-background-music.js';
import { SET, TEXT_SPEED } from './43-settings.js';
import { OB, OB_FACE, obFront, obShot, obSpot } from './45-onboarding.js';

// ============================================================ loop
const clock = new THREE.Clock();
const camPos = new V3(), camLook = new V3();
let grassDist = 0, firstFrame = true, vw = 0, vh = 0;
function faceTowards(obj, target, dt, k = 10) {
  let d = target - obj.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
  obj.rotation.y += d * (1 - Math.exp(-dt * k));
}
// A Pokémon trailing its trainer: catches up smoothly, moves with a gait that fits its body (four-legged ones trot,
// two-legged ones waddle, flyers hover), leans into turns and plays a short idle when it stops. Models with their own idle
// clip keep it playing through the mixer; bone-level tail and ear motion is only added when a model has no clip.
const STRIDE = { bound: 0.45, waddle: 0.22, hover: 0.6 }; // metres per step (one footfall, or one footfall pair in a trot)
const TOP_SPEED = { bound: 6.5, waddle: 2.4, hover: 5 };
function follow(o, F, tx, tz, idleFace, dt, t) {
  const u = o.userData, gait = u.gait || (u.flies ? 'hover' : 'waddle');
  const dx = tx - F.pos.x, dz = tz - F.pos.z, gap = Math.hypot(dx, dz);
  F.v = approach(F.v, gap > 0.15 ? Math.min(TOP_SPEED[gait], gap * 3) : 0, (gap > 0.15 ? 12 : 9) * dt);
  const L = gait !== 'hover' && u.chains?.legs, hip = L ? L.len * o.scale.y : 1;
  const stepLen = L ? Math.max(Math.min(STRIDE[gait], 1.2 * hip), F.v / 10) : STRIDE[gait]; // short legs take quicker steps, up to 10 a second
  let turnRate = 0;
  if (F.v > 0.02 && gap > 0.02) {
    const turn = wrapAngle(Math.atan2(dx, dz) - F.face), step = clamp(turn, -8 * dt, 8 * dt);
    F.face = wrapAngle(F.face + step); turnRate = dt ? step / dt : 0;
    const s = Math.min(gap, F.v * dt * Math.max(0.3, Math.cos(turn)));
    F.pos.x += Math.sin(F.face) * s; F.pos.z += Math.cos(F.face) * s;
    F.ph += s / stepLen; // the gait advances with distance covered, so the feet keep pace with the ground
  } else F.face = wrapAngle(F.face + clamp(wrapAngle(idleFace - F.face), -3 * dt, 3 * dt));
  const blend = 1 - Math.exp(-dt * 8), a = F.amt = THREE.MathUtils.lerp(F.amt, clamp(F.v / 1.5, 0, 1), blend);
  F.roll = THREE.MathUtils.lerp(F.roll, clamp(-turnRate * F.v * 0.02, -0.12, 0.12), blend); // lean into the turn
  F.look = THREE.MathUtils.lerp(F.look, gap > 0.3 ? clamp(wrapAngle(Math.atan2(dx, dz) - F.face), -0.5, 0.5) * 0.6 : 0, blend);
  let y = 0, sy = 1, lean = 0, roll = F.roll, yaw = 0;
  if (gait === 'bound') { // four-legged trot: a small bob per footfall pair, nose slightly down with speed, feet stay near the ground
    const s = Math.sin(F.ph * Math.PI), lift = Math.abs(s);
    y = lift * 0.03 * a; sy = 1 - 0.02 * a * (1 - lift); lean = a * (0.08 + s * 0.02);
  } else if (gait === 'waddle') { // weight shifts onto each foot in turn: lowest as a foot lands
    const s = Math.sin(F.ph * Math.PI), lift = Math.abs(s);
    y = lift * 0.025 * a; sy = 1 - 0.03 * a * (1 - lift) ** 4; lean = 0.05 * a; roll += s * 0.05 * a; yaw = s * 0.03 * a;
  } else { // hover with a wing beat, pitching forward with speed
    y = 0.35 + Math.sin(t * 3) * 0.05; lean = 0.25 * a;
    if (u.wings) u.wings.forEach((w, i) => swing(w, (i ? -1 : 1) * (0.2 + Math.sin(t * 16) * 0.6)));
  }
  if (L) { // legs step in time with the ground: spread fully as a foot lands, the swinging leg's knee lifts mid-stride
    const c = Math.cos(F.ph * Math.PI), sn = Math.sin(F.ph * Math.PI), sw = Math.asin(Math.min(0.75, stepLen / 2 / hip)) * a, knee = 1.1 * a;
    const leg = (j, k, d) => { bend(j[k], d * sw * c); bend(j[k + 1], knee * Math.max(0, d * sn)); };
    leg(L.j, 0, 1); leg(L.j, 2, -1);
    if (L.front) { leg(L.front, 0, -1); leg(L.front, 2, 1); } // a trot: each front leg moves with the opposite hind one
  }
  // idle once it has settled: a glance around, a tail flick or an ear twitch, picked with Math.random (never the battle rnd())
  const tail = u.tail || u.chains?.tail, hasTail = tail && (tail.userData.chain || tail.children.length), ears = u.chains?.ears;
  if (a < 0.1) {
    if (!F.act && (F.idleT -= dt) <= 0) {
      const acts = ['glance', hasTail && 'tail', ears && 'ears'].filter(Boolean);
      F.act = acts[Math.floor(Math.random() * acts.length)]; F.actT = 0; F.dir = Math.random() < 0.5 ? -1 : 1;
    }
  } else if (F.act) F.act = null;
  let flick = 0;
  if (F.act) {
    const p = (F.actT += dt) / (F.act === 'glance' ? 1.6 : 0.7);
    if (p >= 1) { F.act = null; F.idleT = rf(1.5, 4); }
    else if (F.act === 'glance') yaw += F.dir * 0.6 * Math.sin(p * Math.PI) ** 2;
    else if (F.act === 'tail') flick = Math.sin(F.actT * 26) * 0.5 * (1 - p);
    else swing(ears, Math.sin(F.actT * 40) * 0.3 * (1 - p));
  }
  if (hasTail) swing(tail, Math.sin(t * 6) * 0.15 + flick);
  o.position.set(F.pos.x, walkH(F.pos.x, F.pos.z) + y, F.pos.z);
  o.rotation.set(lean, F.face + F.look + yaw, roll);
  squash(o, sy, u.base);
}
function resize() {
  vw = innerWidth; vh = innerHeight;
  renderer.setSize(vw, vh); composer.setPixelRatio(DPR); composer.setSize(vw, vh);
  bloom.resolution.set(vw / 2, vh / 2);
  camera.aspect = vw / vh;
  // keep the reference framing's horizontal coverage on narrow windows
  const tanV = Math.tan(CAM_FOV / 2 * Math.PI / 180) * Math.max(1, REF_ASPECT / camera.aspect);
  camera.fov = Math.min(68, Math.atan(tanV) * 360 / Math.PI);
  camera.updateProjectionMatrix();
  if (BT.cam) resizeBattle();
}

function update(dt, t) {
  uTime.value = t;
  let ix = 0, iz = 0;
  const busy = ui.dialog || ui.battle || ui.pokedex || ui.onboard;
  if (!busy) {
    if (keys.has('KeyW') || keys.has('ArrowUp')) iz -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) iz += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
    ix += GP.x; iz += GP.z; // the gamepad stick (zero when no pad)
    if (ix || iz) { setMoveTarget(null); const c = Math.cos(VIEW.yaw), s = Math.sin(VIEW.yaw); [ix, iz] = [ix * c + iz * s, iz * c - ix * s]; } // W walks away from the camera, whichever way it faces
    else if (moveTarget) {
      const dx = moveTarget.x - P.pos.x, dz = moveTarget.z - P.pos.z, l = Math.hypot(dx, dz);
      moveTarget.t += dt;
      if (l < 0.15 || moveTarget.t > 12) setMoveTarget(null); else { ix = dx / l; iz = dz / l; }
    }
  }
  const run = (keys.has('ShiftLeft') || keys.has('ShiftRight') || GP.run) !== SET.alwaysRun; // with Always run on, Shift walks
  const il = Math.hypot(ix, iz);
  // Speed ramps up and down, and the heading turns at a limited rate: a sharp turn brakes, pivots, then sets off again.
  let goal = 0, speed = 0;
  if (il > 0) {
    const turn = wrapAngle(Math.atan2(ix, iz) - P.face);
    P.face = wrapAngle(P.face + clamp(turn, -9 * dt, 9 * dt));
    goal = (run ? 4.6 : 2.6) * (0.35 + 0.65 * Math.max(0, Math.cos(turn)));
    if (moveTarget) goal = Math.min(goal, Math.sqrt(24 * Math.hypot(moveTarget.x - P.pos.x, moveTarget.z - P.pos.z))); // brake to arrive
  }
  P.v = approach(P.v, goal, (goal > P.v ? 10 : 12) * dt);
  if (P.v > 0) {
    const sp = P.v * dt, bx = P.pos.x, bz = P.pos.z;
    if (tryMove(P.pos, Math.sin(P.face) * sp, Math.cos(P.face) * sp)) speed = dt && Math.hypot(P.pos.x - bx, P.pos.z - bz) / dt; // dt is 0 on bunched frames in a throttled tab; 0/0 left P.speed NaN for good
    else { P.v = 0; setMoveTarget(null); }
    if (inTallGrass(P.pos.x, P.pos.z) && speed > 0) {
      grassDist += speed * dt;
      if (grassDist > 2.5 && rnd() < dt * 0.8) { grassDist = 0; startBattle(rollWild(), 2 + Math.floor(rnd() * 3)); } // Lv2-4: below a fresh Lv5 starter (a Lv5 Pidgey beat Bulbasaur 73% of the time)
    }
  }
  P.speed = speed; // the real ground speed, already ramped, so the stride matches it exactly
  P.pos.y = walkH(P.pos.x, P.pos.z);
  player.root.position.lerp(P.pos, 1 - Math.exp(-dt * 30));
  faceTowards(player.root, P.face, dt, 14);
  animWalk(player, dt, P.speed);
  uPlayer.value.copy(P.pos);

  // the party lead trails behind and to the side
  if (OB.stage === 'starter') { const f = obFront(); follow(pika, PK, f.x, f.z, OB_FACE, dt, t); } // picking a partner: it steps out in front of the trainer, facing the camera
  else follow(pika, PK, P.pos.x - Math.sin(P.face) * 0.85 - Math.cos(P.face) * 0.3, P.pos.z - Math.cos(P.face) * 0.85 + Math.sin(P.face) * 0.3, P.face, dt, t);
  pika.visible = !(ui.onboard && freshGame && OB.stage !== 'starter'); // a new trainer has no partner until the Professor hands one over
  pika.userData.flame?.scale.set(1 + Math.sin(t * 23) * 0.12, 1 + Math.sin(t * 17) * 0.2, 1);

  setNearest(null); let best = 1e9;
  for (const n of npcs) {
    const d = Math.hypot(P.pos.x - n.x, P.pos.z - n.z);
    let sp = 0;
    if (n.patrol) { // eases into the walk and brakes before each waypoint
      let want = 0;
      if (!(ui.dialog && ui.dialog.npc === n) && d > 2) {
        if (n.wait > 0) n.wait -= dt;
        else {
          const [tx, tz] = n.patrol[n.leg], dx = tx - n.x, dz = tz - n.z, l = Math.hypot(dx, dz);
          if (l < 0.05) { n.leg = 1 - n.leg; n.wait = rr(1.5, 3.5); }
          else { want = Math.min(1.1, Math.sqrt(4 * l)); n.face = Math.atan2(dx, dz); n.dx = dx / l; n.dz = dz / l; }
        }
      }
      n.v = approach(n.v || 0, want, 2 * dt);
      if (n.v > 0) { n.x += n.dx * n.v * dt; n.z += n.dz * n.v * dt; sp = n.v; }
    }
    if (d < 2.4 && !sp && !n.sit) faceTowards(n.h.root, Math.atan2(P.pos.x - n.x, P.pos.z - n.z), dt, 6);
    else faceTowards(n.h.root, n.patrol ? n.face : n.baseFace, dt, 4);
    n.h.root.position.set(n.x, walkH(n.x, n.z), n.z);
    if (!n.sit) animWalk(n.h, dt, sp);
    n.h.head.rotation.z = Math.sin(t * 1.3 + n.x) * 0.04;
  }
  { // charmander scampers ahead of the hiker
    const ry = girl.h.root.rotation.y;
    follow(charm, CH, girl.x + Math.sin(ry) * 0.9 + Math.cos(ry) * 0.35, girl.z + Math.cos(ry) * 0.9 - Math.sin(ry) * 0.35, ry, dt, t);
    charm.userData.flame.scale.set(1 + Math.sin(t * 23) * 0.12, 1 + Math.sin(t * 17) * 0.2, 1);
  }
  bulba.position.y = terrainH(BU[0], BU[1]) + Math.abs(Math.sin(t * 2)) * 0.03;
  markTick(t);
  faceTowards(bulba, Math.hypot(P.pos.x - BU[0], P.pos.z - BU[1]) < 4 ? Math.atan2(P.pos.x - BU[0], P.pos.z - BU[1]) : 0.5 + Math.sin(t * 0.5) * 0.5, dt, 3);

  kalosTick(dt, t); portalTick(); streamTick(dt, t); lodTick();
  for (const b of butterflies) {
    const a = t * b.sp + b.ph;
    b.b.position.set(b.cx + Math.sin(a) * 1.3 + Math.sin(a * 2.3) * 0.35, terrainH(b.cx, b.cz) + 0.8 + Math.sin(a * 3.1) * 0.25, b.cz + Math.cos(a * 0.8) * 1.3);
    b.b.rotation.y = -a;
    b.b.children.forEach((w, i) => (w.rotation.z = (i ? 1 : -1) * (0.3 + Math.abs(Math.sin(t * 16 + b.ph)) * 1.1)));
  }
  { // pollen drifts around the camera focus
    const p = pollen.geometry.attributes.position, cx = camLook.x, cz = camLook.z;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i) + Math.sin(t * 0.3 + i) * 0.004 + 0.003, y = p.getY(i) + Math.sin(t * 0.7 + i * 1.7) * 0.002, z = p.getZ(i) + Math.cos(t * 0.25 + i) * 0.003;
      if (x - cx > 12) x -= 24; if (x - cx < -12) x += 24; if (z - cz > 7) z -= 16; if (z - cz < -9) z += 16;
      p.setXYZ(i, x, y, z);
    }
    p.needsUpdate = true;
  }
  for (const s of splashes) {
    const p = s.g.attributes.position;
    s.seeds.forEach(([a, b, c], i) => {
      const ph = (t * (0.9 + c) + a) % 1;
      p.setXYZ(i, s.x + (b - 0.5) * s.hw * 1.8 + Math.sin(a * 40) * ph * 0.3, s.y + Math.sin(ph * Math.PI) * (0.25 + c * 0.35), s.z + (c - 0.5) * 0.5 + ph * 0.35);
    });
    p.needsUpdate = true;
  }

  let marks = null; // a quest target wins over a bystander within 0.8 m of it (Bonnie stands right beside Clemont)
  const marked = it => (marks ??= questMarks()).some(m => Math.abs(m[0] - it.x) < 0.05 && Math.abs(m[1] - it.z) < 0.05);
  if (!busy) for (const it of interactables) {
    const d = Math.hypot(P.pos.x - it.x, P.pos.z - it.z);
    if (d >= it.r) continue;
    const s = d - (marked(it) ? 0.8 : 0);
    if (s < best) { best = s; setNearest(it); }
  }
  const pr = $('prompt');
  if (nearest && !busy) {
    const v = new V3(nearest.x, walkH(nearest.x, nearest.z) + nearest.top, nearest.z).project(camera);
    pr.style.display = 'block';
    pr.style.left = (v.x * 0.5 + 0.5) * vw + 'px';
    pr.style.top = (-v.y * 0.5 + 0.5) * vh + 'px';
  } else pr.style.display = 'none';

  if (ui.dialog) {
    const full = ui.dialog.lines[ui.dialog.i];
    if (typed < full.length) { setTyped(Math.min(full.length, typed + dt * 45 * TEXT_SPEED[SET.text])); $('dtext').textContent = full.slice(0, Math.floor(typed)); }
  }

  // camera: the hero framing follows the player with the same screen offset, orbited by VIEW.yaw / VIEW.pitch, or the trainer's
  // own eyes in first person (onboarding directs its own shots)
  const cy = Math.cos(VIEW.yaw), sy = Math.sin(VIEW.yaw), fpv = VIEW.fpv && !ui.onboard, look = new V3(), want = new V3();
  if (fpv) {
    (player.head.bone || player.head).getWorldPosition(want).y += 0.12; // sculpted trainers wrap their head bone (humanJoint)
    const c = Math.cos(VIEW.look);
    look.set(want.x - sy * c, want.y + Math.sin(VIEW.look), want.z - cy * c);
  } else {
    look.set(P.pos.x - START[0] * cy - START[1] * sy, P.pos.y * 0.6, P.pos.z + START[0] * sy - START[1] * cy);
    const d = CAM_DIST * zoom, c = Math.cos(VIEW.pitch);
    want.set(look.x + sy * c * d, look.y + Math.sin(VIEW.pitch) * d, look.z + cy * c * d);
  }
  player.root.visible = !fpv;
  if (!KAL.dark) { scene.background = fpv ? SKY : FOG; scene.fog.color.copy(fpv ? HAZE : FOG); } // rooms keep their own dark backdrop; outdoors the backdrop is the fog, so whatever lies past the far plane (or isn't loaded) melts into it
  if (ui.onboard) obShot(want, look, t);
  const k = firstFrame || fpv ? 1 : 1 - Math.exp(-dt * (ui.onboard || OB.swoop > 0 ? 1.3 : 4)); // slow glides between shots and into play; first person never lags the head
  OB.swoop -= dt;
  const snap = firstFrame; // a camera snap (start-up, teleport, loaded save) builds every wanted cell this frame
  camPos.lerp(want, k); camLook.lerp(look, k); firstFrame = false;
  camera.position.copy(camPos); camera.lookAt(camLook);
  [scene.fog.near, scene.fog.far] = viewFog(CAM_DIST * zoom, fpv);
  if (camera.far !== scene.fog.far + 1) { camera.far = scene.fog.far + 1; camera.updateProjectionMatrix(); } // nothing past solid fog is drawn
  cellTick(snap);
  if (ui.onboard) obSpot();

  sun.target.position.set(Math.round(camLook.x), 0, Math.round(camLook.z));
  sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 30);

  const loc = roomAt(P.pos.x, P.pos.z)?.name ?? (inTest(P.pos.x) ? 'Test Grounds' : inKalos(P.pos.x) ? 'Fleurville Town' : Math.hypot(P.pos.x - CLEAR.x, P.pos.z - CLEAR.z) < CLEAR.r + 1 ? 'Woodland Clearing' : P.pos.x > VS(8.5) || !inRect(P.pos.x, P.pos.z, VERDANT_WALK) ? 'Meadow Route' : 'Verdant Town');
  if ($('locName').textContent !== loc) $('locName').textContent = loc;
  if (!BT.active) music(ui.onboard ? 'gallery' : locMusic(loc)); // the title theme plays through onboarding
}

// Character Gallery: floor now, models streamed in the first time the player comes near (they are ~115 files)
{
  const w = GALLERY.x1 - GALLERY.x0, d = GALLERY.z1 - GALLERY.z0;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), new THREE.MeshStandardMaterial({ color: '#d8cbb0', roughness: 0.95 }));
  floor.position.set(GALLERY.x0 + w / 2, GALLERY.h - 0.04, GALLERY.z0 + d / 2); floor.receiveShadow = true; scene.add(floor);
}
function galleryLabel(text) {
  const c = document.createElement('canvas'), x = c.getContext('2d'); c.width = 256; c.height = 48;
  x.fillStyle = 'rgba(20,30,40,.72)'; x.beginPath(); x.roundRect(2, 4, 252, 40, 14); x.fill();
  x.fillStyle = '#fff'; x.font = 'bold 22px Nunito, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 25, 240);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false })); s.scale.set(1.3, 0.24, 1); return s;
}
const GAL = { started: false, failed: [] };
async function loadGalleryObj(path) { // Battle Revolution rips whose .dae skeleton three.js cannot build also ship an .obj + .mtl
  const url = 'models/' + path.replace(/\.dae$/i, ''), dir = url.slice(0, url.lastIndexOf('/') + 1), file = url.slice(dir.length);
  const mtl = await new MTLLoader().setPath(dir).loadAsync(encodeURIComponent(file) + '.mtl').catch(() => null);
  mtl?.preload();
  const obj = await new OBJLoader().setMaterials(mtl).setPath(dir).loadAsync(encodeURIComponent(file) + '.obj');
  obj.traverse(o => { if (o.isMesh) for (const m of [o.material].flat()) { if (m.map) m.map.colorSpace = THREE.SRGBColorSpace; m.side = THREE.DoubleSide; } });
  const holder = new THREE.Group(); holder.add(obj); holder.userData = {}; return holder;
}
async function loadGallery() {
  GAL.started = true;
  const list = await fetch('models/chars-index.json').then(r => (r.ok ? r.json() : []), () => []);
  const COLS = 13, SX = (GALLERY.x1 - GALLERY.x0 - 2) / (COLS - 1), SZ = 1.3, H = 1.45;
  for (let i = 0; i < list.length; i++) {
    const [name, src, path] = list[i], x = GALLERY.x0 + 1 + (i % COLS) * SX, z = GALLERY.z0 + 1 + Math.floor(i / COLS) * SZ;
    const label = galleryLabel(`${name} · ${src.toUpperCase()}`); label.position.set(x, GALLERY.h + H + 0.25, z); scene.add(label);
    try {
      const holder = await loadDexModel({ models: [[name, path]] }, 0, new AbortController().signal).catch(() => loadGalleryObj(path));
      const b = bodyBounds(holder), k = H / Math.max(0.01, b.max.y - b.min.y), m = new THREE.Group();
      holder.position.y = -b.min.y; m.add(holder); m.scale.setScalar(k); m.position.set(x, GALLERY.h, z);
      holder.traverse(o => { if (o.isMesh) o.castShadow = true; });
      scene.add(m); circles.push({ x, z, r: 0.28 });
      if (holder.userData.mixer) XY_MIXERS.add(holder.userData.mixer);
    } catch (e) { label.material.color.set('#ff8a8a'); GAL.failed.push(name); console.warn('Gallery model failed:', name, e); }
  }
}

// other modules assign these through their setters (an imported binding is read-only)
function setFirstFrame(v) { return (firstFrame = v); }
function setGrassDist(v) { return (grassDist = v); }
function setVw(v) { return (vw = v); }
export { GAL, camLook, clock, firstFrame, grassDist, loadGallery, resize, setFirstFrame, setGrassDist, setVw, update, vh, vw };
