import './37-battle-sound-effects.js'; // first: the modules run in file-number order (see main.js)
import { MOVES, accuracyHits, ailOf, clampStage, cure, damage as rollDamage, expAt, immune as immuneTo, paralysisStops, rollSleep,
  share, sideEffectLands } from '../battle-rules.js';
import { V3, clamp, rnd } from './01-helpers.js';
import { SPECIES, STATUS, TYPE_COL, typesOf } from './27-pokemon-data.js';
import { STAT_NAME, calcStats, evoFor, loadSpeciesModel, nm } from './28-evolution-data.js';
import { BT, MOVE_FX, burst, knock, modelOf, tween, wait, who } from './34-battle-tweens-effects-arena.js';
import { bsay, bset, menu } from './35-battle-hud-messages-menus.js';
import { hitAnim, hop, lunge, moveFx } from './36-battle-animations.js';
import { SND } from './37-battle-sound-effects.js';

// ============================================================ battle: rules
const damage = (att, def, mv) => rollDamage(att, def, mv, typesOf(att), typesOf(def), rnd);
async function setHp(m, v) {
  v = clamp(Math.round(v), 0, m.maxHp);
  const from = m.disp ?? m.hp; m.hp = v;
  if (!v) { cure(m); delete m.yawn; } // fainting clears a status condition
  await tween(0.5, t => (m.disp = from + (v - from) * t));
}
const immune = (m, s, mv) => immuneTo(typesOf(m), s, mv);
const STATUS_FX = { psn: () => SND.splat(0.7), par: () => SND.zap(0.3), slp: () => SND.psychic(0.9) };
function statusFx(m) { const tm = modelOf(m); STATUS_FX[m.status](); if (tm) burst(tm.position.clone().add(new V3(0, 0.6 * tm.userData.s, 0)), STATUS[m.status][1], { n: 26, up: 1, grav: 0.5, speed: 1, life: 0.8 }); }
async function inflict(m, s, tox) {
  m.status = s; if (s === 'slp') m.sleep = rollSleep(rnd);
  if (s === 'psn' && tox) m.tox = 1;
  statusFx(m); await wait(0.3);
  await bsay(`${who(m)} ${m.tox ? 'was badly poisoned!' : STATUS[s][3]}`);
}
async function canAct(m, mv) { // sleep and paralysis can stop a move before it starts (no PP is used); Snore still goes off in its sleep
  if (m.status === 'slp') {
    if (m.sleep > 0) { m.sleep--; statusFx(m); await bsay(`${who(m)} is fast asleep.`); return !!mv.snore; }
    cure(m); await bsay(`${who(m)} woke up!`);
  }
  if (m.status === 'par' && paralysisStops(rnd)) { statusFx(m); await bsay(`${who(m)} is paralyzed! It can't move!`); return false; }
  return true;
}
async function useMove(att, def, id) {
  const mv = MOVES[id];
  if (!await canAct(att, mv)) return;
  const slot = att.moves.find(x => x.id === id);
  if (slot && slot.pp > 0) slot.pp--;
  const am = modelOf(att), dm = modelOf(def), self = mv.heal || mv.stat?.[2] === 'self', target = self ? att : def;
  await bsay(`${who(att)} used ${mv.name}!`);
  if (mv.snore && att.status !== 'slp') return bsay('But it failed!'); // it woke up first
  if (mv.dream && def.status !== 'slp') return bsay(`It doesn't affect ${who(def)}...`);
  const missed = !self && !accuracyHits(mv, att.st.acc, rnd), show = MOVE_FX[id];
  if (missed || !show) await (mv.cat === 'phys' ? lunge(am, dm) : hop(am));
  if (missed) { SND.whoosh(0.3, 1.5, 0.3); return bsay(`${who(att)}'s attack missed!`); }
  if (mv.cat === 'status') {
    if (show) await show(am, dm);
    if (mv.heal) {
      if (att.hp >= att.maxHp) return bsay(`${who(att)}'s HP is full!`);
      SND.stat(true); await setHp(att, att.hp + share(att.maxHp, mv.heal));
      if (mv.rest) { cure(att); att.status = 'slp'; att.sleep = 2; statusFx(att); return bsay(`${who(att)} slept and became healthy!`); } // Rest also replaces any other condition
      return bsay(`${who(att)} regained health!`);
    }
    if (mv.yawn) {
      if (def.status || def.yawn) return bsay('But it failed!');
      def.yawn = 2; SND.psychic(0.5); return bsay(`${who(att)} made ${who(def)} drowsy!`); // see endOfTurn
    }
    const ail = mv.shift ? att.status : ailOf(mv);
    if (mv.shift && !ail) return bsay('But it failed!');
    if (ail) {
      if (immune(def, ail, mv)) return bsay(`It doesn't affect ${who(def)}...`);
      if (def.status) return bsay(def.status === ail ? `${who(def)} is already ${STATUS[ail][2]}!` : 'But it failed!');
      const tox = mv.toxic || (mv.shift && att.tox);
      if (mv.shift) cure(att);
      return inflict(def, ail, tox);
    }
    const [stat, delta] = mv.stat, cur = target.st[stat], next = clampStage(cur, delta), tm = modelOf(target);
    if (next === cur) return bsay(`${who(target)}'s ${STAT_NAME[stat]} won't go any ${delta > 0 ? 'higher' : 'lower'}!`);
    target.st[stat] = next; SND.stat(delta > 0);
    burst(tm.position.clone().add(new V3(0, 0.6 * tm.userData.s, 0)), delta > 0 ? '#ff6a5a' : '#5aa8ff', { n: 32, up: delta > 0 ? 2 : -0.5, grav: delta > 0 ? 1.5 : -2.5, speed: 1.2, life: 0.9 });
    await wait(0.45);
    return bsay(`${who(target)}'s ${STAT_NAME[stat]} ${delta > 0 ? 'rose' : delta < -1 ? 'harshly fell' : 'fell'}!`);
  }
  if (show) await show(am, dm); else { SND.hit(); moveFx(mv, am, dm); }
  const r = damage(att, def, mv);
  if (!r.eff) return bsay(`It doesn't affect ${who(def)}...`); // a type immunity: no hit, no "critical hit", no side effect
  if (mv.spare) r.dmg = Math.min(r.dmg, def.hp - 1); // False Swipe: for catching
  if (!show) knock(dm); // MOVE_FX already knocked the defender back on its impact beat
  await hitAnim(dm, r.crit || r.eff > 1 ? 1.7 : r.eff < 1 ? 0.6 : 1);
  await setHp(def, def.hp - r.dmg);
  if (r.crit) await bsay('A critical hit!');
  if (r.eff > 1) await bsay("It's super effective!");
  else if (r.eff < 1) await bsay("It's not very effective...");
  const ail = ailOf(mv);
  if (ail && r.dmg > 0 && def.hp > 0 && !def.status && !immune(def, ail, mv) && sideEffectLands(mv, ail, rnd)) await inflict(def, ail, mv.toxic);
  if (mv.drain && att.hp < att.maxHp && r.dmg > 0) { await setHp(att, att.hp + share(r.dmg, mv.drain)); await bsay(mv.dream ? `${who(def)}'s dream was eaten!` : `${who(def)} had its energy drained!`); }
  if (mv.recoil && r.dmg > 0) { await setHp(att, att.hp - share(r.dmg, mv.recoil)); await bsay(`${who(att)} was damaged by the recoil!`); }
}
async function gainExp(m, amt) {
  await bsay(`${nm(m)} gained ${amt} Exp. Points!`);
  const target = m.exp + amt;
  for (;;) {
    const next = expAt(m.level + 1), to = Math.min(target, next), from = m.expDisp;
    await tween(0.6, t => (m.expDisp = from + (to - from) * t));
    m.exp = to;
    if (m.exp < next || m.level >= 100) break;
    m.level++;
    const old = m.maxHp; calcStats(m); m.hp += m.maxHp - old; m.disp = m.hp; m.expDisp = m.exp;
    burst(BT.meModel.position.clone().add(new V3(0, 0.8, 0)), '#ffe066', { n: 40, up: 2, grav: 1, speed: 1.6, life: 1 });
    await bsay(`${nm(m)} grew to Lv. ${m.level}!`);
    for (const [l, id] of SPECIES[m.key].learn ?? []) if (l === m.level && MOVES[id] && !m.moves.some(x => x.id === id)) await learnMove(m, id); // the learnset's move for this level
    const evo = evoFor(m); if (evo) { BT.evoQueue.add(m); loadSpeciesModel(evo.to); } // evolves once the battle is over
    if (m.exp >= target) break;
  }
}
async function learnMove(m, id) {
  const mv = MOVES[id];
  if (m.moves.length < 4) { m.moves.push({ id, pp: mv.pp }); SND.chime(); return bsay(`${nm(m)} learned ${mv.name}!`); }
  await bsay(`${nm(m)} wants to learn ${mv.name}. But ${nm(m)} can't learn more than four moves.`);
  bset(`Forget which move to learn ${mv.name}?`);
  const i = await menu([...m.moves.map((x, k) => { const o = MOVES[x.id]; return { label: o.name, sub: `PP ${x.pp}/${o.pp}`, tag: o.type, color: TYPE_COL[o.type], value: k }; }),
    { label: `Don't learn ${mv.name}`, color: '#2a3540', value: -1 }], { wide: true });
  if (i === -1) return bsay(`${nm(m)} did not learn ${mv.name}.`);
  const old = MOVES[m.moves[i].id].name; m.moves[i] = { id, pp: mv.pp }; SND.chime();
  await bsay(`1, 2 and... Poof! ${nm(m)} forgot ${old}... and learned ${mv.name}!`);
}

export { gainExp, inflict, learnMove, setHp, statusFx, useMove };
