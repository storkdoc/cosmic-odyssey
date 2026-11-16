import { createAudio, TRACKS } from './audio.js';
import { createGame, loadGame, hasSave, clearSave, DRIVES, TECH, NAMES, MAYDAY } from './game.js';
import { createView } from './render.js';
import { SYSTEMS, FEATURED, SKINS, HULLS, PERKS } from './data.js';
import { publishUniverse, publishShip, listUniverses, listShips, sanitizeUniverse } from './share.js';
import { escapeHtml } from './text.js';
import { climate } from './sim.js';

const $ = (id) => document.getElementById(id);
const canvas = $('view');
const audio = createAudio();
let view = null;
try { view = createView(canvas); }
catch (err) { $('fallback').classList.add('show'); }

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let phase = 'title';
let fly = 0;
let sim = null;
let panel = null;
let place = null;
let cue = '';
let stick = { x: 0, y: 0, on: false };
let thrustHeld = false;
let rescueHeld = false;
let last = performance.now();
let saveAt = 0;
let quality = localStorage.getItem('cosmic-odyssey.quality') || (matchMedia('(pointer: coarse)').matches || innerWidth < 900 ? 'low' : 'high');
if (view) view.setQuality(quality);

const draft = freshDraft();

function freshDraft() {
  return {
    id: 'u-' + Math.random().toString(16).slice(2, 10),
    name: '',
    author: 'Astro-Explorer',
    about: '',
    challenge: 'Survey the first world.',
    starId: 'G',
    planets: [freshPlanet(0)],
    armed: false
  };
}
function freshPlanet(i) {
  return {
    id: 'p' + (i + 1),
    name: 'World ' + (i + 1),
    aAU: 0.4 + i * 0.45,
    mass: 1,
    radius: 1,
    atmosphere: 'co2',
    pressure: 1,
    water: 0.4,
    albedo: 0.3,
    greenhouse: 0.8,
    moon: false
  };
}
function starSpec() {
  const table = {
    M: { mass: 0.15, L: 0.003, teff: 2800, spectral: 'M5', radius: 0.2 },
    K: { mass: 0.75, L: 0.35, teff: 4800, spectral: 'K2', radius: 0.78 },
    G: { mass: 1, L: 1, teff: 5780, spectral: 'G2', radius: 1 },
    F: { mass: 1.3, L: 2.6, teff: 6600, spectral: 'F6', radius: 1.3 }
  };
  return table[draft.starId] || table.G;
}

$('begin').addEventListener('click', () => {
  audio.start();
  audio.score('open');
  cue = 'open';
  phase = 'fly';
  fly = 0;
  document.body.classList.add('flying');
});

document.addEventListener('keydown', (e) => {
  if (phase === 'fly' && e.code !== 'Tab') { e.preventDefault(); finishFly(); }
});
document.addEventListener('pointerdown', (e) => {
  if (phase !== 'fly') return;
  if (e.target.closest && e.target.closest('#begin')) return;
  finishFly();
});

function finishFly() {
  if (phase !== 'fly') return;
  phase = 'gate';
  document.body.classList.remove('flying', 'cinema');
  document.body.classList.add('past-title');
  if (hasSave()) $('choose').classList.add('show');
  else openHow(true);
}

$('continue').addEventListener('click', () => {
  $('choose').classList.remove('show');
  sim = loadGame() || createGame();
  startPlay(false);
});
$('anew').addEventListener('click', () => {
  clearSave();
  $('choose').classList.remove('show');
  sim = createGame();
  openHow(true);
});
$('howto-go').addEventListener('click', () => {
  if (phase === 'fly' || phase === 'title') return;
  $('howto').classList.remove('show');
  if (!sim) sim = createGame();
  startPlay(true);
  try { localStorage.setItem('cosmic-odyssey.howto', '1'); } catch (err) { /* ignore */ }
});
$('btn-help').addEventListener('click', () => openHow(false));

function openHow(blocking) {
  $('howto').classList.add('show');
  if (!blocking) $('howto-go').textContent = 'Back to the voyage';
}

function startPlay() {
  phase = 'play';
  document.body.classList.remove('cinema', 'flying');
  document.body.classList.add('play', 'past-title');
  if (window.MoodSticker) {
    MoodSticker.game('cosmic-odyssey');
    MoodSticker.screen('hub');
    MoodSticker.bindPause({
      pause() { if (sim) sim.g.ship.throttle = 0; },
      resume() {}
    });
  }
  renderDock();
}

function screenName() {
  if (panel) return panel;
  if (place === 'oneill') return 'oneill';
  if (!sim) return 'title';
  if (sim.g.docked) return 'hub';
  if (sim.g.surface && sim.g.surface.kind === 'rescue') return 'rescue';
  if (sim.g.landed) return 'surface';
  return 'flight';
}

function renderDock() {
  const g = sim.g;
  const items = [];
  if (g.docked || place === 'oneill') {
    items.push(['deck', 'Flight Deck'], ['lab', 'Planetary lab'], ['missions', 'Mission Control'], ['trade', 'Trading outpost'], ['forge', NAMES.forge], ['catalog', 'Charts'], ['oneill', 'O’Neill colony'], ['vault', 'Backer Vault'], ['plaque', 'Plaque'], ['credits', 'Credits']);
  } else if (g.landed) {
    items.push(['surface', 'Surface lab'], ['threats', 'Threats'], ['trade', 'Field cache'], ['lift', 'Lift off']);
  } else {
    items.push(['flight', 'Helm'], ['nav', 'Plot course'], ['scan', 'Scan'], ['land', 'Entry'], ['dock', 'Dock']);
  }
  $('dock').innerHTML = items.map(([id, label]) => `<button type="button" data-open="${id}">${escapeHtml(label)}</button>`).join('');
}

