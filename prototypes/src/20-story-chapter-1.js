import './19-characters.js'; // first: the modules run in file-number order (see main.js)
import * as THREE from 'three';
import { I, START } from './02-hero-camera.js';
import { FOLK } from './03-fleurville-map.js';
import { RV } from './04-river.js';
import { CLEAR, terrainH, walkH } from './05-paths-raised-plaza-stairs-tall-grass.js';
import { scene } from './06-renderer-scene-post.js';
import { add } from './07-materials-textures.js';
import { circles } from './12-batched-props.js';
import { XY, interactables, makeHuman, npc } from './19-characters.js';
import { placeRival, renderTracker, scrapsTalk } from './21-side-quests.js';
import { $ } from './25-input.js';
import { kb, say } from './26-key-bindings.js';
import { SPECIES } from './27-pokemon-data.js';
import { bag, healParty, loadSpeciesModel } from './28-evolution-data.js';
import { curSlot, saveGame, setCurSlot, snapshot } from './29-save.js';
import { SND } from './37-battle-sound-effects.js';
import { startBattle } from './40-battle-flow.js';
import { SET } from './43-settings.js';
import { MAX_SLOTS, newId, readSlots, slotsBad, writeSlots } from './44-game-menu.js';

// ============================================================ Story: Chapter 1 "The Silent Stream"
// Steps and clues use stable IDs (saved in flags). Dialogue, markers, NPC places, the device, the stream and the objective pill
// all derive from this one state, so loading a save never replays a reward or strands the player between objectives.
const QUEST_STEPS = ['meet-prof', 'investigate-stream', 'report-clues', 'find-ranger', 'investigate-clearing', 'shut-device', 'report-device', 'chapter-complete', 'deliver-chip', 'act1-complete'];
const story = { step: 'meet-prof', clues: [] };
const reached = id => QUEST_STEPS.indexOf(story.step) >= QUEST_STEPS.indexOf(id);
const restored = () => reached('report-device'); // the device is off and the stream flows again (saved together as one step)
function bankAt(px, py, side, gap = 0.9) { // the stream bank nearest a reference pixel: side 1 = east bank, -1 = west
  const [x, z] = I(px, py, -0.4); let i = 0;
  RV.forEach((p, j) => { if (Math.hypot(p[0] - x, p[1] - z) < Math.hypot(RV[i][0] - x, RV[i][1] - z)) i = j; });
  const a = RV[Math.max(0, i - 1)], b = RV[Math.min(RV.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]), p = RV[i], d = p[3] + gap;
  return [p[0] - side * (b[1] - a[1]) / l * d, p[1] + side * (b[0] - a[0]) / l * d];
}
const CLUES = [ // along the stream, downstream to upstream, so the last clue points up Meadow Route
  { id: 'still-water', at: bankAt(1150, 760, -1, -0.2), /* close in: a tree overhangs this bank */ lines: ['The stream is perfectly still here.', 'No Poliwag song, no Magikarp splashing... not a single ripple.'] },
  { id: 'tracks', at: bankAt(1205, 430, 1), lines: ['Muddy footprints of many small Pokémon...', 'They all lead away from the water, as if something chased them off.'] },
  { id: 'hum', at: bankAt(1330, 200, 1), lines: ['A faint, high-pitched hum drifts down from upstream.', 'It seems to come from further along Meadow Route. The Pidgey here keep well away from it.'] },
];
const clueOpen = c => story.step === 'investigate-stream' && !story.clues.includes(c.id);
for (const c of CLUES) {
  interactables.push({ x: c.at[0], z: c.at[1], get r() { return clueOpen(c) ? 1.4 : 0; }, name: 'Stream', top: 1.2,
    get lines() { const n = story.clues.length + 1; return [...c.lines, n < CLUES.length ? `You noted it in your field journal. (Clue ${n} of ${CLUES.length})` : `That makes ${n} clues. Time to report to Prof. Sycamore!`]; },
    after: () => {
    story.clues.push(c.id); SND.chime();
    if (CLUES.every(k => story.clues.includes(k.id))) story.step = 'report-clues';
    questChanged();
  } });
}
let chapterT = 0;
function chapterCard(kicker, title, sub) { // the title card over the world for a few seconds (the dialog below carries the details)
  $('chKicker').textContent = kicker; $('chTitle').textContent = title; $('chSub').textContent = sub; $('chSub').hidden = !sub;
  $('chapter').classList.remove('show'); void $('chapter').offsetWidth; $('chapter').classList.toggle('still', !!SET.calm); $('chapter').classList.add('show');
  clearTimeout(chapterT); chapterT = setTimeout(() => $('chapter').classList.remove('show'), 4500);
}
function questChanged() { syncKeyItems(); renderObjective(); placeStoryNpcs(); placeRival(); saveGame(); }
function syncKeyItems() { if (story.step === 'deliver-chip') bag.signalChip = 1; else delete bag.signalChip; } // story items follow the step, so a save can neither lose nor keep them
function renderObjective() { renderTracker(); } // the quest tracker card (see questList)
function profTalk() { // [lines, after] for the current step; each grant happens only on its own step transition
  const left = CLUES.length - story.clues.length;
  return {
    'meet-prof': [['Ah, there you are! I have a favour to ask: your first field assignment.', 'The stream east of town has gone silent, and the wild Pokémon are restless.',
      'Follow the bank and inspect anything unusual. Here, these will help on the way.', 'You received 5 Poké Balls and 3 Potions!'],
      () => { if (story.step !== 'meet-prof') return; bag.ball = (bag.ball || 0) + 5; bag.potion = (bag.potion || 0) + 3; story.step = 'investigate-stream'; SND.chime(); questChanged();
        chapterCard('Chapter 1', 'The Silent Stream', 'Inspect the quiet stream east of town'); }],
    'investigate-stream': [[`Follow the stream east of town. ${left === 1 ? 'One more spot' : `${left} spots`} still need a look.`]],
    'report-clues': [['Still water, fleeing footprints and a strange hum from upstream...', 'Something along Meadow Route is driving the Pokémon away from the water.',
      'An apprentice ranger is posted out there. Find her: she knows the woods better than anyone.'],
      () => { if (story.step !== 'report-clues') return; story.step = 'find-ranger'; questChanged(); }],
    'find-ranger': [['The ranger is posted on Meadow Route, past the bridge. Be careful out there!']],
    'investigate-clearing': [['Lea will look after you in the woods. Find out what is making that hum!']],
    'shut-device': [['A device in the clearing? Switch it off, then come straight back!']],
    'report-device': [['Lea told me everything! Listen: the stream is singing again, and the Pokémon are coming home.', 'But a survey device with fresh repairs... someone switched it on deliberately.',
      'And it is not the only one. Similar signals have been reported in other places across the region.', 'You did wonderful field work. Take these for your next assignment: following those signals.', 'You received 5 Great Balls!'],
      () => { if (story.step !== 'report-device') return; bag.greatBall = (bag.greatBall || 0) + 5; story.step = 'chapter-complete'; SND.fanfare(); questChanged();
        const saved = chapterSave(); chapterCard('Chapter 1 complete', 'The Silent Stream', saved ? 'Saved as “Chapter 1 complete”' : '');
        say('Chapter 1', ['The Silent Stream: complete!', saved ? 'Your progress was saved to the file “Chapter 1 complete”.' : 'All save slots are full. Save from the Game Menu to keep a copy of this moment.']); }],
    'chapter-complete': [['Before you go, take this: the signal chip from inside the device. It has a maker’s stamp I can’t read.',
      'Clemont in Fleurville builds machines like this for fun. If anyone can tell us who repaired it, he can.', 'You received the Signal Chip!'],
      () => { if (story.step !== 'chapter-complete') return; story.step = 'deliver-chip'; SND.chime(); questChanged(); }],
    'deliver-chip': [[`Clemont lives by the windmill in Fleurville. Press ${kb('travel')} to travel there.`]],
    'act1-complete': [['The Halcyon Network... a company that promises to keep Pokémon away from towns.', 'If they are moving Pokémon instead of helping them, every quiet stream is a clue.',
      'Keep training, keep observing. The League and the truth both lie down those trails.']],
  }[story.step];
}
function chapterSave() { // the chapter-complete save point: a save file of its own, while a slot is free
  const slots = readSlots(), prev = curSlot;
  if (slotsBad || slots.length >= MAX_SLOTS) return false;
  setCurSlot(newId()); slots.push({ id: curSlot, name: 'Chapter 1 complete', at: Date.now(), data: snapshot() });
  if (!writeSlots(slots)) { setCurSlot(prev); return false; }
  saveGame(); return true;
}

