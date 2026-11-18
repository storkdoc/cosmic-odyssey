/* First chapter: how many stars, then each star, then a stable system. */
import { createView } from './view.js';
import { STAR_TYPES, defaultsFor, derive, formatYears, starType, iscoRadii } from './stars.js';
import { designSystem } from './systems.js';
import { createAudio } from '../audio.js';

const KEY = 'cosmic-odyssey.star';
const countStep = document.getElementById('count');
const studio = document.getElementById('studio');
const features = document.getElementById('features');
const menu = document.getElementById('star-menu');
const next = document.getElementById('next');
const credits = document.getElementById('credits');
const pathsBtn = document.getElementById('paths');

const view = createView(document.getElementById('view'));
const audio = createAudio();
audio.setVolume(1);

if (window.MoodSticker) {
  MoodSticker.game('cosmic-odyssey');
  MoodSticker.screen('star-count');
}

let spec = null;
let starCount = 1;
let built = [];
let last = performance.now();
let flareLock = 0;
let returnTimer = 0;

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  view.frame(dt);
  view.pose();
  audio.tick();
  const dist = document.getElementById('cam-dist');
  if (dist) dist.textContent = view.distance().toFixed(1);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.addEventListener('resize', () => view.resize());

view.onFlare(() => {
  const now = performance.now();
  if (now < flareLock) return;
  flareLock = now + 4500;
  audio.swell(2.8);
});

function unlock() {
  audio.start();
  if (!audio.current || audio.current.id !== 'zarathustra') audio.score('open');
}

document.addEventListener('pointerdown', () => { unlock(); view.primePlates(); }, { once: true });

function show(el) { el.hidden = false; }
function hide(el) { el.hidden = true; }

function formatL(L) {
  if (L >= 1000) return Math.round(L).toLocaleString('en-US') + ' L\u2609';
  if (L >= 10) return L.toFixed(1) + ' L\u2609';
  if (L >= 0.01) return L.toFixed(2) + ' L\u2609';
  return L.toExponential(2) + ' L\u2609';
}

function formatAU(a) {
  if (a >= 100) return Math.round(a) + ' AU';
  if (a >= 1) return a.toFixed(2) + ' AU';
  if (a >= 0.01) return a.toFixed(3) + ' AU';
  return a.toExponential(2) + ' AU';
}

function formatRadius(v) {
  return (v >= 1 ? v.toFixed(2) : v.toExponential(2)) + ' R\u2609';
}

function paintDerived() {
  const d = derive(spec);
  document.getElementById('derived-l').textContent = formatL(d.luminosity);
  document.getElementById('derived-life').textContent = formatYears(d.lifetime);
  document.getElementById('derived-hz').textContent = formatAU(d.hz.inner) + ' – ' + formatAU(d.hz.outer);
  document.getElementById('derived-d').textContent = formatRadius(d.diameter);
  document.getElementById('derived-r').textContent = formatRadius(d.radius);
  document.getElementById('derived-t').textContent = Math.round(d.teff).toLocaleString('en-US') + ' K';
  const badge = document.getElementById('type-badge');
  badge.textContent = starType(d.type).title;
  badge.dataset.type = d.type;
  spec.age = d.age;
  spec.radius = d.radius;
  spec.teff = d.teff;
  const ageInput = document.getElementById('feat-age');
  if (ageInput) {
    ageInput.max = String(Math.max(d.lifetime, 1));
    ageInput.value = String(d.age);
    const ageRead = document.getElementById('feat-age-read');
    if (ageRead) ageRead.textContent = formatYears(d.age);
  }
  const extra = document.getElementById('derived-extra');
  if (d.kind === 'ns') {
    const g = d.magnetic;
    extra.textContent = 'Magnetic field 10^' + g.toFixed(1) + ' G' + (g >= 14 ? '. Magnetar-class.' : '.');
  } else if (d.kind === 'bh') {
    const hole = d.isco || iscoRadii(d.spin);
    extra.textContent = 'Spin a = ' + hole.spin.toFixed(2) + '. Innermost stable orbit ' + hole.prograde.toFixed(2) + ' GM/c\u00b2. Horizon ' + hole.horizon.toFixed(2) + ' GM/c\u00b2.';
  } else extra.textContent = '';
  const ageNote = document.getElementById('age-note');
  ageNote.textContent = spec.age > d.lifetime
    ? 'This age is longer than the stage above. The star would already have changed.'
    : '';
  document.getElementById('habit').textContent = starType(spec.type).habitability;
  view.setStar(Object.assign({}, spec, d));
  return d;
}

