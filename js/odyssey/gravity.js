/* Newtonian gravity in astronomical units.
   Distance is AU, mass is solar masses, time is years. In these units
   G = 4π², and Kepler's third law is P² = a³ / M.
   Stars and planets share one leapfrog integrator. A binary is a Keplerian
   ellipse about the barycenter. A hierarchical triple starts on nested
   Keplerian ellipses, which match the N-body motion while the outer orbit
   clears the Mardling–Aarseth limit, and is then integrated with the same
   leapfrog so a later planet feels every body. */
export const G = 4 * Math.PI * Math.PI;
export const DAYS_PER_YEAR = 365.25;
export const BINARY_ECCENTRICITY = 0.22;
export const TRIPLE_INNER_ECCENTRICITY = 0.18;

export function keplerPeriod(aAU, massSolar) {
  return Math.sqrt(Math.pow(Math.max(aAU, 1e-8), 3) / Math.max(massSolar, 1e-8));
}

function wrapTwoPi(angle) {
  const two = Math.PI * 2;
  let x = angle % two;
  if (x < 0) x += two;
  return x;
}

/* Newton solution of Kepler's equation M = E − e sin E. */
export function solveKepler(meanAnomaly, eccentricity) {
  const e = Math.min(0.9, Math.max(0, eccentricity || 0));
  const mean = wrapTwoPi(meanAnomaly);
  let E = e < 0.8 ? mean : Math.PI;
  for (let i = 0; i < 25; i++) {
    const f = E - e * Math.sin(E) - mean;
    const slope = 1 - e * Math.cos(E);
    const step = f / slope;
    E -= step;
    if (Math.abs(step) < 1e-14) break;
  }
  return E;
}

/* Relative orbit about the focus at the origin. */
export function relativeOrbit(a, e, years, mass) {
  const period = keplerPeriod(a, mass);
  const n = (Math.PI * 2) / period;
  const ecc = Math.min(0.9, Math.max(0, e || 0));
  const E = solveKepler(n * years, ecc);
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const denom = 1 - ecc * cosE;
  const x = a * (cosE - ecc);
  const z = a * Math.sqrt(Math.max(0, 1 - ecc * ecc)) * sinE;
  const vx = -a * sinE * n / denom;
  const vz = a * Math.sqrt(Math.max(0, 1 - ecc * ecc)) * cosE * n / denom;
  return { x, z, vx, vz, period, e: ecc, a };
}

export function keplerStars(layout, years) {
  const stars = layout.stars || [];
  if (stars.length < 2) return [];
  const e = layout.eccentricity || 0;
  const m1 = stars[0].mass;
  const m2 = stars[1].mass;
  if (stars.length === 2) {
    const rel = relativeOrbit(layout.separation, e, years, m1 + m2);
    const f1 = m2 / (m1 + m2);
    const f2 = m1 / (m1 + m2);
    return [
      bodyFrom(stars[0], -rel.x * f1, -rel.z * f1, -rel.vx * f1, -rel.vz * f1),
      bodyFrom(stars[1], rel.x * f2, rel.z * f2, rel.vx * f2, rel.vz * f2)
    ];
  }
  const m3 = stars[2].mass;
  const M12 = m1 + m2;
  const M = M12 + m3;
  const inner = relativeOrbit(layout.separation, e, years, M12);
  const outer = relativeOrbit(layout.outerAU, layout.outerEccentricity || 0, years, M);
  const bx = -outer.x * m3 / M;
  const bz = -outer.z * m3 / M;
  const bvx = -outer.vx * m3 / M;
  const bvz = -outer.vz * m3 / M;
  const f1 = m2 / M12;
  const f2 = m1 / M12;
  return [
    bodyFrom(stars[0], bx - inner.x * f1, bz - inner.z * f1, bvx - inner.vx * f1, bvz - inner.vz * f1),
    bodyFrom(stars[1], bx + inner.x * f2, bz + inner.z * f2, bvx + inner.vx * f2, bvz + inner.vz * f2),
    bodyFrom(stars[2], outer.x * M12 / M, outer.z * M12 / M, outer.vx * M12 / M, outer.vz * M12 / M)
  ];
}

function bodyFrom(star, x, z, vx, vz) {
  return {
    x, z, vx, vz,
    mass: star.mass,
    kind: 'star',
    drawAU: star.drawAU,
    type: star.type
  };
}

