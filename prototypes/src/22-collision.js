import './21-side-quests.js'; // first: the modules run in file-number order (see main.js)
import { segD } from './01-helpers.js';
import { K_WALK, ROOM_X, inKalos, inRect } from './03-fleurville-map.js';
import { riverInfo } from './04-river.js';
import { T_WALK, inTest, onBridge, terrainH, verdantWalkable, walkH } from './05-paths-raised-plaza-stairs-tall-grass.js';
import { boxes, circles, segs } from './12-batched-props.js';
import { ROOMS } from './16-fleurville-world.js';
import { npcs } from './19-characters.js';

// ============================================================ collision
const PR = 0.26;
function blockedAt(x, z, fromH, ignore) {
  if (x > ROOM_X - 40 ? !ROOMS.some(r => inRect(x, z, r.walk)) : inKalos(x) ? !inRect(x, z, K_WALK) : inTest(x) ? !inRect(x, z, T_WALK) : !verdantWalkable(x, z)) return true;
  const h = walkH(x, z);
  if (Math.abs(h - fromH) > 0.35) return true;
  for (const [dx, dz] of [[PR, 0], [-PR, 0], [0, PR], [0, -PR]]) {
    const xx = x + dx, zz = z + dz;
    if (!inKalos(xx) && !inTest(xx) && !onBridge(xx, zz)) { const r = riverInfo(xx, zz); if (r.d < r.hw + 0.05 || r.d < r.hw + 1.2 && terrainH(xx, zz) < r.level + 0.05) return true; } // below the water line only counts on the banks
    if (Math.abs(walkH(xx, zz) - h) > 0.35) return true;
  }
  for (const b of boxes) if (x > b.x0 - PR && x < b.x1 + PR && z > b.z0 - PR && z < b.z1 + PR) return true;
  for (const c of circles) if (!c.cleared && (x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + PR) ** 2) return true;
  for (const s of segs) if (segD(x, z, ...s) < PR + 0.06) return true;
  for (const n of npcs) if (n !== ignore && (x - n.x) ** 2 + (z - n.z) ** 2 < 0.3) return true;
  return false;
}
function tryMove(pos, dx, dz) {
  const h = walkH(pos.x, pos.z);
  if (!blockedAt(pos.x + dx, pos.z + dz, h)) { pos.x += dx; pos.z += dz; return true; }
  if (!blockedAt(pos.x + dx, pos.z, h)) { pos.x += dx; return true; }
  if (!blockedAt(pos.x, pos.z + dz, h)) { pos.z += dz; return true; }
  return false;
}

export { blockedAt, tryMove };
