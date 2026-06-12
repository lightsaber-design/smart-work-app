/**
 * Compute local sunrise/sunset hours from latitude, longitude and date.
 * Returns fractional hours in local clock time (e.g. 6.75 = 6:45).
 * Uses the standard solar position approximation (±10 min accuracy).
 */
export function getSunHours(
  lat: number,
  lng: number,
  date: Date = new Date(),
): { sunriseH: number; sunsetH: number } {
  // Day of year (1-based)
  const janFirst = new Date(date.getFullYear(), 0, 0);
  const doy = Math.round((date.getTime() - janFirst.getTime()) / 86_400_000);

  // Solar declination (degrees)
  const decl = -23.45 * Math.cos((2 * Math.PI / 365) * (doy + 10));

  // Hour angle at sunrise/sunset (includes atmospheric refraction -0.833°)
  const latR = lat * (Math.PI / 180);
  const declR = decl * (Math.PI / 180);
  const cosH0 =
    (Math.sin(-0.833 * (Math.PI / 180)) - Math.sin(latR) * Math.sin(declR)) /
    (Math.cos(latR) * Math.cos(declR));

  if (cosH0 >= 1) return { sunriseH: 13, sunsetH: 13 }; // polar night
  if (cosH0 <= -1) return { sunriseH: 0, sunsetH: 24 }; // midnight sun

  const H0degrees = Math.acos(cosH0) * (180 / Math.PI);

  // Equation of time (minutes)
  const B = (2 * Math.PI / 365) * (doy - 81);
  const eqT = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);

  // Solar noon in local clock time (hours)
  const tzOffsetH = -date.getTimezoneOffset() / 60; // e.g. UTC+1 → +1
  const solarNoonLocal = 12 - lng / 15 + tzOffsetH - eqT / 60;

  const halfDay = H0degrees / 15;

  return {
    sunriseH: solarNoonLocal - halfDay,
    sunsetH: solarNoonLocal + halfDay,
  };
}

/** Returns true if the current local time is between sunset and sunrise. */
export function isNightTime(lat: number, lng: number, date: Date = new Date()): boolean {
  const { sunriseH, sunsetH } = getSunHours(lat, lng, date);
  const h = date.getHours() + date.getMinutes() / 60;
  return h < sunriseH || h > sunsetH;
}
