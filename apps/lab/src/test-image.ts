import type { StampImage } from '@leima/core';

/**
 * A calibration card, so the bench needs no binary fixture. A 1 mm grid at the
 * default stamp size, a centre cross and coloured corner blocks make the cover
 * crop and the print rect readable at a glance.
 */
function calibrationSvg(width: number, height: number): string {
  const cell = width / 26;
  let grid = '';
  for (let x = 0; x <= width; x += cell) {
    grid += `M${x.toFixed(2)} 0V${height}`;
  }
  for (let y = 0; y <= height; y += cell) {
    grid += `M0 ${y.toFixed(2)}H${width}`;
  }
  const block = cell * 4;
  const cx = width / 2;
  const cy = height / 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#2f6f8f"/><stop offset=".55" stop-color="#d9824b"/><stop offset="1" stop-color="#7a2f45"/>` +
    `</linearGradient></defs>` +
    `<rect width="${width}" height="${height}" fill="url(#g)"/>` +
    `<path d="${grid}" stroke="#fff" stroke-opacity=".28" stroke-width="1"/>` +
    `<rect width="${block}" height="${block}" fill="#f2d33b"/>` +
    `<rect x="${width - block}" width="${block}" height="${block}" fill="#3bd16f"/>` +
    `<rect x="${width - block}" y="${height - block}" width="${block}" height="${block}" fill="#3b6ff2"/>` +
    `<rect y="${height - block}" width="${block}" height="${block}" fill="#f23b8c"/>` +
    `<path d="M${cx - cell * 3} ${cy}H${cx + cell * 3}M${cx} ${cy - cell * 3}V${cy + cell * 3}" stroke="#fff" stroke-width="${cell / 4}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${cell * 5}" fill="none" stroke="#fff" stroke-width="${cell / 6}"/>` +
    `</svg>`
  );
}

export function calibrationImage(width = 780, height = 780): StampImage {
  return {
    href: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(calibrationSvg(width, height))}`,
    width,
    height,
  };
}
