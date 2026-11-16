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
    vec3 ocean = vec3(0.015, 0.06, 0.1);
    vec3 base = mix(rock, ocean, shore);
    float lat = abs(n.y);
    base = mix(base, vec3(0.86, 0.9, 0.95), uIce * smoothstep(0.35, 0.85, lat + nse * 0.2));
    if (uLava > 0.02) base = mix(base, vec3(0.45, 0.08, 0.02), uLava);
    vec3 V = normalize(uCam - vW);
    vec3 H = normalize(sunDir + V);
    float spec = pow(max(dot(n, H), 0.0), 90.0) * shore * day;
    vec3 lit = base * (0.045 + 0.96 * day) * uSunColor + spec * uSunColor * 1.4;
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
      uSeed: { value: seed || 0 }
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
  return g;
}

function buildLyra() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.6, 0.72, 0.28),
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.28, 4, 8), mat);
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), mat);
  head.position.y = 0.26;
  g.add(head);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.006, 6, 24), mat);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  g.position.set(1.1, 0.35, 0.8);
  return g;
}

function buildShip(design) {
  const g = new THREE.Group();
  const primary = new THREE.Color(design.primary || '#c5d0d8');
  const accent = new THREE.Color(design.accent || '#e25b1a');
  const hull = new THREE.MeshStandardMaterial({ color: primary, metalness: 0.65, roughness: 0.28 });
  const glow = new THREE.MeshBasicMaterial({ color: accent.clone().multiplyScalar(2.2) });
  const kind = design.hull || 'dart';
  if (kind === 'ring') {
    const spine = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.09, 3, 6), hull);
    spine.rotation.z = Math.PI / 2;
    g.add(spine);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.006, 8, 20), hull);
    ring.rotation.y = Math.PI / 2;
    g.add(ring);
  } else if (kind === 'hauler') {
    for (let i = 0; i < 3; i++) {
      const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.04, 3, 6), hull);
      tank.rotation.z = Math.PI / 2;
      tank.position.set(-0.01 + i * 0.028, 0, 0);
      g.add(tank);
    }
  } else {
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.07, 8), hull);
    nose.rotation.z = -Math.PI / 2;
    nose.position.x = 0.03;
    g.add(nose);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.004, 0.04), hull);
    fin.position.set(-0.02, 0, 0);
    g.add(fin);
  }
  const engine = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 8), glow);
  engine.position.x = -0.05;
  g.add(engine);
  g.userData.engine = engine;
  return g;
}

function buildLander() {
  const g = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0xd5d0c8, metalness: 0.4, roughness: 0.45 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 3.2), hull);
  body.position.y = 0.7;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 1.1), hull);
  nose.position.set(0, 0.85, 1.8);
  g.add(nose);
  for (let i = -1; i <= 1; i += 2) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 0.7), new THREE.MeshStandardMaterial({ color: 0x2a3338, metalness: 0.5, roughness: 0.4 }));
    fin.position.set(i * 0.5, 1.5, -1.3);
    g.add(fin);
  }
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 0.4, 0.15) }));
  glow.position.set(0, 0.55, -1.7);
  g.add(glow);
  return g;
}

