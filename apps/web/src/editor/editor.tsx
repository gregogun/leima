'use client';

import {
  normaliseConfig,
  type CornerMode,
  type StampConfigInput,
  type StampImage,
} from '@leima/core';
import { button, folder, useControls } from 'leva';
import { useEffect, useRef, useState } from 'react';
import { DEMO_IMAGE } from './demo-image.ts';
import { downloadPng, downloadSvg, loadImage } from './export.ts';
import { VARIANTS, isVariant, prototypeSvg, type Variant } from './hole-variation.prototype.ts';
import { PrototypeSwitcher } from './prototype-switcher.tsx';

/**
 * The editor, Leva phase: every setting is a Leva control until the settings
 * feel right, then a custom UI replaces the panel. Nothing here is the final
 * interface.
 */

const SHAPES = {
  portrait: { width: 24, height: 30 },
  square: { width: 26, height: 26 },
  landscape: { width: 30, height: 24 },
} as const;
const SHAPE_OPTIONS = [...Object.keys(SHAPES), 'custom'];
const CORNERS: readonly CornerMode[] = ['offset', 'hole', 'solid'];
const isCorner = (value: string): value is CornerMode => CORNERS.some((c) => c === value);
const isShape = (value: string): value is keyof typeof SHAPES => value in SHAPES;

const unit = { min: 0, max: 1, step: 0.01 };
/** Room for the widest teeth, fibres and shadow blur at any gauge. */
const STAGE_PADDING_MM = 2.5;

