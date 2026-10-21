import './43-settings.js'; // first: the modules run in file-number order (see main.js)
import { clamp } from './01-helpers.js';
import { galleryD } from './05-paths-raised-plaza-stairs-tall-grass.js';
import { composer, renderPass, renderer } from './06-renderer-scene-post.js';
import { KAL } from './16-fleurville-world.js';
import { P, tickXYMixers } from './19-characters.js';
import { ambientTick } from './21-side-quests.js';
import { drawMinimap } from './23-hud-minimap.js';
import { startKalos } from './24-fleurville-hud-travel.js';
import { $, keys, ui } from './25-input.js';
import { BIND_ACTIONS, bindDefaults, binding, buildRemap, flashHint, kb, pollPad, renderHint, saveBindings, setBinding,
  setMoveTarget } from './26-key-bindings.js';
import { SPECIES } from './27-pokemon-data.js';
import { SAVE_KEY, cleanNick, curSlot, playTime, saveGame, setCurSlot, setPlayTime, snapshot } from './29-save.js';
import { tickDex } from './32-pokedex.js';
import { BT, tickTweens } from './34-battle-tweens-effects-arena.js';
import { SND } from './37-battle-sound-effects.js';
import { battleTick } from './40-battle-flow.js';
import { GAL, clock, loadGallery, resize, update, vh, vw } from './41-loop.js';
import { bgm, musicTick } from './42-background-music.js';
import { QUALITY, SET, SET_DEFAULT, TEXT_SPEED, applySettings, saveSettings } from './43-settings.js';

