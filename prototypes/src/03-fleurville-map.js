import './02-hero-camera.js'; // first: the modules run in file-number order (see main.js)
import { noise } from './05-paths-raised-plaza-stairs-tall-grass.js';

// ============================================================ Fleurville Town: the second map
// Traced from a top-down Kalos-style town plan (889x632 px, 20 px per metre). It sits far east of Verdant in the same
// scene, beyond the camera's far plane, so both maps share one engine; T (or the south gate) travels between them.
const KX = 300, KS = 20, ROOM_X = 600; // building interiors sit east of ROOM_X
const K = (px, py) => [KX + (px - 444) / KS, (py - 316) / KS];
const inKalos = x => x > KX - 60;
const kRect = (x0, y0, x1, y1) => [...K(x0, y0), ...K(x1, y1)];
const inRect = (x, z, r, pad = 0) => x > r[0] - pad && x < r[2] + pad && z > r[1] - pad && z < r[3] + pad;
const K_PAVE = [[170, 180, 865, 228], [462, 228, 602, 252], [222, 228, 250, 596], [800, 228, 832, 596], [250, 335, 470, 378], [596, 335, 800, 378],
  [250, 478, 800, 522], [508, 228, 556, 480], [660, 522, 722, 660], [585, 132, 862, 180]].map(r => kRect(...r));
const K_DIRT = [kRect(275, -80, 322, 180)], K_FIELDS = [kRect(105, -80, 262, 80), kRect(355, -80, 512, 80)];
const K_FOUNT = K(532, 357), K_PLAZA_R = 3.5, K_WALK = kRect(30, -30, 875, 628), K_SPAWN = K(691, 585);
const kPaved = (x, z) => K_PAVE.some(r => inRect(x, z, r)) || Math.hypot(x - K_FOUNT[0], z - K_FOUNT[1]) < K_PLAZA_R;
const kDirt = (x, z) => K_DIRT.some(r => inRect(x, z, r));
const inKField = (x, z) => K_FIELDS.some(r => inRect(x, z, r)); // the wheat fields are Fleurville's tall grass
const kalosH = (x, z) => kPaved(x, z) || kDirt(x, z) ? 0.03 : 0.03 + noise(x, z) * 0.3;
// townsfolk: X/Y field models in models/xy/<folder>/, sized like the named sculpt (see prepXY), then scaled (default 0.85, as in Verdant).
// (the Blender 2.77 re-exports, e.g. Schoolgirl and Artist, were thought to have broken skin weights; they were laid flat by a wrong Z_UP
// tag, which loadFolk now undoes. Other rips still stand in for the townsfolk ones)
const FOLK = {
  chef: ['Chef/tr0127_00_fi.dae', 'nurse'], waitress: ['Waitress/tr0106_00_fi.dae', 'nurse'], garcon: ['Garçon/tr0147_00_fi.dae', 'nurse'],
  butler: ['Monsieur Butler/tr0068_00_fi.dae', 'nurse'], maid: ['Maid/tr0135_00_fi.dae', 'nurse'], madame: ['Madame/tr0067_00_fi.dae', 'nurse'],
  touristF: ['Tourist Female/tr0065_00_fi.dae', 'nurse'], touristM: ['Tourist Male/tr0064_00_fi.dae', 'nurse'], artist: ['Beauty/tr0069_00_fi.dae', 'nurse'],
  schoolgirl: ['Lass/tr0104_00_fi.dae', 'girl', 0.78], schoolboy: ['Schoolboy/tr0061_00_fi.dae', 'girl', 0.78], preschooler: ['Preschooler (Girl)/tr0053_00_fi.dae', 'kid', 0.6],
  clerk: ['Poke Mart Clerk/tr0073_00_fi.dae', 'nurse'], sycamore: ['Professor Sycamore/tr0006_00_fi.dae', 'nurse', 0.93],
  clemont: ['Clemont/tr0019_00_fi.dae', 'girl', 0.8], bonnie: ['Bonnie/tr0169_00_fi.dae', 'kid', 0.62],
  // shopkeepers and visitors inside the buildings
  youngster: ['Youngster/tr0100_00_fi.dae', 'girl', 0.72], breederM: ['Pokemon Breeder Male/tr0119_00_fi.dae', 'nurse'], backpacker: ['Backpacker/tr0066_00_fi.dae', 'nurse'], rangerF: ['Pokemon Ranger Female/tr0126_00_fi.dae', 'nurse'],
  alexa: ['Alexa/tr0168_00_fi.dae', 'nurse'], pokefan: ['Poke Fan Female Tourist/tr0102_00_fi.dae', 'nurse'], roller: ['Roller Skater Female/tr0108_00_fi.dae', 'girl', 0.8],
  grace: ['Grace/tr0007_00_fi.dae', 'nurse'], scientistF: ['Scientist Female/tr0129_00_fi.dae', 'nurse'], mable: ['Mable/tr0029_00_fi.dae', 'nurse'],
  hiker: ['Hiker/tr0145_00_fi.dae', 'nurse', 0.9], richboy: ['Rich Boy/tr0063_00_fi.dae', 'girl', 0.72], twins: ['Twins/tr0103_00_fi.dae', 'kid', 0.6],
  // playable trainer (onboarding), loaded up front with the Verdant humans: the Calem/ player rip's upper arms are unskinned and can't walk
  calem: ['Calem NPC/tr0161_00_fi.dae', 'player'],
  // more playable trainers: loaded only when picked (onboarding) or restored from a save, never with the townsfolk
  tierno: ['Tierno/tr0004_00_fi.dae', 'player'], viola: ['Viola/tr0015_00_fi.dae', 'player'], grant: ['Grant/tr0016_00_fi.dae', 'player'],
  korrina: ['Korrina/tr0017_00_fi.dae', 'player'], valerie: ['Valerie/tr0020_00_fi.dae', 'player'], emma: ['Emma/tr0171_00_fi.dae', 'player'],
};
const PLAYABLE = new Set(['tierno', 'viola', 'grant', 'korrina', 'valerie', 'emma']);

export { FOLK, K, KX, K_DIRT, K_FIELDS, K_FOUNT, K_PLAZA_R, K_SPAWN, K_WALK, PLAYABLE, ROOM_X, inKField, inKalos, inRect, kDirt,
  kPaved, kRect, kalosH };
