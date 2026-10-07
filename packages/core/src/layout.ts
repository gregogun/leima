import { DEFAULT_CONFIG, DEFAULT_MARGIN_MM } from './defaults.js';
import { hash2, mulberry32 } from './prng.js';
import { DEFAULT_TEAR_LIBRARY, HASH_PULL_DEPTH, pickProfile } from './tears/index.js';
import type {
  CornerMode,
  EdgeLayout,
  EdgeSide,
  Hole,
  Point,
  StampConfig,
  StampConfigInput,
  StampLayout,
  TearLibrary,
  Tooth,
} from './types.js';
import { UNITS_PER_MM, mmToUnits, pitchUnits } from './units.js';

/** Bleed overshoot as a share of the pitch, before misregistration is added. */
export const BLEED_OVERSHOOT = 0.45;

const CORNER_MODES: readonly CornerMode[] = ['offset', 'hole', 'solid'];

/**
 * Pure function from config to layout. No DOM, no randomness outside the seeded
 * PRNG.
 *
 * For each edge, walked clockwise from the top-left corner:
 *
 * 1. `n = max(2, round(edgeLength / pitch))`; `step = edgeLength / n`;
 *    `r = holeSize * step / 2`. Pitch snaps per edge to a whole number of holes,
 *    so corners line up.
 * 2. Place holes per corner mode, each with seeded jitter:
 *    - along-edge offset  +/- (0.01 + 0.045w) * step
 *    - perpendicular      +/- (0.02 + 0.1w) * r
 *    - radius             +/- (0.015 + 0.05w) * r
 * 3. One tooth per gap (holes + 1). Each tooth gets a pulled-perf depth
 *    (chance 0.06w, interior teeth only, depth 0.12-0.34 * step), a profile pick,
 *    flip, invert, fibre roll and a hash seed.
 * 4. In `hole` corner mode, a shared corner radius per corner.
 *
 * The PRNG draw order follows the prototype with one change: the prototype drew
 * a pulled tooth's depth from the PRNG only when the tooth was pulled, so moving
 * the wear slider shifted every later draw and reshuffled the rest of the stamp.
 * The depth now comes from the tooth's stateless hash instead.
 *
 * Misregistration: the print is offset slightly within the stamp, scaled by wear.
 * In bleed mode the print extends past the trim so the offset never shows a gap.
 */
export function createLayout(
  input: StampConfigInput,
  library: TearLibrary = DEFAULT_TEAR_LIBRARY,
): StampLayout {
  const config = normaliseConfig(input);
  const { gauge, holeSize, corners } = config.perforation;
  const w = config.wear;
  const W = mmToUnits(config.size.width);
  const H = mmToUnits(config.size.height);
  const pitch = pitchUnits(gauge);
  const rng = mulberry32(config.seed * 9973 + 17);

  // Each side from its start corner to its end corner, clockwise.
  const topLeft = { x: 0, y: 0 };
  const topRight = { x: W, y: 0 };
  const bottomRight = { x: W, y: H };
  const bottomLeft = { x: 0, y: H };
  const sides: readonly (readonly [EdgeSide, Point, Point])[] = [
    ['top', topLeft, topRight],
    ['right', topRight, bottomRight],
    ['bottom', bottomRight, bottomLeft],
    ['left', bottomLeft, topLeft],
  ];

  type RawTooth = Omit<Tooth, 'from' | 'to'>;
  const raw = sides.map(([side, origin, end]) => {
    const length = Math.hypot(end.x - origin.x, end.y - origin.y);
    const direction = { x: (end.x - origin.x) / length, y: (end.y - origin.y) / length };
    const inward = { x: -direction.y, y: direction.x };
    const n = Math.max(2, Math.round(length / pitch));
    const step = length / n;
    const r0 = (holeSize * step) / 2;

    // offset: holes at (i + 0.5) * step, so corners are teeth. hole / solid:
    // holes at whole steps, with the corner either cut by one shared hole or
    // left as a solid block.
    const count = corners === 'offset' ? n : n - 1;
    const base = corners === 'offset' ? 0.5 : 1;
    const cornerStart = corners === 'hole' ? r0 * (1 + (rng() - 0.5) * 0.06) : 0;

    const holes: Hole[] = [];
    for (let i = 0; i < count; i++) {
      const along = (i + base) * step + (rng() - 0.5) * 2 * (0.01 + 0.045 * w) * step;
      const perp = (rng() - 0.5) * 2 * (0.02 + 0.1 * w) * r0;
      const radius = r0 * (1 + (rng() - 0.5) * 2 * (0.015 + 0.05 * w));
      holes.push({
        along,
        perp,
        radius,
        center: {
          x: origin.x + direction.x * along + inward.x * perp,
          y: origin.y + direction.y * along + inward.y * perp,
        },
      });
    }

    const teeth: RawTooth[] = [];
    for (let j = 0; j <= count; j++) {
      // The interior check is structural (it depends on the hole count, not
      // wear), so it may decide whether a draw happens.
      const pulled = j > 0 && j < count && rng() < 0.06 * w;
      const roll = rng();
      const flip = rng() < 0.5;
      const invert = rng() < 0.3;
      const fibreRoll = rng();
      const hash = Math.floor(rng() * 1e9);
      teeth.push({
        profile: pickProfile(library, config.tears.profiles, roll, hash),
        flip,
        invert,
        pull: pulled ? step * (0.12 + 0.22 * hash2(hash, HASH_PULL_DEPTH)) : 0,
        fibreRoll,
        hash,
      });
    }

    const noiseSeed = Math.floor(rng() * 1e6);
    return { side, origin, direction, inward, length, step, holes, teeth, cornerStart, noiseSeed };
  });

  const edges: EdgeLayout[] = raw.map((edge, e) => {
    const cornerEnd = raw[(e + 1) % raw.length]?.cornerStart ?? 0;
    const { holes } = edge;
    const teeth = edge.teeth.map((tooth, j): Tooth => {
      const before = holes[j - 1];
      const after = holes[j];
      return {
        ...tooth,
        from: before ? before.along + holeHalfChord(before) : edge.cornerStart,
        to: after ? after.along - holeHalfChord(after) : edge.length - cornerEnd,
      };
    });
    return { ...edge, teeth, cornerEnd };
  });

  const bleed = config.print.area === 'bleed';
  const margin = config.print.area === 'bordered' ? mmToUnits(config.print.margin) : 0;
  const reference = bleed ? UNITS_PER_MM : margin;
  const misregistration = {
    x: (rng() - 0.5) * 2 * (0.12 + 0.45 * w) * reference,
    y: (rng() - 0.5) * 2 * (0.12 + 0.45 * w) * reference,
  };

  let printRect: StampLayout['printRect'];
  if (bleed) {
    // Ink runs past the trim so protruding tears and pulled teeth still carry print.
    const b =
      BLEED_OVERSHOOT * pitch + Math.max(Math.abs(misregistration.x), Math.abs(misregistration.y));
    printRect = {
      x: -b + misregistration.x,
      y: -b + misregistration.y,
      width: W + 2 * b,
      height: H + 2 * b,
    };
  } else {
    printRect = {
      x: margin + misregistration.x,
      y: margin + misregistration.y,
      width: W - 2 * margin,
      height: H - 2 * margin,
    };
  }

  return {
    config,
    library,
    size: { width: W, height: H },
    pitch,
    edges,
    misregistration,
    printRect,
  };
}

