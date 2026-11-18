/* Stellar types and the relations the feature sliders are allowed to use.
   Luminosity is the Stefan–Boltzmann law. Main-sequence lifetime is fuel over
   luminosity. The habitable zone scales with the square root of luminosity. */
import { zone } from './physics.js';

export const TSUN = 5772;

const KM_PER_RSUN = 695700;

export const STAR_TYPES = [
  { id: 'o', name: 'O', title: 'O star', kind: 'ms', mass: [16, 60], teff: [30000, 48000], radius: [6, 16], color: '#9bb0ff', flare: 1.6, habitability: 'Hot, short-lived, habitable zone far out.' },
  { id: 'b', name: 'B', title: 'B star', kind: 'ms', mass: [2.5, 16], teff: [10000, 30000], radius: [1.8, 6.6], color: '#aabfff', flare: 1.2, habitability: 'Bright and brief. The mild band of light is distant.' },
  { id: 'a', name: 'A', title: 'A star', kind: 'ms', mass: [1.4, 2.5], teff: [7500, 10000], radius: [1.4, 2.4], color: '#cad7ff', flare: 0.8, habitability: 'A bright main sequence. Complex life is in a hurry.' },
  { id: 'f', name: 'F', title: 'F star', kind: 'ms', mass: [1.04, 1.4], teff: [6000, 7500], radius: [1.15, 1.55], color: '#f8f7ff', flare: 0.9, habitability: 'A wide habitable zone and a few billion years.' },
  { id: 'g', name: 'G', title: 'G star', kind: 'ms', mass: [0.84, 1.15], teff: [5300, 6000], radius: [0.85, 1.2], color: '#ffb15a', flare: 1, habitability: 'Sun-like. One known world grew a technological species here.' },
  { id: 'k', name: 'K', title: 'K star', kind: 'ms', mass: [0.45, 0.84], teff: [3900, 5300], radius: [0.55, 0.9], color: '#ff9a4a', flare: 1.3, habitability: 'Dimmer than the Sun, and far more patient.' },
  { id: 'm', name: 'M', title: 'M dwarf', kind: 'ms', mass: [0.08, 0.57], teff: [2400, 3900], radius: [0.1, 0.63], color: '#ff5a2a', flare: 4, habitability: 'A close habitable zone, often with flares.' },
  { id: 'giant', name: 'Giant', title: 'Red giant', kind: 'giant', mass: [0.8, 8], teff: [3000, 5000], radius: [10, 120], color: '#ff6a22', flare: 0.7, habitability: 'A short swollen chapter. Old gardens are inside the fire.' },
  { id: 'wd', name: 'Dwarf', title: 'White dwarf', kind: 'wd', mass: [0.5, 1.3], teff: [4000, 25000], radius: [0.008, 0.014], color: '#e7f0ff', flare: 0.15, habitability: 'Earth-size remnant. Any garden sits very close.' },
  { id: 'ns', name: 'Pulsar', title: 'Neutron star', kind: 'ns', mass: [1.1, 2.3], teff: [500000, 1500000], radius: [10 / KM_PER_RSUN, 15 / KM_PER_RSUN], color: '#d7e4ff', flare: 2, habitability: 'About 10–15 km across. The beams are lethal.' },
  { id: 'bh', name: 'Hole', title: 'Black hole', kind: 'bh', mass: [3, 30], teff: [8000, 20000], radius: [3 * 2.95 / KM_PER_RSUN, 30 * 2.95 / KM_PER_RSUN], color: '#ffb15a', flare: 1.8, habitability: 'The disk shines while matter falls in.' }
];

export function starType(id) {
  return STAR_TYPES.find((s) => s.id === id) || STAR_TYPES.find((s) => s.id === 'g');
}

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

function mid(range) {
  return (range[0] + range[1]) / 2;
}

/* Radius the main sequence would give this mass, in solar radii. */
export function mainSequenceRadius(mass) {
  const m = Math.max(0.08, mass);
  return Math.pow(m, m < 0.43 ? 0.9 : 0.8);
}

/* Mass–luminosity, solar units. A rough split at 0.43 solar masses. */
export function mainSequenceLuminosity(mass) {
  const m = Math.max(0.08, mass);
  return Math.pow(m, m < 0.43 ? 2.3 : 3.5);
}

function span(range, t) {
  return range[0] + (range[1] - range[0]) * clamp(t, 0, 1);
}

function fraction(mass, range) {
  return clamp((mass - range[0]) / Math.max(1e-8, range[1] - range[0]), 0, 1);
}