$('dock').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const id = b.dataset.open;
  if (id === 'lift') { toast(sim.takeoff()); return; }
  if (id === 'scan') { toast(sim.scan()); return; }
  if (id === 'land') { toast(sim.tryLand()); return; }
  if (id === 'dock') { toast(sim.tryDock()); return; }
  if (id === 'oneill') { place = 'oneill'; sim.visitOneill(); renderDock(); openPanel('oneill'); return; }
  openPanel(id);
});

function toast(res) {
  if (res && res.reason) sim.say(res.reason, 5);
  else if (res && res.ok) sim.save();
}

function closePanel() {
  panel = null;
  document.body.classList.remove('panel-open');
  $('panel').classList.remove('show');
  $('panel').innerHTML = '';
}

function openPanel(id) {
  panel = id;
  document.body.classList.add('panel-open');
  const root = $('panel');
  root.classList.add('show');
  root.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'row';
  head.innerHTML = '<button type="button" data-x>Close</button>';
  root.appendChild(head);
  head.querySelector('[data-x]').onclick = closePanel;
  const body = document.createElement('div');
  root.appendChild(body);
  const fill = {
    deck: fillDeck, lab: fillLab, missions: fillMissions, trade: fillTrade, forge: fillForge,
    catalog: fillCatalog, vault: fillVault, plaque: fillPlaque, credits: fillCredits,
    surface: fillSurface, threats: fillThreats, flight: fillFlight, nav: fillNav, oneill: fillOneill
  }[id];
  if (fill) fill(body);
  if (window.MoodSticker) MoodSticker.screen(id);
}

function fillDeck(root) {
  const g = sim.g;
  const d = g.shipDesign;
  root.innerHTML = `
    <h2>Flight Deck</h2>
    <p class="sub">Build, equip, and name the ship. Backer designs join the shared Armada.</p>
    <div class="card"><h3>${escapeHtml(d.name)}</h3><p>Hull ${escapeHtml(d.hull)}. Drive ${escapeHtml((DRIVES[g.ship.drive] || DRIVES.chem).name)}.</p></div>`;
  const name = field('Ship name', d.name);
  root.appendChild(name.label);
  const hulls = document.createElement('div');
  hulls.className = 'row';
  HULLS.forEach((h) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = h.name;
    if (h.id === d.hull) b.classList.add('primary');
    b.onclick = () => { d.hull = h.id; sim.save(); fillDeck(root); };
    hulls.appendChild(b);
  });
  root.appendChild(hulls);
  const colors = document.createElement('div');
  colors.className = 'row';
  colors.appendChild(colorField('Hull', d.primary, (v) => { d.primary = v; }));
  colors.appendChild(colorField('Accent', d.accent, (v) => { d.accent = v; }));
  root.appendChild(colors);
  const drives = document.createElement('div');
  drives.className = 'row';
  Object.values(DRIVES).forEach((drive) => {
    const locked = (drive.id === 'ion' && !g.tech.ion) || (drive.id === 'sail' && !g.tech.sail) || (drive.id === 'ramjet' && !g.tech.ramjet);
    const b = document.createElement('button');
    b.type = 'button';
    b.disabled = locked;
    b.textContent = drive.name;
    if (g.ship.drive === drive.id) b.classList.add('primary');
    b.onclick = () => { g.ship.drive = drive.id; if (drive.id === 'sail') g.sailOn = true; sim.say(drive.tip); sim.save(); fillDeck(root); };
    drives.appendChild(b);
  });
  root.appendChild(drives);
  const row = document.createElement('div');
  row.className = 'row';
  const save = document.createElement('button');
  save.type = 'button';
  save.textContent = 'Keep this design';
  save.onclick = () => { d.name = name.input.value.slice(0, 32) || NAMES.ship; sim.save(); sim.say('The deck has the new plate.'); };
  row.appendChild(save);
  const pub = document.createElement('button');
  pub.type = 'button';
  pub.textContent = g.backer ? 'Join the Armada' : 'Armada is a backer plate';
  pub.disabled = !g.backer;
  pub.onclick = () => {
    d.name = name.input.value.slice(0, 32) || NAMES.ship;
    publishShip({
      id: 's-' + Math.random().toString(16).slice(2, 10),
      name: d.name, author: g.author || 'Astro-Explorer', hull: d.hull, primary: d.primary, accent: d.accent,
      test: testMode()
    }).then(() => sim.say('The Armada has the ship.')).catch(() => sim.say('The Armada link did not answer. The design is still yours.'));
    sim.save();
  };
  row.appendChild(pub);
  root.appendChild(row);
  const note = document.createElement('p');
  note.id = 'armada-note';
  note.textContent = 'Fetching the Armada…';
  root.appendChild(note);
  listShips().then((ships) => {
    const mine = { name: NAMES.ship, author: NAMES.founder, hull: 'ring' };
    const all = [mine].concat(ships || []);
    note.textContent = all.length ? all.slice(-8).map((s) => s.name + ' — ' + (s.author || 'explorer')).join(' · ') : 'The Armada is quiet.';
  }).catch(() => { note.textContent = 'The Armada link is quiet. Your own ship still flies.'; });
}

