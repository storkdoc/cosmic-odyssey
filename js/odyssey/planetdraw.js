/* Pole-on planet plates. The video is unlit albedo with the spin already in the
   loop (one turn every 15 seconds). Day, night, tilt, and the rim are applied
   here. A locked world stays on one facing: its +x limb points at the host. */
import * as THREE from '../../vendor/three/three.module.min.js';

const VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const FRAG = `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D uMap;
  uniform float uStacked;
  uniform float uDisk;
  uniform float uEmissive;
  uniform float uTilt;
  uniform float uSpin;
  uniform vec3 uAir;
  uniform vec2 uStar0;
  uniform vec2 uStar1;
  uniform vec2 uStar2;
  uniform float uLum0;
  uniform float uLum1;
  uniform float uLum2;

  float term(vec2 world, vec2 star, float lum) {
    if (lum <= 0.0) return 0.0;
    float x = dot(world, star);
    float bend = uTilt * (0.48 + 0.28 * (1.0 - dot(world, world)));
    return lum * smoothstep(-0.24, 0.32, x + bend);
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float edge = 1.0 - smoothstep(uDisk - 0.012, uDisk + 0.004, r);
    if (edge <= 0.001) discard;
    float aspect = 1.0;
    float x = vUv.x / aspect;
    float colorV = uStacked > 0.5 ? 0.5 + vUv.y * 0.5 : vUv.y;
    float matteV = vUv.y * 0.5;
    vec3 albedo = texture2D(uMap, vec2(x, colorV)).rgb;
    float matte = uStacked > 0.5 ? texture2D(uMap, vec2(x, matteV)).r : edge;
    float c = cos(uSpin);
    float s = sin(uSpin);
    vec2 world = vec2(p.x * c - p.y * s, -p.x * s - p.y * c);
    float lit = clamp(
      term(world, uStar0, uLum0) + term(world, uStar1, uLum1) + term(world, uStar2, uLum2),
      0.0, 1.0
    );
    float luma = dot(albedo, vec3(0.2126, 0.7152, 0.0722));
    float glow = smoothstep(0.4, 0.82, luma);
    float keep = mix(0.045, 1.0, glow * uEmissive);
    vec3 color = albedo * mix(keep, 1.0, lit);
    float rim = smoothstep(uDisk * 0.7, uDisk * 0.97, r) * edge;
    color += uAir * rim * (0.3 + 0.7 * lit);
    float alpha = max(matte, edge) * edge;
    gl_FragColor = vec4(color, alpha);
  }`;

const RING_FRAG = `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D uMap;
  uniform float uHalf;
  uniform vec2 uStar0;
  uniform vec2 uStar1;
  uniform vec2 uStar2;
  uniform float uLum0;
  uniform float uLum1;
  uniform float uLum2;

  float shade(vec2 pr, vec2 star, float lum) {
    if (lum <= 0.0) return 0.0;
    float along = dot(pr, star);
    float across = length(pr - star * along);
    float blocked = smoothstep(1.2, 0.7, across) * smoothstep(0.4, -0.2, along);
    float day = smoothstep(-0.15, 0.55, along / max(length(pr), 0.4));
    return lum * day * (1.0 - blocked);
  }

  void main() {
    vec4 ring = texture2D(uMap, vUv);
    if (ring.a < 0.04) discard;
    vec2 p = vUv * 2.0 - 1.0;
    vec2 pr = vec2(p.x, -p.y) * uHalf;
    float light = clamp(
      shade(pr, uStar0, uLum0) + shade(pr, uStar1, uLum1) + shade(pr, uStar2, uLum2),
      0.0, 1.0
    );
    vec3 color = ring.rgb * mix(0.08, 1.0, light);
    gl_FragColor = vec4(color, ring.a);
  }`;

function colorOf(hex) {
  const c = new THREE.Color(hex || '#000000');
  return c;
}

function makePlanetMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: null },
      uStacked: { value: 0 },
      uDisk: { value: 0.96875 },
      uEmissive: { value: 0 },
      uTilt: { value: Math.sin(20 * Math.PI / 180) },
      uSpin: { value: 0 },
      uAir: { value: new THREE.Vector3() },
      uStar0: { value: new THREE.Vector2(1, 0) },
      uStar1: { value: new THREE.Vector2() },
      uStar2: { value: new THREE.Vector2() },
      uLum0: { value: 1 },
      uLum1: { value: 0 },
      uLum2: { value: 0 }
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false
  });
}

function makeRingMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: null },
      uHalf: { value: 2.4 },
      uStar0: { value: new THREE.Vector2(1, 0) },
      uStar1: { value: new THREE.Vector2() },
      uStar2: { value: new THREE.Vector2() },
      uLum0: { value: 1 },
      uLum1: { value: 0 },
      uLum2: { value: 0 }
    },
    vertexShader: VERT,
    fragmentShader: RING_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false
  });
}

function noColor(texture) {
  if (texture && Object.prototype.hasOwnProperty.call(THREE, 'NoColorSpace')) texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

export function createPlanetLayer(scene) {
  const host = document.createElement('div');
  host.id = 'planet-bank';
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);
  const geo = new THREE.PlaneGeometry(2, 2);
  const loader = new THREE.TextureLoader();
  const ringTextures = new Map();
  const slots = [];
  let draft = null;

  function ringTexture(file) {
    if (!file) return null;
    if (!ringTextures.has(file)) {
      const tex = noColor(loader.load('assets/planets/' + file));
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      ringTextures.set(file, tex);
    }
    return ringTextures.get(file);
  }

  function makeSlot() {
    const video = document.createElement('video');
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.preload = 'auto';
    host.appendChild(video);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    noColor(texture);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const material = makePlanetMaterial();
    const mesh = new THREE.Mesh(geo, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    mesh.renderOrder = 6;
    mesh.frustumCulled = false;
    scene.add(mesh);
    const ringMat = makeRingMaterial();
    const ring = new THREE.Mesh(geo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    ring.renderOrder = 4;
    ring.frustumCulled = false;
    scene.add(ring);
    return { video, canvas, ctx, texture, material, mesh, ring, ringMat, id: '', kick: false, sawFrame: false };
  }

  function blit(slot) {
    const video = slot.video;
    if (video.readyState < 2 || !(video.videoWidth > 0)) return false;
    const half = video.videoHeight / 2;
    slot.ctx.drawImage(video, 0, 0, video.videoWidth, half, 0, 0, slot.canvas.width, slot.canvas.height);
    slot.texture.needsUpdate = true;
    slot.material.uniforms.uMap.value = slot.texture;
    slot.material.uniforms.uStacked.value = 0;
    slot.sawFrame = true;
    return true;
  }

  function loadPack(slot, spec) {
    const id = spec.id;
    if (slot.id === id && slot.video.src) return;
    slot.id = id;
    const poster = new Image();
    poster.src = spec.poster;
    poster.onload = () => {
      if (slot.id !== id || slot.sawFrame) return;
      slot.ctx.drawImage(poster, 0, 0, slot.canvas.width, slot.canvas.height);
      slot.texture.needsUpdate = true;
      slot.material.uniforms.uMap.value = slot.texture;
      slot.material.uniforms.uStacked.value = 0;
    };
    const url = spec.pack || ('assets/planets/' + id + '-pack.mp4');
    slot.video.src = url;
    const play = () => {
      const task = slot.video.play();
      if (task && task.catch) task.catch(() => {});
    };
    slot.video.addEventListener('canplay', () => {
      if (slot.id !== id) return;
      blit(slot);
      play();
    }, { once: true });
    play();
  }

  function starLights(planet, stars) {
    const dirs = (stars || []).map((star) => {
      const dx = star.x - planet.x;
      const dz = star.z - planet.z;
      const dist = Math.hypot(dx, dz) || 1;
      return { x: dx / dist, z: dz / dist, lum: (star.luminosity || 1) / (dist * dist) };
    });
    dirs.sort((a, b) => b.lum - a.lum);
    const top = Math.max((dirs[0] && dirs[0].lum) || 1, 1e-8);
    const pack = [0, 1, 2].map((i) => dirs[i]
      ? { x: dirs[i].x, z: dirs[i].z, lum: dirs[i].lum / top }
      : { x: 0, z: 0, lum: 0 });
    return pack;
  }

  function hostDirection(planet, stars) {
    const list = stars || [];
    let star = list[0];
    if (planet.spec.parent === 'star1') star = list[1] || star;
    else if (planet.spec.parent === 'star2') star = list[2] || star;
    else if (planet.spec.parent === 'bary' || planet.spec.parent === 'pair') {
      star = list.slice().sort((a, b) => (b.luminosity || 1) - (a.luminosity || 1))[0] || star;
    } else star = list[planet.spec.primary || 0] || star;
    if (!star) return { x: 1, z: 0 };
    const dx = star.x - planet.x;
    const dz = star.z - planet.z;
    const dist = Math.hypot(dx, dz) || 1;
    return { x: dx / dist, z: dz / dist };
  }

  function applyLights(uniforms, lights) {
    uniforms.uStar0.value.set(lights[0].x, lights[0].z);
    uniforms.uStar1.value.set(lights[1].x, lights[1].z);
    uniforms.uStar2.value.set(lights[2].x, lights[2].z);
    uniforms.uLum0.value = lights[0].lum;
    uniforms.uLum1.value = lights[1].lum;
    uniforms.uLum2.value = lights[2].lum;
  }

  function apply(slot, planet, stars) {
    const spec = planet.spec;
    const lights = starLights(planet, stars);
    const u = slot.material.uniforms;
    applyLights(u, lights);
    const air = colorOf(spec.atmosphere);
    u.uAir.value.set(air.r, air.g, air.b);
    u.uEmissive.value = spec.emission || 0;
    u.uDisk.value = spec.disk || 0.96875;
    u.uTilt.value = Math.sin(((spec.tilt != null ? spec.tilt : 20) * Math.PI) / 180);
    const host = hostDirection(planet, stars);
    const spin = spec.tidal ? Math.atan2(-host.z, host.x) : 0;
    u.uSpin.value = spin;
    slot.mesh.rotation.x = -Math.PI / 2;
    slot.mesh.rotation.y = spin;
    slot.mesh.position.set(planet.x, 0.03, planet.z);
    slot.mesh.scale.setScalar(Math.max(1e-4, planet.r));
    slot.mesh.visible = true;
    const ringFile = spec.rings;
    if (ringFile) {
      applyLights(slot.ringMat.uniforms, lights);
      slot.ringMat.uniforms.uMap.value = ringTexture(ringFile);
      slot.ringMat.uniforms.uHalf.value = spec.ringHalf || 2.4;
      slot.ring.position.set(planet.x, 0.02, planet.z);
      slot.ring.scale.setScalar(Math.max(1e-4, planet.r * (spec.ringHalf || 2.4)));
      slot.ring.visible = true;
    } else slot.ring.visible = false;
    blit(slot);
    if (slot.video.paused && !slot.kick) {
      slot.kick = true;
      const again = slot.video.play();
      if (again && again.finally) again.finally(() => { slot.kick = false; });
      else slot.kick = false;
    }
  }

  function slotFor(index) {
    while (slots.length <= index) slots.push(makeSlot());
    return slots[index];
  }

  return {
    sync(list, stars) {
      (list || []).forEach((planet, i) => {
        const slot = slotFor(i);
        loadPack(slot, planet.spec);
        apply(slot, planet, stars);
      });
      for (let i = (list || []).length; i < slots.length; i++) {
        slots[i].mesh.visible = false;
        slots[i].ring.visible = false;
      }
      const first = slots[0];
      window.__planetSpin = first && first.mesh.visible ? first.mesh.rotation.y : null;
      window.__planetVideo = first ? {
        w: first.video.videoWidth,
        t: first.video.currentTime,
        ready: first.video.readyState,
        stacked: first.material.uniforms.uStacked.value
      } : null;
      window.__planetRing = first && first.ring.visible ? {
        half: first.ringMat.uniforms.uHalf.value,
        scale: first.ring.scale.x
      } : null;
    },
    showDraft(planet, stars) {
      if (!planet) {
        if (draft) {
          draft.mesh.visible = false;
          draft.ring.visible = false;
        }
        return;
      }
      if (!draft) draft = makeSlot();
      loadPack(draft, planet.spec);
      apply(draft, planet, stars);
    },
    clear() {
      slots.forEach((slot) => {
        slot.mesh.visible = false;
        slot.ring.visible = false;
      });
      if (draft) {
        draft.mesh.visible = false;
        draft.ring.visible = false;
      }
    }
  };
}
