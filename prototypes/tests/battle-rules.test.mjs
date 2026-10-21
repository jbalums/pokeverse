// Checks for prototypes/battle-rules.js. Run: node --test "prototypes/tests/*.test.mjs"
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EFF, MOVES, ailOf, freshStages, stageMul, accMul, clampStage, expAt, share, poisonDamage, rollSleep, paralysisStops, accuracyHits,
  speedOf, expYield, statsAt, typeEffect, damage, immune, movesFirst, escapes, catchRoll, wasted, foeMove,
} from '../battle-rules.js';

const seq = (...v) => () => (v.length ? v.shift() : 0.5); // scripted rng: these values in order, then 0.5
const mon = (o = {}) => ({ level: 5, maxHp: 20, hp: 20, atk: 10, def: 10, spa: 10, spd: 10, spe: 10, st: freshStages(), moves: [], ...o });
const TYPES = Object.keys(EFF);

test('move table: every move is well formed', () => {
  assert.ok(Object.keys(MOVES).length > 250);
  for (const [id, mv] of Object.entries(MOVES)) {
    assert.ok(TYPES.includes(mv.type), `${id} type ${mv.type}`);
    assert.ok(['phys', 'spec', 'status'].includes(mv.cat), `${id} cat`);
    assert.ok(mv.pp > 0 && Number.isInteger(mv.pp), `${id} pp`);
    assert.equal(mv.cat === 'status', mv.power === undefined, `${id}: only status moves have no power`);
    if (mv.stat) assert.ok(mv.stat.length === 3 && Number.isInteger(mv.stat[1]) && ['self', 'foe'].includes(mv.stat[2]), `${id} stat`);
  }
  assert.equal(MOVES.DOUBLE_EDGE.name, 'Double-Edge');
  assert.deepEqual(MOVES.SWORDS_DANCE.stat, ['atk', 2, 'self']);
  assert.equal(MOVES.VENOSHOCK.x2, 'psn');
  assert.equal(MOVES.POISON_FANG.toxic, 1);
  assert.equal(ailOf(MOVES.THUNDER_SHOCK), 'par');
  assert.equal(ailOf(MOVES.TACKLE), undefined);
});

test('type chart', () => {
  assert.equal(typeEffect('WATER', ['FIRE']), 2);
  assert.equal(typeEffect('FIRE', ['GRASS', 'BUG']), 4);
  assert.equal(typeEffect('GRASS', ['GRASS', 'POISON']), 0.25);
  assert.equal(typeEffect('ELECTRIC', ['GROUND', 'FLYING']), 0);
  assert.equal(typeEffect('NORMAL', ['GHOST']), 0);
  assert.equal(typeEffect('FIRE', ['NORMAL']), 1);
  for (const row of Object.values(EFF)) for (const t of Object.keys(row)) assert.ok(TYPES.includes(t), t);
});

test('stats and experience', () => {
  assert.deepEqual(statsAt([35, 55, 40, 50, 50, 90], 5), { maxHp: 19, atk: 11, def: 9, spa: 10, spd: 10, spe: 14 }); // Pikachu Lv5
  assert.equal(statsAt([45, 49, 49, 65, 65, 45], 100).maxHp, 215); // Bulbasaur Lv100: (2*45 + 15) + 100 + 10
  assert.equal(expAt(5), 125);
  assert.equal(expYield(50, 3, false), 21); // Pidgey Lv3: 50*3/7
  assert.equal(expYield(50, 3, true), 32);
  assert.equal(expYield(1, 1, false), 1);
});

test('stat stages', () => {
  assert.equal(stageMul(0), 1); assert.equal(stageMul(2), 2); assert.equal(stageMul(-2), 0.5); assert.equal(stageMul(6), 4);
  assert.equal(accMul(-1), 0.75);
  assert.equal(clampStage(5, 2), 6); assert.equal(clampStage(-5, -2), -6); assert.equal(clampStage(0, -1), -1);
});

test('damage: formula, STAB, crit, immunity, Hex', () => {
  const att = mon({ atk: 11 }), def = mon({ def: 10 });
  // base = floor(floor(4 * 40 * 11 / 10) / 50) + 2 = 5; no crit (0.5), lowest roll (0) -> 0.85 * 5 = 4
  assert.deepEqual(damage(att, def, MOVES.TACKLE, ['ELECTRIC'], ['NORMAL'], seq(0.5, 0)), { dmg: 4, eff: 1, crit: false });
  assert.equal(damage(att, def, MOVES.TACKLE, ['NORMAL'], ['NORMAL'], seq(0.5, 0)).dmg, 6); // STAB: floor(5 * 1.5 * 0.85)
  const crit = damage(att, def, MOVES.TACKLE, ['ELECTRIC'], ['NORMAL'], seq(0, 0));
  assert.ok(crit.crit); assert.equal(crit.dmg, 6);
  assert.deepEqual(damage(att, def, MOVES.TACKLE, ['NORMAL'], ['GHOST'], seq(0.5, 0)), { dmg: 0, eff: 0, crit: false });
  const plain = damage(att, def, MOVES.HEX, ['NORMAL'], ['GRASS'], seq(0.5, 0.99)).dmg;
  const hexed = damage(att, { ...def, status: 'par' }, MOVES.HEX, ['NORMAL'], ['GRASS'], seq(0.5, 0.99)).dmg;
  assert.ok(hexed > plain * 1.5, `Hex doubles against a status: ${plain} -> ${hexed}`);
  assert.ok(damage(mon({ atk: 1 }), mon({ def: 999 }), MOVES.TACKLE, [], [], seq(0.5, 0)).dmg >= 1); // never 0 unless immune
  const boosted = damage(mon({ atk: 11, st: { ...freshStages(), atk: 2 } }), def, MOVES.TACKLE, [], ['NORMAL'], seq(0.5, 0)).dmg;
  assert.ok(boosted > 4, 'an Attack stage raises damage');
});