// Ranger Lea: posted on Meadow Route; after her battle she waits at the clearing's edge
const PROF = 'Prof. Sycamore';
const RANGER = 'Ranger Lea', RANGER_AT = I(1560, 330, 0), RANGER_CLEAR = [CLEAR.x - 3.4, CLEAR.z + 1.6];
const RANGER_TEAM = [['RATTATA', 3], ['PIDGEY', 2]]; // the first Trainer battle: a lone Lv5 starter without items wins 95%+ even spamming its own type's move
// (Pidgey and Oddish both resist Grass, and Oddish's Absorb hits Squirtle hard: Bulbasaur won 4% and Squirtle 23% that way)
function rangerTalk() { // [lines, after] for the current step
  if (story.step === 'find-ranger') return [['So Prof. Sycamore sent you? I’m Lea, apprentice ranger.', 'The clearing ahead is no place for a beginner. Show me you can handle yourself!'], () => startBattle(null, 0, {
    trainer: { name: 'Apprentice Ranger Lea', team: RANGER_TEAM, prize: 300 },
    onWin: () => { if (story.step !== 'find-ranger') return; story.step = 'investigate-clearing'; healParty(); renderObjective(); // she walks to the clearing once she has spoken
      say(RANGER, ['You and your partner work well together. You passed!', 'Here, let me patch up your Pokémon. Your team was healed!',
        'That hum comes from the woodland clearing at the end of the road. A Psyduck there attacks anyone who comes near.',
        'Psyduck is a Water type. If Water moves hurt your partner, catch a teammate in the tall grass and keep Potions handy.', 'I’ll meet you there. Stay close once we’re inside!'], null, placeStoryNpcs); },
    onLose: () => say(RANGER, ['Don’t give up! I patched up your Pokémon.', 'Catch your breath, then talk to me when you’re ready for a rematch.']),
  })];
  const sq = scrapsTalk(); if (sq) return sq;
  return [{
    'investigate-clearing': ['Careful: that Psyduck is guarding something, and it’s in a real state.', 'Calm it down and we can see what’s behind it.'],
    'shut-device': ['That machine... the hum is coming from it. Switch it off!'],
    'report-device': ['Listen to that stream! Hurry back and tell the Professor.', 'I’ll keep an eye on things here.'],
    'chapter-complete': ['Thanks for your help. If you ever hear that hum again, come find me.'],
    'deliver-chip': ['Clemont will figure out that chip. He’s Fleurville’s genius inventor.'],
    'act1-complete': ['Halcyon... I’ll tell the other rangers. Good work out there, partner.'],
  }[story.step] ?? ['Hold on! The woods past here are off-limits for now.', 'Something has the wild Pokémon spooked. Only Trainers the Professor sends may pass.']];
}
let rangerNpc = null;
function spawnRanger() { // the Pokémon Ranger (Female) rip; the Backpacker, then the girl sculpt, if it fails to load
  const key = XY.rangerF ? 'rangerF' : XY.backpacker ? 'backpacker' : 'girl';
  const n = rangerNpc = npc(makeHuman(key), ...RANGER_AT, -Math.PI / 2, RANGER, []);
  n.h.root.scale.setScalar(0.85); placeStoryNpcs();
  interactables.push({ get x() { return n.x; }, get z() { return n.z; }, r: 1.6, name: RANGER, get lines() { return rangerTalk()[0]; }, npc: n, get after() { return rangerTalk()[1]; }, top: 2.5 });
}
const PROF_AT = [START[0] - 2.2, START[1] - 1.6];
function spawnProf() { // the professor waits by the spawn; the Verdant elder sculpt stands in if the X/Y model failed to load
  const key = XY.sycamore ? 'sycamore' : 'elder';
  const n = npc(makeHuman(key), ...PROF_AT, Math.atan2(START[0] - PROF_AT[0], START[1] - PROF_AT[1]), PROF, []);
  n.h.root.scale.setScalar(key === 'sycamore' ? FOLK.sycamore[2] : 0.85);
  interactables.push({ get x() { return n.x; }, get z() { return n.z; }, r: 1.6, name: PROF, get lines() { return profTalk()[0]; }, npc: n, get after() { return profTalk()[1]; }, top: 2.5 });
}

