import { derive, defaultsFor } from '../js/odyssey/stars.js';
import { designSystem, positionsAt, assessTriple, holmanWiegert, RSUN_AU, placeholderPlanets, plateScale } from '../js/odyssey/systems.js';

let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log(ok ? '  PASS' : '  FAIL', msg); };

function star(id) {
  return Object.assign(defaultsFor(id), derive(defaultsFor(id)));
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

const binary = designSystem([star('g'), star('k')]);
check(binary.stable && binary.architecture === 'binary', 'a designed binary is stable');
check(binary.separation > (binary.stars[0].trueAU + binary.stars[1].trueAU) * 2, 'the stars do not touch');
const hw = holmanWiegert(binary.separation, binary.stars[0].mass, binary.stars[1].mass, 0);
check(Math.abs(hw.sType - binary.holman.sType) < 1e-9, 'Holman S-type limit is stored');
check(hw.pType > binary.separation && hw.sType < binary.separation, 'S-type is inside the binary and P-type is outside');
const b0 = positionsAt(binary, 0);
const b1 = positionsAt(binary, 0.25);
check(Math.abs(dist(b0[0], b0[1]) - binary.separation) < 1e-6, 'binary separation at the start');
check(Math.abs(dist(b1[0], b1[1]) - binary.separation) < 1e-6, 'binary separation a quarter turn later');
check(dist(b0[0], b1[0]) > binary.separation * 0.2, 'the primary actually moves along the orbit');
check(/Holman/.test(binary.note), 'the binary note names the limit');

const triple = designSystem([star('g'), star('k'), star('m')]);
check(triple.stable && triple.architecture === 'hierarchical', 'a designed triple is stable');
check(triple.ratio > triple.crit, 'outer orbit clears Mardling and Aarseth ' + triple.ratio + ' > ' + triple.crit);
check(triple.periodRatio > 5, 'outer period is more than five times the inner ' + triple.periodRatio);
const t0 = positionsAt(triple, 0);
const t1 = positionsAt(triple, 0.37);
check(Math.abs(dist(t0[0], t0[1]) - triple.separation) < 1e-6, 'inner pair stays at its separation');
check(Math.abs(dist(t1[0], t1[1]) - triple.separation) < 1e-6, 'inner pair stays bound a moment later');
const bary = {
  x: (t0[0].x * triple.stars[0].mass + t0[1].x * triple.stars[1].mass) / (triple.stars[0].mass + triple.stars[1].mass),
  z: (t0[0].z * triple.stars[0].mass + t0[1].z * triple.stars[1].mass) / (triple.stars[0].mass + triple.stars[1].mass)
};
check(Math.abs(dist(bary, t0[2]) - triple.outerAU) < 1e-6, 'the third star orbits at the outer distance');
check(/Mardling/.test(triple.note), 'the triple note names the criterion');

const crushed = assessTriple({ aIn: 1, aOut: 1.4, m1: 1, m2: 1, m3: 1 });
check(!crushed.stable, 'a tight triple is not called stable');

const giants = designSystem([star('giant'), star('giant'), star('g')]);
check(giants.stable, 'two giants and a sun still get a stable hierarchy');
check(giants.separation > 2 * star('giant').radius * RSUN_AU, 'giant photospheres stay apart');

const single = designSystem([star('g')]);
const worlds = placeholderPlanets(single);
check(worlds.length >= 2, 'a single star has placeholder planets');
check(worlds.every((p) => p.a > 0.2 && p.period > 0), 'planets sit on orbits with a period');
const binaryPlanets = placeholderPlanets(binary);
check(binaryPlanets.some((p) => p.parent === 'bary' && p.a > binary.holman.pType), 'a circumbinary world stays outside the Holman limit');
check(plateScale({ diameter: 4 }) > plateScale({ diameter: 2 }), 'a larger diameter draws a larger plate');
check(plateScale({ radius: 0.00002 }) >= 0.28, 'a neutron star plate stays visible');

const none = designSystem([]);
check(none.architecture === 'rogue' && none.stable && /starless/.test(none.note), 'zero stars is a rogue system');

if (fails) process.exit(1);
console.log('systems ok');
