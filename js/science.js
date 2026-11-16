/* Real formulas, in SI unless noted. The flight model compresses distances so a
   landing fits on screen. These functions are the uncompressed science. */
export const G0 = 9.80665;
export const AU_M = 1.495978707e11;
export const GM_SUN_SI = 1.3271244e20;
export const SIGMA = 5.670374419e-8;
export const SOLAR_CONSTANT = 1361;

export function rocketDeltaV(isp, m0, mf, g0 = G0) {
  if (!(isp > 0) || !(m0 > mf) || !(mf > 0)) return 0;
  return isp * g0 * Math.log(m0 / mf);
}

export function hohmann(mu, r1, r2) {
  const ra = Math.max(r1, r2);
  const rp = Math.min(r1, r2);
  const a = 0.5 * (ra + rp);
  const dv1 = Math.sqrt(mu / rp) * (Math.sqrt(2 * ra / (ra + rp)) - 1) * (r1 <= r2 ? 1 : -1);
  const dv2 = Math.sqrt(mu / ra) * (1 - Math.sqrt(2 * rp / (ra + rp))) * (r1 <= r2 ? 1 : -1);
  const time = Math.PI * Math.sqrt((a * a * a) / mu);
  return { dv1, dv2, dv: Math.abs(dv1) + Math.abs(dv2), time, aTransfer: a };
}

export function bielliptic(mu, r1, r2, rb) {
  const h1 = hohmann(mu, r1, rb);
  const h2 = hohmann(mu, rb, r2);
  return { dv: h1.dv + h2.dv, time: h1.time + h2.time };
}

/* Burns deep in a gravity well buy more energy for the same delta-v. */
export function oberthGain(vEscape, deltaV) {
  const v = Math.abs(vEscape);
  const dv = Math.abs(deltaV);
  return 0.5 * ((v + dv) * (v + dv) - v * v) - 0.5 * dv * dv;
}

export function equilibriumTemperature(flux, albedo) {
  const absorbed = Math.max(0, flux) * (1 - albedo) / 4;
  return Math.pow(Math.max(1e-6, absorbed) / SIGMA, 0.25);
}

export function greenhouseSurface(teq, pressureBar, greenhouse) {
  const bare = !(pressureBar > 0);
  if (bare) return teq;
  return teq + 33 * Math.sqrt(pressureBar) * Math.max(0, greenhouse);
}

export function habitableZone(luminositySolar) {
  return { inner: Math.sqrt(luminositySolar / 1.1), outer: Math.sqrt(luminositySolar / 0.36) };
}

/* Fluid-body Roche limit, radii of the primary. */
export function rocheLimit(radiusPrimary, densityPrimary, densitySecondary) {
  return 2.44 * radiusPrimary * Math.cbrt(densityPrimary / Math.max(1e-6, densitySecondary));
}

export function sailAccel(flux, area, mass, reflectivity = 0.9) {
  if (!(mass > 0)) return 0;
  return (flux * area * (1 + reflectivity)) / (mass * 2.99792458e8);
}

export function hubbleVelocity(distanceMpc, h0 = 70) {
  return h0 * distanceMpc;
}

export function redshift(v, c = 299792.458) {
  return v / c;
}

export function blackbodyRGB(teff) {
  const t = Math.max(1000, teff);
  if (t < 3500) return [1, 0.32 + (t - 2500) / 8000, 0.06];
  if (t < 5000) return [1, 0.55 + (t - 3500) / 10000, 0.25];
  if (t < 6500) return [1, 0.9, 0.75];
  return [0.75, 0.85, 1];
}

/* Main-sequence lifetime, years, a rough mass-luminosity scaling. */
export function mainSequenceYears(solarMasses) {
  const m = Math.max(0.08, solarMasses);
  return 1.0e10 * Math.pow(m, -2.5);
}

export const ISP = { chem: 450, ion: 3100, sail: 0, ramjet: 20000 };

export function driveDeltaV(id, massRatio) {
  const isp = ISP[id] || ISP.chem;
  if (id === 'sail') return Infinity;
  return rocketDeltaV(isp, massRatio, 1);
}
