import type { RenderOptions, StampConfig, StampImage } from '@leima/core';

export type StampProps = {
  config: StampConfig;
  image: StampImage | string;
  options?: RenderOptions;
  className?: string;
  /** Alternative text. A stamp is an image, so this is not optional in practice. */
  title?: string;
};

/**
 * Renders inline SVG with no hooks that touch the DOM, so it can be
 * server-rendered.
 *
 * TODO(step 4): build on `renderSvg` from @leima/core. Deliberately not
 * `dangerouslySetInnerHTML` over the whole string if it can be avoided — decide
 * in step 4 whether to emit real JSX elements from the layout instead, which
 * keeps React able to diff and lets consumers attach handlers to the path.
 */
export function Stamp(_props: StampProps): never {
  throw new Error('[@leima/react] <Stamp> is not implemented yet (build step 4).');
}
