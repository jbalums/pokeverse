// Verdant Town battle rules: the type chart, the move table and the formulas, with no DOM, three.js or page state.
// The page (verdant-town-3d.html) animates and narrates what these decide; prototypes/tests/battle-rules.test.mjs checks them
// with `node --test "prototypes/tests/*.test.mjs"`. Every roll takes an rng (() => number in [0, 1)) so the page passes its seeded rnd() and
// tests pass a scripted one.

export const EFF = { // attacking type -> defending type -> multiplier (the main matchups; everything else is neutral)
  ELECTRIC: { FLYING: 2, WATER: 2, GRASS: 0.5, ELECTRIC: 0.5, DRAGON: 0.5, GROUND: 0 },
  FIRE: { GRASS: 2, BUG: 2, ICE: 2, STEEL: 2, FIRE: 0.5, WATER: 0.5, ROCK: 0.5, DRAGON: 0.5 },
  GRASS: { WATER: 2, GROUND: 2, ROCK: 2, GRASS: 0.5, POISON: 0.5, FLYING: 0.5, BUG: 0.5, FIRE: 0.5, DRAGON: 0.5, STEEL: 0.5 },
  FLYING: { GRASS: 2, BUG: 2, FIGHTING: 2, ELECTRIC: 0.5, ROCK: 0.5, STEEL: 0.5 },
  POISON: { GRASS: 2, FAIRY: 2, POISON: 0.5, GROUND: 0.5, ROCK: 0.5, GHOST: 0.5, STEEL: 0 },
  BUG: { GRASS: 2, PSYCHIC: 2, DARK: 2, POISON: 0.5, FIRE: 0.5, FLYING: 0.5, FIGHTING: 0.5, GHOST: 0.5, STEEL: 0.5, FAIRY: 0.5 },
  WATER: { FIRE: 2, GROUND: 2, ROCK: 2, WATER: 0.5, GRASS: 0.5, DRAGON: 0.5 },
  ICE: { GRASS: 2, GROUND: 2, FLYING: 2, DRAGON: 2, FIRE: 0.5, WATER: 0.5, ICE: 0.5, STEEL: 0.5 },
  ROCK: { FIRE: 2, ICE: 2, FLYING: 2, BUG: 2, FIGHTING: 0.5, GROUND: 0.5, STEEL: 0.5 },
  GROUND: { FIRE: 2, ELECTRIC: 2, POISON: 2, ROCK: 2, STEEL: 2, GRASS: 0.5, BUG: 0.5, FLYING: 0 },
  PSYCHIC: { FIGHTING: 2, POISON: 2, PSYCHIC: 0.5, STEEL: 0.5, DARK: 0 },
  GHOST: { GHOST: 2, PSYCHIC: 2, DARK: 0.5, NORMAL: 0 },
  DRAGON: { DRAGON: 2, STEEL: 0.5, FAIRY: 0 },
  DARK: { GHOST: 2, PSYCHIC: 2, FIGHTING: 0.5, DARK: 0.5, FAIRY: 0.5 },
  STEEL: { ICE: 2, ROCK: 2, FAIRY: 2, FIRE: 0.5, WATER: 0.5, ELECTRIC: 0.5, STEEL: 0.5 },
  FAIRY: { FIGHTING: 2, DRAGON: 2, DARK: 2, FIRE: 0.5, POISON: 0.5, STEEL: 0.5 },
  FIGHTING: { NORMAL: 2, ICE: 2, ROCK: 2, DARK: 2, STEEL: 2, POISON: 0.5, FLYING: 0.5, PSYCHIC: 0.5, BUG: 0.5, FAIRY: 0.5, GHOST: 0 },
  NORMAL: { ROCK: 0.5, STEEL: 0.5, GHOST: 0 },
};
export const MOVES = {
  TACKLE: { name: 'Tackle', type: 'NORMAL', power: 40, acc: 100, pp: 35, cat: 'phys' },
  SCRATCH: { name: 'Scratch', type: 'NORMAL', power: 40, acc: 100, pp: 35, cat: 'phys' },
  QUICK_ATTACK: { name: 'Quick Attack', type: 'NORMAL', power: 40, acc: 100, pp: 30, cat: 'phys', prio: 1 },
  THUNDER_SHOCK: { name: 'Thunder Shock', type: 'ELECTRIC', power: 40, acc: 100, pp: 30, cat: 'spec', par: 10 },
  EMBER: { name: 'Ember', type: 'FIRE', power: 40, acc: 100, pp: 25, cat: 'spec' },
  VINE_WHIP: { name: 'Vine Whip', type: 'GRASS', power: 45, acc: 100, pp: 25, cat: 'phys' },
  ABSORB: { name: 'Absorb', type: 'GRASS', power: 20, acc: 100, pp: 25, cat: 'spec', drain: 0.5 },
  GUST: { name: 'Gust', type: 'FLYING', power: 40, acc: 100, pp: 35, cat: 'spec' },
  POISON_STING: { name: 'Poison Sting', type: 'POISON', power: 15, acc: 100, pp: 35, cat: 'phys', psn: 30 },
  ACID: { name: 'Acid', type: 'POISON', power: 40, acc: 100, pp: 30, cat: 'spec' },
  GROWL: { name: 'Growl', type: 'NORMAL', acc: 100, pp: 40, cat: 'status', stat: ['atk', -1, 'foe'] },
  TAIL_WHIP: { name: 'Tail Whip', type: 'NORMAL', acc: 100, pp: 30, cat: 'status', stat: ['def', -1, 'foe'] },
  STRING_SHOT: { name: 'String Shot', type: 'BUG', acc: 95, pp: 40, cat: 'status', stat: ['spe', -2, 'foe'] },
  SAND_ATTACK: { name: 'Sand Attack', type: 'GROUND', acc: 100, pp: 15, cat: 'status', stat: ['acc', -1, 'foe'] },
  SMOKESCREEN: { name: 'Smokescreen', type: 'NORMAL', acc: 100, pp: 20, cat: 'status', stat: ['acc', -1, 'foe'] },
  GROWTH: { name: 'Growth', type: 'NORMAL', pp: 20, cat: 'status', stat: ['spa', 1, 'self'] },
  // showcase moves: one or two per type, usable from FIGHT → "★ Test all moves" (some are in learnsets too)
  FLAMETHROWER: { name: 'Flamethrower', type: 'FIRE', power: 90, acc: 100, pp: 15, cat: 'spec', show: 1 },
  THUNDERBOLT: { name: 'Thunderbolt', type: 'ELECTRIC', power: 90, acc: 100, pp: 15, cat: 'spec', show: 1, par: 10 },
  WATER_GUN: { name: 'Water Gun', type: 'WATER', power: 40, acc: 100, pp: 25, cat: 'spec', show: 1 },
  HYDRO_PUMP: { name: 'Hydro Pump', type: 'WATER', power: 110, acc: 80, pp: 5, cat: 'spec', show: 1 },
  ICE_BEAM: { name: 'Ice Beam', type: 'ICE', power: 90, acc: 100, pp: 10, cat: 'spec', show: 1 },
  SOLAR_BEAM: { name: 'Solar Beam', type: 'GRASS', power: 120, acc: 100, pp: 10, cat: 'spec', show: 1 },
  RAZOR_LEAF: { name: 'Razor Leaf', type: 'GRASS', power: 55, acc: 95, pp: 25, cat: 'phys', show: 1 },
  ROCK_SLIDE: { name: 'Rock Slide', type: 'ROCK', power: 75, acc: 90, pp: 10, cat: 'phys', show: 1 },
  EARTHQUAKE: { name: 'Earthquake', type: 'GROUND', power: 100, acc: 100, pp: 10, cat: 'phys', show: 1 },
  PSYCHIC: { name: 'Psychic', type: 'PSYCHIC', power: 90, acc: 100, pp: 10, cat: 'spec', show: 1 },
  SHADOW_BALL: { name: 'Shadow Ball', type: 'GHOST', power: 80, acc: 100, pp: 15, cat: 'spec', show: 1 },
  DRAGON_BREATH: { name: 'Dragon Breath', type: 'DRAGON', power: 60, acc: 100, pp: 20, cat: 'spec', show: 1, par: 30 },
  DARK_PULSE: { name: 'Dark Pulse', type: 'DARK', power: 80, acc: 100, pp: 15, cat: 'spec', show: 1 },
  FLASH_CANNON: { name: 'Flash Cannon', type: 'STEEL', power: 80, acc: 100, pp: 10, cat: 'spec', show: 1 },
  MOONBLAST: { name: 'Moonblast', type: 'FAIRY', power: 95, acc: 100, pp: 15, cat: 'spec', show: 1 },
  KARATE_CHOP: { name: 'Karate Chop', type: 'FIGHTING', power: 50, acc: 100, pp: 25, cat: 'phys', show: 1 },
  AIR_SLASH: { name: 'Air Slash', type: 'FLYING', power: 75, acc: 95, pp: 15, cat: 'spec', show: 1 },
  SLUDGE_BOMB: { name: 'Sludge Bomb', type: 'POISON', power: 90, acc: 100, pp: 10, cat: 'spec', show: 1, psn: 30 },
  BUG_BUZZ: { name: 'Bug Buzz', type: 'BUG', power: 90, acc: 100, pp: 10, cat: 'spec', show: 1 },
  HYPER_BEAM: { name: 'Hyper Beam', type: 'NORMAL', power: 150, acc: 90, pp: 5, cat: 'spec', show: 1 },
};
// Learnset moves, one per line: ID TYPE power accuracy PP category [extras]. "-" accuracy never misses; "-" power is a status move.
// Extras: prio=N, drain=F (heals that share of the damage), recoil=F (hurts the user by that share), heal=F (of max HP),
// spare (leaves the foe at 1 HP), stat=STAT:DELTA:self|foe, psn= / par= / slp=N (N% chance to poison, paralyse or put the foe to
// sleep; a status move always does it once it hits), toxic (the poison is bad: 1/16 more damage every turn), powder (Grass types
// are immune), x2=psn|any (double power against a foe with that status), rest (Rest: full heal, then sleep two turns), yawn (the
// foe falls asleep at the end of the next turn), shift (Psycho Shift: passes the user's condition to the foe), dream (fails unless
// the foe is asleep), snore (usable only while asleep). Simplified Gen rules: multi-hit moves are one hit of their usual total, and
// side effects the battle system doesn't have (burns, freezing, flinching, two-turn charging, weather) are left out; moves that are
// nothing but such an effect aren't listed, so the learnsets skip them.
const MOVE_LIST = `BITE DARK 60 100 25 phys
SLASH NORMAL 70 100 20 phys
WATER_PULSE WATER 60 100 20 spec
CRUNCH DARK 80 100 15 phys
BODY_SLAM NORMAL 85 100 15 phys par=30
AERIAL_ACE FLYING 60 - 20 phys
FURY_CUTTER BUG 40 95 20 phys
MUD_SHOT GROUND 55 95 15 spec
CONFUSION PSYCHIC 50 100 25 spec
FLAME_CHARGE FIRE 50 100 20 phys
LEAF_BLADE GRASS 90 100 15 phys
HURRICANE FLYING 110 70 10 spec
DOUBLE_KICK FIGHTING 60 100 30 phys
DOUBLE_HIT NORMAL 70 90 10 phys
DRAGON_PULSE DRAGON 85 100 10 spec
FURY_ATTACK NORMAL 45 85 20 phys
PETAL_DANCE GRASS 120 100 10 spec
AIR_CUTTER FLYING 60 95 25 spec
NIGHT_SLASH DARK 70 100 15 phys
LEAF_STORM GRASS 130 90 5 spec
ICY_WIND ICE 55 95 15 spec
PETAL_BLIZZARD GRASS 90 100 15 phys
METAL_CLAW STEEL 50 95 35 phys
SUPERPOWER FIGHTING 120 100 5 phys
MEGAHORN BUG 120 85 10 phys
HAMMER_ARM FIGHTING 100 90 10 phys
SAND_TOMB GROUND 35 85 15 phys
STOMP NORMAL 65 100 20 phys
TRI_ATTACK NORMAL 80 100 10 spec par=7
ACID_SPRAY POISON 40 100 20 spec
POWER_GEM ROCK 80 100 20 spec
HEX GHOST 65 100 10 spec x2=any
ICICLE_SPEAR ICE 75 100 30 phys
THUNDER_PUNCH ELECTRIC 75 100 15 phys par=10
EXTREME_SPEED NORMAL 80 100 5 phys prio=2
BLAZE_KICK FIRE 85 90 10 phys
MYSTICAL_FIRE FIRE 75 100 10 spec
ARM_THRUST FIGHTING 45 100 20 phys
DYNAMIC_PUNCH FIGHTING 100 50 5 phys
SNARL DARK 55 95 15 spec
DAZZLING_GLEAM FAIRY 80 100 10 spec
WATER_SHURIKEN WATER 45 100 20 spec prio=1
TAKE_DOWN NORMAL 90 85 20 phys recoil=0.25
DOUBLE_EDGE NORMAL 120 100 15 phys recoil=0.33
FURY_SWIPES NORMAL 55 80 15 phys
ROLLOUT ROCK 30 90 20 phys
GIGA_DRAIN GRASS 75 100 10 spec drain=0.5
BULLDOZE GROUND 60 100 20 phys
POUND NORMAL 40 100 35 phys
MEGA_DRAIN GRASS 40 100 15 spec drain=0.5
HEADBUTT NORMAL 70 100 15 phys
SWIFT NORMAL 60 - 20 spec
MUD_SLAP GROUND 20 100 10 spec
BRINE WATER 65 100 10 spec
FLARE_BLITZ FIRE 120 100 15 phys recoil=0.33
PECK FLYING 35 100 35 phys
WRAP NORMAL 15 90 20 phys
ICE_FANG ICE 65 95 15 phys
PLAY_ROUGH FAIRY 90 90 10 phys
BUBBLE_BEAM WATER 65 100 20 spec
FIRE_FANG FIRE 65 95 15 phys
PSYBEAM PSYCHIC 65 100 20 spec
COVET NORMAL 60 100 25 phys
ASTONISH GHOST 30 100 15 phys
RETALIATE NORMAL 70 100 5 phys
SMACK_DOWN ROCK 50 100 15 phys
DISCHARGE ELECTRIC 80 100 15 spec par=30
EARTH_POWER GROUND 90 100 10 spec
AQUA_JET WATER 40 100 20 phys prio=1
DIG GROUND 80 100 10 phys
RAPID_SPIN NORMAL 50 100 40 phys
POISON_JAB POISON 80 100 20 phys psn=30
MAGICAL_LEAF GRASS 60 - 20 spec
SEED_BOMB GRASS 80 100 15 phys
PIN_MISSILE BUG 75 95 20 phys
WING_ATTACK FLYING 60 100 35 phys
GYRO_BALL STEEL 60 100 5 phys
HYPER_VOICE NORMAL 90 100 10 spec
SURF WATER 90 100 15 spec
BUG_BITE BUG 60 100 20 phys
TWISTER DRAGON 40 100 20 spec
THUNDER_FANG ELECTRIC 65 95 15 phys par=10
FEINT NORMAL 30 100 10 phys prio=2
HORN_ATTACK NORMAL 65 100 25 phys
DISARMING_VOICE FAIRY 40 - 15 spec
ROCK_THROW ROCK 50 90 15 phys
DRAINING_KISS FAIRY 50 100 10 spec drain=0.75
PAYBACK DARK 50 100 10 phys
EXTRASENSORY PSYCHIC 80 100 20 spec
FAKE_OUT NORMAL 40 100 10 phys prio=3
FLAME_WHEEL FIRE 60 100 25 phys
ICE_SHARD ICE 40 100 30 phys prio=1
WHIRLPOOL WATER 35 85 15 spec
LICK GHOST 30 100 30 phys par=30
THUNDER ELECTRIC 110 70 10 spec par=30
SLUDGE_WAVE POISON 95 100 10 spec psn=10
KNOCK_OFF DARK 65 100 20 phys
UPROAR NORMAL 90 100 10 spec
SMOG POISON 30 70 20 spec psn=40
SHADOW_SNEAK GHOST 40 100 30 phys prio=1
HEAD_SMASH ROCK 150 80 5 phys recoil=0.5
ELECTRO_BALL ELECTRIC 60 100 10 spec
SPARK ELECTRIC 65 100 20 phys par=30
AURORA_BEAM ICE 65 100 20 spec
FALSE_SWIPE NORMAL 40 100 40 phys spare
BIND NORMAL 15 85 20 phys
IRON_HEAD STEEL 80 100 15 phys
DRAGON_CLAW DRAGON 80 100 15 phys
DRILL_RUN GROUND 80 95 10 phys
METEOR_MASH STEEL 90 90 10 phys
ECHOED_VOICE NORMAL 40 100 15 spec
ROUND NORMAL 60 100 15 spec
BULLET_PUNCH STEEL 40 100 30 phys prio=1
PSYSHOCK PSYCHIC 80 100 10 spec
WOOD_HAMMER GRASS 120 100 15 phys recoil=0.33
FAIRY_WIND FAIRY 40 100 30 spec
POWDER_SNOW ICE 40 100 25 spec
SACRED_SWORD FIGHTING 90 100 15 phys
FELL_STINGER BUG 50 100 25 phys
PLUCK FLYING 60 100 20 phys
CRUSH_CLAW NORMAL 75 95 10 phys
STORED_POWER PSYCHIC 20 100 10 spec
ICICLE_CRASH ICE 85 90 10 phys
BULLET_SEED GRASS 75 100 30 phys
ERUPTION FIRE 150 100 5 spec
LEAFAGE GRASS 40 100 40 phys
U_TURN BUG 70 100 20 phys
VICE_GRIP NORMAL 55 100 30 phys
HEAT_WAVE FIRE 95 90 10 spec
STRUGGLE_BUG BUG 50 100 20 spec
FREEZE_DRY ICE 70 100 20 spec
SCALD WATER 80 100 15 spec
VOLT_SWITCH ELECTRIC 70 100 20 spec
PARABOLIC_CHARGE ELECTRIC 65 100 20 spec drain=0.5
IRON_TAIL STEEL 100 75 15 phys
NUZZLE ELECTRIC 20 100 20 phys par=100
FIRE_PUNCH FIRE 75 100 15 phys
THIEF DARK 60 100 25 phys
AQUA_CUTTER WATER 70 100 20 phys
GRASS_KNOT GRASS 60 100 20 spec
RAZOR_SHELL WATER 75 95 10 phys
ZEN_HEADBUTT PSYCHIC 80 90 15 phys
ROCK_SMASH FIGHTING 40 100 15 phys
ASSURANCE DARK 60 100 10 phys
LOW_KICK FIGHTING 60 100 20 phys
INFESTATION BUG 20 100 20 spec
SLAM NORMAL 80 75 20 phys
CHARGE_BEAM ELECTRIC 50 90 10 spec
PAY_DAY NORMAL 40 100 20 phys
SLUDGE POISON 65 100 20 spec psn=30
VENOSHOCK POISON 65 100 10 spec x2=psn
DRAGON_TAIL DRAGON 60 90 10 phys
ANCIENT_POWER ROCK 60 100 5 spec
AVALANCHE ICE 60 100 10 phys
INCINERATE FIRE 60 100 15 spec
SHOCK_WAVE ELECTRIC 60 - 20 spec
STOMPING_TANTRUM GROUND 75 100 10 phys
PSYCHO_CUT PSYCHIC 70 100 20 phys
AQUA_TAIL WATER 90 90 10 phys
SUCKER_PUNCH DARK 70 100 5 phys prio=1
FIRE_SPIN FIRE 35 85 15 spec
ACROBATICS FLYING 55 100 15 phys
HEAVY_SLAM STEEL 80 100 10 phys
WATERFALL WATER 80 100 15 phys
CROSS_CHOP FIGHTING 100 80 5 phys
MACH_PUNCH FIGHTING 40 100 30 phys prio=1
CROSS_POISON POISON 70 100 20 phys psn=10
FORCE_PALM FIGHTING 60 100 10 phys par=30
POISON_TAIL POISON 50 100 25 phys psn=10
HEAT_CRASH FIRE 80 100 10 phys
THRASH NORMAL 120 100 10 phys
FIRE_BLAST FIRE 110 85 5 spec
BONE_RUSH GROUND 75 90 10 phys
ROCK_BLAST ROCK 75 90 10 phys
X_SCISSOR BUG 80 100 15 phys
ENERGY_BALL GRASS 90 100 10 spec
DIVE WATER 80 100 10 phys
FROST_BREATH ICE 60 90 10 spec
MUDDY_WATER WATER 90 85 10 spec
GEAR_GRIND STEEL 100 85 15 phys
STONE_EDGE ROCK 100 80 5 phys
CLOSE_COMBAT FIGHTING 120 100 5 phys
DRAGON_RUSH DRAGON 100 75 10 phys
LEECH_LIFE BUG 80 100 10 phys drain=0.5
LIQUIDATION WATER 85 100 10 phys
DRAIN_PUNCH FIGHTING 75 100 10 phys drain=0.5
RAGE_FIST GHOST 50 100 10 phys
WAVE_CRASH WATER 120 100 10 phys recoil=0.33
DRILL_PECK FLYING 80 100 20 phys
LAVA_PLUME FIRE 80 100 15 spec
BLIZZARD ICE 110 70 5 spec
GUNK_SHOT POISON 120 80 5 phys psn=30
AURA_SPHERE FIGHTING 80 - 20 spec
STEEL_WING STEEL 70 90 25 phys
BONEMERANG GROUND 100 90 10 phys
WILD_CHARGE ELECTRIC 90 100 15 phys recoil=0.25
NIGHT_DAZE DARK 85 95 10 spec
OUTRAGE DRAGON 120 100 10 phys
POISON_FANG POISON 50 100 15 phys psn=50 toxic
HORN_LEECH GRASS 75 100 10 phys drain=0.5
ZAP_CANNON ELECTRIC 120 50 5 spec par=100
CRABHAMMER WATER 100 90 10 phys
POWER_WHIP GRASS 120 85 10 phys
INFERNO FIRE 100 50 5 spec
FOUL_PLAY DARK 95 100 15 phys
HIGH_HORSEPOWER GROUND 95 95 10 phys
OVERHEAT FIRE 130 90 5 spec
BRAVE_BIRD FLYING 120 100 15 phys recoil=0.33
BOOMBURST NORMAL 140 100 10 spec
FLY FLYING 90 95 15 phys
WEATHER_BALL NORMAL 50 100 10 spec
HIGH_JUMP_KICK FIGHTING 130 90 10 phys
LEER NORMAL - 100 30 status stat=def:-1:foe
SCREECH NORMAL - 85 40 status stat=def:-2:foe
SCARY_FACE NORMAL - 100 10 status stat=spe:-2:foe
CHARM FAIRY - 100 20 status stat=atk:-2:foe
BABY_DOLL_EYES FAIRY - 100 30 status prio=1 stat=atk:-1:foe
FEATHER_DANCE FLYING - 100 15 status stat=atk:-2:foe
FAKE_TEARS DARK - 100 20 status stat=spd:-2:foe
METAL_SOUND STEEL - 85 40 status stat=spd:-2:foe
EERIE_IMPULSE ELECTRIC - 100 15 status stat=spa:-2:foe
NOBLE_ROAR NORMAL - 100 30 status stat=atk:-1:foe
PLAY_NICE NORMAL - - 20 status stat=atk:-1:foe
HARDEN NORMAL - - 30 status stat=def:1:self
WITHDRAW WATER - - 40 status stat=def:1:self
DEFENSE_CURL NORMAL - - 40 status stat=def:1:self
IRON_DEFENSE STEEL - - 15 status stat=def:2:self
ACID_ARMOR POISON - - 20 status stat=def:2:self
COSMIC_POWER PSYCHIC - - 20 status stat=def:1:self
AGILITY PSYCHIC - - 30 status stat=spe:2:self
ROCK_POLISH ROCK - - 20 status stat=spe:2:self
AUTOTOMIZE STEEL - - 15 status stat=spe:2:self
SHIFT_GEAR STEEL - - 10 status stat=spe:2:self
SWORDS_DANCE NORMAL - - 20 status stat=atk:2:self
HOWL NORMAL - - 40 status stat=atk:1:self
HONE_CLAWS DARK - - 15 status stat=atk:1:self
WORK_UP NORMAL - - 30 status stat=atk:1:self
BULK_UP FIGHTING - - 20 status stat=atk:1:self
COIL POISON - - 20 status stat=atk:1:self
DRAGON_DANCE DRAGON - - 20 status stat=atk:1:self
GEAR_UP STEEL - - 20 status stat=atk:1:self
CALM_MIND PSYCHIC - - 20 status stat=spa:1:self
QUIVER_DANCE BUG - - 20 status stat=spa:1:self
NASTY_PLOT DARK - - 20 status stat=spa:2:self
AMNESIA PSYCHIC - - 20 status stat=spd:2:self
CHARGE ELECTRIC - - 20 status stat=spd:1:self
RECOVER NORMAL - - 5 status heal=0.5
ROOST FLYING - - 5 status heal=0.5
SYNTHESIS GRASS - - 5 status heal=0.5
MOONLIGHT FAIRY - - 5 status heal=0.5
SLACK_OFF NORMAL - - 5 status heal=0.5
MILK_DRINK NORMAL - - 5 status heal=0.5
LIFE_DEW WATER - - 10 status heal=0.25
SLEEP_POWDER GRASS - 75 15 status slp=100 powder
STUN_SPORE GRASS - 75 30 status par=100 powder
POISON_POWDER POISON - 75 35 status psn=100 powder
SPORE GRASS - 100 15 status slp=100 powder
THUNDER_WAVE ELECTRIC - 90 20 status par=100
GLARE NORMAL - 100 30 status par=100
HYPNOSIS PSYCHIC - 60 20 status slp=100
SING NORMAL - 55 15 status slp=100
POISON_GAS POISON - 90 40 status psn=100
TOXIC POISON - 90 10 status psn=100 toxic
TOXIC_THREAD POISON - 100 20 status psn=100
YAWN NORMAL - - 10 status yawn
PSYCHO_SHIFT PSYCHIC - 100 10 status shift
DREAM_EATER PSYCHIC 100 100 15 spec drain=0.5 dream
SNORE NORMAL 50 100 15 spec snore
REST PSYCHIC - - 5 status heal=1 rest`;
const MOVE_NAMES = { DOUBLE_EDGE: 'Double-Edge', MUD_SLAP: 'Mud-Slap', U_TURN: 'U-turn', X_SCISSOR: 'X-Scissor', BABY_DOLL_EYES: 'Baby-Doll Eyes' };
for (const line of MOVE_LIST.split('\n')) {
  const [id, type, power, acc, pp, cat, ...ex] = line.trim().split(' ');
  if (MOVES[id]) continue;
  const mv = MOVES[id] = { name: MOVE_NAMES[id] ?? id.split('_').map(w => w[0] + w.slice(1).toLowerCase()).join(' '), type, pp: +pp, cat };
  if (power !== '-') mv.power = +power;
  if (acc !== '-') mv.acc = +acc;
  for (const e of ex) { const [k, v] = e.split('='); mv[k] = k === 'stat' ? v.split(':').map((x, i) => i === 1 ? +x : x) : v === undefined ? 1 : k === 'x2' ? v : +v; }
}