function fillLab(root) {
  const g = sim.g;
  root.innerHTML = `<h2>Planetary lab</h2><p class="sub">Research opens the next reach. The suit is yours to restyle. Survey data ${Math.floor(g.research)} · coins ${Math.floor(g.coins)}</p>`;
  TECH.forEach((t) => {
    const card = document.createElement('div');
    card.className = 'card';
    const have = g.tech[t.id];
    card.innerHTML = `<h3>${escapeHtml(t.name)}</h3><p>${escapeHtml(t.about)}</p><p>${costLine(t.cost)}</p>`;
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = have ? 'Aboard' : 'Build';
    b.disabled = have;
    b.onclick = () => { toast(sim.research(t.id)); fillLab(root); };
    card.appendChild(b);
    root.appendChild(card);
  });
  const suit = document.createElement('div');
  suit.className = 'card';
  suit.innerHTML = '<h3>Design your own suit</h3><p>Any player can wear these skins. The founding crest is a backer item.</p>';
  const row = document.createElement('div');
  row.className = 'row';
  SKINS.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.style.background = s.primary;
    b.title = s.name;
    b.disabled = s.backer && !g.backer;
    b.onclick = () => {
      g.suit.skin = s.id; g.suit.primary = s.primary; g.suit.accent = s.accent; sim.save();
    };
    row.appendChild(b);
  });
  suit.appendChild(row);
  const jet = document.createElement('p');
  jet.textContent = g.backer
    ? 'Special holographic helmet: on. Surface EVA has jet-pack thrust.'
    : 'The holographic helmet is in the Backer Vault. Turn the backer mark on to wear it.';
  suit.appendChild(jet);
  root.appendChild(suit);
  const tools = document.createElement('div');
  tools.className = 'row';
  const miner = document.createElement('button');
  miner.type = 'button';
  miner.textContent = g.robots.miner ? 'Miner online' : 'Build miner';
  miner.disabled = g.robots.miner;
  miner.onclick = () => { toast(sim.buildRobot('miner')); fillLab(root); };
  const sat = document.createElement('button');
  sat.type = 'button';
  sat.textContent = g.robots.sat ? 'Watcher overhead' : 'Build watcher satellite';
  sat.disabled = g.robots.sat;
  sat.onclick = () => { toast(sim.buildRobot('sat')); fillLab(root); };
  const ref = document.createElement('button');
  ref.type = 'button';
  ref.textContent = 'Refine ice to fuel';
  ref.onclick = () => toast(sim.refine());
  tools.append(miner, sat, ref);
  root.appendChild(tools);
}

