import './23-hud-minimap.js'; // first: the modules run in file-number order (see main.js)
import * as THREE from 'three';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import { V3, hash2, pick, rnd, rr } from './01-helpers.js';
import { START } from './02-hero-camera.js';
import { FOLK, K, KX, K_FOUNT, K_SPAWN, PLAYABLE, inKField, inKalos, kDirt, kPaved, kRect } from './03-fleurville-map.js';
import { TX, T_SPAWN, walkH } from './05-paths-raised-plaza-stairs-tall-grass.js';
import { BG, scene } from './06-renderer-scene-post.js';
import { add, canvasTex, mat, pcRoofTex } from './07-materials-textures.js';
import { trees } from './12-batched-props.js';
import { KAL, KDOORS, KFADE, RNPC, ROOMS, ROOM_BG, kBoxes, kFade, kShop, roomAt, signTex, texMat } from './16-fleurville-world.js';
import { P, PK, XY, XY_MIXERS, interactables, makeHuman, npc, pika, player, prepXY } from './19-characters.js';
import { spawnGuardian, spawnProf, spawnRanger } from './20-story-chapter-1.js';
import { butterflies, spawnRival } from './21-side-quests.js';
import { MPU, mm } from './23-hud-minimap.js';
import { $, ui } from './25-input.js';
import { kb, say, setMoveTarget } from './26-key-bindings.js';
import { loadDexModel } from './32-pokedex.js';
import { BT } from './34-battle-tweens-effects-arena.js';
import { setFirstFrame } from './41-loop.js';

