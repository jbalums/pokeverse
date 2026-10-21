import './44-game-menu.js'; // first: the modules run in file-number order (see main.js)
import * as THREE from 'three';
import { V3 } from './01-helpers.js';
import { START } from './02-hero-camera.js';
import { walkH } from './05-paths-raised-plaza-stairs-tall-grass.js';
import { camera, scene } from './06-renderer-scene-post.js';
import { canvasTex } from './07-materials-textures.js';
import { P, pika, player, setTrainer, setTrainerProfile, trainer } from './19-characters.js';
import { PROF } from './20-story-chapter-1.js';
import { $, keys, ui } from './25-input.js';
import { act, say, setMoveTarget } from './26-key-bindings.js';
import { bag, freshGame, makeMon, nm, party, setFreshGame } from './28-evolution-data.js';
import { cleanNick, renderParty, saveGame } from './29-save.js';
import { easeIO, tween } from './34-battle-tweens-effects-arena.js';
import { SND } from './37-battle-sound-effects.js';
import { setFirstFrame, vh, vw } from './41-loop.js';
import { SET } from './43-settings.js';
import { frame } from './44-game-menu.js';

// ============================================================ Onboarding: a new game (or a save from before onboarding) picks a trainer and a nickname
// Stages: title (card over a high orbit of the town) > intro (the Professor talks, lower orbit) > look > name > confirm (close-up of
// the trainer, who swaps live) > outro (the Professor again), then the camera glides down into the normal framing.
const OB = { stage: null, swoop: 0 };
const OB_FACE = 0.55; // close-up camera heading from the trainer: south-east, down the dirt path and clear of the tall grass
const OB_INTRO = ['Hello there! Welcome to the world of Pokémon!', 'My name is Sycamore. People call me the Pokémon Professor.',
  'This is Verdant Town: wide fields, a winding river, and Pokémon hiding in every patch of tall grass.',
  'Some people keep Pokémon as pets. Others battle with them. Me? I study them.', 'But enough about me. Let’s talk about you!'];
