import './29-save.js'; // first: the modules run in file-number order (see main.js)
import { cure } from '../battle-rules.js';
import { clamp } from './01-helpers.js';
import { $ } from './25-input.js';
import { kb } from './26-key-bindings.js';
import { STATUS } from './27-pokemon-data.js';
import { bag, bagAt, bagSort, evoFor, money, nm, party, setBagSort } from './28-evolution-data.js';
import { renderParty, saveGame } from './29-save.js';
import { closeBag } from './31-poke-mart.js';
import { evolveNow } from './39-evolution-scene.js';

// ============================================================ Backpack
const ICON = { // small hand-drawn SVG item icons
  spray: (body, cap) => `<svg viewBox="0 0 48 48"><rect x="17" y="4" width="14" height="8" rx="2" fill="#dcdfe6" stroke="#2a3540" stroke-width="2.5"/><path d="M31 8h6" stroke="#2a3540" stroke-width="3" stroke-linecap="round"/><rect x="12" y="12" width="24" height="32" rx="7" fill="${body}" stroke="#2a3540" stroke-width="2.5"/><rect x="16" y="22" width="16" height="12" rx="3" fill="#fff" opacity=".9"/><path d="M24 25v6M21 28h6" stroke="${cap}" stroke-width="3" stroke-linecap="round"/><path d="M15 16q2-2 5-2" stroke="#fff" stroke-width="2.5" opacity=".7" fill="none" stroke-linecap="round"/></svg>`,
  ball: (top, band) => `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="19" fill="#fafafa" stroke="#2a3540" stroke-width="2.5"/><path d="M5 24a19 19 0 0 1 38 0z" fill="${top}" stroke="#2a3540" stroke-width="2.5"/>${band ? `<path d="M11 13l6 5M37 13l-6 5" stroke="${band}" stroke-width="4" stroke-linecap="round"/>` : ''}<path d="M5 24h38" stroke="#2a3540" stroke-width="2.5"/><circle cx="24" cy="24" r="6" fill="#fff" stroke="#2a3540" stroke-width="2.5"/><path d="M13 15q4-5 9-6" stroke="#fff" stroke-width="2.5" opacity=".6" fill="none" stroke-linecap="round"/></svg>`,
  berry: (fruit, leaf) => `<svg viewBox="0 0 48 48"><path d="M24 12q-2-6 4-9" stroke="#5a3a20" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M26 8q8-4 12 2q-7 4-12-2z" fill="${leaf}" stroke="#2a3540" stroke-width="2"/><circle cx="24" cy="28" r="15" fill="${fruit}" stroke="#2a3540" stroke-width="2.5"/><circle cx="18" cy="23" r="4" fill="#fff" opacity=".55"/></svg>`,
  map: () => `<svg viewBox="0 0 48 48"><path d="M6 10l11-4 14 4 11-4v32l-11 4-14-4-11 4z" fill="#f2e2b8" stroke="#2a3540" stroke-width="2.5" stroke-linejoin="round"/><path d="M17 6v32M31 10v32" stroke="#2a3540" stroke-width="2" opacity=".5"/><path d="M9 30q8-8 14-2t16-8" stroke="#4f8ef0" stroke-width="3" fill="none"/><circle cx="24" cy="18" r="3" fill="#e2473b"/></svg>`,
  stone: (fill, core) => `<svg viewBox="0 0 48 48"><path d="M24 5l14 10-4 23-10 6-10-6-4-23z" fill="${fill}" stroke="#2a3540" stroke-width="2.5" stroke-linejoin="round"/><path d="M24 9l-6 11 6 20 6-20z" fill="${core}" opacity=".55"/><path d="M15 16q3-5 8-7" stroke="#fff" stroke-width="2.5" opacity=".6" fill="none" stroke-linecap="round"/></svg>`,
  chip: () => `<svg viewBox="0 0 48 48"><path d="M14 10v-5M24 10v-5M34 10v-5M14 43v-5M24 43v-5M34 43v-5M10 14h-5M10 24h-5M10 34h-5M43 14h-5M43 24h-5M43 34h-5" stroke="#c9a03a" stroke-width="3" stroke-linecap="round"/><rect x="10" y="10" width="28" height="28" rx="4" fill="#3f5a4a" stroke="#2a3540" stroke-width="2.5"/><circle cx="24" cy="24" r="7" fill="#ffcf5a" stroke="#2a3540" stroke-width="2"/><path d="M24 13v3M24 32v3M13 24h3M32 24h3" stroke="#ffcf5a" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  pocket: k => ({ all: '<svg viewBox="0 0 48 48"><g fill="#fff3dc" stroke="#2a3540" stroke-width="2.5"><rect x="6" y="6" width="15" height="15" rx="3"/><rect x="27" y="6" width="15" height="15" rx="3"/><rect x="6" y="27" width="15" height="15" rx="3"/><rect x="27" y="27" width="15" height="15" rx="3"/></g></svg>', med: ICON.spray('#a874e0', '#e2473b'), items: ICON.stone('#f2652b', '#ffd23f'), balls: ICON.ball('#e2473b'), berries: ICON.berry('#4a78d8', '#4caf50'), key: ICON.map() })[k],
};
const stoneItem = (name, fill, core, what, price) => ({ name, pocket: 'items', icon: ICON.stone(fill, core), stone: true, price,
  desc: `A peculiar stone that can make certain species of Pokémon evolve. ${what}` }); // official item text (SwSh/SV)
const ITEMS = {
  potion: { name: 'Potion', pocket: 'med', icon: ICON.spray('#a874e0', '#e2473b'), heal: 20, desc: 'A spray-type medicine for treating wounds. It restores the HP of one Pokémon by 20 points.' },
  superPotion: { name: 'Super Potion', pocket: 'med', icon: ICON.spray('#f08a3a', '#e2473b'), heal: 60, desc: 'A spray-type medicine for treating wounds. It restores the HP of one Pokémon by 60 points.' },
  antidote: { name: 'Antidote', pocket: 'med', icon: ICON.spray('#f2c12e', '#3fae4a'), cure: 'psn', price: 200, desc: 'A spray-type medicine for poisoning. It lifts the effect of poison from one Pokémon.' },
  paralyzeHeal: { name: 'Paralyze Heal', pocket: 'med', icon: ICON.spray('#f2d23a', '#3f7fd8'), cure: 'par', price: 300, desc: 'A spray-type medicine for paralysis. It can be used once to free a Pokémon that has been paralyzed.' },
  awakening: { name: 'Awakening', pocket: 'med', icon: ICON.spray('#5ab8e8', '#2a3540'), cure: 'slp', price: 100, desc: 'A spray-type medicine used against sleep. It can be used once to rouse a Pokémon from the clutches of sleep.' },
  ball: { name: 'Poké Ball', pocket: 'balls', icon: ICON.ball('#e2473b'), battle: true, catch: 1, desc: 'A device for catching wild Pokémon. It is thrown like a ball at a Pokémon, comfortably encapsulating its target.' },
  greatBall: { name: 'Great Ball', pocket: 'balls', icon: ICON.ball('#3f7fd8', '#e2473b'), battle: true, catch: 1.5, desc: 'A good, high-performance Poké Ball that provides a higher success rate for catching Pokémon than a standard Poké Ball.' },
  oranBerry: { name: 'Oran Berry', pocket: 'berries', icon: ICON.berry('#4a78d8', '#4caf50'), heal: 10, desc: 'A Berry to be consumed by Pokémon. If a Pokémon holds one, it can restore its own HP by 10 points during battle.' },
  pechaBerry: { name: 'Pecha Berry', pocket: 'berries', icon: ICON.berry('#f48ab8', '#4caf50'), cure: 'psn', desc: 'A Berry to be consumed by Pokémon. If a Pokémon holds one, it can recover from poisoning on its own in battle.' },
  townMap: { name: 'Town Map', pocket: 'key', icon: ICON.map(), map: true, desc: 'A very convenient map that can be viewed anytime. It even shows where you are right now.' },
  signalChip: { name: 'Signal Chip', pocket: 'key', icon: ICON.chip(), get check() { return `A sunburst over two letters is stamped on it. Clemont in Fleurville can read it. Press ${kb('travel')} to travel there.`; },
    desc: 'A chip from inside the survey device in the woodland clearing. It still feels faintly warm. Prof. Sycamore asked you to bring it to Clemont.' }, // held only while it is being delivered (syncKeyItems)
  // evolution stones; price = what the Poké Mart asks (only the Gen 1 five are sold there)
  fireStone: stoneItem('Fire Stone', '#f2652b', '#ffd23f', 'The stone has a fiery orange heart.', 2100),
  waterStone: stoneItem('Water Stone', '#3f8de0', '#bfe6ff', 'It is the clear blue of a pool of water.', 2100),
  thunderStone: stoneItem('Thunder Stone', '#7cc85a', '#fff16a', 'It has a distinct thunderbolt pattern.', 2100),
  leafStone: stoneItem('Leaf Stone', '#4caf50', '#d6f5a0', 'It has an unmistakable leaf pattern.', 2100),
  moonStone: stoneItem('Moon Stone', '#6b6f80', '#c9cbe0', 'It is as black as the night sky.', 2100),
  sunStone: stoneItem('Sun Stone', '#f28c28', '#e2473b', 'It burns as red as the evening sun.'),
  shinyStone: stoneItem('Shiny Stone', '#e8ecf5', '#9fb4e0', 'It shines with a dazzling light.'),
  duskStone: stoneItem('Dusk Stone', '#4a3a6a', '#9a6ad8', 'It holds shadows as dark as can be.'),
  dawnStone: stoneItem('Dawn Stone', '#4fd0c8', '#e0fffb', 'It sparkles like a glittering eye.'),
  iceStone: stoneItem('Ice Stone', '#a8e0f0', '#ffffff', 'It has an unmistakable snowflake pattern.'),
};
const POCKETS = [['all', 'All Items'], ['med', 'Medicine'], ['items', 'Items'], ['balls', 'Poké Balls'], ['berries', 'Berries'], ['key', 'Key Items']];
const BP = { pocket: 'all', idx: 0, item: null };
const BAG_SORTS = { // Backpack orders; Array.sort is stable, so ties keep the ITEMS order
  recent: ['Recent first', (a, b) => (bagAt[b] || 0) - (bagAt[a] || 0)],
  oldest: ['Oldest first', (a, b) => (bagAt[a] || 0) - (bagAt[b] || 0)],
  name: ['Name A–Z', (a, b) => ITEMS[a].name.localeCompare(ITEMS[b].name)],
  qty: ['Most held', (a, b) => bag[b] - bag[a]],
  pocket: ['Pocket', (a, b) => POCKETS.findIndex(p => p[0] === ITEMS[a].pocket) - POCKETS.findIndex(p => p[0] === ITEMS[b].pocket)],
};
const inPocket = (k, p) => bag[k] > 0 && (p === 'all' || ITEMS[k].pocket === p);
const bpItems = () => Object.keys(ITEMS).filter(k => inPocket(k, BP.pocket)).sort(BAG_SORTS[bagSort][1]);
$('bpSort').innerHTML = Object.entries(BAG_SORTS).map(([k, [label]]) => `<option value="${k}">${label}</option>`).join('');
$('bpSort').onchange = e => { setBagSort(e.target.value); BP.idx = 0; renderBag(); saveGame(); };
const SACK_SVG = `<svg viewBox="0 0 100 100"><path d="M30 30V22a20 20 0 0 1 40 0v8" stroke="#7a3f12" stroke-width="7" fill="none" stroke-linecap="round"/><rect x="14" y="28" width="72" height="62" rx="18" fill="#e86a2a" stroke="#2a3540" stroke-width="4"/><rect x="26" y="52" width="48" height="30" rx="9" fill="#f6a83c" stroke="#2a3540" stroke-width="4"/><path d="M14 46h72" stroke="#2a3540" stroke-width="4"/><circle cx="50" cy="46" r="7" fill="#ffd23f" stroke="#2a3540" stroke-width="4"/><path d="M24 36q8-4 16-4" stroke="#fff" stroke-width="4" opacity=".5" fill="none" stroke-linecap="round"/></svg>`;
function renderBag() {
  const list = bpItems(); BP.idx = clamp(BP.idx, 0, Math.max(0, list.length - 1)); BP.item = list[BP.idx] || null;
  $('bpMoney').textContent = `₽ ${money.toLocaleString()}`; $('bpSort').value = bagSort;
  $('bpSack').innerHTML = SACK_SVG;
  $('bpTabs').innerHTML = POCKETS.map(([k, label]) => `<button class="bp-tab" role="tab" data-p="${k}" aria-selected="${k === BP.pocket}">${ICON.pocket(k)}${label}<small>${Object.keys(ITEMS).filter(i => inPocket(i, k)).length}</small></button>`).join('');
  $('bpTabs').querySelectorAll('button').forEach(b => (b.onclick = () => bagPocket(b.dataset.p)));
  $('bpList').innerHTML = list.length ? list.map((k, i) => `<button class="bp-item" role="option" data-i="${i}" aria-selected="${i === BP.idx}">${ITEMS[k].icon}<span>${ITEMS[k].name}</span><span class="qty">×${bag[k]}</span></button>`).join('') : '<div class="bp-empty">This pocket is empty.</div>';
  $('bpList').querySelectorAll('.bp-item').forEach(b => (b.onclick = () => { BP.idx = +b.dataset.i; renderBag(); }));
  const it = BP.item && ITEMS[BP.item];
  $('bpDetail').innerHTML = it ? `<div class="art">${it.icon}</div><div class="cat">${POCKETS.find(p => p[0] === it.pocket)[1]}</div><h3>${it.name} <span style="opacity:.55;font-size:17px">×${bag[BP.item]}</span></h3><p>${it.desc}</p>
    <div class="bp-actions"><button class="use" id="bpUse"${it.battle ? ' disabled title="Use it in battle"' : ''}>${it.pocket === 'key' ? 'Check' : 'Use'}</button><button id="bpToss"${it.pocket === 'key' ? ' disabled title="Key items can’t be thrown away"' : ''}>Toss</button></div>` : '<div class="bp-empty">Pick an item to see what it does.</div>';
  if (it) { $('bpUse').onclick = bagUse; $('bpToss').onclick = bagToss; }
}
function bagPocket(p) { if (p === BP.pocket) return; BP.pocket = p; BP.idx = 0; renderBag(); $('bpSack').firstChild.classList.add('wiggle'); }
function bagToast(text) { const t = $('bpToast'); t.textContent = text; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1800); }
function bagToss() { const k = BP.item; if (!k || ITEMS[k].pocket === 'key') return; bag[k]--; bagToast(`Threw away one ${ITEMS[k].name}.`); renderBag(); saveGame(); }
function bagUse() {
  const k = BP.item, it = k && ITEMS[k]; if (!it) return;
  if (it.map) { bagToast('Verdant Town — a quiet town where the green never fades.'); return; }
  if (it.check) { bagToast(it.check); return; }
  $('bpPartyTitle').textContent = `Use the ${it.name} on which Pokémon?`;
  const sex = m => ({ male: ' <span style="color:#3f7fd8">♂</span>', female: ' <span style="color:#e2473b">♀</span>' })[m.gender] || '';
  $('bpPartyList').innerHTML = party.map((m, i) => { const f = m.hp / m.maxHp; return `<button class="bp-mon" data-i="${i}"><span>${nm(m)}${sex(m)} <span style="opacity:.6">Lv${m.level}</span></span><small>${it.stone ? (evoFor(m, k) ? 'ABLE' : 'NOT ABLE') : `${m.status ? STATUS[m.status][0] + ' · ' : ''}HP ${m.hp} / ${m.maxHp}`}</small><span class="hpbar"><b class="${f < 0.2 ? 'low' : f < 0.5 ? 'mid' : ''}" style="width:${f * 100}%"></b></span></button>`; }).join('');
  $('bpPartyList').querySelectorAll('.bp-mon').forEach(b => (b.onclick = () => bagApply(k, +b.dataset.i, b)));
  $('bpParty').classList.add('show'); $('bpPartyList').querySelector('button')?.focus();
}
function bagApply(k, i, btn) {
  const it = ITEMS[k], m = party[i];
  if (it.stone) { // evolves on the spot; a stone evolution can't be stopped
    const e = evoFor(m, k);
    if (!e) { bagToast("It won't have any effect."); return; }
    bag[k]--; saveGame(); closeBag();
    evolveNow(m, e);
    return;
  }
  if (m.hp <= 0) { bagToast(`${nm(m)} has fainted. It won't have any effect.`); return; }
  if (it.cure) {
    if (m.status !== it.cure) { bagToast(`${nm(m)} isn't ${STATUS[it.cure][2]}. It won't have any effect.`); return; }
    cure(m); bag[k]--;
    btn.querySelector('small').textContent = `HP ${m.hp} / ${m.maxHp}`;
    bagToast(`${nm(m)} is no longer ${STATUS[it.cure][2]}.`); renderParty(); saveGame();
    setTimeout(() => { $('bpParty').classList.remove('show'); renderBag(); }, 900);
    return;
  }
  if (m.hp >= m.maxHp) { bagToast(`${nm(m)}'s HP is already full.`); return; }
  const before = m.hp; m.hp = Math.min(m.maxHp, m.hp + it.heal); bag[k]--;
  const f = m.hp / m.maxHp, bar = btn.querySelector('b'); bar.className = f < 0.2 ? 'low' : f < 0.5 ? 'mid' : ''; bar.style.width = f * 100 + '%';
  btn.querySelector('small').textContent = `HP ${m.hp} / ${m.maxHp}`;
  bagToast(`${nm(m)}'s HP was restored by ${m.hp - before} points.`); renderParty(); saveGame();
  setTimeout(() => { $('bpParty').classList.remove('show'); renderBag(); }, 900);
}

export { BAG_SORTS, BP, ITEMS, POCKETS, bagPocket, bagUse, bpItems, renderBag };