// The woodland clearing: an old survey device pulsing a signal, and the Psyduck it torments standing guard in front of it
const DEV_AT = [CLEAR.x + 1.4, CLEAR.z - 0.6], GUARD_AT = [CLEAR.x - 0.6, CLEAR.z + 0.2], GUARD_STREAM = bankAt(1205, 520, 1, 0.2);
const GUARD_REST = [CLEAR.x - 1.4, CLEAR.z - 2.2]; // beaten, it slumps aside: standing in front of the device, it took the E press meant for the switch
const guardSpot = () => restored() ? GUARD_STREAM : story.step === 'shut-device' ? GUARD_REST : GUARD_AT;
const DEV = new THREE.Group();
{
  DEV.position.set(DEV_AT[0], terrainH(...DEV_AT), DEV_AT[1]); DEV.rotation.y = -Math.PI / 2 + 0.3; scene.add(DEV);
  add(new THREE.BoxGeometry(0.95, 0.8, 0.62), '#5f6f63', DEV, 0, 0.4, 0, { mat: { roughness: 0.55, metalness: 0.45 } });
  add(new THREE.BoxGeometry(1.05, 0.08, 0.7), '#4a5650', DEV, 0, 0.84, 0, { mat: { roughness: 0.6, metalness: 0.4 } });
  add(new THREE.BoxGeometry(0.55, 0.32, 0.04), '#1f2824', DEV, -0.08, 0.48, 0.32);
  for (const [x, y] of [[-0.38, 0.12], [0.36, 0.7], [0.4, 0.15]]) add(new THREE.BoxGeometry(0.16, 0.1, 0.02), '#a0612e', DEV, x, y, 0.315); // rust patches
  for (const x of [-0.42, 0.42]) add(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 8), '#d9dcd2', DEV, x, 0.84, 0.36, { r: [Math.PI / 2, 0, 0] }); // fresh bolts
  DEV.userData.switch = add(new THREE.BoxGeometry(0.06, 0.16, 0.06), '#e2473b', DEV, 0.3, 0.5, 0.34);
  add(new THREE.CylinderGeometry(0.025, 0.03, 1.4, 6), '#8a8f88', DEV, 0.28, 1.58, -0.12);
  add(new THREE.SphereGeometry(0.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), '#9aa39a', DEV, -0.25, 1.05, -0.05, { r: [-0.9, 0.4, 0], mat: { side: THREE.DoubleSide, metalness: 0.5, roughness: 0.4 } });
  DEV.userData.lamp = add(new THREE.SphereGeometry(0.07, 10, 8), '#ff3b2f', DEV, 0.28, 2.3, -0.12, { mat: { emissive: '#ff2010', emissiveIntensity: 2.2 } });
  DEV.userData.rings = [0, 1, 2].map(i => { // signal pulses rippling out across the clearing
    const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff7a6a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.set(DEV_AT[0], terrainH(...DEV_AT) + 0.08, DEV_AT[1]); m.userData.ph = i / 3; scene.add(m); return m;
  });
  circles.push({ x: DEV_AT[0], z: DEV_AT[1], r: 0.6, story: true }); // story: moves with the clearing, so debug.coreHash leaves it out
}
interactables.push({ x: DEV_AT[0], z: DEV_AT[1], r: 1.5, name: 'Strange device', top: 2.6,
  get lines() {
    if (restored()) return ['The old survey device is silent now. Its light has gone dark.'];
    if (story.step === 'shut-device') return ['An old survey device. Its casing is rusty, but the bolts are brand new: someone repaired it recently.',
      'A red light blinks in time with the hum that is hurting the Pokémon.', 'There is a big red switch on the panel...', 'Click. The hum winds down... and stops.'];
    return reached('investigate-clearing') ? ['The Psyduck won’t let you anywhere near the humming machine.'] : ['A humming machine. Something about it makes your teeth ache.', 'Better find the ranger before poking around here.'];
  },
  get after() { return story.step === 'shut-device' ? shutDevice : undefined; } });
