import './20-story-chapter-1.js'; // first: the modules run in file-number order (see main.js)
import * as THREE from 'three';
import { approach, clamp, pick, rnd, rr } from './01-helpers.js';
import { I, START } from './02-hero-camera.js';
import { inKalos } from './03-fleurville-map.js';
import { RV, riverInfo } from './04-river.js';
import { ROUTE1, terrainH, walkH } from './05-paths-raised-plaza-stairs-tall-grass.js';
import { renderPass, scene } from './06-renderer-scene-post.js';
import { add, canvasTex, mat } from './07-materials-textures.js';
import { waterMat } from './11-water.js';
import { P, XY, interactables, makeHuman, npc, npcs, trainer } from './19-characters.js';
import { CLUES, DEV, DEV_AT, GUARD, GUARD_AT, PROF, RANGER, chapterCard, clueOpen, questChanged, reached, restored, story } from './20-story-chapter-1.js';
import { $, ui } from './25-input.js';
import { VIEW, kb, say } from './26-key-bindings.js';
import { SPECIES } from './27-pokemon-data.js';
import { bag, loadSpeciesModel, money, party, setMoney } from './28-evolution-data.js';
import { AC, BUF, OUT, SND } from './37-battle-sound-effects.js';
import { startBattle } from './40-battle-flow.js';

// ============================================================ Side quests and quest markers
// Main-story targets wear a gold "!", side quests a light-blue one. Every side quest feeds the main story or the end game:
//  - A Rival's Promise: battles with the rival, who sets the Championship as the final goal (the League finale).
//  - Field Notes: Hiker Mia's survey of wild Pokémon, the first step towards Master Field Researcher (post-game).
//  - Survey Scraps: parts the device's repairers dropped on Meadow Route; their stamp backs up Clemont's Act I finding.
// Stages: 0 not started, 1 under way, 2 done (the rival: 1 after the first battle, 2 after the rematch). Saved in flags.side.
const SIDE = { rival: 0, notes: 0, seen: [], scraps: 0, got: [] };
const NOTES_GOAL = 3;
function noteWild(key) { if (SIDE.notes === 1 && !SIDE.seen.includes(key)) { SIDE.seen.push(key); questChanged(); } }
const SCRAPS = [0.3, 0.55, 0.85].map((f, i) => { // beside the path, alternating sides, where a careless repair crew would drop things
  const k = Math.round(f * (ROUTE1.length - 1)), a = ROUTE1[k - 1], b = ROUTE1[k + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]), sd = i % 2 ? 1 : -1;
  const at = [ROUTE1[k][0] + sd * (b[1] - a[1]) / l * 2.2, ROUTE1[k][1] - sd * (b[0] - a[0]) / l * 2.2], g = new THREE.Group();
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 8), '#d9dcd2', g, 0, 0.05, 0, { r: [0, 0, Math.PI / 2], mat: { metalness: 0.7, roughness: 0.3 } }); // a fresh bolt
  add(new THREE.BoxGeometry(0.28, 0.04, 0.18), '#6f7d72', g, 0.12, 0.02, 0.1, { r: [0, 0.6, 0], mat: { metalness: 0.5, roughness: 0.5 } }); // a bracket
  g.position.set(at[0], terrainH(...at), at[1]); scene.add(g);
  return { at, g };
});
SCRAPS.forEach((c, i) => interactables.push({ x: c.at[0], z: c.at[1], get r() { return SIDE.scraps === 1 && !SIDE.got.includes(i) ? 1.3 : 0; }, name: 'Survey part', top: 0.9,
  lines: ['A shiny new bolt and a bracket, half buried in the grass.', 'There is a stamp on the bracket: a sunburst over the letters HN.'],
  after: () => { if (SIDE.scraps !== 1 || SIDE.got.includes(i)) return; SIDE.got.push(i); SND.chime(); questChanged(); } }));
