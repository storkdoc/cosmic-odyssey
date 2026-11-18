/* Planet types come from assets/planets/<id>.json. Radius and mass stay inside
   those ranges. Distance is a realistic band for the orbit zone, scaled with
   the square root of the light so it tracks the habitable glow. */
import { assessPlanet } from './gravity.js';
import { zone } from './physics.js';

export const EARTH_PER_SUN = 3.003e-6;
export const DISK_RADIUS_FRAC = 0.96875;

export const PLANET_IDS = [
  'mercury', 'mars', 'earth', 'waterworld', 'snowball', 'lava', 'eyeball', 'venus',
  'superearth', 'carbon', 'dune', 'minineptune', 'icegiant', 'jupiter', 'saturn',
  'hotjupiter', 'superjupiter'
];

/* Distance is AU at one solar luminosity. Tilt defaults sit between 15 and 25 degrees. */
const PLACEMENT = {
  mercury: { title: 'Mercury', distance: [0.25, 0.7], eccentricity: [0.05, 0.25], tilt: 15, names: ['Slag', 'Cinder', 'Flint'] },
  mars: { title: 'Mars', distance: [1.3, 2.4], eccentricity: [0.02, 0.15], tilt: 25, names: ['Rust', 'Dune', 'Ochre'] },
  earth: { title: 'Earth', distance: [0.9, 1.6], eccentricity: [0, 0.1], tilt: 23, names: ['Harbor', 'Mere', 'Lumen'] },
  waterworld: { title: 'Water world', distance: [0.95, 1.7], eccentricity: [0, 0.08], tilt: 20, names: ['Tide', 'Brine', 'Sound'] },
  snowball: { title: 'Snowball', distance: [1.8, 6], eccentricity: [0, 0.12], tilt: 18, names: ['Rime', 'Glint', 'Hoar'] },
  lava: { title: 'Lava world', distance: [0.03, 0.35], eccentricity: [0, 0.05], tilt: 15, names: ['Ember', 'Scoria', 'Magma'] },
  eyeball: { title: 'Eyeball', distance: [0.9, 1.6], eccentricity: [0, 0.02], tilt: 18, names: ['Iris', 'Gaze', 'Watch'] },
  venus: { title: 'Venus', distance: [0.55, 0.9], eccentricity: [0, 0.05], tilt: 17, names: ['Veil', 'Saffron', 'Haze'] },
  superearth: { title: 'Super-Earth', distance: [0.85, 1.7], eccentricity: [0, 0.12], tilt: 22, names: ['Bulk', 'Kiln', 'Massif'] },
  carbon: { title: 'Carbon', distance: [0.4, 1.4], eccentricity: [0, 0.15], tilt: 16, names: ['Graphite', 'Tar', 'Carbide'] },
  dune: { title: 'Dune', distance: [0.7, 1.6], eccentricity: [0, 0.12], tilt: 24, names: ['Sirocco', 'Erg', 'Salt'] },
  minineptune: { title: 'Mini-Neptune', distance: [1.2, 4], eccentricity: [0, 0.15], tilt: 20, names: ['Haze', 'Murk', 'Pall'] },
  icegiant: { title: 'Ice giant', distance: [12, 35], eccentricity: [0, 0.1], tilt: 21, names: ['Pale', 'Nimbus', 'Verge'] },
  jupiter: { title: 'Jupiter', distance: [3.5, 12], eccentricity: [0, 0.1], tilt: 15, names: ['Gale', 'Amber', 'Vault'] },
  saturn: { title: 'Saturn', distance: [6, 18], eccentricity: [0, 0.1], tilt: 25, names: ['Ring', 'Hex', 'Halo'] },
  hotjupiter: { title: 'Hot Jupiter', distance: [0.02, 0.25], eccentricity: [0, 0.05], tilt: 15, names: ['Coal', 'Ember', 'Soot'] },
  superjupiter: { title: 'Super-Jupiter', distance: [0.5, 40], eccentricity: [0, 0.3], tilt: 20, names: ['Cinder', 'Forge', 'Dusk'] }
};

let TYPES = [];

export function setPlanetTypes(list) {
  TYPES = list || [];
}

export function planetTypes() {
  return TYPES;
}

export function planetType(id) {
  return TYPES.find((type) => type.id === id) || TYPES[0] || null;
}

export function typeFromMeta(meta) {
  const place = PLACEMENT[meta.id] || {
    title: meta.id, distance: [0.8, 2], eccentricity: [0, 0.1], tilt: 20, names: [meta.typeName || meta.id]
  };
  return {
    id: meta.id,
    title: place.title,
    blurb: meta.typeName || place.title,
    note: meta.note || '',
    radius: meta.radiusEarth,
    mass: meta.massEarth,
    distance: place.distance,
    eccentricity: place.eccentricity,
    tilt: place.tilt,
    tidal: !!meta.tidallyLocked,
    emission: meta.emissive ? 1 : 0,
    atmosphere: meta.atmosphereTint || '#000000',
    orbitZone: meta.orbitZone || '',
    disk: meta.diskRadiusFrac || DISK_RADIUS_FRAC,
    rings: meta.rings || '',
    ringHalf: meta.ringsImageHalfWidthPlanetRadii || 0,
    names: place.names,
    poster: 'assets/planets/' + (meta.poster || meta.id + '-poster.png'),
    pack: 'assets/planets/' + (meta.pack || meta.id + '-pack.mp4'),
    retrograde: /clockwise/.test(meta.spinSense || '')
  };
}