function shutDevice() {
  if (story.step !== 'shut-device') return;
  story.step = 'report-device'; SND.chime(); questChanged(); // device off and stream restored persist together
  say(RANGER, ['Listen... can you hear that? The stream is flowing again!', 'And look at Psyduck: it’s heading back to the water.', 'Hurry and tell Prof. Sycamore. I’ll keep an eye on things here.']);
}
const GUARD = { model: null, hop: 0 };
function spawnGuardian() { return loadSpeciesModel('PSYDUCK').then(() => { GUARD.model = SPECIES.PSYDUCK.make(); GUARD.model.scale.multiplyScalar(0.8); scene.add(GUARD.model); placeStoryNpcs(); }); }
interactables.push({ get x() { return guardSpot()[0]; }, get z() { return guardSpot()[1]; }, r: 1.6, name: 'Psyduck', top: 1.5,
  get lines() {
    if (restored()) return ['Psyduck paddles happily in the stream.', 'Psy-yy... duck!'];
    if (story.step === 'shut-device') return ['Psyduck is tired out, but it still clutches its head.', 'The hum from the machine behind it is getting to everyone...'];
    return story.step === 'investigate-clearing' ? ['Psyduck is clutching its head and quacking in distress!', 'It’s guarding the humming machine... It attacks!'] : ['A Psyduck clutches its head and glares at you.', 'It won’t let anyone near the humming machine.'];
  },
  get after() { return story.step === 'investigate-clearing' ? fightGuardian : undefined; } });
