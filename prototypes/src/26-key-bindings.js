import './25-input.js'; // first: the modules run in file-number order (see main.js)
import * as THREE from 'three';
import { clamp, wrapAngle } from './01-helpers.js';
import { CAM_PITCH, START, ZOOM_MAX, ZOOM_MIN } from './02-hero-camera.js';
import { inKalos } from './03-fleurville-map.js';
import { T_SPAWN, inTest } from './05-paths-raised-plaza-stairs-tall-grass.js';
import { camera, canvas } from './06-renderer-scene-post.js';
import { GROUND } from './09-terrain.js';
import { KAL, kGround } from './16-fleurville-world.js';
import { P } from './19-characters.js';
import { QUEST_TALK, renderTracker, trackNext } from './21-side-quests.js';
import { fadeTo, placePlayer, portalKey, tGround, travel } from './24-fleurville-hud-travel.js';
import { $, keys, ui } from './25-input.js';
import { bagKey, closeBag, openBag } from './31-poke-mart.js';
import { dexKey, openPokedex } from './32-pokedex.js';
import { BT } from './34-battle-tweens-effects-arena.js';
import { battleKey, bconfirm } from './35-battle-hud-messages-menus.js';
import { EVO } from './39-evolution-scene.js';
import { answer, askRes, closeMenu, gmRender, gmToast, openMenu } from './44-game-menu.js';
import { OB, obKey } from './45-onboarding.js';

// ============================================================ key bindings (per browser) and gamepad
// A rebound key is translated into the default key it stands for before any other listener sees it, so every screen (bag, battle,
// Pokédex) follows the bindings without knowing about them; the default key it replaced goes quiet. The gamepad sends the same keys.
const BIND_KEY = 'verdant-keys-v1';
const BIND_ACTIONS = [['up', 'Walk forward', 'KeyW'], ['left', 'Walk left', 'KeyA'], ['down', 'Walk back', 'KeyS'], ['right', 'Walk right', 'KeyD'],
  ['act', 'Talk / read / confirm', 'KeyE'], ['bag', 'Bag', 'KeyB'], ['quest', 'Track the next quest', 'KeyQ'], ['view', 'First-person view', 'KeyV'],
  ['travel', 'Travel to Fleurville / Verdant', 'KeyT'], ['warp', 'Use a warp pad', 'KeyX']];
const BIND = {}, bindDefaults = () => { for (const [a, , d] of BIND_ACTIONS) BIND[a] = d; };
bindDefaults();
try { // stored bindings are untrusted: letters and digits only, each key used once, else the defaults
  const s = JSON.parse(localStorage.getItem(BIND_KEY)) || {}, v = BIND_ACTIONS.map(([a]) => s[a] ?? BIND[a]);
  if (v.every(c => /^(Key[A-Z]|Digit\d)$/.test(c)) && new Set(v).size === v.length) BIND_ACTIONS.forEach(([a], i) => (BIND[a] = v[i]));
} catch {}
let REMAP = new Map(), binding = null; // binding: the action waiting for its new key in the Controls page
function buildRemap() { // physical key -> the default key it now plays (null: a default key whose action moved elsewhere)
  REMAP = new Map();
  for (const [a, , d] of BIND_ACTIONS) if (BIND[a] !== d) { REMAP.set(BIND[a], d); if (!REMAP.has(d)) REMAP.set(d, null); }
}
buildRemap();
const kb = a => BIND[a].replace(/^(Key|Digit)/, ''); // the label of an action's key
const typing = el => el?.matches?.('input:not([type]), input[type=text], input[type=search], textarea');
for (const type of ['keydown', 'keyup']) addEventListener(type, e => {
  if (!e.isTrusted || typing(e.target)) return; // synthetic keys (the gamepad, our own remaps) are already the default keys
  if (binding && type === 'keydown') { e.preventDefault(); e.stopImmediatePropagation(); return bindKey(e.code); }
  if (!REMAP.has(e.code)) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const to = REMAP.get(e.code);
  if (to) e.target.dispatchEvent(new KeyboardEvent(type, { code: to, key: to.slice(3).toLowerCase(), repeat: e.repeat, shiftKey: e.shiftKey, bubbles: true, cancelable: true }));
}, true); // capture: before every other key listener
function bindKey(code) {
  const a = binding; binding = null;
  if (code === 'Escape' || code === 'Tab') {} // cancel
  else if (!/^(Key[A-Z]|Digit\d)$/.test(code)) gmToast('Use a letter or number key.', true);
  else if (code === 'KeyG') gmToast('G is taken: it goes to the Test Grounds.', true); // a fixed shortcut, not in BIND_ACTIONS
  else {
    const other = BIND_ACTIONS.find(([o]) => o !== a && BIND[o] === code)?.[0];
    if (other) BIND[other] = BIND[a]; // the two actions swap keys
    BIND[a] = code; buildRemap(); saveBindings(); renderHint();
    gmToast(other ? `Swapped with “${BIND_ACTIONS.find(x => x[0] === other)[1]}”.` : 'Key changed.');
  }
  gmRender(); $('gmView').querySelector(`[data-bind="${a}"]`)?.focus(); // the re-render dropped the focus
}
function saveBindings() { try { localStorage.setItem(BIND_KEY, JSON.stringify(BIND)); } catch { gmToast('Keys work now but can’t be remembered: browser storage is blocked.', true); } }
function renderHint() {
  $('hint').innerHTML = KAL.pad ? `<kbd>${kb('warp')}</kbd> enter ${KAL.pad.name}` : `<kbd>${kb('up')}${kb('left')}${kb('down')}${kb('right')}</kbd> walk · <kbd>Shift</kbd> run · <kbd>${kb('act')}</kbd> talk · click to move · drag to look · <kbd>${kb('quest')}</kbd> track quest · <kbd>${kb('view')}</kbd> first person · scroll to zoom · <kbd>G</kbd> test grounds · <kbd>${kb('travel')}</kbd> travel to Fleurville`;
  // other text that names a key reads kb() when it is shown; these labels are set up front, so they follow a change here
  $('viewBtn').setAttribute('aria-label', `First-person view (${kb('view')})`); $('bagBtn').setAttribute('aria-label', `Bag (${kb('bag')})`);
  if ($('quests').childElementCount) renderTracker(); // the "· T" on a quest on the other map (once the tracker is up)
}
renderHint();

