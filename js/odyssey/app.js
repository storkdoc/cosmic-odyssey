/* Cosmic Odyssey. Design a system, awaken life, fly, scan, and listen. */
import { createAudio } from '../audio.js';
import { createView } from './view.js';
import {
  STAR_TYPES, COMPOSITIONS, ATMOSPHERES, CODEX, createSystem, setStarCount, setArchitecture,
  setStarType, rename, addPlanet, addMoon, addBelt, analyze, evolve, scanBody, contactState,
  formatYears, layoutBodies
} from './universe.js';

const $ = (id) => document.getElementById(id);
const audio = createAudio();
const view = createView($('view'));
const SAVE = 'cosmic-odyssey.system';

let sys = load() || createSystem();
let step = 'stars';
let phase = 'title';
let selected = 0;
let flight = null;
let spin = 0;
let last = performance.now();
const keys = {};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE) || 'null');
    if (raw && raw.v === 2 && Array.isArray(raw.planets)) return raw;
  } catch (err) { /* fresh system */ }
  return null;
}
function save() {
  try { localStorage.setItem(SAVE, JSON.stringify(sys)); } catch (err) { /* private mode */ }
}
function usage(name, detail) {
  if (window.MoodSticker && MoodSticker.usage) MoodSticker.usage(name, detail);
}
function word() {
  return '<span class="sp-word" aria-label="SavagePlanets">Savage<span>Planets</span></span>';
}

function show(id) {
  ['title', 'atelier', 'flight-hud', 'scan', 'codex', 'contact', 'evolve'].forEach((key) => {
    const el = $(key);
    if (el) el.hidden = key !== id;
  });
}

function bootTitle() {
  phase = 'title';
  $('present').classList.remove('show');
  $('title').hidden = false;
  document.body.classList.add('cinema');
}

$('begin').addEventListener('click', () => {
  audio.start();
  audio.score('quiet');
  if (window.MoodSticker) {
    MoodSticker.game('cosmic-odyssey');
    MoodSticker.screen('builder');
  }
  $('title').hidden = true;
  document.body.classList.remove('cinema');
  phase = 'build';
  $('atelier').hidden = false;
  renderStep();
  usage('builder_opened', 'stars');
});

document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a.sp-link');
  if (!a) return;
  usage('savageplanets_click', a.getAttribute('href') || 'https://savageplanets.com');
});
document.addEventListener('pointerdown', () => {
  if ($('present').classList.contains('show')) bootTitle();
});
addEventListener('keydown', (e) => {
  if ($('present').classList.contains('show')) { bootTitle(); return; }
  keys[e.code] = true;
  if (phase !== 'flight') return;
  if (e.code === 'KeyO') enterOrbit();
  if (e.code === 'KeyL') land();
  if (e.code === 'KeyC') openScan();
  if (e.code === 'KeyK') openContact();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });

function chip(id, label, on, fn) {
  const b = document.createElement('button');
  b.type = 'button';
  b.id = id;
  b.className = on ? 'chip on' : 'chip';
  b.textContent = label;
  b.addEventListener('click', fn);
  return b;
}

function renderStep() {
  const host = $('step');
  host.innerHTML = '';
  $('step-stars').classList.toggle('on', step === 'stars');
  $('step-worlds').classList.toggle('on', step === 'worlds');
  $('step-moons').classList.toggle('on', step === 'moons');
  $('step-awaken').classList.toggle('on', step === 'awaken');
  if (step === 'stars') renderStars(host);
  else if (step === 'worlds') renderWorlds(host);
  else if (step === 'moons') renderMoons(host);
  else renderAwaken(host);
  view.place(sys, spin);
  save();
}