function fightGuardian() {
  startBattle('PSYDUCK', 4, { intro: 'The distressed PSYDUCK attacks!', foeTitle: 'The distressed ', noCatch: true, // Lv4: Charmander, the weak matchup, wins 60-78% alone at Lv6 (Lea warns about it and heals first)
    onWin: () => { if (story.step !== 'investigate-clearing') return; story.step = 'shut-device'; questChanged();
      say(RANGER, ['Well done! It’s too worn out to fight now.', 'Look, behind it: that rusty machine. The hum is coming from there. Switch it off!']); },
    onLose: () => say(RANGER, ['I’ve got you! Your Pokémon are patched up.', 'That Psyduck isn’t evil, just hurting. Try again when you’re ready.']) });
}
function placeStoryNpcs() { // NPC places follow the story step (called on load, on spawn and on every step change)
  if (rangerNpc) { const [x, z] = reached('investigate-clearing') ? RANGER_CLEAR : RANGER_AT; Object.assign(rangerNpc, { x, z, baseFace: reached('investigate-clearing') ? 1.2 : -Math.PI / 2 }); }
  if (GUARD.model) { const [x, z] = guardSpot(); GUARD.model.position.set(x, walkH(x, z), z); GUARD.model.rotation.y = restored() ? 2.4 : story.step === 'shut-device' ? 0.4 : -Math.PI / 2; }
}

export { CLUES, DEV, DEV_AT, GUARD, GUARD_AT, PROF, QUEST_STEPS, RANGER, RANGER_AT, chapterCard, clueOpen, questChanged, reached,
  renderObjective, restored, spawnGuardian, spawnProf, spawnRanger, story, syncKeyItems };
