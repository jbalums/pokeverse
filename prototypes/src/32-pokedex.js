import './31-poke-mart.js'; // first: the modules run in file-number order (see main.js)
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import { V3, clamp } from './01-helpers.js';
import { EFFECT_MAT, P, bodyBounds, cleanClip, mostlyBlack, quietClip, swing } from './19-characters.js';
import { $, keys, ui } from './25-input.js';
import { setMoveTarget } from './26-key-bindings.js';
import { SPECIES, TYPE_COL } from './27-pokemon-data.js';

// ============================================================ National Pokédex
// Snapshot: https://pokeapi.co/api/v2/pokemon-species?limit=10000 (2026-10-19).
// The numbered catalog is embedded; only optional artwork uses the network.
const NATIONAL_NAMES = 'bulbasaur ivysaur venusaur charmander charmeleon charizard squirtle wartortle blastoise caterpie metapod butterfree weedle kakuna beedrill pidgey pidgeotto pidgeot rattata raticate spearow fearow ekans arbok pikachu raichu sandshrew sandslash nidoran-f nidorina nidoqueen nidoran-m nidorino nidoking clefairy clefable vulpix ninetales jigglypuff wigglytuff zubat golbat oddish gloom vileplume paras parasect venonat venomoth diglett dugtrio meowth persian psyduck golduck mankey primeape growlithe arcanine poliwag poliwhirl poliwrath abra kadabra alakazam machop machoke machamp bellsprout weepinbell victreebel tentacool tentacruel geodude graveler golem ponyta rapidash slowpoke slowbro magnemite magneton farfetchd doduo dodrio seel dewgong grimer muk shellder cloyster gastly haunter gengar onix drowzee hypno krabby kingler voltorb electrode exeggcute exeggutor cubone marowak hitmonlee hitmonchan lickitung koffing weezing rhyhorn rhydon chansey tangela kangaskhan horsea seadra goldeen seaking staryu starmie mr-mime scyther jynx electabuzz magmar pinsir tauros magikarp gyarados lapras ditto eevee vaporeon jolteon flareon porygon omanyte omastar kabuto kabutops aerodactyl snorlax articuno zapdos moltres dratini dragonair dragonite mewtwo mew chikorita bayleef meganium cyndaquil quilava typhlosion totodile croconaw feraligatr sentret furret hoothoot noctowl ledyba ledian spinarak ariados crobat chinchou lanturn pichu cleffa igglybuff togepi togetic natu xatu mareep flaaffy ampharos bellossom marill azumarill sudowoodo politoed hoppip skiploom jumpluff aipom sunkern sunflora yanma wooper quagsire espeon umbreon murkrow slowking misdreavus unown wobbuffet girafarig pineco forretress dunsparce gligar steelix snubbull granbull qwilfish scizor shuckle heracross sneasel teddiursa ursaring slugma magcargo swinub piloswine corsola remoraid octillery delibird mantine skarmory houndour houndoom kingdra phanpy donphan porygon2 stantler smeargle tyrogue hitmontop smoochum elekid magby miltank blissey raikou entei suicune larvitar pupitar tyranitar lugia ho-oh celebi treecko grovyle sceptile torchic combusken blaziken mudkip marshtomp swampert poochyena mightyena zigzagoon linoone wurmple silcoon beautifly cascoon dustox lotad lombre ludicolo seedot nuzleaf shiftry taillow swellow wingull pelipper ralts kirlia gardevoir surskit masquerain shroomish breloom slakoth vigoroth slaking nincada ninjask shedinja whismur loudred exploud makuhita hariyama azurill nosepass skitty delcatty sableye mawile aron lairon aggron meditite medicham electrike manectric plusle minun volbeat illumise roselia gulpin swalot carvanha sharpedo wailmer wailord numel camerupt torkoal spoink grumpig spinda trapinch vibrava flygon cacnea cacturne swablu altaria zangoose seviper lunatone solrock barboach whiscash corphish crawdaunt baltoy claydol lileep cradily anorith armaldo feebas milotic castform kecleon shuppet banette duskull dusclops tropius chimecho absol wynaut snorunt glalie spheal sealeo walrein clamperl huntail gorebyss relicanth luvdisc bagon shelgon salamence beldum metang metagross regirock regice registeel latias latios kyogre groudon rayquaza jirachi deoxys turtwig grotle torterra chimchar monferno infernape piplup prinplup empoleon starly staravia staraptor bidoof bibarel kricketot kricketune shinx luxio luxray budew roserade cranidos rampardos shieldon bastiodon burmy wormadam mothim combee vespiquen pachirisu buizel floatzel cherubi cherrim shellos gastrodon ambipom drifloon drifblim buneary lopunny mismagius honchkrow glameow purugly chingling stunky skuntank bronzor bronzong bonsly mime-jr happiny chatot spiritomb gible gabite garchomp munchlax riolu lucario hippopotas hippowdon skorupi drapion croagunk toxicroak carnivine finneon lumineon mantyke snover abomasnow weavile magnezone lickilicky rhyperior tangrowth electivire magmortar togekiss yanmega leafeon glaceon gliscor mamoswine porygon-z gallade probopass dusknoir froslass rotom uxie mesprit azelf dialga palkia heatran regigigas giratina cresselia phione manaphy darkrai shaymin arceus victini snivy servine serperior tepig pignite emboar oshawott dewott samurott patrat watchog lillipup herdier stoutland purrloin liepard pansage simisage pansear simisear panpour simipour munna musharna pidove tranquill unfezant blitzle zebstrika roggenrola boldore gigalith woobat swoobat drilbur excadrill audino timburr gurdurr conkeldurr tympole palpitoad seismitoad throh sawk sewaddle swadloon leavanny venipede whirlipede scolipede cottonee whimsicott petilil lilligant basculin sandile krokorok krookodile darumaka darmanitan maractus dwebble crustle scraggy scrafty sigilyph yamask cofagrigus tirtouga carracosta archen archeops trubbish garbodor zorua zoroark minccino cinccino gothita gothorita gothitelle solosis duosion reuniclus ducklett swanna vanillite vanillish vanilluxe deerling sawsbuck emolga karrablast escavalier foongus amoonguss frillish jellicent alomomola joltik galvantula ferroseed ferrothorn klink klang klinklang tynamo eelektrik eelektross elgyem beheeyem litwick lampent chandelure axew fraxure haxorus cubchoo beartic cryogonal shelmet accelgor stunfisk mienfoo mienshao druddigon golett golurk pawniard bisharp bouffalant rufflet braviary vullaby mandibuzz heatmor durant deino zweilous hydreigon larvesta volcarona cobalion terrakion virizion tornadus thundurus reshiram zekrom landorus kyurem keldeo meloetta genesect chespin quilladin chesnaught fennekin braixen delphox froakie frogadier greninja bunnelby diggersby fletchling fletchinder talonflame scatterbug spewpa vivillon litleo pyroar flabebe floette florges skiddo gogoat pancham pangoro furfrou espurr meowstic honedge doublade aegislash spritzee aromatisse swirlix slurpuff inkay malamar binacle barbaracle skrelp dragalge clauncher clawitzer helioptile heliolisk tyrunt tyrantrum amaura aurorus sylveon hawlucha dedenne carbink goomy sliggoo goodra klefki phantump trevenant pumpkaboo gourgeist bergmite avalugg noibat noivern xerneas yveltal zygarde diancie hoopa volcanion rowlet dartrix decidueye litten torracat incineroar popplio brionne primarina pikipek trumbeak toucannon yungoos gumshoos grubbin charjabug vikavolt crabrawler crabominable oricorio cutiefly ribombee rockruff lycanroc wishiwashi mareanie toxapex mudbray mudsdale dewpider araquanid fomantis lurantis morelull shiinotic salandit salazzle stufful bewear bounsweet steenee tsareena comfey oranguru passimian wimpod golisopod sandygast palossand pyukumuku type-null silvally minior komala turtonator togedemaru mimikyu bruxish drampa dhelmise jangmo-o hakamo-o kommo-o tapu-koko tapu-lele tapu-bulu tapu-fini cosmog cosmoem solgaleo lunala nihilego buzzwole pheromosa xurkitree celesteela kartana guzzlord necrozma magearna marshadow poipole naganadel stakataka blacephalon zeraora meltan melmetal grookey thwackey rillaboom scorbunny raboot cinderace sobble drizzile inteleon skwovet greedent rookidee corvisquire corviknight blipbug dottler orbeetle nickit thievul gossifleur eldegoss wooloo dubwool chewtle drednaw yamper boltund rolycoly carkol coalossal applin flapple appletun silicobra sandaconda cramorant arrokuda barraskewda toxel toxtricity sizzlipede centiskorch clobbopus grapploct sinistea polteageist hatenna hattrem hatterene impidimp morgrem grimmsnarl obstagoon perrserker cursola sirfetchd mr-rime runerigus milcery alcremie falinks pincurchin snom frosmoth stonjourner eiscue indeedee morpeko cufant copperajah dracozolt arctozolt dracovish arctovish duraludon dreepy drakloak dragapult zacian zamazenta eternatus kubfu urshifu zarude regieleki regidrago glastrier spectrier calyrex wyrdeer kleavor ursaluna basculegion sneasler overqwil enamorus sprigatito floragato meowscarada fuecoco crocalor skeledirge quaxly quaxwell quaquaval lechonk oinkologne tarountula spidops nymble lokix pawmi pawmo pawmot tandemaus maushold fidough dachsbun smoliv dolliv arboliva squawkabilly nacli naclstack garganacl charcadet armarouge ceruledge tadbulb bellibolt wattrel kilowattrel maschiff mabosstiff shroodle grafaiai bramblin brambleghast toedscool toedscruel klawf capsakid scovillain rellor rabsca flittle espathra tinkatink tinkatuff tinkaton wiglett wugtrio bombirdier finizen palafin varoom revavroom cyclizar orthworm glimmet glimmora greavard houndstone flamigo cetoddle cetitan veluza dondozo tatsugiri annihilape clodsire farigiraf dudunsparce kingambit great-tusk scream-tail brute-bonnet flutter-mane slither-wing sandy-shocks iron-treads iron-bundle iron-hands iron-jugulis iron-moth iron-thorns frigibax arctibax baxcalibur gimmighoul gholdengo wo-chien chien-pao ting-lu chi-yu roaring-moon iron-valiant koraidon miraidon walking-wake iron-leaves dipplin poltchageist sinistcha okidogi munkidori fezandipiti ogerpon archaludon hydrapple gouging-fire raging-bolt iron-boulder iron-crown terapagos pecharunt'.split(' ');
const DEX_GAME_SPECIES = { 1: 'BULBASAUR', 4: 'CHARMANDER', 10: 'CATERPIE', 13: 'WEEDLE', 16: 'PIDGEY', 19: 'RATTATA', 25: 'PIKACHU', 43: 'ODDISH' };
// Local model inventory: National IDs come from species names, not archive numbering.
const DEX_MODELS = {
  1: [["Standard","Bulbasaur/Bulbasaur_ColladaMax.DAE"]],
  2: [["Standard","Ivysaur/Ivysaur_ColladaMax.DAE"]],
  3: [["Male","Venusaur/VenusaurM_ColladaMax.DAE"],["Female","Venusaur/VenusaurF_ColladaMax.DAE"],["Mega","Venusaur/VenusaurMega_ColladaMax.DAE"]],
  4: [["Standard","Charmander/Charmander_ColladaMax.DAE"]],
  5: [["Standard","Charmeleon/Charmeleon_ColladaMax.DAE"]],
  6: [["Standard","Charizard/Charizard_ColladaMax.DAE"],["Mega X","Charizard/CharizardMegaX_ColladaMax.DAE"],["Mega Y","Charizard/CharizardMegaY_ColladaMax.DAE"]],
  7: [["Standard","Squirtle/Squirtle_ColladaMax.DAE"]],
  8: [["Standard","Wartortle/Wartortle_ColladaMax.DAE"]],
  9: [["Standard","Blastoise/Blastoise_ColladaMax.DAE"],["Mega","Blastoise/BlastoiseMega_ColladaMax.DAE"]],
  10: [["Standard","Caterpie/Caterpie_ColladaMax.DAE"]],
  11: [["Standard","Metapod/Metapod_ColladaMax.DAE"]],
  12: [["Male","Butterfree/ButterfreeM_ColladaMax.DAE"],["Female","Butterfree/ButterfreeF_ColladaMax.DAE"]],
  13: [["Standard","Weedle/Weedle.DAE"]],
  14: [["Standard","Kakuna/Kakuna.DAE"]],
  15: [["Standard","Beedrill/Beedrill.DAE"],["Mega","Beedrill/Beedrill_Mega.DAE"]],
  16: [["Standard","Pidgey/Pidgey.DAE"]],
  17: [["Standard","Pidgeotto/Pidgeotto.DAE"]],
  18: [["Standard","Pidgeot/Pidgeot.DAE"],["Mega","Pidgeot/Pidgeot_Mega.DAE"]],
  19: [["Male","Rattata/Rattata_M.DAE"],["Female","Rattata/Rattata_F.DAE"]],
  20: [["Male","Raticate/Raticate_M.DAE"],["Female","Raticate/Raticate_F.DAE"]],
  21: [["Standard","Spearow/Spearow.DAE"]],
  22: [["Standard","Fearow/Fearow.DAE"]],
  23: [["Standard","Ekans/Ekans_ColladaMax.DAE"]],
  24: [["Standard","Arbok/Arbok_OpenCollada.DAE"]],
  25: [["Male","Pikachu/PikachuM_ColladaMax.DAE"],["Female","Pikachu/PikachuF_ColladaMax.DAE"]],
  26: [["Male","Raichu/RaichuM_ColladaMax.DAE"],["Female","Raichu/RaichuF_ColladaMax.DAE"]],
  27: [["Standard","Sandshrew/Sandshrew_OpenCollada.DAE"]],
  28: [["Standard","Sandslash/Sandslash_OpenCollada.DAE"]],
  29: [["Standard","NidoranF/NidoranF_ColladaMax.DAE"]],
  30: [["Standard","Nidorina/Nidorina_ColladaMax.DAE"]],
  31: [["Standard","Nidoqueen/Nidoqueen_ColladaMax.DAE"]],
  32: [["Standard","NidoranM/NidoranM_ColladaMax.DAE"]],
  33: [["Standard","Nidorino/Nidorino_ColladaMax.DAE"]],
  34: [["Standard","Nidoking/Nidoking_ColladaMax.DAE"]],
  35: [["Standard","035. Clefairy/clefairy.dae"]],
  36: [["Standard","Clefable/Clefable.DAE"]],
  37: [["Standard","Vulpix/Vulpix.DAE"]],
  38: [["Standard","Ninetales/Ninetales.DAE"]],
  39: [["Standard","Jigglypuff/Jigglypuff.DAE"]],
  40: [["Standard","Wigglytuff/Wigglytuff.DAE"]],
  41: [["Male","041. Zubat/zubat_m.dae"],["Female","041. Zubat/zubat_f.dae"]],
  42: [["Male","042. Golbat/golbat_m.dae"],["Female","042. Golbat/golbat_f.dae"]],
  43: [["Standard","Oddish/Oddish.DAE"]],
  44: [["Male","Gloom/Gloom_M.DAE"],["Female","Gloom/Gloom_F.DAE"]],
  45: [["Male","Vileplume/Vileplume_M.DAE"],["Female","Vileplume/Vileplume_F.DAE"]],
  46: [["Standard","Paras/Paras.DAE"]],
  47: [["Standard","Parasect/Parasect.DAE"]],
  48: [["Standard","Venonat/Venonat.DAE"]],
  49: [["Standard","Venomoth/Venomoth.DAE"]],
  50: [["Standard","Diglett/Diglett.DAE"]],
  51: [["Standard","Dugtrio/Dugtrio.DAE"]],
  52: [["Standard","Meowth/Meowth.DAE"]],
  53: [["Standard","Persian/Persian.DAE"]],
  54: [["Standard","Psyduck/Psyduck.DAE"]],
  55: [["Standard","Golduck/Golduck.DAE"]],
  56: [["Standard","Mankey/Mankey.DAE"]],
  57: [["Standard","Primeape/Primeape.DAE"]],
  58: [["Standard","Growlithe/Growlithe.DAE"]],
  59: [["Standard","Arcanine/Arcanine_OpenCollada.DAE"]],
  60: [["Standard","060. Poliwag/poliwag.dae"]],
  61: [["Standard","Poliwhirl/Poliwhirl.DAE"]],
  62: [["Standard","Poliwrath/Poliwrath.DAE"]],
  63: [["Standard","Abra/Abra_OpenCollada.DAE"]],
  64: [["Male","Kadabra/KadabraM_OpenCollada.DAE"],["Female","Kadabra/KadabraF_OpenCollada.DAE"]],
  65: [["Male","Alakazam/AlakazamM_ColladaMax.DAE"],["Female","Alakazam/AlakazamF_ColladaMax.DAE"],["Mega","Alakazam/AlakazamMega_ColladaMax.DAE"]],
  66: [["Standard","Machop/Machop_ColladaMax.DAE"]],
  67: [["Standard","Machoke/Machoke_ColladaMax.DAE"]],
  68: [["Standard","Machamp/Machamp_ColladaMax.DAE"]],
  69: [["Standard","Bellsprout/Bellsprout.DAE"]],
  70: [["Standard","Weepinbell/Weepinbell_ColladaMax.DAE"]],
  71: [["Standard","Victreebel/Victreebel.DAE"]],
  72: [["Standard","Tentacool/Tentacool.DAE"]],
  73: [["Standard","Tentacruel/Tentacruel.DAE"]],
  74: [["Standard","Geodude/Geodude.DAE"]],
  75: [["Standard","Graveler/Graveler.DAE"]],
  76: [["Standard","Golem/Golem.DAE"]],
  77: [["Standard","Ponyta/Ponyta_OpenCollada.DAE"]],
  78: [["Standard","Rapidash/Rapidash_OpenCollada.DAE"]],
  79: [["Standard","Slowpoke/Slowpoke_ColladaMax.DAE"]],
  80: [["Standard","Slowbro/Slowbro_ColladaMax.DAE"],["Mega","Slowbro/SlowbroMega_ColladaMax.DAE"]],
  81: [["Standard","Magnemite/pm0081_00.dae"]],
  82: [["Standard","Magneton/pm0082_00.dae"]],
  83: [["Standard","Farfetch'd/Farfetch'd_OpenCollada.DAE"]],
  84: [["Male","Doduo/DoduoM_OpenCollada.DAE"],["Female","Doduo/DoduoF_OpenCollada.DAE"]],
  85: [["Male","Dodrio/DodrioM_OpenCollada.DAE"],["Female","Dodrio/DodrioF_OpenCollada.DAE"]],
  86: [["Standard","Seel/Seel_OpenCollada.DAE"]],
  87: [["Standard","Dewgong/Dewgong_OpenCollada.DAE"]],
  88: [["Standard","Grimer/pm0088_00.dae"]],
  89: [["Standard","Muk/pm0089_00.dae"]],
  90: [["Standard","Shellder/pm0090_00.dae"]],
  91: [["Standard","Cloyster/pm0091_00.dae"]],
  93: [["Standard","Haunter/Haunter.dae"]],
  94: [["Standard","Gengar/Gengar_ColladaMax.DAE"],["Mega","Gengar/GengarMega_ColladaMax.DAE"]],
  95: [["Standard","Onix/Onix.dae"]],
  96: [["Standard","Drowzee/Drowzee.dae"]],
  98: [["Standard","Krabby/Krabby.dae"]],
  99: [["Standard","Kingler/Kingler.dae"]],
  100: [["Standard","Voltorb/pm0100_00.dae"]],
  101: [["Standard","Electrode/Electrode.dae"]],
  102: [["Standard","Exeggcute/Exeggcute.dae"]],
  103: [["Standard","Exeggutor/Exeggutor.dae"]],
  104: [["Standard","Cubone/Cubone_ColladaMax.DAE"]],
  105: [["Standard","Marowak/Marowak_ColladaMax.DAE"]],
  106: [["Standard","Hitmonlee/Hitmonlee.dae"]],
  107: [["Standard","Hitmonchan/Hitmonchan_ColladaMax.DAE"]],
  108: [["Standard","Lickitung/Lickitung.dae"]],
  109: [["Standard","Koffing/Koffing.dae"]],
  110: [["Standard","Weezing/Weezing.dae"]],
  111: [["Standard 1","Rhyhorn/Rhyhorn.dae"],["Standard 2","Rhyhorn/pm0111_00_fi.dae"]],
  112: [["Male","Rhydon/RhydonM_ColladaMax.DAE"],["Female","Rhydon/RhydonF_ColladaMax.DAE"]],
  113: [["Standard","Chansey/Chansey.dae"]],
  114: [["Standard","Tangela/Tangela.dae"]],
  115: [["Standard","Kangaskhan/Kangaskhan_ColladaMax.DAE"],["Mega","Kangaskhan/KangaskhanMega_ColladaMax.DAE"]],
  116: [["Standard","Horsea/Horsea.dae"]],
  117: [["Standard","Seadra/Seadra.dae"]],
  118: [["Male","Goldeen/Goldeen_M.dae"],["Female","Goldeen/Goldeen_F.dae"]],
  119: [["Male","Seaking/Seaking_M.dae"],["Female","Seaking/Seaking_F.dae"]],
  120: [["Standard","Staryu/pm0120_00.dae"]],
  121: [["Standard","Starmie/pm0121_00.dae"]],
  122: [["Standard","Mr. Mime/MrMime_ColladaMax.DAE"]],
  123: [["Standard","Scyther/Scyther_OpenCollada.DAE"]],
  124: [["Standard","Jynx/Jynx.dae"]],
  125: [["Standard","Electabuzz/Electabuzz.dae"]],
  126: [["Standard","Magmar/Magmar.dae"]],
  127: [["Standard","Pinsir/Pinsir_ColladaMax.DAE"],["Mega","Pinsir/PinsirMega_ColladaMax.DAE"]],
  128: [["Standard","Tauros/Tauros.dae"]],
  129: [["Male","Magikarp/MagikarpM_OpenCollada.DAE"],["Female","Magikarp/MagikarpF_OpenCollada.DAE"]],
  130: [["Male","Gyarados/GyaradosM_OpenCollada.DAE"],["Female","Gyarados/GyaradosF_OpenCollada.DAE"],["Mega","Gyarados/GyaradosMega_OpenCollada.DAE"]],
  131: [["Standard","Lapras/Lapras.dae"]],
  132: [["Standard","Ditto/pm0132_00.dae"]],
  133: [["Standard","Eevee/Eevee_ColladaMax.DAE"]],
  134: [["Standard","Vaporeon/Vaporeon_ColladaMax.DAE"]],
  135: [["Standard","Jolteon/Jolteon_ColladaMax.DAE"]],
  136: [["Standard","Flareon/Flareon_ColladaMax.DAE"]],
  137: [["Standard","Porygon/Porygon_ColladaMax.DAE"]],
  138: [["Standard","Omanyte/Omanyte_ColladaMax.DAE"]],
  139: [["Standard","Omastar/Omastar_ColladaMax.DAE"]],
  140: [["Standard","Kabuto/Kabuto.dae"]],
  141: [["Standard","Kabutops/Kabutops.dae"]],
  142: [["Standard","Aerodactyl/Aerodactyl_ColladaMax.DAE"],["Mega","Aerodactyl/AerodactylMega_ColladaMax.DAE"]],
  143: [["Standard","143. Snorlax/snorlax.dae"]],
  144: [["Standard","Articuno/Articuno_ColladaMax.DAE"]],
  145: [["Standard","Zapdos/Zapdos_ColladaMax.DAE"]],
  146: [["Standard","Moltres/Moltres_ColladaMax.DAE"]],
  147: [["Standard","Dratini/Dratini_OpenCollada.dae"]],
  148: [["Standard","Dragonair/Dragonair_OpenCollada.DAE"]],
  149: [["Standard","Dragonite/Dragonite_OpenCollada.DAE"]],
  150: [["Standard","Mewtwo/Mewtwo_ColladaMax.DAE"],["Alternate 4","Mewtwo/pmxxx1_00_fi.dae"],["Mega X","Mewtwo/MewtwoMegaX_ColladaMax.DAE"],["Mega Y","Mewtwo/MewtwoMegaY_ColladaMax.DAE"]],
  151: [["Standard","Mew/Mew_ColladaMax.DAE"]],
  152: [["Standard","Chikorita/Chikorita_ColladaMax.DAE"]],
  153: [["Standard","Bayleef/Bayleef_ColladaMax.DAE"]],
  154: [["Male","Meganium/MeganiumM_ColladaMax.DAE"],["Female","Meganium/MeganiumF_ColladaMax.DAE"]],
  155: [["Standard","Cyndaquil/Cyndaquil_ColladaMax.DAE"]],
  156: [["Standard","Quilava/Quilava_ColladaMax.DAE"]],
  157: [["Standard","Typhlosion/Typhlosion_ColladaMax.DAE"]],
  158: [["Standard","Totodile/Totodile_ColladaMax.DAE"]],
  159: [["Standard","Croconaw/Croconaw_ColladaMax.DAE"]],
  160: [["Standard","Feraligatr/Feraligatr_ColladaMax.DAE"]],
  161: [["Standard","Sentret/model.dae"]],
  162: [["Standard","Furret/model.dae"]],
  164: [["Standard","Noctowl/pm0164_00.dae"]],
  167: [["Standard","Spinarak/Spinarak_OpenCollada.DAE"]],
  168: [["Standard","Ariados/Ariados_OpenCollada.DAE"]],
  169: [["Standard","169. Crobat/crobat.dae"]],
  170: [["Standard","#0170 Chinchou/Chinchou.dae"]],
  172: [["Standard","Pichu/Pichu_ColladaMax.DAE"]],
  173: [["Standard","173. Cleffa/cleffa.dae"]],
  174: [["Standard","Igglybuff/pm0174_00.dae"]],
  175: [["Standard","Togepi/Togepi.dae"]],
  176: [["Standard","Togetic/Togetic.dae"]],
  177: [["Standard","Natu/Natu.dae"]],
  178: [["Standard","Xatu/Xatu.dae"],["Female","Xatu/Xatu_F.dae"]],
  181: [["Standard","Ampharos/Ampharos_OpenCollada.DAE"],["Mega","Ampharos/AmpharosMega_OpenCollada.DAE"]],
  182: [["Standard","Bellossom/Bellossom_ColladaMax.DAE"]],
  183: [["Standard","Marill/pm0183_00_fi.dae"]],
  184: [["Standard","Azumarill/Azumarill_ColladaMax.DAE"]],
  185: [["Standard","Sudowoodo/Sudowoodo.dae"],["Female","Sudowoodo/Sudowoodo_F.dae"]],
  186: [["Male","186. Politoed/politoed_m.dae"],["Female","186. Politoed/politoed_f.dae"]],
  187: [["Standard","Hoppip/Hoppip.dae"]],
  191: [["Standard","Sunkern/Sunkern.dae"]],
  192: [["Standard","Sunflora/Sunflora.dae"]],
  193: [["Standard","Yanma/Yanma_ColladaMax.DAE"]],
  194: [["Standard","Wooper/Wooper.dae"],["Female","Wooper/Wooper_F.dae"]],
  196: [["Standard","Espeon/Espeon_ColladaMax.DAE"]],
  197: [["Standard","Umbreon/Umbreon_ColladaMax.DAE"]],
  201: [["Male","Unown/UnownM_ColladaMax.DAE"],["Female","Unown/UnownF_ColladaMax.DAE"],["!","Unown/UnownExc_ColladaMax.DAE"],["?","Unown/UnownQue_ColladaMax.DAE"],["A","Unown/UnownA_ColladaMax.DAE"],["B","Unown/UnownB_ColladaMax.DAE"],["C","Unown/UnownC_ColladaMax.DAE"],["D","Unown/UnownD_ColladaMax.DAE"],["E","Unown/UnownE_ColladaMax.DAE"],["G","Unown/UnownG_ColladaMax.DAE"],["H","Unown/UnownH_ColladaMax.DAE"],["I","Unown/UnownI_ColladaMax.DAE"],["J","Unown/UnownJ_ColladaMax.DAE"],["K","Unown/UnownK_ColladaMax.DAE"],["L","Unown/UnownL_ColladaMax.DAE"],["N","Unown/UnownN_ColladaMax.DAE"],["O","Unown/UnownO_ColladaMax.DAE"],["P","Unown/UnownP_ColladaMax.DAE"],["Q","Unown/UnownQ_ColladaMax.DAE"],["R","Unown/UnownR_ColladaMax.DAE"],["S","Unown/UnownS_ColladaMax.DAE"],["T","Unown/UnownT_ColladaMax.DAE"],["U","Unown/UnownU_ColladaMax.DAE"],["V","Unown/UnownV_ColladaMax.DAE"],["W","Unown/UnownW_ColladaMax.DAE"],["X","Unown/UnownX_ColladaMax.DAE"],["Y","Unown/UnownY_ColladaMax.DAE"],["Z","Unown/UnownZ_ColladaMax.DAE"]],
  202: [["Standard","Wobbuffet/Wobbuffet.dae"],["Female","Wobbuffet/Wobbuffet_F.dae"]],
  203: [["Male","Girafarig/GirafarigM_ColladaMax.DAE"],["Female","Girafarig/GirafarigF_ColladaMax.DAE"]],
  206: [["Standard","Dunsparce/pm0206_00.dae"]],
  211: [["Standard","Qwilfish/Qwilfish.dae"]],
  213: [["Standard","Shuckle/Shuckle_ColladaMax.DAE"]],
  214: [["Male","Heracross/HeracrossM_ColladaMax.DAE"],["Female","Heracross/HeracrossF_ColladaMax.DAE"],["Mega","Heracross/HeracrossMega_ColladaMax.DAE"]],
  215: [["Male","Sneasel/SneaselM_ColladaMax.DAE"],["Female","Sneasel/SneaselF_ColladaMax.DAE"]],
  216: [["Standard","216. Teddiursa/teddiursa.dae"]],
  217: [["Standard","Ursaring/Ursaring.dae"],["Female","Ursaring/Ursaring_F.dae"]],
  222: [["Standard","Corsola/pm0222_00.dae"]],
  223: [["Standard","Remoarid/Remoraid.dae"]],
  225: [["Standard","Delibird/Delibird_ColladaMax.DAE"]],
  226: [["Standard","Mantine/Mantine.dae"]],
  229: [["Male","Houndoom/HoundoomM_OpenCollada.DAE"],["Female","Houndoom/HoundoomF_OpenCollada.DAE"],["Mega","Houndoom/HoundoomMega_OpenCollada.DAE"]],
  231: [["Standard","Phanpy/Phanpy_ColladaMax.DAE"]],
  232: [["Male","Donphan/DonphanM_ColladaMax.DAE"],["Female","Donphan/DonphanF_ColladaMax.DAE"]],
  233: [["Standard","Porygon2/Porygon2_ColladaMax.DAE"]],
  235: [["Standard","Smeargle/Smeargle_ColladaMax.DAE"]],
  236: [["Standard","Tyrogue/Tyrogue_ColladaMax.DAE"]],
  241: [["Standard","Miltank/Miltank_ColladaMax.DAE"]],
  242: [["Standard","Blissey/Blissey.dae"]],
  243: [["Standard","Raikou/Raikou_ColladaMax.DAE"]],
  244: [["Standard","Entei/Entei_ColladaMax.DAE"]],
  245: [["Standard","245. Suicune/suicune.dae"]],
  246: [["Standard","Larvitar/Larvitar_ColladaMax.DAE"]],
  247: [["Standard","Pupitar/Pupitar_ColladaMax.DAE"]],
  248: [["Standard","Tyranitar/Tyranitar_ColladaMax.DAE"],["Mega","Tyranitar/TyranitarMega_ColladaMax.DAE"]],
  249: [["Standard","Lugia/Lugia_ColladaMax.DAE"]],
  250: [["Standard","Ho-Oh/Ho-Oh_ColladaMax.DAE"]],
  251: [["Standard","Celebi/Celebi_ColladaMax.DAE"]],
  252: [["Standard","252. Treecko/treecko.dae"]],
  253: [["Standard","253. Grovyle/grovyle.dae"]],
  254: [["Standard","Sceptile/Sceptile_ColladaMax.DAE"],["Mega","Sceptile/SceptileMega_ColladaMax.DAE"]],
  255: [["Male","Torchic/TorchicM_ColladaMax.DAE"],["Female","Torchic/TorchicF_ColladaMax.DAE"]],
  256: [["Male","Combusken/CombuskenM_ColladaMax.DAE"],["Female","Combusken/CombuskenF_ColladaMax.DAE"]],
  257: [["Male","Blaziken/BlazikenM_ColladaMax.DAE"],["Female","Blaziken/BlazikenF_ColladaMax.DAE"],["Mega","Blaziken/BlazikenMega_ColladaMax.DAE"]],
  258: [["Standard","Mudkip/Mudkip_ColladaMax.DAE"]],
  259: [["Standard","Marshtomp/Marshtomp_ColladaMax.DAE"]],
  260: [["Standard","Swampert/Swampert_ColladaMax.DAE"],["Mega","Swampert/SwampertMega_ColladaMax.DAE"]],
  261: [["Standard","Poochyena/Poochyena.dae"]],
  262: [["Standard","Mightyena/Mightyena_ColladaMax.DAE"]],
  263: [["Standard","Zigzagoon/Zigzagoon_ColladaMax.DAE"]],
  264: [["Standard","Linoone/Linoone_ColladaMax.DAE"]],
  265: [["Standard","265. Wurmple/wurmple.dae"]],
  267: [["Standard","Beautifly/pm0267_00.dae"],["Alternate 2","Beautifly/pm0267_01.dae"]],
  269: [["Standard","Dustox/Dustox.dae"],["Female","Dustox/Dustox_F.dae"]],
  271: [["Standard","Lombre/Lombre.dae"]],
  272: [["Standard","Ludicolo/Ludicolo.dae"]],
  273: [["Standard","Seedot/Seedot_OpenCollada.DAE"]],
  274: [["Male","Nuzleaf/NuzleafM_OpenCollada.DAE"],["Female","Nuzleaf/NuzleafF_OpenCollada.DAE"]],
  275: [["Male","Shiftry/ShiftryM_OpenCollada.DAE"],["Female","Shiftry/ShiftryF_OpenCollada.DAE"]],
  278: [["Standard","Wingull/Wingull.dae"]],
  279: [["Standard","Pelipper/Pelipper.dae"]],
  280: [["Standard","Ralts/Ralts_ColladaMax.DAE"]],
  281: [["Standard","Kirlia/Kirlia_ColladaMax.DAE"]],
  282: [["Standard","Gardevoir/Gardevoir_ColladaMax.DAE"],["Mega","Gardevoir/GardevoirMega_ColladaMax.DAE"]],
  283: [["Standard","Surskit/Surskit.dae"]],
  284: [["Standard","Masquerain/Masquerain.dae"]],
  289: [["Standard","Slaking/Slaking_ColladaMax.DAE"]],
  290: [["Standard","Nincada/Nincada.dae"]],
  291: [["Standard","Ninjask/pm0291_00.dae"]],
  292: [["Standard","Shedinja/pm0292_00.dae"]],
  298: [["Standard","Azurill/Azurill.dae"]],
  301: [["Standard","301. Delcatty/delcatty.dae"]],
  303: [["Standard","Mawile/Mawile_ColladaMax.DAE"],["Mega","Mawile/MawileMega_ColladaMax.DAE"]],
  306: [["Standard","Aggron/Aggron_ColladaMax.DAE"],["Mega","Aggron/AggronMega_ColladaMax.DAE"]],
  309: [["Standard","#309 Electrike/pm0309_00.dae"]],
  310: [["Standard","#310 Manectric/pm0310_00.dae"],["Mega","#310 Manectric/Mega/pm0310_51.dae"]],
  311: [["Standard","Plusle/Plusle_ColladaMax.DAE"]],
  312: [["Standard","Minun/Minun_ColladaMax.DAE"]],
  319: [["Standard","Sharpedo/pm0319_00.dae"],["Alternate 2","Sharpedo/pm0319_51.dae"]],
  320: [["Standard","Wailmer/Wailmer_ColladaMax.DAE"]],
  321: [["Standard","Wailord/Wailord_ColladaMax.DAE"]],
  323: [["Male","Camerupt/CameruptM_ColladaMax.DAE"],["Female","Camerupt/CameruptF_ColladaMax.DAE"],["Mega","Camerupt/CameruptMega_ColladaMax.DAE"]],
  330: [["Standard","Flygon/Flygon.dae"]],
  332: [["Male","Cacturne/CacturneM_ColladaMax.DAE"],["Female","Cacturne/CacturneF_ColladaMax.DAE"]],
  335: [["Standard","Zangoose/Zangoose_ColladaMax.DAE"]],
  336: [["Standard","Seviper/pm0336_00.dae"]],
  337: [["Standard","Lunatone/Lunatone_ColladaMax.DAE"]],
  338: [["Standard","Solrock/Solrock_ColladaMax.DAE"]],
  344: [["Standard","Claydol/Claydol.dae"]],
  345: [["Standard","Lileep/Lileep.dae"]],
  346: [["Standard","Cradily/Cradily.dae"]],
  347: [["Standard","Anorith/Anorith.dae"]],
  348: [["Standard","Armaldo/Armaldo.dae"]],
  349: [["Standard","Feebas/Feebas.dae"]],
  350: [["Standard","Milotic/Milotic.dae"],["Female","Milotic/Milotic_F.dae"]],
  351: [["Standard","Castform/Castform_ColladaMax.DAE"],["Rainy","Castform/CastformRainy_ColladaMax.DAE"],["Snowy","Castform/CastformSnowy_ColladaMax.DAE"],["Sunny","Castform/CastformSunny_ColladaMax.DAE"]],
  358: [["Standard","Chimecho/Chimecho.dae"]],
  359: [["Standard","Absol/Absol_ColladaMax.DAE"],["Mega","Absol/AbsolMega_ColladaMax.DAE"]],
  360: [["Standard","360. Wynaut/wynaut.dae"]],
  362: [["Standard","Glalie/Glalie_ColladaMax.DAE"],["Mega","Glalie/GlalieMega_ColladaMax.DAE"]],
  363: [["Standard","Spheal/Spheal.dae"]],
  369: [["Standard","Relicanth/pm0369_00.dae"],["Alternate 2","Relicanth/pm0369_01.dae"]],
  370: [["Standard","Luvdisc/Luvdisc.dae"]],
  374: [["Standard","Beldum/Beldum.dae"]],
  375: [["Standard","Metang/Metang.dae"]],
  376: [["Standard","Metagross/Metagross_ColladaMax.DAE"],["Mega","Metagross/MetagrossMega_ColladaMax.DAE"]],
  377: [["Standard","Regirock/regirock.dae"]],
  378: [["Standard","regice/regice.dae"]],
  379: [["Standard","Registeel/Registeel.dae"]],
  380: [["Standard","Latias/Latias_ColladaMax.DAE"],["Mega","Latias/LatiasMega_ColladaMax.DAE"]],
  381: [["Standard","Latios/Latios_ColladaMax.DAE"],["Mega","Latios/LatiosMega_ColladaMax.DAE"]],
  382: [["Standard","Kyogre/Kyogre_OpenCollada.DAE"],["Primal","Kyogre/KyogrePrimal_OpenCollada.DAE"]],
  383: [["Standard","Groudon/Groudon_OpenCollada.DAE"],["Primal","Groudon/GroudonPrimal_OpenCollada.DAE"]],
  384: [["Standard","Rayquaza/Rayquaza_OpenCollada.DAE"],["Mega","Rayquaza/RayquazaMega_OpenCollada.DAE"]],
  385: [["Standard","Jirachi/Jirachi_ColladaMax.DAE"]],
  386: [["Standard","Deoxys/DeoxysNormal_OpenCollada.DAE"],["Attack","Deoxys/DeoxysAttack_OpenCollada.DAE"],["Defense","Deoxys/DeoxysDefense_OpenCollada.DAE"],["Speed","Deoxys/DeoxysSpeed_OpenCollada.DAE"]],
  389: [["Standard","Torterra/Torterra.dae"]],
  393: [["Standard","Piplup/Piplup.dae"]],
  395: [["Standard","Empoleon/Empoleon.dae"]],
  399: [["Standard","Bidoof/Bidoof.dae"],["Female","Bidoof/Bidoof_F.dae"]],
  400: [["Standard","Bibarel/pm0400_00.dae"],["Alternate 2","Bibarel/pm0400_01.dae"]],
  401: [["Male","Kricketot/KricketotM_OpenCollada.DAE"],["Female","Kricketot/KricketotF_OpenCollada.DAE"]],
  402: [["Male","Kricketune/KricketuneM_OpenCollada.DAE"],["Female","Kricketune/KricketuneF_OpenCollada.DAE"]],
  405: [["Male","Luxray/Luxray_M.dae"],["Female","Luxray/Luxray_F.dae"]],
  406: [["Standard","Budew/Budew.dae"]],
  407: [["Male","Roserade/RoseradeM_ColladaMax.DAE"],["Female","Roserade/RoseradeF_ColladaMax.DAE"]],
  408: [["Standard","Cranidos/Cranidos.dae"]],
  409: [["Standard","Rampardos/Rampardos_ColladaMax.DAE"]],
  410: [["Standard","Shieldon/Shieldon.dae"]],
  411: [["Standard","Bastiodon/Bastiodon.dae"]],
  415: [["Standard","Combee/pm0415_00.dae"],["Alternate 2","Combee/pm0415_01.dae"]],
  416: [["Standard","Vespiquen/pm0416_00.dae"]],
  417: [["Male","Pachirisu/PachirisuM_ColladaMax.DAE"],["Female","Pachirisu/PachirisuF_ColladaMax.DAE"]],
  418: [["Male","Buizel/BuizelM_OpenCollada.DAE"],["Female","Buizel/BuizelF_OpenCollada.DAE"]],
  419: [["Male","Floatzel/FloatzelM_ColladaMax.DAE"],["Female","Floatzel/FloatzelF_ColladaMax.DAE"]],
  420: [["Standard","Cherubi/pm0420_00.dae"]],
  422: [["Standard","Shellos/Shellos.dae"],["East","Shellos/ShellosEast.dae"]],
  423: [["Standard","Gastrodon/Gastrodon.dae"],["East","Gastrodon/Gastrodon East.dae"]],
  427: [["Standard","Buneary/Buneary_ColladaMax.DAE"]],
  428: [["Standard","Lopunny/Lopunny_ColladaMax.DAE"],["Mega","Lopunny/LopunnyMega_ColladaMax.DAE"]],
  437: [["Standard","Bronzong/pm0437_00.dae"]],
  443: [["Male","Gible/GibleM_ColladaMax.DAE"],["Female","Gible/GibleF_ColladaMax.DAE"]],
  444: [["Male","Gabite/GabiteM_OpenCollada.DAE"],["Female","Gabite/GabiteF_OpenCollada.DAE"]],
  445: [["Male","Garchomp/GarchompM_OpenCollada.DAE"],["Female","Garchomp/GarchompF_OpenCollada.DAE"],["Mega","Garchomp/GarchompMega_OpenCollada.DAE"]],
  447: [["Standard","Riolu/Riolu_ColladaMax.DAE"]],
  448: [["Standard","Lucario/Lucario_ColladaMax.DAE"],["Mega","Lucario/LucarioMega_ColladaMax.DAE"]],
  461: [["Male","Weavile/WeavileM_ColladaMax.DAE"],["Female","Weavile/WeavileF_ColladaMax.DAE"]],
  465: [["Standard","Tangrowth/pm0465_00.dae"],["Alternate 2","Tangrowth/pm0465_01.dae"]],
  466: [["Standard","Electivire/pm0466_00.dae"]],
  468: [["Standard","Togekiss/Togekiss.dae"]],
  469: [["Standard","Yanmega/Yanmega_ColladaMax.DAE"]],
  470: [["Standard","Leafeon/Leafeon_ColladaMax.DAE"]],
  471: [["Standard","Glaceon/Glaceon_ColladaMax.DAE"]],
  474: [["Standard","Porygon-Z/Porygon-Z_ColladaMax.DAE"]],
  475: [["Standard","Gallade/Gallade_ColladaMax.DAE"],["Mega","Gallade/GalladeMega_ColladaMax.DAE"]],
  479: [["Standard","Rotom/Rotom_ColladaMax.DAE"],["Fan","Rotom/RotomFan_ColladaMax.DAE"],["Frost","Rotom/RotomFrost_ColladaMax.DAE"],["Heat","Rotom/RotomHeat_ColladaMax.DAE"],["Mow","Rotom/RotomMow_ColladaMax.DAE"],["Wash","Rotom/RotomWash_ColladaMax.DAE"]],
  483: [["Standard","Dialga/Dialga_ColladaMax.DAE"]],
  484: [["Standard","Palkia/Palkia_OpenCollada.DAE"]],
  485: [["Standard","Heatran/pm0485_00.dae"]],
  486: [["Standard","Regigigas/pm0486_00.dae"]],
  487: [["Standard","Giratina/Giratina_ColladaMax.DAE"],["Origin","Giratina/GiratinaOrigin_ColladaMax.DAE"]],
  488: [["Standard","Cresselia/Cresselia_ColladaMax.DAE"]],
  491: [["Standard","Darkrai/pm0491_00.dae"]],
  492: [["Land","Shaymin/Shaymin Land Forme/Shaymin (Land) .dae"],["Sky","Shaymin/Shaymin Sky Forme/Shaymin (sky).dae"]],
  493: [["Standard","Arceus/Arceus_ColladaMax.DAE"]],
  494: [["Standard","Victini/Victini.dae"]],
  495: [["Standard","Snivy/Snivy_OpenCollada.DAE"]],
  496: [["Standard","Servine/Servine_OpenCollada.DAE"]],
  497: [["Standard","Serperior/Serperior_OpenCollada.DAE"]],
  498: [["Standard","498. Tepig/tepig.dae"]],
  499: [["Standard","Pignite/pm0499_00.dae"]],
  500: [["Standard","Emboar/Emboar.dae"]],
  501: [["Standard","Oshawott/Oshawott.dae"]],
  502: [["Standard","Dewott/Dewott.dae"]],
  503: [["Standard","Samurott/Samurott_OpenCollada.DAE"]],
  506: [["Standard","Lillipup/Lillipup_ColladaMax.DAE"]],
  507: [["Standard","Herdier/Herdier_ColladaMax.DAE"]],
  508: [["Standard","Stoutland/Stoutland_ColladaMax.DAE"]],
  509: [["Standard","Purrloin/model.dae"]],
  515: [["Standard","515. Panpour/panpour.dae"]],
  516: [["Standard","516. Simipour/simipour.dae"]],
  519: [["Standard","Pidove/pm0519_00.dae"]],
  524: [["Standard","Roggenrola/pm0524_00.dae"]],
  527: [["Standard","527. Woobat/woobat.dae"]],
  531: [["Standard","Audino/Audino_ColladaMax.DAE"],["Mega","Audino/AudinoMega_ColladaMax.DAE"]],
  545: [["Standard","#545 Scolipede/Scolipede.dae"]],
  549: [["Standard","Lilligant/Lilligant_ColladaMax.DAE"]],
  553: [["Standard","Krookodile/Krookodile_ColladaMax.DAE"]],
  556: [["Standard","Maractus/pm0556_00.dae"]],
  558: [["Standard","Crustle/pm0558_00.dae"]],
  560: [["Standard","Scrafty/Scrafty_ColladaMax.DAE"]],
  566: [["Standard","Archen/Archen_ColladaMax.DAE"]],
  570: [["Standard","Zorua/Zorua_ColladaMax.DAE"]],
  571: [["Standard","Zoroark/Zoroark_ColladaMax.DAE"]],
  572: [["Standard","Minccino/pm0572_00.dae"]],
  577: [["Standard","Solosis/pm0577_00.dae"]],
  583: [["Standard","583. Vanillish/vanillish.dae"]],
  584: [["Standard","Vanilluxe/model.dae"]],
  587: [["Standard","Emolga/Emolga_ColladaMax.DAE"]],
  589: [["Standard","Escavalier/Escavalier_ColladaMax.DAE"]],
  590: [["Standard","Foongus/pm0590_00.dae"]],
  594: [["Standard","Alomomola/pm0594_00.dae"]],
  595: [["Standard","Joltik/pm0595_00.dae"]],
  599: [["Standard","Klink/pm0599_00.dae"]],
  600: [["Standard","Klang/pm0600_00.dae"]],
  601: [["Standard","Klinklang/pm0601_00.dae"]],
  619: [["Standard","Mienfoo/Mienfoo_ColladaMax.DAE"]],
  620: [["Standard","Mienshao/Mienshao_ColladaMax.DAE"]],
  621: [["Standard","Druddigon/Druddigon_ColladaMax.DAE"]],
  623: [["Standard","Golurk/model.dae"]],
  625: [["Standard","Bisharp/Bisharp_ColladaMax.DAE"]],
  633: [["Standard","Deino/Deino.dae"]],
  634: [["Standard","Zweilous/Zweilous.dae"]],
  635: [["Standard","Hydreigon/Hydreigon_ColladaMax.DAE"]],
  637: [["Standard","Volcarona/Volcarona.dae"]],
  638: [["Standard","Cobalion/Cobalion_ColladaMax.DAE"]],
  639: [["Standard","Terrakion/Terrakion_ColladaMax.DAE"]],
  640: [["Standard","Virizion/Virizion_ColladaMax.DAE"]],
  641: [["Standard","Tornadus/Tornadus_OpenCollada.DAE"],["Therian","Tornadus/TornadusTherian_OpenCollada.DAE"]],
  642: [["Standard","Thundurus/Thundurus_OpenCollada.DAE"],["Therian","Thundurus/ThundurusTherian_OpenCollada.DAE"]],
  643: [["Standard","Reshiram/Reshiram_ColladaMax.DAE"]],
  644: [["Standard","Zekrom/Zekrom_ColladaMax.DAE"]],
  645: [["Standard","Landorus/Landorus_OpenCollada.DAE"],["Therian","Landorus/LandorusTherian_OpenCollada.DAE"]],
  646: [["Standard","Kyurem/Kyurem_ColladaMax.DAE"],["Black","Kyurem/KyuremBlack_ColladaMax.DAE"],["White","Kyurem/KyuremWhite_ColladaMax.DAE"]],
  647: [["Standard","Keldeo/Keldeo_ColladaMax.DAE"],["Resolute","Keldeo/KeldeoResolute_ColladaMax.DAE"]],
  648: [["Standard","Meloetta/MeloettePirouette_ColladaMax.DAE"],["Aria","Meloetta/MeloettaAria_ColladaMax.DAE"]],
  649: [["Standard","Genesect/Genesect_ColladaMax.DAE"]],
  650: [["Standard","Chespin/Chespin_ColladaMax.DAE"]],
  651: [["Standard","Quilladin/Quilladin_ColladaMax.DAE"]],
  652: [["Standard","Chesnaught/Chesnaught_ColladaMax.DAE"]],
  653: [["Standard","Fennekin/Fennekin_ColladaMax.DAE"]],
  654: [["Standard","Braixen/Braixen_ColladaMax.DAE"]],
  655: [["Standard","Delphox/Delphox_ColladaMax.DAE"]],
  656: [["Standard","Froakie/Froakie_ColladaMax.DAE"]],
  657: [["Standard","Frogadier/Frogadier_ColladaMax.DAE"]],
  658: [["Standard","Greninja/Greninja.DAE"]],
  659: [["Standard","Bunnelby/Bunnelby_OpenCollada.DAE"]],
  660: [["Standard","Diggersby/Diggersby_ColladaMax.DAE"]],
  661: [["Standard","Fletchling/Fletchling_OpenCollada.DAE"]],
  662: [["Standard","Fletchinder/Fletchinder_OpenCollada.DAE"]],
  663: [["Standard","Talonflame/Talonflame_OpenCollada.DAE"]],
  664: [["Standard","Scatterbug/Scatterbug_OpenCollada.DAE"]],
  665: [["Standard","Spewpa/Spewpa_OpenCollada.DAE"]],
  666: [["Standard","Vivillon/Vivillon_ColladaMax.DAE"]],
  667: [["Standard","Litleo/Litleo.DAE"]],
  668: [["Male","Pyroar/PyroarM_OpenCollada.DAE"],["Female","Pyroar/PyroarF_OpenCollada.DAE"]],
  669: [["Standard","Flabébé/Flabébé_ColladaMax.DAE"]],
  670: [["Standard","Floette/Floette_OpenCollada.DAE"],["Eternal","Floette/FloetteEternal_OpenCollada.DAE"]],
  671: [["Standard","Florges/Florges_OpenCollada.DAE"]],
  672: [["Standard 1","Skiddo/Skiddo_OpenCollada.DAE"],["Standard 2","Skiddo/pm0728_00_fi.dae"]],
  673: [["Standard","Gogoat/Gogoat_ColladaMax.DAE"],["Rideable","Rideable Gogoat/pm0729_00_fi.dae"]],
  674: [["Standard","Pancham/Pancham_ColladaMax.DAE"]],
  675: [["Standard","Pangoro/Pangoro_ColladaMax.DAE"]],
  676: [["Standard","Furfrou/Furfrou_OpenCollada.DAE"],["Dandy","Furfrou/FurfrouDandy_OpenCollada.DAE"],["Deputante","Furfrou/FurfrouDeputante_OpenCollada.DAE"],["Diamond","Furfrou/FurfrouDiamond_OpenCollada.DAE"],["Heart","Furfrou/FurfrouHeart_OpenCollada.DAE"],["Kabuki","Furfrou/FurfrouKabuki_OpenCollada.DAE"],["La Reine","Furfrou/FurfrouLaReine_OpenCollada.DAE"],["Matron","Furfrou/FurfrouMatron_OpenCollada.DAE"],["Pharaoh","Furfrou/FurfrouPharaoh_OpenCollada.DAE"],["Star","Furfrou/FurfrouStar_OpenCollada.DAE"]],
  677: [["Standard","Espurr/Espurr_ColladaMax.DAE"]],
  678: [["Male","Meowstic/MeowsticM_ColladaMax.DAE"],["Female","Meowstic/MeowsticF_ColladaMax.DAE"]],
  679: [["Standard","Honedge/Honedge_ColladaMax.DAE"]],
  680: [["Standard","Doublade/Doublade_ColladaMax.DAE"]],
  681: [["Standard","Aegislash/Aegislash.DAE"]],
  682: [["Standard","Spritzee/Spritzee_ColladaMax.DAE"]],
  683: [["Standard","Aromatisse/Aromatisse_ColladaMax.DAE"]],
  684: [["Standard","Swirlix/Swirlix_ColladaMax.DAE"]],
  685: [["Standard","Slurpuff/Slurpuff_OpenCollada.DAE"]],
  686: [["Standard","Inkay/Inkay_ColladaMax.DAE"]],
  687: [["Standard","Malamar/Malamar_OpenCollada.DAE"]],
  688: [["Standard","Binacle/Binacle_OpenCollada.DAE"]],
  689: [["Standard","Barbaracle/Barbaracle_ColladaMax.DAE"]],
  690: [["Standard","Skrelp/Skrelp_OpenCollada.DAE"]],
  691: [["Standard","Dragalge/Dragalge_OpenCollada.DAE"]],
  692: [["Standard","Clauncher/Clauncher_ColladaMax.DAE"]],
  693: [["Standard","Clawitzer/Clawitzer_OpenCollada.DAE"]],
  694: [["Standard","Helioptile/Helioptile_ColladaMax.DAE"]],
  695: [["Standard","Heliolisk/Heliolisk_OpenCollada.DAE"]],
  696: [["Standard","Tyrunt/Tyrunt_ColladaMax.DAE"]],
  697: [["Standard","Tyrantrum/Tyrantrum_ColladaMax.DAE"]],
  698: [["Standard","Amaura/Amaura_OpenCollada.DAE"]],
  699: [["Standard","Aurorus/Aurorus_ColladaMax.DAE"]],
  700: [["Standard","Sylveon/Sylveon_ColladaMax.DAE"]],
  701: [["Standard","Hawlucha/Hawlucha_ColladaMax.DAE"]],
  702: [["Standard","Dedenne/Dedenne_ColladaMax.DAE"]],
  703: [["Standard","Carbink/Carbink_ColladaMax.DAE"]],
  704: [["Standard","Goomy/Goomy_ColladaMax.DAE"]],
  705: [["Standard","Sliggoo/Sliggoo_ColladaMax.DAE"]],
  706: [["Standard","Goodra/Goodra_ColladaMax.DAE"]],
  707: [["Standard","Klefki/Klefki_ColladaMax.DAE"]],
  708: [["Standard","Phantump/Phantump_OpenCollada.DAE"]],
  709: [["Standard","Trevenant/Trevenant_OpenCollada.DAE"]],
  710: [["Standard","Pumpkaboo/Pumpkaboo_ColladaMax.DAE"],["Super Size","Pumpkaboo/PumpkabooSuperSize_ColladaMax.DAE"]],
  711: [["Standard","Gourgeist/Gourgeist_ColladaMax.DAE"],["Super","Gourgeist/GourgeistSuper_ColladaMax.DAE"]],
  712: [["Standard","Bergmite/Bergmite_OpenCollada.DAE"]],
  713: [["Standard","Avalugg/Avalugg_OpenCollada.DAE"]],
  714: [["Standard","Noibat/Noibat_ColladaMax.DAE"]],
  715: [["Standard","Noivern/Noivern_ColladaMax.DAE"]],
  716: [["Standard 1","Xerneas/Xerneas_ColladaMax.DAE"],["Standard 2","Xerneas/pm0768_00_fi.dae"],["Neutral","Xerneas/XerneasNeutral_ColladaMax.DAE"]],
  717: [["Standard 1","Yveltal/Yveltal_ColladaMax.DAE"],["Standard 2","Yveltal/pm0769_00_fi.dae"]],
  718: [["Standard 1","Zygarde/Zygarde_ColladaMax.DAE"],["Standard 2","Zygarde/pm0770_00_fi.dae"]],
  719: [["Standard","Diancie/Diancie_ColladaMax.DAE"],["Mega","Diancie/DiancieMega_ColladaMax.DAE"]],
  720: [["Standard","Hoopa/Hoopa_ColladaMax.DAE"],["Unbound","Hoopa/HoopaUnbound_ColladaMax.DAE"]],
  721: [["Standard","Volcanion/Volcanion_OpenCollada.DAE"]],
};
// models/dex-index.json (written by models/build-dex-index.ps1) lists the animated Pokédex 3D Pro (Gen 1-5) and
// Sun/Moon (Gen 7) models; they go ahead of the X/Y forms above. Paths starting p3d/ or sm/ are relative to models/.
for (const [id, forms] of Object.entries(await fetch('models/dex-index.json').then(r => r.ok ? r.json() : {}).catch(() => ({}))))
  DEX_MODELS[id] = [...forms.map(([label, path]) => [label.replace('Pokedex', 'Pokédex'), path]), ...(DEX_MODELS[id] || [])];
