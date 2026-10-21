import './28-evolution-data.js'; // first: the modules run in file-number order (see main.js)
import { MOVES, expAt } from '../battle-rules.js';
import * as THREE from 'three';
import { V3, clamp } from './01-helpers.js';
import { CAM_DIST, CAM_PITCH, START, ZOOM_MAX, viewFog } from './02-hero-camera.js';
import { riverInfo } from './04-river.js';
import { CLEAR, ROUTE1, ROUTE_GRASS, ROUTE_HALF, inTallGrass, routeD, verdantWalkable, walkH } from './05-paths-raised-plaza-stairs-tall-grass.js';
import { camera, renderer, scene } from './06-renderer-scene-post.js';
import { CHUNK, FAR_GEO, LOD_CHUNKS } from './08-blender-assets.js';
import { GROUND, cellOf, isCoreCell } from './09-terrain.js';
import { CELLS, cellDist, frames, streamable, wantedCells } from './10-streaming.js';
import { boxes, circles, trees } from './12-batched-props.js';
import { cellRand, fillCell } from './18-cell-content.js';
import { P, TRAINERS, XY, bulba, followKey, interactables, pika, setFollower, setTrainer, setTrainerProfile, trainer } from './19-characters.js';
import { CLUES, DEV_AT, GUARD_AT, QUEST_STEPS, RANGER_AT, restored, story, syncKeyItems } from './20-story-chapter-1.js';
import { GUIDE, RIVAL_AT, SCRAPS, SIDE, STREAM, nearestTarget, questList, questMarks, renderTracker, rivalNpc, rivalStarter,
  setTracked, tracked } from './21-side-quests.js';
import { blockedAt } from './22-collision.js';
import { MINI_TILES } from './23-hud-minimap.js';
import { placePlayer } from './24-fleurville-hud-travel.js';
import { $, ui } from './25-input.js';
import { VIEW, setZoom, zoom } from './26-key-bindings.js';
import { SPECIES, STATUS } from './27-pokemon-data.js';
import { bag, bagAt, bagSort, makeMon, money, nm, party, pcBox, setBagSeq, setBagSort, setFreshGame, setMoney } from './28-evolution-data.js';
import { BAG_SORTS, ITEMS } from './30-backpack.js';
import { openShop } from './31-poke-mart.js';
import { dexArtwork } from './32-pokedex.js';
import { retireBulbasaur, startBattle } from './40-battle-flow.js';
import { setFirstFrame } from './41-loop.js';
import { tick } from './44-game-menu.js';