/**
 * Half the chord where a hole crosses its edge line. A tooth stops here and the
 * hole arc takes over.
 */
function holeHalfChord(hole: Hole): number {
  return Math.sqrt(Math.max(hole.radius * hole.radius - hole.perp * hole.perp, 1e-4));
}

/** A point at `along` the edge, offset `outward` from the edge line. */
export function edgePoint(edge: EdgeLayout, along: number, outward: number): Point {
  return {
    x: edge.origin.x + edge.direction.x * along - edge.inward.x * outward,
    y: edge.origin.y + edge.direction.y * along - edge.inward.y * outward,
  };
}

/**
 * Fills in defaults and clamps ranges, field by field, so a config read back from
 * a URL or a preset always renders. Exported so the editor can round-trip a URL.
 */
export function normaliseConfig(input: StampConfigInput): StampConfig {
  const d = DEFAULT_CONFIG;
  const width = positive(input.size?.width, d.size.width);
  const height = positive(input.size?.height, d.size.height);

  let print: StampConfig['print'] = d.print;
  if (input.print?.area === 'bleed') print = { area: 'bleed' };
  if (input.print?.area === 'bordered') {
    // Leave at least a millimetre of print in the middle.
    const maxMargin = Math.max(0, Math.min(width, height) / 2 - 1);
    print = {
      area: 'bordered',
      margin: clamp(input.print.margin, 0, maxMargin, DEFAULT_MARGIN_MM),
    };
  }

  const profiles: Record<string, number> = {};
  for (const [name, weight] of Object.entries({ ...d.tears.profiles, ...input.tears?.profiles })) {
    profiles[name] = clamp(weight, 0, 1, 0);
  }

  const corners = input.perforation?.corners;
  const seed = input.seed;

  return {
    seed: typeof seed === 'number' && Number.isFinite(seed) ? Math.floor(seed) : d.seed,
    size: { width, height },
    perforation: {
      gauge: clamp(input.perforation?.gauge, 4, 30, d.perforation.gauge),
      holeSize: clamp(input.perforation?.holeSize, 0.1, 0.9, d.perforation.holeSize),
      corners: corners && CORNER_MODES.includes(corners) ? corners : d.perforation.corners,
    },
    wear: clamp(input.wear, 0, 1, d.wear),
    print,
    tears: {
      profiles,
      fibres: clamp(input.tears?.fibres, 0, 1, d.tears.fibres),
      roughness: clamp(input.tears?.roughness, 0, 1, d.tears.roughness),
    },
    paper: typeof input.paper === 'string' && input.paper ? input.paper : (d.paper ?? '#F3EEE2'),
  };
}

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function positive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}