function fillMissions(root) {
  root.innerHTML = '<h2>Mission Control</h2><p class="sub">Infinity Command keeps the board. Crossings wait on the tech that opens them.</p>';
  sim.missions().forEach((m) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h3>${escapeHtml(m.title)} ${m.done ? '<span class="ok">· done</span>' : ''}</h3><p>${escapeHtml(m.text)}</p>`;
    root.appendChild(card);
  });
  if (sim.g.maydayLost && !sim.g.rescued) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Relay the beacon · 10 coins';
    b.onclick = () => toast(sim.recharge());
    root.appendChild(b);
  }
  const launch = document.createElement('button');
  launch.type = 'button';
  launch.className = 'primary';
  launch.textContent = sim.g.docked ? 'Launch' : 'Already away';
  launch.disabled = !sim.g.docked;
  launch.onclick = () => { toast(sim.launch()); closePanel(); };
  root.appendChild(launch);
}

function fillNav(root) {
  root.innerHTML = '<h2>Plot a course</h2><p class="sub">The sail, or the ramjet, makes the crossing. Chemical tanks stay for the worlds themselves.</p>';
  const list = sim.catalog();
  list.forEach((s) => {
    const card = document.createElement('div');
    card.className = 'card';
    const gate = s.gate ? (TECH.find((t) => t.id === s.gate) || {}).name : '';
    card.innerHTML = `<h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.blurb || s.about || '')}</p><p>${gate ? 'Needs ' + escapeHtml(gate) + '.' : ''}</p>`;
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = s.id === sim.g.systemId ? 'Here' : 'Depart';
    b.disabled = s.id === sim.g.systemId;
    b.onclick = () => { const res = sim.depart(s.id); toast(res); if (res.ok) closePanel(); };
    card.appendChild(b);
    root.appendChild(card);
  });
}

function fillFlight(root) {
  const g = sim.g;
  root.innerHTML = `<h2>Helm</h2><p class="sub">${escapeHtml(sim.hint())}</p>`;
  const row = document.createElement('div');
  row.className = 'row';
  const buttons = [
    ['Retro', () => sim.pointAlong(-1)],
    ['Prograde', () => sim.pointAlong(1)],
    ['Match', () => { g.matching = true; sim.say('Matching a circular path around the target.'); }],
    ['Warp', () => sim.cycleWarp()],
    ['Sail ' + (g.sailOn ? 'on' : 'off'), () => { if (!g.tech.sail) { sim.say('The sail is not fitted.'); return; } g.sailOn = !g.sailOn; }],
    ['Shield ' + (g.shieldOn ? 'on' : 'off'), () => { if (!g.tech.shield) { sim.say('Magnetic transport is not fitted.'); return; } g.shieldOn = !g.shieldOn; }],
    ['Next world', () => sim.cycleTarget(1)]
  ];
  buttons.forEach(([label, fn]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.onclick = () => { fn(); fillFlight(root); };
    row.appendChild(b);
  });
  root.appendChild(row);
}

function fillSurface(root) {
  const g = sim.g;
  const id = g.landed;
  const c = id ? sim.climateFor(id) : null;
  const locked = id && sim.lockedChem(id);
  root.innerHTML = `<h2>Surface lab</h2><p class="sub">${c ? escapeHtml(c.verdict) : ''} ${locked ? 'Actualized. The chemistry is locked.' : ''}</p>`;
  if (!c) return;
  const read = document.createElement('p');
  read.textContent = `Equilibrium ${Math.round(c.Teq)} K · surface ${Math.round(c.Tsurf)} K · sunlight ${c.S.toFixed(2)} · zone ${c.aIn.toFixed(2)}–${c.aOut.toFixed(2)} AU`;
  root.appendChild(read);
  if (!locked) {
    root.appendChild(slider('Atmosphere pressure', 0, 8, c.pressure, 0.05, (v) => sim.setClimate({ pressure: v, atmosphere: v < 0.05 ? 'none' : (c.atmosphere === 'none' ? 'co2' : c.atmosphere) })));
    root.appendChild(slider('Greenhouse / warmth', 0, 1.8, c.greenhouse, 0.02, (v) => sim.setClimate({ greenhouse: v })));
    root.appendChild(slider('Water', 0, 1, c.water, 0.02, (v) => sim.setClimate({ water: v })));
    root.appendChild(slider('Cloud brightness', 0.05, 0.85, c.albedo, 0.02, (v) => sim.setClimate({ albedo: v })));
    const air = document.createElement('div');
    air.className = 'row';
    ['none', 'co2', 'n2o2', 'hhe'].forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = a;
      if (c.atmosphere === a) b.classList.add('primary');
      b.onclick = () => { sim.setClimate({ atmosphere: a }); fillSurface(root); };
      air.appendChild(b);
    });
    root.appendChild(air);
  }
  const row = document.createElement('div');
  row.className = 'row';
  const mine = document.createElement('button');
  mine.type = 'button';
  mine.textContent = g.miner ? 'Stop mining' : 'Mine';
  mine.onclick = () => { g.miner = !g.miner; if (g.miner) sim.mine(1.2); sim.say(g.miner ? 'The cutters are in the regolith.' : 'Mining held.'); fillSurface(root); };
  const seed = document.createElement('button');
  seed.type = 'button';
  seed.textContent = 'Seed life';
  seed.onclick = () => { toast(sim.seed()); fillSurface(root); };
  row.append(mine, seed);
  root.appendChild(row);
  if (g.nurture) {
    const n = g.nurture;
    root.appendChild(slider('Warmth of the nursery', 0, 1, n.heat, 0.05, (v) => { n.heat = v; }));
    root.appendChild(slider('Water for the nursery', 0, 1, n.wet, 0.05, (v) => { n.wet = v; }));
    root.appendChild(slider('Light', 0, 1, n.light, 0.05, (v) => { n.light = v; }));
    const bar = document.createElement('div');
    bar.className = 'meter';
    bar.innerHTML = `<i style="width:${Math.min(100, (n.stable / 16) * 100)}%"></i>`;
    root.appendChild(bar);
  }
  const cargo = document.createElement('p');
  const k = g.ship.cargo;
  cargo.textContent = `Ice ${k.ice.toFixed(1)} · iron ${k.iron.toFixed(1)} · silicon ${k.si.toFixed(1)} · carbon ${k.carbon.toFixed(1)} · fuel ${g.ship.fuel.toFixed(2)}`;
  root.appendChild(cargo);
}

function fillThreats(root) {
  const t = sim.g.threat;
  root.innerHTML = `<h2>Threats</h2><p class="sub">${t && !t.handled ? escapeHtml(t.name + '. ' + t.text) : 'The watcher is quiet.'}</p>`;
  const row = document.createElement('div');
  row.className = 'row';
  [['wait', 'Wait it out'], ['shield', 'Magnetic field'], ['opto', 'Optogenetics'], ['sat', 'Watcher burn'], ['climate', 'Climate lever']].forEach(([id, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.onclick = () => { toast(sim.respondThreat(id)); fillThreats(root); };
    row.appendChild(b);
  });
  root.appendChild(row);
  const list = document.createElement('div');
  list.innerHTML = '<div class="card"><p>Environmental disaster, biodiversity, pole reversal, weather, disease, a crossing rock, a partial temperate hour, and climate drift. Each one has an answer in the tech you have built.</p></div>';
  root.appendChild(list);
}

function fillTrade(root) {
  root.innerHTML = `<h2>Trading outpost</h2><p class="sub">Challenge Coins on hand: ${Math.floor(sim.g.coins)}. Ore in, fuel and xenon out.</p>`;
  const row = document.createElement('div');
  row.className = 'row';
  [['sell-iron', 'Sell 3 iron · 6'], ['sell-ice', 'Sell 3 ice · 4'], ['buy-fuel', 'Buy fuel · 6'], ['buy-xe', 'Buy xenon · 8']].forEach(([id, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.onclick = () => { toast(sim.trade(id)); fillTrade(root); };
    row.appendChild(b);
  });
  root.appendChild(row);
}

function fillForge(root) {
  const star = starSpec();
  root.innerHTML = `<h2>${escapeHtml(NAMES.forge)}</h2><p class="sub">Steve Behram’s namesake backer item. Design a star and its worlds. The lab computes the habitable zone. Publishing shares the chart. Actualizing commits the chemistry, and it does not turn back.</p>`;
  const name = field('Universe name', draft.name);
  const author = field('Your name on the chart', draft.author);
  const about = area('About', draft.about);
  const challenge = area('Challenge for visitors', draft.challenge);
  root.append(name.label, author.label, about.label, challenge.label);
  const stars = document.createElement('div');
  stars.className = 'row';
  [['M', 'Red dwarf'], ['K', 'K dwarf'], ['G', 'Sunlike'], ['F', 'F star']].forEach(([id, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (draft.starId === id) b.classList.add('primary');
    b.onclick = () => { draft.starId = id; fillForge(root); };
    stars.appendChild(b);
  });
  root.appendChild(stars);
  draft.planets.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h3>World ${i + 1}</h3>`;
    const nm = field('Name', p.name);
    nm.input.oninput = () => { p.name = nm.input.value; report(); };
    card.appendChild(nm.label);
    card.appendChild(slider('Orbit (AU)', 0.02, 8, p.aAU, 0.01, (v) => { p.aAU = v; report(); }));
    card.appendChild(slider('Mass (Earths)', 0.1, 8, p.mass, 0.05, (v) => { p.mass = v; p.radius = Math.pow(v, 0.27); report(); }));
    card.appendChild(slider('Water', 0, 1, p.water, 0.02, (v) => { p.water = v; report(); }));
    card.appendChild(slider('Air pressure', 0, 10, p.pressure, 0.05, (v) => { p.pressure = v; report(); }));
    card.appendChild(slider('Greenhouse', 0, 1.8, p.greenhouse, 0.02, (v) => { p.greenhouse = v; report(); }));
    const air = document.createElement('div');
    air.className = 'row';
    ['none', 'co2', 'n2o2', 'hhe'].forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = a;
      if (p.atmosphere === a) b.classList.add('primary');
      b.onclick = () => { p.atmosphere = a; fillForge(root); };
      air.appendChild(b);
    });
    card.appendChild(air);
    const moon = document.createElement('button');
    moon.type = 'button';
    moon.textContent = p.moon ? 'Moon: yes' : 'Moon: no';
    moon.onclick = () => { p.moon = !p.moon; fillForge(root); };
    card.appendChild(moon);
    const out = document.createElement('p');
    out.className = 'forge-read';
    card.appendChild(out);
    root.appendChild(card);
    function report() {
      const c = climateOf(star, p);
      out.textContent = `${Math.round(c.Teq)} K equilibrium · ${Math.round(c.Tsurf)} K surface · zone ${c.aIn.toFixed(2)}–${c.aOut.toFixed(2)} AU. ${c.verdict}`;
    }
    report();
  });
  const row = document.createElement('div');
  row.className = 'row';
  const add = document.createElement('button');
  add.type = 'button';
  add.textContent = 'Add a world';
  add.disabled = draft.planets.length >= 4;
  add.onclick = () => { draft.planets.push(freshPlanet(draft.planets.length)); fillForge(root); };
  const keep = document.createElement('button');
  keep.type = 'button';
  keep.textContent = 'Save on this ship';
  keep.onclick = () => {
    pullText();
    const rec = recordFromDraft();
    sim.addUniverse(rec);
    sim.save();
    usage('universe_created', rec.name);
    sim.say('Saved aboard. Publish it, or actualize it when you are ready to commit.');
  };
  const pub = document.createElement('button');
  pub.type = 'button';
  pub.className = 'primary';
  pub.textContent = 'Publish';
  pub.onclick = () => {
    pullText();
    const rec = recordFromDraft();
    sim.addUniverse(rec);
    sim.save();
    publishUniverse({ ...rec, test: testMode() }).then(() => {
      usage('universe_published', rec.name);
      sim.say('Published. Other voyages can plot a course here.');
    }).catch(() => sim.say('The catalog did not take it. It is still saved on this ship.'));
  };
  const act = document.createElement('button');
  act.type = 'button';
  act.textContent = draft.armed ? 'Commit — this cannot be undone' : 'Actualize';
  act.onclick = () => {
    pullText();
    const rec = recordFromDraft();
    sim.addUniverse(rec);
    if (!draft.armed) { draft.armed = true; act.textContent = 'Commit — this cannot be undone'; sim.say('Once you actualize, the chemistry stays. Press again to commit.'); return; }
    const res = sim.actualize(rec.id);
    toast(res);
    if (res.ok) { usage('universe_created', rec.name + ' actualized'); draft.armed = false; }
  };
  row.append(add, keep, pub, act);
  root.appendChild(row);
  function pullText() {
    draft.name = name.input.value;
    draft.author = author.input.value || 'Astro-Explorer';
    draft.about = about.input.value;
    draft.challenge = challenge.input.value;
    if (sim.g.backer && !draft.author) draft.author = NAMES.founder;
  }
}

