import './36-battle-animations.js'; // first: the modules run in file-number order (see main.js)
import { SET } from './43-settings.js';

// ============================================================ battle: sound effects (synthesised with Web Audio, no files)
// Each sound copies how the real one is made: a thunder crack is a broadband snap followed by a long brown-noise rumble, an
// electric arc is a distorted buzz chopped into random sparks, a bubble is a sine whose pitch jumps up as it pops, and so on.
// Everything plays through a short outdoor reverb and a compressor. MOVE_FX calls SND on the beat each sound belongs to;
// charge(), impact() and rocks() add theirs. Math.random, not rnd(): sounds must not shift the seeded battle rolls.
const rf = (a, b) => a + Math.random() * (b - a);
let AC = null, OUT = null, VERB = null, BUF = null, SFX_GAIN = null;
const DRIVES = {}, DRIVE = k => (DRIVES[k] ??= Float32Array.from({ length: 1024 }, (_, i) => Math.tanh((i / 511.5 - 1) * k)));
function noiseBuf(sec, ch = 1, { brown = false, decay = 0 } = {}) { // white or brown noise; with `decay` it is a reverb impulse response
  const b = AC.createBuffer(ch, Math.floor(AC.sampleRate * sec), AC.sampleRate);
  for (let c = 0; c < ch; c++) {
    const d = b.getChannelData(c); let last = 0;
    for (let i = 0; i < d.length; i++) {
      let w = Math.random() * 2 - 1;
      if (brown) w = (last = (last + 0.02 * w) / 1.02) * 3.5;
      d[i] = decay ? w * (1 - i / d.length) ** decay : w;
    }
    if (brown) { let pk = 0; for (const x of d) pk = Math.max(pk, Math.abs(x)); for (let i = 0; i < d.length; i++) d[i] /= pk; } // brown noise is quiet; normalise
  }
  return b;
}
function play(fn) {
  try {
    if (!AC) {
      AC = new AudioContext();
      OUT = AC.createDynamicsCompressor(); OUT.threshold.value = -10; OUT.ratio.value = 12; SFX_GAIN = AC.createGain(); SFX_GAIN.gain.value = 1.4 * SET.sfx; OUT.connect(SFX_GAIN).connect(AC.destination); // limiter + make-up gain (scaled by the SFX volume setting)
      VERB = AC.createConvolver(); VERB.buffer = noiseBuf(1.6, 2, { decay: 3 }); VERB.connect(OUT);
      BUF = { white: noiseBuf(2), brown: noiseBuf(3, 1, { brown: true }) };
    }
    if (AC.state === 'suspended') AC.resume();
    fn(AC.currentTime);
  } catch (e) { console.warn('sfx', e); }
}
// One voice: source -> filter (swept f0 -> f1) -> drive -> envelope -> dry + reverb send. The envelope rises over `atk`, holds for
// `hold` of the rest, then decays; `roll` makes it wander randomly (rumbles, roars), `chop` gates it into random bursts (sparks).
function voice(src, t, dur, { vol = 0.3, atk = 0.005, hold = 0, filter, f0, f1, q = 1, drive = 0, chop = 0, roll = 0, wet = 0.25 } = {}) {
  let n = src;
  if (filter) { const f = AC.createBiquadFilter(); f.type = filter; f.Q.value = q; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); n.connect(f); n = f; }
  if (drive) { const s = AC.createWaveShaper(); s.curve = DRIVE(drive); n.connect(s); n = s; }
  const g = AC.createGain(), v = g.gain, end = t + dur, hEnd = t + atk + (dur - atk) * hold;
  const lvl = x => Math.max(1e-4, vol * (x < hEnd ? 1 : 1e-4 ** ((x - hEnd) / (end - hEnd))));
  v.setValueAtTime(1e-4, t);
  if (chop) { for (let x = t; x < end; x += chop * rf(0.5, 1.5)) v.setValueAtTime(Math.random() < 0.55 ? lvl(x) * rf(0.2, 1) : 1e-4, x); v.setValueAtTime(1e-4, end); }
  else {
    v.exponentialRampToValueAtTime(vol, t + atk);
    if (roll) for (let x = t + atk + roll; x < end; x += roll) v.linearRampToValueAtTime(lvl(x) * rf(0.35, 1), x);
    else v.setValueAtTime(vol, hEnd);
    v.exponentialRampToValueAtTime(1e-4, end);
  }
  n.connect(g); g.connect(OUT);
  if (wet) { const w = AC.createGain(); w.gain.value = wet; g.connect(w); w.connect(VERB); }
}
function noiseV(t, dur, o, kind = 'white') {
  const s = AC.createBufferSource(); s.buffer = BUF[kind]; s.loop = true; s.start(t, rf(0, 1.5)); s.stop(t + dur + 0.05);
  voice(s, t, dur, o);
}
function oscV(t, dur, type, f0, f1, o, jitter = 0) { // jitter: random pitch steps every 12 ms (rough, gravelly tones)
  const s = AC.createOscillator(); s.type = type; s.frequency.setValueAtTime(f0, t);
  if (jitter) for (let x = t; x < t + dur; x += 0.012) s.frequency.setValueAtTime(f0 * rf(1 - jitter, 1 + jitter), x);
  else if (f1) s.frequency.exponentialRampToValueAtTime(f1, t + dur);
  s.start(t); s.stop(t + dur + 0.05); voice(s, t, dur, o);
  return s;
}
const bubble = (t, size = 0.5, vol = 0.15) => { const f = rf(250, 450) / size; oscV(t, 0.03 + size * 0.05, 'sine', f, f * 2.5, { vol, atk: 0.003, wet: 0.15 }); };
const bell = (t, f, dur = 1, vol = 0.1) => [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.93, 0.12]].forEach(([m, a]) => oscV(t, dur / m ** 0.5, 'sine', f * m, 0, { vol: vol * a, atk: 0.002, wet: 0.5 }));
const SND = {
  hit(k = 1) { play(t => { // body blow: low thump, a burst of thud and a skin-slap click
    oscV(t, 0.12 + 0.08 * k, 'sine', 120 + 40 * k, 38, { vol: Math.min(1, 0.7 * k), atk: 0.002, wet: 0.1 });
    noiseV(t, 0.08 + 0.06 * k, { vol: Math.min(1, 0.7 * k), atk: 0.001, filter: 'lowpass', f0: 3000, f1: 250, wet: 0.2 });
    noiseV(t, 0.025, { vol: 0.3, atk: 0.001, filter: 'highpass', f0: 2500 });
  }); },
  whoosh(dur = 0.25, hi = 1, vol = 0.6, at = 0) { play(t => noiseV(t + at, dur, { vol, atk: dur * 0.55, filter: 'bandpass', f0: 350 * hi, f1: 1500 * hi, q: 1.4, wet: 0.15 })); },
  charge(dur = 0.45) { play(t => { // energy gathering: a rising filtered hum
    oscV(t, dur + 0.1, 'sawtooth', 70, 200, { vol: 0.18, atk: dur, filter: 'lowpass', f0: 250, f1: 2500, q: 3, wet: 0.3 });
    noiseV(t, dur + 0.1, { vol: 0.15, atk: dur, filter: 'bandpass', f0: 400, f1: 3000, q: 4, wet: 0.4 });
  }); },
  zap(dur = 0.35) { play(t => { // electric arc: distorted mains-like buzz and hiss, chopped into sparks
    oscV(t, dur, 'sawtooth', 120, 0, { vol: 0.7, filter: 'bandpass', f0: 1600, q: 0.7, drive: 8, chop: 0.018, wet: 0.25 }, 0.3);
    noiseV(t, dur, { vol: 0.8, filter: 'highpass', f0: 2500, chop: 0.008, wet: 0.25 });
  }); },
  thunder(k = 1) { play(t => {
    noiseV(t, 0.05, { vol: 0.9, atk: 0.001, filter: 'highpass', f0: 500, wet: 0.6 }); // the crack
    noiseV(t + 0.01, 0.4 * k, { vol: 0.7, filter: 'bandpass', f0: 3000, f1: 500, q: 0.6, chop: 0.01, wet: 0.6 }); // the tearing
    noiseV(t + 0.04, 2.4 * k, { vol: 1, atk: 0.06, hold: 0.35, filter: 'lowpass', f0: 500, f1: 70, roll: 0.08, wet: 0.7 }, 'brown'); // the rolling rumble
    oscV(t, 0.5, 'sine', 65, 28, { vol: 0.6 * k, atk: 0.002, wet: 0 }); // the sub thump
  }); },
  scratch() { play(t => [0, 0.05, 0.1].forEach(d => noiseV(t + d, 0.1, { vol: 0.7, atk: 0.02, filter: 'bandpass', f0: 6000, f1: 2000, q: 2.5, roll: 0.008, wet: 0.1 }))); },
  whip(d = 0.2) { play(t => { // the swing, then the crack
    noiseV(t, d, { vol: 0.3, atk: d * 0.9, filter: 'bandpass', f0: 500, f1: 3000, q: 1.5 });
    noiseV(t + d, 0.05, { vol: 0.5, atk: 0.001, filter: 'highpass', f0: 1200, wet: 0.5 });
  }); },
  sting(at = 0) { play(t => { t += at; noiseV(t, 0.12, { vol: 0.25, atk: 0.08, filter: 'bandpass', f0: 3000, f1: 6000, q: 3 }); noiseV(t + 0.12, 0.03, { vol: 0.35, atk: 0.001, filter: 'highpass', f0: 4000 }); }); },
  thwip() { play(t => { oscV(t, 0.09, 'sine', 400, 2200, { vol: 0.3, atk: 0.005, wet: 0.1 }); noiseV(t, 0.09, { vol: 0.3, atk: 0.04, filter: 'bandpass', f0: 1500, f1: 4000, q: 4 }); }); },
  fire(dur = 0.9, pitch = 1) { play(t => {
    noiseV(t, dur, { vol: 0.8, atk: 0.08, hold: 0.6, filter: 'lowpass', f0: 1100 * pitch, f1: 500 * pitch, q: 0.7, roll: 0.04, wet: 0.25 }, 'brown'); // roar
    noiseV(t, dur, { vol: 0.2, atk: 0.06, hold: 0.6, filter: 'bandpass', f0: 1000 * pitch, q: 0.8, roll: 0.03, wet: 0.2 }); // hiss
    for (let i = 0; i < dur * 30; i++) noiseV(t + rf(0, dur), 0.012, { vol: rf(0.1, 0.4), atk: 0.001, filter: 'bandpass', f0: rf(1500, 4500), q: 1.2 }); // crackle
  }); },
  boom(k = 1) { play(t => { // explosion: brown-noise blast closing down, a bright edge and a sub drop
    noiseV(t, 0.6 + k, { vol: 1, atk: 0.003, filter: 'lowpass', f0: 1500, f1: 60, wet: 0.5 }, 'brown');
    noiseV(t, 0.15 + 0.15 * k, { vol: 0.5 * k, atk: 0.002, filter: 'lowpass', f0: 5000, f1: 400, wet: 0.4 });
    oscV(t, 0.3 + 0.3 * k, 'sine', 80, 28, { vol: 0.6 * Math.min(k, 1.2), atk: 0.003 });
  }); },
  water(dur = 0.7, k = 1) { play(t => { // rushing jet plus bubbles
    noiseV(t, dur, { vol: 0.4 + 0.15 * k, atk: 0.05, hold: 0.7, filter: 'bandpass', f0: 1600 / k, q: 0.6, roll: 0.02, wet: 0.25 });
    for (let i = 0; i < dur * 35; i++) bubble(t + rf(0, dur), rf(0.3, 1));
  }); },
  splash(k = 1) { play(t => {
    noiseV(t, 0.35 + 0.25 * k, { vol: 0.6, atk: 0.004, filter: 'bandpass', f0: 3000, f1: 800, q: 0.5, wet: 0.35 });
    noiseV(t, 0.2, { vol: 0.4 * k, atk: 0.003, filter: 'lowpass', f0: 600, f1: 150 }, 'brown');
    for (let i = 0; i < 14; i++) bubble(t + rf(0.05, 0.5 * k), rf(0.2, 0.8), 0.1);
  }); },
  splat(k = 1) { play(t => { // wet goo hitting, then popping
    noiseV(t, 0.2 + 0.15 * k, { vol: 0.6, atk: 0.003, filter: 'lowpass', f0: 1800, f1: 250, q: 4, wet: 0.2 });
    for (let i = 0; i < 4 + 4 * k; i++) bubble(t + rf(0.05, 0.45), rf(0.5, 1), 0.12);
  }); },
  wind(dur = 1) { play(t => {
    noiseV(t, dur, { vol: 1.2, atk: dur * 0.4, filter: 'bandpass', f0: 350, f1: 1200, q: 2.5, roll: 0.1, wet: 0.3 });
    noiseV(t, dur, { vol: 0.35, atk: dur * 0.5, filter: 'bandpass', f0: 1400, f1: 700, q: 8, wet: 0.3 }); // whistle
  }); },
  sand(dur = 0.8) { play(t => { noiseV(t, dur, { vol: 0.6, filter: 'highpass', f0: 2500, chop: 0.004, wet: 0.15 }); noiseV(t, dur, { vol: 0.45, atk: dur * 0.3, filter: 'bandpass', f0: 1200, q: 1, wet: 0.15 }); }); },
  puff(dur = 1.2) { play(t => noiseV(t, dur, { vol: 0.6, atk: 0.08, filter: 'lowpass', f0: 900, f1: 200, roll: 0.08, wet: 0.3 }, 'brown')); },
  rustle(dur = 0.8) { play(t => { for (let i = 0; i < dur * 40; i++) noiseV(t + rf(0, dur), rf(0.02, 0.06), { vol: rf(0.1, 0.35), atk: 0.004, filter: 'bandpass', f0: rf(2500, 7000), q: 2, wet: 0.1 }); }); },
  leaf(at = 0) { play(t => noiseV(t + at, 0.3, { vol: 0.4, atk: 0.15, filter: 'bandpass', f0: 2000, f1: 5000, q: 3, roll: 0.02 })); },
  rock(k = 1) { play(t => { // boulder landing: crunchy thud plus scattering gravel
    noiseV(t, 0.3, { vol: 0.8 * k, atk: 0.002, filter: 'lowpass', f0: 1600, f1: 150, drive: 3, wet: 0.3 }, 'brown');
    oscV(t, 0.15, 'sine', 120, 45, { vol: 0.5 * k, atk: 0.002 });
    for (let i = 0; i < 6; i++) noiseV(t + rf(0.02, 0.25), 0.025, { vol: 0.25 * k, atk: 0.001, filter: 'bandpass', f0: rf(1200, 3500), q: 2 });
  }); },
  rumble(dur = 1.2, k = 1) { play(t => {
    noiseV(t, dur, { vol: 0.6 * k, atk: 0.12, hold: 0.5, filter: 'lowpass', f0: 220, f1: 70, roll: 0.06, wet: 0.3 }, 'brown');
    oscV(t, dur, 'sine', 40, 30, { vol: 0.3 * k, atk: 0.12, hold: 0.5, roll: 0.07 });
    for (let i = 0; i < 10 * k; i++) noiseV(t + rf(0, dur), 0.04, { vol: 0.2 * k, atk: 0.002, filter: 'bandpass', f0: rf(600, 2500), q: 2 });
  }); },
  drain(dur = 1) { play(t => { for (let i = 0; i < 6; i++) oscV(t + i * 0.08, 0.5, 'sine', rf(500, 800), rf(1500, 2400), { vol: 0.1, atk: 0.3, wet: 0.5 }); noiseV(t, dur, { vol: 0.15, atk: dur * 0.6, filter: 'bandpass', f0: 1500, f1: 5000, q: 6, wet: 0.5 }); }); },
  sparkle(dur = 1) { play(t => { const n = Math.round(dur * 14); for (let i = 0; i < n; i++) bell(t + i / n * dur, rf(1800, 2600) * (1 + i / n), 0.6, 0.04); }); },
  chime() { play(t => [1047, 1319, 1568, 2093, 2637].forEach((f, i) => bell(t + i * 0.05, f, 1.4, 0.07))); },
  clang() { play(t => { bell(t, 620, 1.6, 0.25); bell(t, 1013, 1.2, 0.12); noiseV(t, 0.04, { vol: 0.5, atk: 0.001, filter: 'highpass', f0: 3000 }); }); },
  frost(dur = 0.8) { play(t => { noiseV(t, dur, { vol: 0.3, filter: 'highpass', f0: 3500, chop: 0.006, wet: 0.4 }); for (let i = 0; i < 8; i++) bell(t + rf(0, dur), rf(3000, 6000), 0.4, 0.04); }); },
  crystal() { play(t => { noiseV(t, 0.12, { vol: 0.6, atk: 0.001, filter: 'highpass', f0: 1800, wet: 0.4 }); for (let i = 0; i < 7; i++) bell(t + i * 0.02 + rf(0, 0.02), rf(2200, 5200), 0.9, 0.07); }); },
  beam(dur = 0.8, f = 220, tone = 2000) { play(t => {
    for (const d of [0.5, 1, 1.007]) oscV(t, dur, 'sawtooth', f * d, 0, { vol: 0.1, atk: 0.04, hold: 0.8, filter: 'lowpass', f0: tone, q: 5, roll: 0.03, wet: 0.35 });
    noiseV(t, dur, { vol: 0.3, atk: 0.03, hold: 0.8, filter: 'bandpass', f0: tone * 1.4, q: 0.8, roll: 0.025, wet: 0.3 });
  }); },
  psychic(dur = 1.3) { play(t => { for (const f of [262, 265, 393]) oscV(t, dur, 'sine', f, f * 1.6, { vol: 0.12, atk: dur * 0.5, roll: 0.06, wet: 0.7 }); noiseV(t, dur, { vol: 0.12, atk: dur * 0.6, filter: 'bandpass', f0: 500, f1: 3000, q: 10, wet: 0.7 }); }); },
  dark(dur = 0.8, k = 1) { play(t => { oscV(t, dur, 'sawtooth', 50, 38, { vol: 0.2 * k, atk: dur * 0.5, filter: 'lowpass', f0: 250, f1: 700, roll: 0.07, wet: 0.5 }); noiseV(t, dur, { vol: 0.6 * k, atk: dur * 0.6, filter: 'lowpass', f0: 300, f1: 1200, wet: 0.5 }, 'brown'); }); },
  growl(dur = 0.7, pitch = 1) { play(t => { // rough sawtooth voice through two vowel formants, plus throat rasp
    const s = oscV(t, dur, 'sawtooth', 90 * pitch, 0, { vol: 0.35, atk: 0.06, hold: 0.5, filter: 'bandpass', f0: 650, q: 5, drive: 3, roll: 0.03, wet: 0.2 }, 0.08);
    voice(s, t, dur, { vol: 0.2, atk: 0.06, hold: 0.5, filter: 'bandpass', f0: 1100, q: 7, drive: 3, roll: 0.03, wet: 0.2 });
    noiseV(t, dur, { vol: 0.12, atk: 0.06, hold: 0.5, filter: 'bandpass', f0: 900, q: 2, chop: 0.03 });
  }); },
  buzz(dur = 1.2) { play(t => { for (const f of [170, 176, 340]) oscV(t, dur, 'sawtooth', f, 0, { vol: 0.1, atk: 0.05, hold: 0.7, filter: 'bandpass', f0: 1400, q: 1.2, roll: 0.025, wet: 0.2 }, 0.03); }); },
  stat(up) { play(t => [0, 1, 2].forEach(i => oscV(t + i * 0.09, 0.14, 'triangle', up ? 500 + i * 180 : 900 - i * 180, up ? 700 + i * 180 : 700 - i * 180, { vol: 0.12, atk: 0.005, wet: 0.3 }))); },
  shimmer(dur = 5) { play(t => { // evolution: a glittering swell climbing in pitch under a rising hum
    noiseV(t, dur, { vol: 0.22, atk: dur * 0.8, filter: 'bandpass', f0: 700, f1: 5000, q: 6, wet: 0.6 });
    oscV(t, dur, 'sine', 220, 880, { vol: 0.07, atk: dur * 0.75, wet: 0.6 });
    const n = Math.round(dur * 11); for (let i = 0; i < n; i++) bell(t + i / n * dur + rf(0, 0.04), rf(1100, 1500) * 2 ** (i / n * 1.6), 0.5, 0.035);
  }); },
  fanfare() { play(t => { // evolution done: a bright rising arpeggio landing on a held major chord
    [523, 659, 784, 1047].forEach((f, i) => { oscV(t + i * 0.12, 0.2, 'square', f, 0, { vol: 0.06, atk: 0.005, filter: 'lowpass', f0: 3500, wet: 0.3 }); bell(t + i * 0.12, f * 2, 0.6, 0.05); });
    for (const f of [523, 659, 784, 1047]) oscV(t + 0.5, 1.5, 'triangle', f, 0, { vol: 0.08, atk: 0.01, hold: 0.45, wet: 0.4 });
  }); },
};

export { AC, BUF, OUT, SFX_GAIN, SND, rf };
