import './39-evolution-scene.js'; // first: the modules run in file-number order (see main.js)
import { MOVES, cure, escapes, expYield, foeMove, freshStages, movesFirst, poisonDamage } from '../battle-rules.js';
import { V3, rnd, rr, squash } from './01-helpers.js';
import { BU } from './02-hero-camera.js';
import { PLAZA_H } from './05-paths-raised-plaza-stairs-tall-grass.js';
import { camera, renderPass, scene, uTime } from './06-renderer-scene-post.js';
import { _v, circles } from './12-batched-props.js';
import { PC } from './14-buildings.js';
import { P, PK, bulba, interactables, player, swing } from './19-characters.js';
import { renderObjective } from './20-story-chapter-1.js';
import { noteWild } from './21-side-quests.js';
import { $, keys, ui } from './25-input.js';
import { say, setMoveTarget } from './26-key-bindings.js';
import { SPECIES, STATUS, TYPE_COL, typesOf } from './27-pokemon-data.js';
import { aOr, bag, evoFor, healParty, makeMon, money, nm, party, setMoney } from './28-evolution-data.js';
import { loadGame, renderParty, saveGame } from './29-save.js';
import { ITEMS } from './30-backpack.js';
import { BT, B_CAM, B_FOE, B_LOOK, B_ME, buildArena, burst, dropModel, easeIO, fx, resizeBattle, spawnModel, tickFx, tween, wait,
  who } from './34-battle-tweens-effects-arena.js';
import { BM, bsay, bset, drawBoxes, menu, tickMsg } from './35-battle-hud-messages-menus.js';
import { faintAnim } from './36-battle-animations.js';
import { SND } from './37-battle-sound-effects.js';
import { gainExp, inflict, setHp, statusFx, useMove } from './38-battle-moves.js';
import { B_CATCH_CAM, B_CATCH_LOOK, _camLook, evolve, sendOut, throwBall, withdraw } from './39-evolution-scene.js';
import { setFirstFrame, setGrassDist } from './41-loop.js';
import { music } from './42-background-music.js';
import { SET } from './43-settings.js';

