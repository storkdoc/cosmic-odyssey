/* Every star is a camera-facing quad in the WebGL scene.
   The source is the stacked H.264 pack (color on top, matte below), which
   plays in Chrome, Safari, and iOS. The shader throws the rectangle away:
   a round fade, a smoothed matte, and additive premultiplied color so black
   adds nothing. A black hole keeps a normal alpha blend so its shadow stays black. */
import * as THREE from '../../vendor/three/three.module.min.js';

const PACKS = {
  o: 'assets/video/o-star-pack.mp4',
  b: 'assets/video/b-star-pack.mp4',
  a: 'assets/video/a-star-pack.mp4',
  f: 'assets/video/f-star-pack.mp4',
  g: 'assets/video/g-star-pack.mp4',
  k: 'assets/video/k-star-pack.mp4',
  m: 'assets/video/m-star-pack.mp4',
  giant: 'assets/video/giant-star-pack.mp4',
  wd: 'assets/video/wd-star-pack.mp4',
  ns: 'assets/video/ns-star-pack.mp4',
  bh: 'assets/video/bh-star-pack.mp4'
};

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
  uniform float uHole;
  void main() {
    float aspect = 1280.0 / 726.0;
    float x = (1.0 - 1.0 / aspect) * 0.5 + vUv.x / aspect;
    float colorV = 0.5 + vUv.y * 0.5;
    float matteV = vUv.y * 0.5;
    vec3 rgb = texture2D(uMap, vec2(x, colorV)).rgb;
    float matte = texture2D(uMap, vec2(x, matteV)).r;
    float soft = smoothstep(0.06, 0.42, matte);
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float solid = 1.0 - smoothstep(0.40, 0.68, r);
    float feather = 1.0 - smoothstep(0.82, 0.995, r);
    float alpha = max(soft, solid) * feather;
    if (uHole > 0.5) {
      gl_FragColor = vec4(rgb, alpha);
    } else {
      gl_FragColor = vec4(rgb * alpha, alpha);
    }
  }`;

function makeVideo() {
  const el = document.createElement('video');
  el.muted = true;
  el.defaultMuted = true;
  el.loop = true;
  el.playsInline = true;
  el.setAttribute('playsinline', '');
  el.setAttribute('webkit-playsinline', '');
  el.preload = 'auto';
  return el;
}

function makeMaterial(texture) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uHole: { value: 0 }
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor
  });
  return material;
}

function applyBlend(material, hole) {
  material.uniforms.uHole.value = hole ? 1 : 0;
  if (hole) {
    material.blending = THREE.NormalBlending;
    material.blendSrc = THREE.SrcAlphaFactor;
    material.blendDst = THREE.OneMinusSrcAlphaFactor;
    material.blendSrcAlpha = THREE.OneFactor;
    material.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  } else {
    material.blending = THREE.CustomBlending;
    material.blendEquation = THREE.AddEquation;
    material.blendSrc = THREE.OneFactor;
    material.blendDst = THREE.OneFactor;
    material.blendSrcAlpha = THREE.ZeroFactor;
    material.blendDstAlpha = THREE.OneFactor;
  }
  material.needsUpdate = true;
}

export function createPlateBank(scene) {
  const host = document.createElement('div');
  host.id = 'plate-bank';
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);
  const geo = new THREE.PlaneGeometry(2, 2);
  const slots = [0, 1, 2].map((index) => {
    const video = makeVideo();
    host.appendChild(video);
    const texture = new THREE.VideoTexture(video);
    if (Object.prototype.hasOwnProperty.call(THREE, 'NoColorSpace')) texture.colorSpace = THREE.NoColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    const material = makeMaterial(texture);
    const mesh = new THREE.Mesh(geo, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    mesh.renderOrder = 6;
    mesh.frustumCulled = false;
    mesh.position.y = 0.05 + index * 0.002;
    scene.add(mesh);
    return { video, texture, material, mesh, type: '', ready: false, failed: false };
  });

  function load(slot, type) {
    const next = type || 'g';
    const url = PACKS[next] || PACKS.g;
    if (slot.type === next && slot.video.src) return;
    slot.type = next;
    slot.ready = false;
    slot.failed = false;
    slot.video.poster = '';
    slot.video.src = url;
    applyBlend(slot.material, next === 'bh');
    const play = () => {
      const task = slot.video.play();
      if (task && task.catch) task.catch(() => {});
    };
    slot.video.addEventListener('canplay', play, { once: true });
    play();
  }

  function tick() {
    let ready = false;
    const srcs = [];
    slots.forEach((slot) => {
      if (slot.video.readyState >= 2 && slot.video.videoWidth > 0) {
        if (slot.video.paused && !slot.kick) {
          slot.kick = true;
          const again = slot.video.play();
          if (again && again.finally) again.finally(() => { slot.kick = false; });
          else slot.kick = false;
        }
        slot.ready = true;
        slot.texture.needsUpdate = true;
      }
      if (slot.mesh.visible && slot.ready) ready = true;
      if (slot.video.currentSrc) srcs.push(slot.video.currentSrc);
    });
    window.__plateReady = slots[0].ready ? '1' : '';
    window.__plateSrcs = srcs;
    return ready;
  }

  function sync(list, hidden) {
    slots.forEach((slot, i) => {
      const item = list[i];
      if (!item || !item.star) {
        slot.mesh.visible = false;
        return;
      }
      load(slot, item.star.type || 'g');
      const hole = (item.star.type || '') === 'bh';
      if ((slot.material.uniforms.uHole.value > 0.5) !== hole) applyBlend(slot.material, hole);
      slot.mesh.position.x = item.x;
      slot.mesh.position.z = item.z;
      slot.mesh.scale.setScalar(Math.max(1e-4, item.r));
      slot.mesh.visible = !hidden && slot.ready;
    });
    tick();
  }

  return {
    slots,
    tick,
    sync,
    prime() { load(slots[0], 'g'); }
  };
}