function accel(bodies) {
  const n = bodies.length;
  const ax = new Array(n).fill(0);
  const az = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = bodies[j].x - bodies[i].x;
      const dz = bodies[j].z - bodies[i].z;
      const r2 = dx * dx + dz * dz + 1e-18;
      const inv = G / (r2 * Math.sqrt(r2));
      ax[i] += bodies[j].mass * dx * inv;
      az[i] += bodies[j].mass * dz * inv;
      ax[j] -= bodies[i].mass * dx * inv;
      az[j] -= bodies[i].mass * dz * inv;
    }
  }
  return { ax, az };
}

export function leapfrog(bodies, dt) {
  const first = accel(bodies);
  for (let i = 0; i < bodies.length; i++) {
    bodies[i].vx += first.ax[i] * dt * 0.5;
    bodies[i].vz += first.az[i] * dt * 0.5;
    bodies[i].x += bodies[i].vx * dt;
    bodies[i].z += bodies[i].vz * dt;
  }
  const second = accel(bodies);
  for (let i = 0; i < bodies.length; i++) {
    bodies[i].vx += second.ax[i] * dt * 0.5;
    bodies[i].vz += second.az[i] * dt * 0.5;
  }
}

export function energy(bodies) {
  let kinetic = 0;
  let potential = 0;
  for (let i = 0; i < bodies.length; i++) {
    const v2 = bodies[i].vx * bodies[i].vx + bodies[i].vz * bodies[i].vz;
    kinetic += 0.5 * bodies[i].mass * v2;
    for (let j = i + 1; j < bodies.length; j++) {
      const dx = bodies[j].x - bodies[i].x;
      const dz = bodies[j].z - bodies[i].z;
      const r = Math.sqrt(dx * dx + dz * dz);
      potential -= G * bodies[i].mass * bodies[j].mass / Math.max(r, 1e-12);
    }
  }
  return { kinetic, potential, total: kinetic + potential };
}

export function angularMomentum(bodies) {
  let L = 0;
  for (let i = 0; i < bodies.length; i++) {
    L += bodies[i].mass * (bodies[i].x * bodies[i].vz - bodies[i].z * bodies[i].vx);
  }
  return L;
}

export function barycenter(bodies) {
  let m = 0;
  let x = 0;
  let z = 0;
  let vx = 0;
  let vz = 0;
  bodies.forEach((b) => {
    m += b.mass;
    x += b.mass * b.x;
    z += b.mass * b.z;
    vx += b.mass * b.vx;
    vz += b.mass * b.vz;
  });
  return { x: x / m, z: z / m, vx: vx / m, vz: vz / m, mass: m };
}

/* S-type planets must stay inside the Holman–Wiegert limit.
   P-type planets must stay outside it. */
export function assessPlanet(layout, planet) {
  const a = planet.a;
  if (!(a > 0)) return { ok: false, kind: 'none', reason: 'A planet needs a semimajor axis.' };
  const around = planet.parent === 'bary' || planet.parent === 'pair' ? 'P' : 'S';
  if (around === 'S' && layout && layout.holman && a >= layout.holman.sType) {
    return { ok: false, kind: 'S', limit: layout.holman.sType, reason: 'Inside the binary this orbit crosses the Holman and Wiegert limit.' };
  }
  if (around === 'P' && layout && layout.holman && a <= layout.holman.pType) {
    return { ok: false, kind: 'P', limit: layout.holman.pType, reason: 'Around both stars this orbit is inside the Holman and Wiegert limit.' };
  }
  return { ok: true, kind: around };
}

function cloneBodies(bodies) {
  return bodies.map((b) => Object.assign({}, b));
}

export function formatTimeRate(yearsPerSecond) {
  const days = yearsPerSecond * DAYS_PER_YEAR;
  let text;
  if (days >= DAYS_PER_YEAR) {
    const years = days / DAYS_PER_YEAR;
    text = '1 s = ' + (years >= 10 ? Math.round(years) : years.toFixed(1)) + ' years';
  } else if (days >= 1) {
    text = '1 s = ' + (days >= 10 ? Math.round(days) : days.toFixed(1)) + ' days';
  } else {
    text = '1 s = ' + Math.max(1, Math.round(days * 24)) + ' hours';
  }
  return { yearsPerSecond, days, text };
}