// Gamepad (standard mapping): the left stick or d-pad walks, B held runs, the right stick turns the camera. Buttons become key presses:
// A = E, X = Bag, Y = next quest, Start = Game Menu, Back = first person, LB = travel, RB = warp pad. In menus the stick moves
// between items: screens with their own arrow keys (battle, bag, Pokédex) get arrows; dialogs with plain buttons move the focus.
const GP = { x: 0, z: 0, run: false, prev: [], dir: null, rep: 0 };
const padSend = code => { const t = document.activeElement || document.body; // a key press as if typed (down, then up)
  for (const type of ['keydown', 'keyup']) t.dispatchEvent(new KeyboardEvent(type, { code, key: code === 'Escape' ? code : code.replace(/^Key|^Arrow/, ''), bubbles: true, cancelable: true })); };
function padRoot() { // the dialog whose buttons the gamepad walks through, if any
  if (ui.menu) return $('gmAsk').classList.contains('show') ? $('gmAsk') : $('gameMenu');
  if (ui.shop) return $('shop');
  if (ui.quit) return $('quitScreen');
  if (ui.bag && $('bpParty').classList.contains('show')) return $('bpParty');
  if (ui.onboard && OB.stage !== 'title' && !ui.dialog) return $('obForm');
  return null;
}
function padFocus(root, d) { // up/down (and left/right off a slider or list) step through the focusable controls
  const el = document.activeElement;
  if (root.contains(el) && (d === 'ArrowLeft' || d === 'ArrowRight')) {
    const k = d === 'ArrowRight' ? 1 : -1;
    if (el.type === 'range') { el.value = +el.value + k * 5; return el.dispatchEvent(new Event('input', { bubbles: true })); }
    if (el.tagName === 'SELECT') { el.selectedIndex = clamp(el.selectedIndex + k, 0, el.options.length - 1); el.dispatchEvent(new Event('input', { bubbles: true })); return el.dispatchEvent(new Event('change', { bubbles: true })); }
  }
  const all = [...root.querySelectorAll('button, input, select, [tabindex="0"]')].filter(x => !x.disabled && x.offsetParent && !x.closest('[inert], [hidden]'));
  if (!all.length) return;
  const i = all.indexOf(el), k = d === 'ArrowDown' || d === 'ArrowRight' ? 1 : -1;
  all[i < 0 ? 0 : (i + k + all.length) % all.length].focus();
}
function padBack() { // B: back out of whatever is open
  if (ui.menu) return binding ? bindKey('Escape') : askRes ? answer(false) : closeMenu();
  if (ui.shop) return $('shop').close();
  if (ui.quit) return $('quitBack').click();
  if (ui.dialog && !ui.onboard && !BT.active) return padSend('KeyE'); // B also moves overworld text on (Esc would open the Game Menu)
  padSend(BT.active && EVO.canCancel ? 'KeyB' : 'Escape'); // bag, Pokédex, battle menus, skipping the intro
}
function pollPad(dt) {
  const pad = [...(navigator.getGamepads?.() ?? [])].find(p => p?.connected && p.mapping === 'standard') || null;
  if (!pad) { GP.x = GP.z = 0; GP.run = false; GP.prev = []; return; }
  const dz = v => Math.abs(v) < 0.25 ? 0 : v, b = i => !!pad.buttons[i]?.pressed, hit = i => b(i) && !GP.prev[i];
  const sx = dz(pad.axes[0] ?? 0) + b(15) - b(14), sz = dz(pad.axes[1] ?? 0) + b(13) - b(12);
  const free = !ui.dialog && !ui.battle && !ui.pokedex && !ui.onboard && !ui.bag && !ui.menu && !ui.shop && !ui.quit;
  GP.x = free ? sx : 0; GP.z = free ? sz : 0; GP.run = b(1);
  if (free) { // the right stick turns the camera like a mouse drag
    const rx = dz(pad.axes[2] ?? 0), ry = dz(pad.axes[3] ?? 0);
    VIEW.yaw = wrapAngle(VIEW.yaw - rx * 2.4 * dt);
    if (VIEW.fpv) VIEW.look = clamp(VIEW.look - ry * 1.6 * dt, -1.2, 0.6); else VIEW.pitch = clamp(VIEW.pitch + ry * 1.6 * dt, 0.35, 1.4);
  }
  // menus: the stick or d-pad steps once, then repeats while held
  const dir = free ? null : Math.abs(sx) > Math.abs(sz) ? (sx > 0.5 ? 'ArrowRight' : sx < -0.5 ? 'ArrowLeft' : null) : (sz > 0.5 ? 'ArrowDown' : sz < -0.5 ? 'ArrowUp' : null);
  if (dir !== GP.dir) { GP.dir = dir; GP.rep = 0.4; if (dir) padDir(dir); }
  else if (dir && (GP.rep -= dt) <= 0) { GP.rep = 0.12; padDir(dir); }
  const root = padRoot();
  if (hit(0)) root ? (root.contains(document.activeElement) ? document.activeElement.click() : padFocus(root, 'ArrowDown')) : padSend('KeyE');
  if (hit(1) && !free) padBack();
  if (hit(2) && (free || ui.bag)) padSend('KeyB');
  if (hit(3) && free) padSend('KeyQ');
  if (hit(9)) free ? openMenu() : ui.menu && closeMenu();
  if (hit(8) && free) padSend('KeyV');
  if (hit(4) && free) padSend('KeyT');
  if (hit(5) && (free || ui.dialog?.portal)) padSend('KeyX');
  GP.prev = pad.buttons.map(x => x.pressed);
}
function padDir(d) { const root = padRoot(); root ? padFocus(root, d) : padSend(d); }
function flashHint(html, ms) { const h = $('hint'); h.innerHTML = html; h.style.opacity = 1; clearTimeout(h._t); h._t = setTimeout(() => (h.style.opacity = 0), ms); } // the top pill, briefly
addEventListener('gamepadconnected', e => e.gamepad.mapping === 'standard' && flashHint('Controller connected · <kbd>A</kbd> talk · <kbd>B</kbd> run / back · <kbd>X</kbd> bag · <kbd>Y</kbd> quest · <kbd>Start</kbd> menu', 6000));
addEventListener('keydown', e => {
  if (ui.onboard) return obKey(e);
  if (ui.menu || ui.quit || ui.shop) return; // the Game Menu and shop dialogs handle their own keys (Esc closes them)
  if (ui.pokedex) return dexKey(e);
  if (ui.bag) return bagKey(e);
  if (BT.active) return battleKey(e);
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (['KeyE', 'Space', 'Enter'].includes(e.code) && !e.repeat) act();
  if (e.code === 'KeyG' && !e.repeat) fadeTo(() => inTest(P.pos.x) ? placePlayer(...START, Math.PI / 2 + 0.25) : placePlayer(...T_SPAWN, Math.PI)); // testing shortcut: the Test Grounds and back
  if (e.code === 'Escape' && !e.repeat) { e.preventDefault(); openMenu(); } // preventDefault: this Esc must not also close the dialog it opens
  if (e.code === 'KeyB' && !e.repeat) openBag();
  if (e.code === 'KeyX' && !e.repeat) portalKey();
  if (e.code === 'KeyV' && !e.repeat) toggleView();
  if (e.code === 'KeyQ' && !e.repeat) trackNext(); // track the next quest in the list
  if (e.code === 'KeyT' && !e.repeat) travel(!inKalos(P.pos.x)); // travel between Verdant Town and Fleurville Town
  if (e.code === 'Backquote' && !e.repeat) { // testing shortcut: give a Pokémon at a level, plus items (see window.debug)
    keys.clear();
    const a = prompt('Debug give: SPECIES LEVEL [item=qty ...] [money=N] [nick=Name] [gender=male|female]', 'EEVEE 20 waterStone=1');
    if (a) { const [k, lv, ...rest] = a.trim().split(/\s+/), items = {}, o = {}; for (const r of rest) { const [x, y] = r.split('='); if (x === 'nick' || x === 'gender') o[x] = y; else items[x] = y ?? 1; } debug.give(k, lv, items, o.nick, o.gender); }
  }
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
let zoom = 1, moveTarget = null, drag = null;
// yaw 0 and CAM_PITCH are the original hero framing; look is the first-person pitch
const VIEW = { fpv: false, yaw: 0, pitch: CAM_PITCH, look: -0.15 };
function toggleView() {
  VIEW.fpv = !VIEW.fpv;
  if (VIEW.fpv) { VIEW.yaw = P.face + Math.PI; VIEW.look = -0.15; } // look the way the trainer faces; leaving keeps the camera behind that direction
  $('viewBtn').setAttribute('aria-pressed', VIEW.fpv);
}
addEventListener('wheel', e => { if (!ui.pokedex && !ui.menu && !ui.onboard) zoom = clamp(zoom * (e.deltaY > 0 ? 1.08 : 0.93), ZOOM_MIN, ZOOM_MAX); }, { passive: true });
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
canvas.addEventListener('pointerdown', e => {
  if (ui.onboard) { if (ui.dialog) act(); return; }
  if (ui.pokedex) return;
  if (BT.active) return bconfirm();
  if (ui.dialog) return act();
  drag = { x: e.clientX, y: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => { // dragging turns the camera; a click without a drag walks there
  if (!drag || !e.buttons) return void (drag = null); // a missed pointerup must not leave plain hovering turning the view
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 6) return;
  drag.moved = true; drag.x = e.clientX; drag.y = e.clientY;
  VIEW.yaw = wrapAngle(VIEW.yaw - dx * 0.005);
  if (VIEW.fpv) VIEW.look = clamp(VIEW.look - dy * 0.005, -1.2, 0.6); else VIEW.pitch = clamp(VIEW.pitch + dy * 0.005, 0.35, 1.4);
});
canvas.addEventListener('pointerup', e => {
  const d = drag; drag = null;
  if (!d || d.moved || e.button !== 0) return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects([...GROUND, kGround, tGround])[0];
  if (hit) moveTarget = { x: hit.point.x, z: hit.point.z, t: 0 };
});
canvas.addEventListener('pointercancel', () => (drag = null));
canvas.addEventListener('contextmenu', e => e.preventDefault()); // right-drag turns the camera too
$('dialog').addEventListener('click', act);
$('bmsg').addEventListener('click', () => bconfirm());
$('bagBtn').onclick = openBag;
$('bpClose').onclick = closeBag;
$('bpPartyBack').onclick = () => $('bpParty').classList.remove('show');
$('backpack').addEventListener('cancel', e => { e.preventDefault(); closeBag(); });
$('backpack').addEventListener('click', e => { if (e.target === $('backpack')) closeBag(); }); // click on the dimmed backdrop
$('menuBtn').onclick = () => openMenu();
$('dexBtn').onclick = openPokedex;
$('viewBtn').onclick = toggleView;

let nearest = null, typed = 0;
function showLine() { $('who').textContent = ui.dialog.name; typed = 0; $('dtext').textContent = ''; }
function act() {
  if (ui.pokedex) return;
  if (ui.dialog) {
    const full = ui.dialog.lines[ui.dialog.i];
    if (typed < full.length) { typed = full.length; $('dtext').textContent = full; return; } // the frame loop stops drawing once typed is full, so draw it here
    if (++ui.dialog.i >= ui.dialog.lines.length) { const after = ui.dialog.after; ui.dialog = null; $('dialog').classList.remove('show'); after?.(); return; }
    return showLine();
  }
  if (!nearest) return;
  const q = QUEST_TALK[nearest.name]?.(); // a quest's own lines and outcome win over the NPC's everyday ones
  say(nearest.name, q ? q[0] : nearest.lines, nearest.npc, q ? q[1] : nearest.after);
}
function say(name, lines, npcRef, after) {
  ui.dialog = { name: name || '…', lines, i: 0, npc: npcRef, after }; moveTarget = null;
  $('dialog').classList.add('show'); showLine();
}
setTimeout(() => ($('hint').style.opacity = 0), 9000);

// other modules assign these through their setters (an imported binding is read-only)
function setMoveTarget(v) { return (moveTarget = v); }
function setZoom(v) { return (zoom = v); }
function setNearest(v) { return (nearest = v); }
function setTyped(v) { return (typed = v); }
function setBinding(v) { return (binding = v); }
export { BIND_ACTIONS, GP, VIEW, act, bindDefaults, binding, buildRemap, flashHint, kb, moveTarget, nearest, pollPad, renderHint,
  saveBindings, say, setBinding, setMoveTarget, setNearest, setTyped, setZoom, typed, zoom };
