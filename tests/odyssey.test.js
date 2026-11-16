import { createSystem, analyze, evolve, designShip, contactState, addMoon, setStarCount, setArchitecture } from '../js/odyssey/universe.js';
import { equilibrium, orbitalPeriodYears, surfaceGravity, escapeVelocity, massEarth } from '../js/odyssey/physics.js';

let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log(ok ? '  PASS' : '  FAIL', msg); };

const teq = equilibrium(1, 1, 0.3);
check(teq > 250 && teq < 265, 'Earth equilibrium temperature is near 255 K ' + teq);
const mass = massEarth(1, 5.514);
check(Math.abs(mass - 1) < 0.02, 'Earth density and radius give one Earth mass');
check(Math.abs(surfaceGravity(1, 1) - 9.80665) < 0.01, 'Earth surface gravity');
check(Math.abs(escapeVelocity(1, 1) - 11.186) < 0.05, 'Earth escape speed');
check(Math.abs(orbitalPeriodYears(1, 1) - 1) < 1e-6, 'Kepler: 1 AU and 1 solar mass is one year');

const sys = createSystem(7);
const report = analyze(sys);
check(report.planets[0].period > 0.8 && report.planets[0].period < 2.2, 'the default world has a year of the right order');
const life = evolve(sys, 4.5e9);
check(life.planets[0].life.stage === 'technological', 'an Earth-like world at 4.5 Gyr is technological: ' + life.planets[0].life.stage + ' ' + life.planets[0].life.form);
const again = evolve(sys, 4.5e9);
check(again.planets[0].life.form === life.planets[0].life.form && again.civs[0].ship.profile.join() === life.civs[0].ship.profile.join(), 'evolution and the ship are deterministic');

const other = designShip('different-seed', life.planets[0].life, 9.8);
check(other.profile.join() !== life.civs[0].ship.profile.join(), 'two civilizations do not share a hull');

const contact = contactState(life);
check(contact.open && contact.neighbor && contact.neighbor.delayYears === 18, 'a technological world can hear a neighbor, with the light-year delay');
check(!contactState(sys).open, 'before evolution, contact stays shut');

setStarCount(sys, 2);
setArchitecture(sys, 's-type');
sys.separationAU = 6;
sys.planets[0].aAU = 5;
const unstable = analyze(sys);
check(unstable.stability.some((s) => /S-type/.test(s.text)), 'an S-type world too far from its star is warned');

setArchitecture(sys, 'p-type');
sys.separationAU = 4;
sys.planets[0].aAU = 2;
check(analyze(sys).stability.some((s) => /P-type/.test(s.text)), 'a circumbinary world inside the limit is warned');

const moon = addMoon(sys, sys.planets[0].id, { distanceRadii: 1.2, density: 1, radius: 0.2 });
const moons = analyze(sys).planets[0].moons;
check(moons.some((m) => m.warnings.some((w) => /Roche/.test(w))), 'a moon inside the Roche limit is warned');

console.log(fails ? fails + ' FAILED' : 'odyssey checks passed');
process.exit(fails ? 1 : 0);
