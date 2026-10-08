'use client';

import {
  DEFAULT_CONFIG,
  normaliseConfig,
  type CornerMode,
  type StampConfigInput,
  type StampImage,
} from '@leima/core';
import { Stamp } from '@leima/react';
import { button, folder, useControls } from 'leva';
import { useEffect, useRef, useState } from 'react';
import { DEMO_IMAGE } from './demo-image.ts';
import { downloadPng, downloadSvg, loadImage } from './export.ts';

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
const HOLES = DEFAULT_CONFIG.perforation.variation;
/** Room for the widest teeth, fibres and shadow blur at any gauge. */
const STAGE_PADDING_MM = 2.5;

export function Editor() {
  const [upload, setUpload] = useState<StampImage | null>(null);
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
      // Leva calls this on click, long after `set` is initialised.
      // oxlint-disable-next-line react/immutability
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
    Holes: folder({
      variation: { value: HOLES.amount, ...unit, hint: 'how far holes stray from circles' },
      wobble: { value: HOLES.wobble, min: 0, max: 0.4, step: 0.01, hint: 'deepest dent' },
      squash: { value: HOLES.squash, min: 0, max: 0.4, step: 0.01, hint: 'max 1 − aspect' },
      minTilt: { value: HOLES.minTilt, min: 0, max: 45, step: 1, hint: 'degrees' },
      maxTilt: { value: HOLES.maxTilt, min: 0, max: 45, step: 1, hint: 'degrees' },
      wavelength: { value: HOLES.wavelength, min: 1, max: 12, step: 0.5, hint: 'in holes' },
      independence: {
        value: HOLES.independence,
        ...unit,
        hint: '0 drifts along the edge, 1 every hole its own',
      },
      detail: { value: HOLES.detail, min: 2, max: 10, step: 1, hint: 'highest dent harmonic' },
      falloff: { value: HOLES.falloff, min: 0, max: 2, step: 0.1, hint: '1 / k^falloff' },
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
        .then((loaded) => live && setUpload(loaded))
        .catch((error: unknown) => console.error('[leima] could not load image', error));
    }
    return () => {
      live = false;
    };
  }, [v.image]);
  // Clearing the control falls back to the demo without a state round trip.
  const image = (v.image && upload) || DEMO_IMAGE;

  const config: StampConfigInput = {
    seed: v.seed,
    size: isShape(v.shape) ? SHAPES[v.shape] : { width: v.width, height: v.height },
    perforation: {
      gauge: v.gauge,
      holeSize: v.holeSize,
      corners: isCorner(v.corners) ? v.corners : 'offset',
      variation: {
        amount: v.variation,
        wavelength: v.wavelength,
        independence: v.independence,
        squash: v.squash,
        minTilt: v.minTilt,
        maxTilt: v.maxTilt,
        wobble: v.wobble,
        detail: v.detail,
        falloff: v.falloff,
      },
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
  const pxPerMm = v['PNG px/mm'];
  // Refs are written after commit, never during render.
  useEffect(() => {
    latest.current = { config, image, pxPerMm, shadow: v.shadow };
  });

  return (
    <main className="stage" style={{ background: v.background }}>
      <Stamp
        config={config}
        image={image}
        // Fixed padding, so the shadow and gauge never resize the stamp on screen.
        options={{ shadow: v.shadow, padding: STAGE_PADDING_MM }}
        title="Stamp preview"
        className="stamp"
        style={{ height: `calc(78vh * ${v.zoom})` }}
      />
    </main>
  );
}