function renderStars(host) {
  host.append(el('p', 'kicker', 'Stars'));
  host.append(el('h2', '', 'How many suns'));
  const row = el('div', 'row');
  for (let n = 0; n <= 3; n++) {
    row.append(chip('star-' + n, n === 0 ? 'None' : String(n), sys.starCount === n, () => {
      setStarCount(sys, n);
      renderStep();
    }));
  }
  host.append(row);
  if (sys.starCount === 0) {
    host.append(el('p', 'note', 'A rogue system. Worlds keep the heat they were born with. There is no habitable zone of sunlight.'));
  }
  if (sys.starCount >= 2) {
    host.append(el('p', 'kicker', 'Arrangement'));
    const arch = el('div', 'row');
    if (sys.starCount === 2) {
      arch.append(chip('arch-s', 'S-type, one star each', sys.architecture === 's-type', () => { setArchitecture(sys, 's-type'); renderStep(); }));
      arch.append(chip('arch-p', 'P-type, around both', sys.architecture === 'p-type', () => { setArchitecture(sys, 'p-type'); renderStep(); }));
    } else {
      arch.append(chip('arch-h', 'Hierarchical triple', sys.architecture === 'hierarchical', () => { setArchitecture(sys, 'hierarchical'); renderStep(); }));
    }
    host.append(arch);
    host.append(slider('Separation', sys.separationAU, 0.2, 80, 0.1, 'sep', 'AU', (v) => { sys.separationAU = v; }));
    if (sys.starCount === 3) host.append(slider('Outer star', sys.outerAU, 10, 400, 1, 'outer', 'AU', (v) => { sys.outerAU = v; }));
  }
  sys.stars.forEach((star, i) => {
    host.append(el('p', 'kicker', 'Star ' + (i + 1)));
    const name = document.createElement('input');
    name.id = i === 0 ? 'star-name' : 'star-name-' + i;
    name.value = star.name;
    name.maxLength = 32;
    name.setAttribute('aria-label', 'Star name');
    name.addEventListener('change', () => { rename(sys, star.id, name.value); save(); });
    host.append(name);
    const types = el('div', 'row wrap');
    STAR_TYPES.forEach((t) => {
      types.append(chip('type-' + t.id + '-' + i, t.name, star.type === t.id, () => { setStarType(sys, i, t.id); renderStep(); }));
    });
    host.append(types);
    const spec = STAR_TYPES.find((t) => t.id === star.type);
    const hz = spec.L > 0 ? Math.sqrt(spec.L / 1.1) : 0;
    const hzOut = spec.L > 0 ? Math.sqrt(spec.L / 0.36) : 0;
    const line = el('p', 'physics', '');
    line.id = i === 0 ? 'hz-readout' : 'hz-readout-' + i;
    line.textContent = spec.name + ' · ' + spec.L + ' L☉ · lives about ' + formatYears(spec.years) + (spec.L ? ' · water zone ' + hz.toFixed(2) + '–' + hzOut.toFixed(2) + ' AU' : '');
    host.append(line);
  });
  const report = analyze(sys);
  const stab = el('div', 'warnings');
  stab.id = 'stability';
  stab.textContent = report.stability.map((s) => s.text).join(' ') || 'One star. Orbits are ordinary Keplerian paths.';
  host.append(stab);
  host.append(next('to-worlds', 'Worlds', () => { step = 'worlds'; renderStep(); }));
}

function paintWorld(i) {
  const d = analyze(sys).planets[i];
  const phys = $(i === 0 ? 'teq' : 'teq-' + i);
  if (!phys || !d) return;
  phys.textContent = [
    'Teq ' + Math.round(d.teq) + ' K',
    'surface ' + Math.round(d.tsurf) + ' K',
    'g ' + d.g.toFixed(2) + ' m/s²',
    'escape ' + d.vesc.toFixed(1) + ' km/s',
    d.period ? 'period ' + d.period.toFixed(2) + ' yr' : 'no star, no year',
    'mass ' + d.mass.toFixed(2) + ' M⊕'
  ].join(' · ');
}

