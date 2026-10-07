import { DEFAULT_CONFIG } from './defaults.ts';
import { createLayout } from './layout.ts';
import { stampPath } from './path.ts';
import { hashString } from './prng.ts';
import { DEFAULT_TEAR_LIBRARY } from './tears/index.ts';
import type { RenderOptions, StampConfigInput, StampImage, StampLayout, SvgNode } from './types.ts';
import { UNITS_PER_MM, mmToUnits, roundCoord } from './units.ts';

/**
 * Space around the trim for torn teeth and fibres, as a share of the pitch, plus
 * room for the shadow's blur when it is on (stamp units).
 */
const VIEW_PADDING = 0.6;
const SHADOW_PADDING = 6;

const fmt = (value: number) => String(roundCoord(value));

const el = (tag: string, attrs: SvgNode['attrs'], children: SvgNode['children'] = []): SvgNode => ({
  tag,
  attrs,
  children,
});

/**
 * The core stops at an SVG string. The browser and the server both start from it,
 * so they cannot drift apart.
 */
export function renderSvg(
  config: StampConfigInput,
  image: StampImage | null,
  options: RenderOptions = {},
): string {
  return serializeSvg(stampSvgTree(config, image, options));
}

/**
 * The stamp as an element tree: what `renderSvg` serialises, and what bindings
 * such as `<Stamp>` turn into their own elements. One tree behind every output
 * means they cannot drift apart. Attribute values are raw; serialisers escape.
 *
 * Bleed: a `<pattern>` holding the image (cover-fit over the print rect, which
 * extends past the trim by `0.45 * pitch`), and
 * the stamp path filled with that pattern. Fibre strokes use the same pattern.
 * One path, one fill, no clip seam — clipping an image over a paper-coloured
 * shape with the same outline left a light halo from double anti-aliasing.
 *
 * Bordered: the path filled with paper colour, then the image clipped to the
 * inner print rect and to the path.
 *
 * Constraints that keep this renderable without a browser:
 * - No CSS masks, no SVG filters, no WebGL, no blend modes. Anything that must
 *   survive the server is geometry or a plain fill.
 * - Paper grain and other textures are effects, not part of the core output.
 * - Fonts and images are passed in as data; the core never fetches.
 *
 * The drop shadow is the one exception and is opt-in via `options.shadow`.
 *
 * With no image the print area is plain paper, which is what the lab's debug
 * views want.
 */
