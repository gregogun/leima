import { edgePoint } from './layout.js';
import { valueNoise1d } from './noise.js';
import { hash2 } from './prng.js';
import { sampleProfile } from './tears/index.js';
import type { EdgeLayout, FibreStroke, StampLayout, StampPath, Tooth } from './types.js';
import { roundCoord } from './units.js';

/** Sample spacing along a tooth, in stamp units. */
export const TOOTH_SAMPLE_STEP = 0.3;

const fmt = (value: number) => String(roundCoord(value));

/**
 * Walk each edge: emit the tooth as sampled points (about every 0.3 units), then
 * an inward arc for the hole. Arcs use sweep 0, and large-arc 1 when the hole
 * centre sits inside the edge line. `hole` corner mode adds a quarter-circle arc
 * at each corner into the next edge.
 *
 * Punched holes are clean; torn teeth are rough. Tear profiles and roughness
 * apply only to the tooth segments between holes, never to hole arcs.
 *
 * Coordinates round to 2 decimals, so the path string is snapshot-stable.
 */
export function stampPath(layout: StampLayout): StampPath {
  let outline = '';
  let teeth = '';
  const { edges } = layout;

  edges.forEach((edge, e) => {
    const { holes } = edge;
    edge.teeth.forEach((tooth, j) => {
      const samples = Math.max(3, Math.ceil((tooth.to - tooth.from) / TOOTH_SAMPLE_STEP));
      for (let s = 0; s <= samples; s++) {
        const u = s / samples;
        const p = edgePoint(
          edge,
          lerp(tooth.from, tooth.to, u),
          toothOffset(layout, edge, tooth, u),
        );
        const xy = `${fmt(p.x)} ${fmt(p.y)}`;
        teeth += (s === 0 ? 'M' : 'L') + xy;
        // A tooth's first sample is where the previous arc ended, except for the
        // very first point of the outline.
        if (s === 0 && !(e === 0 && j === 0)) continue;
        outline += (outline ? 'L' : 'M') + xy;
      }
      const hole = holes[j];
      const next = edge.teeth[j + 1];
      if (hole && next) {
        // The arc lands where the next tooth starts.
        const p = edgePoint(edge, next.from, 0);
        const r = fmt(hole.radius);
        outline += `A${r} ${r} 0 ${hole.perp > 0 ? 1 : 0} 0 ${fmt(p.x)} ${fmt(p.y)}`;
      }
    });
    const next = edges[(e + 1) % edges.length];
    if (edge.cornerEnd > 0 && next) {
      // One hole centred on the corner: a concave quarter-circle into the next edge.
      const p = edgePoint(next, next.cornerStart, 0);
      const r = fmt(edge.cornerEnd);
      outline += `A${r} ${r} 0 0 0 ${fmt(p.x)} ${fmt(p.y)}`;
    }
  });

  return { outline: `${outline}Z`, teeth, fibres: fibreStrokes(layout) };
}

/**
 * Outward offset at `u` in [0, 1] along a tooth:
 *
 *   amp * (profile(u) + roughness * noise * env) - pull * sin(PI*u)^0.7
 *
 * where `amp = (0.05 + 0.15w) * step` (1.4x on a pulled tooth) and
 * `env = sin(PI*u)^0.5`. Every term is 0 at both ends, so teeth meet hole arcs
 * exactly.
 */
export function toothOffset(
  layout: StampLayout,
  edge: EdgeLayout,
  tooth: Tooth,
  u: number,
): number {
  const { wear, tears } = layout.config;
  const profile = tooth.profile === null ? undefined : layout.library.get(tooth.profile);
  const shape = profile
    ? sampleProfile(profile, tooth.flip ? 1 - u : u) * (tooth.invert ? -1 : 1)
    : 0;
  const amp = (0.05 + 0.15 * wear) * edge.step * (tooth.pull ? 1.4 : 1);
  const along = lerp(tooth.from, tooth.to, u);
  const env = Math.pow(Math.sin(Math.PI * u), 0.5);
  const micro =
    0.28 * tears.roughness * valueNoise1d(along / (0.05 * edge.step), edge.noiseSeed + 21) * env;
  return amp * (shape + micro) - tooth.pull * Math.pow(Math.sin(Math.PI * u), 0.7);
}

/**
 * Per tooth, if the fibre roll passes the density threshold, 1-3 short quadratic
 * strokes leave the torn edge outward (+/-43 degrees). All detail comes from the
 * tooth's stateless hash.
 */
function fibreStrokes(layout: StampLayout): FibreStroke[] {
  const { wear, tears } = layout.config;
  const threshold = (0.1 + 0.6 * wear) * 2 * tears.fibres;
  const strokes: FibreStroke[] = [];

  for (const edge of layout.edges) {
    // Outward normal.
    const ox = -edge.inward.x;
    const oy = -edge.inward.y;
    for (const tooth of edge.teeth) {
      if (tooth.fibreRoll > threshold) continue;
      const count = 1 + Math.floor(hash2(tooth.hash, 1) * 2.2);
      for (let i = 0; i < count; i++) {
        const r1 = hash2(tooth.hash, 10 + i);
        const r2 = hash2(tooth.hash, 20 + i);
        const r3 = hash2(tooth.hash, 30 + i);
        const r4 = hash2(tooth.hash, 40 + i);
        const u = 0.2 + 0.6 * r1;
        // Start just inside the torn edge so the stroke's round cap sits on paper.
        const from = edgePoint(
          edge,
          lerp(tooth.from, tooth.to, u),
          toothOffset(layout, edge, tooth, u) - 0.15,
        );
        const angle = (r2 - 0.5) * 1.5;
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);
        const vx = ox * ca - oy * sa;
        const vy = ox * sa + oy * ca;
        const length = (0.05 + 0.14 * r3) * edge.step * (0.6 + wear);
        const to = { x: from.x + vx * length, y: from.y + vy * length };
        const bend = (r4 - 0.5) * length * 0.8;
        strokes.push({
          from,
          control: { x: (from.x + to.x) / 2 - vy * bend, y: (from.y + to.y) / 2 + vx * bend },
          to,
          width: 0.12 + 0.12 * r1,
        });
      }
    }
  }
  return strokes;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
