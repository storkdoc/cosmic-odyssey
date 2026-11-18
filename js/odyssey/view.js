/* A NASA sky, up to three living stars, and a camera that can see one surface or the whole system. */
import * as THREE from '../../vendor/three/three.module.min.js';
import { pathCenters, planetParent, plateScale, plateRadius, systemExtent, layoutScale, drawnGap, drawnStars, ORBIT_SECONDS } from './systems.js';
import { createPlateBank } from './plates.js';
import { EffectComposer } from '../../vendor/three/postprocessing/EffectComposer.js';
import { RenderPass } from '../../vendor/three/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../../vendor/three/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../../vendor/three/postprocessing/OutputPass.js';
import { starType, STAR_TYPES } from './stars.js';

const STAR_VERT = `
  varying vec3 vN; varying vec3 vW;
  void main(){
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const STAR_FRAG = `
  varying vec3 vN; varying vec3 vW;
  uniform vec3 uColor; uniform vec3 uCam; uniform float uTime;
  uniform float uActivity; uniform float uRot; uniform float uFlare; uniform float uKind;
  float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec3 p){
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p){
    float f = 0.0; float a = 0.55;
    for (int i = 0; i < 5; i++) { f += a * noise(p); p = p * 2.05 + vec3(1.7, 9.2, 2.8); a *= 0.5; }
    return f;
  }
  void main(){
    vec3 n = normalize(vN);
    vec3 V = normalize(uCam - vW);
    float mu = clamp(dot(n, V), 0.0, 1.0);
    float limb = pow(mu, 0.42);
    vec3 q = n * 7.5 + vec3(0.0, uTime * 0.07, uRot * 0.15);
    float g = fbm(q);
    float fine = fbm(n * 18.0 + vec3(uTime * 0.16, 0.0, 4.0));
    float cells = smoothstep(0.28, 0.82, g);
    float warm = smoothstep(-0.05, 0.35, uColor.r - uColor.b);
    vec3 lava = mix(vec3(0.55, 0.16, 0.02), vec3(1.0, 0.72, 0.12), cells);
    lava = mix(lava, vec3(1.0, 0.95, 0.75), smoothstep(0.62, 0.9, fine) * 0.55);
    vec3 cool = uColor * (0.35 + 1.15 * cells) * (0.85 + 0.3 * fine);
    vec3 col = mix(cool, lava, warm);
    float bright = pow(fbm(n * 2.4 + vec3(2.0, uTime * 0.05, 0.0)), 2.4);
    col += vec3(1.0, 0.86, 0.45) * bright * (0.25 + uActivity * 0.9);
    float spot = smoothstep(0.16, 0.02, distance(n, normalize(vec3(0.55, 0.22, 0.75))))
               + smoothstep(0.1, 0.015, distance(n, normalize(vec3(-0.35, -0.15, 0.85))))
               + smoothstep(0.08, 0.01, distance(n, normalize(vec3(0.1, 0.72, 0.4))));
    col *= 1.0 - spot * (0.35 + uActivity * 0.45);
    col *= 0.22 + 0.95 * limb;
    float flarePos = smoothstep(0.28, 0.0, distance(n, normalize(vec3(0.72, 0.18, 0.55))));
    col += vec3(1.0, 0.9, 0.55) * flarePos * uFlare * 2.6;
    if (uKind > 1.5) col = mix(vec3(0.01, 0.008, 0.006), col, 0.12);
    gl_FragColor = vec4(col, 1.0);
  }`;

const DISK_VERT = `
  varying vec2 vUv; varying vec3 vW;
  void main(){
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const DISK_FRAG = `
  varying vec2 vUv; varying vec3 vW;
  uniform float uTime; uniform vec3 uCam; uniform float uSpin;
  float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec3 p){
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
  }
  void main(){
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float ang = atan(p.y, p.x);
    float hole = smoothstep(0.28, 0.36, r);
    float edge = 1.0 - smoothstep(0.9, 1.02, r);
    float arm = 0.5 + 0.5 * sin(ang * 5.0 - r * 16.0 + uTime * (1.6 + uSpin));
    float n = noise(vec3(cos(ang) * r * 8.0, sin(ang) * r * 8.0, uTime * 0.45));
    float heat = pow(clamp(1.0 - r, 0.0, 1.0), 1.15);
    vec3 col = mix(vec3(0.35, 0.03, 0.01), vec3(1.0, 0.55, 0.08), heat);
    col = mix(col, vec3(1.0, 0.95, 0.82), smoothstep(0.45, 0.95, heat));
    col *= 1.15 + 1.1 * n + 0.65 * arm;
    vec3 view = normalize(uCam - vW);
    vec3 tang = normalize(vec3(-p.y, 0.0, p.x));
    float approach = dot(normalize(tang), view);
    col *= 0.35 + 1.35 * smoothstep(-0.55, 0.85, approach);
    col += vec3(1.0, 0.92, 0.7) * smoothstep(0.34, 0.38, r) * (1.0 - smoothstep(0.38, 0.46, r));
    gl_FragColor = vec4(col, hole * edge);
  }`;

const NEBULA_VERT = `
  varying vec3 vDir;
  void main(){
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const NEBULA_FRAG = `
  varying vec3 vDir;
  uniform float uTime;
  float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec3 p){
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p){
    float f = 0.0; float a = 0.55;
    for (int i = 0; i < 5; i++) { f += a * noise(p); p *= 2.07; a *= 0.5; }
    return f;
  }
  void main(){
    vec3 d = normalize(vDir);
    float plane = exp(-pow(d.y * 2.4, 2.0));
    vec3 p = d * 2.6 + vec3(uTime * 0.012, 0.0, 0.0);
    float n = fbm(p);
    float dust = smoothstep(0.42, 0.78, fbm(p * 1.8 + 5.0));
    vec3 col = vec3(0.42, 0.12, 0.55) * n;
    col += vec3(0.95, 0.32, 0.55) * pow(n, 2.0);
    col += vec3(0.22, 0.32, 0.85) * fbm(p + 3.2) * 0.75;
    col *= 0.28 + plane * 1.15;
    col *= 1.0 - dust * 0.72;
    float core = pow(max(0.0, dot(d, vec3(0.15, 0.02, -1.0))), 6.0);
    col += vec3(0.85, 0.45, 0.62) * core;
    gl_FragColor = vec4(col, 0.92);
  }`;

function coronaTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const g = canvas.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,255,0.95)');
  grd.addColorStop(0.2, 'rgba(255,255,255,0.35)');
  grd.addColorStop(0.55, 'rgba(255,255,255,0.08)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roundPoints(count, radius, spread) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  const col = new Float32Array(count * 3);
  const hues = [[1, 0.95, 0.86], [0.75, 0.85, 1], [1, 0.72, 0.55], [0.8, 1, 0.9]];
  for (let i = 0; i < count; i++) {
    const z = Math.random() * 2 - 1;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.max(0, 1 - z * z)) * radius * (spread ? (0.55 + Math.random() * 0.45) : 1);
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = z * radius * (spread ? 0.7 : 1);
    pos[i * 3 + 2] = Math.sin(a) * r;
    phase[i] = Math.random() * Math.PI * 2;
    const h = hues[i % hues.length];
    col[i * 3] = h[0]; col[i * 3 + 1] = h[1]; col[i * 3 + 2] = h[2];
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

const POINT_VERT = `
  attribute float aPhase; attribute vec3 color;
  varying float vA; varying vec3 vC;
  uniform float uTime; uniform float uDpr; uniform float uSize;
  void main(){
    vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime + aPhase));
    vC = color;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uDpr * uSize * (160.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }`;
const POINT_FRAG = `
  varying float vA; varying vec3 vC; uniform float uSpeed;
  void main(){
    vec2 p = gl_PointCoord - 0.5;
    p.x /= 1.0 + uSpeed * 7.0;
    if (dot(p, p) > 0.25) discard;
    float core = smoothstep(0.25, 0.0, dot(p, p));
    gl_FragColor = vec4(vC * core, core * vA);
  }`;

function makePoints(geo, size) {
  return new THREE.Points(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uDpr: { value: 1 }, uSize: { value: size }, uSpeed: { value: 0 } },
    vertexShader: POINT_VERT,
    fragmentShader: POINT_FRAG
  }));
}

function prominence(color, scale, tilt, reach) {
  const pts = [];
  const height = reach || 0.7;
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const a = (t - 0.5) * 1.15;
    const lift = Math.sin(t * Math.PI) * height * scale;
    const base = new THREE.Vector3(Math.sin(a), 0.08, Math.cos(a)).normalize();
    pts.push(base.multiplyScalar(1.01 + lift));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.055, 8, false), new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  mesh.rotation.y = tilt;
  return mesh;
}

export function createView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.02, 2000);
  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || Math.min(window.innerWidth, window.innerHeight) < 800;

  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 64, 40), new THREE.MeshBasicMaterial({ color: 0x010108, side: THREE.BackSide, depthWrite: false }));
  sky.renderOrder = -3;
  scene.add(sky);
  const skyUrl = coarse ? 'assets/sky/starmap-4k.jpg' : 'assets/sky/starmap-8k.jpg';
  const skyInfo = { w: 0, h: 0, url: skyUrl };
  new THREE.TextureLoader().load(skyUrl, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    t.needsUpdate = true;
    sky.material.map = t;
    sky.material.needsUpdate = true;
    skyInfo.w = t.image.width;
    skyInfo.h = t.image.height;
    window.__sky = { w: skyInfo.w, h: skyInfo.h, url: skyUrl, dpr: renderer.getPixelRatio(), anisotropy: t.anisotropy };
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromEquirectangular(t).texture;
      pmrem.dispose();
    } catch (err) { /* the sphere still carries the map */ }
  });

  const galaxy = new THREE.Mesh(new THREE.SphereGeometry(820, 64, 40), new THREE.MeshBasicMaterial({
    color: 0xffffff, side: THREE.BackSide, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  galaxy.rotation.y = Math.PI * 0.98;
  galaxy.renderOrder = -2;
  scene.add(galaxy);
  const nebula = new THREE.Mesh(new THREE.SphereGeometry(760, 48, 32), new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: NEBULA_VERT,
    fragmentShader: NEBULA_FRAG,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  nebula.renderOrder = -1;
  scene.add(nebula);
  new THREE.TextureLoader().load('assets/sky/milkyway.jpg', (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    galaxy.material.map = t;
    galaxy.material.needsUpdate = true;
  });

  const farStars = makePoints(roundPoints(coarse ? 700 : 1400, 420, false), 1.05);
  const nearStars = makePoints(roundPoints(coarse ? 120 : 220, 70, true), 1.85);
  scene.add(farStars, nearStars);

  const coronaMap = coronaTexture();
  function createBody() {
    const group = new THREE.Group();
    const star = new THREE.Mesh(new THREE.SphereGeometry(1, coarse ? 40 : 64, coarse ? 32 : 48), new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color('#fff4ea') },
        uCam: { value: new THREE.Vector3() },
        uTime: { value: 0 },
        uActivity: { value: 0.25 },
        uRot: { value: 0 },
        uFlare: { value: 0 },
        uKind: { value: 0 }
      },
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG
    }));
    const corona = new THREE.Sprite(new THREE.SpriteMaterial({
      map: coronaMap, color: 0xfff4ea, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.75, depthWrite: false
    }));
    corona.scale.setScalar(3.2);
    const disk = new THREE.Mesh(new THREE.CircleGeometry(3.4, coarse ? 64 : 96), new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCam: { value: new THREE.Vector3() },
        uSpin: { value: 0.6 }
      },
      vertexShader: DISK_VERT,
      fragmentShader: DISK_FRAG,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false
    }));
    disk.rotation.x = 0.55;
    disk.scale.setScalar(1.35);
    const lens = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.02, 8, 80), new THREE.MeshBasicMaterial({
      color: 0xffc27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    lens.rotation.x = 0.42;
    const shadow = new THREE.Mesh(new THREE.SphereGeometry(0.92, 36, 24), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    shadow.visible = false;
    const beams = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const beam = new THREE.Mesh(new THREE.ConeGeometry(0.08, 2.6, 16, 1, true), new THREE.MeshBasicMaterial({
        color: 0xd7e8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      }));
      beam.position.y = i === 0 ? 1.6 : -1.6;
      beam.rotation.x = i === 0 ? 0 : Math.PI;
      beams.add(beam);
    }
    const loops = new THREE.Group();
    const loopColor = new THREE.Color('#ffb15a');
    // A fan of loops on the limb that faces the resting camera, like the plate.
    loops.add(prominence(loopColor, 0.85, -1.12, 0.32));
    loops.add(prominence(loopColor, 1.05, -1.05, 0.55));
    loops.add(prominence(loopColor, 1.2, -1.0, 0.82));
    loops.add(prominence(loopColor, 1.35, -1.08, 1.05));
    const ejecta = makePoints(roundPoints(coarse ? 28 : 48, 1.1, true), 2.4);
    ejecta.visible = false;
    group.add(star, shadow, corona, disk, lens, beams, loops, ejecta);
    group.visible = false;
    scene.add(group);
    return { group, star, shadow, corona, disk, lens, beams, loops, ejecta, flare: 0, flareIn: 4 + Math.random() * 5, spin: Math.random(), spec: null, loopColor };
  }
  const bodies = [createBody(), createBody(), createBody()];
  const pathRoot = new THREE.Group();
  scene.add(pathRoot);
  let pathLines = [];

  let composer = null;
  let quality = coarse ? 'low' : 'high';
  function buildComposer() {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.16, 0.4, 0.9));
    composer.addPass(new OutputPass());
  }
  function applySize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 2 : 3);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    const narrow = w < 900;
    if (narrow && mode === 'system') camera.setViewOffset(w, h, 0, Math.min(40, h * 0.05), w, h);
    else if (narrow) camera.setViewOffset(w, h, 0, h * 0.16, w, h);
    else camera.setViewOffset(w, h, -w * 0.17, 0, w, h);
    if (mode === 'system') refit(snapFrame);
    snapFrame = false;
    camera.updateProjectionMatrix();
    if (composer) composer.setSize(w, h);
    farStars.material.uniforms.uDpr.value = dpr;
    nearStars.material.uniforms.uDpr.value = dpr;
    bodies.forEach((body) => { body.ejecta.material.uniforms.uDpr.value = dpr; });
    window.__sky = Object.assign(window.__sky || {}, { dpr, url: skyUrl, w: skyInfo.w, h: skyInfo.h });
  }
  if (quality === 'high') {
    try { buildComposer(); } catch (err) { quality = 'low'; composer = null; }
  }

  const cam = { dist: 8.5, target: 8.5, lastX: 0, lastY: 0 };
  const pan = { x: 0, z: 0 };
  const keys = { w: false, a: false, s: false, d: false };
  let zmin = 1.15;
  let zmax = 80;
  let fitDist = 8.5;
  let userZoom = 1;
  let mapExtent = 4;
  const pointers = new Map();
  const touches = new Map();
  let pinchPrev = 0;
  let snapFrame = false;
  let showBody = false;
  let mode = 'sky';
  let sys = null;
  let pathsOn = true;
  const onFlare = { fn: null };
  window.__paths = true;

  function kindCode(kind) {
    if (kind === 'bh') return 2;
    if (kind === 'ns') return 1;
    return 0;
  }

  function paintBody(body, next) {
    body.spec = next;
    const type = starType(next.type);
    const color = new THREE.Color(type.color);
    body.star.material.uniforms.uColor.value.copy(color);
    body.star.material.uniforms.uKind.value = kindCode(type.kind);
    body.corona.material.color.copy(color);
    body.loopColor.copy(color);
    body.loops.children.forEach((loop) => loop.material.color.copy(color));
    body.lens.material.opacity = type.kind === 'bh' ? 0.95 : 0;
    if (body.disk.material.uniforms && body.disk.material.uniforms.uSpin) {
      body.disk.material.uniforms.uSpin.value = Math.max(0, Math.min(0.998, Number(next.spin) || 0));
    }
    const warm = (next.teff || type.teff[0]) < 9000;
    body.corona.material.color.set(warm ? '#ff7a2a' : type.color);
    body.loopColor.set(warm ? '#e24312' : type.color);
    body.loops.children.forEach((loop) => loop.material.color.copy(body.loopColor));
  }

  function focusBody(body) {
    body.group.visible = true;
    body.group.position.set(0, 0, 0);
    body.group.scale.setScalar(1);
  }

  function setStar(next) {
    mode = 'focus';
    sys = { count: 1, architecture: 'single', stars: [next], paths: [], span: 4, planets: [] };
    mapExtent = 4;
    camera.near = 0.02;
    camera.far = 2000;
    camera.updateProjectionMatrix();
    clearPaths();
    clearPlanets();
    showBody = true;
    bodies.forEach((body, i) => {
      body.group.visible = i === 0;
      if (i === 0) focusBody(body);
    });
    paintBody(bodies[0], next);
  }

  function clearPaths() {
    pathLines.forEach((line) => {
      pathRoot.remove(line);
      line.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
    });
    pathLines = [];
  }

  function makeCircle(radius) {
    const group = new THREE.Group();
    const pts = [];
    const steps = 160;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({
      color: 0xf0e2cc, transparent: true, opacity: 0.85
    }));
    const thickness = Math.max(0.004, radius * 0.004);
    const glow = new THREE.Mesh(
      new THREE.RingGeometry(Math.max(0.002, radius - thickness), radius + thickness, coarse ? 96 : 160),
      new THREE.MeshBasicMaterial({
        color: 0xf7ead8, side: THREE.DoubleSide, transparent: true, opacity: 0.45,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    glow.rotation.x = -Math.PI / 2;
    group.add(line, glow);
    group.visible = pathsOn;
    pathRoot.add(group);
    pathLines.push(group);
  }

  function frameDistance(extent) {
    const half = Math.tan((camera.fov * Math.PI) / 360);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const narrow = w < 900;
    const aspect = w / Math.max(1, h);
    const fitW = narrow ? 0.9 : 0.56;
    const fitH = narrow && mode === 'system' ? 0.8 : narrow ? 0.5 : 0.88;
    const distH = extent / Math.max(0.05, half * aspect * fitW);
    const distV = extent / Math.max(0.05, half * fitH);
    return Math.max(0.35, distH, distV);
  }

  function refit(snap) {
    fitDist = frameDistance(mapExtent);
    zmin = Math.max(0.04, mapExtent * 0.012);
    zmax = Math.max(fitDist * 4, zmin * 6);
    if (snap) {
      userZoom = 1;
      cam.target = fitDist;
      cam.dist = fitDist;
      pan.x = 0;
      pan.z = 0;
      return;
    }
    cam.target = Math.min(zmax, Math.max(zmin, fitDist * userZoom));
  }

  function setSystem(layout) {
    sys = layout;
    mode = 'system';
    clearPaths();
    clearPlanets();
    const stars = layout.stars || [];
    showBody = stars.length > 0;
    bodies.forEach((body, i) => {
      const star = stars[i];
      body.group.visible = !!star;
      if (star) paintBody(body, star);
      else body.spec = null;
    });
    layout.planets = [];
    mapExtent = systemExtent(layout);
    (layout.paths || []).forEach((p) => makeCircle(p.radius));
    buildHabitable(layout);
    window.__planets = 0;
    camera.near = 0.01;
    camera.far = 8000;
    camera.updateProjectionMatrix();
    snapFrame = true;
    applySize();
    window.__paths = pathsOn;
  }

  const planetMeshes = [];
  const planetRings = [];
  let hzMesh = null;
  function clearHz() {
    if (!hzMesh) return;
    scene.remove(hzMesh);
    hzMesh.geometry.dispose();
    hzMesh.material.dispose();
    hzMesh = null;
  }
  function clearPlanets() {
    planetRings.forEach((mesh) => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
    planetRings.length = 0;
    planetMeshes.forEach((mesh) => { mesh.visible = false; });
    clearHz();
  }
  function buildPlanetRings(layout) {
    clearPlanets();
    const planets = layout.planets || [];
    while (planetMeshes.length < planets.length) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, coarse ? 8 : 14, coarse ? 6 : 10),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      scene.add(mesh);
      planetMeshes.push(mesh);
    }
    planetMeshes.forEach((mesh, i) => {
      const planet = planets[i];
      mesh.visible = !!planet && mode === 'system';
      if (!planet) return;
      mesh.material.color.set(planet.color);
      const world = Math.max(mapExtent * 0.012, 0.02) * (0.7 + (planet.radius || 0.5));
      mesh.scale.setScalar(world / 0.16);
    });
    planets.forEach((planet) => {
      const thickness = Math.max(0.006, planet.a * 0.0045);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(Math.max(0.01, planet.a - thickness), planet.a + thickness, coarse ? 80 : 128),
        new THREE.MeshBasicMaterial({
          color: 0xf3e6d0, side: THREE.DoubleSide, transparent: true, opacity: 0.72,
          blending: THREE.AdditiveBlending, depthWrite: false
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.visible = pathsOn;
      scene.add(ring);
      planetRings.push(ring);
    });
  }
  const HZ_VERT = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;
  const HZ_FRAG = `
    varying vec2 vUv;
    void main() {
      float feather = smoothstep(0.0, 0.42, vUv.y) * (1.0 - smoothstep(0.58, 1.0, vUv.y));
      vec3 glow = vec3(0.32, 0.74, 0.62);
      float a = 0.08 * feather;
      gl_FragColor = vec4(glow * a, a);
    }`;
  function buildHabitable(layout) {
    clearHz();
    const star = layout.stars && layout.stars[0];
    const hz = star && star.hz;
    if (!hz || !(hz.outer > hz.inner)) return;
    const inner = Math.max(0.02, hz.inner);
    const outer = Math.max(inner * 1.04, hz.outer);
    hzMesh = new THREE.Mesh(
      new THREE.RingGeometry(inner, outer, coarse ? 80 : 128),
      new THREE.ShaderMaterial({
        vertexShader: HZ_VERT,
        fragmentShader: HZ_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        blendSrcAlpha: THREE.ZeroFactor,
        blendDstAlpha: THREE.OneFactor
      })
    );
    hzMesh.rotation.x = -Math.PI / 2;
    hzMesh.renderOrder = 1;
    hzMesh.userData.inner = inner;
    hzMesh.userData.outer = outer;
    hzMesh.visible = pathsOn;
    scene.add(hzMesh);
  }

  function setPaths(on) {
    pathsOn = !!on;
    window.__paths = pathsOn;
    pathLines.forEach((line) => { line.visible = pathsOn; });
    planetRings.forEach((ring) => { ring.visible = false; });
    if (hzMesh) hzMesh.visible = pathsOn && mode === 'system';
    const label = document.getElementById('hz-label');
    if (label && !pathsOn) label.hidden = true;
    if (window.__pose) window.__pose.hz = !!(hzMesh && hzMesh.visible);
  }

  const plateBank = createPlateBank(scene);
  plateBank.prime();
  const orbitSeconds = reduce ? 180 : ORBIT_SECONDS;
  window.__orbitSeconds = orbitSeconds;
  function turnsNow() {
    return simTime / orbitSeconds;
  }
  function screenFloor() {
    const half = Math.tan((camera.fov * Math.PI) / 360);
    const h = canvas.clientHeight || window.innerHeight;
    const dist = Math.max(cam.dist, cam.target, 0.2);
    return 56 * (dist * half * 2) / Math.max(1, h);
  }
  function placement() {
    if (!showBody || !sys || !sys.stars || !sys.stars.length) return [];
    if (mode !== 'system') {
      return sys.stars.slice(0, 1).map((star) => ({ star, x: 0, z: 0, r: plateScale(star) }));
    }
    const extent = mapExtent;
    const placed = sys.count > 1 ? drawnStars(sys, turnsNow(), extent) : [{ x: 0, z: 0 }];
    const gap = sys.count > 1 ? drawnGap(sys, extent) : 0;
    const floor = screenFloor();
    return sys.stars.map((star, i) => {
      const at = placed[i] || { x: 0, z: 0 };
      const cap = gap > 0 ? gap * 0.3 : extent * 0.28;
      const r = Math.min(cap, Math.max(plateRadius(star, extent, gap), Math.min(floor, cap)));
      return { star, x: at.x, z: at.z, r };
    });
  }

  function hzAnchor(placed) {
    if (!sys || !sys.stars || !sys.stars[0] || !sys.stars[0].hz) return { x: 0, z: 0 };
    const hz = sys.stars[0].hz;
    const aroundStar = sys.count < 2 || (sys.holman && hz.outer < sys.holman.sType * 0.95);
    return planetParent(sys, placed, aroundStar ? 'star0' : 'bary');
  }

  function movePlanets() {
    planetMeshes.forEach((mesh) => { mesh.visible = false; });
    planetRings.forEach((ring) => { ring.visible = false; });
    window.__planets = 0;
    const label = document.getElementById('hz-label');
    if (mode !== 'system' || !sys || !hzMesh) {
      if (hzMesh) hzMesh.visible = false;
      if (label) label.hidden = true;
      return;
    }
    const placed = sys.count > 1 ? drawnStars(sys, turnsNow(), mapExtent) : [{ x: 0, z: 0 }];
    const anchor = hzAnchor(placed);
    hzMesh.position.set(anchor.x, 0, anchor.z);
    hzMesh.visible = pathsOn;
    if (label && !pathsOn) label.hidden = true;
  }

  function placeZoneLabel() {
    const label = document.getElementById('hz-label');
    if (!label) return;
    if (!hzMesh || !hzMesh.visible || mode !== 'system') {
      label.hidden = true;
      return;
    }
    const edge = project(hzMesh.position.x + hzMesh.userData.outer * 0.78, hzMesh.position.z);
    label.hidden = false;
    label.style.left = edge.x + 'px';
    label.style.top = edge.y + 'px';
  }

  function markZone(clientX, clientY) {
    const label = document.getElementById('hz-label');
    if (!label || label.hidden || !hzMesh || !hzMesh.visible) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const center = project(hzMesh.position.x, hzMesh.position.z);
    const outer = project(hzMesh.position.x + hzMesh.userData.outer, hzMesh.position.z);
    const inner = project(hzMesh.position.x + hzMesh.userData.inner, hzMesh.position.z);
    const d = Math.hypot(x - center.x, y - center.y);
    const outerPx = Math.hypot(outer.x - center.x, outer.y - center.y);
    const innerPx = Math.hypot(inner.x - center.x, inner.y - center.y);
    label.classList.toggle('on', d > innerPx * 0.88 && d < outerPx * 1.14);
  }

  const projector = new THREE.Vector3();
  function project(x, z) {
    projector.set(x, 0, z);
    projector.project(camera);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    return { x: (projector.x * 0.5 + 0.5) * w, y: (-projector.y * 0.5 + 0.5) * h };
  }

  function plateBox(item) {
    const center = project(item.x, item.z);
    const edge = project(item.x + item.r, item.z);
    const corner = project(item.x + item.r, item.z - item.r);
    const radius = Math.max(1, Math.hypot(edge.x - center.x, edge.y - center.y));
    return {
      x: center.x - radius,
      y: center.y - radius,
      w: radius * 2,
      h: radius * 2,
      cx: center.x,
      cy: center.y,
      cornerX: corner.x,
      cornerY: corner.y,
      worldX: item.x,
      worldZ: item.z,
      r: item.r,
      type: item.star.type || 'g',
      color: item.star.color || '#ffb15a'
    };
  }

  const viewDir = new THREE.Vector3();
  function pose() {
    const placedNow = placement();
    const plates = placedNow.map((item) => plateBox(item));
    const world = placedNow.map((item) => ({
      x: item.x, z: item.z, r: item.r, type: item.star.type || 'g'
    }));
    camera.getWorldDirection(viewDir);
    const lean = Math.atan2(Math.hypot(viewDir.x, viewDir.z), Math.max(0, -viewDir.y));
    const reading = {
      tilt: lean < 1e-3 ? 0 : lean,
      theta: 0,
      phi: 0,
      panX: pan.x,
      panZ: pan.z,
      dist: cam.dist,
      target: cam.target,
      mode,
      extent: mapExtent,
      fit: fitDist,
      orbits: pathLines.length,
      hz: !!(hzMesh && hzMesh.visible && mode === 'system'),
      count: sys ? sys.count : 0,
      film: plates.length > 0,
      plate: plates[0] || null,
      plates,
      world
    };
    window.__pose = reading;
    window.__plate = plates[0] || null;
    placeZoneLabel();
    return reading;
  }

  function publish() {
    const prior = window.__pose || {};
    window.__pose = Object.assign(prior, {
      tilt: prior.tilt || 0,
      panX: pan.x,
      panZ: pan.z,
      dist: cam.dist,
      target: cam.target,
      mode,
      extent: mapExtent,
      fit: fitDist
    });
  }

  function zoomBy(factor) {
    cam.target = Math.min(zmax, Math.max(zmin, cam.target * factor));
    if (fitDist > 0) userZoom = cam.target / fitDist;
    publish();
  }

  function panBy(dx, dy) {
    const span = cam.dist * 0.0022;
    const limit = Math.max(12, mapExtent * 4);
    pan.x = Math.max(-limit, Math.min(limit, pan.x - dx * span));
    pan.z = Math.max(-limit, Math.min(limit, pan.z - dy * span));
    publish();
  }

  function separation(map) {
    const pts = [...map.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  function notePinch(now) {
    if (pinchPrev > 0 && now > 0) zoomBy(pinchPrev / now);
    pinchPrev = now;
  }

  const pad = document.getElementById('gesture') || canvas;
  pad.style.touchAction = 'none';
  const stop = (event) => { if (event.cancelable) event.preventDefault(); };
  pad.addEventListener('wheel', (event) => {
    stop(event);
    zoomBy(event.deltaY > 0 ? 1.08 : 0.92);
  }, { passive: false });
  pad.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && touches.size) return;
    stop(event);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType });
    cam.lastX = event.clientX;
    cam.lastY = event.clientY;
    pinchPrev = pointers.size >= 2 ? separation(pointers) : 0;
  }, { passive: false });
  pad.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    stop(event);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType });
    if (pointers.size >= 2) {
      notePinch(separation(pointers));
      return;
    }
    if (touches.size >= 2) return;
    const dx = event.clientX - cam.lastX;
    const dy = event.clientY - cam.lastY;
    cam.lastX = event.clientX;
    cam.lastY = event.clientY;
    panBy(dx, dy);
    markZone(event.clientX, event.clientY);
  }, { passive: false });
  const endPointer = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size === 1) {
      const only = [...pointers.values()][0];
      cam.lastX = only.x;
      cam.lastY = only.y;
    }
    if (pointers.size < 2 && touches.size < 2) pinchPrev = 0;
  };
  pad.addEventListener('pointerup', endPointer);
  pad.addEventListener('pointercancel', endPointer);
  pad.addEventListener('touchstart', (event) => {
    stop(event);
    touches.clear();
    [...event.touches].forEach((touch) => touches.set(touch.identifier, { x: touch.clientX, y: touch.clientY }));
    if (touches.size === 1) {
      const only = [...touches.values()][0];
      cam.lastX = only.x;
      cam.lastY = only.y;
    }
    if (pointers.size < 2) pinchPrev = touches.size >= 2 ? separation(touches) : 0;
  }, { passive: false });
  pad.addEventListener('touchmove', (event) => {
    stop(event);
    touches.clear();
    [...event.touches].forEach((touch) => touches.set(touch.identifier, { x: touch.clientX, y: touch.clientY }));
    if (touches.size >= 2 && pointers.size < 2) {
      notePinch(separation(touches));
      return;
    }
    if (touches.size === 1 && pointers.size === 0) {
      const only = [...touches.values()][0];
      panBy(only.x - cam.lastX, only.y - cam.lastY);
      cam.lastX = only.x;
      cam.lastY = only.y;
    }
    const primary = event.touches[0];
    if (primary) markZone(primary.clientX, primary.clientY);
  }, { passive: false });
  const endTouch = (event) => {
    stop(event);
    touches.clear();
    [...event.touches].forEach((touch) => touches.set(touch.identifier, { x: touch.clientX, y: touch.clientY }));
    if (touches.size === 1) {
      const only = [...touches.values()][0];
      cam.lastX = only.x;
      cam.lastY = only.y;
    }
    if (touches.size < 2 && pointers.size < 2) pinchPrev = 0;
  };
  pad.addEventListener('touchend', endTouch, { passive: false });
  pad.addEventListener('touchcancel', endTouch, { passive: false });

  let simTime = 0;
  function frame(dt) {
    const time = clockTime(dt);
    simTime = time;
    const drift = reduce ? 0.15 : 1;
    sky.rotation.y += dt * 0.006 * drift;
    galaxy.rotation.y += dt * 0.004 * drift;
    nebula.rotation.y -= dt * 0.003 * drift;
    if (nebula.material.uniforms) nebula.material.uniforms.uTime.value = time;
    farStars.rotation.y += dt * 0.004 * drift;
    nearStars.rotation.y += dt * 0.02 * drift;
    farStars.material.uniforms.uTime.value = time;
    nearStars.material.uniforms.uTime.value = time;
    bodies.forEach((body) => { body.ejecta.material.uniforms.uTime.value = time; });
    const speed = Math.abs(cam.dist - cam.target);
    farStars.material.uniforms.uSpeed.value = reduce ? 0 : Math.min(1.2, speed * 0.8);
    nearStars.material.uniforms.uSpeed.value = reduce ? 0 : Math.min(1.6, speed * 1.4);
    const keySpeed = cam.dist * 0.55 * dt;
    const limit = Math.max(12, mapExtent * 4);
    if (keys.a) pan.x -= keySpeed;
    if (keys.d) pan.x += keySpeed;
    if (keys.w) pan.z -= keySpeed;
    if (keys.s) pan.z += keySpeed;
    pan.x = Math.max(-limit, Math.min(limit, pan.x));
    pan.z = Math.max(-limit, Math.min(limit, pan.z));
    cam.dist += (cam.target - cam.dist) * (1 - Math.pow(0.001, Math.max(0.016, dt)));
    camera.up.set(0, 0, -1);
    camera.position.set(pan.x, cam.dist, pan.z);
    camera.lookAt(pan.x, 0, pan.z);
    const hiddenPlates = !!window.__hidePlates;
    const drawn = placement();
    plateBank.sync(drawn, hiddenPlates);
    if (mode === 'system' && sys && sys.count > 0) {
      const scale = layoutScale(sys, mapExtent);
      drawn.forEach((p, i) => {
        const body = bodies[i];
        if (!body || !body.spec) return;
        body.group.position.set(p.x, 0, p.z);
        body.group.scale.setScalar(Math.max(1e-4, p.r));
        body.group.visible = showBody && !plateBank.slots[i].ready && !hiddenPlates;
      });
      const centers = pathCenters(sys, turnsNow());
      centers.forEach((c, i) => {
        if (!pathLines[i]) return;
        pathLines[i].position.set(c.x, 0, c.z);
        const open = sys.count > 1 && (!sys.outerAU || i < 2) ? scale : 1;
        pathLines[i].scale.set(open, 1, open);
      });
    }
    movePlanets(time);
    pose();
    bodies.forEach((body, index) => {
      if (!body.spec) return;
      if (mode === 'focus' && index === 0) body.group.visible = showBody && !plateBank.slots[0].ready && !hiddenPlates;
      if (!body.group.visible && !(mode === 'focus' && index === 0)) return;
      const spec = body.spec;
      const type = starType(spec.type);
      const shown = showBody;
      body.spin += dt * (reduce ? 0.05 : 1.15) * (1 + 4 / Math.max(0.4, spec.rotation || 25));
      body.group.rotation.y = body.spin;
      body.flareIn -= dt;
      if (body.flareIn <= 0 && !reduce && shown) {
        body.flare = 1;
        body.flareIn = (14 / Math.max(0.2, type.flare)) / (0.25 + (spec.activity || 0) * 1.5);
        if ((spec.activity || 0) * type.flare > 1.4 && onFlare.fn) onFlare.fn();
      }
      body.flare = Math.max(0, body.flare - dt * (0.35 + (spec.activity || 0)));
      body.star.material.uniforms.uTime.value = time;
      body.star.material.uniforms.uCam.value.copy(camera.position);
      body.star.material.uniforms.uActivity.value = spec.activity || 0;
      body.star.material.uniforms.uRot.value = body.spin;
      body.star.material.uniforms.uFlare.value = body.flare;
      body.star.visible = shown && type.kind !== 'bh';
      if (body.shadow) body.shadow.visible = shown && type.kind === 'bh';
      body.corona.visible = shown && type.kind !== 'bh';
      body.loops.visible = shown && type.kind !== 'bh' && type.kind !== 'ns' && type.kind !== 'wd';
      body.disk.visible = shown && type.kind === 'bh';
      body.lens.visible = shown && type.kind === 'bh';
      body.beams.visible = shown && type.kind === 'ns';
      const breathe = 2.8 + (spec.activity || 0) * 1.1 + body.flare * 1.8;
      body.corona.scale.setScalar(type.kind === 'ns' ? 2.4 : type.kind === 'wd' ? 2.1 : breathe);
      body.corona.material.opacity = type.kind === 'bh' ? 0.22 : 0.55 + body.flare * 0.4;
      body.loops.children.forEach((loop, i) => {
        const base = i === 0 ? 0.55 : 0.15;
        const rise = base + Math.max(0, (spec.activity || 0) - 0.15) * 1.1;
        const pulse = 0.7 + 0.2 * Math.sin(time * 0.7 + i) + body.flare * (i === 0 ? 0.45 : 0.15);
        loop.material.opacity = shown ? Math.min(0.72, rise * pulse) : 0;
        loop.scale.setScalar(1 + 0.08 * Math.sin(time * 0.6 + i) + body.flare * 0.15);
      });
      const mag = Number(spec.magnetic) || 0;
      body.beams.rotation.y += dt * (type.kind === 'ns' ? 0.8 + Math.max(0, mag - 11) * 0.45 : 0.05);
      if (body.disk.material.uniforms) {
        body.disk.material.uniforms.uTime.value = time;
        body.disk.material.uniforms.uCam.value.copy(camera.position);
      }
      body.disk.rotation.z += dt * (0.35 + Math.max(0, Number(spec.spin) || 0) * 1.6);
      body.lens.rotation.z += dt * 0.05;
      const cme = shown && body.flare > 0.35 && (spec.activity || 0) > 0.4;
      body.ejecta.visible = cme;
      body.ejecta.scale.setScalar(1.2 + (1 - body.flare) * 4.5);
      body.ejecta.position.y = 1.1 + (1 - body.flare) * 1.8;
    });
    window.__spin = bodies[0].group.rotation.y;
    tickPreviews(dt, time);
    if (quality === 'high' && composer) composer.render();
    else renderer.render(scene, camera);
  }

  function makeStarMat() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color('#fff4ea') },
        uCam: { value: new THREE.Vector3(0, 0, 12) },
        uTime: { value: 0 },
        uActivity: { value: 0.4 },
        uRot: { value: 0 },
        uFlare: { value: 0 },
        uKind: { value: 0 }
      },
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG
    });
  }
  const previewScene = new THREE.Scene();
  const cols = 4;
  const rows = 3;
  const gap = 4;
  const pix = 96;
  const previewCam = new THREE.OrthographicCamera(0, cols * gap, 0, -rows * gap, 0.1, 40);
  previewCam.position.set(0, 0, 12);
  previewCam.lookAt(0, 0, 0);
  const atlasRT = new THREE.WebGLRenderTarget(cols * pix, rows * pix);
  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = cols * pix;
  atlasCanvas.height = rows * pix;
  const atlasCtx = atlasCanvas.getContext('2d', { willReadFrequently: true });
  const minis = STAR_TYPES.map((type, i) => {
    const group = new THREE.Group();
    const mat = makeStarMat();
    mat.uniforms.uColor.value.set(type.color);
    mat.uniforms.uKind.value = type.kind === 'bh' ? 2 : type.kind === 'ns' ? 1 : 0;
    mat.uniforms.uActivity.value = type.id === 'm' ? 0.75 : 0.45;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(type.kind === 'bh' ? 0.34 : type.kind === 'giant' ? 1.15 : type.kind === 'wd' ? 0.42 : type.kind === 'ns' ? 0.28 : 0.82, 28, 20), mat);
    mesh.visible = type.kind !== 'bh';
    group.add(mesh);
    if (type.kind === 'bh') {
      const disk = new THREE.Mesh(new THREE.CircleGeometry(1.45, 56), new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3(0, 0, 12) }, uSpin: { value: 0.7 } },
        vertexShader: DISK_VERT,
        fragmentShader: DISK_FRAG,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      }));
      disk.rotation.x = 1.05;
      const hole = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 14), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.018, 8, 36), new THREE.MeshBasicMaterial({ color: 0xfff1cc }));
      ring.rotation.x = 1.05;
      group.add(disk, hole, ring);
    }
    if (type.kind === 'ns') {
      const beam = new THREE.Mesh(new THREE.ConeGeometry(0.06, 1.7, 8, 1, true), new THREE.MeshBasicMaterial({
        color: 0xd7e8ff, transparent: true, opacity: 0.85, side: THREE.DoubleSide
      }));
      group.add(beam);
    }
    group.position.set((i % cols + 0.5) * gap, -(Math.floor(i / cols) + 0.5) * gap, 0);
    previewScene.add(group);
    return { group, mat };
  });
  let previewCards = [];
  let previewTick = 0;
  function tickPreviews(dt, time) {
    minis.forEach((m) => {
      m.group.rotation.y += dt * (reduce ? 0.05 : 0.55);
      m.group.traverse((obj) => {
        if (obj.material && obj.material.uniforms && obj.material.uniforms.uTime) obj.material.uniforms.uTime.value = time;
      });
    });
    if (!previewCards.length) return;
    previewTick += 1;
    if (previewTick % (coarse ? 4 : 3) !== 0) return;
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(atlasRT);
    renderer.clear();
    renderer.render(previewScene, previewCam);
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x000000, 1);
    try {
      const w = atlasRT.width;
      const h = atlasRT.height;
      const buf = new Uint8Array(w * h * 4);
      renderer.readRenderTargetPixels(atlasRT, 0, 0, w, h, buf);
      const img = atlasCtx.createImageData(w, h);
      for (let y = 0; y < h; y++) {
        const src = (h - 1 - y) * w * 4;
        img.data.set(buf.subarray(src, src + w * 4), y * w * 4);
      }
      atlasCtx.putImageData(img, 0, 0);
      previewCards.forEach((canvas, i) => {
        const ctx = canvas.getContext('2d');
        const col = i % cols;
        const row = Math.floor(i / cols);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(atlasCanvas, col * pix, row * pix, pix, pix, 0, 0, canvas.width, canvas.height);
      });
    } catch (err) { /* a blocked readback leaves the hero star turning */ }
  }
  function bindPreviews(canvases) { previewCards = canvases || []; }

  let tAccum = 0;
  function clockTime(dt) {
    if (dt) tAccum += dt;
    return tAccum;
  }

  window.addEventListener('keydown', (event) => {
    if (event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA')) return;
    const key = event.key.toLowerCase();
    if (key in keys) { keys[key] = true; event.preventDefault(); }
  });
  window.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    if (key in keys) keys[key] = false;
  });

  applySize();
  return {
    frame,
    setStar,
    setSystem,
    setPaths,
    primePlates: () => plateBank.prime(),
    bindPreviews,
    zoomBy,
    resize: applySize,
    distance: () => cam.dist,
    pose,
    onFlare: (fn) => { onFlare.fn = fn; }
  };
}
