import type { StampImage } from '@leima/core';

/**
 * A generated placeholder print, so the editor opens on something stamp-like
 * without shipping artwork: flat sky, a two-tone peak and dark foothills.
 */
const WIDTH = 1200;
const HEIGHT = 1500;

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">` +
  `<rect width="${WIDTH}" height="${HEIGHT}" fill="#3a63c4"/>` +
  `<path d="M0 980L170 860L300 900L470 640L560 690L660 470L720 440L790 520L880 560L1010 760L1200 850V1500H0Z" fill="#ecebe4"/>` +
  `<path d="M660 470L720 440L790 520L760 640L840 820L720 760L700 900L620 800L560 690Z" fill="#1d1d1f"/>` +
  `<path d="M880 560L1010 760L1200 850V960L1040 900L960 820Z" fill="#1d1d1f"/>` +
  `<path d="M0 1120L220 1060L420 1120L640 1040L860 1110L1200 1050V1500H0Z" fill="#1d1d1f"/>` +
  `</svg>`;

export const DEMO_IMAGE: StampImage = {
  href: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  width: WIDTH,
  height: HEIGHT,
};
