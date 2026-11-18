/* Star plates with a real alpha channel, over the starfield.
   Chrome and Firefox play the VP9 WebM. Safari and iOS play a stacked
   H.264 file (color on top, alpha underneath) through a WebGL shader,
   because this environment cannot encode Apple's HEVC-with-alpha.
   Each clip is a seamless 15 second loop, so it plays with the native loop. */
const HAVE = {
  o: { webm: 'assets/video/o-star.webm', pack: 'assets/video/o-star-pack.mp4', poster: 'assets/video/o-star-poster.png' },
  b: { webm: 'assets/video/b-star.webm', pack: 'assets/video/b-star-pack.mp4', poster: 'assets/video/b-star-poster.png' },
  a: { webm: 'assets/video/a-star.webm', pack: 'assets/video/a-star-pack.mp4', poster: 'assets/video/a-star-poster.png' },
  f: { webm: 'assets/video/f-star.webm', pack: 'assets/video/f-star-pack.mp4', poster: 'assets/video/f-star-poster.png' },
  g: { webm: 'assets/video/g-star.webm', pack: 'assets/video/g-star-pack.mp4', poster: 'assets/video/g-star-poster.png' },
  k: { webm: 'assets/video/k-star.webm', pack: 'assets/video/k-star-pack.mp4', poster: 'assets/video/k-star-poster.png' },
  m: { webm: 'assets/video/m-star.webm', pack: 'assets/video/m-star-pack.mp4', poster: 'assets/video/m-star-poster.png' },
  giant: { webm: 'assets/video/giant-star.webm', pack: 'assets/video/giant-star-pack.mp4', poster: 'assets/video/giant-star-poster.png' },
  wd: { webm: 'assets/video/wd-star.webm', pack: 'assets/video/wd-star-pack.mp4', poster: 'assets/video/wd-star-poster.png' },
  ns: { webm: 'assets/video/ns-star.webm', pack: 'assets/video/ns-star-pack.mp4', poster: 'assets/video/ns-star-poster.png' },
  bh: { webm: 'assets/video/bh-star.webm', pack: 'assets/video/bh-star-pack.mp4', poster: 'assets/video/bh-star-poster.png' }
};

function canUseWebm() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) return false;
  const probe = document.createElement('video');
  return !!probe.canPlayType('video/webm; codecs="vp9"');
}

function makeVideo() {
  const el = document.createElement('video');
  el.muted = true;
  el.defaultMuted = true;
  el.loop = true;
  el.setAttribute('playsinline', '');
  el.setAttribute('webkit-playsinline', '');
  el.preload = 'none';
  return el;
}

function sourceFor(webm, type) {
  const row = HAVE[type] || HAVE.g;
  return {
    url: webm ? row.webm : row.pack,
    poster: row.poster,
    fallback: !HAVE[type]
  };
}

export function createGFilm(root) {
  const webm = canUseWebm();
  root.classList.add('plate-slot');
  root.dataset.plate = '0';
  const slots = [makeSlot(root, webm, true)];
  for (let i = 1; i < 3; i++) {
    const el = document.createElement('div');
    el.className = 'plate-slot';
    el.dataset.plate = String(i);
    el.hidden = true;
    root.parentNode.appendChild(el);
    slots.push(makeSlot(el, webm, false));
  }
  const api = { failed: false, webm, ready: false, showing: false };
  api.prime = () => slots[0].load('g');
  api.layout = (plates) => {
    const list = plates || [];
    slots.forEach((slot, i) => slot.place(list[i] || null));
    api.showing = slots.some((slot) => slot.showing);
    api.ready = slots[0].ready;
    api.failed = slots[0].failed && !api.showing;
    window.__plateSrc = slots[0].src || '';
    window.__plateTypes = list.map((item) => item.type);
  };
  api.sync = (show) => api.layout(show ? [{ type: 'g', x: 0, y: 0, w: 400, h: 400, color: '#ffb15a' }] : null);
  api.tick = () => slots.forEach((slot) => slot.tick());
  return api;
}

