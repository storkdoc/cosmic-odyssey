import {
  rocketDeltaV, hohmann, bielliptic, oberthGain, equilibriumTemperature,
  greenhouseSurface, habitableZone, rocheLimit, sailAccel, hubbleVelocity,
  redshift, mainSequenceYears, G0, AU_M, GM_SUN_SI, SOLAR_CONSTANT
} from '../js/science.js';
import { stepShip, AU, YEAR, GM_SUN, period } from '../js/sim.js';

let fails = 0;
const check = (ok, msg, extra) => {
  if (!ok) fails++;
  console.log(ok ? '  PASS' : '  FAIL', msg, extra === undefined ? '' : JSON.stringify(extra));
};

const dv = rocketDeltaV(450, 10, 1);
check(Math.abs(dv - 450 * G0 * Math.log(10)) < 1, 'Tsiolkovsky matches Isp times g times ln of the mass ratio', dv);

const earth = AU_M;
const mars = 1.524 * AU_M;
const hop = hohmann(GM_SUN_SI, earth, mars);
check(hop.dv > 5000 && hop.dv < 7000, 'an Earth-Mars Hohmann is a few kilometres per second', hop.dv);
check(hop.time > 180 * 86400 && hop.time < 320 * 86400, 'that transfer takes on the order of an Earth year half', hop.time / 86400);

const wide = bielliptic(GM_SUN_SI, earth, 50 * AU_M, 2000 * AU_M);
const direct = hohmann(GM_SUN_SI, earth, 50 * AU_M);
check(wide.dv < direct.dv, 'a bi-elliptic can beat a Hohmann when the outer orbit is very far', { wide: wide.dv, direct: direct.dv });

check(oberthGain(12000, 1000) > oberthGain(2000, 1000), 'the same burn yields more energy when you are already fast');

const teq = equilibriumTemperature(SOLAR_CONSTANT, 0.3);
check(teq > 240 && teq < 270, 'Earth equilibrium temperature is near 255 K', teq);
const surf = greenhouseSurface(teq, 1, 1);
check(surf > teq + 25 && surf < teq + 40, 'one bar of greenhouse air adds about 33 K', surf - teq);

const hz = habitableZone(1);
check(hz.inner < 1 && hz.outer > 1, 'Earth sits in the Sun habitable zone', hz);

const roche = rocheLimit(6371e3, 5500, 500);
check(roche > 4 * 6371e3 && roche < 7 * 6371e3, 'a loose rubble moon’s Roche limit is several Earth radii', roche / 6371e3);

const aSail = sailAccel(SOLAR_CONSTANT, 10000, 10, 0.9);
check(aSail > 0.001 && aSail < 0.02, 'a light sail of modest size accelerates gently', aSail);

check(Math.abs(hubbleVelocity(100, 70) - 7000) < 1, 'Hubble flow at 100 Mpc is about 7000 km/s');
check(redshift(3000) > 0.009 && redshift(3000) < 0.011, 'a few thousand km/s is a redshift near 0.01');
check(mainSequenceYears(1) === 1e10, 'a sunlike star’s main sequence is about ten billion years');
check(mainSequenceYears(10) < mainSequenceYears(1) / 100, 'a heavy star dies much younger');

const earthYear = period(AU, GM_SUN);
check(Math.abs(earthYear - YEAR) / YEAR < 0.002, 'the symplectic year still closes', earthYear);
const ship = { x: AU, y: 0, vx: 0, vy: Math.sqrt(GM_SUN / AU) };
for (let i = 0; i < 400; i++) stepShip(ship, [{ x: 0, y: 0, gm: GM_SUN, soft: 0.05 }], earthYear / 400);
check(Math.abs(Math.hypot(ship.x, ship.y) - AU) / AU < 0.01, 'velocity Verlet holds a circular orbit', Math.hypot(ship.x, ship.y));

console.log(fails ? `\n${fails} FAILED` : '\nscience checks passed');
process.exit(fails ? 1 : 0);