function scrapsTalk() { // Ranger Lea's side quest, offered once the stream flows again; null when she has nothing quest-related to say
  if (!restored() || SIDE.scraps === 2) return null;
  if (SIDE.scraps === 0) return [['Wait, before you go. Whoever fixed that device came through here with a toolbox.', 'They dropped parts all along Meadow Route. Could you collect three of them?',
    'If we know who repaired it, we know who switched it on.'], () => { if (SIDE.scraps !== 0) return; SIDE.scraps = 1; SND.chime(); questChanged(); }];
  const left = SCRAPS.length - SIDE.got.length;
  if (left > 0) return [[`Any luck? ${left} more part${left === 1 ? '' : 's'} should be lying along Meadow Route.`]];
  return [['Let me see... a sunburst over HN. I have seen that stamp on survey stations up north!', 'Somebody is turning those old stations back on. This is real evidence, partner.',
    'Here, for your trouble. And show these to whoever reads that signal chip.', 'You received 2 Super Potions and ₽1000!'],
    () => { if (SIDE.scraps !== 1) return; SIDE.scraps = 2; bag.superPotion = (bag.superPotion || 0) + 2; setMoney(Math.min(999999, money + 1000)); SND.fanfare(); questChanged(); }];
}
function notesTalk() { // Hiker Mia's survey
  if (!reached('investigate-stream')) return null;
  if (SIDE.notes === 0) return [['You have a Pokédex? Then you can help me!', `I am surveying which wild Pokémon still live near town. Battle ${NOTES_GOAL} different wild species for me.`,
    'Careful notes are how real field researchers start. The Professor says the best become Master Field Researchers!'], () => { if (SIDE.notes !== 0) return; SIDE.notes = 1; SND.chime(); questChanged(); }];
  if (SIDE.notes === 1 && SIDE.seen.length < NOTES_GOAL) return [[`So far you have recorded ${SIDE.seen.length} of ${NOTES_GOAL}. Try the tall grass: different spots hide different Pokémon.`]];
  if (SIDE.notes === 1) return [[`${SIDE.seen.map(k => SPECIES[k].name).join(', ')}... wonderful notes!`, 'If the Pokémon are leaving, we will only know because someone wrote down who used to live here.',
    'Keep observing everywhere you go. Here, these helped me on long surveys.', 'You received 3 Oran Berries and 2 Great Balls!'],
    () => { if (SIDE.notes !== 1) return; SIDE.notes = 2; bag.oranBerry = (bag.oranBerry || 0) + 3; bag.greatBall = (bag.greatBall || 0) + 2; SND.fanfare(); questChanged(); }];
  return [['My survey grows every day thanks to you. Fieldwork never really ends!']];
}
function clemontTalk() { // the Act I hand-off: who made the chip
  if (story.step !== 'deliver-chip') return story.step === 'act1-complete' ? [['That Halcyon chip still bothers me. I will keep studying it!']] : null;
  return [['A signal chip from a survey device? Let me see... the future is now, thanks to science!', 'Fascinating: it is set to push Pokémon AWAY from wherever it is installed.',
    'And this stamp, a sunburst over HN: the Halcyon Network. A company that promises towns will be safe from wild Pokémon.',
    ...(SIDE.scraps === 2 ? ['The parts Lea found carry the same stamp. That settles it: Halcyon repaired your device.'] : ['If you find more parts with this stamp, we will know for sure who repaired it.']),
    'Please tell Prof. Sycamore. Here, take this as thanks for the puzzle!', 'You received a Thunder Stone!'],
    () => { if (story.step !== 'deliver-chip') return; story.step = 'act1-complete'; bag.thunderStone = (bag.thunderStone || 0) + 1; SND.fanfare(); questChanged();
      chapterCard('Act I complete', 'First Signs', 'The trail leads to the Halcyon Network');
      say('Act I', ['First Signs: complete!', 'Somebody is redirecting the region\'s Pokémon. The trail leads to the Halcyon Network.']); }];
}
// the rival: a childhood friend who wants the Championship and believes strength solves everything
const RIVAL_AT = [START[0] + 3, START[1] + 2], RIVAL_COUNTER = { BULBASAUR: 'CHARMANDER', IVYSAUR: 'CHARMANDER', CHARMANDER: 'SQUIRTLE', CHARMELEON: 'SQUIRTLE', SQUIRTLE: 'BULBASAUR', WARTORTLE: 'BULBASAUR' };
let rivalNpc = null, RIVAL = 'Calem';
const rivalStarter = () => RIVAL_COUNTER[party.map(m => m.key).find(k => RIVAL_COUNTER[k])] ?? 'EEVEE';
// a partner received today only knows the basics; with its full learnset the type counter beat a lone starter 83-97% of the time
const RIVAL_FIRST_MOVES = { BULBASAUR: ['TACKLE', 'GROWL'], CHARMANDER: ['SCRATCH', 'GROWL'], SQUIRTLE: ['TACKLE', 'TAIL_WHIP'], EEVEE: ['TACKLE', 'TAIL_WHIP'] };
function spawnRival() { // Calem (Shauna if the player is Calem)
  const key = XY.calem && trainer?.char !== 'calem' ? 'calem' : 'girl'; RIVAL = key === 'calem' ? 'Calem' : 'Shauna';
  rivalNpc = npc(makeHuman(key), ...RIVAL_AT, Math.PI, RIVAL, []); rivalNpc.h.root.scale.setScalar(0.85);
  interactables.push({ get x() { return rivalNpc.x; }, get z() { return rivalNpc.z; }, get r() { return rivalNpc.h.root.visible ? 1.6 : 0; }, name: RIVAL, lines: [], npc: rivalNpc, top: 2.5 });
  QUEST_TALK[RIVAL] = rivalTalk; placeRival();
}
function placeRival() { if (rivalNpc) rivalNpc.h.root.visible = reached('investigate-stream'); } // the rival turns up once the investigation starts
function rivalBattle(team, onWin) {
  return () => startBattle(null, 0, { trainer: { name: `Rival ${RIVAL}`, team, prize: 400 }, onWin,
    onLose: () => say(RIVAL, ['Ha! Strength wins every time.', 'Go heal up. I will be right here when you want a rematch.']) });
}
function rivalTalk() {
  const st = rivalStarter();
  if (SIDE.rival === 0) return [['There you are! I got my partner from the Professor too. We are going to be Champion one day!', 'Wild Pokémon running into town? Nothing a strong team can\'t fix.',
    ...(st === 'EEVEE' ? [] : [`I picked ${SPECIES[st].name} because it has the type advantage over yours. Moves it resists will barely scratch it!`]),
    'Come on, our first battle. Right here, right now!'], rivalBattle([[st, 5, RIVAL_FIRST_MOVES[st]]], () => { if (SIDE.rival !== 0) return; SIDE.rival = 1; questChanged();
      say(RIVAL, ['Okay, okay, you won this one.', 'Promise me something: we both make it to the League, and we settle it in the Championship.', 'Until then, I am training non-stop. Find me again after you fix that stream!']); })];
  if (SIDE.rival === 1 && !reached('chapter-complete')) return [['Still chasing that stream mystery? Fix it, then we battle again. I am getting stronger every day!']];
  // the rematch is the type counter at Lv6 (simulated: a lone Lv9 Bulbasaur, the worst case, wins 63% with 3 Potions; a caught teammate helps)
  if (SIDE.rival === 1) return [['You actually stopped that device? Huh. Maybe there is more to this than strength...', 'Doesn\'t mean I will go easy on you. Rematch!'],
    rivalBattle([['PIDGEY', 5], [st, 6]], () => { if (SIDE.rival !== 1) return; SIDE.rival = 2; bag.greatBall = (bag.greatBall || 0) + 3; SND.fanfare(); questChanged();
      say(RIVAL, ['Two in a row... You read your Pokémon like a field researcher reads a trail.', 'I will remember that. The promise stands: the Championship, you and me.', 'Take these. You will need them on the road to the League.', 'You received 3 Great Balls!']); })];
  return [['The League is waiting. See you in the Championship!']];
}
// townsfolk notice the silent stream (the chapter's opening beat) and its return
const townTalk = (before, after) => () => [restored() ? after : before];
const QUEST_TALK = { 'Hiker Mia': notesTalk, Clemont: clemontTalk, // NPC name -> () => [lines, after] | null; act() asks it before the everyday lines
  'Old man': townTalk(['That river has babbled every day of my life. Since this morning: nothing. Not a peep.', 'Even the Pokémon that drink there ran off. Something is wrong, mark my words.'],
    ['Hear that? The river is singing again!', 'Back in my day there was no bridge here. We hopped across the river stones. Builds character!']),
  Kid: townTalk(['A wild Bulbasaur ran out of the grass by the river. It looked so scared!', 'Grandpa says the Pokémon are running away from the stream. Is my egg going to be okay?'],
    ['The Magikarp are splashing in the river again!', 'My egg wiggled when it heard them. It’s going to hatch any day now!']) };
