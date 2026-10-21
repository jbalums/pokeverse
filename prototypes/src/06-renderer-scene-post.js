import './05-paths-raised-plaza-stairs-tall-grass.js'; // first: the modules run in file-number order (see main.js)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { V3 } from './01-helpers.js';
import { CAM_FOV } from './02-hero-camera.js';

// ============================================================ renderer / scene / post
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
let DPR = Math.min(devicePixelRatio, 1.5); // lowered by the Graphics quality setting
renderer.setPixelRatio(DPR);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
renderer.info.autoReset = false; // reset once per frame in frame(), so debug.stats() sums all passes

const scene = new THREE.Scene();
const BG = new THREE.Color('#3f6b33');
scene.background = BG;
scene.fog = new THREE.Fog('#5d8a45', 34, 70);
// first person sees above the horizon: a sky gradient there, with the fog fading into its haze (third person keeps the green)
const FOG = scene.fog.color.clone(), HAZE = new THREE.Color('#cfe3d6'), SKY = (() => {
  const c = document.createElement('canvas'); c.width = 1; c.height = 64;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, '#78aee0'); gr.addColorStop(1, '#cfe3d6'); g.fillStyle = gr; g.fillRect(0, 0, 1, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const camera = new THREE.PerspectiveCamera(CAM_FOV, innerWidth / innerHeight, 0.3, 200);

const SUN_DIR = new V3(-10, 17, 9).normalize();
scene.add(new THREE.HemisphereLight('#e2f1ff', '#7f9a52', 1.45), new THREE.AmbientLight('#fff4e0', 0.35));
const sun = new THREE.DirectionalLight('#fff0d2', 3.1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 80 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.025;
sun.shadow.radius = 3;
scene.add(sun, sun.target);

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 }));
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, 1.1);                 // saturation boost
      c *= vec3(1.035, 1.01, 0.95);            // warm afternoon grade
      c = mix(c, smoothstep(-0.03, 1.03, c), 0.5); // a touch of contrast
      vec2 p = vUv - 0.5; c *= 1.0 - dot(p, p) * 0.3;
      gl_FragColor = vec4(c, 1.0);
    }`,
}));

const uTime = { value: 0 };
const uPlayer = { value: new V3() };

const GLSL_NOISE = `
  float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float vn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(h3(i), h3(i+vec3(1,0,0)), f.x), mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x), mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y), f.z); }
  float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
  float fbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * vn2(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
`;

// other modules assign these through their setters (an imported binding is read-only)
function setDPR(v) { return (DPR = v); }
export { BG, DPR, FOG, GLSL_NOISE, HAZE, SKY, SUN_DIR, bloom, camera, canvas, composer, renderPass, renderer, scene, setDPR, sun,
  uPlayer, uTime };