// ============================================================ Game Menu: save files, new game, settings, quit
const SLOT_KEY = 'verdant-slots-v1', MAX_SLOTS = 10;
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`); // save files are untrusted and end up in innerHTML
let slotsBad = false;
function readSlots() {
  slotsBad = false;
  try { const a = JSON.parse(localStorage.getItem(SLOT_KEY) ?? '[]'); if (Array.isArray(a)) return a.filter(s => typeof s?.id === 'string' && s.data && typeof s.data === 'object'); } catch {}
  slotsBad = true; return [];
}
function writeSlots(a) {
  try { localStorage.setItem(SLOT_KEY, JSON.stringify(a)); return true; } catch { gmToast('Couldn’t save: browser storage is full or blocked.', true); return false; }
}
const playable = s => Array.isArray(s.data.party) && s.data.party.some(m => Object.hasOwn(SPECIES, m?.key));
const progress = d => JSON.stringify([d.party, d.pc, d.bag, d.flags ?? {}]); // what counts as progress: walking around alone doesn't
const dirty = () => { const s = readSlots().find(x => x.id === curSlot); return !s || progress(s.data) !== progress(snapshot()); };
const when = s => new Date(+s.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const hrs = sec => { sec = Math.floor(+sec || 0); return `${Math.floor(sec / 3600)}:${String(Math.floor(sec / 60) % 60).padStart(2, '0')}`; };
function slotRow(s, buttons) {
  const p = Array.isArray(s.data.party) ? s.data.party.filter(m => Object.hasOwn(SPECIES, m?.key)) : [], lead = p[0];
  const team = lead ? `${esc(lead.nick ? cleanNick(lead.nick) : SPECIES[lead.key].name)} Lv ${clamp(Math.floor(+lead.level) || 1, 1, 100)}${p.length > 1 ? ` +${p.length - 1}` : ''}` : 'Damaged save';
  return `<div class="gm-slot"><b>${esc(s.name)}${s.id === curSlot ? '<em>CURRENT</em>' : ''}</b>
    <small>${s.data.trainer?.name ? esc(cleanNick(s.data.trainer.name, 24)) + ' · ' : ''}${esc(s.data.loc || 'Unknown place')} · ${team} · ${hrs(s.data.time)} played<br>Saved ${esc(when(s))}</small><div class="gm-row">${buttons}</div></div>`;
}
let gmView = 'save';
function gmRender(view = gmView) {
  gmView = view; if (view !== 'controls') setBinding(null); // leaving the Controls page cancels a key change
  $('gmNav').querySelectorAll('[role=tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.v === view));
  const v = $('gmView');
  if (view === 'save' || view === 'load') {
    const slots = readSlots().sort((a, b) => b.at - a.at), cur = slots.find(s => s.id === curSlot), unsaved = dirty(), full = slots.length >= MAX_SLOTS;
    const status = `<p class="gm-status${unsaved ? ' warn' : ''}">${cur ? `Current file: <b>${esc(cur.name)}</b> · ` : ''}${!unsaved ? 'All progress saved.' : cur ? 'You have unsaved progress since your last save.' : 'This game hasn’t been saved to a file yet.'}</p>`
      + (slotsBad ? '<p class="gm-status err">Your save files couldn’t be read (storage is blocked or the data is damaged). Saving now will replace them.</p>' : '');
    v.innerHTML = view === 'save'
      ? `<h3>Save game</h3>${status}
        ${cur ? `<div class="gm-row"><button class="gm-btn go" data-save="${esc(cur.id)}">Save to “${esc(cur.name)}”</button></div>` : ''}
        <div class="gm-row"><input type="text" id="gmName" maxlength="24" value="Save ${slots.length + 1}" aria-label="Name for the new save file"${full ? ' disabled' : ''}><button class="gm-btn${cur ? '' : ' go'}" id="gmNew"${full ? ' disabled' : ''}>Save as new file</button></div>
        ${full ? `<p class="gm-status err">All ${MAX_SLOTS} save slots are full. Overwrite or delete a save to make room.</p>` : ''}
        ${slots.length ? '<p>Or overwrite an existing save:</p>' : ''}
        <div class="gm-slots">${slots.map(s => slotRow(s, `<button class="gm-btn" data-save="${esc(s.id)}" aria-label="Overwrite ${esc(s.name)}">Overwrite</button>`)).join('')}</div>`
      : `<h3>Load game</h3>${status}
        <div class="gm-slots">${slots.length ? slots.map(s => slotRow(s, `<button class="gm-btn go" data-load="${esc(s.id)}" aria-label="Load ${esc(s.name)}">Load</button><button class="gm-btn danger" data-del="${esc(s.id)}" aria-label="Delete ${esc(s.name)}">Delete</button>`)).join('')
          : '<p class="gm-empty">No saved games yet. Use Save to create one.</p>'}</div>`;
  } else if (view === 'settings') {
    const opts = (o, cur) => Object.keys(o).map(k => `<option value="${k}"${k === cur ? ' selected' : ''}>${k[0].toUpperCase() + k.slice(1)}</option>`).join('');
    const check = k => `<input type="checkbox" data-set="${k}"${SET[k] ? ' checked' : ''}>`;
    v.innerHTML = `<h3>Settings</h3>
      <label class="gm-set">Music volume<input type="range" min="0" max="100" data-set="music" value="${Math.round(SET.music * 100)}"></label>
      <label class="gm-set">Sound effects volume<input type="range" min="0" max="100" data-set="sfx" value="${Math.round(SET.sfx * 100)}"></label>
      <label class="gm-set"><span>Text speed<small>How fast dialogue and battle text appear</small></span><select data-set="text">${opts(TEXT_SPEED, SET.text)}</select></label>
      <label class="gm-set"><span>Graphics quality<small>Lower it if the game stutters (resolution, shadows, glow)</small></span><select data-set="quality">${opts(QUALITY, SET.quality)}</select></label>
      <label class="gm-set"><span>Always run<small>Hold Shift to walk instead</small></span>${check('alwaysRun')}</label>
      <label class="gm-set"><span>Reduce flashing &amp; screen shake<small>Calmer battle effects</small></span>${check('calm')}</label>
      <div class="gm-row"><button class="gm-btn" id="gmDefaults">Restore defaults</button></div>`;
  } else v.innerHTML = `<h3>Controls</h3><p class="gm-status">Select a key to change it, then press the new key (Esc cancels). Picking a key that’s in use swaps the two.</p>
    <ul class="gm-keys">${BIND_ACTIONS.map(([a, label]) => `<li>${label}<button class="gm-btn gm-bind${binding === a ? ' wait' : ''}" data-bind="${a}" aria-label="${label}: ${kb(a)}. Change key">${binding === a ? 'Press a key…' : kb(a)}</button></li>`).join('')}
    <li>Run (or walk, with Always run on) <span><kbd>Shift</kbd></span></li><li>Walk, also <span>arrow keys</span></li><li>Talk / confirm, also <span><kbd>Space</kbd> / <kbd>Enter</kbd></span></li><li>Game Menu <span><kbd>Esc</kbd></span></li>
    <li>Walk to spot <span>click / tap</span></li><li>Turn the camera <span>drag</span></li><li>Zoom <span>scroll wheel</span></li><li>Test Grounds (warp pads, character gallery) <span><kbd>G</kbd></span></li></ul>
    <div class="gm-row"><button class="gm-btn" id="gmKeysReset">Reset keys</button></div>
    <h3>Controller</h3><ul class="gm-keys"><li>Walk <span>left stick / d-pad</span></li><li>Run <span>hold <kbd>B</kbd></span></li><li>Turn the camera <span>right stick</span></li>
    <li>Talk / confirm <span><kbd>A</kbd></span></li><li>Back / close <span><kbd>B</kbd></span></li><li>Bag <span><kbd>X</kbd></span></li><li>Track the next quest <span><kbd>Y</kbd></span></li>
    <li>Game Menu <span><kbd>Start</kbd></span></li><li>First-person view <span><kbd>Back</kbd></span></li><li>Travel <span><kbd>LB</kbd></span></li><li>Use a warp pad <span><kbd>RB</kbd></span></li></ul>`;
}
function gmToast(text, err = false) { const t = $('gmToast'); t.textContent = text; t.classList.toggle('err', err); t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), err ? 4000 : 2200); }
let askRes = null;
function ask({ title, text, ok, danger = true }) { // in-menu confirm sheet; resolves true only on the confirm button
  answer(false);
  $('gmAskTitle').textContent = title; $('gmAskText').textContent = text;
  const y = $('gmAskYes'); y.textContent = ok; y.className = 'gm-btn ' + (danger ? 'danger' : 'go');
  $('gmAsk').classList.add('show'); $('gmBody').inert = true; $('gmAskNo').focus(); // Cancel is the safe default
  return new Promise(res => (askRes = res));
}
function answer(v) { if (!askRes) return; const r = askRes; askRes = null; $('gmAsk').classList.remove('show'); $('gmBody').inert = false; r(v); }
$('gmAskYes').onclick = () => answer(true);
$('gmAskNo').onclick = () => answer(false);
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const restart = () => location.replace(location.pathname); // a reload rebuilds the world from the autosave (and drops ?map=)
async function saveTo(id, name) {
  const slots = readSlots(), old = id && slots.find(s => s.id === id);
  if (id && !old) { gmToast('That save file no longer exists.', true); return gmRender(); }
  if (!old && slots.length >= MAX_SLOTS) return gmToast(`All ${MAX_SLOTS} save slots are full.`, true);
  if (old && !await ask({ title: `Overwrite “${old.name}”?`, text: `It was saved ${when(old)} in ${old.data.loc || 'an unknown place'}. Overwriting replaces it with your current game, and it can’t be recovered.`, ok: 'Overwrite' })) return;
  const prev = curSlot; setCurSlot(old ? old.id : newId());
  const slot = { id: curSlot, name: old ? old.name : String(name ?? '').trim().slice(0, 24) || `Save ${slots.length + 1}`, at: Date.now(), data: snapshot() };
  if (old) slots[slots.indexOf(old)] = slot; else slots.push(slot);
  if (!writeSlots(slots)) { setCurSlot(prev); return; }
  saveGame(); gmToast(`Saved to “${slot.name}”.`); gmRender();
}
async function loadSlot(id) {
  const s = readSlots().find(x => x.id === id);
  if (!s) { gmToast('That save file no longer exists.', true); return gmRender(); }
  if (!playable(s)) return gmToast('This save file is damaged and can’t be loaded.', true);
  if (dirty() && !await ask({ title: `Load “${s.name}”?`, text: curSlot ? 'You have unsaved progress since your last save. Loading another file will lose it.' : 'This game hasn’t been saved to a file. Loading will replace your current progress.', ok: 'Load anyway' })) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...s.data, slot: s.id })); } catch { return gmToast('Couldn’t load: browser storage is blocked.', true); }
  restart();
}
async function delSlot(id) {
  const slots = readSlots(), s = slots.find(x => x.id === id);
  if (!s) return gmRender();
  if (!await ask({ title: `Delete “${s.name}”?`, text: 'This save file will be erased permanently. This can’t be undone.', ok: 'Delete' })) return;
  if (!writeSlots(slots.filter(x => x !== s))) return;
  if (id === curSlot) { setCurSlot(null); saveGame(); }
  gmToast(`Deleted “${s.name}”.`); gmRender();
}
async function newGame() {
  if (!await ask({ title: 'Start a new game?', text: (dirty() ? 'Your unsaved progress will be lost. ' : '') + 'You will restart in Verdant Town with the starting team and items. Your save files are kept.', ok: 'Start new game' })) return;
  try { localStorage.removeItem(SAVE_KEY); } catch {}
  restart();
}
async function quitGame() {
  if (dirty() && !await ask({ title: 'Quit without saving?', text: curSlot ? 'You have progress since your last save that isn’t in a save file.' : 'This game hasn’t been saved to a file yet.', ok: 'Quit anyway' })) return;
  closeMenu(); ui.quit = true; keys.clear();
  for (const a of Object.values(bgm.tracks)) a.pause();
  bgm.want = null; // update() picks the track again on return
  if (location.hostname === 'game.localhost' || location.protocol === 'game:') return location.assign('/__quit'); // desktop app (src-tauri): the shell closes on this navigation
  window.close(); // only closes tabs a script opened; otherwise the quit screen stays up
  $('quitScreen').classList.add('show'); $('quitBack').focus();
}
function openMenu(view = 'save') {
  if (ui.menu || ui.quit || BT.active || ui.bag || ui.pokedex) return;
  ui.menu = true; keys.clear(); setMoveTarget(null); P.v = 0; // P.v too: a coasting step in tall grass could still start a battle
  $('gameMenu').showModal(); gmRender(view); $('gmNav').querySelector(`[data-v="${view}"]`).focus();
}
function closeMenu() { if (!ui.menu) return; answer(false); setBinding(null); ui.menu = false; $('gameMenu').close(); $('menuBtn').focus(); }
$('gmClose').onclick = closeMenu;
$('gameMenu').addEventListener('cancel', e => { e.preventDefault(); if (askRes) answer(false); else closeMenu(); }); // Esc backs out of a confirm first
$('gameMenu').addEventListener('close', () => { setBinding(null); if (ui.menu) { answer(false); ui.menu = false; } }); // the browser may close it without a cancel (repeated Esc)
$('gameMenu').addEventListener('click', e => { if (e.target === $('gameMenu') && !askRes) closeMenu(); }); // click on the dimmed backdrop
$('gmNav').onclick = e => { const v = e.target.closest('button')?.dataset.v; if (v === 'new') newGame(); else if (v === 'quit') quitGame(); else if (v) gmRender(v); };
$('gmView').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'gmNew') saveTo(null, $('gmName').value);
  else if (b.dataset.save) saveTo(b.dataset.save);
  else if (b.dataset.load) loadSlot(b.dataset.load);
  else if (b.dataset.del) delSlot(b.dataset.del);
  else if (b.dataset.bind) { setBinding(b.dataset.bind); gmRender(); $('gmView').querySelector(`[data-bind="${binding}"]`).focus(); }
  else if (b.id === 'gmKeysReset') { bindDefaults(); buildRemap(); saveBindings(); renderHint(); gmRender(); gmToast('Keys reset to the defaults.'); }
  else if (b.id === 'gmDefaults') { Object.assign(SET, SET_DEFAULT); applySettings(); saveSettings(); gmRender(); gmToast('Settings restored to defaults.'); }
});
$('gmView').addEventListener('keydown', e => { if (e.target.id === 'gmName' && e.key === 'Enter') saveTo(null, e.target.value); });
$('gmView').addEventListener('input', e => {
  const el = e.target, k = el.dataset.set; if (!k) return;
  SET[k] = el.type === 'range' ? el.value / 100 : el.type === 'checkbox' ? el.checked : el.value;
  applySettings(); saveSettings();
});
$('gmView').addEventListener('change', e => { if (e.target.dataset.set === 'sfx') SND.chime(); }); // let the player hear the new level
$('quitBack').onclick = () => { ui.quit = false; $('quitScreen').classList.remove('show'); $('menuBtn').focus(); };

const PERF = { last: 0, sum: 0, n: 0, told: false };
function perfWatch(now) { // one hint per session when Medium or High runs under ~40 FPS for 5 s of play (gaps over 0.2 s are a hidden or throttled tab)
  const d = now - (PERF.last || now); PERF.last = now;
  if (PERF.told || SET.quality === 'low' || ui.onboard || BT.active || !d || d > 200) return;
  PERF.sum += d; PERF.n++;
  if (PERF.sum < 5000) return;
  if (PERF.sum / PERF.n > 25) { PERF.told = true; flashHint('Running slowly? Lower <b>Graphics quality</b> in Settings (<kbd>Esc</kbd>)', 8000); }
  PERF.sum = PERF.n = 0;
}
function frame(now) { tick(); perfWatch(now); requestAnimationFrame(frame); }
function tick() { // one frame of the world; debug checks also step it directly, so they run while the pane is hidden (no rAF)
  if (innerWidth !== vw || innerHeight !== vh) resize();
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  pollPad(dt); // first: the quit screen still takes the gamepad (A returns to the game)
  if (ui.quit) return; // quit screen: the world stops
  setPlayTime(playTime + dt);
  musicTick(); ambientTick();
  if (ui.pokedex) { tickDex(dt); return; }
  tickTweens(dt); tickXYMixers(BT.active && BT.stop > 0 ? 0 : dt); // models freeze during a battle hit-stop
  if (!GAL.started && galleryD(P.pos.x, P.pos.z) < 14) loadGallery();
  if (!KAL.started) startKalos();
  if (renderPass.scene === BT.scene) battleTick(dt, t); else update(dt, t);
  renderer.info.reset(); composer.render(); // one frame's totals across every pass (debug.stats)
  if (!BT.active) drawMinimap();
}

export { MAX_SLOTS, answer, askRes, closeMenu, frame, gmRender, gmToast, newId, openMenu, readSlots, slotsBad, tick, writeSlots };
