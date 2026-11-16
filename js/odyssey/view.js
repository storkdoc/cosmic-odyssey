/* Cinematic preview and flight. Hulls are lathed from each civilization’s profile.
   The SavagePlanets mark is the image file, untinted. */
import * as THREE from '../../vendor/three/three.module.min.js';
import { EffectComposer } from '../../vendor/three/postprocessing/EffectComposer.js';
import { RenderPass } from '../../vendor/three/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../../vendor/three/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../../vendor/three/postprocessing/OutputPass.js';
import { starType, layoutBodies } from './universe.js';

const AU = 22;

const PLANET_FRAG = `
  varying vec3 vN; varying vec3 vW;
  uniform vec3 uCam; uniform vec3 uLight; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
  uniform float uSeed; uniform float uGas; uniform float uIce; uniform float uCities;
  float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
  float noise(vec3 p){
    vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  void main(){
    vec3 n=normalize(vN);
    float ndl=dot(n, normalize(uLight));
    float day=smoothstep(-0.08,0.35,ndl);
    float nse=noise(n*3.2+uSeed);
    vec3 col=mix(uA,uB,smoothstep(0.35,0.7,nse));
    col=mix(col,uC,uGas*smoothstep(0.2,0.8,abs(n.y)+nse*0.2));
    col=mix(col,vec3(0.85,0.9,0.95),uIce*smoothstep(0.45,0.9,abs(n.y)));
    vec3 lit=col*(0.08+0.92*day);
    float cities=uCities*(1.0-day)*smoothstep(0.62,0.9,hash(floor(n*26.0)));
    lit+=vec3(1.0,0.78,0.45)*cities;
    float fres=pow(1.0-abs(dot(n,normalize(uCam-vW))),2.2);
    lit+=vec3(0.45,0.65,1.0)*fres*0.25;
    gl_FragColor=vec4(lit,1.0);
  }
`;
const VERT = `
  varying vec3 vN; varying vec3 vW;
  void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }
`;
const TERRAIN_VERT = `
  varying vec3 vN; varying float vH; uniform float uSeed;
  float hash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
  float noise(vec3 p){
    vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  void main(){
    vec3 p=position;
    float h=noise(vec3(p.x,uSeed,p.z)*0.18)*1.4 + noise(vec3(p.x,uSeed,p.z)*0.55)*0.35;
    vH=h; p.y+=h;
    vec4 w=modelMatrix*vec4(p,1.0);
    vN=normalize(mat3(modelMatrix)*normal);
    gl_Position=projectionMatrix*viewMatrix*w;
  }
`;
const TERRAIN_FRAG = `
  varying vec3 vN; varying float vH; uniform vec3 uA; uniform vec3 uB; uniform vec3 uLight;
  void main(){
    float day=smoothstep(-0.2,0.6,dot(normalize(vN),normalize(uLight)));
    vec3 col=mix(uA,uB,smoothstep(0.2,1.3,vH));
    gl_FragColor=vec4(col*(0.25+0.75*day),1.0);
  }
`;

function planetColors(compId) {
  const map = {
    rocky: ['#6d5344', '#2f6d4f', '#1d4e86'],
    iron: ['#8a4632', '#5c4036', '#3a2a28'],
    water: ['#1a4e78', '#2f8f6b', '#dfe8ee'],
    ice: ['#d5e4ee', '#8fb4c9', '#f7fbff'],
    gas: ['#c9894a', '#e6d2a8', '#8d4b32'],
    icegiant: ['#7ec8c3', '#d7efe8', '#3d6f8a'],
    carbon: ['#2a2a2a', '#4a3b32', '#1a1a1a'],
    exotic: ['#6a3d78', '#d2a15a', '#24324a']
  };
  return (map[compId] || map.rocky).map((h) => new THREE.Color(h));
}

