export type {
  CornerArc,
  CornerMode,
  EdgeLayout,
  EdgeSide,
  FibreStroke,
  Hole,
  Point,
  PrintArea,
  ProfilePoint,
  RenderOptions,
  StampConfig,
  StampImage,
  StampLayout,
  StampPath,
  StampPreset,
  TearLibrary,
  TearProfile,
  Tooth,
} from './types.js';

export { DEFAULT_CONFIG, DEFAULT_MARGIN_MM, SHAPES, type ShapeName } from './defaults.js';
export { PRESETS } from './presets.js';

export {
  COORD_PRECISION,
  GAUGE_REFERENCE_MM,
  UNITS_PER_MM,
  mmToUnits,
  pitchMm,
  pitchUnits,
  roundCoord,
} from './units.js';

export { hash2, hashRange, mulberry32, type Prng } from './prng.js';
export { valueNoise1d } from './noise.js';

export { createLayout, normaliseConfig } from './layout.js';
export { TOOTH_SAMPLE_STEP, stampPath, toothOffset } from './path.js';
export { BLEED_OVERSHOOT, renderSvg } from './render-svg.js';

export {
  CLEAN,
  FRAYED,
  LEAN,
  NIBBLE,
  SPUR,
  STARTER_PROFILES,
  STEP,
  createTearLibrary,
  defineProfile,
  pickProfile,
  sampleProfile,
} from './tears/index.js';
