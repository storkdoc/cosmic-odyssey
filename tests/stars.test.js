import { derive, defaultsFor, starType, flareIntervalSeconds, mainSequenceLuminosity, iscoRadii, STAR_TYPES } from '../js/odyssey/stars.js';

let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log(ok ? '  PASS' : '  FAIL', msg); };

const g = derive(defaultsFor('g'));
check(Math.abs(g.luminosity - 1) < 0.08, 'a solar twin is about 1 Lsun ' + g.luminosity);
check(g.hz.inner < 1 && g.hz.outer > 1, 'the solar habitable zone contains 1 AU ' + g.hz.inner + ' ' + g.hz.outer);
check(g.lifetime > 8e9 && g.lifetime < 1.4e10, 'solar lifetime is about 10 billion years ' + g.lifetime);

const quiet = derive(Object.assign({}, defaultsFor('g'), { activity: 0 }));
const active = derive(Object.assign({}, defaultsFor('g'), { activity: 1 }));
check(quiet.luminosity === active.luminosity, 'activity does not change luminosity');
check(flareIntervalSeconds(active) < flareIntervalSeconds(quiet), 'a more active star flares sooner');

const dwarf = derive(Object.assign({}, defaultsFor('m'), { teff: 9000, mass: 9 }));
check(dwarf.teff <= starType('m').teff[1], 'an M dwarf cannot be hotter than its type ' + dwarf.teff);
check(dwarf.mass <= starType('m').mass[1], 'an M dwarf mass stays in range ' + dwarf.mass);

const giantStar = derive(Object.assign({}, defaultsFor('o'), { mass: 40, radius: 12, teff: 40000 }));
check(giantStar.luminosity > 10000, 'a hot O star is enormously luminous ' + giantStar.luminosity);
check(giantStar.lifetime < 2e7, 'that O star lives only millions of years ' + giantStar.lifetime);
check(Math.abs(mainSequenceLuminosity(1) - 1) < 1e-6, 'mass-luminosity is 1 at 1 solar mass');

for (const type of STAR_TYPES) {
  for (const mass of [type.mass[0], (type.mass[0] + type.mass[1]) / 2, type.mass[1]]) {
    const d = derive({ type: type.id, mass, age: 1e20, teff: 9e9, radius: 9e9, activity: 1 });
    check(d.type === type.id, type.id + ' stays its type at mass ' + mass);
    check(d.mass >= type.mass[0] && d.mass <= type.mass[1], type.id + ' mass stays in range');
    check(d.teff >= type.teff[0] - 0.5 && d.teff <= type.teff[1] + 0.5, type.id + ' temperature stays in type ' + d.teff);
    if (type.kind !== 'bh') check(d.radius >= type.radius[0] * 0.999 && d.radius <= type.radius[1] * 1.001, type.id + ' radius stays in type ' + d.radius);
  }
}

const hole = derive(defaultsFor('bh'));
check(hole.kind === 'bh' && hole.hz.outer > hole.hz.inner, 'a black hole still reports a disk-light zone');
check(Math.abs(iscoRadii(0).prograde - 6) < 1e-6, 'a non-spinning hole has an ISCO at 6 GM/c^2');
check(iscoRadii(0.998).prograde < 1.5, 'a near-maximal spin pulls the ISCO inward');
const ns = derive(Object.assign({}, defaultsFor('ns'), { magnetic: 20 }));
check(ns.magnetic === 15, 'neutron-star magnetism stays inside the slider');
check(ns.diameter === ns.radius * 2, 'diameter is twice the radius');

if (fails) process.exit(1);
console.log('stars ok');
