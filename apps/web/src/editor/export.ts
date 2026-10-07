import { renderSvg, type StampConfigInput, type StampImage } from '@leima/core';

/**
 * Client-side export. Both formats start from `renderSvg`, the same string the
 * server will rasterise in v1.1, so an export matches what the editor shows.
 * The image must be a data URI: a blob URL would die with the page, and an SVG
 * drawn to a canvas cannot load anything external.
 */
export function downloadSvg(
  config: StampConfigInput,
  image: StampImage | null,
  shadow: boolean,
): void {
  const svg = renderSvg(config, image, { shadow, title: 'Stamp' });
  download(new Blob([svg], { type: 'image/svg+xml' }), `stamp-${seedOf(config)}.svg`);
}

/** Rasterises at `pxPerMm` (40 gives a 26 mm stamp about 1100 px across). */
export async function downloadPng(
  config: StampConfigInput,
  image: StampImage | null,
  pxPerMm: number,
  shadow: boolean,
): Promise<void> {
  const svg = renderSvg(config, image, { scale: pxPerMm, shadow, title: 'Stamp' });
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('editor: no 2d canvas context');
  context.drawImage(img, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('editor: PNG encoding failed');
  download(blob, `stamp-${seedOf(config)}@${pxPerMm}pxmm.png`);
}

/** Reads a picked file into a data URI with its intrinsic size, so the core can cover-fit it exactly. */
export async function loadImage(src: string): Promise<StampImage> {
  const blob = await (await fetch(src)).blob();
  const href = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('not a data URI'));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });
  const img = new Image();
  img.src = href;
  await img.decode();
  return { href, width: img.naturalWidth, height: img.naturalHeight };
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function seedOf(config: StampConfigInput): number {
  return config.seed ?? 0;
}