// ============================================================ Fleurville Town: minimap, townsfolk, X/Y props, travel
const KMINI = { x0: KX - 24, z0: -18, w: 48, h: 36, canvas: document.createElement('canvas') };
{
  const W = KMINI.w * MPU, H = KMINI.h * MPU, cv = KMINI.canvas; cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = KMINI.x0 + i / MPU, z = KMINI.z0 + j / MPU, k = 0.94 + hash2(i, j) * 0.08;
    const c = Math.hypot(x - K_FOUNT[0], z - K_FOUNT[1]) < 1.6 ? [61, 159, 224] : kPaved(x, z) ? [222, 196, 178] : kDirt(x, z) ? [232, 214, 162] : inKField(x, z) ? [214, 198, 96] : [143, 195, 102];
    d.set([c[0] * k, c[1] * k, c[2] * k, 255], (j * W + i) * 4);
  }
  ctx.putImageData(img, 0, 0);
  const toM = (x, z) => [(x - KMINI.x0) * MPU, (z - KMINI.z0) * MPU];
  for (const [x, z, r] of trees) if (inKalos(x)) { const [a, b] = toM(x, z); ctx.fillStyle = '#3c7d33'; ctx.beginPath(); ctx.arc(a, b, r * MPU * 0.75, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#e3a372'; for (const r of kBoxes) { const [a, b] = toM(r[0], r[1]); ctx.fillRect(a, b, (r[2] - r[0]) * MPU, (r[3] - r[1]) * MPU); }
}
// townsfolk: [model key (FOLK, or a Verdant human), px, py, facing, name, lines, extra]; patrols walk between two traced points
const KNPC = [
  ['chef', 125, 250, 0, 'Chef', ['Our crêpes use honey from the Combee hives up north.', 'Sit at any table on the terrace. Galettes are coming right up!']],
  ['waitress', 92, 294, 0, 'Waitress', ['Table for one and a Pikachu? Right this way!', "Don't let it near the Oran Berry jam. Last time, oh là là..."], { patrol: [[90, 294], [172, 294]] }],
  ['garcon', 470, 266, -1.3, 'Garçon', ['Un café? The Boulangerie bakes the best croissants in Kalos.', 'People come from Lumiose City just for them!']],
  ['butler', 532, 247, 0, 'Butler', ['This is Fleur Manor, home of the Fleur family for two hundred years.', 'Madame is in the rose garden. Do mind the thorns.']],
  ['maid', 300, 204, 0, 'Maid', ['The windmill behind the manor still grinds our flour.', 'Clemont fixed its gears. Such a clever boy!'], { patrol: [[300, 204], [440, 204]] }],
  ['madame', 437, 394, 0, 'Madame Fleur', ['My roses took first prize at the Lumiose flower show.', 'They say a Roselia sleeps in the fountain statue. Children!']],
  ['touristF', 606, 402, -2.12, 'Tourist', ['I came all the way from Hoenn to see the Roselia Fountain!', 'Toss in a coin and make a wish.']],
  ['touristM', 270, 500, 0, 'Tourist', ['Fleurville is so peaceful after the crowds in Lumiose.', 'Have you tried the crêpes yet?'], { patrol: [[270, 500], [620, 500]] }],
  ['artist', 488, 432, 2.61, 'Artist', ['I paint the fountain every morning.', 'The light here is just like in the old Kalos masterpieces.']],
  ['schoolgirl', 615, 356, 0, 'Schoolgirl', ['We learned about Mega Evolution in class today!', 'You need a Mega Ring AND a Mega Stone. So cool!'], { patrol: [[615, 356], [790, 356]] }],
  ['schoolboy', 236, 260, 0, 'Schoolboy', ['I run laps around town to train like a real Trainer.', 'Wild Pokémon jump out of the wheat fields up north!'], { patrol: [[236, 260], [236, 556]] }],
  ['preschooler', 603, 316, 0, 'Little girl', ['The fountain sparkles at night!', "Mommy says I'll get my own Pokémon when I'm bigger."]],
  ['clemont', 628, 130, 0.5, 'Clemont', ['I rebuilt the windmill gearbox myself!', 'The future is now, thanks to science!']],
  ['bonnie', 606, 146, 0.3, 'Bonnie', ['My big brother can build anything!', 'Except a girlfriend... Will you keep him company?']],
  ['elder', 298, 140, 0, 'Gardener', ['These wheat fields are full of wild Pokémon.', 'Walk through the rows and you might meet one!']],
];
function spawnFolk() {
  const town = KNPC.map(([k, px, py, f, n, l, e = {}]) => [k, ...K(px, py), f, n, l, e.patrol ? { ...e, patrol: e.patrol.map(p => K(...p)) } : e]);
  for (const [key, x, z, face, name, lines, extra = {}] of [...town, ...RNPC]) {
    if (!XY[key]) continue;
    try {
      const ex = { ...extra };
      if (ex.patrol) Object.assign(ex, { leg: 1, wait: rr(0, 2) });
      const n = npc(makeHuman(key), x, z, face, name, lines, ex); n.h.root.scale.setScalar(FOLK[key]?.[2] ?? 0.85);
      interactables.push({ get x() { return n.x; }, get z() { return n.z; }, r: 1.6, name, lines, npc: n, after: n.after, top: 2.5 });
    } catch (e) { console.warn('Townsfolk failed:', key, e); }
  }
}
async function loadFolk(keys = Object.keys(FOLK).filter(k => !PLAYABLE.has(k))) { // same path as the Verdant humans: ColladaLoader, joint names restored, prepXY once the textures are in
  const mgr = new THREE.LoadingManager(), texDone = new Promise(r => (mgr.onLoad = mgr.onError = r)), loader = new ColladaLoader(mgr);
  const got = await Promise.all(keys.filter(k => !XY[k]).map(k => loader.loadAsync('models/xy/' + FOLK[k][0].split('/').map(encodeURIComponent).join('/')).then(c => {
    const names = {}; for (const d of Object.values(c.library.nodes)) if (d.type === 'JOINT' && d.sid) names[d.sid] = d.name;
    c.scene.traverse(o => o.isBone && names[o.name] && (o.name = names[o.name]));
    // the Blender 2.77 re-exports declare Z_UP but kept the rip's Y-up data, so the loader's turn laid them flat; the 2.72 ones
    // (Sycamore, Clerk, Calem...) counter-turn their Armature node instead and need the loader's turn to stand up
    if (!c.scene.children.some(o => !o.isMesh && Math.abs(o.rotation.x) > 1)) c.scene.quaternion.identity();
    return [k, c.scene];
  }, e => (console.warn('Townsfolk model failed:', k, e), null))));
  await Promise.race([texDone, new Promise(r => setTimeout(r, 15000))]);
  for (const [k, s] of got.filter(Boolean)) try { XY[k] = prepXY(k, s, false); } catch (e) { console.warn('Townsfolk prep failed:', k, e); }
}
const FOLK_LOADS = {};
const loadFolkModel = k => (FOLK_LOADS[k] ??= loadFolk([k])); // one model, loaded once
async function kProp(path, px, py, size, ry = 0, fade = null) { // a static X/Y prop, scaled so its footprint's long side is `size` metres; returns its height
  const holder = await loadDexModel({ models: [['', path]] }, 0, new AbortController().signal);
  holder.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(holder), s = b.getSize(new V3()), k = size / Math.max(s.x, s.z), m = new THREE.Group(), [x, z] = K(px, py);
  holder.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  holder.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.frustumCulled = true; } });
  m.add(holder); m.scale.setScalar(k); m.rotation.y = ry; m.position.set(x, 0.04, z); scene.add(m);
  if (fade) kFade(m, fade);
  if (holder.userData.mixer) XY_MIXERS.add(holder.userData.mixer);
  return s.y * k;
}
function startKalos() { // after the first frame: stream the townsfolk and the X/Y fountain and Pokémon Center in the background
  KAL.started = true;
  loadFolk(['sycamore', 'backpacker', 'rangerF']).then(() => { for (const f of [spawnProf, spawnRanger, spawnRival]) try { f(); } catch (e) { console.warn('Story NPC failed:', e); } spawnGuardian(); return loadFolk(); }).then(spawnFolk); // the story NPCs first: the quest runs through them
  kProp('Roselia Fountain/c01_bm_hunsui.dae', 532, 357, 3.3).then(h => (KAL.spray.y = h * 0.92), e => console.warn('Fountain model failed:', e));
  kProp('Pokemon Center/com_bm_pokecen.dae', 705, 432, 4.7, 0, kRect(662, 386, 748, 474)).catch(e => {
    console.warn('Pokémon Center model failed, using a built one:', e);
    kShop([662, 386, 748, 474], { noBox: true, sign: 'POKéMON CENTER', roofTex: pcRoofTex, trim: '#c23a30', signBg: '#d8423a', signFg: '#ffffff' });
  });
}
for (const d of KDOORS) if (!d.room) interactables.push({ ...d, r: 1.2, top: 2.2 });
interactables.push(
  { x: K_FOUNT[0], z: K_FOUNT[1], r: 2.55, name: 'Roselia Fountain', lines: ['A Roselia statue crowns the fountain.', 'Coins glitter at the bottom of the basin.'], top: 3 },
  { x: K(650, 80)[0], z: K(650, 80)[1], r: 2.0, name: 'Windmill', lines: ['The old windmill creaks as its sails turn.', 'It grinds flour for the Boulangerie.'], top: 5 },
);
for (let i = 0; i < 8; i++) { // butterflies over the rose beds and lawns
  const b = new THREE.Group(), col = pick(['#ffffff', '#ffe066', '#ffd6f0', '#9fd4ff', '#ffa94d']);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CircleGeometry(0.1, 8).translate(s * 0.09, 0, 0), mat(col, { side: THREE.DoubleSide, emissive: col, emissiveIntensity: 0.25 })); const p = new THREE.Group(); p.add(w); p.rotation.x = -Math.PI / 2; b.add(p); }
  const [cx, cz] = K(...pick([[437, 440], [630, 440], [430, 300], [130, 330], [300, 120], [120, 420]]));
  butterflies.push({ b, cx: cx + rr(-1, 1), cz: cz + rr(-1, 1), ph: rnd() * 10, sp: rr(0.35, 0.7) }); scene.add(b);
}
{ // fountain spray
  const n = 160, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: '#eaf7ff', size: 0.06, transparent: true, opacity: 0.85, depthWrite: false })); pts.frustumCulled = false; scene.add(pts);
  KAL.spray = { g, y: 2.2, seeds: Array.from({ length: n }, () => [rnd(), rnd(), rnd()]) };
}
function kalosTick(dt, t) {
  const rm = roomAt(P.pos.x, P.pos.z);
  if (!!rm !== KAL.dark) { KAL.dark = !!rm; scene.background = rm ? ROOM_BG : BG; scene.fog.color.set(rm ? ROOM_BG : '#5d8a45'); mm.style.visibility = rm ? 'hidden' : ''; }
  if (rm) { if (P.pos.z > rm.rect[3] + 0.05 && Math.abs(P.pos.x - rm.cx) < 0.8) fadeTo(() => placePlayer(rm.door.x, rm.door.z + 0.6, 0)); return; } // out over the doormat
  if (!inKalos(P.pos.x)) return;
  for (const d of KDOORS) // walking up into a door goes inside
    if (d.room && Math.abs(P.pos.x - d.x) < 0.55 && P.pos.z < d.z + 0.2 && P.pos.z > d.z - 0.7 && P.speed > 0.3 && Math.cos(P.face) < -0.6) { fadeTo(() => placePlayer(d.room.cx, d.room.rect[3] - 0.9, Math.PI)); break; }
  KAL.blades.rotation.z -= dt * 0.6;
  for (const f of KFADE) {
    const r = f.r, want = P.pos.x > r[0] - 0.6 && P.pos.x < r[2] + 0.6 && P.pos.z > r[1] - 4.2 && P.pos.z < r[1] + 0.4 ? 0.3 : 1;
    if (want === f.op) continue;
    f.op = want < f.op ? Math.max(want, f.op - dt * 4) : Math.min(want, f.op + dt * 4);
    f.g.traverse(o => {
      if (o.isMesh) for (const m of [o.material].flat()) {
        const tr = m.userData.o.transparent || f.op < 1;
        if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } // opaque materials compile with alpha forced to 1
        m.opacity = m.userData.o.opacity * f.op; m.depthWrite = f.op < 1 ? false : m.userData.o.depthWrite;
      }
    });
  }
  const s = KAL.spray, p = s.g.attributes.position;
  s.seeds.forEach(([a, b, c], i) => { // arcs falling from the statue into the basin
    const ph = (t * (0.45 + c * 0.35) + a) % 1, ang = a * 47 + b, r = ph * (0.7 + b * 0.5);
    p.setXYZ(i, K_FOUNT[0] + Math.cos(ang) * r, s.y + ph * (0.5 + c * 0.3) - ph * ph * (1.4 + c * 0.4), K_FOUNT[1] + Math.sin(ang) * r);
  });
  p.needsUpdate = true;
  const gate = K(691, 618);
  if (P.pos.z > gate[1] && Math.abs(P.pos.x - gate[0]) < 2) travel(false); // walking out of the south gate leads back to Verdant Town
}
function placePlayer(x, z, face) {
  P.pos.set(x, walkH(x, z), z); P.face = face; player.root.position.copy(P.pos); player.root.rotation.y = face;
  PK.pos.set(x - Math.sin(face) * 0.9, 0, z - Math.cos(face) * 0.9); pika.position.copy(PK.pos);
}
// Test Grounds floor: a plain grid, so nothing here reads as part of a story map
const tGround = add(new THREE.PlaneGeometry(52, 30), 0, scene, TX + 8, 0, -2, { r: [-Math.PI / 2, 0, 0], shadow: false,
  material: texMat(canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#9aa9a2'; c.fillRect(0, 0, w, h); c.strokeStyle = '#7f8f88'; c.lineWidth = 3; c.strokeRect(0, 0, w, h); }), 26, 15, { roughness: 0.95 }) });
// warp pads in the Test Grounds, south of the gallery: one glowing pad per map and room; on a pad, X asks to confirm, X again warps (G comes back)
const PORTALS = [['VERDANT', () => placePlayer(...START, Math.PI / 2 + 0.25)], ['FLEURVILLE', () => placePlayer(...K_SPAWN, Math.PI)], ...ROOMS.map(r => [r.name.toUpperCase(), () => placePlayer(r.cx, r.rect[3] - 0.9, Math.PI)])]
  .map(([name, go], i) => {
    const x = TX - 7.5 + (i % 6) * 3, z = 1.5 + Math.floor(i / 6) * 2.2, y = walkH(x, z), flat = [-Math.PI / 2, 0, 0];
    add(new THREE.RingGeometry(0.42, 0.58, 32), '#9fe2ff', scene, x, y + 0.03, z, { r: flat, shadow: false, mat: { emissive: '#3fb8ff', emissiveIntensity: 2 } });
    add(new THREE.CircleGeometry(0.42, 32), '#2a6fb0', scene, x, y + 0.025, z, { r: flat, shadow: false, mat: { emissive: '#1f5f9f', emissiveIntensity: 0.8 } });
    add(new THREE.PlaneGeometry(1.9, 0.36), 0, scene, x, y + 0.03, z + 0.82, { r: flat, shadow: false, material: new THREE.MeshBasicMaterial({ map: signTex(name, '#1b2a44', '#9fe2ff') }) });
    return { name, x, z, go };
  });
function portalTick() { // the corner hint shows the X prompt while the player stands on a pad
  const pad = PORTALS.find(p => Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < 0.5) || null;
  if (pad === (KAL.pad ?? null)) return; // ?? null: leave the start-up controls hint alone until a pad is touched
  KAL.pad = pad; const h = $('hint');
  if (pad) h.innerHTML = `<kbd>${kb('warp')}</kbd> enter ${pad.name}`;
  h.style.opacity = pad ? 1 : 0;
}
function portalKey() {
  if (ui.dialog?.portal) { const go = ui.dialog.portal.go; ui.dialog = null; $('dialog').classList.remove('show'); fadeTo(go); }
  else if (KAL.pad && !ui.dialog) { say('Portal', [`Warp to ${KAL.pad.name}? Press ${kb('warp')} to go, ${kb('act')} to cancel.`]); ui.dialog.portal = KAL.pad; }
}
function travel(toKalos) { fadeTo(() => { const [x, z] = toKalos ? K_SPAWN : START; placePlayer(x, z, toKalos ? Math.PI : Math.PI / 2 + 0.25); }); }
function fadeTo(move) { // fade to black, move the player, fade back in
  if (KAL.busy || ui.dialog || BT.active) return; KAL.busy = true;
  const el = $('fade') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'fade' }));
  el.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .35s;z-index:6';
  void el.offsetWidth; el.style.opacity = 1; // a reflow commits opacity 0 so this fades in; a rAF here could fire after the timeout below in a throttled tab and leave the screen black
  setTimeout(() => {
    move(); setMoveTarget(null); setFirstFrame(true); el.style.opacity = 0; KAL.busy = false;
  }, 400);
}
{ const map = new URLSearchParams(location.search).get('map'); // verdant-town-3d.html?map=kalos starts in Fleurville, ?map=test in the Test Grounds
  if (map === 'kalos') placePlayer(...K_SPAWN, Math.PI); else if (map === 'test') placePlayer(...T_SPAWN, Math.PI); }

export { KMINI, fadeTo, kalosTick, loadFolkModel, placePlayer, portalKey, portalTick, startKalos, tGround, travel };
