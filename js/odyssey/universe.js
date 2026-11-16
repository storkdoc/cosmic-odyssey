/* A designed solar system. Pure data: stars, worlds, moons, life, ships, signals.
   A later multiplayer layer can append signals. It does not need a different shape. */
import {
  massEarth, surfaceGravity, escapeVelocity, orbitalPeriodYears, equilibrium,
  zone, hillSphereAU, rocheRadii, greenhouseKelvin, sTypeLimitAU, pTypeLimitAU,
  stellarFlux, LIGHT_MINUTES_PER_AU
} from './physics.js';

export const STAR_TYPES = [
  { id: 'o', name: 'O star', mass: 30, L: 20000, teff: 40000, radius: 10, years: 3e6, hazard: 0.92, color: '#9bb0ff' },
  { id: 'b', name: 'B star', mass: 6, L: 800, teff: 15000, radius: 3.5, years: 8e7, hazard: 0.55, color: '#aabfff' },
  { id: 'a', name: 'A star', mass: 1.8, L: 12, teff: 8500, radius: 1.7, years: 1e9, hazard: 0.28, color: '#cad7ff' },
  { id: 'f', name: 'F star', mass: 1.3, L: 3, teff: 6700, radius: 1.3, years: 4e9, hazard: 0.16, color: '#f8f7ff' },
  { id: 'g', name: 'G star', mass: 1, L: 1, teff: 5780, radius: 1, years: 1e10, hazard: 0.08, color: '#fff4ea' },
  { id: 'k', name: 'K star', mass: 0.7, L: 0.35, teff: 4900, radius: 0.75, years: 3e10, hazard: 0.1, color: '#ffd2a1' },
  { id: 'm', name: 'M dwarf', mass: 0.15, L: 0.003, teff: 2800, radius: 0.2, years: 1e13, hazard: 0.42, color: '#ff6a3d' },
  { id: 'giant', name: 'Red giant', mass: 1.2, L: 200, teff: 4000, radius: 40, years: 1e8, hazard: 0.7, color: '#ff7a3c' },
  { id: 'wd', name: 'White dwarf', mass: 0.6, L: 0.01, teff: 9000, radius: 0.01, years: 1e12, hazard: 0.3, color: '#e7f0ff' },
  { id: 'ns', name: 'Neutron star', mass: 1.4, L: 0.02, teff: 100000, radius: 0.00002, years: 1e7, hazard: 0.96, color: '#d7e4ff' },
  { id: 'bh', name: 'Black hole', mass: 10, L: 0.4, teff: 12000, radius: 0.05, years: 5e7, hazard: 0.9, color: '#ffb15a', disk: true }
];

export const COMPOSITIONS = [
  { id: 'rocky', name: 'Rocky', density: 5.5, albedo: 0.3, land: true, solventHint: 'water' },
  { id: 'iron', name: 'Iron', density: 8, albedo: 0.15, land: true, solventHint: 'water' },
  { id: 'water', name: 'Water world', density: 2.2, albedo: 0.4, land: true, solventHint: 'water' },
  { id: 'ice', name: 'Ice', density: 1.5, albedo: 0.6, land: true, solventHint: 'subsurface' },
  { id: 'gas', name: 'Gas giant', density: 1.3, albedo: 0.35, land: false, solventHint: 'cloud' },
  { id: 'icegiant', name: 'Ice giant', density: 1.6, albedo: 0.4, land: false, solventHint: 'cloud' },
  { id: 'carbon', name: 'Carbon', density: 4.2, albedo: 0.08, land: true, solventHint: 'silicon' },
  { id: 'exotic', name: 'Exotic', density: 3, albedo: 0.25, land: true, solventHint: 'exotic' }
];

export const ATMOSPHERES = [
  { id: 'none', name: 'None', pressure: 0, greenhouse: 0 },
  { id: 'n2o2', name: 'Nitrogen–oxygen', pressure: 1, greenhouse: 1 },
  { id: 'co2', name: 'Thick carbon dioxide', pressure: 8, greenhouse: 2.4 },
  { id: 'h2', name: 'Hydrogen envelope', pressure: 3, greenhouse: 0.6 },
  { id: 'ch4', name: 'Methane haze', pressure: 1.4, greenhouse: 0.4 },
  { id: 'nh3', name: 'Ammonia', pressure: 1, greenhouse: 0.5 }
];

