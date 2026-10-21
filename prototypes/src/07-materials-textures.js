import './06-renderer-scene-post.js'; // first: the modules run in file-number order (see main.js)
import * as THREE from 'three';
import { pick, rnd, rr } from './01-helpers.js';

// ============================================================ materials & textures
const matCache = {};
function mat(color, o) {
  const key = color + JSON.stringify(o || {});
  return matCache[key] ||= new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
}
function add(geo, color, parent, x = 0, y = 0, z = 0, o = {}) {
  const m = new THREE.Mesh(geo, o.material || mat(color, o.mat));
  m.position.set(x, y, z);
  if (o.s) m.scale.set(...o.s);
  if (o.r) m.rotation.set(...o.r);
  m.castShadow = o.shadow !== false;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const SPH = new THREE.SphereGeometry(1, 22, 16);
const sph = (r, color, parent, x, y, z, sx = 1, sy = 1, sz = 1, o = {}) => add(SPH, color, parent, x, y, z, { ...o, s: [r * sx, r * sy, r * sz] });

function canvasTex(w, h, draw, o = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = o.data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function stones(ctx, w, h, rows, minW, maxW, palette, grout, round = 9) {
  ctx.fillStyle = grout; ctx.fillRect(0, 0, w, h);
  const rh = h / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rnd() * maxW;
    while (x < w) {
      const sw = rr(minW, maxW), col = pick(palette), jy = rr(-2, 2);
      for (const ox of [0, -w, w]) {
        const X = x + ox + 2.5, Y = r * rh + 2.5 + jy, W = sw - 5, H = rh - 5;
        ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(X, Y, W, H, round); ctx.fill();
        ctx.fillStyle = 'rgba(255,250,235,.22)'; ctx.beginPath(); ctx.roundRect(X + 3, Y + 2, W - 8, H * 0.32, round * 0.6); ctx.fill();
        ctx.fillStyle = 'rgba(40,30,20,.16)'; ctx.beginPath(); ctx.roundRect(X + 2, Y + H * 0.72, W - 4, H * 0.28, round * 0.6); ctx.fill();
      }
      x += sw;
    }
  }
}
const cobbleTex = canvasTex(512, 512, (c, w, h) => stones(c, w, h, 10, 40, 72, ['#d6ccb8', '#cbc0aa', '#ddd4c2', '#c0b49d', '#d1c6b0', '#c6bcab', '#b9ad96'], '#8a8070', 12));
const wallTex = canvasTex(512, 256, (c, w, h) => {
  stones(c, w, h, 4, 60, 120, ['#a8a294', '#98928a', '#b4ad9e', '#8e897e', '#a29c8d', '#9b9789'], '#5f6448', 22);
  c.fillStyle = 'rgba(96,140,52,.55)'; for (let i = 0; i < 26; i++) { c.beginPath(); c.ellipse(rnd() * w, rr(-4, 18), rr(14, 40), rr(5, 12), 0, 0, 7); c.fill(); }
});
const houseTex = canvasTex(256, 256, (c, w, h) => stones(c, w, h, 8, 34, 64, ['#efe3c8', '#e5d6b8', '#f3e9d6', '#ddcca9', '#e9dcc0'], '#bfae8c', 7));
function tileTex(palette, base, light) {
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    const rows = 8, rh = h / rows, cols = 7;
    for (let r = 0; r < rows; r++) for (let i = -1; i <= cols; i++) {
      const x = (i + (r % 2) * 0.5) * (w / cols), y = r * rh;
      c.fillStyle = pick(palette);
      c.beginPath(); c.roundRect(x + 1.5, y, w / cols - 3, rh + 5, [2, 2, 15, 15]); c.fill();
      c.fillStyle = light; c.fillRect(x + 6, y + rh * 0.55, w / cols - 14, 3);
    }
  });
}
const roofTex = tileTex(['#d8683c', '#cf5e34', '#e27a4a', '#c95631', '#da6f42'], '#8e3a20', 'rgba(255,225,190,.28)');
const pcRoofTex = tileTex(['#e0483a', '#d63f33', '#e85a48', '#cc3a2f', '#e2503f'], '#8f2219', 'rgba(255,210,190,.3)');
const detailTex = canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#e4e4e4'; c.fillRect(0, 0, w, h);
  const dot = (x, y, rx, ry, a, col) => { c.fillStyle = col; for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { c.beginPath(); c.ellipse(x + ox, y + oy, rx, ry, a, 0, 7); c.fill(); } };
  for (let i = 0; i < 70; i++) dot(rnd() * w, rnd() * h, rr(8, 22), rr(6, 16), rnd() * 3, `rgba(${rnd() < .5 ? '255,255,255' : '190,190,190'},.18)`);
  for (let i = 0; i < 1700; i++) { const v = Math.floor(rr(185, 255)); dot(rnd() * w, rnd() * h, rr(0.8, 2.6), rr(0.6, 1.4), rnd() * 3, `rgb(${v},${v},${v})`); }
}, { data: true });

export { SPH, add, canvasTex, cobbleTex, detailTex, houseTex, mat, pcRoofTex, roofTex, sph, stones, tileTex, wallTex };