function slider(id, label, min, max, value, step, format) {
  const wrap = document.createElement('label');
  wrap.className = 'slider';
  const name = document.createElement('span');
  name.textContent = label;
  const read = document.createElement('span');
  read.id = id + '-read';
  const input = document.createElement('input');
  input.type = 'range';
  input.id = id;
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  const write = () => { read.textContent = format(Number(input.value)); };
  write();
  input.addEventListener('input', () => {
    spec[input.dataset.key] = Number(input.value);
    write();
    paintDerived();
  });
  wrap.append(name, read, input);
  return { wrap, input };
}

function mountFeatures(type) {
  const box = document.getElementById('sliders');
  box.textContent = '';
  const massStep = type.mass[1] - type.mass[0] > 5 ? 0.1 : 0.01;
  const rows = [
    ['feat-mass', 'Mass', type.mass[0], type.mass[1], spec.mass, massStep, (v) => v.toFixed(v >= 10 ? 1 : 2) + ' M\u2609', 'mass'],
    ['feat-age', 'Age', 0, Math.max(spec.age * 2, type.kind === 'ms' ? 1.2e10 : 2e9), spec.age, Math.max(spec.age, 1e6) / 200, (v) => formatYears(v), 'age'],
    ['feat-z', 'Metallicity', 0.1, 3, spec.metallicity, 0.05, (v) => v.toFixed(2) + ' Z\u2609', 'metallicity'],
    ['feat-rot', 'Rotation', type.kind === 'ns' ? 0.01 : 0.4, type.kind === 'ns' ? 20 : 80, spec.rotation, type.kind === 'ns' ? 0.01 : 0.1, (v) => v.toFixed(v < 1 ? 2 : 1) + ' days', 'rotation'],
    ['feat-activity', 'Solar activity', 0, 1, spec.activity, 0.01, (v) => v < 0.2 ? 'Quiet' : v < 0.45 ? 'Mild' : v < 0.7 ? 'Active' : 'Very active', 'activity']
  ];
  if (type.kind === 'ns') {
    rows.push(['feat-mag', 'Magnetic field', 8, 15, spec.magnetic, 0.1, (v) => '10^' + v.toFixed(1) + ' G', 'magnetic']);
  }
  if (type.kind === 'bh') {
    rows.push(['feat-spin', 'Spin', 0, 0.998, spec.spin, 0.001, (v) => v.toFixed(3), 'spin']);
  }
  rows.forEach(([id, label, min, max, value, step, format, key]) => {
    const builtSlider = slider(id, label, min, max, value, step, format);
    builtSlider.input.dataset.key = key;
    box.append(builtSlider.wrap);
  });
}

function selectType(id) {
  spec = defaultsFor(id);
  menu.querySelectorAll('.star-card').forEach((card) => {
    card.classList.toggle('on', card.dataset.type === id);
  });
  const type = starType(id);
  mountFeatures(type);
  features.hidden = false;
  pathsBtn.hidden = false;
  paintDerived();
  if (window.MoodSticker) MoodSticker.usage('star_pick', { type: id });
}

const previewCanvases = [];

STAR_TYPES.forEach((type) => {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'star-card';
  card.dataset.type = type.id;
  card.dataset.kind = type.kind;
  const name = document.createElement('strong');
  name.textContent = type.title;
  const fact = document.createElement('span');
  const kelvin = (t) => t >= 1e6 ? (t / 1e6).toFixed(1).replace(/\.0$/, '') + ' million K' : Math.round(t).toLocaleString('en-US') + ' K';
  fact.textContent = kelvin(type.teff[0]).replace(' K', '') + '–' + kelvin(type.teff[1]);
  const mini = document.createElement('canvas');
  mini.className = 'mini';
  mini.width = 128;
  mini.height = 128;
  previewCanvases.push(mini);
  card.append(mini, name, fact);
  card.addEventListener('pointerenter', () => {
    const preview = Object.assign(defaultsFor(type.id), derive(defaultsFor(type.id)));
    view.setStar(preview);
  });
  card.addEventListener('click', () => selectType(type.id));
  menu.append(card);
});
view.bindPreviews(previewCanvases);