function buildShipMesh(ship) {
  const g = new THREE.Group();
  const foil = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(ship.hull || '#d7b56a'),
    metalness: 0.92, roughness: 0.16, clearcoat: 0.9, clearcoatRoughness: 0.12,
    envMapIntensity: 1.6, emissive: new THREE.Color(ship.hull || '#d7b56a'), emissiveIntensity: 0.08
  });
  const accent = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(ship.accent || '#1c3f86'),
    metalness: 0.7, roughness: 0.14, clearcoat: 0.75, emissive: new THREE.Color(ship.accent || '#1c3f86'), emissiveIntensity: 0.35
  });
  const pts = (ship.profile || [0.3, 0.5, 0.55, 0.4, 0.28]).map((r, i, arr) => new THREE.Vector2(0.04 + r * 0.12, (i / (arr.length - 1) - 0.5) * 1.15));
  const hull = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), foil);
  hull.rotation.z = Math.PI / 2;
  g.add(hull);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 16), new THREE.MeshPhysicalMaterial({
    color: 0xb9d7ff, metalness: 0.05, roughness: 0.05, transmission: 0.65, thickness: 0.04, transparent: true, opacity: 0.9
  }));
  glass.position.set(0.22, 0.1, 0);
  g.add(glass);
  [-1, 1].forEach((side) => {
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.22), accent);
    wing.position.set(-0.05, 0.02, side * 0.42);
    g.add(wing);
    const rad = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.06), foil);
    rad.position.set(-0.15, side * 0.2, 0);
    g.add(rad);
  });
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 0.16, 20), foil);
  bell.rotation.z = Math.PI / 2;
  bell.position.x = -0.62;
  g.add(bell);
  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.45, 20), new THREE.MeshBasicMaterial({
    color: 0xffb15a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  plume.rotation.z = Math.PI / 2;
  plume.position.x = -0.95;
  g.add(plume);
  g.userData.plume = plume;
  return g;
}

export function createView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 2000);
  camera.position.set(0, 8, 28);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 64, 40), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, depthWrite: false }));
  sky.renderOrder = -3;
  scene.add(sky);
  const coarseSky = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || Math.min(window.innerWidth, window.innerHeight) < 800;
  const skyUrl = coarseSky ? 'assets/sky/starmap-4k.jpg' : 'assets/sky/starmap-8k.jpg';
  const skyInfo = { url: skyUrl, w: 0, h: 0 };
  const tex = new THREE.TextureLoader().load(skyUrl, (t) => {
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
    } catch (err) { /* the sky sphere still shows the map */ }
  });
  tex.colorSpace = THREE.SRGBColorSpace;

  const starfield = new THREE.TextureLoader().load('assets/art/starfield.jpg');
  starfield.colorSpace = THREE.SRGBColorSpace;
  starfield.anisotropy = 4;
  const nebula = new THREE.Mesh(new THREE.PlaneGeometry(36, 20.25), new THREE.MeshBasicMaterial({
    map: starfield, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
  }));
  nebula.position.set(0, 0.4, -16);
  nebula.renderOrder = -2;
  camera.add(nebula);
  scene.add(camera);

  const twinkleCount = 280;
  const twinkleGeo = new THREE.BufferGeometry();
  const twPos = new Float32Array(twinkleCount * 3);
  const twPhase = new Float32Array(twinkleCount);
  const twCol = new Float32Array(twinkleCount * 3);
  const hues = [[1, 0.95, 0.85], [0.7, 0.82, 1], [1, 0.7, 0.55], [0.75, 1, 0.9]];
  for (let i = 0; i < twinkleCount; i++) {
    const z = Math.random() * 2 - 1;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.max(0, 1 - z * z)) * 180;
    twPos[i * 3] = Math.cos(a) * r;
    twPos[i * 3 + 1] = z * 180;
    twPos[i * 3 + 2] = Math.sin(a) * r;
    twPhase[i] = Math.random() * Math.PI * 2;
    const h = hues[i % hues.length];
    twCol[i * 3] = h[0]; twCol[i * 3 + 1] = h[1]; twCol[i * 3 + 2] = h[2];
  }
  twinkleGeo.setAttribute('position', new THREE.BufferAttribute(twPos, 3));
  twinkleGeo.setAttribute('aPhase', new THREE.BufferAttribute(twPhase, 1));
  twinkleGeo.setAttribute('color', new THREE.BufferAttribute(twCol, 3));
  const twinkles = new THREE.Points(twinkleGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uDpr: { value: 1 } },
    vertexShader: `
      attribute float aPhase; attribute vec3 color; varying float vA; varying vec3 vC;
      uniform float uTime; uniform float uDpr;
      void main(){
        vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 2.2 + aPhase));
        vC = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uDpr * 1.6 * (140.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vA; varying vec3 vC;
      void main(){
        vec2 p = gl_PointCoord - 0.5;
        float d = dot(p, p);
        if (d > 0.25) discard;
        float core = smoothstep(0.25, 0.0, d);
        gl_FragColor = vec4(vC * core, core * vA);
      }`
  }));
  scene.add(twinkles);
  const nearCount = 70;
  const nearGeo = new THREE.BufferGeometry();
  const nearPos = new Float32Array(nearCount * 3);
  const nearPhase = new Float32Array(nearCount);
  for (let i = 0; i < nearCount; i++) {
    nearPos[i * 3] = (Math.random() - 0.5) * 40;
    nearPos[i * 3 + 1] = (Math.random() - 0.5) * 22;
    nearPos[i * 3 + 2] = (Math.random() - 0.5) * 40;
    nearPhase[i] = Math.random() * Math.PI * 2;
  }
  nearGeo.setAttribute('position', new THREE.BufferAttribute(nearPos, 3));
  nearGeo.setAttribute('aPhase', new THREE.BufferAttribute(nearPhase, 1));
  const nearStars = new THREE.Points(nearGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uSpeed: { value: 0 }, uDpr: { value: 1 } },
    vertexShader: `
      attribute float aPhase; varying float vA; uniform float uTime; uniform float uDpr;
      void main(){
        vA = 0.4 + 0.6 * (0.5 + 0.5 * sin(uTime * 3.0 + aPhase));
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uDpr * 1.35 * (48.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vA; uniform float uSpeed;
      void main(){
        vec2 p = gl_PointCoord - 0.5;
        p.x /= 1.0 + uSpeed * 10.0;
        float d = dot(p, p);
        if (d > 0.25) discard;
        float core = smoothstep(0.25, 0.0, d);
        gl_FragColor = vec4(vec3(0.85, 0.92, 1.0) * core, core * vA);
      }`
  }));
  scene.add(nearStars);
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const beacons = [new THREE.Vector3(30, 12, -24), new THREE.Vector3(-22, 6, 18), new THREE.Vector3(8, -4, -36)];
  const aim = new THREE.Vector3();
  const toShip = new THREE.Vector3();
  const nebulaFar = nebula.clone();
  nebulaFar.position.set(0, 0, -24);
  nebulaFar.scale.setScalar(1.35);
  nebulaFar.material = nebula.material.clone();
  nebulaFar.material.opacity = 0.28;
  camera.add(nebulaFar);
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({
    color: 0xd7ecff, blending: THREE.AdditiveBlending, transparent: true, opacity: 0, depthWrite: false
  }));
  flare.scale.setScalar(1.4);
  scene.add(flare);
  const shoot = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.03), new THREE.MeshBasicMaterial({
    color: 0xfff6e8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  scene.add(shoot);

  const SHIP_VERT = `
    uniform float uBank; uniform float uPitch;
    varying vec2 vUv;
    void main(){
      vUv = uv;
      vec3 p = position;
      p.z += p.x * uBank * 0.22;
      p.y += p.x * uPitch * 0.12;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`;
  const SHIP_FRAG = `
    uniform sampler2D map; uniform float uPulse; uniform float uBlur; uniform float uGlint;
    varying vec2 vUv;
    void main(){
      vec2 dir = vec2(0.02, 0.004) * uBlur;
      vec4 c = texture2D(map, vUv);
      if (uBlur > 0.02) {
        c += texture2D(map, vUv + dir);
        c += texture2D(map, vUv - dir);
        c += texture2D(map, vUv + dir * 2.0);
        c /= 4.0;
      }
      if (c.a < 0.04) discard;
      float engine = smoothstep(0.02, 0.45, c.b - max(c.r, c.g));
      vec3 col = c.rgb + vec3(0.25, 0.7, 1.0) * engine * uPulse;
      float band = smoothstep(0.07, 0.0, abs(vUv.x - uGlint));
      col += vec3(1.0, 0.96, 0.9) * band * 0.45 * c.a;
      gl_FragColor = vec4(col, c.a);
    }`;
  function shipPlate(url) {
    const map = new THREE.TextureLoader().load(url);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 1.153), new THREE.ShaderMaterial({
      uniforms: {
        map: { value: map },
        uPulse: { value: 0.4 },
        uBlur: { value: 0 },
        uGlint: { value: 0.2 },
        uBank: { value: 0 },
        uPitch: { value: 0 }
      },
      vertexShader: SHIP_VERT,
      fragmentShader: SHIP_FRAG,
      transparent: true,
      depthWrite: false
    }));
    mesh.renderOrder = 2;
    return mesh;
  }
  const playerArt = new THREE.Group();
  const heroPlate = shipPlate('assets/art/ship-hero.png');
  const sidePlate = shipPlate('assets/art/ship-side.png');
  sidePlate.visible = false;
  playerArt.add(heroPlate, sidePlate);
  const softDisc = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const g = canvas.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.28)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const exhaust = [];
  for (let i = 0; i < 8; i++) {
    const puff = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softDisc, color: 0x9fd4ff, blending: THREE.AdditiveBlending, transparent: true, opacity: 0, depthWrite: false
    }));
    puff.scale.setScalar(0.08);
    heroPlate.add(puff);
    exhaust.push(puff);
  }
  flare.material.map = softDisc;
  const heroShow = new THREE.Group();
  const titlePlate = shipPlate('assets/art/ship-hero.png');
  const cutPlate = shipPlate('assets/art/ship-side.png');
  cutPlate.visible = false;
  titlePlate.scale.setScalar(3.8);
  cutPlate.scale.setScalar(3.2);
  heroShow.add(titlePlate, cutPlate);
  scene.add(heroShow);

  scene.add(new THREE.AmbientLight(0xc5ced6, 0.45));
  const key = new THREE.DirectionalLight(0xfff4e8, 2.4);
  key.position.set(30, 18, 12);
  scene.add(key);

  const root = new THREE.Group();
  scene.add(root);
  const shipRoot = new THREE.Group();
  shipRoot.add(playerArt);
  scene.add(shipRoot);
  let shipMesh = null;

  const markTex = new THREE.TextureLoader().load('assets/brand/savageplanets-mark.png');
  markTex.colorSpace = THREE.SRGBColorSpace;
  const gate = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    map: markTex, transparent: true, depthWrite: false, color: 0xffffff, toneMapped: false
  }));
  gate.position.set(0, 2.2, 0);
  gate.visible = false;
  scene.add(gate);

  const terrain = new THREE.Mesh(new THREE.PlaneGeometry(80, 80, 96, 96), new THREE.ShaderMaterial({
    uniforms: {
      uSeed: { value: 1 },
      uA: { value: new THREE.Color('#6d5344') },
      uB: { value: new THREE.Color('#dfe8ee') },
      uLight: { value: new THREE.Vector3(0.4, 1, 0.3) }
    },
    vertexShader: TERRAIN_VERT,
    fragmentShader: TERRAIN_FRAG
  }));
  terrain.rotation.x = -Math.PI / 2;
  terrain.visible = false;
  scene.add(terrain);

  let composer = null;
  let bloom = null;
  let quality = 'high';
  const clock = { t: 0 };
  let mode = 'atelier';
  let focus = 0;

  function buildComposer() {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(canvas.width, canvas.height), 0.22, 0.4, 0.9);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  function applySize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const cap = coarseSky ? 2 : 3;
    const dpr = Math.min(window.devicePixelRatio || 1, cap);
    renderer.setPixelRatio(dpr);
    if (twinkles.material.uniforms.uDpr) twinkles.material.uniforms.uDpr.value = dpr;
    if (nearStars.material.uniforms.uDpr) nearStars.material.uniforms.uDpr.value = dpr;
    window.__sky = Object.assign(window.__sky || {}, { dpr, url: skyUrl, w: skyInfo.w, h: skyInfo.h });
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    if (composer) composer.setSize(w, h);
  }

  function setQuality(q) {
    const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    quality = q === 'low' || navigator.webdriver || coarse ? 'low' : 'high';
    if (quality === 'high' && !composer) {
      try { buildComposer(); } catch (err) { quality = 'low'; composer = null; }
    }
    applySize();
  }

  function clearRoot() {
    while (root.children.length) {
      const child = root.children.pop();
      child.traverse((obj) => { if (obj.geometry) obj.geometry.dispose(); });
    }
  }

  function coronaTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const g = canvas.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.18, 'rgba(255,255,255,0.45)');
    grd.addColorStop(0.42, 'rgba(255,255,255,0.12)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const corona = coronaTexture();
  const STAR_VERT = `
    varying vec3 vN;
    void main(){
      vN = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;
  const STAR_FRAG = `
    varying vec3 vN;
    uniform vec3 uColor; uniform float uTime; uniform float uHot;
    float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
    void main(){
      float mu = clamp(vN.z, 0.0, 1.0);
      float limb = pow(mu, 0.45);
      float gran = hash(normalize(vN) * 9.0 + vec3(uTime * 0.15, 0.0, 0.0));
      vec3 col = uColor * (0.35 + 0.75 * limb) * (0.82 + 0.28 * gran);
      col += uColor * uHot * (0.15 + 0.1 * sin(uTime * 3.0 + vN.x * 8.0));
      gl_FragColor = vec4(col, 1.0);
    }`;
  function starMesh(spec, radiusScale) {
    const color = new THREE.Color(spec.color);
    const hot = spec.id === 'ns' || spec.id === 'wd' ? 1 : spec.id === 'o' || spec.id === 'b' ? 0.6 : 0.25;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.ShaderMaterial({
      uniforms: { uColor: { value: color }, uTime: { value: 0 }, uHot: { value: hot } },
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG
    }));
    mesh.userData.star = true;
    let r = spec.disk ? 0.42 : Math.max(0.22, Math.min(2.2, Math.log10(spec.radius * 40 + 1.2)));
    if (spec.id === 'wd') r = 0.18;
    if (spec.id === 'ns') r = 0.12;
    mesh.scale.setScalar(r * radiusScale);
    if (spec.disk) {
      const disk = new THREE.Mesh(new THREE.RingGeometry(1.6, 4.2, 96), new THREE.MeshBasicMaterial({
        color: 0xffb15a, side: THREE.DoubleSide, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false
      }));
      disk.rotation.x = -1.15;
      mesh.add(disk);
      const photon = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.045, 12, 80), new THREE.MeshBasicMaterial({ color: 0xfff1d0 }));
      photon.rotation.x = Math.PI / 2;
      mesh.add(photon);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: corona, color, blending: THREE.AdditiveBlending, transparent: true, opacity: spec.disk ? 0.35 : 0.8, depthWrite: false
    }));
    glow.scale.setScalar(spec.id === 'ns' ? 6 : spec.disk ? 3.2 : 4.2);
    mesh.add(glow);
    return mesh;
  }

  function worldMesh(planet) {
    const cols = planetColors(planet.composition);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.ShaderMaterial({
      uniforms: {
        uCam: { value: new THREE.Vector3() },
        uLight: { value: new THREE.Vector3(1, 0.4, 0.2) },
        uA: { value: cols[0] }, uB: { value: cols[1] }, uC: { value: cols[2] },
        uSeed: { value: (planet.name || 'a').length * 0.17 },
        uGas: { value: planet.composition === 'gas' || planet.composition === 'icegiant' ? 1 : 0 },
        uIce: { value: planet.composition === 'ice' ? 1 : 0 },
        uCities: { value: planet.life && planet.life.stage === 'technological' ? 1 : 0 }
      },
      vertexShader: VERT,
      fragmentShader: PLANET_FRAG
    }));
    const rad = Math.max(0.18, Math.min(2.8, planet.radius * 0.22));
    mesh.scale.setScalar(rad);
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.08, 32, 24), new THREE.MeshBasicMaterial({
      color: 0x8eb7ea, transparent: true, opacity: planet.atmosphere === 'none' ? 0.04 : 0.18, side: THREE.BackSide, depthWrite: false
    }));
    mesh.add(atmo);
    return mesh;
  }

  function place(sys, turn = 0) {
    clearRoot();
    gate.visible = mode === 'atelier';
    const bodies = layoutBodies(sys, turn);
    if (!sys.stars.length) {
      const rogue = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 16), new THREE.MeshStandardMaterial({ color: 0x33363c, roughness: 0.9 }));
      root.add(rogue);
    }
    sys.stars.forEach((star, i) => {
      const spec = starType(star.type);
      const mesh = starMesh(spec, 1);
      if (sys.architecture === 's-type' || sys.architecture === 'hierarchical') {
        const sep = Math.max(4, Math.min(18, sys.separationAU * 0.35));
        mesh.position.x = i === 0 ? -sep : sep;
      } else if (sys.architecture === 'p-type' && sys.stars.length > 1) {
        mesh.position.x = (i === 0 ? -1 : 1) * Math.max(1.2, Math.min(4, sys.separationAU * 0.15));
      }
      if (sys.architecture === 'hierarchical' && i === 2) mesh.position.set(Math.min(26, sys.outerAU * 0.12), 2, -8);
      root.add(mesh);
    });
    bodies.forEach((planet) => {
      const mesh = worldMesh(planet);
      mesh.position.set(planet.x, 0, planet.z);
      root.add(mesh);
      const pts = [];
      for (let k = 0; k <= 64; k++) {
        const a = (k / 64) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * planet.aAU * AU, 0, Math.sin(a) * planet.aAU * AU));
      }
      root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.16
      })));
      planet.moons.forEach((moon, mi) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.06, moon.radius * 0.18), 20, 14), new THREE.MeshStandardMaterial({ color: 0xc5ccd2, roughness: 0.7 }));
        const d = mesh.scale.x + 0.35 + mi * 0.28;
        m.position.set(mesh.position.x + d, 0.05, mesh.position.z);
        root.add(m);
      });
    });
    (sys.belts || []).forEach((belt) => {
      const count = 80;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const r = belt.aAU * AU * (0.92 + (i % 5) * 0.02);
        pos[i * 3] = Math.cos(a) * r;
        pos[i * 3 + 2] = Math.sin(a) * r;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      root.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xddccbb, size: 0.08, transparent: true, opacity: 0.8 })));
    });
  }

  function dressShip(ship) {
    const key = ship && (ship.rendered ? 'rendered-player' : ship.id);
    if (shipRoot.userData.key === key) return;
    shipRoot.userData.key = key;
    if (shipMesh) shipRoot.remove(shipMesh);
    playerArt.visible = !!(ship && ship.rendered);
    shipMesh = ship && !ship.rendered ? buildShipMesh(ship) : null;
    if (shipMesh) shipRoot.add(shipMesh);
  }

  function pulsePlates(group, pulse) {
    group.children.forEach((child) => {
      if (child.material && child.material.uniforms && child.material.uniforms.uPulse) child.material.uniforms.uPulse.value = pulse;
    });
  }

  function frame(state, dt) {
    clock.t += dt;
    focus += dt * 0.05;
    const phase = state.phase || 'build';
    const flight = state.flight;
    const thrust = (flight && flight.pose && flight.pose.thrust) || 0;
    const pulse = 0.2 + (0.15 + thrust * 0.7) * (0.5 + 0.5 * Math.sin(clock.t * (6 + thrust * 8)));
    const glint = reduceMotion ? 0.15 : (clock.t * 0.07) % 1;
    pulsePlates(playerArt, pulse);
    pulsePlates(heroShow, pulse);
    [heroPlate, sidePlate, titlePlate, cutPlate].forEach((plate) => {
      const u = plate.material.uniforms;
      if (!u.uGlint) return;
      u.uGlint.value = glint;
    });
    twinkles.material.uniforms.uTime.value = reduceMotion ? clock.t * 0.25 : clock.t;
    nearStars.material.uniforms.uTime.value = clock.t;
    const drift = reduceMotion ? 0.08 : 1;
    sky.rotation.y += dt * 0.012 * drift;
    nebula.position.x = Math.sin(clock.t * 0.07 * drift) * 1.15;
    nebula.position.y = 0.35 + Math.cos(clock.t * 0.05 * drift) * 0.35;
    nebula.material.opacity = 0.08 + (reduceMotion ? 0 : 0.04 * Math.sin(clock.t * 0.3));
    nebulaFar.position.x = Math.sin(clock.t * 0.03 * drift + 1) * 0.8;
    nebulaFar.material.opacity = 0.22 + (reduceMotion ? 0 : 0.06 * Math.sin(clock.t * 0.2));
    nearStars.rotation.y += dt * 0.02 * drift;
    nearStars.material.uniforms.uSpeed.value = 0;
    if (!reduceMotion && Math.floor(clock.t) % 11 === 0 && clock.t % 1 < dt + 0.02) {
      shoot.position.set((Math.random() - 0.5) * 30, (Math.random() - 0.2) * 12, -20 - Math.random() * 30);
      shoot.userData.life = 0.7;
      shoot.lookAt(camera.position);
    }
    if (shoot.userData.life > 0) {
      shoot.userData.life -= dt;
      shoot.position.x += dt * 18;
      shoot.position.y -= dt * 6;
      shoot.material.opacity = Math.max(0, shoot.userData.life);
    } else shoot.material.opacity = 0;
    heroShow.visible = phase === 'title' || phase === 'evolve';
    titlePlate.visible = phase === 'title';
    cutPlate.visible = phase === 'evolve';
    heroPlate.visible = !(flight && flight.mode === 'landed');
    sidePlate.visible = !!(flight && flight.mode === 'landed');
    root.visible = phase !== 'title';
    terrain.visible = flight && flight.mode === 'landed';
    shipRoot.visible = !!(flight && flight.mode !== 'atelier' && phase === 'flight');
    gate.visible = phase === 'build';
    if (phase === 'title') {
      const span = reduceMotion ? 8 : 16;
      const T = clock.t % span;
      let blur = 0;
      let bank = Math.sin(clock.t * 0.6) * 0.08;
      let pitch = 0;
      if (reduceMotion || T > 9) {
        heroShow.position.set(0.3 + Math.sin(clock.t * 0.28) * 0.35, -2.35 + Math.sin(clock.t * 0.8) * 0.06, 0);
        titlePlate.scale.setScalar(3.8);
      } else if (T < 6) {
        const u = T / 6;
        heroShow.position.set(-7 + u * 7.2, 1.1 - u * 2.6, -6 + u * 6);
        titlePlate.scale.setScalar(1.1 + u * 2.4);
        bank = 0.25 * (1 - u);
        pitch = -0.2 * (1 - u);
      } else {
        const u = (T - 6) / 3;
        heroShow.position.set(0.2 + u * 6.5, -1.5 - u * 0.4, u * 3.2);
        titlePlate.scale.setScalar(3.6 + Math.sin(u * Math.PI) * 1.4);
        blur = Math.sin(u * Math.PI);
        bank = 0.35 * Math.sin(u * Math.PI);
        if (!frame.whoosh && u > 0.35) {
          frame.whoosh = true;
          try { dispatchEvent(new CustomEvent('odyssey:whoosh')); } catch (err) { /* ignore */ }
        }
        if (u > 0.92) frame.whoosh = false;
      }
      titlePlate.material.uniforms.uBlur.value = reduceMotion ? 0 : blur;
      titlePlate.material.uniforms.uBank.value = bank;
      titlePlate.material.uniforms.uPitch.value = pitch;
      titlePlate.material.uniforms.uPulse.value = 0.7 + blur * 0.8;
      camera.position.lerp(new THREE.Vector3(0.15, 0.35 - Math.min(T, 8) * 0.02, 9.4 - Math.min(T, 8) * 0.15), 0.04);
      camera.lookAt(0.2, -1.05, 0);
      titlePlate.lookAt(camera.position);
      let crossed = false;
      beacons.forEach((star) => {
        aim.copy(star).sub(camera.position).normalize();
        toShip.copy(heroShow.position).sub(camera.position).normalize();
        if (aim.dot(toShip) > 0.992) crossed = true;
      });
      flare.position.copy(heroShow.position);
      flare.material.opacity = crossed && !reduceMotion ? 0.55 : 0;
      flare.scale.setScalar(crossed ? 2.2 : 1);
    } else if (phase === 'evolve') {
      heroShow.position.set(0.4, 0.2 + Math.sin(clock.t * 0.7) * 0.08, 0);
      camera.position.lerp(new THREE.Vector3(0.2, 1.1, 8.4), 0.06);
      camera.lookAt(0.4, 0.15, 0);
      cutPlate.lookAt(camera.position);
    } else if (flight && flight.mode === 'landed') {
      const cols = planetColors((flight.body && flight.body.composition) || 'rocky');
      terrain.material.uniforms.uA.value.copy(cols[0]);
      terrain.material.uniforms.uB.value.copy(cols[1]);
      terrain.material.uniforms.uSeed.value = (flight.body && flight.body.aAU) || 1;
      shipRoot.position.set(0, 1.35 + Math.sin(clock.t * 1.4) * 0.04, 0);
      shipRoot.rotation.set(0, 0, 0);
      sidePlate.lookAt(camera.position);
      camera.position.lerp(new THREE.Vector3(-3.4, 1.7, 4.4), 0.08);
      camera.lookAt(0, 0.9, 0);
    } else if (flight && flight.mode !== 'atelier' && phase === 'flight') {
      const ship = flight.pose;
      const bob = Math.sin(clock.t * 1.5) * (reduceMotion ? 0.01 : 0.05);
      const prevPos = shipRoot.userData.prevPos || shipRoot.position.clone();
      const speed = prevPos.distanceTo(new THREE.Vector3(ship.x, bob, ship.z)) / Math.max(0.016, dt);
      shipRoot.userData.prevPos = new THREE.Vector3(ship.x, bob, ship.z);
      nearStars.material.uniforms.uSpeed.value = reduceMotion ? 0 : Math.min(1.4, speed * 0.15);
      shipRoot.position.set(ship.x, bob, ship.z);
      const prev = shipRoot.userData.prevHeading || ship.heading;
      let delta = ship.heading - prev;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      shipRoot.userData.prevHeading = ship.heading;
      const bank = reduceMotion ? 0 : Math.max(-0.35, Math.min(0.35, -delta * 8));
      const pitch = reduceMotion ? 0 : Math.max(-0.25, Math.min(0.25, (flight.mode === 'orbit' ? -0.12 : 0.08) - speed * 0.01));
      if (flight.mode === 'orbit' && shipRoot.userData.wasCruise) shipRoot.userData.flare = 0.45;
      shipRoot.userData.wasCruise = flight.mode === 'cruise';
      if (shipRoot.userData.flare > 0) shipRoot.userData.flare -= dt;
      const flareAmt = Math.max(0, shipRoot.userData.flare || 0);
      heroPlate.material.uniforms.uBank.value = bank;
      heroPlate.material.uniforms.uPitch.value = pitch;
      heroPlate.material.uniforms.uPulse.value = 0.25 + thrust * 0.9 + flareAmt * 1.4;
      heroPlate.material.uniforms.uBlur.value = reduceMotion ? 0 : Math.min(0.85, speed * 0.04 + flareAmt);
      const nozzles = [[0.59, -0.02], [0.80, -0.01], [0.58, -0.14], [0.81, -0.13]];
      exhaust.forEach((puff, i) => {
        const n = nozzles[i % nozzles.length];
        const life = ((clock.t * (1.2 + thrust * 2.2) + i * 0.23) % 1);
        puff.position.set(n[0] + life * 0.55, n[1] + ((i % 2) - 0.5) * 0.02, 0);
        puff.material.opacity = thrust * (1 - life) * (1 - life) * 0.55;
        puff.scale.setScalar(0.035 + life * 0.05);
      });
      const back = flight.mode === 'orbit' ? 3.6 : 2.7;
      const hx = Math.cos(ship.heading);
      const hz = Math.sin(ship.heading);
      const want = new THREE.Vector3(ship.x - hx * back, 1.05, ship.z - hz * back);
      camera.position.lerp(want, 0.08);
      camera.lookAt(ship.x + hx * 0.5, 0.15, ship.z + hz * 0.5);
      heroPlate.lookAt(camera.position);
      heroPlate.rotateZ(bank);
      if (shipMesh && shipMesh.userData.plume) shipMesh.userData.plume.material.opacity = Math.min(0.9, ship.thrust || 0);
    } else {
      const span = 18 + Math.sin(clock.t * 0.1) * 2;
      camera.position.lerp(new THREE.Vector3(Math.cos(clock.t * 0.07) * span, 7 + Math.sin(clock.t * 0.13) * 0.6, Math.sin(clock.t * 0.07) * span), 0.04);
      camera.lookAt(0, 0, 0);
      gate.lookAt(camera.position);
    }
    root.children.forEach((child) => {
      if (child.userData && child.userData.star && child.material.uniforms) child.material.uniforms.uTime.value = clock.t;
      if (child.material && child.material.uniforms && child.material.uniforms.uCam) {
        child.material.uniforms.uCam.value.copy(camera.position);
      }
    });
    if (quality === 'high' && composer) composer.render();
    else renderer.render(scene, camera);
  }

  setQuality(quality);
  applySize();
  return { place, frame, dressShip, setQuality, resize: applySize, setMode(next) { mode = next; } };
}
