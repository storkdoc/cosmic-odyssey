/* Stable architectures for one, two, and three stars.
   Two stars are a circular binary. Planet limits follow Holman & Wiegert 1999.
   Three stars are a hierarchical triple. The outer orbit clears the
   Mardling & Aarseth 2001 criterion with a margin, and the outer period
   is more than five times the inner period. Orbits are circular and coplanar.
   The motion the screen shows keeps those period ratios and runs faster than real time. */
import { starType } from './stars.js';
import { keplerPeriod, keplerStars, BINARY_ECCENTRICITY, TRIPLE_INNER_ECCENTRICITY } from './gravity.js';

export const RSUN_AU = 0.00465047;

export function holmanWiegert(separation, m1, m2, e = 0) {
  const mu = m2 / Math.max(1e-8, m1 + m2);
  const ee = Math.min(0.8, Math.max(0, e));
  const sCoeff = 0.464 - 0.380 * mu - 0.631 * ee + 0.586 * mu * ee + 0.150 * ee * ee - 0.198 * mu * ee * ee;
  const pCoeff = 1.60 + 5.10 * ee - 2.22 * ee * ee + 4.12 * mu - 4.27 * ee * mu - 5.09 * mu * mu + 4.61 * ee * ee * mu * mu;
  return { mu, sType: sCoeff * separation, pType: pCoeff * separation, separation };
}

/* Critical outer/inner semimajor-axis ratio for a circular or eccentric triple. */
export function mardlingRatio(qOut, eIn = 0, eOut = 0) {
  const q = Math.max(0, qOut);
  const ei = Math.min(0.8, Math.max(0, eIn));
  const eo = Math.min(0.8, Math.max(0, eOut));
  const peri = 2.8 * Math.pow(1 + q, 2 / 5) * Math.pow(1 + eo, 2 / 5) * Math.pow(1 - ei, -1 / 5);
  return peri / Math.pow(1 - eo, 6 / 5);
}

export function assessTriple({ aIn, aOut, m1, m2, m3, eIn = 0, eOut = 0 }) {
  const q = m3 / Math.max(1e-8, m1 + m2);
  const crit = mardlingRatio(q, eIn, eOut);
  const ratio = aOut / Math.max(1e-8, aIn);
  const periodRatio = Math.pow(ratio, 1.5) * Math.sqrt((m1 + m2) / Math.max(1e-8, m1 + m2 + m3));
  return { q, crit, ratio, periodRatio, stable: ratio > crit * 1.001 && periodRatio > 5 };
}

export function displayRadiusAU(star) {
  const trueAU = Math.max(1e-12, star.radius) * RSUN_AU;
  let floor = 0;
  if (star.kind === 'ns' || star.kind === 'bh') floor = 0.016;
  else if (star.kind === 'wd') floor = 0.01;
  return { trueAU, drawAU: Math.max(trueAU, floor), enlarged: trueAU < floor - 1e-6 };
}

function kindOf(star) {
  return star.kind || starType(star.type).kind;
}

function detachedAU(a, b) {
  const da = displayRadiusAU(Object.assign({}, a, { kind: kindOf(a) }));
  const db = displayRadiusAU(Object.assign({}, b, { kind: kindOf(b) }));
  const trueTouch = (a.radius + b.radius) * RSUN_AU;
  return Math.max(0.15, trueTouch * 8, (da.drawAU + db.drawAU) * 5);
}

function periodYears(aAU, massSolar) {
  return keplerPeriod(aAU, massSolar);
}

function formatPeriod(years) {
  if (years >= 1) return (years >= 10 ? years.toFixed(0) : years.toFixed(1)) + ' years';
  const days = years * 365.25;
  if (days >= 1) return (days >= 10 ? days.toFixed(0) : days.toFixed(1)) + ' days';
  return (days * 24).toFixed(1) + ' hours';
}

function pack(star) {
  const kind = kindOf(star);
  const draw = displayRadiusAU(Object.assign({}, star, { kind }));
  return Object.assign({}, star, draw, { kind });
}

export function designSystem(stars) {
  const list = (stars || []).map(pack);
  if (!list.length) {
    return {
      count: 0, architecture: 'rogue', stable: true, stars: [], paths: [], span: 1,
      note: 'No star. This is a rogue, starless system. Worlds here would wander in the dark.'
    };
  }
  if (list.length === 1) {
    const enlarged = list[0].enlarged ? ' A remnant this small is drawn larger than its true radius so it can be found.' : '';
    return {
      count: 1, architecture: 'single', stable: true, stars: list, paths: [],
      span: Math.max(0.4, list[0].drawAU * 10),
      note: 'One star. Planets will take their orbits around it.' + enlarged
    };
  }
  if (list.length === 2) return designBinary(list[0], list[1]);
  return designTriple(list[0], list[1], list[2]);
}

