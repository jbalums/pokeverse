import './35-battle-hud-messages-menus.js'; // first: the modules run in file-number order (see main.js)
import { V3 } from './01-helpers.js';
import { TYPE_COL } from './27-pokemon-data.js';
import { BT, SETTLE, SNAP_LUNGE, bolt, burst, dropModel, easeIO, pose, tween } from './34-battle-tweens-effects-arena.js';

// ============================================================ battle: animations
async function lunge(am, dm) { // fallback physical move (and misses): snap crouch into a lunge, then settle back
  const a = am.position.clone(), d = dm.position.clone().sub(a).multiplyScalar(0.42);
  pose(am, 0.16, SNAP_LUNGE);
  await tween(0.16, t => am.position.copy(a).addScaledVector(d, easeIO(t)));
  pose(am, 0.2, SETTLE);
  await tween(0.2, t => am.position.copy(a).addScaledVector(d, 1 - easeIO(t)));
}
// fallback status move: crouch, spring up stretched, land squashed, settle
const hop = am => pose(am, 0.32, [{ t: 0.2, sy: 0.8, lean: -0.1 }, { t: 0.5, y: 0.3, sy: 1.15 }, { t: 0.78, sy: 0.85 }, { t: 1 }]);
async function hitAnim(m, react = 1) { // hold the hit (the freeze), get pushed further on a big hit, recover with an overshoot
  const h = m.userData.hit || { z: -0.18, lean: -0.22, roll: 0.12, sy: 0.88 }, k = react;
  BT.stop = Math.max(BT.stop || 0, 0.06 * k);
  const far = { z: h.z * (0.6 + k), lean: h.lean * (0.5 + 0.5 * k), roll: h.roll * (0.5 + k), sy: 1 - (1 - h.sy) * k };
  await pose(m, 0.45, [{ t: 0.02, ...h }, { t: 0.22, ...h }, { t: 0.45, ...far }, { t: 0.75, z: -0.02, lean: 0.06, roll: -h.roll * 0.2, sy: 1.04 }, { t: 1 }]);
  m.userData.hit = null;
}
async function faintAnim(m) { // stagger, tip over sideways, hit the ground with a small bounce, fade out
  if (!m) return;
  const mats = []; // models share materials with the overworld clones, so the fade works on copies
  m.traverse(o => { if (o.material) { o.material = [o.material].flat().map(x => { const c = x.clone(); c.transparent = true; c.userData.op = x.opacity; mats.push(c); return c; }); if (o.material.length === 1) o.material = o.material[0]; } });
  const side = Math.random() < 0.5 ? -1 : 1;
  pose(m, 0.55, [{ t: 0.12, roll: side * 0.18, lean: 0.12, sy: 0.92 }, { t: 0.25, roll: -side * 0.1, lean: 0.05, sy: 0.95 },
    { t: 0.68, roll: -side * 1.45, y: -0.05, sy: 0.85 }, { t: 0.8, roll: -side * 1.3, y: 0.04, sy: 1 }, { t: 0.9, roll: -side * 1.45, y: -0.05, sy: 0.9 }, { t: 1, roll: -side * 1.45, y: -0.05, sy: 0.9 }]);
  await tween(0.55, t => { const f = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4; for (const c of mats) c.opacity = c.userData.op * f; });
  dropModel(m); mats.forEach(c => c.dispose());
}
function moveFx(mv, am, dm) {
  const tp = dm.position.clone().add(new V3(0, 0.55 * dm.userData.s, 0));
  ({
    ELECTRIC: () => { bolt(tp); burst(tp, '#fff16a', { n: 36, speed: 3, grav: 0, life: 0.5 }); },
    FIRE: () => { burst(tp, '#ff6a1a', { n: 44, up: 2.5, grav: 2.5, speed: 1.4, life: 0.9, size: 0.26 }); burst(tp, '#ffd23f', { n: 24, up: 2, grav: 2, speed: 1, life: 0.7 }); },
    GRASS: () => burst(tp, '#5fd04a', { n: 34, speed: 2.6, size: 0.22 }),
    FLYING: () => burst(tp, '#e8f4ff', { n: 40, speed: 3.2, grav: 0, life: 0.55 }),
    POISON: () => burst(tp, '#c25ae6', { n: 28, up: 2, grav: 1.5, speed: 1, life: 1, size: 0.24 }),
    BUG: () => burst(tp, '#ffffff', { n: 24, speed: 2, life: 0.6 }),
  }[mv.type] || (() => burst(tp, mv.type === 'NORMAL' ? '#fff2c0' : TYPE_COL[mv.type] ?? '#fff2c0', { n: 24, speed: 3.5, grav: 0, life: 0.4, size: 0.22 })))();
  if (mv.drain) burst(tp, '#8dff6a', { n: 22, to: am.position.clone().add(new V3(0, 0.55 * am.userData.s, 0)), speed: 1, life: 1.1 });
}

export { faintAnim, hitAnim, hop, lunge, moveFx };
