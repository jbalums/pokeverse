import './01-helpers.js'; // first: the modules run in file-number order (see main.js)
import * as THREE from 'three';

// ============================================================ hero camera: the reference image's viewpoint
// Every landmark below is traced in reference-image pixels (1672x941) and projected onto the ground
// through this camera, so the opening frame lines up with the concept art.
const REF_W = 1672, REF_H = 941, REF_ASPECT = REF_W / REF_H;
const CAM_PITCH = 45 * Math.PI / 180, CAM_FOV = 35, CAM_DIST = 19.3;
// Fog starts / turns solid this far past the focus point, so it moves with the zoom: at zoom 1 it is 34 -> 70, and zooming out
// never shows the edge of the loaded world. FOG_FAR_PAST is the view-distance knob (smaller = fewer streamed cells, more haze).
const ZOOM_MIN = 0.6, ZOOM_MAX = 2.2, FOG_NEAR_PAST = 14.7, FOG_FAR_PAST = 50.7, FPV_FOG = [34, 70];
const viewFog = (d, fpv) => fpv ? FPV_FOG : [d + FOG_NEAR_PAST, d + FOG_FAR_PAST];
const heroCam = new THREE.PerspectiveCamera(CAM_FOV, REF_ASPECT, 0.1, 500);
heroCam.position.set(0, CAM_DIST * Math.sin(CAM_PITCH), CAM_DIST * Math.cos(CAM_PITCH));
heroCam.lookAt(0, 0, 0); heroCam.updateMatrixWorld();
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2();
// Verdant is traced from the concept art, then spread out SPREAD times so the town has room to breathe: buildings keep their size,
// the gaps between them grow. Metre literals that place things in Verdant go through VS() to follow.
const SPREAD = 1.5, VS = v => v * SPREAD;
function I(px, py, h = 0) {
  _ray.setFromCamera(_ndc.set(px / REF_W * 2 - 1, 1 - py / REF_H * 2), heroCam);
  const o = _ray.ray.origin, d = _ray.ray.direction, t = (h - o.y) / d.y;
  return [(o.x + d.x * t) * SPREAD, (o.z + d.z * t) * SPREAD];
}
const START = I(865, 505, 0);
const BU = I(405, 645, 0); // wild Bulbasaur in the tall grass

export { BU, CAM_DIST, CAM_FOV, CAM_PITCH, I, REF_ASPECT, SPREAD, START, VS, ZOOM_MAX, ZOOM_MIN, heroCam, viewFog };