function designBinary(a, b) {
  const separation = detachedAU(a, b);
  const eccentricity = BINARY_ECCENTRICITY;
  const holman = holmanWiegert(separation, a.mass, b.mass, eccentricity);
  const period = periodYears(separation, a.mass + b.mass);
  const M = a.mass + b.mass;
  const r1 = separation * b.mass / M;
  const r2 = separation * a.mass / M;
  const close = separation < 0.5;
  const enlarged = a.enlarged || b.enlarged ? ' Remnants are drawn larger than their true radii.' : '';
  return {
    count: 2,
    architecture: 'binary',
    stable: separation * (1 - eccentricity) > (a.trueAU + b.trueAU) * 1.5,
    separation,
    eccentricity,
    periodYears: period,
    holman,
    stars: [a, b],
    paths: [{ radius: r1, e: eccentricity, flip: true }, { radius: r2, e: eccentricity, flip: false }],
    span: separation * (1 + eccentricity),
    note: (close ? 'A stable close binary. ' : 'A stable wide binary. ')
      + 'The stars follow ellipses about their common center of mass, semimajor axis ' + separation.toFixed(2) + ' AU, eccentricity ' + eccentricity.toFixed(2) + ', once every ' + formatPeriod(period) + '. '
      + 'The heavier star stays closer to the center. Kepler’s third law sets that period from the masses. '
      + 'A planet around one star stays stable inside about ' + holman.sType.toFixed(2) + ' AU of that star. '
      + 'A planet around both stays stable beyond about ' + holman.pType.toFixed(2) + ' AU (Holman and Wiegert). '
      + 'One clock speeds the whole system up so you can watch it.' + enlarged
  };
}

function designTriple(a, b, c) {
  const aIn = detachedAU(a, b);
  const eccentricity = TRIPLE_INNER_ECCENTRICITY;
  const q = c.mass / (a.mass + b.mass);
  const crit = mardlingRatio(q, eccentricity, 0);
  const drawGap = aIn + 6 * (c.drawAU + Math.max(a.drawAU, b.drawAU));
  const aOut = Math.max(aIn * crit * 2.4, drawGap);
  const assessed = assessTriple({ aIn, aOut, m1: a.mass, m2: b.mass, m3: c.mass, eIn: eccentricity, eOut: 0 });
  const M12 = a.mass + b.mass;
  const periodIn = periodYears(aIn, M12);
  const periodOut = periodYears(aOut, M12 + c.mass);
  const r1 = aIn * b.mass / M12;
  const r2 = aIn * a.mass / M12;
  const outerR = aOut * M12 / (M12 + c.mass);
  const enlarged = a.enlarged || b.enlarged || c.enlarged ? ' Remnants are drawn larger than their true radii.' : '';
  return {
    count: 3,
    architecture: 'hierarchical',
    stable: assessed.stable,
    separation: aIn,
    eccentricity,
    outerEccentricity: 0,
    outerAU: aOut,
    periodYears: periodIn,
    outerPeriodYears: periodOut,
    periodRatio: assessed.periodRatio,
    crit: assessed.crit,
    ratio: assessed.ratio,
    stars: [a, b, c],
    paths: [
      { radius: r1, e: eccentricity, flip: true },
      { radius: r2, e: eccentricity, flip: false },
      { radius: outerR, e: 0, flip: false }
    ],
    span: aOut * 1.35,
    note: 'A hierarchical triple. The inner pair is ' + aIn.toFixed(2) + ' AU apart, with a period of ' + formatPeriod(periodIn) + '. '
      + 'The third star orbits that pair at ' + aOut.toFixed(2) + ' AU, every ' + formatPeriod(periodOut) + '. '
      + 'The outer orbit is ' + assessed.ratio.toFixed(1) + ' times the inner one, above the Mardling and Aarseth limit of ' + assessed.crit.toFixed(1) + '. '
      + 'The outer period is ' + assessed.periodRatio.toFixed(0) + ' times the inner period. '
      + 'The motion keeps that ratio and runs faster than real time.' + enlarged
  };
}

export function positionsAt(layout, innerTurns) {
  const stars = layout.stars || [];
  if (!stars.length) return [];
  if (stars.length === 1) return [{ x: 0, z: 0, drawAU: stars[0].drawAU }];
  return keplerStars(layout, (innerTurns || 0) * (layout.periodYears || 1));
}

export function pathCenters(layout, innerTurns) {
  if (!layout || layout.count < 2) return [];
  if (layout.count === 2) return layout.paths.map((p) => ({ x: 0, z: 0, radius: p.radius }));
  const m1 = layout.stars[0].mass, m2 = layout.stars[1].mass, m3 = layout.stars[2].mass;
  const M = m1 + m2 + m3;
  const outerAng = innerTurns * Math.PI * 2 / layout.periodRatio;
  const bx = Math.cos(outerAng) * layout.outerAU * m3 / M;
  const bz = Math.sin(outerAng) * layout.outerAU * m3 / M;
  return [
    { x: bx, z: bz, radius: layout.paths[0].radius },
    { x: bx, z: bz, radius: layout.paths[1].radius },
    { x: 0, z: 0, radius: layout.paths[2].radius }
  ];
}

/* World radius of the visible star disk, in the same units as the orbits.
   The square root keeps a giant on the map. The floor is low, so a white
   dwarf or a neutron star stays a speck beside it, and the screen still
   draws that speck at a few pixels. */
