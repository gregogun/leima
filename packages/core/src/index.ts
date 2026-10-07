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
} from './types.ts';

export { DEFAULT_CONFIG, DEFAULT_MARGIN_MM, SHAPES, type ShapeName } from './defaults.ts';
export { PRESETS } from './presets.ts';

export {
  COORD_PRECISION,
  GAUGE_REFERENCE_MM,
  UNITS_PER_MM,
  mmToUnits,
  pitchMm,
  pitchUnits,
  roundCoord,
} from './units.ts';

export { hash2, hashRange, hashString, mulberry32, type Prng } from './prng.ts';
export { valueNoise1d } from './noise.ts';

export { BLEED_OVERSHOOT, createLayout, edgePoint, normaliseConfig } from './layout.ts';
export { TOOTH_SAMPLE_STEP, stampPath, toothOffset } from './path.ts';
export { renderSvg, serializeSvg, stampSvgTree } from './render-svg.ts';

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
} from './tears/index.ts';