export function Editor() {
  const [image, setImage] = useState<StampImage | null>(DEMO_IMAGE);
  // PROTOTYPE: hole variation, `?variant=` A-D.
  const [variant, setVariant] = useState<Variant>('B');
  useEffect(() => {
    const param = new URLSearchParams(location.search).get('variant');
    if (isVariant(param)) setVariant(param);
  }, []);
  const changeVariant = (key: Variant) => {
    setVariant(key);
    const url = new URL(location.href);
    url.searchParams.set('variant', key);
    history.replaceState(history.state, '', url);
  };
  const proto = useControls('Holes (prototype)', {
    variation: { value: 1, ...unit, hint: 'the doc’s single control' },
    wavelength: { value: 5, min: 1, max: 12, step: 0.5, hint: 'noise wavelength, in holes' },
    independence: { value: 0.2, ...unit, hint: '0 = drift along the edge, 1 = every hole its own' },
    squash: { value: 0.15, min: 0, max: 0.4, step: 0.01, hint: 'ellipse: max 1 − aspect' },
    minTilt: { value: 5, min: 0, max: 45, step: 1, hint: 'ellipse: degrees' },
    maxTilt: { value: 15, min: 0, max: 45, step: 1, hint: 'ellipse: degrees' },
    wobble: { value: 0.12, min: 0, max: 0.4, step: 0.01, hint: 'noise: deepest dent, share of r' },
    detail: { value: 5, min: 2, max: 10, step: 1, hint: 'noise: highest harmonic' },
    falloff: { value: 1, min: 0, max: 2, step: 0.1, hint: 'noise: 1 / k^falloff' },
    overlay: false,
  });
  // Buttons read the latest state when clicked, not when the schema was built.
  const latest = useRef<{
    config: StampConfigInput;
    image: StampImage | null;
    pxPerMm: number;
    shadow: boolean;
  }>(null);

  const [v, set] = useControls(() => ({
    Stamp: folder({
      seed: { value: 7, min: 1, max: 99999, step: 1 },
      'new seed': button(() => set({ seed: 1 + Math.floor(Math.random() * 99999) })),
      shape: { value: 'portrait', options: SHAPE_OPTIONS },
      width: {
        value: 24,
        min: 10,
        max: 60,
        step: 0.5,
        render: (get) => get('Stamp.shape') === 'custom',
      },
      height: {
        value: 30,
        min: 10,
        max: 60,
        step: 0.5,
        render: (get) => get('Stamp.shape') === 'custom',
      },
    }),
    Perforation: folder({
      gauge: { value: 14, min: 8, max: 18, step: 0.5, hint: 'holes per 2 cm' },
      holeSize: {
        value: 0.55,
        min: 0.2,
        max: 0.85,
        step: 0.01,
        hint: 'diameter as a share of the pitch',
      },
      corners: { value: 'offset', options: [...CORNERS] },
    }),
    Wear: folder({
      wear: { value: 0.38, ...unit, hint: 'tear depth, hole jitter, pulled perfs' },
    }),
    Print: folder({
      area: { value: 'bleed', options: ['bleed', 'bordered'] },
      margin: {
        value: 1.8,
        min: 0,
        max: 5,
        step: 0.1,
        render: (get) => get('Print.area') === 'bordered',
      },
      paper: '#F3EEE2',
      image: { image: undefined },
    }),
    Tears: folder(
      {
        fibres: { value: 0.5, ...unit },
        roughness: { value: 0.5, ...unit },
        clean: { value: 1, ...unit },
        step: { value: 1, ...unit },
        nibble: { value: 1, ...unit },
        spur: { value: 1, ...unit },
        lean: { value: 1, ...unit },
        frayed: { value: 1, ...unit },
      },
      { collapsed: true },
    ),
    View: folder({
      background: '#0c0c0d',
      zoom: { value: 1, min: 0.25, max: 4, step: 0.05 },
      shadow: false,
    }),
    Export: folder({
      'PNG px/mm': { value: 40, min: 10, max: 120, step: 5 },
      'Download SVG': button(() => {
        const state = latest.current;
        if (state) downloadSvg(state.config, state.image, state.shadow);
      }),
      'Download PNG': button(() => {
        const state = latest.current;
        if (state) void downloadPng(state.config, state.image, state.pxPerMm, state.shadow);
      }),
      'Copy config': button(() => {
        if (!latest.current) return;
        const json = JSON.stringify(normaliseConfig(latest.current.config), null, 2);
        void navigator.clipboard.writeText(json);
        console.info('[leima] config copied\n', json);
      }),
    }),
  }));

  // Leva hands back an object URL; the core wants a data URI with a known size.
  useEffect(() => {
    let live = true;
    if (v.image) {
      loadImage(v.image)
        .then((loaded) => live && setImage(loaded))
        .catch((error: unknown) => console.error('[leima] could not load image', error));
    } else {
      setImage(DEMO_IMAGE);
    }
    return () => {
      live = false;
    };
  }, [v.image]);

  const config: StampConfigInput = {
    seed: v.seed,
    size: isShape(v.shape) ? SHAPES[v.shape] : { width: v.width, height: v.height },
    perforation: {
      gauge: v.gauge,
      holeSize: v.holeSize,
      corners: isCorner(v.corners) ? v.corners : 'offset',
    },
    wear: v.wear,
    print: v.area === 'bordered' ? { area: 'bordered', margin: v.margin } : { area: 'bleed' },
    tears: {
      profiles: {
        clean: v.clean,
        step: v.step,
        nibble: v.nibble,
        spur: v.spur,
        lean: v.lean,
        frayed: v.frayed,
      },
      fibres: v.fibres,
      roughness: v.roughness,
    },
    paper: v.paper,
  };
  latest.current = { config, image, pxPerMm: v['PNG px/mm'], shadow: v.shadow };

  return (
    <main className="stage" style={{ background: v.background }}>
      <div
        className="stamp-proto"
        style={{ height: `calc(78vh * ${v.zoom})` }}
        dangerouslySetInnerHTML={{
          __html: prototypeSvg(variant, proto, config, image, {
            shadow: v.shadow,
            padding: STAGE_PADDING_MM,
            title: 'Stamp preview',
          }),
        }}
      />
      <PrototypeSwitcher variants={VARIANTS} current={variant} onChange={changeVariant} />
    </main>
  );
}