// ============================================================ Save (localStorage autosave: party, PC box, bag, position, story flags)
// The autosave is the running game; the Game Menu's save files (verdant-slots-v1) hold copies of it.
const SAVE_KEY = 'verdant-save-v1';
const cleanNick = (s, max = 12) => String(s).replace(/[^\p{L}\p{N} .'-]/gu, '').slice(0, max); // nicknames end up in innerHTML
const packMon = m => ({ key: m.key, level: m.level, exp: m.exp, hp: m.hp, nick: m.nick, gender: m.gender, status: m.status, sleep: m.sleep, moves: m.moves.map(x => ({ id: x.id, pp: x.pp })) });
let playTime = 0, curSlot = null; // seconds played; id of the save file this game was loaded from / last saved to
const snapshot = () => ({ trainer, party:party.map(packMon), pc: pcBox.map(packMon), bag, bagAt, bagSort, money, pos: [P.pos.x, P.pos.z, P.face].map(n => Math.round(n * 100) / 100),
  flags: { bulbasaur: !bulba.visible, quest: story.step, clues: story.clues, side: { ...SIDE, seen: [...SIDE.seen], got: [...SIDE.got] } }, loc: $('locName').textContent, time: Math.floor(playTime), slot: curSlot });
function saveGame() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot())); } catch (e) { console.warn('Save failed:', e); } }
function unpackMon(s) { // saved data is untrusted: unknown species and moves are dropped, numbers are clamped
  if (!Object.hasOwn(SPECIES, s?.key)) return null;
  const level = clamp(Math.floor(+s.level) || 1, 1, 100), m = makeMon(s.key, level);
  m.exp = clamp(Math.floor(+s.exp) || 0, expAt(level), level < 100 ? expAt(level + 1) - 1 : expAt(level));
  const moves = (Array.isArray(s.moves) ? s.moves : []).filter(x => Object.hasOwn(MOVES, x?.id)).slice(0, 4).map(x => ({ id: x.id, pp: clamp(Math.floor(+x.pp) || 0, 0, MOVES[x.id].pp) }));
  if (moves.length) m.moves = moves;
  m.hp = clamp(Math.floor(+s.hp) || 0, 0, m.maxHp);
  if (m.hp > 0 && Object.hasOwn(STATUS, s.status)) { m.status = s.status; if (m.status === 'slp') m.sleep = clamp(Math.floor(+s.sleep) || 0, 0, 3); }
  if (s.nick) m.nick = cleanNick(s.nick) || undefined;
  if (m.gender && (s.gender === 'male' || s.gender === 'female')) m.gender = s.gender; // older saves keep the fresh roll
  return m;
}
function loadGame() {
  let s; try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return; }
  if (!s || typeof s !== 'object') return;
  const tname = cleanNick(s.trainer?.name ?? '', 24).trim();
  if (tname && Object.hasOwn(TRAINERS, s.trainer.char)) { setTrainerProfile({ char: s.trainer.char, name: tname }); setTrainer(trainer.char); }
  const mons =a => (Array.isArray(a) ? a : []).map(unpackMon).filter(Boolean);
  const p = mons(s.party).slice(0, 6); if (p.length) { party.splice(0, party.length, ...p); setFreshGame(false); }
  pcBox.splice(0, pcBox.length, ...mons(s.pc));
  if (s.bag && typeof s.bag === 'object') { for (const k in bag) delete bag[k]; for (const [k, v] of Object.entries(s.bag)) if (Object.hasOwn(ITEMS, k)) bag[k] = clamp(Math.floor(+v) || 0, 0, 999); }
  for (const k in bagAt) delete bagAt[k]; // older saves have no stamps: their items sort in ITEMS order
  if (s.bagAt && typeof s.bagAt === 'object') for (const [k, v] of Object.entries(s.bagAt)) if (Object.hasOwn(ITEMS, k) && Number.isFinite(v)) bagAt[k] = v;
  setBagSeq(Math.max(0, ...Object.values(bagAt)));
  if (Object.hasOwn(BAG_SORTS, s.bagSort)) setBagSort(s.bagSort);
  if (Number.isFinite(s.money)) setMoney(clamp(Math.floor(s.money), 0, 999999));
  if (Array.isArray(s.pos) && s.pos.length === 3 && s.pos.every(Number.isFinite) && !new URLSearchParams(location.search).has('map')) { // a spot that is no longer walkable (the world changed since the save) starts at the town square
    if (blockedAt(s.pos[0], s.pos[1], walkH(s.pos[0], s.pos[1]))) placePlayer(...START, Math.PI / 2 + 0.25); else placePlayer(...s.pos);
  }
  if (s.flags?.bulbasaur === true) retireBulbasaur();
  if (QUEST_STEPS.includes(s.flags?.quest)) story.step = s.flags.quest;
  if (Array.isArray(s.flags?.clues)) story.clues = CLUES.map(c => c.id).filter(id => s.flags.clues.includes(id));
  const sd = s.flags?.side; // saved data is untrusted: stages are clamped, lists keep only known entries
  if (sd && typeof sd === 'object') {
    for (const k of ['rival', 'notes', 'scraps']) SIDE[k] = clamp(Math.floor(+sd[k]) || 0, 0, 2);
    SIDE.seen = Array.isArray(sd.seen) ? [...new Set(sd.seen.filter(k => typeof k === 'string' && Object.hasOwn(SPECIES, k)))] : [];
    SIDE.got = Array.isArray(sd.got) ? [...new Set(sd.got.filter(i => Number.isInteger(i) && i >= 0 && i < SCRAPS.length))] : [];
  }
  syncKeyItems();
  STREAM.k = restored() ? 1 : 0; // a loaded restored stream is already flowing: no swell
  if (Number.isFinite(s.time)) playTime = Math.max(0, s.time);
  if (typeof s.slot === 'string') curSlot = s.slot;
}
window.debug = { // testing hooks, from the console or the ` key: debug.give('KIRLIA', 30, { dawnStone: 1, money: 5000 }, 'Kiri', 'male'), debug.battle('CATERPIE', 2)
  give(key, level = 5, items = {}, nick, gender) {
    key = String(key).toUpperCase().replace(/[- ]/g, '_'); level = Math.floor(+level);
    if (!Object.hasOwn(SPECIES, key) || !(level >= 1 && level <= 100)) return console.warn(`debug.give: unknown species "${key}" or level ${level}`);
    const m = makeMon(key, level);
    if (level < 100) m.exp = expAt(level + 1) - 1; // one point short of the next level, so a single win levels it up
    if (nick) m.nick = cleanNick(nick) || undefined;
    if (m.gender && (gender === 'male' || gender === 'female')) m.gender = gender;
    party.unshift(m); if (party.length > 6) pcBox.push(party.pop());
    for (const [k, v] of Object.entries(items)) {
      const n = Math.max(0, Math.floor(+v) || 0);
      if (k === 'money') setMoney(Math.min(999999, money + n)); else if (Object.hasOwn(ITEMS, k)) bag[k] = (bag[k] || 0) + n;
    }
    renderParty(); saveGame();
    return m;
  },
  warp: (x, z) => placePlayer(+x, +z, 0), quest: () => ({ story, SIDE, CLUES, START, RANGER_AT, CLEAR, DEV_AT, GUARD_AT, STREAM, RIVAL_AT, SCRAPS: SCRAPS.map(c => c.at), marks: questMarks() }), clue: i => placePlayer(...(i === 'ranger' ? [RANGER_AT[0] - 1.2, RANGER_AT[1]] : CLUES[i].at), 0), // debug.clue(0) stands on a stream clue spot, debug.clue('ranger') beside the ranger
  battle: (key = 'PIDGEY', level = 3) => Object.hasOwn(SPECIES, key = String(key).toUpperCase()) && startBattle(key, Math.floor(+level) || 3),
  shop: () => openShop(), // the Fleurville Poké Mart counter, without walking there
  follower: () => ({ key: followKey, at: pika.position.toArray().map(n => +n.toFixed(2)), size: +new THREE.Box3().setFromObject(pika).getSize(new V3()).y.toFixed(2),
    feet: ['LFoot', 'RFoot', 'LHand', 'RHand'].map(n => { const b = pika.getObjectByName(n); return b && pika.worldToLocal(b.getWorldPosition(new V3())).toArray().map(v => +v.toFixed(2)); }), player: P.pos.toArray().map(n => +n.toFixed(2)) }),
  go: (x, z) => { placePlayer(+x, +z, 0); setFirstFrame(true); return frames(2); }, // warp and snap the camera and cells there (resolves once drawn)
  stream: () => ({ loaded: [...CELLS.cells.keys()], built: CELLS.built, disposed: CELLS.disposed }),
  view: () => ({ ...VIEW, zoom, fog: [scene.fog.near, scene.fog.far], far: camera.far }),
  resetView: () => { Object.assign(VIEW, { fpv: false, yaw: 0, pitch: CAM_PITCH }); setZoom(1); setFirstFrame(true); }, // the hero framing, for comparable debug.stats()
  cells: CELLS, lodChunks: LOD_CHUNKS,
  blocked: (x, z) => blockedAt(x, z, walkH(x, z)), at: (x, z) => ({ h: walkH(x, z), route: routeD(x, z), walk: verdantWalkable(x, z), river: { ...riverInfo(x, z) } }),
  reach(ax, az, bx, bz) { // breadth-first walk over a 0.25 m grid (fine enough for one stair step at a time) with the player's own collision: can you get from a to b?
    const S = 0.25, key = (i, j) => i + ',' + j, goal = [Math.round(bx / S), Math.round(bz / S)], seen = new Set(), q = [[Math.round(ax / S), Math.round(az / S)]];
    seen.add(key(...q[0]));
    for (let n = 0; n < q.length && n < 400000; n++) {
      const [i, j] = q[n]; if (Math.abs(i - goal[0]) <= 1 && Math.abs(j - goal[1]) <= 1) return true;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = key(i + di, j + dj); if (seen.has(k)) continue; seen.add(k);
        if (!blockedAt((i + di) * S, (j + dj) * S, walkH(i * S, j * S))) q.push([i + di, j + dj]);
      }
    }
    return false;
  },
  npc: name => { const i = interactables.find(i => i.name === name); return i && { x: +i.x.toFixed(2), z: +i.z.toFixed(2) }; }, // where a named NPC stands
  pos: () => ({ x: +P.pos.x.toFixed(2), z: +P.pos.z.toFixed(2), face: +P.face.toFixed(2), ui: Object.keys(ui).filter(k => ui[k]) }), // where the player is and which screens are open
  bench: (n = 60) => { // ms per frame, GPU included (a 1-pixel read waits for each frame to finish), for checking the 60 FPS target in a hidden pane
    const gl = renderer.getContext(), px = new Uint8Array(4), ms = [];
    for (let i = 0; i < n; i++) { const t0 = performance.now(); tick(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); ms.push(performance.now() - t0); }
    ms.sort((a, b) => a - b); return { median: +ms[n >> 1].toFixed(1), p95: +ms[Math.floor(n * 0.95)].toFixed(1), ...debug.stats() };
  },
  stats: () => { const r = renderer.info; return { calls: r.render.calls, triangles: r.render.triangles, geometries: r.memory.geometries }; },
  coreHash: () => { // fingerprint of the core world's placements: any reshuffle of the shared rnd() stream changes it
    const core = circles.filter(c => !c.story); let s = 0;
    for (const a of [trees, core, boxes]) for (const o of a) for (const v of Object.values(o)) if (typeof v === 'number') s += v;
    return `${trees.length}/${core.length}/${boxes.length}/${s.toFixed(3)}`;
  },
  async check() { // open-world self-test: the names of failing CHECKS, [] when all pass
    const fail = [];
    for (const [name, fn] of CHECKS) { try { if (!(await fn())) fail.push(name); } catch (e) { fail.push(`${name}: ${e.message}`); } }
    return fail;
  },
};
// Recorded before the world moved into cells (START, zoom 1, 1024x768): the core must keep this hash; triangles must not exceed it
const BASELINE_HASH = '698/763/50/158078.844', BASELINE_STATS = { calls: 615, triangles: 4083393, geometries: 213 };
const CHECKS = [
  ['coreHashUnchanged', () => debug.coreHash() === BASELINE_HASH],
  ['groundIsCells', () => GROUND.length >= 20 && GROUND.every(m => m.userData.cell)],
  ['seamHeights', () => { // a vertex on a shared cell edge has the same height in both cells
    const at = key => GROUND.find(m => m.userData.cell + '' === key);
    const ys = (m, x) => { const p = m.geometry.attributes.position, out = []; for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i) - x) < 1e-4) out.push(p.getZ(i).toFixed(3) + ':' + p.getY(i).toFixed(4)); return out.sort() + ''; };
    const a = ys(at('0,0'), 16); return a.length > 0 && a === ys(at('1,0'), 16);
  }],
  ['grassIsCells', () => { // every grass / flower instanced mesh holds a single cell's instances, so off-screen cells are culled
    const m = new THREE.Matrix4(), keyAt = (im, i) => (im.getMatrixAt(i, m), Math.floor(m.elements[12] / CHUNK) + ',' + Math.floor(m.elements[14] / CHUNK));
    const ims = scene.children.filter(o => o.isInstancedMesh && o.material.customProgramCacheKey?.().startsWith('verdant-flora'));
    return ims.length > 4 && ims.every(im => { const k = keyAt(im, 0); for (let i = 1; i < im.count; i++) if (keyAt(im, i) !== k) return false; return true; });
  }],
  ['fogAtZoom1', () => viewFog(CAM_DIST, false).map(v => v.toFixed(1)) + '' === '34.0,70.0'],
  ['fogFpv', () => viewFog(99, true) + '' === '34,70'],
  ['farFollowsFog', async () => { await frames(1); return Math.abs(camera.far - (scene.fog.far + 1)) < 1e-6; }],
  ['zoomClamped', () => { const z0 = zoom; for (let i = 0; i < 60; i++) dispatchEvent(new WheelEvent('wheel', { deltaY: 1 })); const ok = zoom === ZOOM_MAX; setZoom(z0); return ok; }],
  ['snapLoadsAll', async () => { await debug.go(40, -60); const w = wantedCells(); return w.length > 0 && w.every(k => CELLS.cells.has(k)); }],
  ['farCellsDisposed', async () => { await debug.go(40, -60); await debug.go(...START); return [...CELLS.cells.values()].every(c => cellDist(c) <= scene.fog.far + 2 * CHUNK); }],
  ['nearCellsAlwaysLoaded', async () => { await debug.go(40, -60); VIEW.yaw += Math.PI; await frames(3); const ok = wantedCells().filter(k => cellDist(k) < scene.fog.near).every(k => CELLS.cells.has(k)); VIEW.yaw -= Math.PI; return ok; }],
  ['noLeakAfterRoundTrips', async () => { await debug.go(...START); await frames(5); const g0 = renderer.info.memory.geometries; for (let i = 0; i < 5; i++) { await debug.go(40, -60); await debug.go(...START); } await frames(5); return renderer.info.memory.geometries === g0; }],
  ['coreNeverStreamed', () => [...CELLS.cells.values()].every(c => !isCoreCell(c.cx, c.cz))],
  ['routeReachable', () => debug.reach(...START, CLEAR.x, CLEAR.z)],
  ['routeClearOfRiver', () => ROUTE1.every(([x, z]) => { const r = riverInfo(x, z); return r.d > r.hw + 3; })],
  ['routeInVerdantBand', () => ROUTE1.every(([x, z]) => streamable(cellOf(x), cellOf(z)) || isCoreCell(cellOf(x), cellOf(z)))],
  ['routeGrassEncounters', () => ROUTE_GRASS.every(([x, z]) => inTallGrass(x + 1.5, z) || inTallGrass(x - 1.5, z))],
  ['offRouteBlocked', () => { const [x, z] = ROUTE1[ROUTE1.length >> 1], ox = x + ROUTE_HALF + 2; return blockedAt(ox, z, walkH(ox, z)); }],
  ['blockedSaveFallsBackToStart', () => {
    const raw = localStorage.getItem(SAVE_KEY), s = JSON.parse(raw || '{}'), at = P.pos.clone(), face = P.face;
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...s, pos: [150, -150, 0] })); loadGame();
    const ok = Math.hypot(P.pos.x - START[0], P.pos.z - START[1]) < 0.01;
    localStorage.setItem(SAVE_KEY, raw); placePlayer(at.x, at.z, face); return ok;
  }],
  ['cellDeterministic', () => { const a = fillCell(2, -4, cellRand(2, -4), new THREE.Group()), b = fillCell(2, -4, cellRand(2, -4), new THREE.Group()); return a.trees.length > 0 && JSON.stringify(a.trees) === JSON.stringify(b.trees); }],
  ['forestDensity', () => { const n = fillCell(-8, -8, cellRand(-8, -8), new THREE.Group()).trees.length; return n >= 30 && n <= 70; }],
  ['corridorFree', async () => { await debug.go(...ROUTE1[ROUTE1.length >> 1]); return CELLS.cells.size > 0 && [...CELLS.cells.values()].every(c => c.trees.every(([x, z]) => routeD(x, z) >= ROUTE_HALF + 1)); }],
  ['miniTilesForLoaded', () => CELLS.cells.size > 0 && [...CELLS.cells.keys()].every(k => MINI_TILES.has(k))],
  ['farLodNormals', () => FAR_GEO.size > 0 && [...FAR_GEO.values()].every(g => { // a zero normal is NaN in the shader, and bloom smears one NaN pixel over the frame
    const n = g.attributes.normal; for (let i = 0; i < n.count; i++) if (Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) < 0.5) return false; return true;
  })],
  ['questMarkersFollowStory', () => { // gold on the current main target only
    const st = story.step, has = (at, side) => questMarks().some(m => Math.hypot(m[0] - at[0], m[1] - at[1]) < 0.01 && m[3] === side);
    story.step = 'investigate-clearing'; const a = has(GUARD_AT, false) && !has(DEV_AT, false);
    story.step = 'shut-device'; const b = has(DEV_AT, false) && !has(GUARD_AT, false);
    story.step = st; return a && b;
  }],
  ['sideMarkersBlue', () => { const s0 = { ...SIDE, got: [...SIDE.got] }; SIDE.scraps = 1; SIDE.got = []; const ok = SCRAPS.every(c => questMarks().some(m => m[0] === c.at[0] && m[1] === c.at[1] && m[3] === true)); Object.assign(SIDE, s0); return ok; }],
  ['sideQuestsSaved', () => JSON.stringify(snapshot().flags.side) === JSON.stringify(SIDE)],
  ['scrapsOnRoute', () => SCRAPS.every(c => routeD(...c.at) < ROUTE_HALF && !debug.blocked(...c.at))],
  ['rivalSpotWalkable', () => !blockedAt(...RIVAL_AT, walkH(...RIVAL_AT), rivalNpc) && !inTallGrass(...RIVAL_AT)],
  ['rivalHasTeam', () => !!SPECIES[rivalStarter()]],
  ['trackerClickTracks', () => { // clicking a quest card tracks it
    const s0 = { ...SIDE, got: [...SIDE.got] }, t0 = tracked; SIDE.scraps = 1; SIDE.got = []; renderTracker();
    document.querySelector('#quests [data-q="scraps"]').click();
    const ok = tracked === 'scraps' && document.querySelector('#quests [data-q="scraps"]').classList.contains('on');
    Object.assign(SIDE, s0); setTracked(t0); renderTracker(); return ok;
  }],
  ['guidePointsAtTarget', async () => { // the arrow lies between the trainer and the tracked quest's nearest target
    const s0 = { ...SIDE, got: [...SIDE.got] }, t0 = tracked; SIDE.scraps = 1; SIDE.got = []; setTracked('scraps');
    await debug.go(...START); const tg = nearestTarget(questList().find(q => q.id === 'scraps'));
    const gx = GUIDE.position.x - P.pos.x, gz = GUIDE.position.z - P.pos.z, ok = GUIDE.visible && (gx * (tg[0] - P.pos.x) + gz * (tg[1] - P.pos.z)) / Math.hypot(gx, gz) / tg[2] > 0.99;
    Object.assign(SIDE, s0); setTracked(t0); renderTracker(); return ok;
  }],
];

