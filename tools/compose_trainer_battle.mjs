// Composes and renders the Trainer battle theme: prototypes/audio/music/11-trainer-battle.m4a
//   node tools/compose_trainer_battle.mjs        (needs ffmpeg on PATH; no npm packages)
// The score below is synthesized sample by sample (band-limited pulse / saw voices, noise drums, a Freeverb-style hall),
// rendered as one seamless loop (the reverb and echo tails wrap around to the start), loudness-matched to the other tracks
// (about -13.5 LUFS, like 04-wild-battle) and encoded as AAC. D minor, 160 BPM, 60 bars, 90 seconds.
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 48000, BPM = 160, E8 = 30 / BPM, BAR = 8 * E8; // E8: one eighth note in seconds
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'prototypes', 'audio', 'music', '11-trainer-battle.m4a');

// ---------------------------------------------------------------- score
// Melodies: "NOTE:LEN" tokens, LEN in eighths (default 1, 0.5 = a sixteenth), R = rest. Chords: one per bar.
const A_LEAD = 'A4:2 D5:2 F5 E5 D5 E5 | F5:3 D5 Bb4:2 D5:2 | E5:2 G5:2 C6 Bb5 A5 G5 | A5:6 G5 A5 | Bb5:3 A5 G5:2 D5:2 | F5:3 E5 D5:2 F5:2';
const SECTIONS = [
  { name: 'intro', bars: 4, chords: ['N', 'N', 'Dm', 'Bb A'], drums: 'intro', bass: 'intro',
    lead: 'A5:0.5 G#5:0.5 G5:0.5 F#5:0.5 F5:0.5 E5:0.5 Eb5:0.5 D5:0.5 C#5:0.5 C5:0.5 B4:0.5 Bb4:0.5 A4:0.5 G#4:0.5 G4:0.5 F#4:0.5 | ' +
      'A5:0.5 G#5:0.5 G5:0.5 F#5:0.5 F5:0.5 E5:0.5 Eb5:0.5 D5:0.5 C#5:0.5 C5:0.5 B4:0.5 Bb4:0.5 A4:0.5 Bb4:0.5 C#5:0.5 E5:0.5 | ' +
      'D5:1.5 D5:1.5 D5:1 D5:1.5 D5:1.5 F5:1 | Bb4:1.5 D5:1.5 C#5:1 R:2 A4:0.5 C#5:0.5 E5:0.5 A5:0.5', double: true,
    stabs: [[[0, 'Dm'], [3, 'Dm'], [6, 'Dm'], [8, 'Dm'], [11, 'Dm'], [14, 'Dm']], [[0, 'Bb'], [3, 'Bb'], [6, 'A']]] }, // bars 3-4: [sixteenth, chord]
  { name: 'A', bars: 8, chords: ['Dm', 'Bb', 'C', 'Dm', 'Gm', 'Bb', 'A', 'A'], drums: 'main', bass: 'oct', comp: true,
    lead: A_LEAD + ' | E5:2 C#5:2 A4:2 C#5 E5 | A5:4 G5 F5 E5 C#5' },
  { name: "A'", bars: 8, chords: ['Dm', 'Bb', 'C', 'Dm', 'Gm', 'Bb', 'A', 'Dm'], drums: 'main', bass: 'oct', comp: true, pad: true,
    lead: A_LEAD + ' | E5 F5 G5 A5 C#6:2 E6:2 | D6:6 R:2' },
  { name: 'B', bars: 8, chords: ['Bb', 'C', 'Am', 'Dm', 'Bb', 'C', 'Gm', 'A7'], drums: 'main', bass: 'drive', pad: true, double: true,
    lead: 'D6:4 C6:2 Bb5:2 | C6:4 G5:2 E5:2 | E5:2 A5:2 C6:2 E6:2 | D6:6 F5 G5 | A5:3 Bb5 A5:2 F5:2 | G5:4 E5:2 C5:2 | D5:2 G5:2 Bb5:2 D6:2 | C#6:4 E6:4' },
  { name: "B'", bars: 8, chords: ['Bb', 'C', 'Am', 'Dm', 'Bb', 'C', 'Gm', 'A7'], drums: 'main', bass: 'drive', pad: true, comp: true, double: true,
    lead: 'D6:4 C6:2 Bb5:2 | C6:4 G5:2 E5:2 | E5:2 A5:2 C6:2 E6:2 | D6:6 F5 G5 | A5:3 Bb5 A5:2 F5:2 | G5:4 E5:2 C5:2 | Bb5:2 A5:2 G5:2 F5:2 | E5:4 R:2 A4 A4' },
  { name: 'C', bars: 8, chords: ['Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Gm', 'A', 'A'], drums: 'break', bass: 'hold', pad: true, arp: true,
    lead: 'R:8 | R:8 | R:8 | R:6 F5 G5 | A5:8 | Bb5:8 | A5:8 | C#6:4 E6:4' },
  { name: 'A', bars: 8, chords: ['Dm', 'Bb', 'C', 'Dm', 'Gm', 'Bb', 'A', 'A'], drums: 'main', bass: 'oct', comp: true, pad: true,
    lead: A_LEAD + ' | E5:2 C#5:2 A4:2 C#5 E5 | A5:4 G5 F5 E5 C#5' },
  { name: "A'", bars: 8, chords: ['Dm', 'Bb', 'C', 'Dm', 'Gm', 'Bb', 'A', 'A7'], drums: 'main', bass: 'oct', comp: true, arp: true, double: true,
    lead: A_LEAD + ' | E5 F5 G5 A5 C#6:2 E6:2 | D6:4 C#6 A5 G5 E5' }, // ends on the dominant: the loop falls back into the intro run
];