function recordFromDraft() {
  const star = starSpec();
  const rec = sanitizeUniverse({
    id: draft.id,
    name: draft.name || 'Untitled chart',
    author: draft.author || 'Astro-Explorer',
    about: draft.about,
    challenge: draft.challenge,
    goal: { type: 'survey', planet: draft.planets[0] ? draft.planets[0].id : 'p1' },
    star,
    planets: draft.planets
  });
  rec.id = draft.id;
  return rec;
}

function climateOf(star, p) {
  return climate({
    L: star.L, aAU: p.aAU, albedo: p.albedo, pressure: p.pressure,
    greenhouse: p.greenhouse, water: p.water, atmosphere: p.atmosphere
  });
}

function fillCatalog(root) {
  root.innerHTML = '<h2>Charts</h2><p class="sub">Hand-built universes, then whatever other players have published. Names on those charts are theirs.</p>';
  const host = document.createElement('div');
  root.appendChild(host);
  function addCard(s, kind) {
    const card = document.createElement('div');
    card.className = 'card';
    const by = s.author ? ' · ' + s.author : '';
    card.innerHTML = `<h3>${escapeHtml(s.name)}${escapeHtml(by)}</h3><p>${escapeHtml(s.about || s.blurb || s.challenge || '')}</p>`;
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Visit';
    b.onclick = () => {
      if (s.planets && s.star && kind === 'shared') sim.addUniverse(s);
      const res = sim.depart(s.id);
      toast(res);
      if (res.ok) { place = null; closePanel(); }
    };
    card.appendChild(b);
    host.appendChild(card);
  }
  SYSTEMS.forEach((s) => addCard(s, 'campaign'));
  FEATURED.forEach((s) => addCard(s, 'featured'));
  (sim.g.universes || []).forEach((s) => addCard(s, 'local'));
  listUniverses().then((rows) => {
    (rows || []).forEach((s) => {
      if ((sim.g.universes || []).some((u) => u.id === s.id)) return;
      addCard(s, 'shared');
    });
  }).catch(() => {
    const p = document.createElement('p');
    p.textContent = 'The shared catalog did not answer. The charts on this ship are still here.';
    host.appendChild(p);
  });
}

