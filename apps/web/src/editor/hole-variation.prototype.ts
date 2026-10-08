/**
 * PROTOTYPE — throwaway, lives on the `prototype/hole-variation` branch only.
 *
 * Question: what should perforation holes look like? Four variants of the hole
 * shape on the existing editor route, switched by `?variant=`:
 *
 *   A  circles, as the core draws them today (control)
 *   B  rotated ellipses, as docs/design/perforation-variation.md proposes
 *   C  noisy circles: low-frequency harmonics dent the radius
 *   D  noisy ellipses: B and C together
 *
 * Rather than change the core, this takes the core's layout, reshapes the holes,
 * moves the tooth endpoints to where each new hole crosses the edge line, and
 * re-draws the outline. Every hole only ever shrinks inside today's circle.
 */
import {
  TOOTH_SAMPLE_STEP,
  createLayout,
  edgePoint,
  hash2,
  roundCoord,
  serializeSvg,
  stampPath,
  stampSvgTree,
  toothOffset,
  valueNoise1d,
  type EdgeLayout,
  type Hole,
  type RenderOptions,
  type StampConfigInput,
  type StampImage,
  type StampLayout,
  type SvgNode,
  type Tooth,
} from '@leima/core';

export const VARIANTS = {
  A: 'Circles (today)',
  B: 'Rotated ellipses',
  C: 'Noisy circles',
  D: 'Noisy ellipses',
} as const;
export type Variant = keyof typeof VARIANTS;
export const isVariant = (value: string | null): value is Variant =>
  value !== null && value in VARIANTS;

export type Tuning = {
  /** The one control the design doc proposes, 0..1. */
  variation: number;
  /** Noise wavelength along the perimeter, in holes. */
  wavelength: number;
  /** How much of each hole's look is its own rather than its neighbours', 0..1. */
  independence: number;
  /** Ellipse: largest `1 - aspect`. */
  squash: number;
  /** Ellipse: tilt magnitude range in degrees at full variation. */
  minTilt: number;
  maxTilt: number;
  /** Noise: deepest dent as a share of the radius. */
  wobble: number;
  /** Noise: highest harmonic. 2 is ellipse-like, 3 triangular, 4 squarish, more is lumpier. */
  detail: number;
  /** Noise: how fast higher harmonics fade, as 1 / k^falloff. */
  falloff: number;
  /** Draw each hole's full shape, today's circle and the tilt. */
  overlay: boolean;
};

/** Radius at local angle `a`: `u` runs along the edge, `v` inward. */
type Shape = (a: number) => number;

type Reshaped = {
  shape: Shape;
  /** Crossing angles with the edge line: left near PI, right near 0. */
  left: number;
  right: number;
  /** Set when the base is an ellipse, for the overlay's tilt tick. */
  ellipse: { rx: number; ry: number; tilt: number } | undefined;
  /** The pure ellipse variant still emits one SVG arc; the rest are sampled. */
  arc: boolean;
};

const fmt = (value: number) => String(roundCoord(value));
const soft = (n: number) => Math.tanh(1.6 * Math.abs(n)) / Math.tanh(1.6);
const HOLE_SAMPLES = 36;

export function prototypeSvg(
  variant: Variant,
  tuning: Tuning,
  config: StampConfigInput,
  image: StampImage | null,
  options: RenderOptions,
): string {
  const tree = stampSvgTree(config, image, options);
  const layout = createLayout(config);
  const original = stampPath(layout).outline;
  const holes = reshapeHoles(variant, tuning, layout);
  const reshaped = withNewTeeth(layout, holes);
  const outline = variant === 'A' ? original : drawOutline(reshaped, holes);
  const fibres = stampPath(reshaped).fibres.map((s) => ({
    tag: 'path',
    attrs: {
      d: `M${fmt(s.from.x)} ${fmt(s.from.y)}Q${fmt(s.control.x)} ${fmt(s.control.y)} ${fmt(s.to.x)} ${fmt(s.to.y)}`,
      'stroke-width': fmt(s.width),
    },
    children: [],
  }));

  const swap = (node: SvgNode): SvgNode => {
    if (node.attrs.d === original) return { ...node, attrs: { ...node.attrs, d: outline } };
    if (node.tag === 'g' && node.attrs.fill === 'none') return { ...node, children: fibres };
    return {
      ...node,
      children: node.children.map((c) => (typeof c === 'string' ? c : swap(c))),
    };
  };
  const out = swap(tree);
  return serializeSvg(
    tuning.overlay ? { ...out, children: [...out.children, overlay(reshaped, holes)] } : out,
  );
}

