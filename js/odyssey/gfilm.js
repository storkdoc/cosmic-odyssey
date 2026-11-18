/* The G-star plate, with a real alpha channel, over the starfield.
   Chrome and Firefox play the VP9 WebM. Safari and iOS play a stacked
   H.264 file (color on top, alpha underneath) through a WebGL shader,
   because this environment cannot encode Apple's HEVC-with-alpha. */
const FADE = 0.7;

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
  el.setAttribute('playsinline', '');
  el.setAttribute('webkit-playsinline', '');
  el.preload = 'none';
  return el;
}

export function createGFilm(root) {
  const webm = canUseWebm();
  const a = makeVideo();
  const b = makeVideo();
  a.poster = 'assets/video/g-star-poster.png';
  root.append(a, b);
  let canvas = null;
  let gl = null;
  let pack = null;
  if (!webm) {
    root.classList.add('pack');
    canvas = document.createElement('canvas');
    canvas.id = 'g-pack';
    root.append(canvas);
    gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true });
    if (gl) pack = buildPack(gl);
  }
  const tint = document.createElement('div');
  tint.className = 'plate-tint';
  root.append(tint);
  const api = { failed: false, webm, ready: false, showing: false, fallback: false };
  let currentType = '';
  let started = false;
  let lead = 0;
  let handoff = false;
  const fallbackSrc = webm ? 'assets/video/g-star.webm' : 'assets/video/g-star-pack.mp4';
  const missing = new Set();
  let src = fallbackSrc;

  function chooseSrc(type) {
    const name = type || 'g';
    if (name === 'g' || missing.has(name)) return { url: fallbackSrc, fallback: name !== 'g' };
    return {
      url: webm ? 'assets/video/' + name + '.webm' : 'assets/video/' + name + '-pack.mp4',
      fallback: false
    };
  }

  a.addEventListener('error', () => {
    if (currentType && currentType !== 'g' && !missing.has(currentType)) {
      missing.add(currentType);
      api.fallback = true;
      src = fallbackSrc;
      a.src = fallbackSrc;
      b.src = fallbackSrc;
      const again = a.play();
      if (again && again.catch) again.catch(() => { api.failed = true; root.dataset.failed = '1'; });
      return;
    }
    api.failed = true;
    root.dataset.failed = '1';
  });

  /* Types whose plates are in the repo. Others use the G plate, tinted, until
     assets/video/<type>.webm and <type>-pack.mp4 are added here. */
  const HAVE = {
    g: { webm: 'assets/video/g-star.webm', pack: 'assets/video/g-star-pack.mp4' }
  };
  function sourceFor(type) {
    const name = type || 'g';
    const row = HAVE[name];
    if (row && !missing.has(name)) return { url: webm ? row.webm : row.pack, fallback: false };
    return { url: webm ? HAVE.g.webm : HAVE.g.pack, fallback: name !== 'g' };
  }

  function load(type) {
    const name = type || currentType || 'g';
    const pick = sourceFor(name);
    const next = pick.url;
    if (started && next === src && currentType === name && !api.failed) return;
    started = true;
    api.failed = false;
    api.fallback = !!pick.fallback;
    src = next;
    currentType = name;
    a.src = src;
    b.src = src;
    const kick = () => {
      const p = a.play();
      if (p && p.catch) p.catch(() => { api.failed = true; root.dataset.failed = '1'; });
    };
    if (a.readyState >= 2) kick();
    else a.addEventListener('canplay', kick, { once: true });
    a.load();
    b.load();
  }

  function setFade(leadOpacity, otherOpacity) {
    if (webm) {
      a.style.opacity = String(lead === 0 ? leadOpacity : otherOpacity);
      b.style.opacity = String(lead === 1 ? leadOpacity : otherOpacity);
    }
    api.mix = lead === 0 ? otherOpacity : leadOpacity;
  }

  function tick() {
    if (!started || api.failed || root.hidden) return;
    const A = lead === 0 ? a : b;
    const B = lead === 0 ? b : a;
    if (!(A.duration > 1)) return;
    if (!api.ready && A.currentTime > 0.05) {
      api.ready = true;
      root.dataset.ready = '1';
    }
    const remain = A.duration - A.currentTime;
    if (remain < FADE) {
      if (!handoff) {
        handoff = true;
        root.dataset.handoff = '1';
        try { B.currentTime = 0; } catch (err) { /* not seekable yet */ }
      }
      if (B.paused) {
        const play = B.play();
        if (play && play.catch) play.catch(() => {});
      }
      const u = Math.min(1, Math.max(0, 1 - remain / FADE));
      setFade(1 - u, u);
      if (u >= 1) {
        try { A.pause(); } catch (err) { /* ignore */ }
        lead = 1 - lead;
        handoff = false;
        setFade(1, 0);
      }
    } else if (!handoff) setFade(1, 0);
    if (!webm && gl && pack) drawPack();
  }

  function drawPack() {
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
    [a, b].forEach((video, i) => {
      if (video.readyState < 2) return;
      gl.bindTexture(gl.TEXTURE_2D, pack.textures[i]);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video); } catch (err) { /* frame not ready */ }
    });
    const va = 1280 / 726;
    const ca = pw / ph;
    let sx = 1;
    let sy = 1;
    if (ca > va) sx = va / ca;
    else sy = ca / va;
    gl.useProgram(pack.program);
    gl.uniform4f(pack.fit, sx, sy, (1 - sx) / 2, (1 - sy) / 2);
    gl.uniform1f(pack.mix, api.mix || 0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  api.prime = () => load(currentType || 'g');
  api.layout = (plates) => {
    const item = plates && plates[0];
    const on = !!(item && !api.failed);
    api.showing = on;
    root.hidden = !on;
    if (!on) return;
    root.style.left = item.x + 'px';
    root.style.top = item.y + 'px';
    root.style.width = item.w + 'px';
    root.style.height = item.h + 'px';
    root.style.right = 'auto';
    root.style.bottom = 'auto';
    if (item.type !== currentType) load(item.type);
    else load(item.type);
    const tintOn = api.fallback && item.type !== 'g';
    tint.classList.toggle('on', tintOn);
    tint.style.background = item.color || '#ffb15a';
    window.__plateSrc = src;
  };
  api.sync = (show) => api.layout(show ? [{ type: 'g', x: 0, y: 0, w: 400, h: 400, color: '#ffb15a' }] : null);
  api.tick = tick;
  setFade(1, 0);
  return api;
}

function buildPack(gl) {
  const vs = `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
  const fs = `precision mediump float; varying vec2 vUv; uniform sampler2D uA; uniform sampler2D uB; uniform float uMix; uniform vec4 uFit;
    vec4 samplePack(sampler2D tex, vec2 uv) {
      vec2 top = vec2(uv.x, 0.5 + uv.y * 0.5);
      vec2 bot = vec2(uv.x, uv.y * 0.5);
      vec3 rgb = texture2D(tex, top).rgb;
      float a = texture2D(tex, bot).r;
      return vec4(rgb * a, a);
    }
    void main(){
      vec2 uv = (vUv - uFit.zw) / uFit.xy;
      if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) discard;
      gl_FragColor = mix(samplePack(uA, uv), samplePack(uB, uv), uMix);
    }`;
  function sh(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
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
  const textures = [];
  for (let i = 0; i < 2; i++) {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(program, i === 0 ? 'uA' : 'uB'), i);
    textures.push(tex);
  }
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  return { program, textures, fit: gl.getUniformLocation(program, 'uFit'), mix: gl.getUniformLocation(program, 'uMix') };
}