function beginStar(index) {
  spec = null;
  features.hidden = true;
  menu.querySelectorAll('.star-card').forEach((card) => card.classList.remove('on'));
  const which = document.getElementById('which');
  which.textContent = starCount === 1 ? 'Choose the star' : 'Star ' + (index + 1) + ' of ' + starCount;
  document.getElementById('confirm-star').textContent = index + 1 < starCount ? 'Next star' : 'Confirm star';
  hide(countStep);
  hide(next);
  show(studio);
  unlock();
  audio.score('quiet');
}

function finish() {
  const sys = designSystem(built);
  view.setSystem(sys);
  document.body.classList.add('map-open');
  document.getElementById('next-copy').textContent = sys.note + ' Next: planets (coming soon).';
  pathsBtn.hidden = sys.count < 1;
  pathsBtn.setAttribute('aria-pressed', 'true');
  pathsBtn.textContent = 'Orbits on';
  view.setPaths(true);
  hide(studio);
  hide(countStep);
  show(next);
  try { localStorage.setItem(KEY, JSON.stringify({ count: sys.count, architecture: sys.architecture, stars: built, note: sys.note })); } catch (err) { /* private mode */ }
  audio.score('launch');
  clearTimeout(returnTimer);
  returnTimer = setTimeout(() => { if (audio.cue === 'launch') audio.score('quiet'); }, 8000);
  if (window.MoodSticker) {
    MoodSticker.screen('system');
    MoodSticker.usage('system_set', { count: sys.count });
  }
}

document.querySelectorAll('.count-card').forEach((card) => {
  card.addEventListener('click', () => {
    starCount = Number(card.dataset.count);
    built = [];
    card.parentElement.querySelectorAll('.count-card').forEach((c) => c.classList.toggle('on', c === card));
    if (window.MoodSticker) MoodSticker.usage('star_count_pick', { count: starCount });
    if (starCount === 0) finish();
    else beginStar(0);
  });
});

document.getElementById('confirm-star').addEventListener('click', () => {
  if (!spec) return;
  const d = paintDerived();
  built.push(Object.assign({}, spec, d));
  if (built.length < starCount) beginStar(built.length);
  else finish();
});

document.getElementById('zoom-in').addEventListener('click', () => view.zoomBy(0.82));
document.getElementById('zoom-out').addEventListener('click', () => view.zoomBy(1.18));

document.getElementById('next-fold').addEventListener('click', () => {
  const open = next.classList.toggle('expanded');
  document.getElementById('next-fold').setAttribute('aria-expanded', open ? 'true' : 'false');
});

pathsBtn.addEventListener('click', () => {
  const on = pathsBtn.getAttribute('aria-pressed') !== 'true';
  pathsBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  pathsBtn.textContent = on ? 'Orbits on' : 'Orbits off';
  view.setPaths(on);
});

const mute = document.getElementById('mute');
mute.addEventListener('click', () => {
  audio.toggleMuted();
  mute.setAttribute('aria-pressed', audio.muted ? 'true' : 'false');
  mute.setAttribute('aria-label', audio.muted ? 'Sound on' : 'Mute');
});

const creditList = document.getElementById('credit-list');
audio.tracks.forEach((track) => {
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.href = track.page;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = track.composer + ' — ' + track.piece;
  const meta = document.createElement('span');
  meta.textContent = track.performer + '. ' + track.license + '.';
  item.append(link, meta);
  creditList.append(item);
});

document.getElementById('credits-open').addEventListener('click', () => { credits.hidden = false; });
document.getElementById('credits-close').addEventListener('click', () => { credits.hidden = true; });