function reshapeHoles(variant: Variant, t: Tuning, layout: StampLayout): Reshaped[][] {
  const seed = layout.config.seed * 7919 + 101;
  let index = 0;
  return layout.edges.map((edge) => {
    const shapes = edge.holes.map((hole, i) => {
      const g = index + i;
      // Smooth along the whole perimeter, continuous across corners, blended
      // with a per-hole draw.
      const n = (channel: number) => {
        const smooth = valueNoise1d(g / t.wavelength, seed + channel * 131);
        const own = hash2(g, seed + channel * 131 + 7) * 2 - 1;
        return smooth * (1 - t.independence) + own * t.independence;
      };
      const r = hole.radius;
      const v = t.variation;

      let base: Shape = () => r;
      let ellipse: Reshaped['ellipse'];
      if (variant === 'B' || variant === 'D') {
        const nTilt = n(2);
        const aspect = 1 - t.squash * v * soft(n(1));
        const deg = Math.sign(nTilt) * (t.minTilt + (t.maxTilt - t.minTilt) * soft(nTilt)) * v;
        const tilt = (deg * Math.PI) / 180;
        const rx = r;
        const ry = r * aspect;
        base = (a) => (rx * ry) / Math.hypot(ry * Math.cos(a - tilt), rx * Math.sin(a - tilt));
        ellipse = { rx, ry, tilt };
      }

      let shape = base;
      if (variant === 'C' || variant === 'D') {
        const terms: [k: number, c: number, s: number][] = [];
        for (let k = 2; k <= Math.round(t.detail); k++) {
          const w = 1 / Math.pow(k, t.falloff);
          terms.push([k, n(10 + 2 * k) * w, n(11 + 2 * k) * w]);
        }
        const g0 = (a: number) =>
          terms.reduce((sum, [k, c, s]) => sum + c * Math.cos(k * a) + s * Math.sin(k * a), 0);
        // Normalise per hole so the deepest dent is exactly `depth`.
        let lo = Infinity;
        let hi = -Infinity;
        for (let s = 0; s < 72; s++) {
          const val = g0((s / 72) * 2 * Math.PI);
          lo = Math.min(lo, val);
          hi = Math.max(hi, val);
        }
        const depth = t.wobble * v * (0.35 + 0.65 * soft(n(5)));
        const span = hi - lo || 1;
        shape = (a) => base(a) * (1 - depth * ((hi - g0(a)) / span));
      }

      const f = (a: number) => hole.perp + shape(a) * Math.sin(a);
      return {
        shape,
        left: bisect(f, Math.PI / 2, (3 * Math.PI) / 2),
        right: bisect(f, -Math.PI / 2, Math.PI / 2),
        ellipse,
        arc: variant === 'B',
      };
    });
    index += edge.holes.length;
    return shapes;
  });
}