function renderWorlds(host) {
  host.append(el('p', 'kicker', 'Worlds'));
  host.append(el('h2', '', 'Planets'));
  if (!sys.planets.length) host.append(el('p', 'note', 'Add a world. Distance, size, and density decide the rest.'));
  sys.planets.forEach((planet, i) => {
    const card = el('article', 'card');
    if (i === selected) card.id = 'physics-card';
    const name = document.createElement('input');
    name.id = i === 0 ? 'world-name' : 'world-name-' + i;
    name.value = planet.name;
    name.maxLength = 32;
    name.setAttribute('aria-label', 'Planet name');
    name.addEventListener('change', () => { rename(sys, planet.id, name.value); save(); });
    card.append(name);
    const comps = el('div', 'row wrap');
    COMPOSITIONS.forEach((c) => {
      comps.append(chip((i === 0 ? 'comp-' : 'comp' + i + '-') + c.id, c.name, planet.composition === c.id, () => {
        planet.composition = c.id;
        planet.density = c.density;
        if (!c.land) planet.atmosphere = 'h2';
        selected = i;
        renderStep();
      }));
    });
    card.append(comps);
    card.append(slider('Distance', planet.aAU, 0.05, 40, 0.05, i === 0 ? 'world-au' : 'au-' + i, 'AU', (v) => { planet.aAU = v; paintWorld(i); }));
    card.append(slider('Radius', planet.radius, 0.2, 16, 0.1, i === 0 ? 'world-radius' : 'rad-' + i, 'R⊕', (v) => { planet.radius = v; paintWorld(i); }));
    card.append(slider('Density', planet.density, 0.4, 10, 0.1, i === 0 ? 'world-density' : 'den-' + i, 'g/cm³', (v) => { planet.density = v; paintWorld(i); }));
    const airs = el('div', 'row wrap');
    ATMOSPHERES.forEach((a) => {
      airs.append(chip('air-' + a.id + '-' + i, a.name, planet.atmosphere === a.id, () => { planet.atmosphere = a.id; selected = i; renderStep(); }));
    });
    card.append(airs);
    const d = analyze(sys).planets[i];
    const phys = el('p', 'physics', '');
    phys.id = i === 0 ? 'teq' : 'teq-' + i;
    phys.textContent = [
      'Teq ' + Math.round(d.teq) + ' K',
      'surface ' + Math.round(d.tsurf) + ' K',
      'g ' + d.g.toFixed(2) + ' m/s²',
      'escape ' + d.vesc.toFixed(1) + ' km/s',
      d.period ? 'period ' + d.period.toFixed(2) + ' yr' : 'no star, no year',
      'mass ' + d.mass.toFixed(2) + ' M⊕'
    ].join(' · ');
    card.append(phys);
    if (d.warnings.length) card.append(el('p', 'warn', d.warnings[0]));
    const go = el('button', '', 'Select');
    go.type = 'button';
    go.addEventListener('click', () => { selected = i; renderStep(); });
    card.append(go);
    host.append(card);
  });
  const add = el('button', 'primary', 'Add a world');
  add.id = 'add-world';
  add.type = 'button';
  add.addEventListener('click', () => { addPlanet(sys); selected = sys.planets.length - 1; renderStep(); });
  host.append(add);
  const nav = el('div', 'row');
  nav.append(next('to-stars', 'Stars', () => { step = 'stars'; renderStep(); }));
  nav.append(next('to-moons', 'Moons', () => { step = 'moons'; renderStep(); }));
  host.append(nav);
}