const A = ['Ae', 'Va', 'Mir', 'Sol', 'Ke', 'Tu', 'Ly', 'Sa', 'Or', 'Ni', 'Cal', 'Io', 'Pha', 'Ny', 'The', 'Um'];
const B = ['ris', 'on', 'a', 'eon', 'ar', 'is', 'oth', 'une', 'ara', 'ion', 'es', 'yx', 'el', 'or'];

export function hashString(text) {
  let h = 2166136261;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function nameFrom(seed, salt) {
  const n = hashString(String(seed) + ':' + salt);
  return A[n % A.length] + B[(n >>> 4) % B.length];
}

export function starType(id) {
  return STAR_TYPES.find((s) => s.id === id) || STAR_TYPES.find((s) => s.id === 'g');
}

export function composition(id) {
  return COMPOSITIONS.find((c) => c.id === id) || COMPOSITIONS[0];
}

export function atmosphere(id) {
  return ATMOSPHERES.find((a) => a.id === id) || ATMOSPHERES[0];
}

export function createSystem(seed = 20260101) {
  const sys = {
    v: 2,
    id: 'sys-' + (hashString(String(seed)).toString(16)),
    seed,
    ageYears: 4.5e9,
    starCount: 1,
    architecture: 'single',
    separationAU: 20,
    outerAU: 120,
    stars: [],
    planets: [],
    belts: [],
    civs: [],
    evolved: false,
    neighbor: {
      id: 'quiet-harbor',
      systemId: 'quiet-harbor',
      name: 'Quiet Harbor',
      civ: 'Stillwater',
      distanceLy: 18,
      stage: 'technological',
      channel: 'radio',
      tEmitYear: 4.2e9,
      body: 'A harbor keeps a light on. The delay is the distance.'
    }
  };
  setStarCount(sys, 1);
  sys.stars[0].type = 'g';
  sys.stars[0].name = nameFrom(seed, 'star-0');
  addPlanet(sys, { composition: 'rocky', aAU: 1, radius: 1, density: 5.51, atmosphere: 'n2o2' });
  return sys;
}

export function setStarCount(sys, n) {
  const count = Math.max(0, Math.min(3, n | 0));
  sys.starCount = count;
  while (sys.stars.length < count) {
    const i = sys.stars.length;
    sys.stars.push({
      id: 'star-' + i,
      name: nameFrom(sys.seed, 'star-' + i),
      type: i === 0 ? 'g' : 'k'
    });
  }
  sys.stars.length = count;
  if (count === 0) sys.architecture = 'rogue';
  else if (count === 1) sys.architecture = 'single';
  else if (count === 2 && (sys.architecture === 'single' || sys.architecture === 'rogue' || sys.architecture === 'hierarchical')) sys.architecture = 's-type';
  else if (count === 3 && sys.architecture !== 'hierarchical') sys.architecture = 'hierarchical';
  return sys;
}

export function setArchitecture(sys, architecture) {
  sys.architecture = architecture;
  return sys;
}

export function setStarType(sys, index, typeId) {
  if (sys.stars[index]) sys.stars[index].type = typeId;
  return sys;
}

export function rename(sys, id, name) {
  const clean = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 32);
  if (!clean) return sys;
  const star = sys.stars.find((s) => s.id === id);
  if (star) star.name = clean;
  for (const p of sys.planets) {
    if (p.id === id) p.name = clean;
    for (const m of p.moons) if (m.id === id) m.name = clean;
  }
  return sys;
}

