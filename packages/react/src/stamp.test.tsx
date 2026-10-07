import { renderSvg, type StampConfigInput, type StampImage } from '@leima/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Stamp } from './stamp.js';

const IMAGE: StampImage = { href: 'data:image/png;base64,AAAA', width: 640, height: 320 };

/** React writes `<path ...></path>` where the serialiser writes `<path .../>`. */
const expandSelfClosing = (svg: string) => svg.replace(/<(\w+)([^<>]*?)\/>/g, '<$1$2></$1>');

describe('<Stamp>', () => {
  it('server-renders exactly the markup renderSvg produces', () => {
    const cases: [StampConfigInput, StampImage | null][] = [
      [{ seed: 7 }, IMAGE],
      [{ seed: 3, wear: 1, perforation: { corners: 'hole' } }, IMAGE],
      [{ seed: 12, print: { area: 'bordered', margin: 2 }, paper: '#fff8e7' }, IMAGE],
      [{ seed: 5, misregistration: 1, perforation: { corners: 'solid' } }, null],
    ];
    for (const [config, image] of cases) {
      const markup = renderToStaticMarkup(<Stamp config={config} image={image} />);
      expect(markup).toBe(expandSelfClosing(renderSvg(config, image)));
    }
  });

  it('passes options through, shadow and scale included', () => {
    const options = { shadow: true, scale: 24, idPrefix: 'hero' };
    expect(
      renderToStaticMarkup(<Stamp config={{ seed: 2 }} image={IMAGE} options={options} />),
    ).toBe(expandSelfClosing(renderSvg({ seed: 2 }, IMAGE, options)));
  });

  it('takes a bare URL and leaves the cover fit to the renderer', () => {
    const markup = renderToStaticMarkup(<Stamp config={{ seed: 7 }} image="/stamps/peak.jpg" />);
    expect(markup).toContain('href="/stamps/peak.jpg"');
    expect(markup).toContain('preserveAspectRatio="xMidYMid slice"');
  });

  it('puts svg props on the root, over the stamp’s own', () => {
    const markup = renderToStaticMarkup(
      <Stamp
        config={{ seed: 7 }}
        title="Matterhorn, 1 franc"
        className="stamp"
        width="100%"
        aria-describedby="caption"
      />,
    );
    expect(markup).toMatch(/^<svg [^>]*class="stamp"/);
    expect(markup).toMatch(/^<svg [^>]*width="100%"/);
    expect(markup).toMatch(/^<svg [^>]*aria-describedby="caption"/);
    expect(markup).toContain('<title>Matterhorn, 1 franc</title>');
  });

  it('writes SVG attribute names, not React prop names', () => {
    const markup = renderToStaticMarkup(
      <Stamp
        config={{ seed: 7, print: { area: 'bordered' } }}
        image={IMAGE}
        options={{ shadow: true }}
      />,
    );
    expect(markup).toContain('clip-path="url(#');
    expect(markup).toContain('stroke-linecap="round"');
    expect(markup).toContain('flood-opacity=".22"');
    expect(markup).not.toMatch(/strokeWidth|clipPath="|floodColor/);
  });
});
