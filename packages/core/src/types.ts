/**
 * The config is plain JSON-serialisable data: it round-trips through a URL and
 * renders identically on client and server. Nothing here may hold a function,
 * a class instance or a DOM reference.
 */

export type CornerMode =
  /** Holes at (i + 0.5) x step, so each corner is a tooth with a half-step either side. */
  | 'offset'
  /** Holes at whole steps, one hole centred on the corner and shared by both edges. */
  | 'hole'
  /** Whole-step spacing with the corner hole left out, giving a wide square corner block. */
  | 'solid';

export type PrintArea = { area: 'bleed' } | { area: 'bordered'; margin: number };

export type StampConfig = {
  /** The same seed and config always give the same stamp. */
  seed: number;
  /** Stamp size in mm. */
  size: { width: number; height: number };
  perforation: {
    /** Holes per 2 cm. */
    gauge: number;
    /** Hole diameter as a share of the pitch, 0..1. */
    holeSize: number;
    corners: CornerMode;
  };
  /**
   * One 0..1 control for tear depth, hole jitter, pulled-perf chance and print
   * misregistration.
   */
  wear: number;
  /** `bordered` carries a paper margin in mm; `bleed` runs the print into the perforations. */
  print: PrintArea;
  tears: {
    /** Weight per profile key. 0 turns a profile off. */
    profiles: Record<string, number>;
    /** Fibre strand density, 0..1. */
    fibres: number;
    /** Fine roughness on torn edges, 0..1. */
    roughness: number;
  };
  /** Paper colour. Only visible in bordered print. */
  paper?: string;
};

/** A partial config. Presets ("mint", "lightly worn", "well travelled") are just these. */
export type StampPreset = Partial<StampConfig>;

// --- Tear library -----------------------------------------------------------

/** A point on a tear profile: `[u, offset]` with u in 0..1. */
export type ProfilePoint = readonly [u: number, offset: number];

/**
 * Tear profiles are data, not code. Offset must be 0 at u = 0 and u = 1 so every
 * tooth meets its neighbouring hole arcs exactly.
 */
export type TearProfile = {
  readonly name: string;
  readonly points: readonly ProfilePoint[];
};

export type TearLibrary = ReadonlyMap<string, TearProfile>;

// --- Layout -----------------------------------------------------------------

export type Point = { x: number; y: number };

/** Edges are walked clockwise from the top-left corner. */
export type EdgeSide = 'top' | 'right' | 'bottom' | 'left';

export type Hole = {
  side: EdgeSide;
  /** Jittered centre, in stamp units. */
  center: Point;
  /** Jittered radius, in stamp units. */
  radius: number;
  /** True for the single hole shared by two edges in `hole` corner mode. */
  shared: boolean;
};

export type Tooth = {
  side: EdgeSide;
  /** Where the tooth leaves the previous hole arc. */
  start: Point;
  /** Where the tooth meets the next hole arc. */
  end: Point;
  /** Outward normal for this edge, `(-dy, dx)`. */
  normal: Point;
  /** Key into the tear library. */
  profile: string;
  flip: boolean;
  invert: boolean;
  /** Pulled-perf depth in stamp units. 0 for most teeth; interior teeth only. */
  pull: number;
  /** Decides whether this tooth grows fibres, and how many. */
  fibreRoll: number;
  /**
   * Seed for stateless per-tooth detail. Hashed with an index rather than drawn
   * from the layout PRNG, so toggling a profile does not reshuffle other teeth.
   */
  hash: number;
};

/** The quarter-circle notch cut at a corner in `hole` mode. */
export type CornerArc = {
  center: Point;
  radius: number;
};

export type EdgeLayout = {
  side: EdgeSide;
  from: Point;
  to: Point;
  /** Length in stamp units. */
  length: number;
  /** Whole number of holes on this edge. */
  holeCount: number;
  /** `length / holeCount`; pitch snaps per edge so corners line up. */
  step: number;
};

export type StampLayout = {
  /** The config this layout came from, normalised and defaulted. */
  config: StampConfig;
  /** Stamp size in stamp units. */
  size: { width: number; height: number };
  /** Nominal pitch in stamp units, before the per-edge snap. */
  pitch: number;
  edges: readonly EdgeLayout[];
  holes: readonly Hole[];
  teeth: readonly Tooth[];
  /** `hole` corner mode only; empty otherwise. */
  corners: readonly CornerArc[];
  /**
   * Print offset within the stamp, scaled by wear. In bleed mode the print
   * extends past the trim so the offset never shows a gap.
   */
  misregistration: Point;
  /** The rect the image fills, in stamp units, offset included. */
  printRect: { x: number; y: number; width: number; height: number };
};

// --- Path -------------------------------------------------------------------

/** A short quadratic stroke leaving a torn edge outward. */
export type FibreStroke = {
  from: Point;
  control: Point;
  to: Point;
  width: number;
};

export type StampPath = {
  /** The closed outline: teeth and hole arcs as one path. */
  outline: string;
  /** Tooth segments alone, for debug overlays and profile authoring. */
  teeth: string;
  fibres: readonly FibreStroke[];
};

// --- Render -----------------------------------------------------------------

/**
 * An image passed into the renderer. The core never fetches: images and fonts
 * arrive as data.
 */
export type StampImage = {
  /** A data URI or an absolute URL the *consumer* is responsible for resolving. */
  href: string;
  /** Intrinsic size, needed for cover fit. */
  width: number;
  height: number;
};

export type RenderOptions = {
  /** Output pixels per mm. Defaults to `UNITS_PER_MM`. */
  scale?: number;
  /**
   * Off by default: the drop shadow is a filter, and Satori and some consumers
   * will not want it.
   */
  shadow?: boolean;
};