function renderMoons(host) {
  host.append(el('p', 'kicker', 'Company'));
  host.append(el('h2', '', 'Moons and belts'));
  if (!sys.planets.length) host.append(el('p', 'note', 'Add a planet first.'));
  const planet = sys.planets[selected] || sys.planets[0];
  if (planet) {
    host.append(el('p', 'note', 'Moons of ' + planet.name + '. They must sit outside the Roche limit and inside the Hill sphere.'));
    planet.moons.forEach((moon, i) => {
      const card = el('article', 'card');
      const name = document.createElement('input');
      name.id = i === 0 ? 'moon-name' : 'moon-name-' + i;
      name.value = moon.name;
      name.maxLength = 32;
      name.setAttribute('aria-label', 'Moon name');
      name.addEventListener('change', () => { rename(sys, moon.id, name.value); save(); });
      card.append(name);
      card.append(slider('Distance', moon.distanceRadii, 2, 80, 1, i === 0 ? 'moon-dist' : 'md-' + i, 'radii', (v) => { moon.distanceRadii = v; }));
      card.append(slider('Radius', moon.radius, 0.05, Math.max(0.2, planet.radius * 0.7), 0.01, i === 0 ? 'moon-radius' : 'mr-' + i, 'R⊕', (v) => { moon.radius = v; }));
      const d = analyze(sys).planets.find((p) => p.id === planet.id).moons[i];
      const note = el('p', d.warnings.length ? 'warn' : 'physics', '');
      if (i === 0) note.id = 'roche-note';
      note.textContent = d.warnings.length ? d.warnings[0] : 'Roche ' + d.rocheRadii.toFixed(2) + ' planetary radii · Hill ' + d.hillRadii.toFixed(0) + ' radii. This moon is held.';
      card.append(note);
      host.append(card);
    });
    const add = el('button', 'primary', 'Add a moon');
    add.id = 'add-moon';
    add.type = 'button';
    add.addEventListener('click', () => { addMoon(sys, planet.id); renderStep(); });
    host.append(add);
  }
  sys.belts.forEach((belt) => host.append(el('p', 'note', belt.name + ' at ' + belt.aAU.toFixed(2) + ' AU')));
  const belt = el('button', '', 'Add an asteroid belt');
  belt.id = 'add-belt';
  belt.type = 'button';
  belt.addEventListener('click', () => { addBelt(sys); renderStep(); });
  host.append(belt);
  const nav = el('div', 'row');
  nav.append(next('to-worlds-back', 'Worlds', () => { step = 'worlds'; renderStep(); }));
  nav.append(next('to-awaken', 'Awaken', () => { step = 'awaken'; renderStep(); }));
  host.append(nav);
}

function renderAwaken(host) {
  host.append(el('p', 'kicker', 'Life'));
  host.append(el('h2', '', 'Let the ages run'));
  host.append(el('p', 'note', 'Life is not painted. It follows the light, the solvent, and the time.'));
  host.append(slider('Age', sys.ageYears / 1e9, 0.01, 12, 0.01, 'age', 'Gyr', (v) => { sys.ageYears = v * 1e9; }));
  const preview = evolve({ ...sys, planets: sys.planets.map((p) => ({ ...p, moons: p.moons.map((m) => ({ ...m })) })), stars: sys.stars.map((s) => ({ ...s })) }, sys.ageYears);
  const card = el('div', 'physics');
  card.id = 'life-preview';
  card.textContent = preview.planets.map((p) => p.name + ': ' + (p.life ? p.life.stage + ' · ' + p.life.form : 'quiet')).join(' ');
  host.append(card);
  const go = el('button', 'primary', 'Evolve life');
  go.id = 'do-evolve';
  go.type = 'button';
  go.addEventListener('click', () => awaken());
  host.append(go);
  host.append(next('back-moons', 'Moons', () => { step = 'moons'; renderStep(); }));
}

function awaken() {
  sys = evolve(sys, sys.ageYears);
  save();
  usage('life_evolved', sys.civs.length ? 'civ' : 'quiet');
  phase = 'evolve';
  $('atelier').hidden = true;
  $('evolve').hidden = false;
  document.body.classList.add('letterbox');
  audio.score('launch');
  const lines = sys.planets.map((p) => p.name + ' — ' + p.life.stage + '. ' + p.life.form);
  let i = 0;
  const card = $('life-card');
  const tick = () => {
    card.textContent = lines[i] || lines[lines.length - 1] || 'The system is quiet.';
    i += 1;
  };
  tick();
  const timer = setInterval(() => {
    if (i >= lines.length) { clearInterval(timer); return; }
    tick();
  }, 900);
  $('launch').onclick = () => { clearInterval(timer); launch(); };
}