// The quest log: one entry per quest under way, with what to do next and where ([x, z, marker height] targets; none when the goal
// is "anywhere", like battling wild Pokémon). Markers, the tracker card and the guide arrow all read it.
const MAIN_TEXT = { 'meet-prof': 'Talk to Prof. Sycamore', 'investigate-stream': 'Inspect the quiet stream', 'report-clues': 'Report to Prof. Sycamore',
  'find-ranger': 'Find the apprentice ranger on Meadow Route', 'investigate-clearing': 'Investigate the woodland clearing', 'shut-device': 'Shut down the strange device',
  'report-device': 'Report to Prof. Sycamore', 'chapter-complete': 'Ask Prof. Sycamore about your next assignment', 'deliver-chip': 'Bring the signal chip to Clemont in Fleurville',
  'act1-complete': 'Act I complete! Follow the Halcyon signals in Act II' };
const npcSpot = name => { const n = npcs.find(k => k.name === name && k.h.root.visible); return n ? [[n.x, n.z, 2.9]] : []; };
function questList() {
  const st = story.step, q = [];
  const prof = () => npcSpot(PROF), main = { 'meet-prof': prof, 'report-clues': prof, 'report-device': prof, 'chapter-complete': prof, 'find-ranger': () => npcSpot(RANGER),
    'investigate-stream': () => CLUES.filter(clueOpen).map(c => [c.at[0], c.at[1], 1.4]), 'investigate-clearing': () => [[GUARD_AT[0], GUARD_AT[1], 1.9]],
    'shut-device': () => [[DEV_AT[0], DEV_AT[1], 2.9]], 'deliver-chip': () => npcSpot('Clemont') }[st]?.() ?? [];
  q.push({ id: 'main', side: false, title: reached('chapter-complete') ? 'Act I · First Signs' : 'Chapter 1 · The Silent Stream', text: MAIN_TEXT[st],
    prog: st === 'investigate-stream' ? [story.clues.length, CLUES.length] : null, targets: main });
  if (SIDE.rival === 1) q.push({ id: 'rival', side: true, title: 'A Rival’s Promise', prog: null,
    text: reached('chapter-complete') ? `Rematch ${RIVAL} in town` : `Restore the stream, then meet ${RIVAL} again`, targets: reached('chapter-complete') ? npcSpot(RIVAL) : [] });
  if (SIDE.notes === 1) { const done = SIDE.seen.length >= NOTES_GOAL;
    q.push({ id: 'notes', side: true, title: 'Field Notes', text: done ? 'Report to Hiker Mia' : 'Battle different wild Pokémon in tall grass',
      prog: done ? null : [SIDE.seen.length, NOTES_GOAL], targets: done ? npcSpot('Hiker Mia') : [] }); }
  if (SIDE.scraps === 1) { const done = SIDE.got.length >= SCRAPS.length;
    q.push({ id: 'scraps', side: true, title: 'Survey Scraps', text: done ? 'Bring the parts to Ranger Lea' : 'Collect stamped parts on Meadow Route',
      prog: done ? null : [SIDE.got.length, SCRAPS.length], targets: done ? npcSpot(RANGER) : SCRAPS.filter((c, i) => !SIDE.got.includes(i)).map(c => [c.at[0], c.at[1], 1.2]) }); }
  return q;
}
function questMarks() { // everything that should wear a "!" right now: [x, z, height above the ground, side?, quest id]
  const m = questList().flatMap(q => q.targets.map(t => [t[0], t[1], t[2], q.side, q.id]));
  const offer = (name, id) => npcSpot(name).forEach(t => m.push([t[0], t[1], t[2], true, id])); // side quests waiting to be picked up
  if (reached('investigate-stream') && SIDE.rival === 0) offer(RIVAL, 'rival');
  if (reached('investigate-stream') && SIDE.notes === 0) offer('Hiker Mia', 'notes');
  if (restored() && SIDE.scraps === 0) offer(RANGER, 'scraps');
  return m;
}
// ---- quest tracker: the card top-left. Click a quest (or press the quest key, Q by default) to track it; the guide arrow then points the way.
let tracked = 'main', trackerMin = false;
const sameMap = (x, x2) => inKalos(x) === inKalos(x2);
function nearestTarget(q) { // the closest target on this map, or null; [x, z, distance]
  let best = null;
  for (const [x, z] of q?.targets ?? []) { if (!sameMap(x, P.pos.x)) continue; const d = Math.hypot(x - P.pos.x, z - P.pos.z); if (!best || d < best[2]) best = [x, z, d]; }
  return best;
}
function distLabel(q) {
  if (!q.targets.length) return '';
  const t = nearestTarget(q); if (t) return t[2] < 3 ? 'here' : `${Math.round(t[2])} m`;
  return `${inKalos(q.targets[0][0]) ? 'Fleurville' : 'Verdant'} · ${kb('travel')}`; // the target is on the other map: the travel key goes there
}
function renderTracker() {
  const list = questList(); if (!list.some(q => q.id === tracked)) tracked = 'main';
  const el = $('quests'); el.classList.toggle('min', trackerMin);
  el.innerHTML = `<button class="qh" data-act="min" aria-expanded="${!trackerMin}">Quests<span class="n">${list.length}</span><span class="car">${trackerMin ? '▸' : '▾'}</span></button>` +
    list.map(q => `<button class="q ${q.side ? 'side' : 'main'}${q.id === tracked ? ' on' : ''}" data-q="${q.id}" aria-pressed="${q.id === tracked}" title="${q.id === tracked ? 'Tracking' : 'Click to track'}: ${q.text}">
      <span class="qi">!</span><span class="qx"><span class="qt">${q.side ? 'Side' : 'Main'} · ${q.title}</span><span class="qo">${q.text}${q.prog ? ` <b>${q.prog[0]}/${q.prog[1]}</b>` : ''}</span>
      ${q.prog ? `<span class="qb"><i style="width:${q.prog[0] / q.prog[1] * 100}%"></i></span>` : ''}</span><span class="qd"></span></button>`).join('');
  trackerTick(true);
}
function trackQuest(id) { tracked = id; renderTracker(); SND.chime?.(); }
function trackNext() { const ids = questList().map(q => q.id); trackQuest(ids[(ids.indexOf(tracked) + 1) % ids.length]); }
let trackerT = 0;
function trackerTick(now) { // distances, a few times a second (DOM writes only when the text changes)
  if (!now && (trackerT += 1) % 12) return;
  const byId = Object.fromEntries(questList().map(q => [q.id, q]));
  for (const b of $('quests').querySelectorAll('[data-q]')) { const q = byId[b.dataset.q], d = b.querySelector('.qd'), txt = q ? distLabel(q) : ''; if (d.textContent !== txt) d.textContent = txt; }
}
document.getElementById('quests').addEventListener('click', e => { // (`$` is defined further down)
  const b = e.target.closest('button'); if (!b) return; b.blur(); // keep Space / E for talking, not for re-pressing the card
  if (b.dataset.act === 'min') { trackerMin = !trackerMin; renderTracker(); } else if (b.dataset.q) trackQuest(b.dataset.q);
});
// ---- the guide arrow: a chevron on the ground just ahead of the trainer, pointing at the tracked quest's nearest target
const GUIDE = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0.62), new THREE.Vector2(0.5, -0.28), new THREE.Vector2(0, -0.04), new THREE.Vector2(-0.5, -0.28)])).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, fog: false, toneMapped: false, side: THREE.DoubleSide }));
GUIDE.renderOrder = 11; GUIDE.scale.setScalar(1.35); scene.add(GUIDE);
const GUIDE_EDGE = new THREE.Mesh(GUIDE.geometry, new THREE.MeshBasicMaterial({ depthTest: false, fog: false, toneMapped: false, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
GUIDE_EDGE.scale.setScalar(1.22); GUIDE_EDGE.position.y = -0.01; GUIDE_EDGE.renderOrder = 10.5; GUIDE.add(GUIDE_EDGE); // a dark rim, so the arrow reads on sunlit grass too
function guideTick(t) {
  const q = questList().find(k => k.id === tracked), tg = nearestTarget(q);
  GUIDE.visible = !!tg && tg[2] > 3 && !ui.onboard && !VIEW.fpv;
  if (!GUIDE.visible) return;
  const dx = (tg[0] - P.pos.x) / tg[2], dz = (tg[1] - P.pos.z) / tg[2], r = 1.5 + Math.sin(t * 4) * 0.12; // nudges forward, like a beckoning hand
  GUIDE.position.set(P.pos.x + dx * r, walkH(P.pos.x + dx * r, P.pos.z + dz * r) + 0.12, P.pos.z + dz * r);
  GUIDE.rotation.y = Math.atan2(-dx, -dz);
  const [fill, ink] = MARK_COL[q.side ? 'side' : 'main'];
  GUIDE.material.color.set(fill); GUIDE_EDGE.material.color.set(ink); GUIDE.material.opacity = 0.85 + Math.sin(t * 4) * 0.15;
}
const MARK_COL = { main: ['#ffc21a', '#7a4a00'], side: ['#5ec8ff', '#0b4f7a'] }; // [fill, ink]: gold for the main story, light blue for side quests
const markMat = ([fill, ink]) => new THREE.SpriteMaterial({ depthTest: false, fog: false, toneMapped: false, map: canvasTex(64, 64, (c, w, h) => {
  c.fillStyle = ink; c.beginPath(); c.arc(w / 2, h / 2, 30, 0, 7); c.fill(); c.fillStyle = fill; c.beginPath(); c.arc(w / 2, h / 2, 25, 0, 7); c.fill();
  c.fillStyle = ink; c.font = '900 40px Nunito, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', w / 2, h / 2 + 2);
}) });
const MARK_MATS = { main: markMat(MARK_COL.main), side: markMat(MARK_COL.side) }, MARKS = [];
function markTick(t) { // drawn through walls and fog, so a quest is never lost behind a house
  const list = questMarks();
  while (MARKS.length < list.length) { const sp = new THREE.Sprite(MARK_MATS.main); sp.scale.setScalar(0.75); sp.renderOrder = 10; scene.add(sp); MARKS.push(sp); }
  MARKS.forEach((sp, i) => { const q = list[i]; sp.visible = !!q; if (!q) return;
    sp.material = MARK_MATS[q[3] ? 'side' : 'main']; sp.position.set(q[0], walkH(q[0], q[1]) + q[2] + Math.sin(t * 3 + i) * 0.08, q[1]);
    sp.scale.setScalar(q[4] === tracked ? 0.95 : 0.7); }); // the tracked quest's markers stand out
  guideTick(t); trackerTick();
}

// the stream: still and silent until the device is off; then it flows, splashes and burbles, and Magikarp leap from it
const STREAM = { k: 0, fish: [] };
function streamTick(dt, t) {
  const on = !restored();
  STREAM.k = approach(STREAM.k, on ? 0 : 1, dt * 0.35); // a slow swell when the stream comes back
  waterMat.uniforms.uFlow.value += dt * (0.12 + 0.88 * STREAM.k);
  for (const s of splashes) { s.pts.visible = STREAM.k > 0.02; s.pts.material.opacity = 0.85 * STREAM.k; }
  DEV.userData.lamp.material.emissiveIntensity = on ? (Math.sin(t * 6) > 0 ? 2.6 : 0.3) : 0;
  DEV.userData.lamp.material.color.set(on ? '#ff3b2f' : '#3a2826');
  for (const r of DEV.userData.rings) { const k = (t * 0.6 + r.userData.ph) % 1; r.visible = on; r.scale.setScalar(0.3 + k * 4.5); r.material.opacity = (1 - k) * 0.55; }
  if (GUARD.model) { // distress: a jittery shake and anxious hops; calm: a gentle bob in the water
    const g = GUARD.model, base = walkH(g.position.x, g.position.z);
    if (on) { g.rotation.z = Math.sin(t * 23) * 0.05; GUARD.hop = Math.max(0, Math.sin(t * 3.1)) ** 6 * 0.18; g.position.y = base + GUARD.hop; }
    else { g.rotation.z = 0; g.position.y = base - 0.15 + Math.sin(t * 1.8) * 0.04; }
  }
  if (STREAM.k > 0.5 && !STREAM.fish.length && !STREAM.loading) { STREAM.loading = true; loadSpeciesModel('MAGIKARP').then(() => {
    STREAM.fish = [0, 1, 2].map(() => { const m = SPECIES.MAGIKARP.make(); m.scale.multiplyScalar(0.55); m.visible = false; scene.add(m); return { m, wait: rr(1, 5), t: -1 }; }); }); }
  for (const f of STREAM.fish) { // now and then one leaps in an arc somewhere on the town's stretch of the stream
    if (f.t < 0) { if ((f.wait -= dt) > 0) continue; const i = Math.floor(rr(14, RV.length - 14)), p = RV[i], q = RV[i + 1];
      Object.assign(f, { t: 0, x: p[0], z: p[1], y: p[2], dir: Math.atan2(q[0] - p[0], q[1] - p[1]) }); f.m.visible = true; }
    f.t += dt / 0.9; const k = Math.min(1, f.t);
    f.m.position.set(f.x + Math.sin(f.dir) * (k - 0.5) * 1.2, f.y - 0.2 + Math.sin(k * Math.PI) * 1.1, f.z + Math.cos(f.dir) * (k - 0.5) * 1.2);
    f.m.rotation.set(Math.cos(k * Math.PI) * 0.9, f.dir, 0);
    if (k >= 1) { f.t = -1; f.wait = rr(2, 6); f.m.visible = false; }
  }
}
const AMB = {}; // ambient sound: the brook near the restored stream, the device's hum near the clearing
function ambientTick() {
  if (!AC || !BUF) return; // no audio until the first sound (a user gesture) starts the context
  if (!AMB.brook) {
    const src = AC.createBufferSource(); src.buffer = BUF.white; src.loop = true;
    const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.6;
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    AMB.brook = AC.createGain(); AMB.brook.gain.value = 0; src.connect(bp).connect(lp).connect(AMB.brook).connect(OUT); src.start();
    const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 196; const ol = AC.createBiquadFilter(); ol.type = 'lowpass'; ol.frequency.value = 900;
    const trem = AC.createOscillator(); trem.frequency.value = 6; const tg = AC.createGain(); tg.gain.value = 0.5; trem.connect(tg);
    AMB.hum = AC.createGain(); AMB.hum.gain.value = 0; const am = AC.createGain(); am.gain.value = 0.5; tg.connect(am.gain);
    o.connect(ol).connect(am).connect(AMB.hum).connect(OUT); o.start(); trem.start();
  }
  const out = renderPass.scene !== scene || ui.pokedex || ui.quit, ri = riverInfo(P.pos.x, P.pos.z);
  const brook = out ? 0 : STREAM.k * 0.16 * clamp(1 - (ri.d - ri.hw) / 12, 0, 1);
  const hum = out || restored() ? 0 : 0.05 * clamp(1 - (Math.hypot(P.pos.x - DEV_AT[0], P.pos.z - DEV_AT[1]) - 2) / 14, 0, 1);
  AMB.brook.gain.setTargetAtTime(brook, AC.currentTime, 0.4); AMB.hum.gain.setTargetAtTime(hum, AC.currentTime, 0.4);
}

// butterflies & drifting pollen
const butterflies = [];
for (let i = 0; i < 10; i++) {
  const b = new THREE.Group(), col = pick(['#ffffff', '#ffe066', '#ffa94d', '#ffd6f0', '#9fd4ff']);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CircleGeometry(0.1, 8).translate(s * 0.09, 0, 0), mat(col, { side: THREE.DoubleSide, emissive: col, emissiveIntensity: 0.25 })); const p = new THREE.Group(); p.add(w); p.rotation.x = -Math.PI / 2; b.add(p); }
  const c = pick([[1000, 450], [900, 660], [1500, 610], [300, 420], [760, 700], [1100, 480]]), [cx, cz] = I(c[0], c[1], 0);
  butterflies.push({ b, cx: cx + rr(-1.2, 1.2), cz: cz + rr(-1.2, 1.2), ph: rnd() * 10, sp: rr(0.35, 0.7) });
  scene.add(b);
}
const pollen = (() => {
  const n = 160, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) p.set([rr(-12, 12), rr(0.3, 3.5), rr(-9, 6)], i * 3);
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const tex = canvasTex(32, 32, (c) => { const gr = c.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(1, 'rgba(255,250,220,0)'); c.fillStyle = gr; c.fillRect(0, 0, 32, 32); });
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: tex, size: 0.09, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#fff6c8', opacity: 0.8 }));
  scene.add(pts); return pts;
})();
const splashes = [];
for (let i = 1; i < RV.length; i++) if (RV[i][2] - RV[i - 1][2] > 0.04 && RV[i - 1][2] < RV[i][2]) {
  // base of a cascade (downstream side)
  if (splashes.length && Math.hypot(splashes[splashes.length - 1].x - RV[i - 1][0], splashes[splashes.length - 1].z - RV[i - 1][1]) < 1) continue;
  const n = 46, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const s = { x: RV[i - 1][0], z: RV[i - 1][1], y: RV[i - 1][2], hw: RV[i - 1][3], g, seeds: Array.from({ length: n }, () => [rnd(), rnd(), rnd()]) };
  s.pts = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 0.07, transparent: true, opacity: 0.85, depthWrite: false })); scene.add(s.pts);
  splashes.push(s);
}

// other modules assign these through their setters (an imported binding is read-only)
function setTracked(v) { return (tracked = v); }
export { GUIDE, MARK_COL, QUEST_TALK, RIVAL_AT, SCRAPS, SIDE, STREAM, ambientTick, butterflies, markTick, nearestTarget, noteWild,
  placeRival, pollen, questList, questMarks, renderTracker, rivalNpc, rivalStarter, scrapsTalk, setTracked, spawnRival, splashes,
  streamTick, trackNext, tracked };
