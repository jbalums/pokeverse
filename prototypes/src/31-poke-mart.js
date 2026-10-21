import './30-backpack.js'; // first: the modules run in file-number order (see main.js)
import { P } from './19-characters.js';
import { $, keys, ui } from './25-input.js';
import { setMoveTarget } from './26-key-bindings.js';
import { aOr, bag, money, setMoney } from './28-evolution-data.js';
import { saveGame } from './29-save.js';
import { BP, ITEMS, POCKETS, bagPocket, bagUse, bpItems, renderBag } from './30-backpack.js';

// ============================================================ Poké Mart (Fleurville): status cures and the Gen 1 stones
const SHOP_STOCK = ['antidote', 'paralyzeHeal', 'awakening', 'fireStone', 'waterStone', 'thunderStone', 'leafStone', 'moonStone'];
function renderShop() {
  $('shopMoney').textContent = `₽ ${money.toLocaleString()}`;
  $('shopList').innerHTML = SHOP_STOCK.map(k => `<div class="bp-item">${ITEMS[k].icon}<span>${ITEMS[k].name}<small>In bag: ${bag[k] || 0}</small></span><span class="qty">₽${ITEMS[k].price.toLocaleString()}</span><button class="buy" data-k="${k}" aria-label="Buy ${aOr(ITEMS[k].name)} for ₽${ITEMS[k].price}">Buy</button></div>`).join('');
  $('shopList').querySelectorAll('.buy').forEach(b => (b.onclick = () => shopBuy(b.dataset.k)));
}
function shopToast(text, err = false) { const t = $('shopToast'); t.textContent = text; t.classList.toggle('err', err); t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1800); }
function shopBuy(k) {
  const it = ITEMS[k];
  if (money < it.price) return shopToast("You don't have enough money.", true);
  setMoney(money - it.price); bag[k] = (bag[k] || 0) + 1; saveGame();
  renderShop(); $('shopList').querySelector(`[data-k="${k}"]`)?.focus();
  shopToast(`You bought ${aOr(it.name)}!`);
}
function openShop() {
  if (ui.battle || ui.dialog || ui.pokedex || ui.bag || ui.shop) return;
  ui.shop = true; keys.clear(); setMoveTarget(null); P.v = 0;
  renderShop(); $('shop').showModal(); $('shopList').focus(); // not a Buy button: the E / Space / Enter that closed the clerk's text would press it
}
$('shopClose').onclick = () => $('shop').close();
$('shop').addEventListener('close', () => { ui.shop = false; keys.clear(); }); // Esc or the close button
function openBag() {
  if (ui.battle || ui.dialog || ui.pokedex || ui.bag) return;
  ui.bag = true; keys.clear(); setMoveTarget(null); P.v = 0; // P.v: stop a coasting step, as the Game Menu does
  BP.pocket = 'all'; BP.idx = 0; // the bag always opens on every item, newest first by default
  renderBag(); $('backpack').showModal(); $('bpList').querySelector('.bp-item')?.focus();
}
function closeBag() { if (!ui.bag) return; ui.bag = false; $('bpParty').classList.remove('show'); $('backpack').close(); $('bagBtn').focus(); }
function bagKey(e) {
  const partyOpen = $('bpParty').classList.contains('show');
  if (e.code === 'Escape') { e.preventDefault(); return partyOpen ? $('bpParty').classList.remove('show') : closeBag(); }
  if (e.code === 'KeyB' && !e.repeat) { e.preventDefault(); return closeBag(); } // B toggles the bag
  if (partyOpen) return; // the party sheet uses normal button focus (Tab / Enter)
  if (e.target.tagName === 'SELECT') return; // the sort menu keeps its own arrow keys
  const list = bpItems(), pi = POCKETS.findIndex(p => p[0] === BP.pocket);
  if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); BP.idx = Math.min(list.length - 1, BP.idx + 1); renderBag(); }
  else if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); BP.idx = Math.max(0, BP.idx - 1); renderBag(); }
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); bagPocket(POCKETS[(pi + 1) % POCKETS.length][0]); }
  else if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); bagPocket(POCKETS[(pi + POCKETS.length - 1) % POCKETS.length][0]); }
  else if ((e.code === 'Enter' || e.code === 'KeyE') && !document.activeElement?.closest('.bp-actions, .bp-tab, .bp-close')) { e.preventDefault(); if (BP.item && !ITEMS[BP.item].battle) bagUse(); }
  $('bpList').querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
}

export { bagKey, closeBag, openBag, openShop };