/** Root of `f` between `a` and `b`, given `f` changes sign across them. */
function bisect(f: (x: number) => number, a: number, b: number): number {
  let lo = a;
  let hi = b;
  const loSign = Math.sign(f(lo));
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (Math.sign(f(mid)) === loSign) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Point on a hole's boundary at local angle `a`, in stamp coordinates. */
function holePoint(edge: EdgeLayout, hole: Hole, shape: Shape, a: number) {
  const r = shape(a);
  return edgePoint(edge, hole.along + r * Math.cos(a), -(hole.perp + r * Math.sin(a)));
}

function withNewTeeth(layout: StampLayout, holes: Reshaped[][]): StampLayout {
  const edges = layout.edges.map((edge, e) => {
    const shapes = holes[e] ?? [];
    const crossing = (j: number, side: 'left' | 'right') => {
      const hole = edge.holes[j];
      const s = shapes[j];
      if (!hole || !s) return undefined;
      const a = s[side];
      return hole.along + s.shape(a) * Math.cos(a);
    };
    const teeth = edge.teeth.map((tooth, j): Tooth => ({
      ...tooth,
      from: crossing(j - 1, 'right') ?? tooth.from,
      to: crossing(j, 'left') ?? tooth.to,
    }));
    return { ...edge, teeth };
  });
  return { ...layout, edges };
}

/** The core's `stampPath` walk, with each hole drawn from its new shape. */
function drawOutline(layout: StampLayout, holes: Reshaped[][]): string {
  let outline = '';
  const { edges } = layout;
  edges.forEach((edge, e) => {
    edge.teeth.forEach((tooth, j) => {
      const samples = Math.max(3, Math.ceil((tooth.to - tooth.from) / TOOTH_SAMPLE_STEP));
      for (let s = 0; s <= samples; s++) {
        const u = s / samples;
        if (s === 0 && !(e === 0 && j === 0)) continue;
        const p = edgePoint(
          edge,
          tooth.from + (tooth.to - tooth.from) * u,
          toothOffset(layout, edge, tooth, u),
        );
        outline += `${outline ? 'L' : 'M'}${fmt(p.x)} ${fmt(p.y)}`;
      }
      const hole = edge.holes[j];
      const shape = holes[e]?.[j];
      const next = edge.teeth[j + 1];
      if (!hole || !shape || !next) return;
      const end = edgePoint(edge, next.from, 0);
      if (shape.arc && shape.ellipse) {
        // Still one clean arc: SVG takes the radii and the rotation directly.
        const { rx, ry, tilt } = shape.ellipse;
        const phi = (Math.atan2(edge.direction.y, edge.direction.x) + tilt) * (180 / Math.PI);
        const large = shape.left - shape.right > Math.PI ? 1 : 0;
        outline += `A${fmt(rx)} ${fmt(ry)} ${fmt(phi)} ${large} 0 ${fmt(end.x)} ${fmt(end.y)}`;
      } else {
        // Sampled, but smooth: still a clean punch, not a torn edge.
        for (let s = 1; s < HOLE_SAMPLES; s++) {
          const a = shape.left + ((shape.right - shape.left) * s) / HOLE_SAMPLES;
          const p = holePoint(edge, hole, shape.shape, a);
          outline += `L${fmt(p.x)} ${fmt(p.y)}`;
        }
        outline += `L${fmt(end.x)} ${fmt(end.y)}`;
      }
    });
    const next = edges[(e + 1) % edges.length];
    if (edge.cornerEnd > 0 && next) {
      const p = edgePoint(next, next.cornerStart, 0);
      const r = fmt(edge.cornerEnd);
      outline += `A${r} ${r} 0 0 0 ${fmt(p.x)} ${fmt(p.y)}`;
    }
  });
  return `${outline}Z`;
}

/** Each hole's whole shape (red), today's circle (dashed) and the ellipse tilt (tick). */
function overlay(layout: StampLayout, holes: Reshaped[][]): SvgNode {
  const paths: SvgNode[] = [];
  const width = fmt(layout.pitch * 0.012);
  layout.edges.forEach((edge, e) => {
    edge.holes.forEach((hole, j) => {
      const shape = holes[e]?.[j];
      if (!shape) return;
      let d = '';
      for (let s = 0; s <= 72; s++) {
        const p = holePoint(edge, hole, shape.shape, (s / 72) * 2 * Math.PI);
        d += `${s ? 'L' : 'M'}${fmt(p.x)} ${fmt(p.y)}`;
      }
      paths.push({ tag: 'path', attrs: { d: `${d}Z`, stroke: '#ff3b30' }, children: [] });
      const { x, y } = hole.center;
      paths.push({
        tag: 'circle',
        attrs: {
          cx: fmt(x),
          cy: fmt(y),
          r: fmt(hole.radius),
          stroke: '#00c2ff',
          'stroke-dasharray': `${fmt(hole.radius * 0.15)} ${fmt(hole.radius * 0.15)}`,
        },
        children: [],
      });
      if (shape.ellipse) {
        const a = Math.atan2(edge.direction.y, edge.direction.x) + shape.ellipse.tilt;
        const len = shape.ellipse.rx * 0.8;
        paths.push({
          tag: 'path',
          attrs: {
            d: `M${fmt(x - Math.cos(a) * len)} ${fmt(y - Math.sin(a) * len)}L${fmt(x + Math.cos(a) * len)} ${fmt(y + Math.sin(a) * len)}`,
            stroke: '#ffcc00',
          },
          children: [],
        });
      }
    });
  });
  return { tag: 'g', attrs: { fill: 'none', 'stroke-width': width }, children: paths };
}