export function addPlanet(sys, partial = {}) {
  const i = sys.planets.length;
  const comp = composition(partial.composition || 'rocky');
  const starL = totalLuminosity(sys) || 1;
  const hz = zone(starL);
  const aAU = partial.aAU != null ? partial.aAU : (sys.starCount ? (hz.inner + hz.outer) / 2 : 1);
  const planet = {
    id: 'p-' + i + '-' + hashString(sys.seed + ':' + i).toString(16).slice(0, 4),
    name: partial.name || nameFrom(sys.seed, 'planet-' + i),
    composition: comp.id,
    aAU: Math.max(0.02, aAU),
    radius: partial.radius != null ? partial.radius : (comp.id === 'gas' ? 11 : comp.id === 'icegiant' ? 4 : 1),
    density: partial.density != null ? partial.density : comp.density,
    atmosphere: partial.atmosphere || (comp.land ? 'n2o2' : 'h2'),
    moons: [],
    host: sys.architecture === 's-type' ? 0 : null
  };
  sys.planets.push(planet);
  return planet;
}

export function addMoon(sys, planetId, partial = {}) {
  const planet = sys.planets.find((p) => p.id === planetId) || sys.planets[0];
  if (!planet) return null;
  const i = planet.moons.length;
  const moon = {
    id: planet.id + '-m' + i,
    name: partial.name || nameFrom(sys.seed, planet.id + '-moon-' + i),
    radius: partial.radius != null ? partial.radius : Math.max(0.08, planet.radius * 0.27),
    density: partial.density != null ? partial.density : 3.3,
    distanceRadii: partial.distanceRadii != null ? partial.distanceRadii : 20 + i * 12
  };
  planet.moons.push(moon);
  return moon;
}

export function addBelt(sys, aAU) {
  const belt = {
    id: 'belt-' + sys.belts.length,
    name: nameFrom(sys.seed, 'belt-' + sys.belts.length) + ' Belt',
    aAU: aAU != null ? aAU : 2.5
  };
  sys.belts.push(belt);
  return belt;
}

function typedStars(sys) {
  return sys.stars.map((s) => ({ ...s, spec: starType(s.type) }));
}

export function totalLuminosity(sys) {
  return typedStars(sys).reduce((sum, s) => sum + s.spec.L, 0);
}

export function totalMass(sys) {
  return typedStars(sys).reduce((sum, s) => sum + s.spec.mass, 0);
}

function hostLuminosity(sys, planet) {
  const stars = typedStars(sys);
  if (!stars.length) return 0;
  if (sys.architecture === 's-type') return stars[planet.host || 0].spec.L;
  return stars.reduce((sum, s) => sum + s.spec.L, 0);
}

function hostMass(sys, planet) {
  const stars = typedStars(sys);
  if (!stars.length) return 1;
  if (sys.architecture === 's-type') return stars[planet.host || 0].spec.mass;
  return stars.reduce((sum, s) => sum + s.spec.mass, 0);
}

export function describePlanet(sys, planet) {
  const comp = composition(planet.composition);
  const air = atmosphere(planet.atmosphere);
  const mass = massEarth(planet.radius, planet.density);
  const g = surfaceGravity(mass, planet.radius);
  const vesc = escapeVelocity(mass, planet.radius);
  const mStar = hostMass(sys, planet);
  const L = hostLuminosity(sys, planet);
  const period = sys.starCount ? orbitalPeriodYears(planet.aAU, mStar) : null;
  const teq = L > 0 ? equilibrium(L, planet.aAU, comp.albedo) : 40;
  const tsurf = greenhouseKelvin(teq, air.pressure, air.greenhouse);
  const hill = sys.starCount ? hillSphereAU(planet.aAU, mass, mStar) : planet.aAU * 0.05;
  const warnings = [];
  const stars = typedStars(sys);
  if (sys.architecture === 's-type' && planet.aAU > sTypeLimitAU(sys.separationAU)) {
    warnings.push('Unstable S-type orbit. This world sits too far from its star for the binary separation.');
  }
  if (sys.architecture === 'p-type' && planet.aAU < pTypeLimitAU(sys.separationAU)) {
    warnings.push('Unstable P-type orbit. A circumbinary world needs to stay outside about 2.4 times the stellar separation.');
  }
  if (sys.architecture === 'hierarchical' && sys.outerAU < sys.separationAU * 4) {
    warnings.push('The third star is too close. A hierarchy wants the outer star several times farther than the inner pair.');
  }
  const life = planet.life || null;
  const moons = planet.moons.map((moon) => {
    const roche = rocheRadii(planet.radius, planet.density, moon.density);
    const distEarth = moon.distanceRadii * planet.radius;
    const moonMass = massEarth(moon.radius, moon.density);
    const notes = [];
    if (moon.distanceRadii * planet.radius < roche) notes.push('Inside the Roche limit. A fluid moon would be torn apart.');
    const hillRadii = (hill * 23455) / Math.max(0.01, planet.radius);
    if (moon.distanceRadii > hillRadii) notes.push('Outside the Hill sphere. The star will take this moon.');
    return {
      ...moon,
      mass: moonMass,
      rocheRadii: roche,
      hillRadii,
      warnings: notes
    };
  });
  moons.forEach((m) => warnings.push(...m.warnings));
  const hz = L > 0 ? zone(L) : null;
  if (hz && comp.land && (planet.aAU < hz.inner || planet.aAU > hz.outer)) {
    warnings.push('Outside the star’s habitable zone for liquid water.');
  }
  const hazard = stars.reduce((h, s) => Math.max(h, s.spec.hazard), 0);
  const locked = sys.starCount > 0 && planet.aAU < (mStar < 0.5 ? 0.25 : 0.08) && comp.land;
  return {
    ...planet,
    compositionName: comp.name,
    land: comp.land,
    albedo: comp.albedo,
    atmosphereName: air.name,
    mass, g, vesc, period, teq, tsurf, hillAU: hill, L, hazard, locked, warnings, moons, life
  };
}

