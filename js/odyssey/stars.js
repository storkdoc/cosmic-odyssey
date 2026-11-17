/* Stellar types and the relations the feature sliders are allowed to use.
   Luminosity is the Stefan–Boltzmann law. Main-sequence lifetime is fuel over
   luminosity. The habitable zone scales with the square root of luminosity. */
import { zone } from './physics.js';

export const TSUN = 5772;

export const STAR_TYPES = [
  { id: 'o', name: 'O', title: 'O star', kind: 'ms', mass: [16, 60], teff: [30000, 48000], radius: [6, 16], color: '#9bb0ff', flare: 1.6, habitability: 'The habitable zone sits far out, and the star dies before a world can grow a long childhood.' },
  { id: 'b', name: 'B', title: 'B star', kind: 'ms', mass: [2.5, 16], teff: [10000, 30000], radius: [2, 7], color: '#aabfff', flare: 1.2, habitability: 'Still a short life. The mild band of light is wide and distant.' },
  { id: 'a', name: 'A', title: 'A star', kind: 'ms', mass: [1.4, 2.5], teff: [7500, 10000], radius: [1.4, 2.4], color: '#cad7ff', flare: 0.8, habitability: 'A bright, brief main sequence. Planets can form. Complex life is in a hurry.' },
  { id: 'f', name: 'F', title: 'F star', kind: 'ms', mass: [1.05, 1.4], teff: [6000, 7500], radius: [1.1, 1.5], color: '#f8f7ff', flare: 0.9, habitability: 'A wide habitable zone and a life of a few billion years.' },
  { id: 'g', name: 'G', title: 'G star', kind: 'ms', mass: [0.8, 1.05], teff: [5200, 6000], radius: [0.85, 1.15], color: '#fff4ea', flare: 1, habitability: 'Sun-like. One known world grew a technological species inside this band of light.' },
  { id: 'k', name: 'K', title: 'K star', kind: 'ms', mass: [0.45, 0.8], teff: [3700, 5200], radius: [0.6, 0.9], color: '#ffd2a1', flare: 1.3, habitability: 'Dimmer than the Sun and far more patient. A favored target for temperate worlds.' },
  { id: 'm', name: 'M', title: 'M dwarf', kind: 'ms', mass: [0.08, 0.45], teff: [2400, 3700], radius: [0.1, 0.6], color: '#ff6a3d', flare: 4, habitability: 'The habitable zone is close, so worlds lock one face to the star, and flares are common.' },
  { id: 'giant', name: 'Giant', title: 'Red giant', kind: 'giant', mass: [0.8, 8], teff: [3000, 5000], radius: [10, 120], color: '#ff7a3c', flare: 0.5, habitability: 'The giant phase is a short chapter. Old habitable zones are now inside the fire.' },
  { id: 'wd', name: 'Dwarf', title: 'White dwarf', kind: 'wd', mass: [0.5, 1.3], teff: [4000, 25000], radius: [0.005, 0.02], color: '#e7f0ff', flare: 0.15, habitability: 'A dead core. Any garden has to sit very close to a fading light.' },
  { id: 'ns', name: 'Pulsar', title: 'Neutron star', kind: 'ns', mass: [1.1, 2.1], teff: [500000, 1500000], radius: [1.4e-5, 2e-5], color: '#d7e4ff', flare: 2, habitability: 'The beams are lethal. A magnetic field this fierce is not a sky you stand under.' },
  { id: 'bh', name: 'Hole', title: 'Black hole', kind: 'bh', mass: [5, 40], teff: [8000, 20000], radius: [1.5e-5, 1.2e-4], color: '#ffb15a', flare: 1.8, habitability: 'The disk shines only while matter falls in. Hawking radiation from a stellar hole is negligible.' }
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

export function defaultsFor(id) {
  const type = starType(id);
  const mass = type.id === 'g' ? 1 : mid(type.mass);
  const teff = type.id === 'g' ? TSUN : mid(type.teff);
  const radius = type.kind === 'ms' ? mainSequenceRadius(mass) : mid(type.radius);
  return {
    type: type.id,
    mass,
    radius: clamp(radius, type.radius[0], type.radius[1]),
    teff,
    age: type.kind === 'ms' ? Math.min(4.6e9, mainSequenceLifetime(mass, mainSequenceLuminosity(mass)) * 0.45) : type.kind === 'giant' ? 1e8 : type.kind === 'bh' ? 2e7 : 1e9,
    metallicity: 1,
    rotation: type.kind === 'ns' ? 0.5 : type.id === 'm' ? 8 : 25,
    activity: type.id === 'm' ? 0.65 : type.kind === 'bh' ? 0.5 : 0.25,
    magnetic: type.kind === 'ns' ? 12 : 0,
    spin: type.kind === 'bh' ? 0.5 : 0
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
  const teff = clamp(Number(input.teff), type.teff[0], type.teff[1]);
  const radius = clamp(Number(input.radius), type.radius[0], type.radius[1]);
  const activity = clamp(Number(input.activity) || 0, 0, 1);
  const magnetic = type.kind === 'ns' ? clamp(Number(input.magnetic) || 12, 8, 15) : 0;
  const spin = type.kind === 'bh' ? clamp(Number(input.spin) || 0, 0, 0.998) : 0;
  const luminosity = radius * radius * Math.pow(teff / TSUN, 4);
  let lifetime;
  if (type.kind === 'ms') lifetime = mainSequenceLifetime(mass, luminosity);
  else if (type.kind === 'giant') lifetime = 1e8 * Math.sqrt(Math.max(0.2, mass) / 8);
  else if (type.kind === 'wd') lifetime = 1e12;
  else if (type.kind === 'ns') lifetime = 1e7;
  else lifetime = 5e7;
  const hz = zone(Math.max(luminosity, 1e-8));
  const msL = type.kind === 'ms' ? mainSequenceLuminosity(mass) : null;
  const isco = type.kind === 'bh' ? iscoRadii(spin) : null;
  return {
    type: type.id, mass, teff, radius, diameter: radius * 2, luminosity, lifetime, hz, activity, msL, kind: type.kind,
    magnetic, spin, isco
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
