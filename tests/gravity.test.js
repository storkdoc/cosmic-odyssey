import { derive, defaultsFor } from '../js/odyssey/stars.js';
import { designSystem } from '../js/odyssey/systems.js';
import {
  keplerPeriod, relativeOrbit, keplerStars, createGravity, energy, angularMomentum, barycenter,
  assessPlanet, leapfrog, G
} from '../js/odyssey/gravity.js';

let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log(ok ? '  PASS' : '  FAIL', msg); };

function star(id) {
  return Object.assign(defaultsFor(id), derive(defaultsFor(id)));
}

function separation(bodies) {
  const dx = bodies[0].x - bodies[1].x;
  const dz = bodies[0].z - bodies[1].z;
  return Math.hypot(dx, dz);
}

function copy(bodies) {
  return bodies.map((b) => Object.assign({}, b));
}

const heavy = Object.assign(star('g'), { mass: 2 });
const light = Object.assign(star('k'), { mass: 1 });
const binary = designSystem([heavy, light]);
const a = binary.separation;
const e = binary.eccentricity;
const mass = 3;
const P = keplerPeriod(a, mass);
check(Math.abs(P - binary.periodYears) < 1e-9, 'the design period is Kepler’s third law ' + P);

const peri = relativeOrbit(a, e, 0, mass);
const apo = relativeOrbit(a, e, P / 2, mass);
const speed = (s) => Math.hypot(s.vx, s.vz);
check(speed(peri) > speed(apo) * 1.2, 'periapsis is faster than apoapsis ' + speed(peri) + ' ' + speed(apo));
const visPeri = Math.sqrt(G * mass * (1 + e) / (a * (1 - e)));
check(Math.abs(speed(peri) - visPeri) / visPeri < 1e-9, 'periapsis speed matches vis-viva');

const at0 = keplerStars(binary, 0);
check(Math.hypot(at0[0].x, at0[0].z) < Math.hypot(at0[1].x, at0[1].z), 'the heavier star sits closer to the barycenter');
const cm0 = barycenter(at0);
check(Math.hypot(cm0.x, cm0.z) < 1e-12, 'the Keplerian barycenter starts at the origin');

const grav = createGravity(binary, { secondsPerOrbit: 75 });
const e0 = energy(grav.bodies).total;
const L0 = angularMomentum(grav.bodies);
let worstE = 0;
let worstL = 0;
let worstCm = 0;
const stepsPerOrbit = Math.round(P / grav.dt);
const bodies = grav.bodies;
for (let orbit = 0; orbit < 1000; orbit++) {
  for (let s = 0; s < stepsPerOrbit; s++) leapfrog(bodies, grav.dt);
  const en = energy(bodies).total;
  const L = angularMomentum(bodies);
  const cm = barycenter(bodies);
  worstE = Math.max(worstE, Math.abs(en - e0) / Math.abs(e0));
  worstL = Math.max(worstL, Math.abs(L - L0) / Math.abs(L0));
  worstCm = Math.max(worstCm, Math.hypot(cm.x, cm.z));
}
check(worstE < 1e-4, 'energy stays within 1e-4 over 1000 orbits ' + worstE);
check(worstL < 1e-6, 'angular momentum stays within 1e-6 over 1000 orbits ' + worstL);
check(worstCm < 1e-8, 'the barycenter stays fixed over 1000 orbits ' + worstCm);

const timed = copy(keplerStars(binary, 0));
let prev = separation(timed);
let falling = false;
let measured = 0;
for (let s = 0; s < stepsPerOrbit * 2; s++) {
  leapfrog(timed, grav.dt);
  const r = separation(timed);
  if (falling && r > prev) {
    measured = (s - 1) * grav.dt;
    break;
  }
  falling = r < prev;
  prev = r;
}
check(Math.abs(measured - P) / P < 0.01, 'the integrated period matches Kepler ' + measured + ' vs ' + P);

const back = keplerStars(binary, P);
const drift = Math.hypot(back[0].x - at0[0].x, back[0].z - at0[0].z);
check(drift < 1e-8, 'one analytic period returns the star ' + drift);

const tooClose = assessPlanet(binary, { a: binary.holman.sType * 0.5, parent: 'star0' });
const tooWide = assessPlanet(binary, { a: binary.holman.sType * 2, parent: 'star' });
const circumbinary = assessPlanet(binary, { a: binary.holman.pType * 0.5, parent: 'bary' });
const widePair = assessPlanet(binary, { a: binary.holman.pType * 1.4, parent: 'bary' });
check(tooClose.ok && tooClose.kind === 'S', 'an S-type orbit inside the Holman limit is allowed');
check(!tooWide.ok && tooWide.kind === 'S', 'an S-type orbit past the Holman limit is refused');
check(!circumbinary.ok && circumbinary.kind === 'P', 'a P-type orbit inside the Holman limit is refused');
check(widePair.ok && widePair.kind === 'P', 'a P-type orbit outside the Holman limit is allowed');

const withPlanet = createGravity(binary, { secondsPerOrbit: 75 });
const added = withPlanet.addPlanet({ a: binary.holman.sType * 0.4, parent: 'star0', mass: 3e-6, name: 'world' });
check(added.ok, 'the integrator accepts a stable planet');
check(withPlanet.bodies.some((b) => b.kind === 'planet'), 'the planet joins the same N-body state');
const ep = energy(withPlanet.bodies).total;
for (let s = 0; s < stepsPerOrbit * 20; s++) leapfrog(withPlanet.bodies, withPlanet.dt);
const ep2 = energy(withPlanet.bodies).total;
check(Math.abs(ep2 - ep) / Math.abs(ep) < 1e-3, 'energy holds with a planet aboard ' + Math.abs(ep2 - ep) / Math.abs(ep));

const triple = designSystem([star('g'), star('k'), star('m')]);
check(triple.stable, 'the hierarchical triple is still stable');
const tg = createGravity(triple, { secondsPerOrbit: 75 });
const te0 = energy(tg.bodies).total;
const tL0 = angularMomentum(tg.bodies);
let twE = 0;
let twL = 0;
let twC = 0;
const tSteps = Math.round(triple.periodYears / tg.dt);
for (let orbit = 0; orbit < 1000; orbit++) {
  for (let s = 0; s < tSteps; s++) leapfrog(tg.bodies, tg.dt);
  twE = Math.max(twE, Math.abs(energy(tg.bodies).total - te0) / Math.abs(te0));
  twL = Math.max(twL, Math.abs(angularMomentum(tg.bodies) - tL0) / Math.abs(tL0));
  twC = Math.max(twC, Math.hypot(barycenter(tg.bodies).x, barycenter(tg.bodies).z));
}
check(twE < 5e-3, 'a triple keeps its energy over 1000 inner orbits ' + twE);
check(twL < 1e-4, 'a triple keeps its angular momentum ' + twL);
check(twC < 1e-8, 'a triple keeps its barycenter ' + twC);

const rate = grav.rateText;
check(/^1 s = /.test(rate) && !rate.includes('$'), 'the clock reads as a uniform rate ' + rate);
const screenSeconds = binary.periodYears / grav.yearsPerSecond;
check(screenSeconds >= 60 && screenSeconds <= 90, 'one real binary orbit takes about a minute and a quarter on screen ' + screenSeconds);

if (fails) process.exit(1);
console.log('gravity ok');