function fillVault(root) {
  const g = sim.g;
  root.innerHTML = `<h2>Backer Vault</h2><p class="sub">Steve Behram is the founding backer. His perks are already granted. Anyone who backed the 2017 campaign can turn the same cosmetics on. It is an honor system.</p>`;
  const row = document.createElement('div');
  row.className = 'row';
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = g.backer ? 'Backer cosmetics: on' : 'Backer cosmetics: off';
  b.classList.toggle('primary', g.backer);
  b.onclick = () => { g.backer = !g.backer; g.author = g.backer ? NAMES.founder : 'Astro-Explorer'; sim.save(); fillVault(root); };
  row.appendChild(b);
  root.appendChild(row);
  if (g.backer) {
    const badge = document.createElement('p');
    badge.className = 'ok';
    badge.textContent = 'VIP Beta · holographic helmet · founding crest · Armada nameplate';
    root.appendChild(badge);
  }
  PERKS.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div class="tier">${escapeHtml(p.tier)} · ${escapeHtml(p.price)}</div><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.text)}</p>`;
    root.appendChild(card);
  });
}

function fillPlaque(root) {
  root.innerHTML = `
    <h2>Plaque</h2>
    <div class="card">
      <div class="tier">Infinity Command · Galactic Coalition</div>
      <h3>${escapeHtml(NAMES.founder)}</h3>
      <p>Founding backer and creator of this voyage.</p>
      <p>${escapeHtml(NAMES.plaque)}</p>
      <p>The ${escapeHtml(NAMES.star)} burns in the ${escapeHtml(NAMES.nebula)}, on the charts past the sail.</p>
      <p>${escapeHtml(NAMES.dedication)}</p>
    </div>`;
}

function fillCredits(root) {
  root.innerHTML = '<h2>Music</h2><p class="sub">Real orchestral and concert-band recordings. Nothing here is synthesized. The sky is procedural.</p>';
  TRACKS.forEach((t) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h3>${escapeHtml(t.piece)}</h3><p>${escapeHtml(t.composer)}. ${escapeHtml(t.performer)}.</p><p>${escapeHtml(t.license)}</p><p><a href="${escapeHtml(t.page)}" target="_blank" rel="noopener">${escapeHtml(t.page)}</a></p>`;
    root.appendChild(card);
  });
  const sky = document.createElement('p');
  sky.textContent = 'The Milky Way is drawn in the shader. No sky photograph is shipped.';
  root.appendChild(sky);
}

function fillOneill(root) {
  root.innerHTML = `<h2>O’Neill colony</h2><p class="sub">A cylinder built to keep its own air, soil, and daylight. The National Space Society’s colony idea, as a place you can stand in.</p><p>Bays settled: ${sim.g.oneill.settled}</p>`;
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = 'Settle a bay · 12 coins';
  b.onclick = () => toast(sim.settleOneill());
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = 'Return to the ring';
  back.onclick = () => { place = null; closePanel(); renderDock(); };
  const row = document.createElement('div');
  row.className = 'row';
  row.append(b, back);
  root.appendChild(row);
}

