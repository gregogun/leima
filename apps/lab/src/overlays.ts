import { edgePoint, hashString, roundCoord, type StampLayout } from '@leima/core';

export const LAYERS = ['holes', 'spans', 'normals', 'print'] as const;
export type Layer = (typeof LAYERS)[number];

export const LAYER_LABELS: Record<Layer, string> = {
  holes: 'Hole centres',
  spans: 'Tooth spans',
  normals: 'Normals',
  print: 'Print / bleed rect',
};

/** One colour per starter profile; registered profiles get a hue from their name. */
const PROFILE_COLOURS: Record<string, string> = {
  clean: '#1f9d55',
  step: '#2563eb',
  nibble: '#d97706',
  spur: '#dc2626',
  lean: '#7c3aed',
  frayed: '#0891b2',
};
export const NO_PROFILE_COLOUR = '#6b7280';

export function profileColour(name: string | null): string {
  if (name === null) return NO_PROFILE_COLOUR;
  return PROFILE_COLOURS[name] ?? `hsl(${hashString(name) % 360} 70% 45%)`;
}

const n = (value: number) => String(roundCoord(value));
/** Hairlines stay one screen pixel wide at any zoom. */
const HAIR = 'vector-effect="non-scaling-stroke" stroke-width="1"';

/**
 * Debug geometry drawn from the same layout the stamp was rendered from, in the
 * same stamp-unit coordinates, so it can be appended inside the stamp's `<svg>`.
 */
export function overlayMarkup(layout: StampLayout, layers: ReadonlySet<Layer>): string {
  let out = '';
  const dot = Math.max(0.25, layout.pitch * 0.025);

  if (layers.has('print')) {
    const { printRect: r, size } = layout;
    out +=
      `<rect width="${n(size.width)}" height="${n(size.height)}" fill="none" stroke="#111" stroke-opacity=".5" ${HAIR}/>` +
      `<rect x="${n(r.x)}" y="${n(r.y)}" width="${n(r.width)}" height="${n(r.height)}" fill="none" stroke="#e11d8f" stroke-dasharray="4 3" ${HAIR}/>`;
  }

  for (const edge of layout.edges) {
    if (layers.has('spans')) {
      for (const tooth of edge.teeth) {
        const a = edgePoint(edge, tooth.from, 0);
        const b = edgePoint(edge, tooth.to, 0);
        const colour = profileColour(tooth.profile);
        out += `<line x1="${n(a.x)}" y1="${n(a.y)}" x2="${n(b.x)}" y2="${n(b.y)}" stroke="${colour}" stroke-width="${n(dot * 1.6)}"${tooth.pull ? ' stroke-dasharray="0.6 0.4"' : ''}/>`;
      }
    }
    if (layers.has('normals')) {
      for (const tooth of edge.teeth) {
        const mid = (tooth.from + tooth.to) / 2;
        const a = edgePoint(edge, mid, 0);
        const b = edgePoint(edge, mid, edge.step * 0.6);
        out += `<line x1="${n(a.x)}" y1="${n(a.y)}" x2="${n(b.x)}" y2="${n(b.y)}" stroke="#111" ${HAIR}/>`;
      }
    }
    if (layers.has('holes')) {
      for (const hole of edge.holes) {
        const { x, y } = hole.center;
        out +=
          `<circle cx="${n(x)}" cy="${n(y)}" r="${n(hole.radius)}" fill="none" stroke="#0ea5e9" ${HAIR}/>` +
          `<circle cx="${n(x)}" cy="${n(y)}" r="${n(dot)}" fill="#0ea5e9"/>`;
      }
      if (edge.cornerStart > 0) {
        // The shared corner hole is centred on the corner itself.
        const { x, y } = edge.origin;
        out +=
          `<circle cx="${n(x)}" cy="${n(y)}" r="${n(edge.cornerStart)}" fill="none" stroke="#f97316" ${HAIR}/>` +
          `<circle cx="${n(x)}" cy="${n(y)}" r="${n(dot)}" fill="#f97316"/>`;
      }
    }
  }
  return out ? `<g class="overlay">${out}</g>` : '';
}