function launch() {
  document.body.classList.remove('letterbox');
  $('evolve').hidden = true;
  phase = 'flight';
  $('flight-hud').hidden = false;
  const bodies = layoutBodies(sys, 0);
  const first = bodies[0];
  flight = {
    mode: 'cruise',
    target: 0,
    spin,
    pose: {
      x: first ? first.x * 0.35 : 8,
      z: first ? first.z * 0.35 : 8,
      heading: 0,
      thrust: 0
    }
  };
  view.place(sys, spin);
  view.dressShip(sys.playerShip);
  view.setMode('flight');
  audio.score('flight');
  usage('system_forged', sys.id);
  renderFlight();
}

function currentBody() {
  return layoutBodies(sys, flight ? flight.spin : spin)[flight.target] || null;
}

function renderFlight() {
  const list = $('targets');
  list.innerHTML = '';
  layoutBodies(sys, flight.spin).forEach((planet, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'goto-' + i;
    b.className = i === flight.target ? 'on' : '';
    b.textContent = planet.name;
    b.addEventListener('click', () => { flight.target = i; flight.mode = 'cruise'; renderFlight(); });
    list.append(b);
  });
  const body = currentBody();
  $('flight-readout').textContent = body
    ? sys.playerShip.name + ' · ' + body.name + ' · ' + (body.life ? body.life.stage : '')
    : sys.playerShip.name;
  $('ship-blurb').textContent = 'Hull ' + sys.playerShip.name + ', a ' + sys.playerShip.culture + ' shape. Sensors: composition, density, temperature, life.';
}

function enterOrbit() {
  if (!flight || !closeEnough()) return;
  flight.mode = 'orbit';
  audio.sfx && audio.sfx.ping && audio.sfx.ping();
  renderFlight();
}
function land() {
  const body = currentBody();
  if (!flight || flight.mode !== 'orbit' || !body) return;
  if (!body.land) {
    $('flight-readout').textContent = body.name + ' has no ground to set down on.';
    return;
  }
  flight.mode = 'landed';
  flight.body = body;
  document.body.classList.add('letterbox');
  audio.score('quiet');
  usage('landed', body.id);
  if (audio.sfx && audio.sfx.land) audio.sfx.land();
  renderFlight();
}
function openScan() {
  const body = flight && flight.mode === 'landed' ? flight.body : currentBody();
  if (!body) return;
  const scan = scanBody(sys, body.id);
  if (!scan) return;
  $('scan').hidden = false;
  $('scan-card').textContent = [
    scan.name,
    'Composition ' + scan.composition,
    'Density ' + scan.density.toFixed(2) + ' g/cm³',
    'Temperature ' + Math.round(scan.temperature) + ' K',
    'Life ' + scan.life,
    'Biosignature ' + scan.biosignature,
    'Technosignature ' + scan.technosignature
  ].join(' · ');
  usage('scan', body.id);
  if (audio.sfx && audio.sfx.ping) audio.sfx.ping();
}
function openContact() {
  const state = contactState(sys);
  $('contact').hidden = false;
  const card = $('contact-card');
  if (!state.open) card.textContent = state.reason;
  else if (state.neighbor) card.textContent = state.neighbor.text + (state.local[0] ? ' ' + state.local[0].body : '');
  else card.textContent = 'Your civilization can transmit. No answer has arrived.';
  usage('contact_opened', state.open ? 'open' : 'closed');
}
function openCodex(id) {
  const entry = CODEX.find((c) => c.id === id) || CODEX[0];
  $('codex').hidden = false;
  $('codex-title').textContent = entry.title;
  $('codex-principle').textContent = entry.principle;
  $('codex-note').textContent = entry.note;
}

function closeEnough() {
  const body = currentBody();
  if (!body || !flight) return false;
  return Math.hypot(flight.pose.x - body.x, flight.pose.z - body.z) < Math.max(1.4, body.radius * 0.8);
}