function makeSlot(root, webm, primary) {
  const video = makeVideo();
  root.append(video);
  const tint = document.createElement('div');
  tint.className = 'plate-tint';
  root.append(tint);
  let canvas = null;
  let gl = null;
  let pack = null;
  if (!webm) {
    root.classList.add('pack');
    canvas = document.createElement('canvas');
    root.append(canvas);
    gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true });
    if (gl) pack = buildPack(gl);
  }
  const slot = { showing: false, ready: false, failed: false, src: '' };
  let type = '';

  video.addEventListener('error', () => {
    if (slot.src && slot.src !== sourceFor(webm, 'g').url) {
      const fallback = sourceFor(webm, 'g');
      slot.src = fallback.url;
      video.poster = fallback.poster;
      video.src = fallback.url;
      const again = video.play();
      if (again && again.catch) again.catch(() => { slot.failed = true; if (primary) root.dataset.failed = '1'; });
      return;
    }
    slot.failed = true;
    if (primary) root.dataset.failed = '1';
  });

  slot.load = (nextType) => {
    const pick = sourceFor(webm, nextType || 'g');
    if (video.src && slot.src === pick.url && type === (nextType || 'g')) return;
    type = nextType || 'g';
    slot.failed = false;
    slot.src = pick.url;
    video.poster = pick.poster;
    video.src = pick.url;
    root.dataset.type = type;
    root.dataset.fallback = pick.fallback ? '1' : '0';
    const kick = () => {
      const play = video.play();
      if (play && play.catch) play.catch(() => { slot.failed = true; });
    };
    if (video.readyState >= 2) kick();
    else video.addEventListener('canplay', kick, { once: true });
    video.load();
  };

  slot.place = (item) => {
    if (!item || slot.failed) {
      slot.showing = false;
      root.hidden = true;
      if (!video.paused) video.pause();
      return;
    }
    slot.showing = true;
    root.hidden = false;
    root.style.left = item.x + 'px';
    root.style.top = item.y + 'px';
    root.style.width = item.w + 'px';
    root.style.height = item.h + 'px';
    root.style.right = 'auto';
    root.style.bottom = 'auto';
    slot.load(item.type);
    const tintOn = root.dataset.fallback === '1' && item.type !== 'g';
    tint.classList.toggle('on', tintOn);
    tint.style.background = item.color || '#ffb15a';
    if (video.paused) {
      const play = video.play();
      if (play && play.catch) play.catch(() => {});
    }
  };

  slot.tick = () => {
    if (!slot.showing || slot.failed || root.hidden) return;
    if (!slot.ready && video.currentTime > 0.05) {
      slot.ready = true;
      if (primary) root.dataset.ready = '1';
    }
    if (!webm && gl && pack && video.readyState >= 2) drawPack(gl, pack, canvas, root, video);
  };
  return slot;
}

function drawPack(gl, pack, canvas, root, video) {
  const w = root.clientWidth || 1;
  const h = root.clientHeight || 1;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pw = Math.max(2, Math.round(w * dpr));
  const ph = Math.max(2, Math.round(h * dpr));
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
    gl.viewport(0, 0, pw, ph);
  }
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.bindTexture(gl.TEXTURE_2D, pack.textures[0]);
  try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video); } catch (err) { /* frame not ready */ }
  const va = 1280 / 726;
  const ca = pw / ph;
  let sx = 1;
  let sy = 1;
  if (ca > va) sx = va / ca;
  else sy = ca / va;
  gl.useProgram(pack.program);
  gl.uniform4f(pack.fit, sx, sy, (1 - sx) / 2, (1 - sy) / 2);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function buildPack(gl) {
  const vs = `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
  const fs = `precision mediump float; varying vec2 vUv; uniform sampler2D uA; uniform vec4 uFit;
    void main(){
      vec2 uv = (vUv - uFit.zw) / uFit.xy;
      if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) discard;
      vec3 rgb = texture2D(uA, vec2(uv.x, 0.5 + uv.y * 0.5)).rgb;
      float a = texture2D(uA, vec2(uv.x, uv.y * 0.5)).r;
      gl_FragColor = vec4(rgb * a, a);
    }`;
  function sh(type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    return shader;
  }
  const program = gl.createProgram();
  gl.attachShader(program, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(program, sh(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(program, 0, 'aPos');
  gl.linkProgram(program);
  gl.useProgram(program);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(gl.getUniformLocation(program, 'uA'), 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  return { program, textures: [tex], fit: gl.getUniformLocation(program, 'uFit') };
}
