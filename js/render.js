/* Cinematic view. Procedural Milky Way, lit planets, a Rayleigh limb,
   bloom, god rays, film grain and vignette. Low quality skips the heavy passes. */
import * as THREE from '../vendor/three/three.module.min.js';
import { EffectComposer } from '../vendor/three/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/three/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from '../vendor/three/postprocessing/ShaderPass.js';
import { OutputPass } from '../vendor/three/postprocessing/OutputPass.js';
import { starRGB } from './sim.js';

const PLANET_VERT = `
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const PLANET_FRAG = `
  varying vec3 vN;
  varying vec3 vW;
  uniform vec3 uSunPos;
  uniform vec3 uCam;
  uniform vec3 uSunColor;
  uniform float uTime;
  uniform float uWater;
  uniform float uIce;
  uniform float uVeg;
  uniform float uLava;
  uniform float uCities;
  uniform float uSeed;
  uniform float uLocked;
  uniform float uFlux;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z
    );
  }
  void main() {
    vec3 n = normalize(vN);
    vec3 sunDir = normalize(uSunPos - vW);
    float ndl = dot(n, sunDir);
    float day = smoothstep(-0.06, 0.28, ndl);
    float nse = noise(n * 3.4 + uSeed);
    vec3 rock = mix(vec3(0.42, 0.32, 0.24), vec3(0.28, 0.22, 0.18), nse);
    vec3 green = vec3(0.16, 0.32, 0.14);
    rock = mix(rock, green, uVeg * smoothstep(0.35, 0.7, nse));
    float shore = smoothstep(0.12, 0.5, uWater) * (1.0 - uIce * 0.85);
    vec3 ocean = vec3(0.02, 0.07, 0.11);
    vec3 base = mix(rock, ocean, shore);
    float face = dot(n, sunDir);
    if (uLocked > 0.5) {
      float hot = smoothstep(0.05, 0.8, face);
      float cold = smoothstep(0.05, -0.72, face);
      float band = smoothstep(-0.05, 0.28, face) * smoothstep(0.72, 0.18, face);
      base = mix(base, vec3(0.42, 0.16, 0.07), hot * 0.8);
      base = mix(base, vec3(0.78, 0.84, 0.9), cold);
      shore *= band;
      base = mix(base, ocean, shore * 0.85);
    } else {
      float lat = abs(n.y);
      base = mix(base, vec3(0.86, 0.9, 0.95), uIce * smoothstep(0.35, 0.85, lat + nse * 0.2));
    }
    if (uLava > 0.02) base = mix(base, vec3(0.45, 0.08, 0.02), uLava);
    vec3 V = normalize(uCam - vW);
    vec3 H = normalize(sunDir + V);
    float spec = pow(max(dot(n, H), 0.0), 90.0) * shore * day;
    float fall = clamp(uFlux, 0.18, 2.4);
    vec3 lit = base * (0.035 + 0.96 * day) * uSunColor * fall + spec * uSunColor * fall;
    float cities = uCities * (1.0 - day) * smoothstep(0.55, 0.85, hash(vec3(floor(n.x * 28.0), floor(n.y * 28.0), floor(n.z * 28.0))));
    lit += vec3(1.0, 0.78, 0.45) * cities;
    lit += vec3(1.0, 0.28, 0.05) * uLava * (0.35 + 0.65 * day);
    gl_FragColor = vec4(lit, 1.0);
  }
`;

const CLOUD_FRAG = `
  varying vec3 vN;
  varying vec3 vW;
  uniform vec3 uSunPos;
  uniform float uTime;
  uniform float uCloud;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i+vec3(1.0,0.0,0.0)), f.x), mix(hash(i+vec3(0.0,1.0,0.0)), hash(i+vec3(1.0,1.0,0.0)), f.x), f.y),
               mix(mix(hash(i+vec3(0.0,0.0,1.0)), hash(i+vec3(1.0,0.0,1.0)), f.x), mix(hash(i+vec3(0.0,1.0,1.0)), hash(i+vec3(1.0,1.0,1.0)), f.x), f.y), f.z);
  }
  void main() {
    vec3 n = normalize(vN);
    float wobble = noise(n * 4.0 + vec3(uTime * 0.015, 0.0, 0.0));
    float a = smoothstep(0.42, 0.72, wobble) * uCloud;
    float day = smoothstep(-0.1, 0.4, dot(n, normalize(uSunPos - vW)));
    vec3 col = vec3(1.0) * (0.25 + 0.75 * day);
    gl_FragColor = vec4(col, a * 0.72);
  }
`;

const ATMO_FRAG = `
  varying vec3 vN;
  varying vec3 vW;
  uniform vec3 uSunPos;
  uniform vec3 uCam;
  uniform vec3 uScatter;
  void main() {
    vec3 n = normalize(vN);
    vec3 V = normalize(uCam - vW);
    float fres = pow(1.0 - abs(dot(n, V)), 2.4);
    float day = smoothstep(-0.2, 0.55, dot(n, normalize(uSunPos - vW)));
    vec3 col = uScatter * fres * (0.25 + day);
    gl_FragColor = vec4(col, fres * (0.35 + 0.7 * day));
  }