/* Radius, temperature, and luminosity follow mass and age, and stay inside the type. */
export function couple(type, mass, age, activity) {
  const t = fraction(mass, type.mass);
  let radius;
  let teff;
  let lifetime;
  if (type.kind === 'ms') {
    const Lms = mainSequenceLuminosity(mass);
    lifetime = mainSequenceLifetime(mass, Lms);
    const ageFrac = clamp(age / Math.max(1, lifetime), 0, 1);
    radius = clamp(mainSequenceRadius(mass) * (1 + 0.08 * ageFrac), type.radius[0], type.radius[1]);
    const physical = TSUN * Math.pow(Lms / Math.max(1e-8, radius * radius), 0.25) * (1 - 0.035 * ageFrac);
    teff = physical >= type.teff[0] && physical <= type.teff[1]
      ? physical
      : span(type.teff, t);
    teff = clamp(teff, type.teff[0], type.teff[1]);
  } else if (type.kind === 'giant') {
    lifetime = 1e8 * Math.sqrt(Math.max(0.2, mass) / 8);
    const ageFrac = clamp(age / Math.max(1, lifetime), 0, 1);
    radius = clamp(span(type.radius, 0.2 + 0.65 * t + 0.15 * ageFrac), type.radius[0], type.radius[1]);
    teff = clamp(span(type.teff, 0.15 + 0.7 * (1 - t)), type.teff[0], type.teff[1]);
  } else if (type.kind === 'wd') {
    lifetime = 1e12;
    radius = span([type.radius[1], type.radius[0]], t);
    teff = span([type.teff[1], type.teff[0]], clamp(age / 8e9, 0, 1));
  } else if (type.kind === 'ns') {
    lifetime = 1e7;
    radius = span([type.radius[1], type.radius[0]], t * 0.65);
    teff = span([type.teff[1], type.teff[0]], clamp(age / 1e6, 0, 1));
  } else {
    lifetime = 5e7;
    radius = 2.95 * mass / KM_PER_RSUN;
    teff = span(type.teff, clamp(activity, 0, 1));
  }
  return { radius, teff, lifetime };
}

export function defaultsFor(id) {
  const type = starType(id);
  const mass = type.id === 'g' ? 1 : mid(type.mass);
  const age = type.kind === 'ms' ? Math.min(4.6e9, mainSequenceLifetime(mass, mainSequenceLuminosity(mass)) * 0.45) : type.kind === 'giant' ? 1e8 : type.kind === 'bh' ? 2e7 : 1e9;
  const activity = type.id === 'm' ? 0.65 : type.kind === 'bh' ? 0.55 : 0.35;
  const coupled = couple(type, mass, age, activity);
  return {
    type: type.id,
    mass,
    radius: coupled.radius,
    teff: coupled.teff,
    age,
    metallicity: 1,
    rotation: type.kind === 'ns' ? 0.5 : type.id === 'm' ? 8 : 25,
    activity,
    magnetic: type.kind === 'ns' ? 12 : 0,
    spin: type.kind === 'bh' ? 0.6 : 0
  };
}

/* Prograde innermost stable orbit in units of GM/c^2. Bardeen, Press, Teukolsky 1972. */
export function iscoRadii(spin) {
  const a = clamp(Number(spin) || 0, 0, 0.998);
  const z1 = 1 + Math.cbrt(1 - a * a) * (Math.cbrt(1 + a) + Math.cbrt(1 - a));
  const z2 = Math.sqrt(3 * a * a + z1 * z1);
  const prograde = 3 + z2 - Math.sqrt(Math.max(0, (3 - z1) * (3 + z1 + 2 * z2)));
  return { spin: a, prograde, horizon: 1 + Math.sqrt(Math.max(0, 1 - a * a)) };
}

export function mainSequenceLifetime(mass, luminosity) {
  return 1e10 * Math.max(0.08, mass) / Math.max(1e-6, luminosity);
}

export function derive(input) {
  const type = starType(input.type);
  const mass = clamp(Number(input.mass), type.mass[0], type.mass[1]);
  const activity = clamp(Number(input.activity) || 0, 0, 1);
  const magnetic = type.kind === 'ns' ? clamp(Number(input.magnetic) || 12, 8, 15) : 0;
  const spin = type.kind === 'bh' ? clamp(Number(input.spin) || 0, 0, 0.998) : 0;
  const seedAge = Number(input.age) || 0;
  const first = couple(type, mass, seedAge, activity);
  const age = clamp(seedAge, 0, first.lifetime);
  const coupled = couple(type, mass, age, activity);
  const radius = coupled.radius;
  const teff = coupled.teff;
  const luminosity = radius * radius * Math.pow(teff / TSUN, 4);
  const hz = zone(Math.max(luminosity, 1e-8));
  const msL = type.kind === 'ms' ? mainSequenceLuminosity(mass) : null;
  const isco = type.kind === 'bh' ? iscoRadii(spin) : null;
  return {
    type: type.id, mass, teff, radius, diameter: radius * 2, luminosity, lifetime: coupled.lifetime, hz, activity, msL, kind: type.kind,
    magnetic, spin, isco, age
  };
}

export function formatYears(years) {
  if (years >= 1e9) return (years / 1e9).toFixed(years >= 10e9 ? 0 : 1).replace(/\.0$/, '') + ' billion years';
  if (years >= 1e6) return Math.round(years / 1e6) + ' million years';
  if (years >= 1e3) return Math.round(years / 1e3) + ' thousand years';
  return Math.round(years) + ' years';
}

export function flareIntervalSeconds(spec) {
  const type = starType(spec.type);
  const act = clamp(Number(spec.activity) || 0, 0, 1);
  const base = 14 / Math.max(0.15, type.flare);
  return base / (0.2 + act * 1.4);
}
