import { readFile } from 'node:fs/promises';
import { derive, defaultsFor } from '../js/odyssey/stars.js';
import { designSystem } from '../js/odyssey/systems.js';
import { createGravity } from '../js/odyssey/gravity.js';
import {
  PLANET_IDS, typeFromMeta, setPlanetTypes, planetType, normalizePlanet, explainPlanet,
  defaultPlanet, planetDisc, zoneSentence
} from '../js/odyssey/planets.js';

let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log(ok ? '  PASS' : '  FAIL', msg); };

function star(id) {
  return Object.assign(defaultsFor(id), derive(defaultsFor(id)));
}

const metas = await Promise.all(PLANET_IDS.map(async (id) => JSON.parse(await readFile(new URL('../assets/planets/' + id + '.json', import.meta.url)))));
const types = metas.map(typeFromMeta);
setPlanetTypes(types);
check(types.length === 17, 'seventeen planet plates');
check(types.every((type) => Math.abs(type.disk - 0.96875) < 1e-6), 'every plate disk matches the packed radius');
check(planetType('eyeball').tidal && planetType('hotjupiter').tidal, 'eyeball and hot jupiter stay locked');
check(!planetType('earth').tidal && !planetType('lava').tidal, 'earth and lava keep the baked spin');
check(planetType('lava').emission === 1 && planetType('hotjupiter').emission === 1 && planetType('superjupiter').emission === 1, 'lava and the hot giants stay emissive');
check(planetType('saturn').rings === 'saturn-rings.png' && planetType('saturn').ringHalf === 2.4, 'saturn rings span 2.4 radii');
check(planetType('icegiant').rings === 'icegiant-rings.png' && planetType('icegiant').ringHalf === 2.7, 'ice giant rings span 2.7 radii');
check(planetType('venus').retrograde, 'venus is marked retrograde');
check(types.every((type) => type.tilt >= 15 && type.tilt <= 25), 'default tilt sits between 15 and 25 degrees');

const sun = designSystem([star('g')]);
const earth = normalizePlanet(planetType('earth'), defaultPlanet(planetType('earth'), sun, 'star0', []), sun);
check(earth.radius >= planetType('earth').radius[0] && earth.radius <= planetType('earth').radius[1], 'a garden stays inside its radius range');
check(earth.massEarth >= planetType('earth').mass[0] && earth.massEarth <= planetType('earth').mass[1], 'a garden stays inside its mass range');
check(earth.e >= planetType('earth').eccentricity[0] && earth.e <= planetType('earth').eccentricity[1], 'a garden eccentricity stays in range');
check(/habitable glow/.test(zoneSentence(sun, earth)), 'the temperate distance is described against the habitable glow ' + zoneSentence(sun, earth));
const named = normalizePlanet(planetType('earth'), Object.assign({}, earth, { name: '  Blue   Harbor  ' }), sun);
check(named.name === 'Blue Harbor', 'a name collapses to one line');
const priced = normalizePlanet(planetType('earth'), Object.assign({}, earth, { name: '10$' }), sun);
check(priced.name === 'Earth', 'a name with a price mark is replaced');
const huge = normalizePlanet(planetType('jupiter'), { radius: 100, massEarth: 99999, a: 0.01, e: 0.9, tilt: 80, parent: 'star0', name: 'Gale' }, sun);
check(huge.radius <= planetType('jupiter').radius[1] && huge.massEarth <= planetType('jupiter').mass[1], 'a giant cannot leave its type');
check(huge.a >= planetType('jupiter').distance[0] * 0.5, 'a giant is not dragged into a star');
check(huge.tilt <= 40, 'tilt stays a small angle');

const binary = designSystem([star('g'), star('k')]);
const tooFar = normalizePlanet(planetType('earth'), defaultPlanet(planetType('earth'), binary, 'star0', []), binary);
const refused = explainPlanet(binary, tooFar);
check(!refused.ok && /Holman and Wiegert/.test(refused.text) && /would not stay/.test(refused.text), 'an unstable S-type orbit is explained');
const wide = normalizePlanet(planetType('jupiter'), defaultPlanet(planetType('jupiter'), binary, 'bary', []), binary);
const circ = explainPlanet(binary, wide);
check(circ.ok || /further out/.test(circ.text), 'a circumbinary giant is judged against the outer limit');
const closeIn = normalizePlanet(planetType('lava'), defaultPlanet(planetType('lava'), binary, 'star0', []), binary);
const lava = explainPlanet(binary, closeIn);
check(!lava.ok && /would not stay/.test(lava.text), 'a sun-like lava orbit is too wide for this tight pair');

const grav = createGravity(binary, { secondsPerOrbit: 75 });
const before = grav.sample(0.01);
const pebble = { a: binary.holman.sType * 0.4, e: 0, parent: 'star0', primary: 0, mass: 3e-6, name: 'Pebble', epoch: 0.01 };
const added = grav.addPlanet(pebble, 0.01);
check(added.ok, 'the integrator accepts a stable world');
const after = grav.sample(0.01);
const shift = Math.hypot(after[0].x - before[0].x, after[0].z - before[0].z);
check(shift < 1e-3, 'adding a planet does not jump the star ' + shift);
check(grav.bodies.some((b) => b.kind === 'planet'), 'the planet joins the same state');

const lone = createGravity(sun, { secondsPerOrbit: 75 });
lone.addPlanet(Object.assign({}, earth, { epoch: 0 }), 0);
const trail = [];
for (let i = 0; i < 600; i++) {
  const body = lone.sample((i / 60) * lone.yearsPerSecond).find((b) => b.kind === 'planet');
  trail.push(body);
}
let frozen = 0;
let maxFrozen = 0;
const d2 = [];
for (let i = 1; i < trail.length; i++) {
  const step = Math.hypot(trail[i].x - trail[i - 1].x, trail[i].z - trail[i - 1].z);
  if (step < 1e-12) frozen += 1;
  else { maxFrozen = Math.max(maxFrozen, frozen); frozen = 0; }
}
for (let i = 1; i < trail.length - 1; i++) {
  d2.push(Math.hypot(
    trail[i + 1].x - 2 * trail[i].x + trail[i - 1].x,
    trail[i + 1].z - 2 * trail[i].z + trail[i - 1].z
  ));
}
const ordered = d2.slice().sort((a, b) => a - b);
const ratio = ordered[Math.floor(ordered.length / 2)] > 0 ? ordered[ordered.length - 1] / ordered[Math.floor(ordered.length / 2)] : Infinity;
check(maxFrozen === 0, 'a placed world does not stall');
check(ratio < 4, 'a placed world moves smoothly ' + ratio);
check(planetDisc(12, 8, 4) > planetDisc(1, 1, 4), 'a giant draws larger than a garden when the orbit allows');

if (fails) process.exit(1);
console.log('planets ok');
