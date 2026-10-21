import './26-key-bindings.js'; // first: the modules run in file-number order (see main.js)
import { makeBulbasaur, makeCharmander, makePikachu } from './19-characters.js';
import { makeCaterpie, makeOddish, makePidgey, makeRattata, makeWeedle } from './33-wild-pokemon-models.js';

// ============================================================ Pokémon data (simplified Gen-style rules)
const TYPE_COL = { NORMAL: '#a8a77a', FIRE: '#ee8130', GRASS: '#6fbf45', ELECTRIC: '#e8b80e', FLYING: '#9a7fe8', BUG: '#94a817', POISON: '#a33ea1', GROUND: '#d4a84a',
  WATER: '#4f8ef0', ICE: '#78d4d2', ROCK: '#b6a136', PSYCHIC: '#f95587', GHOST: '#735797', DRAGON: '#6f35fc', DARK: '#705746', STEEL: '#9fa0b8', FAIRY: '#e48fd8', FIGHTING: '#c22e28' };
// status conditions: [badge, colour, "is ___", what the inflicting line says]. A condition stays after the battle (saved with the
// Pokémon) until a cure item, the Pokémon Center or fainting clears it
const STATUS = { psn: ['PSN', '#a65ac8', 'poisoned', 'was poisoned!'], par: ['PAR', '#d9a514', 'paralyzed', 'is paralyzed! It may be unable to move!'], slp: ['SLP', '#7d8798', 'asleep', 'fell asleep!'] };
const typesOf = m => SPECIES[m.key].types;
// base stats: HP, Atk, Def, SpA, SpD, Spe
const SPECIES = {
  PIKACHU: { name: 'PIKACHU', types: ['ELECTRIC'], base: [35, 55, 40, 50, 50, 90], learn: '1 THUNDER_SHOCK 1 GROWL 1 TAIL_WHIP 1 QUICK_ATTACK 12 ELECTRO_BALL 16 FEINT 20 SPARK 24 AGILITY 28 IRON_TAIL 32 DISCHARGE 36 THUNDERBOLT 44 THUNDER', exp: 112, rate: 190, gr: 4, make: makePikachu, face: 0.82, scale: 1 },
  BULBASAUR: { name: 'BULBASAUR', types: ['GRASS', 'POISON'], base: [45, 49, 49, 65, 65, 45], learn: '1 TACKLE 1 GROWL 1 ABSORB 3 VINE_WHIP 6 GROWTH 12 RAZOR_LEAF 18 SEED_BOMB 21 TAKE_DOWN 27 SYNTHESIS 33 POWER_WHIP 36 SOLAR_BEAM', exp: 64, rate: 45, gr: 1, make: makeBulbasaur, face: 0.62, scale: 1 },
  CHARMANDER: { name: 'CHARMANDER', types: ['FIRE'], base: [39, 52, 43, 60, 50, 65], learn: '1 SCRATCH 1 GROWL 4 EMBER 8 SMOKESCREEN 12 DRAGON_BREATH 17 FIRE_FANG 20 SLASH 24 FLAMETHROWER 28 SCARY_FACE 32 FIRE_SPIN 40 FLARE_BLITZ', exp: 62, rate: 45, gr: 1, make: makeCharmander, face: 0.92, scale: 1 },
  PIDGEY: { name: 'PIDGEY', types: ['NORMAL', 'FLYING'], base: [40, 45, 40, 35, 35, 56], learn: '1 TACKLE 5 SAND_ATTACK 9 GUST 13 QUICK_ATTACK 21 TWISTER 25 FEATHER_DANCE 29 AGILITY 33 WING_ATTACK 37 ROOST 45 AIR_SLASH 49 HURRICANE', exp: 50, rate: 255, gr: 4, make: makePidgey, face: 0.8, scale: 1.1 },
  RATTATA: { name: 'RATTATA', types: ['NORMAL'], base: [30, 56, 35, 25, 35, 72], learn: '1 TACKLE 1 TAIL_WHIP 4 QUICK_ATTACK 10 BITE 16 TAKE_DOWN 19 ASSURANCE 22 CRUNCH 25 SUCKER_PUNCH 31 DOUBLE_EDGE', exp: 51, rate: 255, gr: 4, make: makeRattata, face: 0.52, scale: 1.1 },
  CATERPIE: { name: 'CATERPIE', types: ['BUG'], base: [45, 30, 35, 20, 20, 45], learn: '1 TACKLE 1 STRING_SHOT 9 BUG_BITE', exp: 39, rate: 255, gr: 4, make: makeCaterpie, face: 0.46, scale: 1.25 },
  WEEDLE: { name: 'WEEDLE', types: ['BUG', 'POISON'], base: [40, 35, 30, 20, 20, 50], learn: '1 POISON_STING 1 STRING_SHOT 9 BUG_BITE', exp: 39, rate: 255, gr: 4, make: makeWeedle, face: 0.46, scale: 1.25 },
  ODDISH: { name: 'ODDISH', types: ['GRASS', 'POISON'], base: [45, 50, 55, 75, 65, 30], learn: '1 ABSORB 1 GROWTH 4 ACID 12 MEGA_DRAIN 20 GIGA_DRAIN 28 MOONBLAST 36 MOONLIGHT 40 PETAL_DANCE', exp: 64, rate: 255, gr: 4, make: makeOddish, face: 0.5, scale: 1.15 },
};
const parseLearn = s => { const learn = []; s.split(' ').forEach((x, i, a) => i % 2 || learn.push([+x, a[i + 1]])); return learn; }; // '1 TACKLE 3 VINE_WHIP' -> [[1, 'TACKLE'], [3, 'VINE_WHIP']]
for (const sp of Object.values(SPECIES)) sp.learn = parseLearn(sp.learn);

export { SPECIES, STATUS, TYPE_COL, parseLearn, typesOf };
