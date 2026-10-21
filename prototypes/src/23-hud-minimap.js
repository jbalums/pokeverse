import './22-collision.js'; // first: the modules run in file-number order (see main.js)
import { hash2 } from './01-helpers.js';
import { VS } from './02-hero-camera.js';
import { K, inKalos } from './03-fleurville-map.js';
import { riverInfo } from './04-river.js';
import { BRIDGE, PATH_W, ROUTE_HALF, inCobble, inTallGrass, pathD, raised, routeD, stairsH } from './05-paths-raised-plaza-stairs-tall-grass.js';
import { CHUNK } from './08-blender-assets.js';
import { cellKey, cellOf } from './09-terrain.js';
import { boxes, trees } from './12-batched-props.js';
import { COT, PC } from './14-buildings.js';
import { P } from './19-characters.js';
import { MARK_COL, questMarks, tracked } from './21-side-quests.js';
import { KMINI } from './24-fleurville-hud-travel.js';

// ============================================================ HUD: minimap
const MAP_X0 = VS(-30), MAP_Z0 = VS(-24), MAP_W = VS(60), MAP_H = VS(42), MPU = 6;
const hexRGB = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const MINI_C = { river: hexRGB('#3d9fe0'), path: hexRGB('#e8d6a2'), cob: hexRGB('#d6cebe'), high: hexRGB('#7db35a'), low: hexRGB('#8fc366'), tall: hexRGB('#5a964a') };
function miniColor(x, z) { // the minimap's ground colour at a point (the town map and the streamed cells' tiles)
  if ((r => r.d < r.hw)(riverInfo(x, z))) return MINI_C.river;
  if (inCobble(x, z) || stairsH(x, z) !== null) return MINI_C.cob;
  if (Math.min(pathD(x, z), routeD(x, z)) < PATH_W && !raised(x, z)) return MINI_C.path;
  if (inTallGrass(x, z)) return MINI_C.tall;
  return raised(x, z) ? MINI_C.high : MINI_C.low;
}
const MINI_TILES = new Map(); // cell key -> its minimap tile, kept after the cell itself is dropped (~37 KB each)
function miniTile(cx, cz, trees) {
  const S = CHUNK * MPU, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(S, S), d = img.data;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const c = miniColor(cx * CHUNK + i / MPU, cz * CHUNK + j / MPU), k = 0.94 + hash2(i, j) * 0.08;
    d.set([c[0] * k, c[1] * k, c[2] * k, 255], (j * S + i) * 4);
  }
  ctx.putImageData(img, 0, 0);
  for (const [x, z, r] of trees) { const a = (x - cx * CHUNK) * MPU, b = (z - cz * CHUNK) * MPU; ctx.fillStyle = '#3c7d33'; ctx.beginPath(); ctx.arc(a, b, r * MPU * 0.75, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(a - 1, b - 1, r * MPU * 0.4, 0, 7); ctx.fill(); }
  return cv;
}
const mapCanvas = document.createElement('canvas');
{
  const W = MAP_W * MPU, H = MAP_H * MPU; mapCanvas.width = W; mapCanvas.height = H;
  const ctx = mapCanvas.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const c = miniColor(MAP_X0 + i / MPU, MAP_Z0 + j / MPU), k = 0.94 + hash2(i, j) * 0.08;
    d.set([c[0] * k, c[1] * k, c[2] * k, 255], (j * W + i) * 4);
  }
  ctx.putImageData(img, 0, 0);
  const toM = (x, z) => [(x - MAP_X0) * MPU, (z - MAP_Z0) * MPU];
  ctx.strokeStyle = '#9c6a3f'; ctx.lineWidth = BRIDGE.w * MPU;
  ctx.beginPath(); ctx.moveTo(...toM(BRIDGE.ax, BRIDGE.az)); ctx.lineTo(...toM(BRIDGE.ax + BRIDGE.ux * BRIDGE.len, BRIDGE.az + BRIDGE.uz * BRIDGE.len)); ctx.stroke();
  for (const [x, z, r] of trees) { if (routeD(x, z) < ROUTE_HALF) continue; const [a, b] = toM(x, z); ctx.fillStyle = '#3c7d33'; ctx.beginPath(); ctx.arc(a, b, r * MPU * 0.75, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(a - 1, b - 1, r * MPU * 0.4, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#e3a372'; for (const b of boxes) { const [a, c] = toM(b.x0, b.z0); ctx.fillRect(a, c, (b.x1 - b.x0) * MPU, (b.z1 - b.z0) * MPU); }
}
const mm = document.getElementById('mm'), mctx = mm.getContext('2d');
function ballIcon(x, y, r) {
  mctx.lineWidth = 2.5; mctx.strokeStyle = '#2a2a2a';
  mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.arc(x, y, r + 3, 0, 7); mctx.fill();
  mctx.fillStyle = '#e2473b'; mctx.beginPath(); mctx.arc(x, y, r, Math.PI, 0); mctx.fill();
  mctx.fillStyle = '#fafafa'; mctx.beginPath(); mctx.arc(x, y, r, 0, Math.PI); mctx.fill();
  mctx.beginPath(); mctx.moveTo(x - r, y); mctx.lineTo(x + r, y); mctx.stroke();
  mctx.beginPath(); mctx.arc(x, y, r, 0, 7); mctx.stroke();
  mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.arc(x, y, r * 0.33, 0, 7); mctx.fill(); mctx.stroke();
}
function houseIcon(x, y) {
  mctx.fillStyle = '#fff'; mctx.strokeStyle = '#2a3540'; mctx.lineWidth = 3;
  mctx.beginPath(); mctx.moveTo(x - 13, y - 1); mctx.lineTo(x, y - 14); mctx.lineTo(x + 13, y - 1); mctx.lineTo(x + 9, y - 1); mctx.lineTo(x + 9, y + 12); mctx.lineTo(x - 9, y + 12); mctx.lineTo(x - 9, y - 1); mctx.closePath(); mctx.fill(); mctx.stroke();
}
function drawMinimap() {
  const S = mm.width, c = S / 2, k = 7.2 * (S / 206);
  mctx.save(); mctx.clearRect(0, 0, S, S);
  mctx.beginPath(); mctx.arc(c, c, c, 0, 7); mctx.clip();
  mctx.fillStyle = '#5e9c48'; mctx.fillRect(0, 0, S, S);
  const M = inKalos(P.pos.x) ? KMINI : { canvas: mapCanvas, x0: MAP_X0, z0: MAP_Z0, w: MAP_W, h: MAP_H };
  mctx.drawImage(M.canvas, c - (P.pos.x - M.x0) * k, c - (P.pos.z - M.z0) * k, M.w * k, M.h * k);
  if (!inKalos(P.pos.x)) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { // Route 1 and the forest beyond the town map
    const cx = cellOf(P.pos.x) + dx, cz = cellOf(P.pos.z) + dz, tile = MINI_TILES.get(cellKey(cx, cz));
    if (tile) mctx.drawImage(tile, c + (cx * CHUNK - P.pos.x) * k, c + (cz * CHUNK - P.pos.z) * k, CHUNK * k, CHUNK * k);
  }
  const sp = (x, z) => [c + (x - P.pos.x) * k, c + (z - P.pos.z) * k];
  if (inKalos(P.pos.x)) { ballIcon(...sp(...K(705, 430)), 20); houseIcon(...sp(...K(532, 178))); }
  else { ballIcon(...sp(PC.cx, PC.cz), 20); ballIcon(...sp(VS(17), VS(-9)), 17); houseIcon(...sp(COT.door[0] - 3, COT.door[1] + 1.5)); }
  for (const [x, z, , side, id] of questMarks()) { // quest markers; one out of range waits on the rim, pointing the way; the tracked quest's are ringed
    if (inKalos(x) !== inKalos(P.pos.x)) continue;
    let [a, b] = sp(x, z); const dx = a - c, dy = b - c, d = Math.hypot(dx, dy), R = c - 14; if (d > R) { a = c + dx / d * R; b = c + dy / d * R; }
    const [fill, ink] = MARK_COL[side ? 'side' : 'main'];
    if (id === tracked) { mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.arc(a, b, 16, 0, 7); mctx.fill(); }
    mctx.fillStyle = ink; mctx.beginPath(); mctx.arc(a, b, 12, 0, 7); mctx.fill(); mctx.fillStyle = fill; mctx.beginPath(); mctx.arc(a, b, 9.5, 0, 7); mctx.fill();
    mctx.fillStyle = ink; mctx.font = '900 16px Nunito, sans-serif'; mctx.textAlign = 'center'; mctx.textBaseline = 'middle'; mctx.fillText('!', a, b + 1);
  }
  mctx.translate(c, c); mctx.rotate(Math.atan2(Math.cos(P.face), Math.sin(P.face)));
  mctx.fillStyle = '#2f8cff'; mctx.strokeStyle = '#fff'; mctx.lineWidth = 5;
  mctx.beginPath(); mctx.moveTo(26, 0); mctx.lineTo(-16, -18); mctx.lineTo(-7, 0); mctx.lineTo(-16, 18); mctx.closePath(); mctx.stroke(); mctx.fill();
  mctx.restore();
}

export { MINI_TILES, MPU, drawMinimap, miniTile, mm };
