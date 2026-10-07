import type { StampPreset } from './types.ts';

/** Presets are just partial configs. */
export const PRESETS: Record<string, StampPreset> = {
  mint: { wear: 0.05 },
  'lightly worn': { wear: 0.38 },
  'well travelled': { wear: 0.85 },
};