function stepFlight(dt) {
  if (!flight || flight.mode === 'landed') return;
  const body = currentBody();
  if (!body) return;
  const dx = body.x - flight.pose.x;
  const dz = body.z - flight.pose.z;
  const dist = Math.hypot(dx, dz) || 1;
  flight.pose.heading = Math.atan2(dz, dx);
  const go = flight.mode === 'cruise' && (keys.KeyW || true);
  flight.pose.thrust = go ? 1 : 0;
  if (flight.mode === 'cruise') {
    const step = Math.min(dist, dt * 14);
    flight.pose.x += (dx / dist) * step;
    flight.pose.z += (dz / dist) * step;
    if (closeEnough()) flight.mode = 'orbit';
  } else if (flight.mode === 'orbit') {
    const ang = Math.atan2(flight.pose.z - body.z, flight.pose.x - body.x) + dt * 0.45;
    const r = Math.max(1.6, body.radius * 0.9);
    flight.pose.x = body.x + Math.cos(ang) * r;
    flight.pose.z = body.z + Math.sin(ang) * r;
    flight.pose.heading = ang + Math.PI / 2;
  }
}

$('act-orbit').addEventListener('click', enterOrbit);
$('act-land').addEventListener('click', land);
$('act-scan').addEventListener('click', openScan);
$('act-contact').addEventListener('click', openContact);
$('act-codex').addEventListener('click', () => openCodex('kepler'));
$('scan-close').addEventListener('click', () => { $('scan').hidden = true; });
$('contact-close').addEventListener('click', () => { $('contact').hidden = true; });
$('codex-close').addEventListener('click', () => { $('codex').hidden = true; });
$('lift').addEventListener('click', () => {
  if (!flight) return;
  flight.mode = 'orbit';
  document.body.classList.remove('letterbox');
});
document.querySelectorAll('[data-codex]').forEach((b) => b.addEventListener('click', () => openCodex(b.getAttribute('data-codex'))));

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  if (phase === 'build') spin += dt * 0.04;
  if (phase === 'flight') {
    stepFlight(dt);
    const body = currentBody();
    if ($('flight-readout') && body && flight.mode !== 'landed') {
      const dist = Math.hypot(flight.pose.x - body.x, flight.pose.z - body.z);
      $('flight-readout').textContent = sys.playerShip.name + ' · ' + body.name + ' · ' + dist.toFixed(1) + (flight.mode === 'orbit' ? ' · in orbit' : ' · closing');
    }
    view.frame({ flight: { ...flight, body: flight.body || body } }, dt);
  } else {
    view.frame({ flight: { mode: 'atelier' } }, dt);
  }
  audio.tick();
  requestAnimationFrame(loop);
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}
function next(id, label, fn) {
  const b = el('button', 'primary', label);
  b.id = id;
  b.type = 'button';
  b.addEventListener('click', fn);
  return b;
}
function slider(label, value, min, max, step, id, unit, fn) {
  const wrap = el('label', 'slider');
  const name = el('span', '', label + ' ');
  const out = el('b', '', Number(value).toFixed(2) + ' ' + unit);
  const input = document.createElement('input');
  input.type = 'range';
  input.id = id;
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.addEventListener('input', () => {
    const v = Number(input.value);
    out.textContent = v.toFixed(2) + ' ' + unit;
    fn(v);
    view.place(sys, spin);
    save();
  });
  wrap.append(name, out, input);
  return wrap;
}

$('step-stars').addEventListener('click', () => { step = 'stars'; renderStep(); });
$('step-worlds').addEventListener('click', () => { step = 'worlds'; renderStep(); });
$('step-moons').addEventListener('click', () => { step = 'moons'; renderStep(); });
$('step-awaken').addEventListener('click', () => { step = 'awaken'; renderStep(); });
$('codex-brand').innerHTML = 'Explore more worlds at ' + word();
requestAnimationFrame(loop);
setInterval(() => { if (phase === 'build') view.place(sys, spin); }, 900);