const DEX_TEXTURE_FIXES = {
  "Bibarel/pm0400_00.dae": {
    "/C:/Users/Alex/Documents/Models/Pokemon/Pokemon/Gen%204/Bibarel/Textures/pm0400_00_Eye1.png": "Textures/pm0400_00_Eye1.png",
    "/C:/Users/Alex/Documents/Models/Pokemon/Pokemon/Gen%204/Bibarel/Textures/pm0400_00_Body1.png": "Textures/pm0400_00_Body1.png"
  },
  "Bibarel/pm0400_01.dae": {
    "/C:/Users/Alex/Documents/Models/Pokemon/Pokemon/Gen%204/Bibarel/Textures/pm0400_00_Eye1.png": "Textures/pm0400_00_Eye1.png",
    "/C:/Users/Alex/Documents/Models/Pokemon/Pokemon/Gen%204/Bibarel/Textures/pm0400_00_Body1.png": "Textures/pm0400_00_Body1.png"
  },
  "Drowzee/Drowzee.dae": {
    "/Textures/pm0096_00_Body1.png.png": "Textures/pm0096_00_Body1.png.png",
    "/Textures/pm0096_00_Eye1.png.png": "Textures/pm0096_00_Eye1.png.png"
  },
  "Electabuzz/Electabuzz.dae": {
    "/Textures/pm0125_00_Body1.png": "Textures/pm0125_00_Body1.png",
    "/Textures/pm0125_00_Eye1.png": "Textures/pm0125_00_Eye1.png"
  },
  "Electrode/Electrode.dae": {
    "/Textures/pm0101_00_Body1.png": "Textures/pm0101_00_Body1.png",
    "/Textures/pm0101_00_Mouth1.tga.png": "Textures/pm0101_00_Mouth1.tga.png",
    "/Textures/pm0101_00_Eye1.png": "Textures/pm0101_00_Eye1.png"
  },
  "Haunter/Haunter.dae": {
    "/Textures/pm0093_00_Body1.png": "Textures/pm0093_00_Body1.png",
    "/Textures/pm0093_00_Eye1.png": "Textures/pm0093_00_Eye1.png"
  },
  "Hitmonlee/Hitmonlee.dae": {
    "/Textures/pm0106_00_Body1.png": "Textures/pm0106_00_Body1.png",
    "/Textures/pm0106_00_Eye1.png": "Textures/pm0106_00_Eye1.png"
  },
  "Jynx/Jynx.dae": {
    "/Textures/pm0124_00_Body1.png": "Textures/pm0124_00_Body1.png",
    "/Textures/pm0124_00_Eye1.png": "Textures/pm0124_00_Eye1.png"
  },
  "Kabuto/Kabuto.dae": {
    "/Textures/pm0140_00_BodyA1.png": "Textures/pm0140_00_BodyA1.png",
    "/Textures/pm0140_00_BodyB1.png": "Textures/pm0140_00_BodyB1.png"
  },
  "Kabutops/Kabutops.dae": {
    "/Textures/pm0141_00_Body1.png": "Textures/pm0141_00_Body1.png",
    "/Textures/pm0141_00_Eye1.png": "Textures/pm0141_00_Eye1.png"
  },
  "Krabby/Krabby.dae": {
    "/Textures/pm0098_00_Body1.png": "Textures/pm0098_00_Body1.png",
    "/Textures/pm0098_00_Eye1.png": "Textures/pm0098_00_Eye1.png"
  },
  "Lapras/Lapras.dae": {
    "/Textures/pm0131_00_BodyA1.png": "Textures/pm0131_00_BodyA1.png",
    "/Textures/pm0131_00_Eye1.png": "Textures/pm0131_00_Eye1.png",
    "/Textures/pm0131_00_BodyB1.tga.png": "Textures/pm0131_00_BodyB1.tga.png"
  },
  "Lickitung/Lickitung.dae": {
    "/Textures/pm0108_00_Body1.png": "Textures/pm0108_00_Body1.png",
    "/Textures/pm0108_00_Eye1.png": "Textures/pm0108_00_Eye1.png"
  },
  "Rapidash/Rapidash_OpenCollada.DAE": {
    "file://pm0078_00_FireCore1.png": "images/pm0078_00_FireCore1.png",
    "file://pm0078_00_FireSten1.png": "images/pm0078_00_FireSten1.png"
  },
  "Rhyhorn/Rhyhorn.dae": {
    "/Textures/pm0111_00_BodyA1.png": "Textures/pm0111_00_BodyA1.png",
    "/Textures/pm0111_00_BodyB1.png": "Textures/pm0111_00_BodyB1.png",
    "/Textures/pm0111_00_Eye1.png": "Textures/pm0111_00_Eye1.png"
  },
  "Seadra/Seadra.dae": {
    "/Textures/pm0117_00_Eye1.png": "Textures/pm0117_00_Eye1.png",
    "/Textures/pm0117_00_Body1.png": "Textures/pm0117_00_Body1.png"
  },
  "Tangela/Tangela.dae": {
    "/Textures/pm0114_00_BodyA1.tga.png": "Textures/pm0114_00_BodyA1.tga.png",
    "/Textures/pm0114_00_BodyB1.tga.png": "Textures/pm0114_00_BodyB1.tga.png",
    "/Textures/pm0114_00_Eye1.png": "Textures/pm0114_00_Eye1.png"
  },
  "Tauros/Tauros.dae": {
    "/Textures/pm0128_00_Body1.png": "Textures/pm0128_00_Body1.png",
    "/Textures/pm0128_00_Eye1.png": "Textures/pm0128_00_Eye1.png"
  },
  "Weezing/Weezing.dae": {
    "/Textures/pm0110_00_FireCoreA1.tga.png": "Textures/pm0110_00_FireCoreA1.tga.png",
    "/Textures/pm0110_00_FireGeomA.tga.png": "Textures/pm0110_00_FireGeomA.tga.png",
    "/Textures/pm0110_00_FireCoreB1.tga.png": "Textures/pm0110_00_FireCoreB1.tga.png",
    "/Textures/pm0110_00_BodyA1.tga.png": "Textures/pm0110_00_BodyA1.tga.png",
    "/Textures/pm0110_00_BodyB1.tga.png": "Textures/pm0110_00_BodyB1.tga.png",
    "/Textures/pm0110_00_Eye1.png": "Textures/pm0110_00_Eye1.png",
    "/Textures/pm0110_00_FireStenA.tga.png": "Textures/pm0110_00_FireStenA.tga.png"
  }
};
const DEX_DISPLAY = { 'nidoran-f': 'Nidoran ♀', 'nidoran-m': 'Nidoran ♂', 'mr-mime': 'Mr. Mime', 'mime-jr': 'Mime Jr.', 'farfetchd': 'Farfetch’d', 'sirfetchd': 'Sirfetch’d', 'type-null': 'Type: Null', 'flabebe': 'Flabébé', 'ho-oh': 'Ho-Oh', 'porygon-z': 'Porygon-Z', 'jangmo-o': 'Jangmo-o', 'hakamo-o': 'Hakamo-o', 'kommo-o': 'Kommo-o', 'wo-chien': 'Wo-Chien', 'chien-pao': 'Chien-Pao', 'ting-lu': 'Ting-Lu', 'chi-yu': 'Chi-Yu' };
const NATIONAL_DEX = NATIONAL_NAMES.map((slug, index) => ({ id: index + 1, slug, key: DEX_GAME_SPECIES[index + 1], models: DEX_MODELS[index + 1] || [], name: DEX_DISPLAY[slug] || slug.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join(' ') }));
const dexReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const DX = { selected: 1, form: 0, filter: 'all', request: 0, abort: null, loading: false, kit: null, models: new Map(), model: null, motion: !dexReducedMotion.matches, spin: !dexReducedMotion.matches, time: 0, previousFocus: null, failed: false };
const dexNumber = id => '#' + String(id).padStart(4, '0');
const dexArtwork = id => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
const dexNormalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9♀♂]/g, '');
function filteredDex(query, onlyModels) {
  const q = dexNormalize(query);
  return NATIONAL_DEX.filter(entry => (!onlyModels || entry.models.length) && (!q || dexNormalize(entry.name).includes(q) || dexNormalize(entry.slug).includes(q) || String(entry.id) === q.replace(/^0+/, '') || String(entry.id).padStart(4, '0').includes(q)));
}
function renderDexCatalog() {
  const entries = filteredDex($('dexSearch').value, DX.filter === 'models');
  for (const tab of $('dexTabs').children) tab.setAttribute('aria-selected', String(tab.dataset.f === DX.filter));
  $('dexCount').textContent = `${entries.length.toLocaleString()} of ${NATIONAL_DEX.length.toLocaleString()} shown · catalog and sprites: PokéAPI`;
  $('dexList').innerHTML = entries.length ? entries.map(entry => `<button class="bp-item" role="option" data-id="${entry.id}" aria-selected="${entry.id === DX.selected}" aria-label="${dexNumber(entry.id)} ${entry.name}, ${entry.models.length ? '3D available' : 'no 3D model'}"><span class="dex-art" aria-hidden="true">${entry.name.slice(0, 2)}<img src="${dexArtwork(entry.id)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span><span>${entry.name}<small>${dexNumber(entry.id)}</small></span><span class="qty">${entry.models.length ? '3D' : ''}</span></button>`).join('') : '<div class="bp-empty">No Pokémon found. Try another name or number, or show All.</div>';
}
function dexShow(filter) { // the bag's pocket switch: re-list and give the lens a wiggle
  if (filter === DX.filter) return;
  DX.filter = filter; renderDexCatalog();
  const lens = $('dexLens').firstElementChild; lens.classList.remove('wiggle'); void lens.offsetWidth; lens.classList.add('wiggle');
}
function dexStep(d) { // the bag's ↑/↓: move the selection through the visible list
  const list = filteredDex($('dexSearch').value, DX.filter === 'models'); if (!list.length) return;
  const i = list.findIndex(e => e.id === DX.selected);
  selectDex(list[clamp(i < 0 ? 0 : i + d, 0, list.length - 1)].id);
  const row = $('dexList').querySelector('[aria-selected="true"]');
  if (document.activeElement?.closest('#dexList')) row?.focus(); else row?.scrollIntoView({ block: 'nearest' });
}
function dexKey(e) {
  if (e.code === 'Escape') { e.preventDefault(); return closePokedex(); }
  const field = e.target.tagName;
  if (field === 'SELECT') return; // the form picker keeps its own arrows; the 3D view stops its own
  if (e.code === 'ArrowDown' || e.code === 'ArrowUp') { e.preventDefault(); dexStep(e.code === 'ArrowDown' ? 1 : -1); }
  else if ((e.code === 'ArrowRight' || e.code === 'ArrowLeft') && field !== 'INPUT') { e.preventDefault(); dexShow(DX.filter === 'all' ? 'models' : 'all'); }
}
function initDexViewer() {
  if (DX.kit) return DX.kit;
  const r = new THREE.WebGLRenderer({ canvas: $('dexCanvas'), antialias: true, alpha: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15;
  const s = new THREE.Scene(); s.add(new THREE.HemisphereLight('#e8ffff', '#44516b', 2.4));
  const key = new THREE.DirectionalLight('#fff3df', 3); key.position.set(3, 5, 6); s.add(key);
  const rim = new THREE.DirectionalLight('#78ebff', 2); rim.position.set(-3, 2, -3); s.add(rim);
  const cam = new THREE.PerspectiveCamera(34, 1, 0.01, 100), pivot = new THREE.Group(); s.add(pivot);
  const controls = new OrbitControls(cam, r.domElement); controls.enablePan = false; controls.enableDamping = true;
  controls.dampingFactor = .09; controls.rotateSpeed = .65; controls.autoRotateSpeed = 1.2;
  controls.minPolarAngle = .15; controls.maxPolarAngle = Math.PI * .9;
  DX.kit = { r, s, cam, pivot, controls, width: 0, height: 0, radius: 1 };
  return DX.kit;
}
function resetDexView() {
  if (!DX.kit || !DX.model) return;
  const { cam, controls, radius } = DX.kit;
  const distance = radius / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2)) * 1.15 / Math.min(1, cam.aspect);
  controls.target.set(0, 0, 0); cam.position.set(distance * .23, distance * .14, distance); cam.lookAt(controls.target);
  controls.minDistance = radius * 1.3; controls.maxDistance = distance * 2.4;
  controls.saveState(); controls.reset();
}
function resizeDexViewer() {
  if (!DX.kit) return;
  const { r, cam } = DX.kit, { clientWidth: w, clientHeight: h } = $('dexStage');
  if (!w || !h || (DX.kit.width === w && DX.kit.height === h)) return;
  DX.kit.width = w; DX.kit.height = h; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); resetDexView();
}
function syncDexControls() {
  $('dexMotion').textContent = DX.motion ? 'Pause' : 'Play'; $('dexMotion').setAttribute('aria-pressed', String(DX.motion));
  $('dexSpin').textContent = `Spin: ${DX.spin ? 'on' : 'off'}`; $('dexSpin').setAttribute('aria-pressed', String(DX.spin));
  for (const id of ['dexMotion', 'dexSpin', 'dexReset']) $(id).disabled = !DX.model;
}
function disposeDexObject(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(o => {
    if (o.geometry) geometries.add(o.geometry);
    for (const m of [o.material].flat().filter(Boolean)) {
      materials.add(m);
      for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
    }
  });
  textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose()); geometries.forEach(g => g.dispose());
}
function makeDexHolder(model, owned, textureWarnings = 0, animations = []) {
  const mixer = animations.length ? new THREE.AnimationMixer(model) : null;
  let bounds;
  if (mixer) { // frame the whole motion (hops and all), not just the rest pose
    const clip = animations[0]; mixer.clipAction(clip).play(); bounds = new THREE.Box3();
    for (let k = 0; k <= 12; k++) { mixer.setTime(clip.duration * k / 12); bounds.union(bodyBounds(model)); }
    mixer.setTime(0);
  } else bounds = bodyBounds(model);
  const center = bounds.getCenter(new V3());
  const radius = bounds.getSize(new V3()).length() / 2;
  if (bounds.isEmpty() || !Number.isFinite(radius) || radius <= 0) throw new Error('Model has no visible bounds');
  model.position.sub(center);
  const holder = new THREE.Group(), fit = new THREE.Group(); fit.add(model); fit.scale.setScalar(1 / radius); holder.add(fit);
  holder.userData = { inner: model, radius: 1, owned, textureWarnings, mixer };
  return holder;
}
function waitDexTextures(done, signal) {
  return new Promise((resolve, reject) => {
    const finish = error => { clearTimeout(timer); signal.removeEventListener('abort', cancel); error ? reject(error) : resolve(); };
    const cancel = () => finish(new DOMException('Preview superseded', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('Texture loading timed out')), 30000);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel(); else done.then(() => finish());
  });
}
async function loadDexModel(entry, form, signal) {
  // Preserve the town's prepared poses and custom motion for its original eight species.
  // (animated Pokédex 3D Pro files load directly so the viewer shows their full motion)
  const species = entry.key && SPECIES[entry.key];
  if (form === 0 && species && !/^p3d\//.test(entry.models[0]?.[1])) return makeDexHolder(species.make(), false);
  const path = entry.models[form][1], base = /^(p3d|sm|chars)\//.test(path) ? 'models/' : 'models/xy/';
  const url = new URL(base + path.split('/').map(encodeURIComponent).join('/'), location.href);
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Model request failed (${response.status})`);
  let source = await response.text();
  const overrides = DEX_TEXTURE_FIXES[path];
  if (overrides) {
    const xml = new DOMParser().parseFromString(source, 'application/xml');
    for (const image of xml.getElementsByTagName('image')) {
      const ref = image.getElementsByTagName('init_from')[0], replacement = ref && overrides[ref.textContent.trim()];
      if (replacement) ref.textContent = replacement;
    }
    source = new XMLSerializer().serializeToString(xml);
  }
  const manager = new THREE.LoadingManager(); let began = false, warnings = 0, finishTextures;
  // Golurk's export references a missing white placeholder; its body textures are present.
  const modelDir = new URL('.', url).href;
  manager.setURLModifier(u => {
    if (path === 'Golurk/model.dae' && /(?:^|\/)DummyTex\.png$/i.test(u))
      return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3Cpath fill="white" d="M0 0h1v1H0z"/%3E%3C/svg%3E';
    // some rips point at the ripper's own folders (../../../GMod/PokemonSM/Stufful/images/...); the files sit next to the model
    if (/\.(png|tga)$/i.test(u) && (u.includes('/../') || !u.startsWith(modelDir)) && !u.startsWith('data:')) return modelDir + (/\/images\//i.test(u) ? 'images/' : '') + u.split('/').pop();
    return u;
  });
  const texturesDone = new Promise(resolve => { finishTextures = resolve; });
  manager.onStart = () => { began = true; }; manager.onLoad = finishTextures; manager.onError = () => { warnings++; };
  let collada;
  try {
    collada = new ColladaLoader(manager).parse(source, new URL('.', url).href);
    if (began) await waitDexTextures(texturesDone, signal);
    if (signal.aborted) throw new DOMException('Preview superseded', 'AbortError');
    const names = {};
    for (const node of Object.values(collada.library.nodes)) if (node.type === 'JOINT' && node.sid) names[node.sid] = node.name;
    collada.scene.traverse(o => {
      if (o.isBone && names[o.name]) o.name = names[o.name];
      if (!o.isMesh) return;
      if (!o.geometry.attributes.uv && o.geometry.attributes.uv1) o.geometry.setAttribute('uv', o.geometry.attributes.uv1);
      for (const material of [o.material].flat()) {
        if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
        material.side = THREE.DoubleSide; material.alphaTest = Math.max(material.alphaTest || 0, .25);
        if (mostlyBlack(material.map?.image)) Object.assign(material, { blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, alphaTest: 0 }); // see prepXY
        if (EFFECT_MAT.test(material.name)) material.visible = false;
      }
      o.frustumCulled = false;
    });
    return makeDexHolder(collada.scene, true, warnings, (collada.animations || []).map(c => quietClip(collada.scene, cleanClip(c), true, true))); // the viewer shows the full motion, hops and turns included
  } catch (error) {
    if (collada) {
      disposeDexObject(collada.scene);
      // Image requests already started by ColladaLoader can finish after cancellation.
      manager.onLoad = () => disposeDexObject(collada.scene);
    }
    throw error;
  }
}
function cacheDexModel(key, model) {
  DX.models.delete(key); DX.models.set(key, model);
  while (DX.models.size > 6) {
    const oldest = [...DX.models.keys()].find(k => k !== key && DX.models.get(k) !== DX.model);
    if (oldest === undefined) break;
    const evicted = DX.models.get(oldest); DX.models.delete(oldest);
    if (evicted.userData.owned) {
      evicted.userData.mixer?.stopAllAction(); evicted.userData.mixer?.uncacheRoot(evicted.userData.inner);
      disposeDexObject(evicted);
    }
  }
}
function syncDexPreview(entry) {
  $('dexStage').setAttribute('aria-busy', String(DX.loading));
  $('dexCanvas').hidden = !DX.model; $('dexUnavailable').hidden = !!DX.model;
  $('dexFallbackArt').hidden = false; $('dexFallbackArt').src = dexArtwork(entry.id);
  $('dexUnavailableTitle').textContent = DX.loading ? 'Loading 3D model…' : DX.failed ? '3D preview unavailable' : '3D model unavailable';
  $('dexUnavailableText').textContent = DX.loading ? 'Preparing this Pokémon and its textures.' : DX.failed ? 'This model could not be loaded. Select this entry again to retry, or try another form.' : 'This Pokémon is in the National archive. Its 3D model has not been added to Verdant Town.';
  $('dexStatus').textContent = DX.model ? DX.model.userData.textureWarnings ? '● LIVE 3D / SOME TEXTURES UNAVAILABLE' : '● LIVE 3D / INTERACTIVE VIEW' : DX.loading ? '○ LOADING 3D PREVIEW' : DX.failed ? '○ PREVIEW UNAVAILABLE' : '○ NATIONAL ARCHIVE / NO 3D MODEL';
  $('dexHelp').textContent = DX.model ? 'Drag to rotate · scroll / pinch to zoom · arrow keys to orbit' : DX.loading ? 'You can keep browsing while the preview loads.' : 'Browse the archive, or choose “3D models” to inspect a model.';
  $('dexCanvas').setAttribute('aria-label', `${entry.name} 3D preview. Drag to rotate; use arrow keys to orbit.`);
  syncDexControls();
}
async function selectDex(id, form = 0) {
  const entry = NATIONAL_DEX.find(e => e.id === id); if (!entry) return;
  if (!Number.isInteger(form) || form < 0 || form >= entry.models.length) form = 0;
  DX.abort?.abort(); DX.abort = new AbortController(); const signal = DX.abort.signal, request = ++DX.request;
  DX.selected = id; DX.form = form; DX.time = 0;
  $('dexList').querySelector('[aria-selected="true"]')?.setAttribute('aria-selected', 'false');
  $('dexList').querySelector(`[data-id="${id}"]`)?.setAttribute('aria-selected', 'true');
  $('dexNumber').textContent = `NATIONAL ${dexNumber(id)}`; $('dexName').textContent = entry.name;
  const sp = entry.key && SPECIES[entry.key];
  $('dexTypes').innerHTML = sp ? sp.types.map(t => `<span style="background:${TYPE_COL[t]}">${t}</span>`).join('') : '';
  $('dexStats').innerHTML = sp ? sp.base.map((v, i) => `<div class="dex-stat"><span>${['HP', 'ATTACK', 'DEFENSE', 'SP. ATK', 'SP. DEF', 'SPEED'][i]}</span><span>${v}</span><i><b style="width:${v / 255 * 100}%"></b></i></div>`).join('') : '';
  $('dexFormLabel').hidden = entry.models.length < 2;
  $('dexForm').replaceChildren(...entry.models.map(([label], index) => new Option(label, String(index))));
  $('dexForm').value = String(form);
  if (DX.model) DX.kit.pivot.remove(DX.model);
  DX.model = null; DX.failed = false; DX.loading = !!entry.models.length;
  syncDexPreview(entry);
  if (entry.models.length) {
    try {
      const kit = initDexViewer(), key = `${id}:${form}`;
      const model = DX.models.get(key) || await loadDexModel(entry, form, signal);
      if (request !== DX.request || !ui.pokedex) { if (model.userData.owned && !DX.models.has(key)) disposeDexObject(model); return; }
      cacheDexModel(key, model);
      DX.model = model; kit.pivot.add(DX.model); kit.radius = DX.model.userData.radius;
      DX.model.position.y = 0; DX.model.scale.setScalar(1); DX.model.rotation.set(0, .2, 0);
      resizeDexViewer(); resetDexView();
    } catch (error) {
      if (request !== DX.request || signal.aborted) return;
      if (DX.model) DX.kit.pivot.remove(DX.model);
      DX.model = null; DX.failed = true; console.warn('Pokédex viewer unavailable:', error);
    }
  }
  DX.loading = false; syncDexPreview(entry);
}
function openPokedex() {
  if (ui.battle || ui.dialog || ui.pokedex) return;
  DX.previousFocus = document.activeElement; keys.clear(); setMoveTarget(null); P.v = 0;
  ui.pokedex = true; $('pokedex').showModal();
  const with3d = NATIONAL_DEX.filter(e => e.models.length).length;
  $('dexSummary').textContent = `${NATIONAL_DEX.length.toLocaleString()} species · ${with3d} in 3D`;
  $('dexAllCount').textContent = NATIONAL_DEX.length.toLocaleString(); $('dex3dCount').textContent = with3d;
  renderDexCatalog(); selectDex(DX.selected, DX.form);
  $('dexList').querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); $('dexSearch').focus({ preventScroll: true });
}
function closePokedex() {
  if (!ui.pokedex) return;
  DX.abort?.abort(); DX.request++; DX.loading = false;
  $('pokedex').close(); ui.pokedex = false; keys.clear(); setMoveTarget(null);
  DX.previousFocus?.focus({ preventScroll: true });
}
function tickDex(dt) {
  if (!DX.model || !DX.kit) return;
  resizeDexViewer();
  const { inner } = DX.model.userData, u = inner.userData;
  if (DX.motion) {
    DX.time += dt; const t = DX.time;
    DX.model.userData.mixer?.update(dt);
    DX.model.position.y = u.flies ? .06 + Math.sin(t * 3) * .04 : Math.sin(t * 2.4) * .015;
    const breath = 1 + Math.sin(t * 2.4) * .012; DX.model.scale.set(1, breath, 1);
    if (u.wings) u.wings.forEach((w, i) => swing(w, (i ? -1 : 1) * (.2 + Math.sin(t * 16) * .6)));
    if (u.tail) swing(u.tail, Math.sin(t * 6) * .2);
    if (u.flame) u.flame.scale.set(1 + Math.sin(t * 23) * .12, 1 + Math.sin(t * 17) * .2, 1);
    if (u.leaves) u.leaves.rotation.y = Math.sin(t * 1.5) * .15;
  }
  DX.kit.controls.autoRotate = DX.spin; DX.kit.controls.update(dt); DX.kit.r.render(DX.kit.s, DX.kit.cam);
}
$('dexClose').onclick = closePokedex;
$('pokedex').addEventListener('cancel', e => { e.preventDefault(); closePokedex(); });
$('pokedex').addEventListener('close', () => { if (ui.pokedex) closePokedex(); });
$('pokedex').addEventListener('click', e => { if (e.target === $('pokedex')) closePokedex(); }); // click on the dimmed backdrop
$('dexSearch').addEventListener('input', renderDexCatalog);
$('dexTabs').addEventListener('click', e => { const tab = e.target.closest('[data-f]'); if (tab) dexShow(tab.dataset.f); });
$('dexForm').addEventListener('change', e => { selectDex(DX.selected, Number(e.target.value)); });
$('dexList').addEventListener('click', e => { const row = e.target.closest('[data-id]'); if (row) selectDex(Number(row.dataset.id)); });
// Broken optional sprites reveal the name monogram; catalog and models remain usable.
$('dexList').addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.hidden = true; }, true);
$('dexFallbackArt').addEventListener('error', e => { e.target.hidden = true; });
$('dexMotion').onclick = () => { DX.motion = !DX.motion; syncDexControls(); };
$('dexSpin').onclick = () => { DX.spin = !DX.spin; syncDexControls(); };
$('dexReset').onclick = resetDexView;
$('dexCanvas').addEventListener('keydown', e => {
  if (!DX.kit || !DX.model || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) return;
  e.preventDefault(); e.stopPropagation();
  const { cam, controls } = DX.kit, spherical = new THREE.Spherical().setFromVector3(cam.position.clone().sub(controls.target));
  spherical.theta += e.code === 'ArrowLeft' ? -.13 : e.code === 'ArrowRight' ? .13 : 0;
  spherical.phi = clamp(spherical.phi + (e.code === 'ArrowUp' ? -.1 : e.code === 'ArrowDown' ? .1 : 0), controls.minPolarAngle, controls.maxPolarAngle);
  cam.position.setFromSpherical(spherical).add(controls.target); cam.lookAt(controls.target); controls.update();
});
dexReducedMotion.addEventListener('change', e => { if (e.matches) { DX.motion = false; DX.spin = false; syncDexControls(); } });

export { DEX_MODELS, dexArtwork, dexKey, loadDexModel, openPokedex, tickDex };