test('status immunities', () => {
  assert.ok(immune(['POISON'], 'psn', MOVES.TOXIC));
  assert.ok(immune(['STEEL'], 'psn', MOVES.POISON_STING));
  assert.ok(immune(['ELECTRIC'], 'par', MOVES.BODY_SLAM));
  assert.ok(immune(['GROUND'], 'par', MOVES.THUNDER_WAVE));
  assert.ok(!immune(['GROUND'], 'par', MOVES.BODY_SLAM), 'a Normal move can still paralyze a Ground type');
  assert.ok(immune(['GRASS'], 'slp', MOVES.SLEEP_POWDER));
  assert.ok(!immune(['GRASS'], 'slp', MOVES.HYPNOSIS));
});

test('rolls: accuracy, sleep, paralysis, poison', () => {
  assert.ok(accuracyHits(MOVES.SWIFT, -6, seq(0.99)), 'never-miss move');
  assert.ok(accuracyHits(MOVES.TACKLE, 0, seq(0.99)));
  assert.ok(!accuracyHits(MOVES.TACKLE, -1, seq(0.8)), 'Sand Attack: 100 -> 75');
  assert.ok(accuracyHits(MOVES.TACKLE, -1, seq(0.74)));
  assert.equal(rollSleep(seq(0)), 1); assert.equal(rollSleep(seq(0.999)), 3);
  assert.ok(paralysisStops(seq(0.2))); assert.ok(!paralysisStops(seq(0.3)));
  assert.equal(poisonDamage(20, 0), 2); // 1/8
  assert.equal(poisonDamage(32, 1), 2); // bad poison, turn 1: 1/16
  assert.equal(poisonDamage(32, 3), 6);
  assert.equal(poisonDamage(32, 40), 30); // capped at 15/16
  assert.equal(poisonDamage(5, 0), 1); // at least 1
  assert.equal(share(3, 0.5), 1); assert.equal(share(100, 0.33), 33);
});

test('turn order and running', () => {
  const fast = mon({ spe: 20 }), slow = mon({ spe: 10 });
  assert.ok(movesFirst(fast, slow, MOVES.TACKLE, MOVES.TACKLE, seq()));
  assert.ok(!movesFirst(slow, fast, MOVES.TACKLE, MOVES.TACKLE, seq()));
  assert.ok(movesFirst(slow, fast, MOVES.QUICK_ATTACK, MOVES.TACKLE, seq()), 'priority beats Speed');
  assert.ok(!movesFirst({ ...fast, status: 'par', spe: 15 }, slow, MOVES.TACKLE, MOVES.TACKLE, seq()), 'paralysis halves Speed');
  assert.equal(speedOf(mon({ spe: 10, st: { ...freshStages(), spe: 2 } })), 20);
  assert.ok(movesFirst(slow, mon({ spe: 10 }), MOVES.TACKLE, MOVES.TACKLE, seq(0.4)), 'a Speed tie is a coin flip');
  assert.ok(escapes(10, 10, 1, seq(0.99)), 'as fast or faster always escapes');
  assert.ok(!escapes(5, 20, 1, seq(0.99)));
  assert.ok(escapes(5, 20, 1, seq(0.1)));
});

test('catching', () => {
  const full = mon({ maxHp: 30, hp: 30 });
  const r = catchRoll(full, 255, 1, seq(0.3, 0));
  assert.ok(Math.abs(r.odds - 1 / 3) < 1e-9); assert.ok(r.caught); assert.equal(r.shakes, 3);
  const miss = catchRoll(full, 255, 1, seq(0.9, 0.99));
  assert.ok(!miss.caught); assert.ok(miss.shakes <= 2);
  assert.ok(catchRoll({ ...full, status: 'slp' }, 255, 1, seq(0.9)).odds > 0.8, 'sleep x2.5');
  assert.ok(catchRoll(mon({ maxHp: 30, hp: 1 }), 45, 1.5, seq(0.9)).odds > catchRoll(full, 45, 1, seq(0.9)).odds * 2.5, 'low HP and a Great Ball help');
});

test('foe AI skips wasted moves', () => {
  const foe = mon({ moves: [{ id: 'SLEEP_POWDER', pp: 15 }, { id: 'TACKLE', pp: 35 }] });
  assert.ok(wasted(MOVES.SLEEP_POWDER, foe, mon({ status: 'par' }), ['NORMAL']));
  assert.ok(wasted(MOVES.SLEEP_POWDER, foe, mon(), ['GRASS']));
  assert.ok(!wasted(MOVES.SLEEP_POWDER, foe, mon(), ['NORMAL']));
  assert.ok(wasted(MOVES.RECOVER, foe, mon(), []), 'no healing at full HP');
  assert.ok(!wasted(MOVES.RECOVER, { ...foe, hp: 5 }, mon(), []));
  assert.ok(wasted(MOVES.DREAM_EATER, foe, mon(), []));
  for (const r of [0, 0.5, 0.99]) assert.equal(foeMove(foe, mon({ status: 'slp' }), ['NORMAL'], seq(r)), 'TACKLE');
  assert.equal(foeMove(mon({ moves: [{ id: 'EMBER', pp: 0 }] }), mon(), [], seq()), 'TACKLE', 'no PP left: Tackle');
  assert.equal(foeMove(mon({ moves: [{ id: 'RECOVER', pp: 5 }] }), mon(), [], seq()), 'RECOVER', 'only wasted moves: still uses one');
});