`;

const SKY_FRAG = `
  varying vec3 vPos;
  uniform vec3 uNebula;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i+vec3(1.0,0.0,0.0)), f.x), mix(hash(i+vec3(0.0,1.0,0.0)), hash(i+vec3(1.0,1.0,0.0)), f.x), f.y),
               mix(mix(hash(i+vec3(0.0,0.0,1.0)), hash(i+vec3(1.0,0.0,1.0)), f.x), mix(hash(i+vec3(0.0,1.0,1.0)), hash(i+vec3(1.0,1.0,1.0)), f.x), f.y), f.z);
  }
  void main() {
    vec3 d = normalize(vPos);
    float band = exp(-pow(abs(d.y) * 3.2, 1.35));
    float dust = noise(d * 3.0) * noise(d * 7.0);
    vec3 milk = vec3(0.55, 0.52, 0.48) * band * (0.18 + dust * 0.9);
    float stars = step(0.992, hash(floor(d * 220.0)));
    vec3 col = milk + vec3(0.85, 0.9, 1.0) * stars;
    float neb = noise(d * 1.7 + 2.0);
    col += uNebula * smoothstep(0.48, 0.82, neb) * 0.7;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const SKY_VERT = `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

function flareTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,214,170,0.75)');
  grd.addColorStop(0.45, 'rgba(255,120,40,0.18)');
  grd.addColorStop(1, 'rgba(255,80,20,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePlanetMaterial(seed) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunPos: { value: new THREE.Vector3(40, 20, 10) },
      uCam: { value: new THREE.Vector3() },
      uSunColor: { value: new THREE.Color(1, 0.95, 0.9) },
      uTime: { value: 0 },
      uWater: { value: 0.4 },
      uIce: { value: 0.1 },
      uVeg: { value: 0 },
      uLava: { value: 0 },
      uCities: { value: 0 },
      uSeed: { value: seed || 0 },
      uLocked: { value: 0 },
      uFlux: { value: 1 }
    },
    vertexShader: PLANET_VERT,
    fragmentShader: PLANET_FRAG
  });
}

function paintPlanet(mat, look, sunPos, sunColor, cam, time, seed) {
  mat.uniforms.uSunPos.value.copy(sunPos);
  mat.uniforms.uCam.value.copy(cam);
  mat.uniforms.uSunColor.value.copy(sunColor);
  mat.uniforms.uTime.value = time;
  mat.uniforms.uWater.value = look.ocean;
  mat.uniforms.uIce.value = look.ice;
  mat.uniforms.uVeg.value = look.veg;
  mat.uniforms.uLava.value = look.lava;
  mat.uniforms.uCities.value = look.cities || 0;
  if (seed != null) mat.uniforms.uSeed.value = seed;
}

function buildStation() {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa8b0, metalness: 0.72, roughness: 0.32 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a2228, metalness: 0.5, roughness: 0.45 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x8fb4c8, metalness: 0.1, roughness: 0.08, emissive: 0x123040, emissiveIntensity: 0.4 });
  const hot = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.72, 0.22) });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.13, 16, 64), metal);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.7, 20), dark);
  g.add(hub);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), glass);
  dome.position.y = 0.42;
  g.add(dome);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.15, 8), metal);
    spoke.rotation.z = Math.PI / 2;
    spoke.rotation.y = a;
    spoke.position.set(Math.cos(a) * 0.78, 0, Math.sin(a) * 0.78);
    spoke.lookAt(Math.cos(a) * 2, 0, Math.sin(a) * 2);
    spoke.rotateX(Math.PI / 2);
    g.add(spoke);
    const pod = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), dark);
    pod.position.set(Math.cos(a) * 1.55, 0, Math.sin(a) * 1.55);
    g.add(pod);
    const lamp = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 20), hot);
    lamp.position.copy(pod.position);
    lamp.lookAt(0, 0, 0);
    g.add(lamp);
  }
  const arm = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const mod = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.55, 12), i % 2 ? metal : dark);
    mod.rotation.z = Math.PI / 2;
    mod.position.x = 2.15 + i * 0.62;
    arm.add(mod);
    const joint = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 8, 16), hot);
    joint.position.x = 2.15 + i * 0.62 + 0.28;
    joint.rotation.y = Math.PI / 2;
    arm.add(joint);
  }
  g.add(arm);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 8), metal);
  mast.position.y = 1.05;
  g.add(mast);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 10, 0, Math.PI * 2, 0, 1.2), metal);
  dish.position.y = 1.7;
  g.add(dish);
  const tether = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.8, 6), hot);
  tether.position.y = -1.15;
  g.add(tether);
  const accent = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.008, 6, 80), hot);
  accent.rotation.x = Math.PI / 2.4;
  g.add(accent);
  const gate = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 12, 48), new THREE.MeshBasicMaterial({ color: 0xE03A3A }));
  gate.position.set(-1.35, 0.15, 1.15);
  const gateInner = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.012, 8, 40), new THREE.MeshBasicMaterial({ color: 0xEEEDE7 }));
  gateInner.position.copy(gate.position);
  g.add(gate, gateInner);
  const markTex = new THREE.TextureLoader().load('assets/brand/savageplanets-mark.png');
  markTex.colorSpace = THREE.SRGBColorSpace;
  const billboard = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({
    map: markTex, transparent: true, depthWrite: false
  }));
  billboard.position.set(-1.35, 0.85, 1.15);
  g.add(billboard);
  return g;
}

function panelMap() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#9aa3aa';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#2c3338';
  ctx.lineWidth = 4;
  for (let y = 18; y < 256; y += 36) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  for (let x = 22; x < 256; x += 52) {
    ctx.beginPath();
    ctx.moveTo(x, 8);
    ctx.lineTo(x, 248);
    ctx.stroke();
  }
  ctx.fillStyle = '#d7b56a';
  ctx.fillRect(40, 70, 36, 18);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const SUIT_PANELS = panelMap();

function buildLyra() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.6, 0.72, 0.28),
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.22, 6, 16), mat);
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 16), mat);
  head.position.y = 0.24;
  g.add(head);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.006, 8, 40), mat);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const ring2 = ring.clone();
  ring2.scale.setScalar(1.35);
  ring2.rotation.y = 0.6;
  g.add(ring2);
  g.position.set(1.1, 0.35, 0.8);
  return g;
}

function buildShip(design, sailOn) {
  const g = new THREE.Group();
  const foil = new THREE.MeshPhysicalMaterial({
    color: 0xd7b56a, metalness: 0.82, roughness: 0.28, clearcoat: 0.45, clearcoatRoughness: 0.35, envMapIntensity: 1.1
  });
  const white = new THREE.MeshPhysicalMaterial({
    color: 0xe7e4dc, metalness: 0.62, roughness: 0.32, clearcoat: 0.3, envMapIntensity: 0.9,
    bumpMap: SUIT_PANELS, bumpScale: 0.002
  });
  const truss = new THREE.MeshStandardMaterial({ color: 0xb7c0c6, metalness: 0.86, roughness: 0.28 });
  const solar = new THREE.MeshPhysicalMaterial({
    color: 0x16356f, metalness: 0.55, roughness: 0.18, emissive: 0x071833, emissiveIntensity: 0.55,
    clearcoat: 0.6, clearcoatRoughness: 0.15
  });
  const hullPts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    let r = 0.042;
    if (t < 0.16) r = 0.006 + (t / 0.16) * 0.036;
    else if (t > 0.78) r = 0.042 - ((t - 0.78) / 0.22) * 0.018;
    hullPts.push(new THREE.Vector2(r, (t - 0.5) * 0.32));
  }
  const bus = new THREE.Mesh(new THREE.LatheGeometry(hullPts, 40), foil);
  bus.rotation.z = Math.PI / 2;
  bus.castShadow = true;
  g.add(bus);
  const cabin = new THREE.Mesh(new THREE.SphereGeometry(0.018, 24, 18), white);
  cabin.scale.set(1.4, 0.85, 1);
  cabin.position.set(0.02, 0.012, 0);
  g.add(cabin);
  const cupola = new THREE.Mesh(new THREE.SphereGeometry(0.01, 20, 14), new THREE.MeshPhysicalMaterial({
    color: 0x9ecfff, metalness: 0.05, roughness: 0.04, transmission: 0.72, thickness: 0.01, transparent: true, opacity: 0.9
  }));
  cupola.position.set(0.028, 0.02, 0);
  g.add(cupola);
  for (let i = -1; i <= 1; i += 2) {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.0014, 0.0014, 0.16, 8), truss);
    beam.rotation.z = Math.PI / 2;
    beam.position.set(-0.01, i * 0.016, 0);
    const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0011, 0.03, 6), truss);
    cross.position.set(-0.01, i * 0.016, 0);
    g.add(beam, cross);
  }
  [-1, 1].forEach((side) => {
    const array = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.07), solar);
    array.position.set(-0.01, 0.02, side * 0.13);
    g.add(array);
    const spar = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.05, 8), truss);
    spar.rotation.x = Math.PI / 2;
    spar.position.set(-0.01, 0.01, side * 0.04);
    g.add(spar);
    const rad = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.028), white);
    rad.position.set(-0.04, side * 0.055, 0);
    g.add(rad);
  });
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.2), new THREE.MeshPhysicalMaterial({
    color: 0xf4f0e4, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.62,
    side: THREE.DoubleSide, iridescence: 0.4, iridescenceIOR: 1.3
  }));
  sail.position.set(0.01, 0, 0);
  sail.visible = !!sailOn;
  g.add(sail);
  g.userData.sail = sail;
  const bellPts = [0.006, 0.008, 0.011, 0.016, 0.02].map((r, i) => new THREE.Vector2(r, -0.055 - i * 0.008));
  const bell = new THREE.Mesh(new THREE.LatheGeometry(bellPts, 24), truss);
  bell.rotation.z = -Math.PI / 2;
  g.add(bell);
  const plumeMat = new THREE.MeshBasicMaterial({
    color: 0xffb15a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.12, 28), plumeMat);
  plume.rotation.z = Math.PI / 2;
  plume.position.x = -0.11;
  g.add(plume);
  g.userData.plume = plume;
  g.userData.rcs = [];
  [[0.03, 0.02, 0.02], [0.03, -0.02, -0.02], [-0.03, 0.02, -0.02], [-0.03, -0.02, 0.02]].forEach((p) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 10, 8), new THREE.MeshBasicMaterial({
      color: 0xd5e6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    puff.position.set(p[0], p[1], p[2]);
    g.add(puff);
    g.userData.rcs.push(puff);
  });
  g.scale.setScalar(design && design.hull === 'hauler' ? 7.2 : 6.2);
  return g;
}

function makeTextSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false
  }));
  spr.userData.canvas = canvas;
  spr.userData.last = '';
  setTextSprite(spr, text);
  return spr;
}

function setTextSprite(spr, text) {
  if (!spr || spr.userData.last === text) return;
  spr.userData.last = text;
  const canvas = spr.userData.canvas;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(24, 48, 464, 150);
  ctx.fillStyle = '#f3f0e8';
  ctx.textAlign = 'center';
  ctx.font = '44px sans-serif';
  String(text).split('\n').forEach((line, i) => ctx.fillText(line, 256, 110 + i * 52));
  spr.material.map.needsUpdate = true;
}

function buildStarfield(count) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const z = Math.random() * 2 - 1;
    const t = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.max(0, 1 - z * z)) * 260;
    pos[i * 3] = Math.cos(t) * r;
    pos[i * 3 + 1] = z * 260;
    pos[i * 3 + 2] = Math.sin(t) * r;
    const m = 0.55 + Math.random() * 0.45;
    col[i * 3] = m;
    col[i * 3 + 1] = m * (0.9 + Math.random() * 0.1);
    col[i * 3 + 2] = m;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    size: 1.15, sizeAttenuation: true, map: flareTexture(), transparent: true,
    depthWrite: false, vertexColors: true, opacity: 0.95
  }));
}

function buildLander() {
  const g = new THREE.Group();
  const hull = new THREE.MeshPhysicalMaterial({
    color: 0xd9d4cc, metalness: 0.55, roughness: 0.38, clearcoat: 0.25, bumpMap: SUIT_PANELS, bumpScale: 0.004
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2c3338, metalness: 0.7, roughness: 0.35 });
  const stage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.42, 28), hull);
  stage.position.y = 0.55;
  g.add(stage);
  const cabinPts = [0.22, 0.38, 0.46, 0.42, 0.28, 0.12].map((r, i) => new THREE.Vector2(r, 0.85 + i * 0.16));
  const cabin = new THREE.Mesh(new THREE.LatheGeometry(cabinPts, 28), hull);
  g.add(cabin);
  const port = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), new THREE.MeshPhysicalMaterial({
    color: 0xb9d7ff, metalness: 0.05, roughness: 0.05, transmission: 0.55, thickness: 0.05, transparent: true, opacity: 0.9
  }));
  port.position.set(0, 1.35, 0.36);
  g.add(port);
  for (let i = 0; i < 4; i++) {
    const ang = i * Math.PI / 2 + 0.4;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.15, 12), dark);
    leg.position.set(Math.cos(ang) * 0.85, 0.42, Math.sin(ang) * 0.85);
    leg.rotation.z = Math.cos(ang) * 0.35;
    leg.rotation.x = -Math.sin(ang) * 0.35;
    g.add(leg);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.05, 16), dark);
    pad.position.set(Math.cos(ang) * 1.25, 0.04, Math.sin(ang) * 1.25);
    g.add(pad);
  }
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 12, 0, Math.PI * 2, 0, 1.15), dark);
  dish.position.set(-0.15, 1.85, -0.2);
  g.add(dish);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.45, 0.12) }));
  glow.position.set(0, 0.4, -0.7);
  g.add(glow);
  return g;
}

function buildDrone() {
  const g = new THREE.Group();
  const shell = new THREE.MeshPhysicalMaterial({ color: 0xd5dbe2, metalness: 0.7, roughness: 0.28, clearcoat: 0.4 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), shell);
  body.scale.set(1.3, 0.45, 1);
  g.add(body);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
  eye.position.set(0, 0.06, 0.18);
  g.add(eye);
  for (let i = 0; i < 4; i++) {
    const ang = i * Math.PI / 2 + 0.4;
    const rotor = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.008, 8, 20), new THREE.MeshStandardMaterial({
      color: 0x8fd0ff, metalness: 0.4, roughness: 0.3, emissive: 0x123044, emissiveIntensity: 0.4
    }));
    rotor.rotation.x = Math.PI / 2;
    rotor.position.set(Math.cos(ang) * 0.36, 0.08, Math.sin(ang) * 0.28);
    g.add(rotor);
  }
  return g;
}

function limb(length, radius, material, cuffMat) {
  const pivot = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 8, 16), material);
  mesh.position.y = -length * 0.55;
  mesh.castShadow = true;
  pivot.add(mesh);
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.25, radius * 0.22, 8, 18), cuffMat);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.y = -length * 0.15;
  pivot.add(cuff);
  return pivot;
}

function buildAstronaut() {
  const g = new THREE.Group();
  const suit = new THREE.MeshPhysicalMaterial({
    color: 0xd5dee6, metalness: 0.28, roughness: 0.4, clearcoat: 0.4, clearcoatRoughness: 0.35,
    bumpMap: SUIT_PANELS, bumpScale: 0.008
  });
  const cloth = new THREE.MeshPhysicalMaterial({
    color: 0xc5ced6, metalness: 0.18, roughness: 0.5, clearcoat: 0.2, bumpMap: SUIT_PANELS, bumpScale: 0.006
  });
  const gold = new THREE.MeshPhysicalMaterial({
    color: 0xc6a15a, metalness: 1, roughness: 0.16, emissive: 0x3a2a10, emissiveIntensity: 0.2
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x8eb7ea, metalness: 0.15, roughness: 0.04, transmission: 0.72, thickness: 0.06, transparent: true, opacity: 0.92
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x242b31, metalness: 0.72, roughness: 0.32 });

  const hips = new THREE.Group();
  hips.position.y = 0.64;
  g.add(hips);
  hips.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 22, 16), suit));

  const spine = new THREE.Group();
  spine.position.y = 0.12;
  hips.add(spine);
  const torsoPts = [0.15, 0.18, 0.2, 0.205, 0.19, 0.16, 0.13].map((r, i) => new THREE.Vector2(r, i * 0.075));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(torsoPts, 28), suit);
  torso.castShadow = true;
  spine.add(torso);
  const chest = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.02, 10, 28), dark);
  chest.rotation.x = Math.PI / 2;
  chest.position.y = 0.28;
  spine.add(chest);

  const neck = new THREE.Group();
  neck.position.y = 0.5;
  spine.add(neck);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.155, 32, 24), suit);
  helmet.scale.set(1, 1.06, 1.05);
  neck.add(helmet);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.118, 28, 18, 0, Math.PI * 2, 0.2, 1.2), glass);
  visor.position.set(0, 0.01, 0.05);
  neck.add(visor);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.012, 8, 28), gold);
  rim.position.set(0, 0.015, 0.09);
  neck.add(rim);

  const shoulderL = limb(0.24, 0.055, cloth, dark);
  shoulderL.position.set(-0.22, 0.4, 0);
  spine.add(shoulderL);
  const elbowL = limb(0.22, 0.045, cloth, dark);
  elbowL.position.y = -0.26;
  shoulderL.add(elbowL);
  const shoulderR = limb(0.24, 0.055, cloth, dark);
  shoulderR.position.set(0.22, 0.4, 0);
  spine.add(shoulderR);
  const elbowR = limb(0.22, 0.045, cloth, dark);
  elbowR.position.y = -0.26;
  shoulderR.add(elbowR);

  const hipL = limb(0.28, 0.07, cloth, dark);
  hipL.position.set(-0.1, -0.05, 0);
  hips.add(hipL);
  const kneeL = limb(0.26, 0.055, cloth, dark);
  kneeL.position.y = -0.3;
  hipL.add(kneeL);
  const hipR = limb(0.28, 0.07, cloth, dark);
  hipR.position.set(0.1, -0.05, 0);
  hips.add(hipR);
  const kneeR = limb(0.26, 0.055, cloth, dark);
  kneeR.position.y = -0.3;
  hipR.add(kneeR);

  const packPts = [0.08, 0.12, 0.13, 0.11].map((r, i) => new THREE.Vector2(r, i * 0.09));
  const pack = new THREE.Mesh(new THREE.LatheGeometry(packPts, 16), suit);
  pack.position.set(0, 0.22, -0.18);
  spine.add(pack);
  const hose = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 8, 20, Math.PI), dark);
  hose.position.set(0.1, 0.42, -0.05);
  hose.rotation.y = 0.8;
  spine.add(hose);

  const crest = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 8, 20), new THREE.MeshBasicMaterial({ color: 0xe25b1a }));
  crest.position.set(0, 0.3, 0.16);
  spine.add(crest);

  const jetL = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 12), new THREE.MeshBasicMaterial({
    color: 0xffb15a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  jetL.position.set(-0.08, 0.12, -0.2);
  jetL.rotation.x = Math.PI;
  const jetR = jetL.clone();
  jetR.position.x = 0.08;
  spine.add(jetL, jetR);

  g.userData.rig = { hips, spine, neck, shoulderL, elbowL, shoulderR, elbowR, hipL, kneeL, hipR, kneeR };
  g.userData.suitMat = suit;
  g.userData.crest = crest;
  g.userData.jets = [jetL, jetR];
  g.scale.setScalar(1.35);
  return g;
}

function poseAstronaut(astro, t, moving, jet) {
  const r = astro.userData.rig;
  if (!r) return;
  const step = moving ? Math.sin(t * 7.5) : Math.sin(t * 1.3) * 0.15;
  const amp = moving ? 0.65 : 0.12;
  r.hipL.rotation.x = step * amp;
  r.hipR.rotation.x = -step * amp;
  r.kneeL.rotation.x = Math.max(0, -step) * amp * 0.9;
  r.kneeR.rotation.x = Math.max(0, step) * amp * 0.9;
  r.shoulderL.rotation.x = -step * amp * 0.7;
  r.shoulderR.rotation.x = step * amp * 0.7;
  r.elbowL.rotation.x = jet ? -0.2 : -0.45;
  r.elbowR.rotation.x = jet ? -0.2 : -0.45;
  r.spine.rotation.x = jet ? 0.45 : (moving ? 0.12 : 0.02);
  r.neck.rotation.y = Math.sin(t * 0.6) * 0.12;
  const glow = jet ? 0.85 : 0;
  (astro.userData.jets || []).forEach((m) => { m.material.opacity = glow; });
}

function buildBeacon() {
  const g = new THREE.Group();
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.4, 12), new THREE.MeshStandardMaterial({
    color: 0xd7b56a, metalness: 0.7, roughness: 0.3
  }));
  mast.position.y = 0.7;
  g.add(mast);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.7, 0.25) }));
  lamp.position.y = 1.45;
  g.add(lamp);
  g.userData.lamp = lamp;
  g.visible = false;
  return g;
}

export function createView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.02, 800);
  camera.position.set(8, 3, 12);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uNebula: { value: new THREE.Color(0.35, 0.12, 0.05) } },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG
  }));
  scene.add(sky);
  const stars = buildStarfield(1600);
  scene.add(stars);
  const nebula = new THREE.Group();
  const blob = flareTexture();
  [[40, 8, -30, 0x553322, 18], [-24, -6, 36, 0x223355, 22], [10, 14, 48, 0x6a2030, 16]].forEach((n) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: blob, color: n[3], transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    s.position.set(n[0], n[1], n[2]);
    s.scale.set(n[4], n[4], 1);
    nebula.add(s);
  });
  scene.add(nebula);
  const skyLoader = new THREE.TextureLoader();
  skyLoader.load('assets/sky/milkyway.jpg', (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.anisotropy = 8;
    if (sky.material && sky.material.dispose) sky.material.dispose();
    sky.material = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false });
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromEquirectangular(tex).texture;
      pmrem.dispose();
    } catch (err) { /* the photograph still fills the sky */ }
  });

  scene.add(new THREE.AmbientLight(0xc5ced6, 0.55));
  const key = new THREE.DirectionalLight(0xfff4e8, 3.2);
  scene.add(key.target);
  key.position.set(12, 18, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.2;
  key.shadow.camera.far = 80;
  key.shadow.camera.left = -12;
  key.shadow.camera.right = 12;
  key.shadow.camera.top = 12;
  key.shadow.camera.bottom = -12;
  key.shadow.bias = -0.0004;
  scene.add(key);
  scene.add(new THREE.HemisphereLight(0x9eb4d0, 0x1a100c, 0.45));

  const hero = new THREE.Group();
  scene.add(hero);
  const station = buildStation();
  hero.add(station);
  const lyra = buildLyra();
  hero.add(lyra);
  const heroSun = new THREE.Vector3(30, 16, 12);
  const heroColor = new THREE.Color(1.05, 0.9, 0.78);
  const heroPlanet = new THREE.Mesh(new THREE.SphereGeometry(5.6, 64, 48), makePlanetMaterial(2.2));
  heroPlanet.position.set(0.4, -6.15, -0.4);
  hero.add(heroPlanet);
  const heroCloud = new THREE.Mesh(new THREE.SphereGeometry(5.72, 48, 32), new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uSunPos: { value: heroSun.clone() },
      uTime: { value: 0 },
      uCloud: { value: 0.75 }
    },
    vertexShader: PLANET_VERT,
    fragmentShader: CLOUD_FRAG
  }));
  heroCloud.position.copy(heroPlanet.position);
  hero.add(heroCloud);
  const heroAtmo = new THREE.Mesh(new THREE.SphereGeometry(5.95, 48, 32), new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uSunPos: { value: heroSun.clone() },
      uCam: { value: new THREE.Vector3() },
      uScatter: { value: new THREE.Color(0.45, 0.68, 1.15) }
    },
    vertexShader: PLANET_VERT,
    fragmentShader: ATMO_FRAG
  }));
  heroAtmo.position.copy(heroPlanet.position);
  hero.add(heroAtmo);
  paintPlanet(heroPlanet.material, { ocean: 0.62, ice: 0.18, veg: 0.22, lava: 0, cities: 0.15 }, heroSun, heroColor, camera.position, 0, 2);

  const flight = new THREE.Group();
  scene.add(flight);
  const starMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(4, 1.2, 0.4) } },
    vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vN; uniform vec3 uColor; void main(){ float r = pow(1.0 - abs(vN.z), 1.4); gl_FragColor = vec4(uColor * (0.65 + r), 1.0); }`
  }));
  flight.add(starMesh);
  const starGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: flareTexture(),
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    color: new THREE.Color(1, 0.7, 0.4)
  }));
  starGlow.scale.set(3.2, 3.2, 1);
  flight.add(starGlow);
  const disk = new THREE.Mesh(new THREE.RingGeometry(1.35, 4.4, 96), new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(1, 0.42, 0.12) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      varying vec2 vUv; uniform float uTime; uniform vec3 uColor;
      void main() {
        vec2 p = vUv - 0.5;
        float r = length(p) * 2.0;
        float a = smoothstep(0.18, 0.32, r) * smoothstep(1.05, 0.5, r);
        float spin = sin(atan(p.y, p.x) * 7.0 - uTime * 1.6 + r * 14.0);
        float hot = smoothstep(-0.2, 0.85, spin);
        vec3 col = mix(uColor, vec3(1.0, 0.93, 0.75), hot * 0.7);
        gl_FragColor = vec4(col, a * (0.28 + 0.55 * hot));
      }
    `
  }));
  disk.rotation.x = -1.15;
  disk.visible = false;
  flight.add(disk);
  const photon = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.035, 12, 80), new THREE.MeshBasicMaterial({ color: 0xfff3d4 }));
  photon.rotation.x = Math.PI / 2;
  photon.visible = false;
  flight.add(photon);
  const orbits = new THREE.Group();
  flight.add(orbits);
  const planets = new THREE.Group();
  flight.add(planets);
  const shipRoot = new THREE.Group();
  flight.add(shipRoot);
  let shipMesh = buildShip({ hull: 'ring', primary: '#c5d0d8', accent: '#e25b1a' });
  shipRoot.add(shipMesh);
  const plasma = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshBasicMaterial({
    color: new THREE.Color(2.5, 0.7, 0.25),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
  shipRoot.add(plasma);
  const stationMarker = buildStation();
  stationMarker.scale.setScalar(0.05);
  flight.add(stationMarker);
  const marker = new THREE.Sprite(new THREE.SpriteMaterial({
    map: flareTexture(), color: 0xffc14a, blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, opacity: 0.95
  }));
  flight.add(marker);
  const label = makeTextSprite(' ');
  flight.add(label);

  const surface = new THREE.Group();
  scene.add(surface);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(80, 48), makePlanetMaterial(4));
  ground.rotation.x = -Math.PI / 2;
  surface.add(ground);
  const surfCloud = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uSunPos: { value: new THREE.Vector3(0, 40, 20) }, uTime: { value: 0 }, uCloud: { value: 0.3 } },
    vertexShader: PLANET_VERT,
    fragmentShader: CLOUD_FRAG
  }));
  surfCloud.rotation.x = -Math.PI / 2;
  surfCloud.position.y = 8;
  surface.add(surfCloud);
  const lander = buildLander();
  lander.scale.setScalar(1.45);
  surface.add(lander);
  const drone = buildDrone();
  surface.add(drone);
  const astro = buildAstronaut();
  surface.add(astro);
  const beacon = buildBeacon();
  beacon.position.set(2.2, 0, 1.4);
  surface.add(beacon);
  for (let i = 0; i < 7; i++) {
    const geo = new THREE.SphereGeometry(0.55 + (i % 3) * 0.28, 18, 14);
    const pos = geo.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const n = 0.82 + ((i * 17 + v * 3) % 7) * 0.04;
      pos.setXYZ(v, pos.getX(v) * n, pos.getY(v) * (0.7 + (v % 5) * 0.04), pos.getZ(v) * n);
    }
    geo.computeVertexNormals();
    const rock = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.92, metalness: 0.04 }));
    const a = i * 1.3;
    rock.position.set(Math.cos(a) * (8 + i * 2), 0.25, Math.sin(a) * (6 + i));
    surface.add(rock);
  }

  const oneill = new THREE.Group();
  scene.add(oneill);
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 28, 24, 1, true), new THREE.MeshStandardMaterial({
    color: 0xc5b8a4, side: THREE.BackSide, roughness: 0.8, metalness: 0.05
  }));
  oneill.add(cyl);
  const windows = new THREE.Mesh(new THREE.CylinderGeometry(5.7, 5.7, 26, 24, 1, true), new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.6, 0.85, 1.2), side: THREE.BackSide, transparent: true, opacity: 0.18
  }));
  oneill.add(windows);
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(5.95, 5.95, 8, 24, 1, true), new THREE.MeshStandardMaterial({
    color: 0x3d6b3a, side: THREE.BackSide, roughness: 1
  }));
  oneill.add(soil);

  const flares = [];
  const fTex = flareTexture();
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: fTex,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      opacity: 0.0
    }));
    scene.add(s);
    flares.push(s);
  }

  let composer = null;
  let bloom = null;
  let god = null;
  let film = null;
  let quality = 'high';
  let systemKey = '';
  const planetPool = new Map();
  const clock = { t: 0 };
  let failed = false;
  let apiRef = null;

  function buildComposer() {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(canvas.width, canvas.height), 0.2, 0.32, 0.94);
    composer.addPass(bloom);
    god = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uLight: { value: new THREE.Vector2(0.5, 0.62) },
        uOn: { value: 1 }
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform vec2 uLight; uniform float uOn; varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          if (uOn < 0.5) { gl_FragColor = c; return; }
          vec2 delta = (vUv - uLight) / 14.0;
          float illum = 0.0;
          vec2 uv = vUv;
          for (int i = 0; i < 10; i++) {
            uv -= delta;
            float l = dot(texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb, vec3(0.3, 0.59, 0.11));
            illum += smoothstep(0.45, 1.15, l);
          }
          c.rgb += vec3(1.0, 0.86, 0.65) * illum * 0.014;
          gl_FragColor = c;
        }
      `
    });
    composer.addPass(god);
    film = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmount: { value: 0.035 }, uDof: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uTime; uniform float uAmount; uniform float uDof; varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          vec2 px = vec2(0.0016, 0.0022);
          vec3 blur = c.rgb;
          blur += texture2D(tDiffuse, vUv + px * 2.5).rgb;
          blur += texture2D(tDiffuse, vUv - px * 2.5).rgb;
          blur += texture2D(tDiffuse, vUv + vec2(px.x, -px.y) * 2.5).rgb;
          blur += texture2D(tDiffuse, vUv + vec2(-px.x, px.y) * 2.5).rgb;
          c.rgb = mix(c.rgb, blur / 5.0, uDof);
          float n = fract(sin(dot(vUv + uTime, vec2(12.9898, 78.233))) * 43758.5453);
          c.rgb += (n - 0.5) * uAmount;
          float d = distance(vUv, vec2(0.5));
          c.rgb *= smoothstep(0.92, 0.28, d);
          float bar = smoothstep(0.08, 0.11, vUv.y) * smoothstep(0.08, 0.11, 1.0 - vUv.y);
          c.rgb *= mix(0.02, 1.0, mix(1.0, bar, uDof));
          gl_FragColor = c;
        }
      `
    });
    composer.addPass(film);
    composer.addPass(new OutputPass());
  }

  function setQuality(q) {
    quality = q === 'low' ? 'low' : 'high';
    renderer.shadowMap.enabled = quality === 'high' && !navigator.webdriver;
    if (quality === 'high' && !composer) {
      try { buildComposer(); } catch (err) { quality = 'low'; composer = null; }
    }
    applySize();
  }

  function applySize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const dpr = quality === 'high' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    if (composer) composer.setSize(w, h);
  }

  function sunColorOf(star) {
    const teff = star.teff || 5600;
    if (teff < 3700) return new THREE.Color(1.0, 0.3, 0.07);
    const rgb = starRGB(teff);
    return new THREE.Color(rgb[0], rgb[1], rgb[2]);
  }

  function ensurePlanet(body) {
    let slot = planetPool.get(body.id);
    if (slot) return slot;
    const mat = makePlanetMaterial(body.aAU || 1);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), mat);
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.035, 32, 24), new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uSunPos: { value: new THREE.Vector3() }, uTime: { value: 0 }, uCloud: { value: 0.4 } },
      vertexShader: PLANET_VERT,
      fragmentShader: CLOUD_FRAG
    }));
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.12, 32, 24), new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uSunPos: { value: new THREE.Vector3() },
        uCam: { value: new THREE.Vector3() },
        uScatter: { value: new THREE.Color(0.45, 0.62, 1) }
      },
      vertexShader: PLANET_VERT,
      fragmentShader: ATMO_FRAG
    }));
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshStandardMaterial({ color: 0xb7b1a6, roughness: 0.9 }));
    planets.add(mesh, clouds, atmo, moon);
    slot = { mesh, clouds, atmo, moon };
    planetPool.set(body.id, slot);
    return slot;
  }

  function syncSystem(api) {
    const s = api.sys();
    const key = s.id + ':' + s.planets.map((p) => p.id).join(',');
    if (key !== systemKey) {
      systemKey = key;
      while (orbits.children.length) orbits.remove(orbits.children[0]);
      planetPool.forEach((slot) => {
        planets.remove(slot.mesh, slot.clouds, slot.atmo, slot.moon);
        slot.mesh.geometry.dispose();
      });
      planetPool.clear();
      const teff = s.star.teff || 4000;
      const col = sunColorOf(s.star);
      starMesh.material.uniforms.uColor.value.copy(col).multiplyScalar(teff < 3700 ? 2.4 : 3.2);
      starGlow.material.color.copy(col);
      const scale = Math.max(0.28, (s.star.radius || 0.5) * (teff < 3700 ? 0.7 : 0.85));
      starMesh.scale.setScalar(scale);
      starGlow.scale.set(scale * 7, scale * 7, 1);
      const bh = (api.g.central && api.g.central.id === 'bh') || s.star.spectral === 'disk';
      disk.visible = !!bh;
      photon.visible = !!bh;
      disk.scale.setScalar(Math.max(0.55, scale * 1.7));
      photon.scale.setScalar(Math.max(0.4, scale));
      if (bh) starMesh.material.uniforms.uColor.value.set(0.01, 0.008, 0.006);
      if (sky.material.uniforms && sky.material.uniforms.uNebula) {
        sky.material.uniforms.uNebula.value.set(s.nebula[0], s.nebula[1], s.nebula[2]);
      }
      for (const p of s.planets) {
        const a = p.aAU * 70;
        const pts = [];
        for (let i = 0; i <= 96; i++) {
          const ang = (i / 96) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(ang) * a, 0, Math.sin(ang) * a));
        }
        orbits.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({
          color: s.landmark ? 0xe25b1a : 0xffffff,
          transparent: true,
          opacity: s.landmark ? 0.45 : 0.16
        })));
      }
    }
    const list = api.bodies();
    const sunPos = new THREE.Vector3(0, 0, 0);
    const camPos = camera.position;
    const color = sunColorOf(s.star);
    const seen = new Set();
    for (const b of list) {
      if (b.kind !== 'planet') continue;
      seen.add(b.id);
      const slot = ensurePlanet(b);
      slot.mesh.position.set(b.x, 0, b.y);
      slot.mesh.scale.setScalar(Math.max(0.05, b.radius));
      slot.clouds.position.copy(slot.mesh.position);
      slot.clouds.scale.copy(slot.mesh.scale);
      slot.atmo.position.copy(slot.mesh.position);
      slot.atmo.scale.copy(slot.mesh.scale);
      const look = api.look(b.id);
      paintPlanet(slot.mesh.material, look, sunPos, color, camPos, clock.t, b.aAU || 1);
      const flux = (s.star.L || 1) / Math.max(0.0004, (b.aAU || 1) * (b.aAU || 1));
      slot.mesh.material.uniforms.uFlux.value = flux;
      slot.mesh.material.uniforms.uLocked.value = /^(proxima-|trappist-|savage-)/.test(b.id) ? 1 : 0;
      slot.clouds.material.uniforms.uSunPos.value.copy(sunPos);
      slot.clouds.material.uniforms.uTime.value = clock.t + (b.a || 0);
      slot.clouds.material.uniforms.uCloud.value = look.cloud;
      slot.atmo.material.uniforms.uSunPos.value.copy(sunPos);
      slot.atmo.material.uniforms.uCam.value.copy(camPos);
      const scatter = color.clone().lerp(new THREE.Color(0.45, 0.66, 1.05), 0.72);
      slot.atmo.material.uniforms.uScatter.value.copy(scatter);
      slot.moon.visible = !!b.moon;
      if (b.moon) {
        const ang = clock.t * 0.4 + b.a;
        slot.moon.position.set(b.x + Math.cos(ang) * b.radius * 2.4, 0.02, b.y + Math.sin(ang) * b.radius * 2.4);
        slot.moon.scale.setScalar(b.radius * 0.28);
      }
    }
    planetPool.forEach((slot, id) => {
      const on = seen.has(id);
      slot.mesh.visible = on;
      slot.clouds.visible = on;
      slot.atmo.visible = on;
      if (!on) slot.moon.visible = false;
    });
    const st = api.station(list);
    if (st && api.g.systemId === 'proxima') {
      stationMarker.visible = true;
      stationMarker.position.set(st.x, 0, st.y);
    } else stationMarker.visible = false;
    const ship = api.g.ship;
    shipRoot.position.set(ship.x, 0, ship.y);
    shipRoot.rotation.y = -ship.heading;
    const heat = api.g.cinematic && api.g.cinematic.kind === 'entry' ? Math.min(1, api.g.cinematic.t / 1.2) : 0;
    plasma.material.opacity = heat * 0.7;
    plasma.scale.setScalar(1 + heat * 1.4);
    const objId = api.objectiveId && api.objectiveId();
    const obj = list.find((b) => b.id === objId);
    if (obj) {
      const pulse = 0.85 + Math.sin(clock.t * 3) * 0.12;
      marker.position.set(obj.x, obj.radius * 1.6, obj.y);
      marker.scale.setScalar(Math.max(0.06, obj.radius * 2.2) * pulse);
      marker.visible = !api.g.landed;
      const days = obj.period ? obj.period.toFixed(2) + ' d' : '';
      let teq = '';
      try { teq = Math.round(api.climateFor(obj.id).Teq) + ' K'; } catch (err) { teq = ''; }
      setTextSprite(label, obj.name + '\n' + (obj.aAU ? obj.aAU.toFixed(3) : '') + ' AU  ' + days + '  ' + teq);
      label.visible = false;
    } else marker.visible = false;
    if (shipMesh.userData.sail) shipMesh.userData.sail.visible = !!(api.g.tech && api.g.tech.sail);
    if (shipMesh.userData.plume) {
      const th = Math.abs(api.g.ship.throttle || 0);
      const drive = api.g.ship.drive;
      const plumeColor = drive === 'ion' ? 0x7ecbff : drive === 'ramjet' ? 0xe7e2ff : 0xffa24a;
      shipMesh.userData.plume.material.color.set(plumeColor);
      shipMesh.userData.plume.material.opacity = api.g.landed ? 0 : Math.min(0.85, th);
      shipMesh.userData.plume.scale.set(1, 1, 0.35 + th * 2.4);
    }
    const puff = Math.min(0.75, Math.abs(api.g.turnRate || 0) * 1.4);
    (shipMesh.userData.rcs || []).forEach((p) => { p.material.opacity = api.g.landed ? 0 : puff; });
  }

  function dressShip(design) {
    const sail = !!(apiRef && apiRef.g && apiRef.g.tech && apiRef.g.tech.sail);
    const next = (design && design.hull) + (design && design.primary) + (design && design.accent) + (sail ? 's' : '');
    if (shipRoot.userData.key === next) return;
    shipRoot.userData.key = next;
    shipRoot.remove(shipMesh);
    shipMesh.traverse((obj) => { if (obj.geometry) obj.geometry.dispose(); });
    shipMesh = buildShip(design || {}, sail);
    shipRoot.add(shipMesh);
  }

  function placeFlares(origin) {
    const ndc = origin.clone().project(camera);
    const on = ndc.z < 1 && ndc.x > -1.2 && ndc.x < 1.2 && ndc.y > -1.2 && ndc.y < 1.2;
    for (let i = 0; i < flares.length; i++) {
      const s = flares[i];
      if (!on || quality === 'low') { s.material.opacity = 0; continue; }
      const t = (i + 1) / (flares.length + 0.5);
      const x = ndc.x + (0 - ndc.x) * t * 0.85;
      const y = ndc.y + (0 - ndc.y) * t * 0.85;
      const w = new THREE.Vector3(x, y, 0.2).unproject(camera);
      s.position.copy(w);
      const sc = 0.15 + i * 0.05;
      s.scale.set(sc, sc, 1);
      s.material.opacity = 0.22 - i * 0.04;
      s.material.color.set(i % 2 ? 0xffb080 : 0xcfe4ff);
    }
    if (god && on) god.uniforms.uLight.value.set(ndc.x * 0.5 + 0.5, ndc.y * 0.5 + 0.5);
    if (god) god.uniforms.uOn.value = on && quality === 'high' ? 1 : 0;
  }

  function frame(api, dt, present) {
    if (failed) return;
    apiRef = api;
    clock.t += dt;
    const mode = present.mode;
    const showHero = mode === 'title' || mode === 'hub';
    hero.visible = showHero;
    flight.visible = mode === 'flight';
    surface.visible = mode === 'surface';
    oneill.visible = mode === 'oneill';
    lyra.position.y = 0.35 + Math.sin(clock.t * 0.8) * 0.06;
    lyra.rotation.y = clock.t * 0.25;
    heroCloud.material.uniforms.uTime.value = clock.t;
    heroAtmo.material.uniforms.uCam.value.copy(camera.position);
    station.rotation.y = clock.t * 0.03;

    if (mode === 'title') {
      const u = present.fly == null ? 0 : present.fly;
      const a = ease(u);
      camera.position.set(
        lerp(14, 0.6, a),
        lerp(4.2, -0.35, a),
        lerp(16, 7.2, a)
      );
      camera.lookAt(lerp(0, 0.2, a), lerp(0.2, -1.15, a), lerp(0, -0.2, a));
    } else if (mode === 'hub') {
      const a = clock.t * 0.07;
      camera.position.set(Math.cos(a) * 6.4, 1.5 + Math.sin(clock.t * 0.2) * 0.15, Math.sin(a) * 6.4);
      camera.lookAt(0, -0.4, 0);
    } else if (mode === 'oneill') {
      const a = clock.t * 0.08;
      camera.position.set(Math.sin(a) * 1.2, Math.sin(clock.t * 0.15) * 0.4, Math.cos(a) * 1.2);
      camera.lookAt(0, 0.2, -8);
    } else if (mode === 'surface') {
      dressSurface(api);
      const rescue = api.g.surface && api.g.surface.kind === 'rescue';
      const px = rescue ? api.g.surface.x * 0.35 : api.g.eva.x * 0.35;
      const pz = rescue ? api.g.surface.y * 0.35 : api.g.eva.y * 0.35;
      const py = rescue ? 0.4 : 0.2 + Math.max(0, api.g.eva.y) * 0.15;
      drone.visible = !!rescue;
      astro.visible = !rescue;
      (rescue ? drone : astro).position.set(px, rescue ? 0.35 : 0, pz);
      const moving = Math.hypot(api.g.stick.x || 0, api.g.stick.y || 0) > 0.15;
      poseAstronaut(astro, clock.t, moving && !rescue, !!(api.g.jet) && !rescue);
      if (beacon.userData.lamp) beacon.userData.lamp.scale.setScalar(0.85 + Math.sin(clock.t * 4) * 0.15);
      const orbit = Math.sin(clock.t * 0.15) * 0.2;
      camera.position.lerp(new THREE.Vector3(px - 1.7 + orbit, 1.15, pz + 2.15), 1 - Math.pow(0.02, dt));
      camera.lookAt(px, 0.95, pz);
    } else {
      syncSystem(api);
      dressShip(api.g.shipDesign);
      const ship = api.g.ship;
      const spd = Math.hypot(ship.vx, ship.vy);
      let back = 2.35;
      const list = api.bodies();
      let nearR = 99;
      for (const b of list) {
        if (b.kind !== 'planet') continue;
        nearR = Math.min(nearR, Math.hypot(ship.x - b.x, ship.y - b.y) / Math.max(0.05, b.radius));
      }
      if (nearR < 10) back = 1.7;
      const cin = api.g.cinematic;
      if (cin && cin.kind === 'launch') back = lerp(6.5, 2.35, Math.min(1, cin.t / cin.dur));
      if (cin && cin.kind === 'entry') back = 1.45;
      if (cin && cin.kind === 'sling') back = 3.4;
      const hx = Math.cos(ship.heading);
      const hz = Math.sin(ship.heading);
      const th = Math.abs(ship.throttle || 0);
      const shake = th * 0.012;
      const want = new THREE.Vector3(
        ship.x - hx * back + Math.sin(clock.t * 46) * shake,
        back * 0.42 + Math.cos(clock.t * 37) * shake,
        ship.y - hz * back + Math.sin(clock.t * 29) * shake
      );
      const look = new THREE.Vector3(ship.x + hx * 0.18, 0.02, ship.y + hz * 0.18);
      const k = 1 - Math.pow(0.004, Math.max(0.016, dt));
      camera.position.lerp(want, Math.min(1, k));
      camera.lookAt(look);
      key.position.set(camera.position.x + 1.2, camera.position.y + 1.6, camera.position.z + 0.4);
      key.target.position.set(ship.x, 0, ship.y);
      key.target.updateMatrixWorld();
      placeFlares(new THREE.Vector3(0, 0, 0));
    }
    if (mode !== 'flight') {
      flares.forEach((s) => { s.material.opacity = 0; });
      if (god) god.uniforms.uOn.value = mode === 'title' || mode === 'hub' ? 1 : 0;
      if (god && (mode === 'title' || mode === 'hub')) god.uniforms.uLight.value.set(0.72, 0.78);
    }
    if (film) {
      film.uniforms.uTime.value = clock.t;
      const cin = api.g && api.g.cinematic;
      const cut = cin && (cin.kind === 'entry' || cin.kind === 'launch' || cin.kind === 'depart');
      if (film.uniforms.uDof) film.uniforms.uDof.value = cut ? 0.72 : 0;
    }
    if (disk.material.uniforms) disk.material.uniforms.uTime.value = clock.t;
    try {
      if (quality === 'high' && composer) composer.render();
      else renderer.render(scene, camera);
    } catch (err) {
      failed = true;
    }
  }

  function dressSurface(api) {
    const id = api.g.landed;
    const found = id && api.findPlanet(id);
    const look = id ? api.look(id) : { ocean: 0.2, ice: 0.2, veg: 0, lava: 0, cloud: 0.2, cities: 0 };
    const star = found ? found.system.star : { teff: 3000 };
    const color = sunColorOf(star);
    const sun = new THREE.Vector3(20, 30, 10);
    paintPlanet(ground.material, look, sun, color, camera.position, clock.t, 5);
    surfCloud.material.uniforms.uTime.value = clock.t;
    surfCloud.material.uniforms.uCloud.value = look.cloud || 0.2;
    if (sky.material.uniforms && sky.material.uniforms.uNebula) {
      sky.material.uniforms.uNebula.value.set(color.r * 0.25, color.g * 0.15, 0.05);
    }
    beacon.visible = !!(api.g.colonies && api.g.colonies.length);
    const rescue = api.g.surface && api.g.surface.kind === 'rescue';
    if (rescue) {
      lander.position.set(api.g.surface.wreckX * 0.35, 0, api.g.surface.wreckY * 0.35);
      lander.visible = true;
    } else {
      lander.position.set(2.4, 0, -1.5);
      lander.visible = true;
    }
    suitMatColor(astro, api.g.suit, api.g.backer);
  }

  function suitMatColor(group, suit, backer) {
    if (group.userData.suitMat) group.userData.suitMat.color.set((suit && suit.primary) || '#d5dee6');
    if (group.userData.crest) group.userData.crest.visible = !!backer;
  }

  setQuality(quality);
  applySize();

  return {
    setQuality,
    resize: applySize,
    frame,
    get quality() { return quality; },
    ok: () => !failed
  };
}

function lerp(a, b, t) { return a + (b - a) * t; }
function ease(t) { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); }
