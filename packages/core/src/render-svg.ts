import { notImplemented } from './internal/not-implemented.js';
import type { RenderOptions, StampConfig, StampImage } from './types.js';

/**
 * The core stops at an SVG string. The browser and the server both start from it,
 * so they cannot drift apart.
 *
 * Bleed: a `<pattern>` holding the image (cover-fit, extended past the trim by
 * `0.45 * pitch` plus the misregistration offset), and the stamp path filled with
 * that pattern. Fibre strokes use the same pattern. One path, one fill, no clip
 * seam — clipping an image over a paper-coloured shape with the same outline left
 * a light halo from double anti-aliasing.
 *
 * Bordered: the path filled with paper colour, then the image clipped to the
 * inner print rect and to the path.
 *
 * Constraints that keep this renderable without a browser:
 * - No CSS masks, no SVG filters, no WebGL. Anything that must survive the server
 *   is geometry or a plain fill.
 * - Paper grain and other textures are effects, not part of the core output.
 * - Fonts and images are passed in as data; the core never fetches.
 *
 * The drop shadow is the one exception and is opt-in via `options.shadow`.
 */
export function renderSvg(
  _config: StampConfig,
  _image: StampImage,
  _options?: RenderOptions,
): string {
  notImplemented('renderSvg');
}

/** Bleed overshoot as a share of the pitch, before misregistration is added. */
export const BLEED_OVERSHOOT = 0.45;