export function stampSvgTree(
  config: StampConfigInput,
  image: StampImage | null,
  options: RenderOptions = {},
): SvgNode {
  const layout = createLayout(config, options.library ?? DEFAULT_TEAR_LIBRARY);
  const { outline, fibres } = stampPath(layout);
  const { size, pitch, printRect } = layout;
  const paper = layout.config.paper ?? DEFAULT_CONFIG.paper ?? '#F3EEE2';
  const bleed = layout.config.print.area === 'bleed';
  const shadow = options.shadow ?? false;
  const scale = options.scale ?? UNITS_PER_MM;
  const id =
    options.idPrefix ??
    `leima-${hashString(`${outline}|${image?.href ?? ''}|${paper}|${layout.config.print.area}`).toString(36)}`;

  const pad =
    options.padding === undefined
      ? VIEW_PADDING * pitch + (shadow ? SHADOW_PADDING : 0)
      : mmToUnits(Math.max(0, options.padding));
  const viewWidth = size.width + 2 * pad;
  const viewHeight = size.height + 2 * pad;
  const rectAttrs = {
    x: fmt(printRect.x),
    y: fmt(printRect.y),
    width: fmt(printRect.width),
    height: fmt(printRect.height),
  };

  // Bleed with an image fills through the pattern; everything else is paper.
  const ink = bleed && image ? `url(#${id}-print)` : paper;
  const defs: SvgNode[] = [];
  if (shadow) {
    defs.push(
      el(
        'filter',
        {
          id: `${id}-shadow`,
          x: '-15%',
          y: '-15%',
          width: '130%',
          height: '130%',
          'color-interpolation-filters': 'sRGB',
        },
        [
          el('feDropShadow', {
            dx: '0',
            dy: '1.2',
            stdDeviation: '1.6',
            'flood-color': '#141a14',
            'flood-opacity': '.22',
          }),
          el('feDropShadow', {
            dx: '0',
            dy: '0.25',
            stdDeviation: '0.3',
            'flood-color': '#141a14',
            'flood-opacity': '.22',
          }),
        ],
      ),
    );
  }
  const print: SvgNode[] = [];
  if (image && bleed) {
    defs.push(
      el('pattern', { id: `${id}-print`, patternUnits: 'userSpaceOnUse', ...rectAttrs }, [
        el('rect', { width: rectAttrs.width, height: rectAttrs.height, fill: paper }),
        imageElement(image, { x: 0, y: 0, width: printRect.width, height: printRect.height }),
      ]),
    );
  } else if (image) {
    defs.push(
      el('clipPath', { id: `${id}-outline` }, [el('path', { d: outline })]),
      el('clipPath', { id: `${id}-area` }, [el('rect', rectAttrs)]),
    );
    print.push(
      el('g', { 'clip-path': `url(#${id}-outline)` }, [
        el('g', { 'clip-path': `url(#${id}-area)` }, [imageElement(image, printRect)]),
      ]),
    );
  }

  const strokes = fibres.map((s) =>
    el('path', {
      d: `M${fmt(s.from.x)} ${fmt(s.from.y)}Q${fmt(s.control.x)} ${fmt(s.control.y)} ${fmt(s.to.x)} ${fmt(s.to.y)}`,
      'stroke-width': fmt(s.width),
    }),
  );

  return el(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: `${fmt(-pad)} ${fmt(-pad)} ${fmt(viewWidth)} ${fmt(viewHeight)}`,
      width: fmt((viewWidth / UNITS_PER_MM) * scale),
      height: fmt((viewHeight / UNITS_PER_MM) * scale),
      role: 'img',
    },
    [
      el('title', {}, [options.title ?? 'Postage stamp']),
      ...(defs.length ? [el('defs', {}, defs)] : []),
      el('g', shadow ? { filter: `url(#${id}-shadow)` } : {}, [
        el('path', { d: outline, fill: ink }),
        ...(strokes.length
          ? [
              el(
                'g',
                { fill: 'none', stroke: ink, 'stroke-linecap': 'round', 'stroke-opacity': '.9' },
                strokes,
              ),
            ]
          : []),
      ]),
      ...print,
    ],
  );
}

/**
 * Cover-fits the image over `rect`. With an intrinsic size it is sized
 * explicitly, so every renderer agrees; without one it falls back to the
 * renderer's own `slice` fit.
 */
function imageElement(image: StampImage, rect: StampLayout['printRect']): SvgNode {
  const { href, width: iw, height: ih } = image;
  if (!iw || !ih) {
    return el('image', {
      href,
      x: fmt(rect.x),
      y: fmt(rect.y),
      width: fmt(rect.width),
      height: fmt(rect.height),
      preserveAspectRatio: 'xMidYMid slice',
    });
  }
  const fit = Math.max(rect.width / iw, rect.height / ih);
  const width = iw * fit;
  const height = ih * fit;
  return el('image', {
    href,
    x: fmt(rect.x + (rect.width - width) / 2),
    y: fmt(rect.y + (rect.height - height) / 2),
    width: fmt(width),
    height: fmt(height),
    preserveAspectRatio: 'none',
  });
}

/** Serialises an element tree to markup, escaping text and attribute values. */
export function serializeSvg(node: SvgNode): string {
  const attrs = Object.entries(node.attrs)
    .map(([name, value]) => ` ${name}="${escapeAttr(value)}"`)
    .join('');
  if (node.children.length === 0) return `<${node.tag}${attrs}/>`;
  const inner = node.children
    .map((child) => (typeof child === 'string' ? escapeText(child) : serializeSvg(child)))
    .join('');
  return `<${node.tag}${attrs}>${inner}</${node.tag}>`;
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeAttr(value: string): string {
  return escapeText(value).replaceAll('"', '&quot;');
}