function field(label, value) {
  const wrap = document.createElement('label');
  wrap.textContent = label;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value || '';
  input.maxLength = 80;
  wrap.appendChild(input);
  return { label: wrap, input };
}
function area(label, value) {
  const wrap = document.createElement('label');
  wrap.textContent = label;
  const input = document.createElement('textarea');
  input.value = value || '';
  input.maxLength = 180;
  wrap.appendChild(input);
  return { label: wrap, input };
}
function colorField(label, value, on) {
  const wrap = document.createElement('label');
  wrap.textContent = label;
  const input = document.createElement('input');
  input.type = 'color';
  input.value = /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#c5d0d8';
  input.oninput = () => on(input.value);
  wrap.appendChild(input);
  return wrap;
}
function slider(label, min, max, value, step, on) {
  const wrap = document.createElement('label');
  const name = document.createElement('span');
  name.textContent = label;
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.oninput = () => on(Number(input.value));
  wrap.append(name, input);
  return wrap;
}
function costLine(cost) {
  const bits = [];
  if (cost.research) bits.push(cost.research + ' surveys');
  if (cost.coins) bits.push(cost.coins + ' coins');
  ['iron', 'ice', 'si', 'carbon', 'xe'].forEach((k) => { if (cost[k]) bits.push(cost[k] + ' ' + k); });
  return bits.join(' · ');
}

function usage(name, detail) {
  if (window.MoodSticker && MoodSticker.usage) MoodSticker.usage(name, detail);
}

function testMode() {
  return !!(navigator.webdriver || /[?&]test=1/.test(location.search));
}

const keys = {};
addEventListener('keydown', (e) => {
  if (phase !== 'play') return;
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (window.MoodSticker && MoodSticker.isOpen && MoodSticker.isOpen()) return;
  keys[e.code] = true;
  if (e.code === 'Escape') { closePanel(); place = null; }
  if (e.code === 'KeyL') toast(sim.tryLand());
  if (e.code === 'KeyF' && !e.metaKey && !e.ctrlKey) toast(sim.tryDock());
  if (e.code === 'KeyG') toast(sim.scan());
  if (e.code === 'Tab') { e.preventDefault(); sim.cycleTarget(e.shiftKey ? -1 : 1); }
  if (e.code === 'KeyX') sim.pointAlong(-1);
  if (e.code === 'KeyC') sim.pointAlong(1);
  if (e.code === 'KeyM') sim.g.matching = true;
  if (e.code === 'KeyV') sim.cycleWarp();
  if (e.code === 'Space') { e.preventDefault(); if (sim.g.landed) sim.g.miner = !sim.g.miner; }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  if (phase !== 'play' || panel) return;
  drag = { x: e.clientX, id: e.pointerId };
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id || !sim) return;
  const dx = e.clientX - drag.x;
  drag.x = e.clientX;
  if (!sim.g.landed && !sim.g.docked) sim.g.ship.heading += dx * 0.005;
});
addEventListener('pointerup', () => { drag = null; });

const knob = $('stick').querySelector('i');
$('stick').addEventListener('pointerdown', (e) => {
  stick.on = true;
  $('stick').setPointerCapture(e.pointerId);
  moveStick(e);
});
$('stick').addEventListener('pointermove', (e) => { if (stick.on) moveStick(e); });
$('stick').addEventListener('pointerup', () => { stick.on = false; stick.x = 0; stick.y = 0; knob.style.transform = ''; });
function moveStick(e) {
  const r = $('stick').getBoundingClientRect();
  const x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
  const y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
  stick.x = Math.max(-1, Math.min(1, x));
  stick.y = Math.max(-1, Math.min(1, y));
  knob.style.transform = `translate(${stick.x * 28}px, ${stick.y * 28}px)`;
}
$('touch').addEventListener('pointerdown', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.act === 'thrust') thrustHeld = true;
  if (b.dataset.act === 'rescue') rescueHeld = true;
  if (b.dataset.act === 'retro' && sim) sim.pointAlong(-1);
  if (b.dataset.act === 'act' && sim) actButton();
});
$('touch').addEventListener('pointerup', () => { thrustHeld = false; rescueHeld = false; });
$('touch').addEventListener('pointerleave', () => { thrustHeld = false; });

function actButton() {
  if (sim.g.docked) { toast(sim.launch()); return; }
  if (sim.g.landed) { sim.g.miner = !sim.g.miner; return; }
  const res = sim.tryLand();
  if (!res.ok) toast(sim.tryDock());
}

$('btn-quality').addEventListener('click', () => {
  quality = quality === 'high' ? 'low' : 'high';
  if (view) view.setQuality(quality);
  try { localStorage.setItem('cosmic-odyssey.quality', quality); } catch (err) { /* ignore */ }
  $('btn-quality').textContent = quality === 'high' ? 'Quality' : 'Quality: smooth';
});
$('btn-sound').addEventListener('click', () => {
  if (!audio.unlocked) { audio.start(); audio.score(cue || 'quiet'); }
  audio.toggleMuted();
  $('btn-sound').textContent = audio.muted ? 'Sound off' : 'Sound';
});
if (quality === 'low') $('btn-quality').textContent = 'Quality: smooth';

function presentMode() {
  if (phase === 'title' || phase === 'fly') return 'title';
  if (!sim) return 'title';
  if (place === 'oneill') return 'oneill';
  if (sim.g.landed) return 'surface';
  if (sim.g.docked) return 'hub';
  return 'flight';
}

