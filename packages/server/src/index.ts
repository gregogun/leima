import type { RenderOptions, StampConfig, StampImage } from '@leima/core';

/**
 * v1.1. Out of scope for v1; the shape lives here so the dependency direction is
 * fixed and the core stays unaware of it.
 *
 * Server rendering has three jobs: share-link preview images for the editor,
 * image URLs for apps that issue stamps (email strips inline SVG), and batch or
 * CI rendering.
 *
 * `renderPng` rasterises the SVG string with resvg directly. No Satori is needed.
 */
export function renderPng(
  _config: StampConfig,
  _image: StampImage,
  _options?: RenderOptions,
): Promise<Uint8Array> {
  throw new Error('[@leima/server] renderPng is not implemented yet (v1.1, build step 6).');
}

/**
 * For a stamp sitting inside a larger JSX layout, such as an OG card. Satori's
 * `<pattern>` support is limited, so the stamp is embedded as an `<img>` with an
 * SVG data URI.
 *
 * OPEN QUESTION from the brief, to verify before this is built: does a stamp
 * embedded this way render its pattern fill correctly in Satori?
 */
export function stampDataUri(
  _config: StampConfig,
  _image: StampImage,
  _options?: RenderOptions,
): string {
  throw new Error('[@leima/server] stampDataUri is not implemented yet (v1.1, build step 6).');
}