// overworld party HUD (portraits rendered from the 3D models, cached per species)
const portraitCache = {};
let portraitKit = null;
function portrait(key) {
  if (portraitCache[key]) return portraitCache[key];
  if (SPECIES[key].auto && !XY[key]) return dexArtwork(SPECIES[key].dex); // Pokédex image until (unless) its model arrives
  if (!portraitKit) {
    const pr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    pr.setSize(180, 180); pr.toneMapping = THREE.ACESFilmicToneMapping; pr.toneMappingExposure = 1.15;
    const ps = new THREE.Scene(); ps.add(new THREE.HemisphereLight('#ffffff', '#556070', 2));
    const dl = new THREE.DirectionalLight('#fff', 2.2); dl.position.set(1, 2, 3); ps.add(dl);
    portraitKit = { pr, ps, cam: new THREE.PerspectiveCamera(30, 1, 0.1, 20) };
  }
  const { pr, ps, cam } = portraitKit, sp = SPECIES[key], model = sp.make();
  model.rotation.y = 0.35; ps.add(model);
  cam.position.set(0.15, sp.face + 0.12, 1.75); cam.lookAt(0, sp.face - 0.02, 0);
  pr.render(ps, cam);
  ps.remove(model);
  return (portraitCache[key] = pr.domElement.toDataURL());
}
const hpClass = f => f > 0.5 ? '' : f > 0.2 ? 'mid' : 'low';
function renderParty() {
  $('party').innerHTML = party.map(m => {
    const f = m.hp / m.maxHp;
    return `<div class="mon${m.hp <= 0 ? ' out' : ''}" title="${nm(m)} Lv${m.level} · HP ${m.hp}/${m.maxHp}${m.status ? ' · ' + STATUS[m.status][2] : ''}"><div class="pic"><img alt="${nm(m)}" src="${portrait(m.key)}"></div>${m.status ? `<em class="st" style="background:${STATUS[m.status][1]}">${STATUS[m.status][0]}</em>` : ''}<div class="hp"><i class="${hpClass(f)}" style="width:${f * 100}%"></i></div></div>`;
  }).join('');
  setFollower(party[0]?.key);
}

// other modules assign these through their setters (an imported binding is read-only)
function setCurSlot(v) { return (curSlot = v); }
function setPlayTime(v) { return (playTime = v); }
export { SAVE_KEY, cleanNick, curSlot, hpClass, loadGame, playTime, portraitCache, renderParty, saveGame, setCurSlot, setPlayTime,
  snapshot };
