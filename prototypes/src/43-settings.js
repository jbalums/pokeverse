import './42-background-music.js'; // first: the modules run in file-number order (see main.js)
import { clamp } from './01-helpers.js';
import { DPR, bloom, composer, renderer, setDPR, sun } from './06-renderer-scene-post.js';
import { SFX_GAIN } from './37-battle-sound-effects.js';
import { setVw } from './41-loop.js';
import { gmToast } from './44-game-menu.js';

// ============================================================ Settings (per browser, not per save file)
const SET_KEY = 'verdant-settings-v1';
const TEXT_SPEED = { slow: 0.5, normal: 1, fast: 2, instant: 1e4 }; // instant is a big rate, not Infinity: dt can be 0 and 0 * Infinity is NaN
const QUALITY = { high: [1.5, 2048, 4], medium: [1, 1024, 2], low: [0.75, 0, 0] }; // [max pixel ratio, shadow map size (0 = no shadows), MSAA samples]
const SET_DEFAULT = { music: 1, sfx: 1, text: 'normal', quality: 'high', alwaysRun: false, calm: matchMedia('(prefers-reduced-motion: reduce)').matches };
const SET = { ...SET_DEFAULT };
try { // stored settings are untrusted: keep only known keys with valid values
  const s = JSON.parse(localStorage.getItem(SET_KEY)) || {};
  for (const k of ['music', 'sfx']) if (Number.isFinite(s[k])) SET[k] = clamp(s[k], 0, 1);
  if (Object.hasOwn(TEXT_SPEED, s.text)) SET.text = s.text;
  if (Object.hasOwn(QUALITY, s.quality)) SET.quality = s.quality;
  for (const k of ['alwaysRun', 'calm']) if (typeof s[k] === 'boolean') SET[k] = s[k];
} catch {}
function applySettings() {
  const [dpr, shadow, msaa] = QUALITY[SET.quality];
  setDPR(Math.min(devicePixelRatio, dpr)); renderer.setPixelRatio(DPR); setVw(0); // frame() sees the size change and runs resize()
  sun.castShadow = shadow > 0; // toggling the light (not renderer.shadowMap) makes three.js rebuild the lit shaders
  if (shadow && sun.shadow.mapSize.x !== shadow) { sun.shadow.mapSize.set(shadow, shadow); sun.shadow.map?.dispose(); sun.shadow.map = null; }
  bloom.enabled = SET.quality !== 'low';
  const samples = DPR >= 1.5 ? 0 : msaa; // dense screens are sharp enough without MSAA, and the half-float target is the costliest one per pixel
  for (const rt of [composer.renderTarget1, composer.renderTarget2]) if (rt.samples !== samples) { rt.samples = samples; rt.dispose(); }
  if (SFX_GAIN) SFX_GAIN.gain.value = 1.4 * SET.sfx;
}
function saveSettings() { try { localStorage.setItem(SET_KEY, JSON.stringify(SET)); } catch { gmToast('Settings work now but can’t be remembered: browser storage is blocked.', true); } }
applySettings();

export { QUALITY, SET, SET_DEFAULT, TEXT_SPEED, applySettings, saveSettings };
