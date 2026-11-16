/* Uncompressed astronomy for the system builder. Distances in AU, masses in
   Earth masses unless noted, temperatures in kelvin. */
import { equilibriumTemperature, habitableZone, SOLAR_CONSTANT, SIGMA } from '../science.js';

export const G_EARTH = 9.80665;
export const VESC_EARTH = 11.186;
export const RHO_EARTH = 5.514;
export const AU_PER_YEAR_AT_C = 63241.077; /* light crosses 1 ly in a year; 1 AU is 499 seconds */
export const LIGHT_MINUTES_PER_AU = 8.317;

export function massEarth(radiusEarth, density) {
  return Math.pow(Math.max(0.01, radiusEarth), 3) * (Math.max(0.05, density) / RHO_EARTH);
}

export function surfaceGravity(massE, radiusE) {
  return G_EARTH * massE / Math.max(0.01, radiusE * radiusE);
}

export function escapeVelocity(massE, radiusE) {
  return VESC_EARTH * Math.sqrt(massE / Math.max(0.01, radiusE));
}

/* Kepler's third law. Period in years when a is AU and mass is solar masses. */
export function orbitalPeriodYears(aAU, solarMasses) {
  const m = Math.max(1e-6, solarMasses);
  return Math.sqrt(Math.pow(Math.max(0.001, aAU), 3) / m);
}

export function stellarFlux(luminosity, aAU) {
  return SOLAR_CONSTANT * Math.max(0, luminosity) / Math.max(1e-6, aAU * aAU);
}

export function equilibrium(luminosity, aAU, albedo) {
  return equilibriumTemperature(stellarFlux(luminosity, aAU), albedo);
}

export function zone(luminosity) {
  return habitableZone(Math.max(0, luminosity));
}

/* Hill sphere, AU. m and M are in the same units. */
export function hillSphereAU(aAU, massPlanet, massStarSolar) {
  const mStarEarth = Math.max(1e-8, massStarSolar) * 332946;
  return aAU * Math.cbrt(massPlanet / (3 * mStarEarth));
}

/* Fluid Roche limit, in Earth radii of the primary. */
export function rocheRadii(radiusPrimary, densityPrimary, densitySecondary) {
  return 2.44 * radiusPrimary * Math.cbrt(densityPrimary / Math.max(0.05, densitySecondary));
}

export function greenhouseKelvin(teq, pressureBar, greenhouse) {
  if (!(pressureBar > 0)) return teq;
  return teq + 33 * Math.sqrt(pressureBar) * Math.max(0, greenhouse);
}

/* Holman & Wiegert 1999, circular binaries, equal-mass limit used as the warning line. */
export function sTypeLimitAU(separationAU) {
  return 0.27 * separationAU;
}

export function pTypeLimitAU(separationAU) {
  return 2.4 * separationAU;
}

export { SIGMA, SOLAR_CONSTANT };
