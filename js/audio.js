/* Recorded orchestral music only. Two <audio> elements, no crossOrigin,
   play() inside the first gesture, playback audio session on iOS.
   Cues crossfade. Flight tracks shuffle. The elements are not wired into Web Audio.
   Jupiter and Dvořák were re-checked on Wikimedia Commons on 16 Nov 2026:
   Jupiter’s license box requires attribution (kept, credit Musopen);
   Dvořák IV is a Musopen public-domain release (kept). */
export const TRACKS = [
  {
    id: 'zarathustra',
    file: 'audio/zarathustra.mp3',
    composer: 'Richard Strauss',
    piece: 'Also sprach Zarathustra — Sunrise',
    performer: 'Philip Milman, conductor. Recording funded by Ludwig Ahgren and jschlatt',
    license: 'CC BY 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:Richard_Strauss_-_Also_Sprach_Zarathustra_-_Phillip_Milman_-_Lud_and_Schlatts_Musical_Emporium.wav'
  },
  {
    id: 'jupiter',
    file: 'audio/jupiter.mp3',
    composer: 'Gustav Holst',
    piece: 'The Planets — Jupiter, the Bringer of Jollity',
    performer: 'Skidmore College Orchestra, via Musopen',
    license: 'CC BY (credit Musopen)',
    page: 'https://commons.wikimedia.org/wiki/File:Gustav_Holst_-_the_planets,_op._32_-_iv._jupiter,_the_bringer_of_jollity.ogg'
  },
  {
    id: 'venus',
    file: 'audio/venus.mp3',
    composer: 'Gustav Holst',
    piece: 'The Planets — Venus, the Bringer of Peace',
    performer: 'United States Air Force Heritage of America Band. Transcription by Merlin Patterson',
    license: 'Public domain',
    page: 'https://commons.wikimedia.org/wiki/File:Holst-_venus.ogg'
  },
  {
    id: 'mercury',
    file: 'audio/mercury.mp3',
    composer: 'Gustav Holst',
    piece: 'The Planets — Mercury, the Winged Messenger',
    performer: 'United States Air Force Heritage of America Band',
    license: 'Public domain',
    page: 'https://commons.wikimedia.org/wiki/File:Holst_The_Planets_Mercury.ogg'
  },
  {
    id: 'dvorak',
    file: 'audio/dvorak.mp3',
    composer: 'Antonín Dvořák',
    piece: 'Symphony No. 9 — IV. Allegro con fuoco',
    performer: 'Public-domain recording released by Musopen',
    license: 'Public domain (Musopen)',
    page: 'https://commons.wikimedia.org/wiki/File:Antonin_Dvorak_-_symphony_no._9_in_e_minor_%27from_the_new_world%27,_op._95_-_iv._allegro_con_fuoco.ogg'
  },
  {
    id: 'valkyrie',
    file: 'audio/valkyrie.mp3',
    composer: 'Richard Wagner',
    piece: 'Die Walküre — Ride of the Valkyries',
    performer: 'Philip Milman, conductor. Recording funded by Ludwig Ahgren and jschlatt',
    license: 'CC BY 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:Ride_of_the_Valkyries.ogg'
  }
];

const CUE = {
  open: 'zarathustra',
  quiet: 'venus',
  launch: 'jupiter',
  rescue: 'valkyrie'
};
const FLIGHT = ['mercury', 'dvorak', 'jupiter'];

function byId(id) { return TRACKS.find((t) => t.id === id); }

function shuffle(list, rand) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

