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
  /** One 0..1 control for tear depth, hole jitter and pulled-perf chance. */
  wear: number;
  /** `bordered` carries a paper margin in mm; `bleed` runs the print into the perforations. */
  print: PrintArea;
  tears: {
    /**
     * Weight per profile name, 0..1. 0 turns a profile off and 1 is full; a
     * name left out is off. See `pickProfile` for why weights stop at 1.
     */
    profiles: Record<string, number>;
    /** Fibre strand density, 0..1. */
    fibres: number;
    /** Fine roughness on torn edges, 0..1. */
    roughness: number;
  };
  /** Paper colour. Only visible in bordered print. */
  paper?: string;
};

/**
 * A config with any field left out, at any depth. `normaliseConfig` fills the
 * gaps from the defaults. Presets ("mint", "lightly worn", "well travelled") are
 * just these.
 */
export type StampConfigInput = {
  seed?: number;
  size?: Partial<StampConfig['size']>;
  perforation?: Partial<StampConfig['perforation']>;
  wear?: number;
  print?: PrintArea | { area: 'bordered'; margin?: number };
  tears?: Partial<StampConfig['tears']>;
  paper?: string;
};

export type StampPreset = StampConfigInput;

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

/** Profiles by name, in registration order. */
export type TearLibrary = ReadonlyMap<string, TearProfile>;

// --- Layout -----------------------------------------------------------------

export type Point = { x: number; y: number };

/** Edges are walked clockwise from the top-left corner. */
export type EdgeSide = 'top' | 'right' | 'bottom' | 'left';

/**
 * A punched hole. Positions are edge-local: `along` the edge from its start
 * corner, and `perp` towards the inside of the stamp.
 */
export type Hole = {
  /** Jittered position along the edge, in stamp units. */
  along: number;
  /** Jittered offset of the centre from the edge line, inward positive. */
  perp: number;
  /** Jittered radius, in stamp units. */
  radius: number;
  /** The same centre in stamp coordinates, for overlays. */
  center: Point;
};

/** The torn paper between two holes (or a hole and a corner). */
export type Tooth = {
  /** Where the tooth leaves the previous hole arc, along the edge. */
  from: number;
  /** Where the tooth meets the next hole arc, along the edge. */
  to: number;
  /** Name in the tear library, or `null` when every profile is off. */
  profile: string | null;
  /** Read the profile from u = 1 back to u = 0. */
  flip: boolean;
  /** Negate the profile's offset. */
  invert: boolean;
  /** Pulled-perf depth in stamp units. 0 for most teeth; interior teeth only. */
  pull: number;
  /** Decides whether this tooth grows fibres. */
  fibreRoll: number;
  /**
   * Seed for stateless per-tooth detail. Hashed with an index rather than drawn
   * from the layout PRNG, so toggling a profile does not reshuffle other teeth.
   */
  hash: number;
};

export type EdgeLayout = {
  side: EdgeSide;
  /** The corner this edge starts at. */
  origin: Point;
  /** Unit vector along the edge. */
  direction: Point;
  /** Unit inward normal, `(-dy, dx)`. */
  inward: Point;
  /** Length in stamp units. */
  length: number;
  /** `length / round(length / pitch)`; pitch snaps per edge so corners line up. */
  step: number;
  holes: readonly Hole[];
  /** One more than `holes`: a tooth on each side of every hole. */
  teeth: readonly Tooth[];
  /**
   * Radius of the shared corner hole at the start and end of this edge, in
   * `hole` corner mode. 0 otherwise.
   */
  cornerStart: number;
  cornerEnd: number;
  /** Seed for the fine roughness noise along this edge. */
  noiseSeed: number;
};

export type StampLayout = {
  /** The config this layout came from, normalised and defaulted. */
  config: StampConfig;
  /** The tear library the teeth were picked from. */
  library: TearLibrary;
  /** Stamp size in stamp units. */
  size: { width: number; height: number };
  /** Nominal pitch in stamp units, before the per-edge snap. */
  pitch: number;
  /** Clockwise from the top-left corner: top, right, bottom, left. */
  edges: readonly EdgeLayout[];
  /**
   * The rect the image fills, in stamp units, centred on the stamp. In bleed mode it
   * extends past the trim by `0.45 * pitch`.
   */
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
  /** Tooth segments alone, one subpath each, for debug overlays and profile authoring. */
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
  /**
   * Intrinsic size. With it, the cover fit is computed exactly, so every renderer
   * agrees. Without it, the image falls back to the renderer's own
   * `preserveAspectRatio="xMidYMid slice"`, which Satori may not honour.
   */
  width?: number;
  height?: number;
};

/**
 * An SVG element as plain data: the stamp's markup before it becomes a string or
 * a framework's elements. Attribute names are SVG's own (`stroke-width`, not
 * `strokeWidth`) and values are unescaped.
 */
export type SvgNode = {
  tag: string;
  attrs: Readonly<Record<string, string>>;
  children: readonly (SvgNode | string)[];
};

export type RenderOptions = {
  /** Output pixels per mm. Defaults to `UNITS_PER_MM`. */
  scale?: number;
  /**
   * Off by default: the drop shadow is a filter, and Satori and some consumers
   * will not want it.
   */
  shadow?: boolean;
  /** Profiles to pick teeth from. Defaults to the six starters. */
  library?: TearLibrary;
  /**
   * Prefix for the SVG's internal ids, which must be unique per document.
   * Defaults to a hash of the stamp, so two different stamps never collide.
   */
  idPrefix?: string;
  /** Accessible name. Defaults to "Postage stamp". */
  title?: string;
};
