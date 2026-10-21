import './10-streaming.js'; // first: the modules run in file-number order (see main.js)
import * as THREE from 'three';
import { V3, clamp } from './01-helpers.js';
import { RV, RV_S } from './04-river.js';
import { GLSL_NOISE, scene, uTime } from './06-renderer-scene-post.js';

// ============================================================ water
const ROCKS_IN_WATER = [];
const waterVS = `attribute float aFall; varying float vFall; varying vec2 vUv; varying vec3 vW;
  void main(){ vUv = uv; vFall = aFall; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const waterMat = new THREE.ShaderMaterial({
  uniforms: { uTime, uFlow: { value: 0 }, uRocks: { value: Array.from({ length: 14 }, () => new V3(0, 0, -1)) } },
  transparent: true, side: THREE.DoubleSide, vertexShader: waterVS,
  fragmentShader: `uniform float uTime, uFlow; uniform vec3 uRocks[14]; varying float vFall; varying vec2 vUv; varying vec3 vW;
  ${GLSL_NOISE}
  void main(){
    float edge = min(vUv.x, 1.0 - vUv.x) * 2.0;           // 0 at banks, 1 mid-stream
    float sp = 1.1 + vFall * 5.0;
    vec2 q = vec2(vUv.x * 3.0, vUv.y * 0.9 + uFlow * sp); // uFlow: the stream's own clock, slowed while the signal keeps it still
    float n1 = fbm2(vec2(q.x * 1.6, q.y * 0.55));
    float n2 = fbm2(vec2(q.x * 4.0 + 3.1, q.y * 1.5 + uTime * 0.5));
    vec3 deep = vec3(0.008, 0.15, 0.6), mid = vec3(0.02, 0.33, 0.85), lite = vec3(0.18, 0.66, 0.98);
    vec3 col = mix(lite, mix(mid, deep, smoothstep(0.35, 0.9, edge)), smoothstep(0.0, 0.4, edge));
    col = mix(col, lite, smoothstep(0.55, 0.8, n1) * 0.45);
    float foam = smoothstep(0.13, 0.0, edge - (n2 - 0.5) * 0.18);
    foam += smoothstep(0.86, 1.0, sin(n1 * 24.0 + uTime * 0.6)) * 0.4 * (0.4 + 0.6 * n2);
    foam += clamp(vFall, 0.0, 1.0) * (0.55 + 0.6 * n2);
    for (int i = 0; i < 14; i++) {
      vec3 r = uRocks[i]; if (r.z <= 0.0) continue;
      vec2 d = vW.xz - r.xy;
      float dist = length(vec2(d.x, d.y > 0.0 ? d.y * 0.7 : d.y)) - r.z;    // short wake downstream (+z)
      foam += smoothstep(0.14, 0.0, dist + (n2 - 0.5) * 0.16) * 0.85;
    }
    foam = clamp(foam, 0.0, 1.0);
    col = mix(col, vec3(0.93, 0.97, 1.0), foam);
    float glint = pow(max(0.0, fbm2(vec2(vW.x * 5.0 + uTime * 0.4, vW.z * 5.0 - uTime * 0.9)) - 0.38), 4.0) * 70.0;
    col += glint * (1.0 - foam) * vec3(1.0, 0.97, 0.9);
    gl_FragColor = vec4(col, mix(0.88, 1.0, foam));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`,
});
{
  const pos = [], uv = [], fall = [], idx = [];
  for (let i = 0; i < RV.length; i++) {
    const a = RV[Math.max(0, i - 1)], b = RV[Math.min(RV.length - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz); tx /= l; tz /= l;
    const p = RV[i], w = p[3] + 0.3;
    pos.push(p[0] + tz * w, p[2], p[1] - tx * w, p[0] - tz * w, p[2], p[1] + tx * w);
    uv.push(0, RV_S[i], 1, RV_S[i]);
    let f = 0; for (let k = -2; k <= 3; k++) { const j = clamp(i - k, 1, RV.length - 1); f = Math.max(f, Math.abs(RV[j][2] - RV[j - 1][2]) / Math.max(0.05, RV_S[j] - RV_S[j - 1]) * (k > 0 ? 0.6 : 1)); }
    fall.push(Math.min(1, f), Math.min(1, f));
    if (i) { const o = (i - 1) * 2; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aFall', new THREE.Float32BufferAttribute(fall, 1));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, waterMat); m.renderOrder = 1; scene.add(m);
}

export { ROCKS_IN_WATER, waterMat };