export function createGravity(layout, options = {}) {
  const seconds = options.secondsPerOrbit || 75;
  const period = layout.periodYears > 0 ? layout.periodYears : 1;
  const rate = formatTimeRate(period / seconds);
  let dt = period / 2000;
  const stars = layout.stars || [];
  let bodies = stars.length > 1
    ? keplerStars(layout, 0).map((b) => Object.assign({ kind: 'star' }, b))
    : stars.map((star) => ({
      kind: 'star', mass: star.mass, type: star.type, drawAU: star.drawAU,
      x: 0, z: 0, vx: 0, vz: 0
    }));
  (layout.planets || []).forEach((planet) => {
    const verdict = assessPlanet(layout, planet);
    if (!verdict.ok) return;
    placePlanet(bodies, layout, planet);
  });
  pinBarycenter(bodies);
  let initial = cloneBodies(bodies);
  let previous = cloneBodies(bodies);
  let physicsTime = 0;
  const binaryAnalytic = () => stars.length === 2 && bodies.every((b) => b.kind === 'star');

  function centered(list) {
    const cm = barycenter(list);
    return list.map((b) => Object.assign({}, b, { x: b.x - cm.x, z: b.z - cm.z }));
  }

  function interpolated(alpha) {
    const t = Math.min(1, Math.max(0, alpha));
    return previous.map((b, i) => {
      const c = bodies[i] || b;
      return Object.assign({}, c, {
        x: b.x + (c.x - b.x) * t,
        z: b.z + (c.z - b.z) * t,
        vx: b.vx + (c.vx - b.vx) * t,
        vz: b.vz + (c.vz - b.vz) * t
      });
    });
  }

  /* Exact time for a binary with no planets. Fixed steps plus interpolation otherwise. */
  function sample(targetYears) {
    const years = Math.max(0, targetYears || 0);
    if (binaryAnalytic()) return centered(keplerStars(layout, years));
    let guard = 0;
    while (physicsTime < years - 1e-15 && guard < 4096) {
      previous = cloneBodies(bodies);
      leapfrog(bodies, dt);
      physicsTime += dt;
      guard += 1;
    }
    const alpha = dt > 0 ? (years - (physicsTime - dt)) / dt : 1;
    return centered(interpolated(alpha));
  }

  return {
    get bodies() { return bodies; },
    get dt() { return dt; },
    period,
    yearsPerSecond: rate.yearsPerSecond,
    rateText: rate.text,
    sample,
    addPlanet(planet, atYears) {
      const verdict = assessPlanet(layout, planet);
      if (!verdict.ok) return verdict;
      const years = Math.max(0, atYears || 0);
      const onlyStars = bodies.every((b) => b.kind === 'star');
      if (stars.length === 2 && onlyStars) {
        bodies = keplerStars(layout, years).map((b) => Object.assign({ kind: 'star' }, b));
        physicsTime = years;
      } else if (stars.length > 2 && onlyStars) {
        let guard = 0;
        while (physicsTime < years - 1e-15 && guard < 4096) {
          leapfrog(bodies, dt);
          physicsTime += dt;
          guard += 1;
        }
      }
      const planetPeriod = keplerPeriod(planet.a, (planet.mass || 0) + centralMass(bodies, planet));
      dt = Math.min(dt, planetPeriod / 2000);
      placePlanet(bodies, layout, planet);
      pinBarycenter(bodies);
      initial = cloneBodies(bodies);
      previous = cloneBodies(bodies);
      physicsTime = Math.max(physicsTime, years);
      return verdict;
    }
  };
}

function hostStars(bodies, planet) {
  const stars = bodies.filter((b) => b.kind === 'star');
  const aroundPair = planet.parent === 'bary' || planet.parent === 'pair';
  if (aroundPair) return stars.length > 2 ? stars.slice(0, 2) : stars;
  const origin = bodies[planet.primary || 0] || stars[0];
  return origin ? [origin] : stars;
}

function centralMass(bodies, planet) {
  return hostStars(bodies, planet).reduce((sum, b) => sum + b.mass, 0) || 1;
}

function placePlanet(bodies, layout, planet) {
  const hosts = hostStars(bodies, planet);
  const cm = barycenter(hosts);
  const origin = { x: cm.x, z: cm.z, vx: cm.vx, vz: cm.vz };
  const central = cm.mass;
  const rel = relativeOrbit(planet.a, planet.e || 0, planet.epoch || 0, central + (planet.mass || 0));
  const mass = planet.mass > 0 ? planet.mass : 3e-6;
  bodies.push({
    kind: 'planet',
    mass,
    name: planet.name || 'planet',
    parent: planet.parent === 'bary' || planet.parent === 'pair' ? 'bary' : 'star',
    x: origin.x + rel.x * central / (central + mass),
    z: origin.z + rel.z * central / (central + mass),
    vx: origin.vx + rel.vx * central / (central + mass),
    vz: origin.vz + rel.vz * central / (central + mass)
  });
}

function pinBarycenter(bodies) {
  const cm = barycenter(bodies);
  bodies.forEach((b) => {
    b.x -= cm.x;
    b.z -= cm.z;
    b.vx -= cm.vx;
    b.vz -= cm.vz;
  });
}