// ============================================================ rules
// Mons here are plain objects: { level, maxHp, hp, atk, def, spa, spd, spe, st: stages, status?, sleep?, tox?, yawn?, moves: [{ id, pp }] }.
// Species types are passed in as arrays (the species table, with its 3D model builders, stays in the page).
export const AILS = ['psn', 'par', 'slp'];
export const ailOf = mv => AILS.find(s => mv[s]);
export const cure = m => { delete m.status; delete m.sleep; delete m.tox; }; // tox: the bad-poison counter, for this battle only
export const freshStages = () => ({ atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0 });
export const stageMul = s => s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
export const accMul = s => s >= 0 ? (3 + s) / 3 : 3 / (3 - s);
export const clampStage = (cur, delta) => Math.max(-6, Math.min(6, cur + delta));
export const expAt = level => level ** 3; // Medium Fast: total Exp. at the start of a level
export const share = (n, frac) => Math.max(1, Math.floor(n * frac)); // healing, drain and recoil: at least 1 HP
export const poisonDamage = (maxHp, tox) => share(maxHp, (tox ? Math.min(15, tox) : 2) / 16); // 1/8, or 1/16 more each turn when badly poisoned
export const rollSleep = rng => 1 + Math.floor(rng() * 3); // asleep for 1-3 of its own turns
export const paralysisStops = rng => rng() < 0.25;
export const sideEffectLands = (mv, ail, rng) => rng() * 100 < mv[ail];
export const accuracyHits = (mv, accStage, rng) => mv.acc === undefined || rng() * 100 < mv.acc * accMul(accStage); // "-" accuracy never misses, even after Sand Attack
export const speedOf = m => m.spe * stageMul(m.st.spe) * (m.status === 'par' ? 0.5 : 1); // paralysis halves Speed
export const expYield = (baseExp, level, trainer) => Math.max(1, Math.floor(baseExp * level / 7 * (trainer ? 1.5 : 1))); // trainer Pokémon give 1.5x

