import {
  createLayout,
  hashString,
  renderSvg,
  stampPath,
  type CornerMode,
  type StampConfigInput,
} from '@leima/core';
import { calibrationImage } from './test-image.ts';

/**
 * Acceptance check: the same seed and config give a byte-identical path string
 * in Node and in the browser. `digests.test.ts` writes the Node digests to
 * `expected-digests.json`; the lab recomputes them in whatever browser opens it
 * and compares.
 */
const SEEDS = [1, 7, 42, 1234];
const CORNERS: readonly CornerMode[] = ['offset', 'hole', 'solid'];
const WEARS = [0, 0.38, 1];
const PRINTS = ['bleed', 'bordered'] as const;

export function digestMatrix(): [key: string, config: StampConfigInput][] {
  const cases: [string, StampConfigInput][] = [];
  for (const seed of SEEDS) {
    for (const corners of CORNERS) {
      for (const wear of WEARS) {
        for (const area of PRINTS) {
          cases.push([
            `${seed}/${corners}/${wear}/${area}`,
            {
              seed,
              wear,
              perforation: { corners },
              print: area === 'bleed' ? { area } : { area, margin: 1.8 },
            },
          ]);
        }
      }
    }
  }
  return cases;
}

const digest = (value: string) =>
  `${hashString(value).toString(16).padStart(8, '0')}:${value.length}`;

/**
 * Outline digest, then whole-SVG digest. The SVG carries the calibration image
 * so the print rect, pattern and clip geometry are covered too.
 */
export function computeDigests(): Record<string, string> {
  const image = calibrationImage();
  const out: Record<string, string> = {};
  for (const [key, config] of digestMatrix()) {
    const { outline } = stampPath(createLayout(config));
    out[key] = `${digest(outline)} ${digest(renderSvg(config, image))}`;
  }
  return out;
}