export function analyze(sys) {
  const stars = typedStars(sys).map((s) => {
    const hz = zone(s.spec.L);
    const notes = [];
    if (sys.ageYears > s.spec.years) notes.push(s.name + ' does not live ' + formatYears(sys.ageYears) + '. The main sequence ends near ' + formatYears(s.spec.years) + '.');
    return { ...s, hz, flux1AU: stellarFlux(s.spec.L, 1), notes };
  });
  const stability = [];
  if (sys.starCount === 0) stability.push({ level: 'note', text: 'A rogue system. Heat is leftover and radioactive, not sunlight.' });
  if (sys.architecture === 's-type') stability.push({ level: 'note', text: 'S-type: each world orbits one star. Stable orbits stay inside about 0.27 of the separation.' });
  if (sys.architecture === 'p-type') stability.push({ level: 'note', text: 'P-type: worlds orbit both stars. Stable orbits stay outside about 2.4 times the separation.' });
  if (sys.architecture === 'hierarchical') {
    const ok = sys.outerAU >= sys.separationAU * 4;
    stability.push({ level: ok ? 'note' : 'warn', text: ok
      ? 'Hierarchical triple. A close pair, and a third star far enough not to scramble it.'
      : 'This triple is not safely hierarchical. Move the outer star farther out.' });
  }
  const planets = sys.planets.map((p) => describePlanet(sys, p));
  planets.forEach((p) => p.warnings.forEach((text) => stability.push({ level: 'warn', text: p.name + ': ' + text })));
  return { stars, planets, stability, luminosity: totalLuminosity(sys), mass: totalMass(sys) };
}

function solventFor(body) {
  const comp = composition(body.composition);
  const t = body.tsurf;
  if (!body.land && (comp.id === 'gas' || comp.id === 'icegiant') && t > 80 && t < 400) return 'cloud';
  if (comp.id === 'ice' || body.hazard > 0.85) return 'subsurface';
  if (comp.id === 'carbon' && t > 500) return 'silicon';
  if (t >= 250 && t <= 400 && (comp.solventHint === 'water' || body.atmosphere === 'n2o2' || body.atmosphere === 'co2')) return 'water';
  if (t >= 190 && t < 250) return 'ammonia';
  if (t >= 80 && t < 160) return 'methane';
  if (t > 400 && body.atmosphere === 'co2') return 'sulfuric';
  if (comp.id === 'exotic') return t > 500 ? 'silicon' : 'water';
  return 'none';
}