/** HP and the five other stats at a level: fixed IVs of 15, no EVs or natures. base = [HP, Atk, Def, SpA, SpD, Spe] */
export function statsAt(base, level) {
  const s = { maxHp: Math.floor((2 * base[0] + 15) * level / 100) + level + 10 };
  ['atk', 'def', 'spa', 'spd', 'spe'].forEach((k, i) => (s[k] = Math.floor((2 * base[i + 1] + 15) * level / 100) + 5));
  return s;
}
export function typeEffect(moveType, types) { let eff = 1; for (const t of types) eff *= EFF[moveType]?.[t] ?? 1; return eff; }
/** One hit's damage. Rolls a critical hit (1/16, x1.5) then the 85-100% spread, in that order. */
export function damage(att, def, mv, attTypes, defTypes, rng) {
  const phys = mv.cat === 'phys';
  const A = (phys ? att.atk : att.spa) * stageMul(att.st[phys ? 'atk' : 'spa']);
  const D = (phys ? def.def : def.spd) * stageMul(def.st[phys ? 'def' : 'spd']);
  const eff = typeEffect(mv.type, defTypes);
  const crit = rng() < 1 / 16, stab = attTypes.includes(mv.type) ? 1.5 : 1;
  const power = mv.power * (def.status && (mv.x2 === 'any' || mv.x2 === def.status) ? 2 : 1); // Hex, Venoshock
  const base = Math.floor(Math.floor(Math.floor(2 * att.level / 5 + 2) * power * A / D) / 50) + 2;
  return { dmg: eff ? Math.max(1, Math.floor(base * (crit ? 1.5 : 1) * stab * eff * (0.85 + (1 - 0.85) * rng()))) : 0, eff, crit };
}
/** Poison and Steel types can't be poisoned, Electric types can't be paralyzed; Thunder Wave misses Ground, powders miss Grass */
export function immune(types, status, mv) {
  return (status === 'psn' && (types.includes('POISON') || types.includes('STEEL'))) || (status === 'par' && types.includes('ELECTRIC'))
    || (mv.cat === 'status' && mv.type === 'ELECTRIC' && types.includes('GROUND')) || (mv.powder && types.includes('GRASS'));
}
/** Does `a` (using move mvA) act before `b` (using mvB)? Priority, then Speed, then a coin flip. */
export function movesFirst(a, b, mvA, mvB, rng) {
  const pa = mvA.prio || 0, pb = mvB.prio || 0, sa = speedOf(a), sb = speedOf(b);
  return pa !== pb ? pa > pb : sa !== sb ? sa > sb : rng() < 0.5;
}
export const escapes = (meSpe, foeSpe, tries, rng) => meSpe >= foeSpe || rng() * 256 < meSpe * 128 / Math.max(1, foeSpe) + 30 * tries; // tries counts this one
/** A Poké Ball throw: ballMul is the ball's rate, a sleeping target is x2.5, another condition x1.5. Shakes before it breaks free (3 when caught). */
export function catchRoll(foe, catchRate, ballMul, rng) {
  const bonus = ballMul * (foe.status === 'slp' ? 2.5 : foe.status ? 1.5 : 1);
  const odds = Math.min(1, ((3 * foe.maxHp - 2 * foe.hp) * catchRate * bonus) / (3 * foe.maxHp) / 255);
  const caught = rng() < odds;
  return { caught, odds, shakes: caught ? 3 : Math.min(2, Math.floor(rng() * (1 + odds * 4))) };
}
/** Would `mv` from `user` do nothing to `target` right now? The foe's AI skips such moves (no Sleep Powder on a target that already
 * has a condition or is immune, no healing at full HP...). */
export function wasted(mv, user, target, targetTypes) {
  const ail = mv.cat === 'status' && ailOf(mv);
  return (ail && (target.status || immune(targetTypes, ail, mv))) || (mv.heal && user.hp >= user.maxHp) || (mv.yawn && (target.status || target.yawn))
    || (mv.shift && (!user.status || target.status || immune(targetTypes, user.status, mv))) || (mv.dream && target.status !== 'slp') || (mv.snore && user.status !== 'slp');
}
/** The foe's move: a random usable one that isn't wasted, else any with PP, else Tackle. */
export function foeMove(foe, target, targetTypes, rng) {
  const pick = a => a[Math.floor(rng() * a.length)];
  const usable = foe.moves.filter(x => x.pp > 0), smart = usable.filter(x => !wasted(MOVES[x.id], foe, target, targetTypes));
  return (smart.length ? pick(smart) : usable.length ? pick(usable) : { id: 'TACKLE' }).id;
}