function obShot(want, look, t) { // writes this stage's camera target into want / look; update() glides there
  const p = P.pos;
  if (OB.stage === 'title' || OB.stage === 'intro') { // orbit the town around the trainer: high under the title card, lower while the Professor talks
    const hi = OB.stage === 'title', a = t * 0.05 + 0.6, r = hi ? 26 : 15;
    look.set(p.x - START[0], hi ? 0 : 0.5, p.z - START[1]);
    want.set(look.x + Math.sin(a) * r, hi ? 18 : 8, look.z + Math.cos(a) * r);
  } else { // close-up from the south, the side the play camera keeps clear; the trainer turns to face it (obStage)
    const narrow = vw <= 760, a = OB_FACE + Math.sin(t * 0.3) * 0.08, st = OB.stage === 'starter', d = st ? (narrow ? 4.6 : 3.4) : narrow ? 7 : 5.5; // on wide screens the subject sits right of the panel
    const c = st ? obFront() : p; // picking a partner: frame the Pokémon standing in front of the trainer
    want.set(c.x + Math.sin(a) * d, c.y + (st ? 2.1 : 2.8), c.z + Math.cos(a) * d); // partner shot looks down a little, over the grass at its feet
    const fx = c.x - want.x, fz = c.z - want.z, l = Math.hypot(fx, fz), s = narrow ? 0 : st ? 0.75 : 1.1; // the camera's left is (fz, -fx)
    look.set(c.x + fz / l * s, c.y + (st ? 0.35 : narrow ? 0.1 : 0.8), c.z - fx / l * s);
  }
}
const _obFront = new V3();
function obFront() { const p = P.pos; return _obFront.set(p.x + Math.sin(OB_FACE) * 1.3, 0, p.z + Math.cos(OB_FACE) * 1.3).setY(walkH(_obFront.x, _obFront.z)); } // where the partner stands
const OB_GLOW = new THREE.Mesh(new THREE.CircleGeometry(0.9, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ // the spotlight's pool of light on the grass
  map: canvasTex(64, 64, c => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,240,200,.9)'); g.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }),
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
OB_GLOW.visible = false; scene.add(OB_GLOW);
function obSpot() { // darken everything but the partner: the overlay's clear circle follows the Pokémon on screen
  const on = OB.stage === 'starter'; OB_GLOW.visible = on; if (!on) return;
  OB_GLOW.position.set(pika.position.x, pika.position.y + 0.03, pika.position.z);
  const v = pika.position.clone().add(new V3(0, 0.35, 0)).project(camera), el = $('obSpot');
  el.style.setProperty('--x', (v.x * 0.5 + 0.5) * vw + 'px'); el.style.setProperty('--y', (-v.y * 0.5 + 0.5) * vh + 'px');
}
function obStage(s) {
  OB.stage = s;
  $('obSkip').hidden = s !== 'intro';
  $('onboard').classList.toggle('spot', s === 'starter'); // spotlight on the partner while it is being picked
  $('obForm').hidden = !['look', 'name', 'confirm', 'starter'].includes(s);
  for (const el of $('obForm').querySelectorAll('.ob-step')) el.hidden = el.dataset.step !== s;
  if (s === 'look') { P.face = OB_FACE;$('obForm').querySelector('input[name=char]:checked').focus(); }
  if (s === 'name') $('obName').focus();
  if (s === 'confirm') { $('obConfirmName').textContent = $('obName').value.trim(); $('obYes').focus(); }
  if (s === 'starter') { const el = $('obForm').querySelector('input[name=starter]:checked'); pickStarter(el.value); el.focus(); }
}
function pickStarter(key) { // the pick becomes the whole party at once, so the follower behind the trainer previews it
  party.splice(0, party.length, makeMon(key, 5)); renderParty();
}
function openOnboard() {
  for (const el of document.querySelectorAll('.ob-of')) el.textContent = freshGame ? 3 : 2; // older saves keep their team: no starter step
  ui.onboard = true; keys.clear(); setMoveTarget(null); setFirstFrame(true);
  document.body.classList.add('onboarding'); $('onboard').hidden = false; obStage('title'); $('obPress').focus();
}
function obBegin() { // press any key: the gesture also lets the title theme start
  if (OB.stage !== 'title') return;
  SND.chime(); $('obTitleCard').classList.add('gone'); setTimeout(() => $('obTitleCard').remove(), 1200);
  obStage('intro'); say(PROF, OB_INTRO, null, () => obStage('look'));
}
function obSkip() { if (OB.stage !== 'intro') return; ui.dialog = null; $('dialog').classList.remove('show'); obStage('look'); }
function obKey(e) {
  if (e.repeat) return;
  if (OB.stage === 'title') { if (!['Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) { e.preventDefault(); obBegin(); } return; }
  if (e.code === 'Escape') { e.preventDefault(); return obSkip(); }
  if (ui.dialog && ['KeyE', 'Space', 'Enter'].includes(e.code)) { e.preventDefault(); act(); } // the form steps take their keys natively
}
function obFinish() {
  ui.onboard = false; OB.stage = null; OB.swoop = 3;
  document.body.classList.remove('onboarding'); $('onboard').classList.add('end'); setTimeout(() => ($('onboard').hidden = true), 1000);
  saveGame();
}
$('obTitleCard').onclick = obBegin;
$('obSkip').onclick = obSkip;
$('obForm').addEventListener('change', e => { // the pick swaps in the world behind, with a spin and a flash
  if (e.target.name === 'starter') { pickStarter(e.target.value); SND.sparkle(0.5); return; }
  if (e.target.name !== 'char') return;
  setTrainer(e.target.value); SND.sparkle(0.5);
  if (!SET.calm) { $('obFlash').animate([{ opacity: 0.9 }, { opacity: 0 }], 500); tween(0.7, k => (player.body.rotation.y = (1 - easeIO(k)) * Math.PI * 2)); }
});
$('obLookNext').onclick = () => obStage('name');
$('obBack').onclick = () => obStage('look');
$('obName').addEventListener('input', e => {
  const el = e.target, v = cleanNick(el.value, 24); if (v !== el.value) el.value = v; // the name ends up in innerHTML (save list)
  $('obCount').textContent = `${v.length}/24`; $('obErr').hidden = true;
});
$('obForm').addEventListener('submit', e => {
  e.preventDefault();
  if (OB.stage !== 'name') return;
  if (!$('obName').value.trim()) { $('obErr').hidden = false; return $('obName').focus(); }
  obStage('confirm');
});
$('obNo').onclick = () => obStage('name');
$('obYes').onclick = () => {
  const name = $('obName').value.trim();
  setTrainerProfile({ char: $('obForm').elements.char.value, name }); setTrainer(trainer.char); SND.chime();
  obStage('outro');
  if (!freshGame) return say(PROF, [`${name}! A fine name for a Trainer.`, 'Your very own Pokémon story is about to unfold.', 'Come and talk to me when you’re ready. I have a favour to ask.'], null, obFinish);
  say(PROF, [`${name}! A fine name for a Trainer.`, 'But today was meant to be special: the day you receive your first Pokémon.',
    'I brought three with me. Choose the one you want as your partner.'], null, () => obStage('starter'));
};
$('obStarterGo').onclick = () => {
  const m = party[0]; SND.chime(); setFreshGame(false);
  for (const k in bag) delete bag[k]; Object.assign(bag, { potion: 1, townMap: 1 }); // a new trainer's bag: the Professor's first assignment brings Poké Balls
  obStage('outro');
  say(PROF, [`${nm(m)}! An excellent choice. Take good care of each other.`, 'Lately the stream outside town has gone strangely quiet, and wild Pokémon seem uneasy.',
    'Come and talk to me when you’re ready. I have a favour to ask.'], null, obFinish);
};
if (!trainer) openOnboard();
$('loading').style.opacity = 0;
setTimeout(() => $('loading').remove(), 700);
requestAnimationFrame(frame);

export { OB, OB_FACE, obFront, obKey, obShot, obSpot };