export async function loadPlanetTypes() {
  const metas = await Promise.all(PLANET_IDS.map((id) => fetch('assets/planets/' + id + '.json').then((res) => {
    if (!res.ok) throw new Error(id);
    return res.json();
  })));
  const types = metas.map(typeFromMeta);
  setPlanetTypes(types);
  return types;
}

function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

function mid(range) {
  return (range[0] + range[1]) / 2;
}

export function orbitLight(layout, parent) {
  const stars = (layout && layout.stars) || [];
  if (!stars.length) return 1;
  if (parent === 'bary' || parent === 'pair') {
    const group = stars.length > 2 ? stars.slice(0, 2) : stars;
    return Math.max(1e-6, group.reduce((sum, star) => sum + (star.luminosity || 1), 0));
  }
  const index = parent === 'star1' ? 1 : parent === 'star2' ? 2 : 0;
  const star = stars[index] || stars[0];
  return Math.max(1e-6, star.luminosity || 1);
}

export function hostZone(layout, parent) {
  const stars = (layout && layout.stars) || [];
  if (!stars.length) return zone(1);
  if (parent === 'bary' || parent === 'pair') return zone(orbitLight(layout, parent));
  const index = parent === 'star1' ? 1 : parent === 'star2' ? 2 : 0;
  const star = stars[index] || stars[0];
  if (star.hz && star.hz.outer > star.hz.inner) return star.hz;
  return zone(star.luminosity || 1);
}

export function distanceRange(type, luminosity) {
  const scale = Math.sqrt(Math.max(1e-6, luminosity));
  return [type.distance[0] * scale, type.distance[1] * scale];
}

export function zoneSentence(layout, planet) {
  const hz = hostZone(layout, planet.parent);
  const where = planet.a < hz.inner
    ? 'sunward of the habitable glow'
    : planet.a > hz.outer
      ? 'out past the habitable glow'
      : 'inside the habitable glow';
  const zone = planet.orbitZone ? planet.orbitZone + ' zone, ' : '';
  return 'Orbit: ' + zone + where + '.';
}

export function defaultPlanet(type, layout, parent, taken) {
  const around = parent || 'star0';
  const light = orbitLight(layout, around);
  const dist = distanceRange(type, light);
  const name = (type.names || [type.title]).find((candidate) => !(taken || []).includes(candidate)) || type.title;
  return {
    id: type.id,
    name,
    radius: mid(type.radius),
    massEarth: mid(type.mass),
    a: mid(dist),
    e: mid(type.eccentricity),
    tilt: type.tilt,
    parent: around
  };
}

export function normalizePlanet(type, draft, layout) {
  const parent = draft.parent || 'star0';
  const light = orbitLight(layout, parent);
  const dist = distanceRange(type, light);
  const radius = clamp(Number(draft.radius) || mid(type.radius), type.radius[0], type.radius[1]);
  const massEarth = clamp(Number(draft.massEarth) || mid(type.mass), type.mass[0], type.mass[1]);
  const a = clamp(Number(draft.a) || mid(dist), dist[0], dist[1]);
  const e = clamp(Number(draft.e) || 0, type.eccentricity[0], type.eccentricity[1]);
  const tilt = clamp(Number(draft.tilt != null ? draft.tilt : type.tilt), 0, 40);
  let name = String(draft.name || type.title).replace(/\s+/g, ' ').trim();
  if (!name || name.includes('$')) name = type.title;
  if (name.length > 32) name = name.slice(0, 32);
  const primary = parent === 'star1' ? 1 : parent === 'star2' ? 2 : 0;
  return {
    id: type.id,
    name,
    radius,
    massEarth,
    mass: massEarth * EARTH_PER_SUN,
    a,
    e,
    tilt,
    parent: parent === 'bary' || parent === 'pair' ? 'bary' : parent,
    primary,
    tidal: !!type.tidal,
    emission: type.emission || 0,
    atmosphere: type.atmosphere,
    orbitZone: type.orbitZone,
    disk: type.disk || DISK_RADIUS_FRAC,
    rings: type.rings || '',
    ringHalf: type.ringHalf || 0,
    poster: type.poster,
    pack: type.pack,
    retrograde: !!type.retrograde,
    note: type.note || ''
  };
}

export function explainPlanet(layout, planet) {
  const verdict = assessPlanet(layout, planet);
  if (verdict.ok) return { ok: true, text: '' };
  const limit = verdict.limit;
  const where = typeof limit === 'number' ? ' about ' + limit.toFixed(2) + ' AU' : '';
  if (verdict.kind === 'S') {
    return {
      ok: false,
      text: 'This orbit would not stay. Around one star of the pair, anything past' + where
        + ' gets pulled apart by the companion. Bring it closer. That edge is the Holman and Wiegert limit.'
    };
  }
  if (verdict.kind === 'P') {
    return {
      ok: false,
      text: 'This orbit would not stay. A world around both stars has to live further out than' + where
        + ', or the two suns tug it onto a wild path. Move it outward. That edge is the Holman and Wiegert limit.'
    };
  }
  return { ok: false, text: verdict.reason || 'This orbit would not stay.' };
}

export function planetDisc(radiusEarth, orbitAU, extent) {
  const span = Math.max(extent || 1, 0.2);
  const grown = span * 0.07 * Math.pow(Math.max(0.15, radiusEarth), 0.28);
  const cap = Math.max(span * 0.028, Math.min(Math.max(orbitAU, 0.02) * 0.22, span * 0.11));
  return Math.min(cap, Math.max(span * 0.04, grown));
}
