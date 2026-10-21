import './34-battle-tweens-effects-arena.js'; // first: the modules run in file-number order (see main.js)
import { expAt } from '../battle-rules.js';
import { clamp } from './01-helpers.js';
import { $ } from './25-input.js';
import { STATUS } from './27-pokemon-data.js';
import { nm } from './28-evolution-data.js';
import { hpClass } from './29-save.js';
import { BT } from './34-battle-tweens-effects-arena.js';
import { EVO } from './39-evolution-scene.js';
import { SET, TEXT_SPEED } from './43-settings.js';

// ============================================================ battle: HUD, messages, menus
function setBar(id, f) { const b = $(id); b.style.width = clamp(f, 0, 1) * 100 + '%'; b.className = hpClass(f); }
function setSt(id, m) { const e = $(id), s = STATUS[m.status]; if (e.textContent !== (s?.[0] ?? '')) { e.textContent = s?.[0] ?? ''; e.style.background = s?.[1] ?? ''; } }
function drawBoxes() {
  const f = BT.foe, m = BT.me;
  if (f) { $('foeName').textContent = nm(f); $('foeLv').textContent = 'Lv' + f.level; setBar('foeHp', f.disp / f.maxHp); setSt('foeSt', f); }
  if (m) {
    $('meName').textContent = nm(m); $('meLv').textContent = 'Lv' + m.level; setBar('meHp', m.disp / m.maxHp); setSt('meSt', m);
    $('meHpNum').textContent = `${Math.ceil(m.disp)} / ${m.maxHp}`;
    const lo = expAt(m.level), hi = expAt(m.level + 1); $('meExp').style.width = clamp((m.expDisp - lo) / (hi - lo), 0, 1) * 100 + '%';
  }
}
const BM = { text: '', shown: 0, res: null, idle: 0 };
function bset(text) { BM.text = text; BM.shown = text.length; BM.res = null; $('bmsg').textContent = text; }
function bsay(text) { $('bmenu').innerHTML = ''; return new Promise(res => Object.assign(BM, { text, shown: 0, res, idle: 0 })); }
function tickMsg(dt) {
  if (!BM.res) return;
  if (BM.shown < BM.text.length) BM.shown = Math.min(BM.text.length, BM.shown + dt * 55 * TEXT_SPEED[SET.text]);
  else if ((BM.idle += dt) > 1.8) return bconfirm();
  $('bmsg').innerHTML = BM.text.slice(0, Math.floor(BM.shown)) + (BM.shown >= BM.text.length ? '<span class="more">▼</span>' : '');
}
function bconfirm() {
  if (!BM.res) return;
  if (BM.shown < BM.text.length) { BM.shown = BM.text.length; return; }
  const r = BM.res; BM.res = null; $('bmsg').textContent = BM.text; r();
}
const MN = { items: null, idx: 0, res: null, back: false };
function menu(items, o = {}) {
  return new Promise(res => {
    Object.assign(MN, { items, idx: Math.max(0, items.findIndex(i => !i.disabled)), res, back: !!o.back });
    const el = $('bmenu');
    el.className = 'bmenu' + (o.wide ? ' wide' : '');
    el.innerHTML = items.map((it, i) => `<button class="bbtn" data-i="${i}"${it.disabled ? ' disabled' : ''} style="--c:${it.color || '#2a3540'}">${it.tag ? `<em style="background:${it.color}">${it.tag}</em>` : ''}<span>${it.label}</span>${it.sub ? `<small>${it.sub}</small>` : ''}</button>`).join('')
      + (o.back ? '<button class="bbtn back" data-i="-1"><span>◀ Back</span></button>' : '');
    el.querySelectorAll('button').forEach(b => (b.onclick = () => menuPick(+b.dataset.i < 0 ? null : +b.dataset.i)));
    menuHighlight();
  });
}
function menuHighlight() { $('bmenu').querySelectorAll('button').forEach(b => b.classList.toggle('sel', +b.dataset.i === MN.idx)); }
function menuPick(i) {
  if (!MN.res || (i !== null && MN.items[i].disabled)) return;
  const r = MN.res; MN.res = null; $('bmenu').innerHTML = '';
  r(i === null ? null : MN.items[i].value);
}
function battleKey(e) {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'KeyB' && EVO.canCancel) { EVO.cancel = true; return; } // B stops an evolution
  const c = e.code, ok = ['KeyE', 'Space', 'Enter'].includes(c);
  if (MN.res) {
    const step = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1, ArrowUp: -2, KeyW: -2, ArrowDown: 2, KeyS: 2 }[c];
    if (step) { const i = MN.idx + step; if (i >= 0 && i < MN.items.length) { MN.idx = i; menuHighlight(); } }
    else if (ok) menuPick(MN.idx);
    else if (['Escape', 'Backspace', 'KeyQ'].includes(c) && MN.back) menuPick(null);
  } else if (ok) bconfirm();
}

export { BM, battleKey, bconfirm, bsay, bset, drawBoxes, menu, tickMsg };
