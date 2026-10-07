import { DEFAULT_CONFIG } from './defaults.js';
import { createLayout } from './layout.js';
import { stampPath } from './path.js';
import { hashString } from './prng.js';
import { DEFAULT_TEAR_LIBRARY } from './tears/index.js';
import type { RenderOptions, StampConfigInput, StampImage, StampLayout } from './types.js';
import { UNITS_PER_MM, roundCoord } from './units.js';

/**
 * Space around the trim for torn teeth and fibres, as a share of the pitch, plus
 * room for the shadow's blur when it is on (stamp units).
 */
const VIEW_PADDING = 0.6;
const SHADOW_PADDING = 6;

const fmt = (value: number) => String(roundCoord(value));

/**
 * The core stops at an SVG string. The browser and the server both start from it,
 * so they cannot drift apart.
 *
 * Bleed: a `<pattern>` holding the image (cover-fit over the print rect, which
 * extends past the trim by `0.45 * pitch` plus the misregistration offset), and
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
export function renderSvg(
  config: StampConfigInput,
  image: StampImage | null,
  options: RenderOptions = {},
): string {
  const layout = createLayout(config, options.library ?? DEFAULT_TEAR_LIBRARY);
  const { outline, fibres } = stampPath(layout);
  const { size, pitch, printRect } = layout;
  const paper = escapeAttr(layout.config.paper ?? DEFAULT_CONFIG.paper ?? '#F3EEE2');
  const bleed = layout.config.print.area === 'bleed';
  const shadow = options.shadow ?? false;
  const scale = options.scale ?? UNITS_PER_MM;
  const id =
    options.idPrefix ??
    `leima-${hashString(`${outline}|${image?.href ?? ''}|${paper}|${layout.config.print.area}`).toString(36)}`;

  const pad = VIEW_PADDING * pitch + (shadow ? SHADOW_PADDING : 0);
  const viewWidth = size.width + 2 * pad;
  const viewHeight = size.height + 2 * pad;
  const title = escapeText(options.title ?? 'Postage stamp');

  // Bleed with an image fills through the pattern; everything else is paper.
  const ink = bleed && image ? `url(#${id}-print)` : paper;
  const defs: string[] = [];
  if (shadow) {
    defs.push(
      `<filter id="${id}-shadow" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">` +
        `<feDropShadow dx="0" dy="1.2" stdDeviation="1.6" flood-color="#141a14" flood-opacity=".22"/>` +
        `<feDropShadow dx="0" dy="0.25" stdDeviation="0.3" flood-color="#141a14" flood-opacity=".22"/>` +
        `</filter>`,
    );
  }
  let print = '';
  if (image && bleed) {
    defs.push(
      `<pattern id="${id}-print" patternUnits="userSpaceOnUse" x="${fmt(printRect.x)}" y="${fmt(printRect.y)}" width="${fmt(printRect.width)}" height="${fmt(printRect.height)}">` +
        `<rect width="${fmt(printRect.width)}" height="${fmt(printRect.height)}" fill="${paper}"/>` +
        imageElement(image, { x: 0, y: 0, width: printRect.width, height: printRect.height }) +
        `</pattern>`,
    );
  } else if (image) {
    defs.push(
      `<clipPath id="${id}-outline"><path d="${outline}"/></clipPath>` +
        `<clipPath id="${id}-area"><rect x="${fmt(printRect.x)}" y="${fmt(printRect.y)}" width="${fmt(printRect.width)}" height="${fmt(printRect.height)}"/></clipPath>`,
    );
    print =
      `<g clip-path="url(#${id}-outline)"><g clip-path="url(#${id}-area)">` +
      imageElement(image, printRect) +
      `</g></g>`;
  }

  const strokes = fibres
    .map(
      (s) =>
        `<path d="M${fmt(s.from.x)} ${fmt(s.from.y)}Q${fmt(s.control.x)} ${fmt(s.control.y)} ${fmt(s.to.x)} ${fmt(s.to.y)}" stroke-width="${fmt(s.width)}"/>`,
    )
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(-pad)} ${fmt(-pad)} ${fmt(viewWidth)} ${fmt(viewHeight)}" width="${fmt((viewWidth / UNITS_PER_MM) * scale)}" height="${fmt((viewHeight / UNITS_PER_MM) * scale)}" role="img">` +
    `<title>${title}</title>` +
    (defs.length ? `<defs>${defs.join('')}</defs>` : '') +
    `<g${shadow ? ` filter="url(#${id}-shadow)"` : ''}>` +
    `<path d="${outline}" fill="${ink}"/>` +
    (strokes
      ? `<g fill="none" stroke="${ink}" stroke-linecap="round" stroke-opacity=".9">${strokes}</g>`
      : '') +
    `</g>` +
    print +
    `</svg>`
  );
}

/** Cover-fits the image over `rect`. Sized explicitly rather than with `slice`, so every renderer agrees. */
function imageElement(image: StampImage, rect: StampLayout['printRect']): string {
  const fit = Math.max(rect.width / image.width, rect.height / image.height);
  const width = image.width * fit;
  const height = image.height * fit;
  const x = rect.x + (rect.width - width) / 2;
  const y = rect.y + (rect.height - height) / 2;
  return `<image href="${escapeAttr(image.href)}" x="${fmt(x)}" y="${fmt(y)}" width="${fmt(width)}" height="${fmt(height)}" preserveAspectRatio="none"/>`;
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeAttr(value: string): string {
  return escapeText(value).replaceAll('"', '&quot;');
}
