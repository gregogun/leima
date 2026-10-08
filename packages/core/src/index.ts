export type {
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
  StampConfigInput,
  StampImage,
  StampLayout,
  StampPath,
  StampPreset,
  SvgNode,
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

export { hash2, hashRange, hashString, mulberry32, type Prng } from './prng.js';
export { valueNoise1d } from './noise.js';

export { BLEED_OVERSHOOT, createLayout, edgePoint, normaliseConfig } from './layout.js';
export { TOOTH_SAMPLE_STEP, stampPath, toothOffset } from './path.js';
export { renderSvg, serializeSvg, stampSvgTree } from './render-svg.js';

export {
  CLEAN,
  DEFAULT_TEAR_LIBRARY,
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