function wantCue() {
  if (phase !== 'play' || !sim) return 'open';
  const c = sim.g.cinematic;
  if (c && (c.kind === 'launch' || c.kind === 'depart' || c.kind === 'ascent' || c.kind === 'sling')) return 'launch';
  if (sim.g.mayday != null || (sim.g.surface && sim.g.surface.kind === 'rescue')) return 'rescue';
  if (!sim.g.docked && !sim.g.landed && place !== 'oneill') return 'flight';
  return 'quiet';
}

function readout() {
  if (!sim) return;
  const g = sim.g;
  const list = g.docked || g.landed ? null : sim.bodies();
  const target = list ? sim.targetBody(list) : null;
  let alt = '';
  let lamp = '';
  if (target && !g.landed && !g.docked) {
    const d = Math.hypot(g.ship.x - target.x, g.ship.y - target.y);
    const rel = Math.hypot(g.ship.vx - target.vx, g.ship.vy - target.vy);
    alt = `${target.name}  alt ${(d - target.radius).toFixed(2)}  rel ${rel.toFixed(2)}`;
    const ap = d - target.radius < target.radius * 2.4 && rel < 0.55;
    lamp = ap ? 'LAND READY' : (rel >= 0.55 && d - target.radius < target.radius * 3 ? 'TOO FAST' : '');
  }
  const clock = g.mayday != null ? `cells ${Math.max(0, Math.ceil(g.mayday))}s` : (g.sideClock != null ? `lantern ${Math.max(0, Math.ceil(g.sideClock))}s` : '');
  const badge = g.backer ? 'VIP BETA' : '';
  $('readout').innerHTML = `
    <b>${escapeHtml(sim.sys().name)}</b>
    <span>fuel ${g.ship.fuel.toFixed(2)} · Δv ${sim.deltaV().toFixed(2)} · warp ${g.warp}</span>
    <span>${escapeHtml(alt)}</span>
    <span>${escapeHtml([lamp, clock, badge, 'coins ' + Math.floor(g.coins)].filter(Boolean).join(' · '))}</span>`;
}

function applyInput(dt) {
  if (!sim || phase !== 'play') return;
  if (panel && document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
    sim.g.ship.throttle = 0;
    sim.g.stick.x = 0;
    sim.g.stick.y = 0;
    return;
  }
  let turn = 0;
  let thrust = 0;
  if (keys.KeyA || keys.ArrowLeft) turn -= 1;
  if (keys.KeyD || keys.ArrowRight) turn += 1;
  if (keys.KeyW || keys.ArrowUp || thrustHeld) thrust += 1;
  if (keys.KeyS || keys.ArrowDown) thrust -= 0.65;
  if (stick.on) {
    turn += stick.x;
    thrust += Math.max(0, -stick.y);
    if (stick.y > 0.4) thrust -= 0.5;
  }
  sim.g.stick.x = stick.on ? stick.x : turn;
  sim.g.stick.y = stick.on ? -stick.y : (keys.KeyW || keys.ArrowUp ? 1 : 0);
  sim.g.rescueHold = (rescueHeld || keys.KeyR) ? 1 : 0;
  sim.g.jet = (keys.ShiftLeft || keys.ShiftRight || thrustHeld) ? 1 : 0;
  if (!sim.g.docked && !sim.g.landed && !sim.g.matching) {
    sim.g.ship.heading += turn * 1.5 * dt;
    sim.g.ship.throttle = Math.max(-1, Math.min(1, thrust));
  } else if (!sim.g.matching) sim.g.ship.throttle = 0;
  if (sim.g.miner && sim.g.landed && !sim.g.robots.miner) sim.mine(dt);
}

let missionMark = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  if (phase === 'fly') {
    const quick = reduced || /[?&]test=1/.test(location.search);
    fly += dt / (quick ? 0.45 : 12);
    if (fly >= 1) finishFly();
  }
  if (sim && phase === 'play') {
    applyInput(dt);
    sim.step(dt);
    sim.g.lineT = sim.g.lineT;
    if (now - missionMark > 800) {
      missionMark = now;
      const done = sim.freshCompletions();
      done.forEach((m) => {
        usage('mission_completed', m.id);
        if (window.MoodSticker) MoodSticker.event('win');
      });
      if (sim.g.goals) {
        Object.keys(sim.g.goals).forEach((id) => {
          if (!sim.g.logged['goal-' + id]) {
            sim.g.logged['goal-' + id] = true;
            usage('mission_completed', id);
          }
        });
      }
    }
    const next = wantCue();
    if (next !== cue) { cue = next; if (audio.unlocked) audio.score(next); }
    $('line-text').textContent = sim.g.lineT > 0 ? sim.g.line : sim.hint();
    readout();
    if (window.MoodSticker) MoodSticker.screen(screenName());
    const dockKey = (sim.g.docked ? 'd' : '') + (sim.g.landed ? 'l' : '') + (place || '') + (sim.g.surface && sim.g.surface.kind || '');
    if (dockKey !== loop.dockKey) { loop.dockKey = dockKey; renderDock(); }
    if (now - saveAt > 8000) { saveAt = now; sim.save(); }
  }
  audio.tick();
  if (view) {
    try {
      view.frame(sim, dt, { mode: presentMode(), fly: phase === 'title' ? 0 : fly });
    } catch (err) { /* keep the page up */ }
  }
  requestAnimationFrame(loop);
}

addEventListener('resize', () => { if (view) view.resize(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && sim) sim.save(); });

requestAnimationFrame(loop);
