import './32-pokedex.js'; // first: the modules run in file-number order (see main.js)
import * as THREE from 'three';
import { add } from './07-materials-textures.js';
import { rig, xy } from './19-characters.js';

// ============================================================ wild Pokémon models
function makePidgey() { const x = xy('pidgey'); if (x) { const { wingL, wingR } = x.userData.chains; Object.assign(x.userData, { flies: true, wings: wingL && wingR ? [wingL, wingR] : null }); return x; } const { root, parts } = rig('pidgey'); Object.assign(root.userData, { wings: [parts.wingL, parts.wingR], flies: true }); return root; }
function makeRattata() { return xy('rattata') || rig('rattata').root; }
function makeCaterpie() { return xy('caterpie') || rig('caterpie').root; }
function makeWeedle() { return xy('weedle') || rig('weedle').root; }
function makeOddish() { const x = xy('oddish'); if (x) return x; const { root, parts } = rig('oddish'); root.userData.leaves = parts.leaves; return root; }
function makeBall(r = 0.16) {
  const g = new THREE.Group();
  add(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), '#e2473b', g, 0, 0, 0, { mat: { roughness: 0.35 } });
  add(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), '#f5f5f5', g, 0, 0, 0, { mat: { roughness: 0.35 } });
  add(new THREE.TorusGeometry(r, r * 0.09, 8, 32), '#222222', g, 0, 0, 0, { r: [Math.PI / 2, 0, 0] });
  add(new THREE.CylinderGeometry(r * 0.32, r * 0.32, r * 0.2, 20), '#222222', g, 0, 0, r * 0.95, { r: [Math.PI / 2, 0, 0] });
  add(new THREE.CylinderGeometry(r * 0.2, r * 0.2, r * 0.24, 20), '#fafafa', g, 0, 0, r * 0.98, { r: [Math.PI / 2, 0, 0] });
  return g;
}

export { makeBall, makeCaterpie, makeOddish, makePidgey, makeRattata, makeWeedle };
