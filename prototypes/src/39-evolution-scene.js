import './38-battle-moves.js'; // first: the modules run in file-number order (see main.js)
import * as THREE from 'three';
import { MOVES, catchRoll, freshStages } from '../battle-rules.js';
import { V3, rnd } from './01-helpers.js';
import { renderPass } from './06-renderer-scene-post.js';
import { P, bodyBounds } from './19-characters.js';
import { $, keys, ui } from './25-input.js';
import { setMoveTarget } from './26-key-bindings.js';
import { SPECIES } from './27-pokemon-data.js';
import { calcStats, loadSpeciesModel, nm, party, pcBox } from './28-evolution-data.js';
import { ITEMS } from './30-backpack.js';
import { makeBall } from './33-wild-pokemon-models.js';
import { BT, B_CAM, B_FOE, B_ME, buildArena, burst, dotTex, dropModel, easeBack, easeIO, glow, resizeBattle, spawnModel, tween,
  wait } from './34-battle-tweens-effects-arena.js';
import { bsay, bset } from './35-battle-hud-messages-menus.js';
import { SND } from './37-battle-sound-effects.js';
import { learnMove } from './38-battle-moves.js';
import { finishBattle } from './40-battle-flow.js';
import { vh, vw } from './41-loop.js';
import { bgm } from './42-background-music.js';

