import './24-fleurville-hud-travel.js'; // first: the modules run in file-number order (see main.js)

// ============================================================ input
const keys = new Set();
const ui = { dialog: null, battle: false, pokedex: false, bag: false, menu: false, quit: false, shop: false, onboard: false };
const $ = id => document.getElementById(id);
addEventListener('click', e => { // replay the .pop animation on whichever button was clicked (mouse, touch, Enter or Space)
  const b = e.target.closest?.('button'); if (!b) return;
  b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
}, true);
addEventListener('animationend', e => e.animationName === 'btnPop' && e.target.classList.remove('pop'));

export { $, keys, ui };