// ---------------------------------------------------------------- pitch helpers
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = n => { const m = /^([A-G])(#|b)?(-?\d)$/.exec(n); if (!m) throw new Error('bad note ' + n); return 12 * (+m[3] + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };
const hz = m => 440 * 2 ** ((m - 69) / 12);
function chord(name) { // 'Dm' 'Bb' 'A7' -> { root: pitch class, tones: semitones above the root }
  const m = /^([A-G])(#|b)?(m)?(7)?$/.exec(name); if (!m) throw new Error('bad chord ' + name);
  const root = (SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  return { root, tones: [0, m[3] ? 3 : 4, 7, ...(m[4] ? [10] : [])] };
}
const near = (pc, lo) => { let n = lo - ((lo % 12) - pc + 12) % 12; while (n < lo) n += 12; return n; }; // lowest note of pitch class pc at or above lo

// ---------------------------------------------------------------- engine
const TOTAL_BARS = SECTIONS.reduce((s, x) => s + x.bars, 0), LEN = Math.round(TOTAL_BARS * BAR * SR), TAIL = 4 * SR;
const dryL = new Float32Array(LEN + TAIL), dryR = new Float32Array(LEN + TAIL), revL = new Float32Array(LEN + TAIL), revR = new Float32Array(LEN + TAIL);
const echo = new Float32Array(LEN + TAIL); // mono send into the ping-pong echo
let seed = 0x5eed;
const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const blep = (t, dt) => t < dt ? (t /= dt, t + t - t * t - 1) : t > 1 - dt ? (t = (t - 1) / dt, t * t + t + t + 1) : 0; // polyBLEP: no aliasing on the edges

function svf() { // Zavalishin's TPT state-variable filter
  let a = 0, b = 0;
  return (x, fc, q = 0.707) => {
    const g = Math.tan(Math.PI * Math.min(fc, SR * 0.45) / SR), k = 1 / q, a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x - b, v1 = a1 * a + a2 * v3, v2 = b + a2 * a + a3 * v3; a = 2 * v1 - a; b = 2 * v2 - b;
    return { lp: v2, bp: v1, hp: x - k * v1 - v2 };
  };
}
function out(i, v, pan, rev, ech = 0) { // equal-power pan; rev / ech: send amounts
  const l = Math.cos((pan + 1) * Math.PI / 4), r = Math.sin((pan + 1) * Math.PI / 4);
  dryL[i] += v * l; dryR[i] += v * r; revL[i] += v * l * rev; revR[i] += v * r * rev; if (ech) echo[i] += v * ech;
}

// a pitched voice: oscillator mix -> filter with its own envelope -> amp ADSR
function tone(t0, dur, f, o) {
  const { vol, pan = 0, rev = 0.2, ech = 0, atk = 0.005, dec = 0.15, sus = 0.7, rel = 0.08, wave = 'pulse', width = 0.25, saw = 0, detune = 0,
    cut = 4000, cutEnv = 0, cutDec = 0.2, q = 0.8, vib = 0, vibDelay = 0.15 } = o;
  const n0 = Math.round(t0 * SR), n = Math.round((dur + rel) * SR), flt = svf(), ph = [rand(), rand(), rand()];
  for (let j = 0; j < n; j++) {
    const i = n0 + j; if (i < 0 || i >= dryL.length) continue;
    const t = j / SR, vb = vib && t > vibDelay ? 1 + vib * Math.min(1, (t - vibDelay) * 4) * Math.sin(2 * Math.PI * 5.5 * t) * 0.0145 : 1;
    let s = 0;
    const voices = detune ? 3 : 1;
    for (let v = 0; v < voices; v++) {
      const fr = f * vb * (detune ? 1 + (v - 1) * detune : 1), dt = fr / SR; ph[v] = (ph[v] + dt) % 1;
      const p = ph[v], sw = 2 * p - 1 - blep(p, dt);
      if (wave === 'pulse') { const p2 = (p + 1 - width) % 1; s += (p < width ? 1 : -1) + blep(p, dt) - blep(p2, dt) + (saw ? saw * sw : 0); }
      else if (wave === 'saw') s += sw;
      else if (wave === 'tri') s += 1 - 4 * Math.abs(p - 0.5);
      else s += Math.sin(2 * Math.PI * p);
    }
    s /= voices;
    const env = t < atk ? t / atk : t < dur ? sus + (1 - sus) * Math.exp(-(t - atk) / dec) : (sus + (1 - sus) * Math.exp(-(dur - atk) / dec)) * Math.exp(-(t - dur) / (rel / 4));
    const y = flt(s, cut + cutEnv * Math.exp(-t / cutDec), q).lp;
    out(i, y * env * vol, pan, rev, ech);
  }
}
function noiseHit(t0, dur, o) { // filtered noise burst with an exponential decay
  const { vol, pan = 0, rev = 0.15, decay, mode = 'hp', fc = 6000, fc1 = fc, q = 0.7 } = o;
  const n0 = Math.round(t0 * SR), n = Math.round(dur * SR), flt = svf();
  for (let j = 0; j < n; j++) {
    const t = j / SR, i = n0 + j; if (i >= dryL.length) break;
    const y = flt(rand() * 2 - 1, fc * (fc1 / fc) ** (t / dur), q)[mode];
    out(i, y * Math.exp(-t / decay) * vol * Math.min(1, j / 24), pan, rev);
  }
}
function sweep(t0, dur, f0, f1, k, vol, pan = 0, rev = 0.1) { // sine with a falling pitch: kick drum, toms
  const n0 = Math.round(t0 * SR), n = Math.round(dur * SR); let p = 0;
  for (let j = 0; j < n; j++) {
    const t = j / SR, i = n0 + j; if (i >= dryL.length) break;
    p += (f1 + (f0 - f1) * Math.exp(-t * k)) / SR;
    out(i, Math.sin(2 * Math.PI * p) * Math.exp(-t * 7 / dur * 0.35) * vol * Math.min(1, j / 12), pan, rev);
  }
}
const DRUM = {
  kick: (t, v = 1) => { sweep(t, 0.38, 165, 46, 32, 0.5 * v, 0, 0.03); noiseHit(t, 0.012, { vol: 0.35 * v, decay: 0.004, fc: 3000, rev: 0 }); },
  snare: (t, v = 1) => { noiseHit(t, 0.25, { vol: 0.55 * v, decay: 0.06, mode: 'bp', fc: 2400, fc1: 1500, q: 0.6, rev: 0.3 }); noiseHit(t, 0.2, { vol: 0.25 * v, decay: 0.05, fc: 6000, rev: 0.3 }); sweep(t, 0.12, 260, 185, 40, 0.35 * v, 0, 0.2); },
  hat: (t, v = 1, open = false) => noiseHit(t, open ? 0.3 : 0.05, { vol: 0.3 * v, decay: open ? 0.09 : 0.018, fc: 7000, pan: 0.25, rev: 0.08 }),
  crash: (t, v = 1) => { noiseHit(t, 2.6, { vol: 0.4 * v, decay: 0.7, fc: 5200, fc1: 3500, pan: -0.2, rev: 0.35 }); noiseHit(t, 1.2, { vol: 0.12 * v, decay: 0.3, mode: 'bp', fc: 3400, q: 2, pan: -0.2, rev: 0.3 }); },
  tom: (t, f, v = 1) => sweep(t, 0.4, f * 1.6, f, 18, 0.55 * v, f > 120 ? 0.3 : -0.3, 0.2),
};

// ---------------------------------------------------------------- instruments
const lead = (t, d, f, dbl) => {
  tone(t, d, f, { vol: 0.2, pan: 0, rev: 0.22, ech: 0.3, wave: 'pulse', width: 0.25, saw: 0.35, cut: 4200, cutEnv: 5000, cutDec: 0.18, q: 1.1, sus: 0.75, dec: 0.2, rel: 0.1, vib: d > E8 * 1.5 ? 1 : 0 });
  if (dbl) tone(t, d, f / 2, { vol: 0.085, pan: -0.25, rev: 0.25, wave: 'saw', detune: 0.004, cut: 1800, cutEnv: 2200, cutDec: 0.2, sus: 0.8, rel: 0.12 });
};
const bassNote = (t, d, f) => tone(t, d, f, { vol: 0.13, pan: 0, rev: 0.04, wave: 'saw', cut: 520, cutEnv: 1900, cutDec: 0.09, q: 1.3, atk: 0.003, sus: 0.85, dec: 0.1, rel: 0.04 });
const compNote = (t, f, pan) => tone(t, E8 * 0.45, f, { vol: 0.075, pan, rev: 0.25, wave: 'pulse', width: 0.5, cut: 2400, cutEnv: 2000, cutDec: 0.06, sus: 0.4, dec: 0.05, rel: 0.05 });
const padNote = (t, d, f, pan) => tone(t, d, f, { vol: 0.045, pan, rev: 0.5, wave: 'saw', detune: 0.006, cut: 1500, atk: 0.18, sus: 1, dec: 1, rel: 0.4 });
const arpNote = (t, f) => tone(t, E8 * 0.4, f, { vol: 0.06, pan: 0.45, rev: 0.25, ech: 0.45, wave: 'pulse', width: 0.125, cut: 3500, cutEnv: 3000, cutDec: 0.05, sus: 0.3, dec: 0.06, rel: 0.05 });
const brass = (t, d, f, pan) => tone(t, d, f, { vol: 0.07, pan, rev: 0.3, wave: 'saw', detune: 0.005, cut: 900, cutEnv: 3500, cutDec: 0.12, q: 1, atk: 0.012, sus: 0.6, dec: 0.12, rel: 0.12 });

// ---------------------------------------------------------------- render the score
let bar0 = 0;
for (const sec of SECTIONS) {
  const t0 = bar0 * BAR;
  // lead
  let pos = 0;
  for (const tok of sec.lead.replace(/\|/g, ' ').trim().split(/\s+/)) {
    const [n, l = '1'] = tok.split(':'), len = +l;
    if (n !== 'R') lead(t0 + pos * E8, len * E8 * 0.94, hz(midi(n)), sec.double);
    pos += len;
  }
  if (Math.abs(pos - sec.bars * 8) > 1e-6) throw new Error(`${sec.name}: lead lasts ${pos} eighths, the section ${sec.bars * 8}`);
  for (let b = 0; b < sec.bars; b++) {
    const tb = t0 + b * BAR, last = b === sec.bars - 1, parts = sec.chords[b].split(' ');
    const at = k => { const c = parts[Math.min(parts.length - 1, Math.floor(k / 8 * parts.length))]; return c === 'N' ? null : chord(c); }; // chord under eighth k
    // bass
    for (let k = 0; k < 8; k++) {
      const c = at(k); if (!c) continue;
      const lo = near(c.root, 38), t = tb + k * E8; // D2 and up
      if (sec.bass === 'oct') bassNote(t, E8 * 0.8, hz(k % 2 ? lo + 12 : lo));
      else if (sec.bass === 'drive') bassNote(t, E8 * 0.8, hz(k % 4 === 3 ? lo + 7 : lo));
      else if (sec.bass === 'hold') { if (b >= 4 || k === 0) bassNote(t, b < 4 ? BAR * 0.95 : E8 * 0.8, hz(b >= 4 && k % 2 ? lo + 12 : lo)); } // whole notes, then octaves
      else if (sec.bass === 'intro' && b === 3 && k >= 4) bassNote(t, E8 * 0.8, hz(lo)); // the A pedal under the drum roll
    }
    if (sec.bass === 'intro' && b < 2) bassNote(tb, BAR * 0.98, hz(38)); // a low D under the chromatic runs
    // intro stabs: brass chords and bass on the off-kilter 3+3+2 rhythm
    if (sec.stabs && b >= 2) for (const [s, name] of sec.stabs[b - 2]) {
      const c = chord(name), t = tb + s * E8 / 2;
      c.tones.forEach((x, i) => brass(t, E8 * 0.6, hz(near((c.root + x) % 12, 62)), i % 2 ? 0.35 : -0.35));
      bassNote(t, E8 * 0.8, hz(near(c.root, 38)));
    }
    // off-beat comping: the triad on every "and"
    if (sec.comp) for (let k = 1; k < 8; k += 2) { const c = at(k); c.tones.slice(0, 3).forEach((x, i) => compNote(tb + k * E8, hz(near((c.root + x) % 12, 62)), (i - 1) * 0.3)); }
    // pad: the chord held for the bar
    if (sec.pad) { const c = at(0); c.tones.slice(0, 3).forEach((x, i) => padNote(tb, BAR * 0.98, hz(near((c.root + x) % 12, 53)), (i - 1) * 0.5)); }
    // arpeggio: chord tones in sixteenths over two octaves
    if (sec.arp) { const c = at(0), seq = [0, 1, 2, 3, 4, 3, 2, 1], ns = [...c.tones.slice(0, 3).map(x => near((c.root + x) % 12, 69)), near(c.root, 81), near((c.root + c.tones[1]) % 12, 84)];
      for (let s = 0; s < 16; s++) arpNote(tb + s * E8 / 2, hz(ns[seq[s % 8]])); }
    // drums
    const sx = s => tb + s * E8 / 2; // sixteenth s of this bar
    if (sec.drums === 'main') {
      if (b === 0) DRUM.crash(tb);
      for (const s of [0, 6, 8, 11]) DRUM.kick(sx(s), s === 11 ? 0.7 : 1);
      for (const s of [4, 12]) DRUM.snare(sx(s));
      for (let s = 0; s < 16; s += 2) DRUM.hat(sx(s), s % 4 ? 0.7 : 1, s === 14 && b % 2 === 1);
      if (last) { for (const s of [13, 14, 15]) DRUM.snare(sx(s), 0.6 + (s - 13) * 0.15); DRUM.tom(sx(8), 180); DRUM.tom(sx(10), 110); }
    } else if (sec.drums === 'break') {
      if (b === 0) DRUM.crash(tb, 0.6);
      if (b < 4) { DRUM.kick(sx(0)); for (const s of [0, 4, 8, 12]) DRUM.hat(sx(s), 0.8); if (b % 2) DRUM.snare(sx(12), 0.5); }
      else if (b < 6) { for (const s of [0, 4, 8, 12]) DRUM.kick(sx(s)); for (let s = 0; s < 16; s += 2) DRUM.hat(sx(s)); DRUM.snare(sx(4), 0.8); DRUM.snare(sx(12), 0.8); }
      else if (b === 6) { for (const s of [0, 4, 8, 12]) DRUM.kick(sx(s)); for (let s = 0; s < 16; s += 2) DRUM.snare(sx(s), 0.45 + s * 0.02); }
      else { for (const s of [0, 4, 8, 12]) DRUM.kick(sx(s)); for (let s = 0; s < 16; s++) DRUM.snare(sx(s), 0.4 + s * 0.035); }
    } else if (sec.drums === 'intro') {
      if (b === 0) DRUM.crash(tb, 0.8);
      if (b === 1) { DRUM.kick(sx(0)); DRUM.kick(sx(8)); DRUM.tom(sx(12), 150); DRUM.tom(sx(14), 100); }
      if (b >= 2) for (const s of b === 2 ? [0, 3, 6, 8, 11, 14] : [0, 3, 6]) { DRUM.kick(sx(s)); DRUM.snare(sx(s), 0.7); }
      if (b === 3) for (let s = 8; s < 16; s++) DRUM.snare(sx(s), 0.4 + (s - 8) * 0.07);
    }
  }
  bar0 += sec.bars;
}

// ---------------------------------------------------------------- effects, loop wrap, master
{ // ping-pong echo, a dotted eighth, into the dry mix and the hall
  const d = Math.round(E8 * 1.5 * SR), bl = new Float32Array(LEN + TAIL), br = new Float32Array(LEN + TAIL);
  for (let i = d; i < LEN + TAIL; i++) { bl[i] = echo[i - d] + br[i - d] * 0.38; br[i] = bl[i - d] * 0.38; }
  for (let i = 0; i < LEN + TAIL; i++) { dryL[i] += bl[i] * 0.22; dryR[i] += br[i] * 0.22; revL[i] += bl[i] * 0.1; revR[i] += br[i] * 0.1; }
}
function hall(input, spread) { // Freeverb: 8 damped combs in parallel, then 4 allpasses
  const k = SR / 44100, combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map(n => ({ buf: new Float32Array(Math.round((n + spread) * k)), i: 0, f: 0 }));
  const aps = [556, 441, 341, 225].map(n => ({ buf: new Float32Array(Math.round((n + spread) * k)), i: 0 })), o = new Float32Array(input.length);
  for (let s = 0; s < input.length; s++) {
    const x = input[s] * 0.015; let y = 0;
    for (const c of combs) { const v = c.buf[c.i]; c.f = v * 0.7 + c.f * 0.3; c.buf[c.i] = x + c.f * 0.86; c.i = (c.i + 1) % c.buf.length; y += v; }
    for (const a of aps) { const v = a.buf[a.i]; a.buf[a.i] = y + v * 0.5; y = v - y; a.i = (a.i + 1) % a.buf.length; }
    o[s] = y;
  }
  return o;
}
const wetL = hall(revL, 0), wetR = hall(revR, 23);
const L = new Float32Array(LEN), R = new Float32Array(LEN);
for (let i = 0; i < LEN + TAIL; i++) { const j = i % LEN; L[j] += dryL[i] + wetL[i] * 1.1; R[j] += dryR[i] + wetR[i] * 1.1; } // tails past the end wrap to the start: a seamless loop
let peak = 0; for (let i = 0; i < LEN; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const g = 0.9 / peak; // headroom here; loudnorm sets the final level
const wav = Buffer.alloc(44 + LEN * 4);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + LEN * 4, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(LEN * 4, 40);
for (let i = 0; i < LEN; i++) { wav.writeInt16LE(Math.round(Math.tanh(L[i] * g) * 32767), 44 + i * 4); wav.writeInt16LE(Math.round(Math.tanh(R[i] * g) * 32767), 46 + i * 4); }

// two-pass loudnorm (measure, then a linear gain to the target), then AAC. ffmpeg reports on stderr.
const dir = mkdtempSync(join(tmpdir(), 'trainer-')), src = join(dir, 'mix.wav'), target = 'I=-13.5:TP=-1.2:LRA=7';
try {
  writeFileSync(src, wav);
  const p = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', src, '-af', `loudnorm=${target}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
  if (p.status !== 0) throw new Error(p.error?.message ?? p.stderr);
  const m = JSON.parse(p.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/)[0]); // the loudnorm block, among ffmpeg's other lines
  const af = `loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  const enc = spawnSync('ffmpeg', ['-hide_banner', '-y', '-i', src, '-af', af, '-ar', String(SR), '-c:a', 'aac', '-b:a', '112k', '-movflags', '+faststart', OUT], { encoding: 'utf8' });
  if (enc.status !== 0) throw new Error(enc.stderr);
  console.log(`wrote ${OUT}: ${(LEN / SR).toFixed(1)} s, mix ${m.input_i} LUFS -> -13.5`);
} finally { rmSync(dir, { recursive: true, force: true }); }