const FORM = {
  water: 'Water-carbon life, kin to what Earth grew',
  ammonia: 'Ammonia-solvent life, a colder biochemistry',
  methane: 'Methane life in slow, cold lakes',
  sulfuric: 'Acid-sky life in a hot carbon-dioxide air',
  subsurface: 'A dark sea under ice, fed by tides or the rock',
  silicon: 'A hot silicon chemistry, speculative and stubborn',
  cloud: 'Floater life on a temperate deck of a giant',
  none: 'No lasting solvent'
};

function stageFor(solvent, age, hazard, land) {
  if (solvent === 'none') return age > 1e8 ? 'prebiotic' : 'sterile';
  const buried = solvent === 'subsurface';
  if (hazard > 0.9 && !buried) return age > 1e7 ? 'prebiotic' : 'sterile';
  if (age < 2e6) return 'prebiotic';
  if (age < 2e8) return 'microbial';
  if (age < 1e9) return 'complex';
  if (age < 2.5e9) return land || buried ? 'intelligent' : 'complex';
  return land || buried || solvent === 'cloud' ? 'technological' : 'intelligent';
}

export function evolve(sys, ageYears = sys.ageYears) {
  const next = { ...sys, planets: sys.planets.map((p) => ({ ...p, moons: p.moons.map((m) => ({ ...m })) })), stars: sys.stars.map((s) => ({ ...s })), belts: sys.belts.slice(), ageYears, evolved: true };
  const report = analyze(next);
  next.planets = next.planets.map((planet) => {
    const described = report.planets.find((p) => p.id === planet.id);
    const cap = next.stars.length ? Math.min(...next.stars.map((s) => starType(s.type).years)) : ageYears;
    const age = Math.min(ageYears, cap);
    const solvent = solventFor(described);
    const stage = stageFor(solvent, age, described.hazard, described.land);
    const life = { solvent, stage, form: FORM[solvent], age };
    return { ...planet, life };
  });
  next.civs = next.planets.filter((p) => p.life && (p.life.stage === 'intelligent' || p.life.stage === 'technological')).map((p) => ({
    id: 'civ-' + p.id,
    planetId: p.id,
    name: p.name + ' society',
    stage: p.life.stage,
    form: p.life.form,
    ship: designShip(next.seed + ':' + p.id, p.life, describePlanet(next, p).g)
  }));
  next.playerShip = designShip(next.seed + ':survey', { form: 'survey', stage: 'technological' }, 9.8);
  return next;
}

export function designShip(seed, life, gravity) {
  const h = hashString(seed);
  const profile = [];
  for (let i = 0; i < 9; i++) {
    const wobble = ((h >>> (i * 3)) & 7) / 7;
    const g = Math.min(2.2, Math.max(0.4, (gravity || 9.8) / 9.8));
    profile.push(0.18 + wobble * 0.55 * (life && life.stage === 'technological' ? 1 : 0.8) / g);
  }
  const palettes = [
    ['#d7b56a', '#1c3f86'],
    ['#e7e4dc', '#8d3b2a'],
    ['#b7d4c8', '#20463a'],
    ['#f0d0a0', '#5a2a44'],
    ['#c5d4e8', '#e25b1a']
  ];
  const pair = palettes[h % palettes.length];
  const cultures = ['harbor', 'kiln', 'tide', 'lantern', 'orchard'];
  return {
    id: 'ship-' + (h >>> 0).toString(16),
    seed: h,
    name: nameFrom(h, 'ship'),
    profile,
    hull: pair[0],
    accent: pair[1],
    culture: cultures[h % cultures.length],
    sensors: ['composition', 'density', 'temperature', 'life']
  };
}

export function scanBody(sys, bodyId) {
  const report = analyze(sys);
  const planet = report.planets.find((p) => p.id === bodyId);
  if (!planet) return null;
  const evolved = (sys.planets.find((p) => p.id === bodyId) || {}).life || planet.life;
  const tech = evolved && evolved.stage === 'technological';
  const bio = !evolved || evolved.stage === 'sterile' || evolved.stage === 'prebiotic' ? 'none' : evolved.stage === 'microbial' ? 'faint' : 'strong';
  return {
    name: planet.name,
    composition: planet.compositionName,
    density: planet.density,
    temperature: planet.tsurf,
    equilibrium: planet.teq,
    gravity: planet.g,
    life: evolved ? evolved.form : 'Not yet evolved',
    stage: evolved ? evolved.stage : 'unawakened',
    biosignature: bio,
    technosignature: tech ? 'narrowband carrier' : 'none'
  };
}