export function createAudio(rand = Math.random) {
  const holder = document.createElement('div');
  holder.setAttribute('aria-hidden', 'true');
  holder.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
  function make() {
    const el = document.createElement('audio');
    el.preload = 'auto';
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', '');
    holder.appendChild(el);
    return el;
  }
  const a = make();
  const b = make();
  const mount = () => { if (!holder.parentNode) document.body.appendChild(holder); };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  const api = {
    a, b, tracks: TRACKS, current: byId('zarathustra'), cue: 'open',
    volume: 0.8, muted: false, unlocked: false, bag: shuffle(FLIGHT, rand)
  };
  let shown = a;
  let hidden = b;
  let fade = null;

  function href(track) { return new URL(track.file, document.baseURI).href; }
  function level() { return api.muted ? 0 : Math.max(0, Math.min(1, api.volume)); }
  api.sfx = { ui() {}, probe() {}, burn() {}, ping() {}, warn() {} };

  function assign(el, track) {
    const next = href(track);
    if (el.src !== next) el.src = next;
  }
  assign(shown, api.current);
  assign(hidden, byId('venus'));

  api.setVolume = (v) => { api.volume = Math.max(0, Math.min(1, v)); if (!fade) shown.volume = level(); };
  api.setMuted = (m) => { api.muted = !!m; if (!fade) shown.volume = level(); };
  api.toggleMuted = () => api.setMuted(!api.muted);

  api.start = () => {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* older browsers */ }
    api.unlocked = true;
    shown.volume = level();
    hidden.volume = 0;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC && !api._ctx) {
        const ctx = new AC();
        const resume = ctx.resume();
        if (resume && resume.catch) resume.catch(() => {});
        api._ctx = ctx;
        const blip = (freq, dur, type, gain) => {
          if (!ctx || api.muted) return;
          const t = ctx.currentTime;
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = type || 'sine';
          o.frequency.setValueAtTime(freq, t);
          g.gain.setValueAtTime(gain, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + dur);
          o.connect(g); g.connect(ctx.destination);
          o.start(t); o.stop(t + dur + 0.02);
        };
        api.sfx = {
          mine: () => blip(140, 0.04, 'square', 0.012),
          land: () => blip(220, 0.18, 'sine', 0.03),
          ping: () => blip(660, 0.08, 'sine', 0.03),
          rescue: () => blip(440, 0.22, 'triangle', 0.04)
        };
      }
    } catch (e) { /* effects stay silent if the context is blocked */ }
    const p1 = shown.play();
    const p2 = hidden.play();
    if (p1 && p1.catch) p1.catch(() => {});
    if (p2 && p2.then) p2.then(() => { if (hidden.volume === 0) hidden.pause(); }).catch(() => {});
    else if (p2 && p2.catch) p2.catch(() => {});
  };

  function takeFlight() {
    if (!api.bag.length) api.bag = shuffle(FLIGHT, rand);
    let id = api.bag.shift();
    if (api.current && id === api.current.id && api.bag.length) id = api.bag.shift();
    return byId(id);
  }

  api.score = (cue) => {
    api.cue = cue;
    const track = cue === 'flight' ? takeFlight() : byId(CUE[cue] || 'venus');
    if (!track) return;
    if (api.current && track.id === api.current.id && !shown.paused && !shown.ended) return;
    api.current = track;
    assign(hidden, track);
    try { hidden.currentTime = 0; } catch (e) { /* not seekable yet */ }
    if (!api.unlocked) { shown = hidden; const swap = a === shown ? b : a; hidden = swap; return; }
    hidden.volume = 0;
    const p = hidden.play();
    if (p && p.catch) p.catch(() => {});
    const from = shown;
    const to = hidden;
    const t0 = performance.now();
    const dur = 2800;
    fade = { from, to, t0, dur };
    hidden = from;
    shown = to;
  };

  function fadeStep() {
    if (!fade) return;
    const u = Math.min(1, (performance.now() - fade.t0) / fade.dur);
    const target = level();
    fade.to.volume = target * u;
    fade.from.volume = target * (1 - u);
    if (u >= 1) {
      try { fade.from.pause(); } catch (e) { /* ignore */ }
      fade = null;
      shown.volume = level();
    }
  }

  api.tick = () => {
    fadeStep();
    if (!api.unlocked || api.muted) return;
    if (shown.ended) {
      if (api.cue === 'flight') api.score('flight');
      else {
        const again = api.current;
        api.current = null;
        api.score(api.cue === 'open' ? 'quiet' : api.cue);
        if (api.current === again) { try { shown.currentTime = 0; shown.play(); } catch (e) { /* ignore */ } }
      }
    } else if (shown.paused) {
      const p = shown.play();
      if (p && p.catch) p.catch(() => {});
    }
  };

  api.nowPlaying = () => api.current;
  return api;
}
