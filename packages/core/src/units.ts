/**
 * Everything in the domain model is in real units. The stamp is sized in
 * millimetres; geometry is computed in *stamp units* at this scale, so output
 * resolution stays a render-time choice.
 */
export const UNITS_PER_MM = 10;

/** Gauge is holes per 2 cm, the philatelic "perf" number. */
export const GAUGE_REFERENCE_MM = 20;

/** Pitch in mm = 20 / gauge. Gauge 14 gives a 1.43 mm pitch. */
export function pitchMm(gauge: number): number {
  return GAUGE_REFERENCE_MM / gauge;
}

/** Pitch in stamp units. */
export function pitchUnits(gauge: number): number {
  return pitchMm(gauge) * UNITS_PER_MM;
}

export function mmToUnits(mm: number): number {
  return mm * UNITS_PER_MM;
}

/** Path coordinates round to 2 decimals so the path string is snapshot-stable. */
export const COORD_PRECISION = 2;

export function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}
