/* A NASA sky, up to three living stars, and a camera that can see one surface or the whole system. */
import * as THREE from '../../vendor/three/three.module.min.js';
import { positionsAt, pathCenters } from './systems.js';
import { EffectComposer } from '../../vendor/three/postprocessing/EffectComposer.js';
import { RenderPass } from '../../vendor/three/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../../vendor/three/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../../vendor/three/postprocessing/OutputPass.js';
import { starType } from './stars.js';

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
  void main(){
    vec3 n = normalize(vN);
    vec3 V = normalize(uCam - vW);
    float mu = pow(clamp(dot(n, V), 0.0, 1.0), 0.55);
    float g = noise(n * 7.0 + vec3(uRot, uTime * 0.05, 0.0));
    float fine = noise(n * 18.0 + vec3(0.0, uRot * 1.4, uTime * 0.08));
    float cells = smoothstep(0.32, 0.78, g);
    vec3 col = uColor * (0.48 + 1.0 * mu) * mix(0.62, 1.12, cells) * (0.88 + 0.22 * fine);
    float spot = smoothstep(0.12, 0.02, distance(n, normalize(vec3(sin(uRot), 0.25, cos(uRot)))))
               + smoothstep(0.08, 0.015, distance(n, normalize(vec3(-0.4, sin(uRot * 0.7), 0.6))));
    col *= 1.0 - spot * (0.25 + uActivity) * 0.55;
    float flarePos = smoothstep(0.22, 0.0, distance(n, normalize(vec3(0.2, 0.55, 0.8))));
    col += vec3(1.0, 0.85, 0.55) * flarePos * uFlare * 2.2;
    if (uKind > 1.5) {
      col = mix(vec3(0.01, 0.008, 0.006), col, 0.15);
    }
    gl_FragColor = vec4(col, 1.0);
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

function prominence(color, scale, tilt) {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const a = (t - 0.5) * 1.1;
    pts.push(new THREE.Vector3(Math.sin(a) * 0.55, Math.cos(a) * 0.85 * scale + 0.95, 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.045, 8, false), new THREE.MeshBasicMaterial({
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

  const tint = new THREE.TextureLoader().load('assets/art/starfield.jpg');
  tint.colorSpace = THREE.SRGBColorSpace;
  const nebula = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 24), new THREE.MeshBasicMaterial({
    map: tint, side: THREE.BackSide, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  scene.add(nebula);

  const farStars = makePoints(roundPoints(coarse ? 220 : 420, 420, false), 1.15);
  const nearStars = makePoints(roundPoints(coarse ? 50 : 90, 80, true), 1.7);
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
    const disk = new THREE.Mesh(new THREE.RingGeometry(1.35, 3.2, 96), new THREE.MeshBasicMaterial({
      color: 0xffb15a, side: THREE.DoubleSide, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    disk.rotation.x = 1.15;
    const lens = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.035, 8, 80), new THREE.MeshBasicMaterial({
      color: 0xfff4e4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    lens.rotation.x = 1.15;
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
    for (let i = 0; i < (coarse ? 3 : 5); i++) loops.add(prominence(loopColor, 0.75 + (i % 3) * 0.28, i * 1.2));
    const ejecta = makePoints(roundPoints(coarse ? 28 : 48, 1.1, true), 2.4);
    ejecta.visible = false;
    group.add(star, corona, disk, lens, beams, loops, ejecta);
    group.visible = false;
    scene.add(group);
    return { group, star, corona, disk, lens, beams, loops, ejecta, flare: 0, flareIn: 4 + Math.random() * 5, spin: Math.random(), spec: null, loopColor };
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
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.28, 0.45, 0.85));
    composer.addPass(new OutputPass());
  }
  function applySize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 2 : 3);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
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

  const cam = { theta: 0.5, phi: 1.05, dist: 7.2, target: 7.2, dragging: false, lastX: 0, lastY: 0, pointers: new Map() };
  let showBody = false;
  let mode = 'sky';
  let sys = null;
  let pathsOn = true;
  let zmin = 1.7;
  let zmax = 16;
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
    body.disk.material.opacity = type.kind === 'bh' ? 0.9 : 0;
    body.lens.material.opacity = type.kind === 'bh' ? 0.85 : 0;
    const spin = Math.max(0, Math.min(0.998, Number(next.spin) || 0));
    if (type.kind === 'bh') {
      const inner = 1.15 + (1 - spin) * 0.7;
      body.disk.scale.set(1, 1, 1);
      body.disk.geometry.dispose();
      body.disk.geometry = new THREE.RingGeometry(inner, 3.3, 96);
    }
  }

  function focusBody(body) {
    body.group.visible = true;
    body.group.position.set(0, 0, 0);
    body.group.scale.setScalar(1);
  }

  function setStar(next) {
    mode = 'focus';
    sys = null;
    zmin = 1.7;
    zmax = 16;
    camera.near = 0.02;
    camera.updateProjectionMatrix();
    pathLines.forEach((line) => { line.visible = false; });
    if (!showBody) cam.target = 6.4;
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
      line.geometry.dispose();
      line.material.dispose();
    });
    pathLines = [];
  }

  function makeCircle(radius) {
    const pts = [];
    const steps = 128;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({
      color: 0xf0e2cc, transparent: true, opacity: 0.8
    }));
    line.visible = pathsOn;
    pathRoot.add(line);
    pathLines.push(line);
  }

  function setSystem(layout) {
    sys = layout;
    mode = 'system';
    clearPaths();
    const stars = layout.stars || [];
    showBody = stars.length > 0;
    bodies.forEach((body, i) => {
      const star = stars[i];
      body.group.visible = !!star;
      if (star) paintBody(body, star);
    });
    (layout.paths || []).forEach((p) => makeCircle(p.radius));
    const draws = stars.map((s) => s.drawAU || 0.02);
    const maxDraw = draws.length ? Math.max(...draws) : 0.02;
    const span = Math.max(layout.span || 1, maxDraw * 8);
    zmin = stars.length ? Math.max(0.004, maxDraw * 2.2) : 3;
    zmax = Math.max(span * 6, zmin * 5);
    cam.target = Math.min(zmax * 0.92, Math.max(zmin * 1.8, span * 1.55));
    camera.near = Math.min(0.02, zmin * 0.05);
    camera.far = 8000;
    camera.updateProjectionMatrix();
    window.__paths = pathsOn;
  }

  function setPaths(on) {
    pathsOn = !!on;
    window.__paths = pathsOn;
    if (mode === 'system') pathLines.forEach((line) => { line.visible = pathsOn; });
  }

  function zoomBy(factor) {
    cam.target = Math.min(zmax, Math.max(zmin, cam.target * factor));
  }

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomBy(e.deltaY > 0 ? 1.08 : 0.92);
  }, { passive: false });
  canvas.addEventListener('pointerdown', (e) => {
    cam.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    cam.dragging = cam.pointers.size === 1;
    cam.lastX = e.clientX;
    cam.lastY = e.clientY;
    cam.pinch = cam.pointers.size === 2 ? pinchDist() : 0;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!cam.pointers.has(e.pointerId)) return;
    cam.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (cam.pointers.size === 2) {
      const d = pinchDist();
      if (cam.pinch) zoomBy(cam.pinch / d);
      cam.pinch = d;
      return;
    }
    if (!cam.dragging) return;
    const dx = e.clientX - cam.lastX;
    const dy = e.clientY - cam.lastY;
    cam.lastX = e.clientX;
    cam.lastY = e.clientY;
    cam.theta -= dx * 0.005;
    cam.phi = Math.min(2.6, Math.max(0.45, cam.phi - dy * 0.005));
  });
  const endPointer = (e) => { cam.pointers.delete(e.pointerId); cam.dragging = cam.pointers.size === 1; };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  function pinchDist() {
    const pts = [...cam.pointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  function frame(dt) {
    const time = clockTime(dt);
    const drift = reduce ? 0.15 : 1;
    sky.rotation.y += dt * 0.008 * drift;
    nebula.rotation.y -= dt * 0.012 * drift;
    farStars.rotation.y += dt * 0.004 * drift;
    nearStars.rotation.y += dt * 0.02 * drift;
    farStars.material.uniforms.uTime.value = time;
    nearStars.material.uniforms.uTime.value = time;
    bodies.forEach((body) => { body.ejecta.material.uniforms.uTime.value = time; });
    const speed = Math.abs(cam.dist - cam.target);
    farStars.material.uniforms.uSpeed.value = reduce ? 0 : Math.min(1.2, speed * 0.8);
    nearStars.material.uniforms.uSpeed.value = reduce ? 0 : Math.min(1.6, speed * 1.4);
    cam.dist += (cam.target - cam.dist) * (1 - Math.pow(0.001, Math.max(0.016, dt)));
    const sinP = Math.sin(cam.phi);
    camera.position.set(
      sinP * Math.sin(cam.theta) * cam.dist,
      Math.cos(cam.phi) * cam.dist,
      sinP * Math.cos(cam.theta) * cam.dist
    );
    camera.lookAt(0, 0, 0);
    if (mode === 'system' && sys && sys.count > 0) {
      const turns = time / (reduce ? 48 : 18);
      const placed = positionsAt(sys, turns);
      placed.forEach((p, i) => {
        const body = bodies[i];
        if (!body || !body.group.visible) return;
        body.group.position.set(p.x, 0, p.z);
        body.group.scale.setScalar(Math.max(1e-4, p.drawAU));
      });
      const centers = pathCenters(sys, turns);
      centers.forEach((c, i) => {
        if (pathLines[i]) pathLines[i].position.set(c.x, 0, c.z);
      });
    }
    bodies.forEach((body) => {
      if (!body.group.visible || !body.spec) return;
      const spec = body.spec;
      const type = starType(spec.type);
      const shown = showBody;
      body.spin += dt * (0.05 + (spec.rotation ? 2 / Math.max(0.2, spec.rotation) : 0.1)) * (reduce ? 0.25 : 1);
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
      body.corona.visible = shown;
      body.loops.visible = shown && type.kind !== 'bh' && type.kind !== 'ns' && type.kind !== 'wd';
      body.disk.visible = shown && type.kind === 'bh';
      body.lens.visible = shown && type.kind === 'bh';
      body.beams.visible = shown && type.kind === 'ns';
      const breathe = 2.8 + (spec.activity || 0) * 1.1 + body.flare * 1.8;
      body.corona.scale.setScalar(type.kind === 'ns' ? 2.4 : type.kind === 'wd' ? 2.1 : breathe);
      body.corona.material.opacity = type.kind === 'bh' ? 0.22 : 0.55 + body.flare * 0.4;
      body.loops.children.forEach((loop, i) => {
        const rise = Math.max(0, (spec.activity || 0) - 0.32);
        loop.material.opacity = shown ? rise * (0.9 + 0.25 * Math.sin(time * 0.8 + i)) : 0;
        loop.rotation.y += dt * 0.04 * (i % 2 ? 1 : -1);
      });
      const mag = Number(spec.magnetic) || 0;
      body.beams.rotation.y += dt * (type.kind === 'ns' ? 0.8 + Math.max(0, mag - 11) * 0.45 : 0.05);
      body.disk.rotation.z += dt * (0.2 + Math.max(0, Number(spec.spin) || 0) * 1.8);
      body.lens.rotation.z += dt * 0.05;
      const cme = shown && body.flare > 0.35 && (spec.activity || 0) > 0.4;
      body.ejecta.visible = cme;
      body.ejecta.scale.setScalar(1.2 + (1 - body.flare) * 4.5);
      body.ejecta.position.y = 1.1 + (1 - body.flare) * 1.8;
    });
    if (quality === 'high' && composer) composer.render();
    else renderer.render(scene, camera);
  }

  let tAccum = 0;
  function clockTime(dt) {
    if (dt) tAccum += dt;
    return tAccum;
  }

  applySize();
  return {
    frame,
    setStar,
    setSystem,
    setPaths,
    zoomBy,
    resize: applySize,
    distance: () => cam.dist,
    onFlare: (fn) => { onFlare.fn = fn; }
  };
}