// ============================================================ battle: flow
function partyMenu(forced, any) { // any: the one already out can be picked too (an item's target)
  return menu(party.map((m, i) => ({
    label: nm(m), sub: `Lv${m.level} · HP ${m.hp}/${m.maxHp}${m.status ? ' · ' + STATUS[m.status][0] : ''}`, value: i,
    disabled: m.hp <= 0 || (!forced && !any && m === BT.me), color: m.hp <= 0 ? '#9aa3ab' : TYPE_COL[SPECIES[m.key].types[0]],
  })), { back: !forced, wide: party.length > 4 });
}
async function chooseAction() {
  const me = BT.me;
  for (;;) {
    bset(`What will ${nm(me)} do?`);
    const c = await menu([{ label: 'FIGHT', value: 'fight', color: '#e2473b' }, { label: 'BAG', value: 'bag', color: '#f2a516' }, { label: 'POKéMON', value: 'mon', color: '#3fae4a' }, { label: 'RUN', value: 'run', color: '#3f7fd8' }]);
    if (c === 'fight') {
      if (me.moves.every(x => x.pp <= 0)) return { kind: 'move', id: 'TACKLE' };
      let id = await menu([...me.moves.map(x => { const mv = MOVES[x.id]; return { label: mv.name, sub: `PP ${x.pp}/${mv.pp}`, tag: mv.type, color: TYPE_COL[mv.type], value: x.id, disabled: x.pp <= 0 }; }),
        { label: '★ Test all moves', sub: 'showcase effects', color: '#2a3540', value: 'TEST' }], { back: true, wide: true });
      if (id === 'TEST') id = await menu(Object.entries(MOVES).filter(([, mv]) => mv.show).map(([k, mv]) => ({ label: mv.name, tag: mv.type, color: TYPE_COL[mv.type], value: k })), { back: true, wide: true });
      if (id) return { kind: 'move', id };
    } else if (c === 'bag') {
      bset('Which item?'); // what the bag holds that works in battle: HP healers, status cures, Poké Balls
      const k = await menu(Object.keys(ITEMS).filter(k => bag[k] > 0 && (ITEMS[k].heal || ITEMS[k].cure || ITEMS[k].catch)).map(k => { const it = ITEMS[k];
        return { label: it.name, sub: `×${bag[k]}${it.heal ? ` · heals ${it.heal} HP` : it.cure ? ` · cures ${STATUS[it.cure][0]}` : ''}`, value: k, color: it.catch ? '#e2473b' : it.pocket === 'berries' ? '#3fae4a' : '#8a5cd0' }; }), { back: true, wide: true });
      if (k && ITEMS[k].catch) return { kind: 'ball', item: k };
      if (k) { // a medicine can go to any Pokémon in the party, not just the one out
        if (party.length < 2) return { kind: 'item', item: k, idx: 0 };
        bset(`Use the ${ITEMS[k].name} on which Pokémon?`);
        const i = await partyMenu(false, true);
        if (i !== null) return { kind: 'item', item: k, idx: i };
      }
    } else if (c === 'mon') {
      bset('Choose a Pokémon.');
      const i = await partyMenu(false);
      if (i !== null) return { kind: 'switch', idx: i };
    } else if (c === 'run') return { kind: 'run' };
  }
}
async function checkFaint() {
  if (BT.foe.hp <= 0) {
    const T = BT.opts.trainer, next = T?.team[++BT.foeIdx];
    await faintAnim(BT.foeModel); BT.foeModel = null; $('foeBox').classList.add('hide');
    const won = !next && party.some(m => m.hp > 0); // a recoil move can knock out both sides at once: no Pokémon left is still a loss
    if (won) music('victory');
    await bsay(`${who(BT.foe)} fainted!`);
    if (BT.me.hp > 0) await gainExp(BT.me, expYield(SPECIES[BT.foe.key].exp, BT.foe.level, !!T)); // none for one that fainted too (a level-up would revive it)
    if (next) await foeIn(next, `${T.name} sent out ${nm(next)}!`);
    else if (won) {
      if (T) await bsay(`You defeated ${T.name}!`);
      const prize = T ? T.prize : 20 * BT.foe.level; setMoney(Math.min(999999, money + prize)); // ponytail: flat wild-win prize
      await bsay(`You got ₽${prize.toLocaleString()} for winning!`);
      return 'won';
    }
    if (BT.me.hp > 0) return null;
  }
  if (BT.me.hp <= 0) {
    await faintAnim(BT.meModel); BT.meModel = null; $('meBox').classList.add('hide');
    await bsay(`${nm(BT.me)} fainted!`);
    if (!party.some(m => m.hp > 0)) { await bsay('You have no more Pokémon that can fight!'); await bsay('You blacked out!'); return 'blackout'; }
    bset('Choose a Pokémon to send out.');
    await sendOut(party[await partyMenu(true)]);
    return null;
  }
  return undefined;
}
// once both sides have acted, for each Pokémon still out (not one sent in for a fainted one): poison bites (1/8 of max HP, or
// 1/16 more each turn when badly poisoned), then a Yawn from last turn puts it to sleep
async function endOfTurn(out = [BT.me, BT.foe]) {
  for (const m of out) {
    if (m.hp <= 0 || (m !== BT.me && m !== BT.foe)) continue; // a fainted one may have been replaced already
    if (m.status === 'psn') {
      statusFx(m); const dmg = poisonDamage(m.maxHp, m.tox); if (m.tox) m.tox++; await setHp(m, m.hp - dmg);
      await bsay(`${who(m)} is hurt by poison!`);
      const r = await checkFaint(); if (r) return r;
      if (m.hp <= 0) continue;
    }
    if (m.yawn && !--m.yawn) { delete m.yawn; if (!m.status) await inflict(m, 'slp'); }
  }
  return null;
}
async function foeTurn(id) { const out = [BT.me, BT.foe]; await useMove(BT.foe, BT.me, id); return (await checkFaint()) || endOfTurn(out); }
async function doTurn(act) {
  const me = BT.me, foe = BT.foe;
  const foeId = foeMove(foe, me, typesOf(me), rnd);
  if (act.kind === 'run' && BT.opts.trainer) { await bsay("No! There's no running from a Trainer battle!"); return null; }
  if (act.kind === 'ball' && (BT.opts.trainer || BT.opts.noCatch)) { await bsay(BT.opts.trainer ? "The Trainer blocked the Ball! Don't be a thief!" : `${nm(BT.foe)} is too distressed to be caught!`); return null; }
  if (act.kind === 'run') {
    BT.tries++;
    if (escapes(me.spe, foe.spe, BT.tries, rnd)) { await bsay('Got away safely!'); return 'ran'; }
    await bsay("Can't escape!");
    return foeTurn(foeId);
  }
  if (act.kind === 'item') {
    const it = ITEMS[act.item], m = party[act.idx] ?? me;
    if (it.heal ? m.hp >= m.maxHp : m.status !== it.cure) { await bsay("It won't have any effect."); return null; }
    bag[act.item]--;
    await bsay(`You used ${aOr(it.name)} on ${nm(m)}.`);
    if (m === me) burst(BT.meModel.position.clone().add(new V3(0, 0.6, 0)), '#8dff9a', { n: 30, up: 2, grav: 1, speed: 1.2, life: 0.9 });
    if (it.heal) { await setHp(m, m.hp + it.heal); await bsay(`${nm(m)}'s HP was restored.`); }
    else { cure(m); SND.chime(); await bsay(`${nm(m)} is no longer ${STATUS[it.cure][2]}.`); }
    return foeTurn(foeId);
  }
  if (act.kind === 'ball') { bag[act.item]--; if (await throwBall(act.item)) { music('victory'); return 'caught'; } return foeTurn(foeId); }
  if (act.kind === 'switch') { await withdraw(); await sendOut(party[act.idx]); return foeTurn(foeId); }
  const mine = [me, foe, act.id], theirs = [foe, me, foeId], meFirst = movesFirst(me, foe, MOVES[act.id], MOVES[foeId], rnd);
  for (const [a, d, id] of meFirst ? [mine, theirs] : [theirs, mine]) {
    await useMove(a, d, id);
    const r = await checkFaint();
    if (r !== undefined) return r || endOfTurn([me, foe]); // null: a fainted Pokémon was replaced, and the turn still ends as usual
  }
  return endOfTurn([me, foe]);
}
async function foeIn(foe, text) { // the foe slides onto its platform from the right, then its box and the line appear
  foe.st = freshStages(); foe.disp = foe.hp; BT.foe = foe;
  BT.foeModel = spawnModel(foe, B_FOE, B_ME, 1.45);
  const x0 = B_FOE.x; BT.foeModel.position.x = x0 + 6;
  await tween(0.9, t => (BT.foeModel.position.x = x0 + 6 * (1 - easeIO(t))));
  $('foeBox').classList.remove('hide');
  await bsay(text);
}
// opts.trainer = { name, team: [[key, level], ...], prize }: no running or catching; key / level are ignored and the team comes out in order
async function startBattle(key, level, opts = {}) {
  if (BT.active || ui.menu || ui.bag || ui.shop || ui.pokedex || ui.quit || !party.some(m => m.hp > 0)) return; // never under another screen (a step still coasting in tall grass after opening the bag started one behind it)
  if (opts.trainer) opts = { ...opts, trainer: { ...opts.trainer, team: opts.trainer.team.map(([k, l, mv]) => { // makeMon starts every model loading now
    const m = makeMon(k, l); if (mv) m.moves = mv.map(id => ({ id, pp: MOVES[id].pp })); return m; }) } }; // [key, level, moves?]: a fixed moveset overrides the learnset
  Object.assign(BT, { active: true, opts, tries: 0, zoom: 0, stop: 0, evoQueue: new Set(), foeIdx: 0 });
  music(opts.trainer ? 'trainer' : 'battle');
  ui.battle = true; keys.clear(); setMoveTarget(null); P.v = 0;
  $('btrans').className = 'btrans ' + (SET.calm ? 'fade' : 'flash');
  await wait(1.1);
  if (!BT.scene) buildArena();
  resizeBattle();
  const T = opts.trainer, foe = T ? T.team[0] : makeMon(key, level);
  if (!T) noteWild(key);
  BT.me = party.find(m => m.hp > 0); BT.me.disp = BT.me.hp; BT.me.expDisp = BT.me.exp;
  renderPass.scene = BT.scene; renderPass.camera = BT.cam;
  document.body.classList.add('in-battle'); $('meBox').classList.add('hide'); $('foeBox').classList.add('hide');
  bset('');
  $('btrans').className = 'btrans out';
  if (T) await bsay(opts.intro || `${T.name} wants to battle!`);
  await foeIn(foe, T ? `${T.name} sent out ${nm(foe)}!` : opts.intro || `A wild ${nm(foe)} appeared!`);
  await sendOut(BT.me);
  let result = null;
  while (!result) result = await doTurn(await chooseAction());
  if (result !== 'blackout') for (const m of BT.evoQueue) { const e = evoFor(m); if (e) await evolve(m, e); } // a cancelled one tries again at its next level-up
  await finishBattle(result);
}
async function finishBattle(result) {
  $('btrans').className = 'btrans fade';
  await wait(0.45);
  dropModel(BT.foeModel); dropModel(BT.meModel); BT.foeModel = BT.meModel = null;
  for (const m of [...party, BT.foe]) if (m) { delete m.tox; delete m.yawn; } // after the battle, bad poison is plain poison (a caught foe is in the party or the PC)
  while (fx.length) { const f = fx.pop(); BT.scene.remove(f.obj); }
  renderPass.scene = scene; renderPass.camera = camera;
  document.body.classList.remove('in-battle'); $('bmenu').innerHTML = ''; BM.res = null;
  BT.active = false; ui.battle = false; keys.clear(); setGrassDist(0);
  const lost = result === 'blackout' && BT.opts.onLose; // a story battle can catch the loss: heal in place and retry, no trip to the Pokémon Center
  if (lost) healParty();
  else if (result === 'blackout') {
    healParty();
    P.pos.set(PC.cx, PLAZA_H, PC.fz + 1.3); PK.pos.set(PC.cx + 0.7, PLAZA_H, PC.fz + 1.6); P.face = 0;
    player.root.position.copy(P.pos); setFirstFrame(true);
  }
  if (BT.opts.onWin && (result === 'won' || result === 'caught')) BT.opts.onWin();
  renderParty(); saveGame();
  $('btrans').className = 'btrans out';
  if (lost) BT.opts.onLose();
  else if (result === 'blackout') say('Nurse', ['You blacked out, so we brought you to the Pokémon Center.', 'Your Pokémon are fully healed. Take care out there!']);
}
function battleTick(dt, t) {
  uTime.value = t;
  tickMsg(dt); tickFx(dt); drawBoxes();
  BT.cam.position.set(B_CAM.x + Math.sin(t * 0.35) * 0.12, B_CAM.y + Math.sin(t * 0.27) * 0.05, B_CAM.z).lerp(B_CATCH_CAM, BT.zoom);
  if (BT.shakeLeft > 0) { // impact camera kick, fading out
    const a = BT.shake * (BT.shakeLeft / BT.shakeDur); BT.shakeLeft -= dt;
    BT.cam.position.add(_v.set(rr(-a, a), rr(-a, a), rr(-a, a) * 0.5));
  }
  BT.cam.lookAt(_camLook.copy(B_LOOK).lerp(B_CATCH_LOOK, BT.zoom));
  // hit-stop: the idle clock (and the model mixers, see frame()) hold still for a beat after a hit
  if (BT.stop > 0) BT.stop -= dt; else BT.idle = (BT.idle || 0) + dt;
  for (const m of [BT.foeModel, BT.meModel]) {
    if (!m) continue;
    const inner = m.userData.inner, u = inner.userData, k = BT.idle * 2.4 * m.userData.rate + m.userData.ph, w = 1 + (u.wag || 0);
    // breathing, plus a slow shift of weight from foot to foot; each battler has its own rate and phase, so they never sync
    const shift = Math.sin(k * 0.45);
    inner.position.set(shift * 0.02, u.flies ? 0.32 + Math.sin(k * 1.3) * 0.08 : 0, 0);
    inner.rotation.z = shift * 0.035;
    squash(inner, 1 + Math.sin(k * 1.7) * 0.02);
    if (u.wings) u.wings.forEach((g, i) => swing(g, (i ? -1 : 1) * (0.2 + Math.sin(BT.idle * 16 + m.userData.ph) * 0.6 * w)));
    if (u.tail) swing(u.tail, Math.sin(BT.idle * 6 + m.userData.ph) * 0.2 * w);
    if (u.flame) u.flame.scale.set(1 + Math.sin(t * 23) * 0.12, 1 + Math.sin(t * 17) * 0.2, 1);
    if (u.leaves) u.leaves.rotation.y = Math.sin(t * 1.5) * 0.15;
  }
}
function retireBulbasaur() {
  bulba.visible = false;
  const i = interactables.findIndex(it => it.name === 'Bulbasaur'); if (i >= 0) interactables.splice(i, 1);
  const c = circles.findIndex(o => o.x === BU[0] && o.z === BU[1]); if (c >= 0) circles.splice(c, 1);
}
loadGame();
renderParty(); renderObjective();

export { battleTick, finishBattle, retireBulbasaur, startBattle };