export function createView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
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

  scene.add(new THREE.AmbientLight(0x6e7c90, 0.55));
  const key = new THREE.DirectionalLight(0xfff0dd, 2.4);
  key.position.set(12, 18, 8);
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
  surface.add(lander);
  const drone = new THREE.Group();
  const droneBody = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.5), new THREE.MeshStandardMaterial({ color: 0xd0d6dc, metalness: 0.6, roughness: 0.3 }));
  drone.add(droneBody);
  const droneEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
  droneEye.position.set(0, 0.08, 0.2);
  drone.add(droneEye);
  surface.add(drone);
  const astro = new THREE.Group();
  const suitMat = new THREE.MeshStandardMaterial({ color: 0xd5dee6, roughness: 0.45, metalness: 0.2 });
  const astroBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.4, 4, 8), suitMat);
  astroBody.position.y = 0.5;
  astro.add(astroBody);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0x1b242c, metalness: 0.8, roughness: 0.1 }));
  visor.position.y = 0.95;
  astro.add(visor);
  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.02), new THREE.MeshBasicMaterial({ color: 0xe25b1a }));
  crest.position.set(0, 0.62, 0.16);
  astro.add(crest);
  surface.add(astro);
  for (let i = 0; i < 7; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + (i % 3) * 0.4, 0), new THREE.MeshStandardMaterial({ color: 0x3a332e, roughness: 0.9 }));
    const a = i * 1.3;
    rock.position.set(Math.cos(a) * (8 + i * 2), 0.3, Math.sin(a) * (6 + i));
    rock.rotation.set(i, i * 0.4, 0);
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

  function buildComposer() {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(canvas.width, canvas.height), 0.42, 0.4, 0.78);
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
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmount: { value: 0.035 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uTime; uniform float uAmount; varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          float n = fract(sin(dot(vUv + uTime, vec2(12.9898, 78.233))) * 43758.5453);
          c.rgb += (n - 0.5) * uAmount;
          float d = distance(vUv, vec2(0.5));
          c.rgb *= smoothstep(0.98, 0.32, d);
          gl_FragColor = c;
        }
      `
    });
    composer.addPass(film);
    composer.addPass(new OutputPass());
  }

  function setQuality(q) {
    quality = q === 'low' ? 'low' : 'high';
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
    const rgb = starRGB(star.teff || 5600);
    return new THREE.Color(rgb[0], rgb[1], rgb[2]);
  }

  function ensurePlanet(body) {
    let slot = planetPool.get(body.id);
    if (slot) return slot;
    const mat = makePlanetMaterial(body.aAU || 1);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), mat);
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
      const rgb = starRGB(s.star.teff || 4000);
      const col = new THREE.Color(rgb[0], rgb[1], rgb[2]);
      starMesh.material.uniforms.uColor.value.copy(col).multiplyScalar(3.2);
      starGlow.material.color.copy(col);
      const scale = s.star.mass > 0.8 ? 0.72 : 0.4;
      starMesh.scale.setScalar(scale);
      sky.material.uniforms.uNebula.value.set(s.nebula[0], s.nebula[1], s.nebula[2]);
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
    const heat = api.g.cinematic && api.g.cinematic.kind === 'entry' ? Math.min(1, api.g.cinematic.t / 2) : 0;
    plasma.material.opacity = heat * 0.85;
    plasma.scale.setScalar(1 + heat * 1.8);
  }

  function dressShip(design) {
    const next = (design && design.hull) + (design && design.primary) + (design && design.accent);
    if (shipRoot.userData.key === next) return;
    shipRoot.userData.key = next;
    shipRoot.remove(shipMesh);
    shipMesh.traverse((obj) => { if (obj.geometry) obj.geometry.dispose(); });
    shipMesh = buildShip(design || {});
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
      (rescue ? drone : astro).position.set(px, py, pz);
      camera.position.lerp(new THREE.Vector3(px - 3.2, 2.4 + py, pz + 4.6), 1 - Math.pow(0.02, dt));
      camera.lookAt(px, py + 0.4, pz - 1);
    } else {
      syncSystem(api);
      dressShip(api.g.shipDesign);
      const ship = api.g.ship;
      const spd = Math.hypot(ship.vx, ship.vy);
      let back = 1.15 + Math.min(1.6, spd * 0.25);
      const list = api.bodies();
      let nearR = 99;
      for (const b of list) {
        if (b.kind !== 'planet') continue;
        nearR = Math.min(nearR, Math.hypot(ship.x - b.x, ship.y - b.y) / Math.max(0.05, b.radius));
      }
      if (nearR < 8) back = 0.42 + nearR * 0.04;
      const cin = api.g.cinematic;
      if (cin && cin.kind === 'launch') back = lerp(4.5, 1.1, Math.min(1, cin.t / cin.dur));
      if (cin && cin.kind === 'entry') back = 0.28;
      if (cin && cin.kind === 'sling') back = 2.4;
      const hx = Math.cos(ship.heading);
      const hz = Math.sin(ship.heading);
      const want = new THREE.Vector3(ship.x - hx * back, back * 0.42, ship.y - hz * back);
      const look = new THREE.Vector3(ship.x + hx * 0.6, 0.02, ship.y + hz * 0.6);
      const k = 1 - Math.pow(0.0015, Math.max(0.016, dt));
      camera.position.lerp(want, Math.min(1, k));
      camera.lookAt(look);
      placeFlares(new THREE.Vector3(0, 0, 0));
    }
    if (mode !== 'flight') {
      flares.forEach((s) => { s.material.opacity = 0; });
      if (god) god.uniforms.uOn.value = mode === 'title' || mode === 'hub' ? 1 : 0;
      if (god && (mode === 'title' || mode === 'hub')) god.uniforms.uLight.value.set(0.72, 0.78);
    }
    if (film) film.uniforms.uTime.value = clock.t;
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
    sky.material.uniforms.uNebula.value.set(color.r * 0.25, color.g * 0.15, 0.05);
    const rescue = api.g.surface && api.g.surface.kind === 'rescue';
    if (rescue) {
      lander.position.set(api.g.surface.wreckX * 0.35, 0, api.g.surface.wreckY * 0.35);
      lander.visible = true;
    } else {
      lander.position.set(6, 0, -4);
      lander.visible = true;
    }
    suitMatColor(astro, api.g.suit, api.g.backer);
  }

  function suitMatColor(group, suit, backer) {
    const primary = new THREE.Color((suit && suit.primary) || '#d5dee6');
    group.children[0].material.color.copy(primary);
    group.children[2].visible = !!backer;
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
