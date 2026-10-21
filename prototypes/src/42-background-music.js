import './41-loop.js'; // first: the modules run in file-number order (see main.js)
import { inRect, kRect } from './03-fleurville-map.js';
import { P } from './19-characters.js';
import { SET } from './43-settings.js';

// ============================================================ Background music
// One looping <audio> per track, crossfaded by volume. Browsers block playback until the first key or click, so play() is retried then.
const MUSIC = { town: '01-verdant-town', route: '02-route-1', kalos: '03-fleurville-town', battle: '04-wild-battle', victory: '05-victory-fanfare',
  center: '06-pokemon-center', shop: '07-shop-cafe', greenhouse: '08-greenhouse', gallery: '10-title-gallery', trainer: '11-trainer-battle' }; // 11: tools/compose_trainer_battle.mjs
const MUSIC_VOL = 0.45, MUSIC_FADE = 1.5; // seconds for a full fade
const GREENHOUSE = kRect(680, 5, 800, 132);
const bgm = { want: null, tracks: {} };
const locMusic = loc => inRect(P.pos.x, P.pos.z, GREENHOUSE, 3) ? 'greenhouse'
  : ({ 'Verdant Town': 'town', 'Meadow Route': 'route', 'Woodland Clearing': 'route', 'Fleurville Town': 'kalos', 'Pokémon Center': 'center', 'Test Grounds': 'gallery' })[loc] ?? 'shop'; // other rooms are shops
function music(key) {
  if (bgm.want === key) return;
  bgm.want = key;
  const a = bgm.tracks[key] ??= Object.assign(new Audio(`audio/music/${MUSIC[key]}.m4a`), { loop: true, volume: 0 });
  if (key === 'battle' || key === 'trainer' || key === 'victory') a.currentTime = 0;
  a.play().catch(() => {});
}
function musicTick() { // wall-clock time, not the capped frame dt, so fades keep their length when frames drop
  const now = performance.now() / 1000, step = (now - (bgm.last ?? now)) / MUSIC_FADE * MUSIC_VOL;
  bgm.last = now;
  for (const [k, a] of Object.entries(bgm.tracks)) {
    a.volume = k === bgm.want ? Math.min(MUSIC_VOL * SET.music, a.volume + step) : Math.max(0, a.volume - step);
    if (k !== bgm.want && !a.volume && !a.paused) a.pause();
  }
}
for (const ev of ['keydown', 'pointerdown']) addEventListener(ev, () => { const a = bgm.tracks[bgm.want]; if (a?.paused) a.play().catch(() => {}); });

export { bgm, locMusic, music, musicTick };