export function plateScale(star) {
  const diameter = Math.max(1e-8, star.diameter || (star.radius || 1) * 2);
  const suns = diameter / 2;
  return Math.max(0.07, Math.min(4.2, Math.sqrt(Math.max(suns, 1e-8))));
}

/* One full turn of a binary, or of a triple's inner pair, on the screen. */
export const ORBIT_SECONDS = 75;

/* Disk radius on the overhead map. A lone star is large enough to show its
   surface. A gap keeps companions from meeting: each disk is at most 30% of
   the gap, so the pair always has open sky between them. */
export function plateRadius(star, extent, gap) {
  const rel = plateScale(star);
  if (!(extent > 0)) return rel;
  if (!(gap > 0)) {
    const size = rel * extent * 0.2;
    return Math.max(extent * 0.045, Math.min(extent * 0.28, size));
  }
  const cap = gap * 0.3;
  const size = Math.min(rel, 1) * cap;
  const floor = Math.min(gap * 0.08, cap);
  return Math.max(floor, Math.min(cap, size));
}

/* On-screen positions are the physical Keplerian positions, in AU. */
export function drawnStars(layout, turns) {
  return positionsAt(layout, turns);
}

/* Radius that the default camera must contain: outermost world, stellar orbit, and habitable zone. */
export function systemExtent(layout) {
  if (!layout || !layout.stars || !layout.stars.length) return 2;
  const e = layout.eccentricity || 0;
  const eOut = layout.outerEccentricity || 0;
  let stellar = 0.4;
  if (layout.separation && layout.stars.length >= 2) {
    const m1 = layout.stars[0].mass;
    const m2 = layout.stars[1].mass;
    const far = layout.separation * Math.max(m1, m2) / (m1 + m2) * (1 + e);
    stellar = Math.max(stellar, far);
  }
  if (layout.outerAU && layout.stars.length >= 3) {
    const m1 = layout.stars[0].mass;
    const m2 = layout.stars[1].mass;
    const m3 = layout.stars[2].mass;
    const M12 = m1 + m2;
    const far = layout.outerAU * M12 / (M12 + m3) * (1 + eOut) + (layout.separation || 0) * 0.5;
    stellar = Math.max(stellar, far);
  }
  let maxR = stellar * 1.35;
  (layout.planets || []).forEach((planet) => { if (planet.a) maxR = Math.max(maxR, planet.a * 1.05); });
  const hz = layout.stars[0] && layout.stars[0].hz;
  if (hz && hz.outer > hz.inner && !layout.separation) {
    maxR = Math.max(maxR, Math.min(hz.outer * 1.02, Math.max(stellar, 0.45) * 2.5));
  }
  return Math.max(0.35, maxR);
}

/* Placeholder worlds on the rings. They use the habitable zone and, for more than
   one star, the Holman and Mardling limits already stored on the layout. */
export function placeholderPlanets(layout) {
  if (!layout || !layout.stars || !layout.stars.length) return [];
  const star = layout.stars[0];
  const hz = star.hz || { inner: 1, outer: 1.7 };
  const mass = Math.max(0.2, layout.stars.reduce((s, item) => s + (item.mass || 1), 0));
  const world = (a, parent, color, radius) => ({
    a,
    parent,
    color,
    radius,
    period: Math.sqrt(Math.pow(Math.max(0.05, a), 3) / mass)
  });
  if (layout.count === 1) {
    const inner = Math.max(0.35, hz.inner * 0.72);
    const mid = Math.max(inner + 0.4, (hz.inner + hz.outer) / 2);
    const outer = Math.max(mid + 0.6, hz.outer * 1.7);
    return [
      world(inner, 'star0', '#d7c4a8', 0.45),
      world(mid, 'star0', '#7eb6d6', 0.55),
      world(outer, 'star0', '#e2c27a', 0.85)
    ];
  }
  if (layout.count === 2 && layout.holman) {
    const around = Math.max(0.08, layout.holman.sType * 0.62);
    const both = layout.holman.pType * 1.2;
    return [
      world(around, 'star0', '#d7c4a8', 0.4),
      world(both, 'bary', '#e2c27a', 0.7)
    ];
  }
  const a = Math.max(layout.separation * 2.4, Math.min(layout.outerAU * 0.42, layout.separation * (layout.crit || 3) * 1.15));
  return [world(a, 'inner-bary', '#7eb6d6', 0.5)];
}

export function planetParent(layout, placed, parent, innerTurns) {
  if (!placed.length) return { x: 0, z: 0 };
  if (parent === 'star0') return placed[0];
  if (parent === 'bary' || !layout || layout.count < 2) {
    let x = 0;
    let z = 0;
    let m = 0;
    placed.forEach((p, i) => {
      const mass = layout.stars[i].mass || 1;
      x += p.x * mass;
      z += p.z * mass;
      m += mass;
    });
    return { x: x / m, z: z / m };
  }
  const m1 = layout.stars[0].mass || 1;
  const m2 = layout.stars[1].mass || 1;
  return {
    x: (placed[0].x * m1 + placed[1].x * m2) / (m1 + m2),
    z: (placed[0].z * m1 + placed[1].z * m2) / (m1 + m2)
  };
}