// ============================================================ evolution scene
// A dark stage far off in the battle arena (so burst() / glow() and the message box keep working) with its own camera.
const EVO = { stage: null, cam: null, cancel: false, canCancel: false };
function evoStage() {
  const g = new THREE.Group(); g.position.set(300, 0, 0);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(14, 32, 16), new THREE.MeshBasicMaterial({ color: '#05060b', side: THREE.BackSide, fog: false })));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.6, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: dotTex, color: '#3d6aa8', transparent: true, opacity: 0.7, depthWrite: false, fog: false }));
  disc.position.y = 0.01; g.add(disc);
  const key = new THREE.PointLight('#fff4e6', 8, 10, 1.5); key.position.set(1.2, 2.6, 2.6); g.add(key);
  BT.scene.add(g);
  return g;
}
function evoMats(model) { // private copies (templates share materials), so the model can turn white and back
  const list = [];
  model.traverse(o => {
    if (!o.material) return;
    const ms = [o.material].flat().map(x => { const c = x.clone(); Object.assign(c.userData, { col: c.color.clone(), vis: c.visible }); list.push(c); return c; });
    o.material = ms.length === 1 ? ms[0] : ms;
  });
  return list;
}
function whiten(mats, k) { // 0 = full colour, 1 = glowing white silhouette (the bloom pass adds the halo)
  for (const c of mats) {
    if (c.blending === THREE.AdditiveBlending) { c.visible = c.userData.vis && k < 0.05; continue; } // overlays (cheek glow) would show through
    c.color.copy(c.userData.col).multiplyScalar(1 - k);
    if (c.emissive) { c.emissive.setScalar(1); c.emissiveIntensity = 2.6 * k; }
  }
}
async function evolve(m, e, canCancel = true) { // canCancel false: stone evolutions can't be stopped with B
  const from = nm(m), oldKey = m.key, to = SPECIES[e.to];
  $('btrans').className = 'btrans fade'; await wait(0.45);
  EVO.stage ??= evoStage();
  EVO.cam ??= new THREE.PerspectiveCamera(34, 1, 0.1, 40);
  dropModel(BT.meModel); dropModel(BT.foeModel); BT.meModel = BT.foeModel = null;
  $('meBox').classList.add('hide'); $('foeBox').classList.add('hide');
  bgm.want = null; // the music fades out; the shimmer and the fanfare carry the scene
  const stage = EVO.stage, cam = EVO.cam, base = stage.position;
  const place = key => { const o = SPECIES[key].make(), s = 1.35 * SPECIES[key].scale; o.scale.setScalar(s); o.rotation.y = 0.3; stage.add(o); return [o, s, evoMats(o)]; };
  const aim = (...os) => { // frame the tallest of the models
    const h = Math.max(0.6, ...os.map(o => bodyBounds(o).max.y));
    cam.aspect = vw / vh; cam.fov = BT.cam.fov; cam.updateProjectionMatrix();
    cam.position.set(base.x + 0.25 * h, base.y + h * 0.62, base.z + h * 2.3 + 0.9); cam.lookAt(base.x, base.y + h * 0.48, base.z);
    return h;
  };
  const [a, sa, ma] = place(oldKey); aim(a);
  renderPass.camera = cam; $('btrans').className = 'btrans out';
  await bsay(`What? ${from} is evolving!`);
  EVO.cancel = false; EVO.canCancel = canCancel;
  SND.shimmer(5);
  await tween(1.2, t => whiten(ma, t));
  await loadSpeciesModel(e.to); // started at the level-up; falls back to the Pokédex image if the model won't load
  const [b, sb, mb] = place(e.to); whiten(mb, 1); b.visible = false;
  const h = aim(a, b), size = new Map([[a, sa], [b, sb]]);
  // the two silhouettes trade places with scale pulses, faster each time: the outgoing one shrinks, the other springs up
  let cur = a, other = b;
  const swap = async d => {
    const s0 = size.get(cur), s1 = size.get(other);
    await tween(d / 2, t => cur.scale.setScalar(s0 * (1 - 0.75 * easeIO(t))));
    cur.visible = false; other.visible = true; other.scale.setScalar(s1 * 0.25);
    await tween(d / 2, t => other.scale.setScalar(s1 * (0.25 + 0.75 * easeBack(t))));
    [cur, other] = [other, cur];
  };
  const D = i => 0.62 * 0.8 ** i;
  let i = 0;
  for (; i < 9 && !EVO.cancel; i++) await swap(D(i)); // 9 swaps end on the new form
  EVO.canCancel = false;
  const done = !EVO.cancel;
  if (!done) { // B: the swaps run backwards, slowing down, and settle on the old form
    for (let j = i - 1; j >= 0; j--) await swap(D(j));
    await tween(0.9, t => whiten(ma, 1 - t));
    await bsay(`Huh? ${from} stopped evolving!`);
  } else {
    const p = base.clone().add(new V3(0, h * 0.5, 0));
    glow(p, '#ffffff', h * 3, 0.9, 2.5); burst(p, '#ffffff', { n: 70, speed: 3.4, grav: 0, life: 0.9, size: 0.24 }); burst(p, '#bfe0ff', { n: 40, up: 1.5, grav: -1, speed: 1.6, life: 1.4 });
    SND.fanfare();
    await tween(1.1, t => whiten(mb, 1 - t)); // full colour; its idle clip is already running (XY_MIXERS)
    const f = m.hp / m.maxHp; m.key = e.to; calcStats(m); m.hp = m.hp > 0 ? Math.max(1, Math.round(f * m.maxHp)) : 0; m.disp = m.hp;
    await bsay(`Congratulations! Your ${from} evolved into ${to.name}!`);
    const fresh = new Set((to.learn || []).filter(([l, id]) => (l === 0 || l === m.level) && MOVES[id] && !m.moves.some(x => x.id === id)).map(x => x[1]));
    for (const id of fresh) await learnMove(m, id);
  }
  $('btrans').className = 'btrans fade'; await wait(0.45);
  stage.remove(a, b); ma.concat(mb).forEach(c => c.dispose());
  renderPass.camera = BT.cam;
  return done;
}
async function evolveNow(m, e) { // outside a battle (evolution stones): borrow the battle screen for the scene, then leave like a battle
  if (BT.active) return;
  Object.assign(BT, { active: true, opts: {}, zoom: 0, stop: 0 });
  ui.battle = true; keys.clear(); setMoveTarget(null); P.v = 0;
  $('btrans').className = 'btrans fade'; await wait(0.45);
  if (!BT.scene) buildArena();
  resizeBattle();
  renderPass.scene = BT.scene; renderPass.camera = BT.cam;
  document.body.classList.add('in-battle'); $('meBox').classList.add('hide'); $('foeBox').classList.add('hide'); bset('');
  await evolve(m, e, false);
  await finishBattle('evolved');
}
async function sendOut(m) {
  BT.me = m; m.st = freshStages(); m.disp = m.hp; m.expDisp = m.exp;
  delete m.yawn; if (m.tox) m.tox = 1; // switching out shakes off a Yawn and restarts the bad-poison count
  bset(`Go! ${nm(m)}!`);
  const ball = makeBall(); BT.scene.add(ball);
  const a = new V3(-3.6, 1.3, 4.4), b = B_ME.clone().add(new V3(0, 0.35, 0));
  await tween(0.55, t => { ball.position.lerpVectors(a, b, t); ball.position.y += Math.sin(t * Math.PI) * 1.3; ball.rotation.x = t * 12; });
  BT.scene.remove(ball);
  burst(b, '#ffffff', { n: 34, speed: 2.6, grav: 0, life: 0.5 });
  BT.meModel = spawnModel(m, B_ME, B_FOE, 1.35);
  const s = BT.meModel.userData.s;
  $('meBox').classList.remove('hide');
  await tween(0.35, t => BT.meModel.scale.setScalar(s * Math.max(0.01, easeBack(t))));
  await wait(0.25);
}
async function withdraw() {
  await bsay(`${nm(BT.me)}, come back!`);
  const m = BT.meModel, s = m.userData.s;
  burst(m.position.clone().add(new V3(0, 0.5, 0)), '#ff5a5a', { n: 26, grav: 0, speed: 1.6, life: 0.45 });
  await tween(0.3, t => m.scale.setScalar(s * (1 - t)));
  dropModel(m); BT.meModel = null; $('meBox').classList.add('hide');
}
// catch close-up: the camera slides most of the way from the battle view to the foe's platform
const B_CATCH_CAM = B_FOE.clone().lerp(B_CAM, 0.36).add(new V3(0, 0.1, 0)), B_CATCH_LOOK = B_FOE.clone().add(new V3(0, 0.45, 0)), _camLook = new V3();
const zoomCam = (to, dur) => { const from = BT.zoom; return tween(dur, t => (BT.zoom = from + (to - from) * easeIO(t))); };
async function throwBall(k = 'ball') {
  bset(`You threw a ${ITEMS[k].name}!`);
  const f = BT.foe, fm = BT.foeModel, s = fm.userData.s, ball = makeBall(); BT.scene.add(ball);
  zoomCam(1, 1.0); // runs alongside the throw
  const a = new V3(-3.4, 1.2, 4.6), top = B_FOE.clone().add(new V3(0, 1.3, 0)), ground = B_FOE.clone().add(new V3(0, 0.15, 0));
  await tween(0.7, t => { ball.position.lerpVectors(a, top, t); ball.position.y += Math.sin(t * Math.PI) * 1.6; ball.rotation.x = -t * 14; });
  burst(top, '#ff5a5a', { n: 30, grav: 0, speed: 1.6, life: 0.5 });
  await tween(0.3, t => fm.scale.setScalar(s * Math.max(0.001, 1 - t)));
  fm.visible = false;
  ball.rotation.set(0, Math.atan2(B_CAM.x - B_FOE.x, B_CAM.z - B_FOE.z), 0);
  await tween(0.4, t => { ball.position.lerpVectors(top, ground, t); ball.position.y += Math.abs(Math.sin(t * Math.PI * 2)) * (1 - t) * 0.4; });
  const { caught, shakes } = catchRoll(f, SPECIES[f.key].rate, ITEMS[k].catch, rnd);
  for (let k = 0; k < shakes; k++) { // each shake is a little hop with a wobble, squashing on landing
    await wait(0.35);
    await tween(0.5, t => {
      const hop = Math.sin(Math.min(1, t / 0.7) * Math.PI), squash = t > 0.7 ? Math.sin((t - 0.7) / 0.3 * Math.PI) * 0.18 : 0;
      ball.position.y = ground.y + hop * 0.32;
      ball.rotation.z = Math.sin(t * Math.PI * 2) * 0.45;
      ball.scale.set(1 + squash, 1 - squash, 1 + squash);
    });
  }
  ball.position.y = ground.y; ball.scale.setScalar(1);
  await wait(0.45);
  if (caught) {
    burst(ground.clone().add(new V3(0, 0.3, 0)), '#ffe066', { n: 30, up: 1.6, grav: -1, speed: 1.6, life: 1.1 });
    await bsay(`Gotcha! ${nm(f)} was caught!`);
    BT.scene.remove(ball); dropModel(fm); BT.foeModel = null;
    await zoomCam(0, 0.6);
    if (party.length < 6) { party.push(f); await bsay(`${nm(f)} joined your party!`); }
    else { pcBox.push(f); await bsay(`${nm(f)} was sent to the PC.`); }
    return true;
  }
  BT.scene.remove(ball);
  burst(ground.clone().add(new V3(0, 0.3, 0)), '#ffffff', { n: 30, speed: 2, grav: 0, life: 0.45 });
  fm.visible = true;
  await tween(0.3, t => fm.scale.setScalar(s * Math.max(0.001, t)));
  await zoomCam(0, 0.6);
  await bsay(['Oh no! The Pokémon broke free!', 'Aww! It appeared to be caught!', 'Argh! Almost had it!'][shakes]);
  return false;
}

export { B_CATCH_CAM, B_CATCH_LOOK, EVO, _camLook, evolve, evolveNow, sendOut, throwBall, withdraw };
