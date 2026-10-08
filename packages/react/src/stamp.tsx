import {
  stampSvgTree,
  type RenderOptions,
  type StampConfigInput,
  type StampImage,
  type SvgNode,
} from '@leima/core';
import { createElement, type ComponentPropsWithoutRef, type ReactElement } from 'react';

export type StampProps = Omit<ComponentPropsWithoutRef<'svg'>, 'children' | 'title'> & {
  config: StampConfigInput;
  /**
   * The print. A URL or data URI on its own is cover-fitted by the browser; pass
   * `{ href, width, height }` to have the core compute the fit exactly, as every
   * other renderer will.
   */
  image?: StampImage | string | null;
  options?: RenderOptions;
  /** Accessible name. A stamp is an image, so set this to describe it. */
  title?: string;
};

/**
 * Renders the stamp as inline SVG. The elements come from the same tree that
 * `renderSvg` serialises, so the component and the string cannot drift apart.
 * There are no hooks and nothing touches the DOM, so it server-renders.
 *
 * Any other `<svg>` prop (`className`, `style`, handlers, `aria-*`) lands on the
 * root element and wins over the stamp's own, so CSS can size it.
 */
export function Stamp({ config, image, options, title, ...svgProps }: StampProps): ReactElement {
  const source = typeof image === 'string' ? { href: image } : (image ?? null);
  const tree = stampSvgTree(config, source, title === undefined ? options : { ...options, title });
  return createElement(tree.tag, { ...reactProps(tree.attrs), ...svgProps }, ...children(tree));
}

function toElement(node: SvgNode): ReactElement {
  return createElement(node.tag, reactProps(node.attrs), ...children(node));
}

function children(node: SvgNode): (ReactElement | string)[] {
  return node.children.map((child) => (typeof child === 'string' ? child : toElement(child)));
}

/** SVG's hyphenated attribute names become React's camelCase props. */
function reactProps(attrs: SvgNode['attrs']): Record<string, string> {
  const props: Record<string, string> = {};
  for (const [name, value] of Object.entries(attrs)) {
    props[name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())] = value;
  }
  return props;
}
