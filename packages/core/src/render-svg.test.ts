import { describe, expect, it } from 'vitest';
import { createLayout, renderSvg, stampPath, type StampImage } from './index.js';

const IMAGE: StampImage = { href: 'data:image/png;base64,AAAA', width: 640, height: 320 };

describe('renderSvg', () => {
  it('fills a bleed stamp through one pattern: one path, one fill, no clip seam', () => {
    const svg = renderSvg({ seed: 7 }, IMAGE);
    const { outline } = stampPath(createLayout({ seed: 7 }));
    expect(svg).toContain('<pattern');
    expect(svg).not.toContain('clipPath');
    // The outline appears once, filled with the image, never under a paper shape.
    expect(svg.split(`d="${outline}"`)).toHaveLength(2);
    expect(svg).toMatch(new RegExp(`d="${outline}" fill="url\\(#[\\w-]+-print\\)"`));
    // Fibres carry ink from the same pattern.
    expect(svg).toMatch(/stroke="url\(#[\w-]+-print\)"/);
  });

  it('cover-fits the image over the print rect', () => {
    const svg = renderSvg({ seed: 7 }, IMAGE);
    const { printRect } = createLayout({ seed: 7 });
    const height = Number(/<image[^>]* height="([\d.]+)"/.exec(svg)?.[1]);
    const width = Number(/<image[^>]* width="([\d.]+)"/.exec(svg)?.[1]);
    expect(height).toBeCloseTo(printRect.height, 1);
    expect(width).toBeCloseTo(printRect.height * 2, 1);
  });

  it('prints a bordered stamp on paper, clipped to the print rect and the outline', () => {
    const svg = renderSvg(
      { seed: 7, print: { area: 'bordered', margin: 1.8 }, paper: '#fff8e7' },
      IMAGE,
    );
    expect(svg).not.toContain('<pattern');
    expect(svg).toContain('fill="#fff8e7"');
    expect(svg.match(/<clipPath/g)).toHaveLength(2);
  });

  it('uses no filters unless the shadow is asked for', () => {
    expect(renderSvg({ seed: 7 }, IMAGE)).not.toMatch(/filter|mix-blend|mask/);
    expect(renderSvg({ seed: 7 }, IMAGE, { shadow: true })).toContain('<feDropShadow');
  });

  it('sizes the output from the scale in pixels per mm', () => {
    const at10 = renderSvg({ seed: 7 }, null);
    const at40 = renderSvg({ seed: 7 }, null, { scale: 40 });
    const width = (svg: string) => Number(/<svg[^>]* width="([\d.]+)"/.exec(svg)?.[1]);
    expect(width(at40)).toBeCloseTo(width(at10) * 4, 1);
  });

  it('gives different stamps different ids, and honours a prefix', () => {
    const id = (svg: string) => /id="([\w-]+)-print"/.exec(svg)?.[1];
    expect(id(renderSvg({ seed: 1 }, IMAGE))).not.toBe(id(renderSvg({ seed: 2 }, IMAGE)));
    expect(id(renderSvg({ seed: 1 }, IMAGE, { idPrefix: 'hero' }))).toBe('hero');
  });

  it('escapes the image href, paper and title', () => {
    const svg = renderSvg(
      { paper: '"><script>' },
      { ...IMAGE, href: 'x.png?a=1&b="2"' },
      {
        title: 'Bees & <wasps>',
      },
    );
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('href="x.png?a=1&amp;b=&quot;2&quot;"');
    expect(svg).toContain('<title>Bees &amp; &lt;wasps&gt;</title>');
  });

  it('renders plain paper with no image', () => {
    const svg = renderSvg({ seed: 7 }, null);
    expect(svg).not.toContain('<image');
    expect(svg).toContain('fill="#F3EEE2"');
  });
});
