import type { StampConfig } from './types.ts';

/** The defaults from the brief's domain model table. */
export const DEFAULT_CONFIG: StampConfig = {
  seed: 7,
  size: { width: 26, height: 26 },
  perforation: {
    gauge: 14,
    holeSize: 0.55,
    corners: 'offset',
  },
  wear: 0.38,
  misregistration: 0,
  print: { area: 'bleed' },
  tears: {
    profiles: { clean: 1, step: 1, nibble: 1, spur: 1, lean: 1, frayed: 1 },
    fibres: 0.5,
    roughness: 0.5,
  },
  paper: '#F3EEE2',
};

/** Shape presets, in mm. */
export const SHAPES = {
  square: { width: 26, height: 26 },
  portrait: { width: 24, height: 30 },
  landscape: { width: 30, height: 24 },
} as const;

export type ShapeName = keyof typeof SHAPES;

/** Default paper border width in mm, bordered print only. */
export const DEFAULT_MARGIN_MM = 1.8;