export function contactState(sys) {
  const tech = (sys.civs || []).filter((c) => c.stage === 'technological');
  const neighbor = sys.neighbor;
  const delayYears = neighbor.distanceLy;
  const arrived = (sys.ageYears || 0) + 1 >= neighbor.tEmitYear + delayYears;
  const local = [];
  const planets = sys.evolved ? sys.planets : [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const a = planets[i];
      const b = planets[j];
      if (!a.life || !b.life) continue;
      if (a.life.stage !== 'technological' || b.life.stage !== 'technological') continue;
      const au = Math.abs(a.aAU - b.aAU);
      local.push({
        id: a.id + '-' + b.id,
        from: a.name,
        to: b.name,
        minutes: au * LIGHT_MINUTES_PER_AU,
        body: a.name + ' can answer ' + b.name + '. The light-time is ' + (au * LIGHT_MINUTES_PER_AU).toFixed(1) + ' minutes.'
      });
    }
  }
  return {
    open: tech.length > 0,
    reason: tech.length ? '' : 'Contact waits for a technological civilization.',
    neighbor: tech.length && arrived ? {
      ...neighbor,
      delayYears,
      text: neighbor.civ + ' at ' + neighbor.name + ', ' + neighbor.distanceLy + ' ly away. The radio delay is ' + delayYears + ' years. ' + neighbor.body
    } : null,
    local
  };
}

export function formatYears(years) {
  if (years >= 1e9) return (years / 1e9).toFixed(years >= 1e10 ? 0 : 1).replace(/\.0$/, '') + ' billion years';
  if (years >= 1e6) return Math.round(years / 1e6) + ' million years';
  return Math.round(years) + ' years';
}

export const DISPLAY_AU = 22;

export function layoutBodies(sys, turn = 0) {
  return analyze(sys).planets.map((planet) => {
    const ang = planet.aAU * 0.7 + turn;
    return {
      ...planet,
      x: Math.cos(ang) * planet.aAU * DISPLAY_AU,
      z: Math.sin(ang) * planet.aAU * DISPLAY_AU
    };
  });
}

export const CODEX = [
  { id: 'kepler', title: 'Kepler’s third law', principle: 'The square of the period grows with the cube of the distance, divided by the mass of the star.', note: 'One AU and one solar mass is a one-year orbit.' },
  { id: 'hz', title: 'The habitable zone', principle: 'Liquid water wants a narrow band of sunlight. The edges scale with the square root of the star’s luminosity.', note: 'Air can move those edges. A thick carbon-dioxide blanket warms a world past the bare equilibrium.' },
  { id: 'teq', title: 'Equilibrium temperature', principle: 'A world radiates as much energy as it absorbs. Temperature follows the fourth root of the flux.', note: 'The flux falls with the square of distance. Albedo sends some of the light back.' },
  { id: 'gravity', title: 'Gravity and escape', principle: 'Surface gravity is mass over radius squared. Escape speed is the square root of twice that well.', note: 'A dense iron world of the same mass is smaller, and the well at its surface is deeper.' },
  { id: 'roche', title: 'Roche and Hill', principle: 'Inside the Roche limit a fluid moon is torn apart. Outside the Hill sphere the star steals it.', note: 'A moon has to live between those two distances.' },
  { id: 'binary', title: 'Two stars', principle: 'S-type worlds orbit one star and must stay close. P-type worlds orbit both and must stay well outside.', note: 'A third star is stable only as a hierarchy: a tight pair, and a distant companion.' },
  { id: 'life', title: 'Solvents', principle: 'Life needs a liquid. Water, ammonia, methane, and sulfuric acid melt and boil at different temperatures.', note: 'Silicon chains are real chemistry and a poor substitute for carbon in water. The game labels that path as speculation.' },
  { id: 'light', title: 'Light-time', principle: 'A signal crosses one AU in about 8.3 minutes, and one light-year in a year.', note: 'There is no universal now between stars. Contact is an arrival, not a conversation in the same minute.' }
];
