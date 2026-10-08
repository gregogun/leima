import {
  PRESETS,
  createLayout,
  renderSvg,
  stampPath,
  type CornerMode,
  type StampConfigInput,
  type StampImage,
  type StampLayout,
} from '@leima/core';
import { computeDigests } from './digests.ts';
import expected from './expected-digests.json';
import {
  LAYERS,
  LAYER_LABELS,
  NO_PROFILE_COLOUR,
  overlayMarkup,
  profileColour,
  type Layer,
} from './overlays.ts';
import { calibrationImage } from './test-image.ts';

// --- State, mirrored to the URL hash so a view can be linked ----------------

const VIEWS = {
  seeds: 'Seeds',
  extremes: 'Gauge × wear',
  corners: 'Corners',
  determinism: 'Determinism',
} as const;
type ViewName = keyof typeof VIEWS;

const CORNER_MODES: readonly CornerMode[] = ['offset', 'hole', 'solid'];
const PRINT_AREAS = ['bleed', 'bordered'] as const;
type PrintAreaName = (typeof PRINT_AREAS)[number];
const IMAGES = { calibration: 'Calibration card', none: 'No image', file: 'Local file…' } as const;
type ImageName = keyof typeof IMAGES;

type State = {
  view: ViewName;
  preset: string;
  corners: CornerMode;
  print: PrintAreaName;
  layers: Set<Layer>;
  image: ImageName;
  /** The stamp opened large, as its config. */
  focus: StampConfigInput | null;
};

const isView = (v: string | null): v is ViewName => v !== null && v in VIEWS;
const isCorner = (v: string | null): v is CornerMode => CORNER_MODES.some((c) => c === v);
const isPrint = (v: string | null): v is PrintAreaName => PRINT_AREAS.some((p) => p === v);
const isLayer = (v: string): v is Layer => LAYERS.some((l) => l === v);
const isImage = (v: string | null): v is ImageName => v !== null && v in IMAGES;

function readHash(): State {
  const params = new URLSearchParams(location.hash.slice(1));
  const view = params.get('view');
  const preset = params.get('preset');
  const corners = params.get('corners');
  const print = params.get('print');
  const image = params.get('image');
  let focus: StampConfigInput | null = null;
  try {
    const raw = params.get('focus');
    // The core normalises whatever comes back, so a hand-edited link still renders.
    if (raw) focus = parseConfig(raw);
  } catch {
    focus = null;
  }
  return {
    view: isView(view) ? view : 'seeds',
    preset: preset !== null && preset in PRESETS ? preset : 'lightly worn',
    corners: isCorner(corners) ? corners : 'offset',
    print: isPrint(print) ? print : 'bleed',
    layers: new Set((params.get('layers') ?? '').split(',').filter(isLayer)),
    // A local file does not survive a reload.
    image: isImage(image) && image !== 'file' ? image : 'calibration',
    focus,
  };
}

function parseConfig(raw: string): StampConfigInput {
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null) throw new Error('not a config');
  return value;
}

function writeHash(): void {
  const params = new URLSearchParams({
    view: state.view,
    preset: state.preset,
    corners: state.corners,
    print: state.print,
    layers: [...state.layers].join(','),
    image: state.image,
  });
  if (state.focus) params.set('focus', JSON.stringify(state.focus));
  history.replaceState(null, '', `#${params.toString()}`);
}

const state = readHash();
const calibration = calibrationImage();
let fileImage: StampImage | null = null;

function currentImage(): StampImage | null {
  if (state.image === 'none') return null;
  if (state.image === 'file') return fileImage ?? calibration;
  return calibration;
}

// --- Grids ------------------------------------------------------------------

type Cell = { label: string; config: StampConfigInput };
type Grid = { columns: number; note: string; cells: Cell[] };

function baseConfig(): StampConfigInput {
  return {
    ...PRESETS[state.preset],
    perforation: { corners: state.corners },
    print: state.print === 'bleed' ? { area: 'bleed' } : { area: 'bordered', margin: 1.8 },
  };
}

function grid(view: Exclude<ViewName, 'determinism'>): Grid {
  const base = baseConfig();
  if (view === 'seeds') {
    return {
      columns: 6,
      note: 'Seeds 1–24 at the chosen preset, corners and print area.',
      cells: Array.from({ length: 24 }, (_, i) => ({
        label: `seed ${i + 1}`,
        config: { ...base, seed: i + 1 },
      })),
    };
  }
  if (view === 'extremes') {
    const cells: Cell[] = [];
    for (const gauge of [8, 11, 14, 17.5]) {
      for (const wear of [0, 0.38, 0.7, 1]) {
        cells.push({
          label: `perf ${gauge} · wear ${wear}`,
          config: { ...base, seed: 7, wear, perforation: { ...base.perforation, gauge } },
        });
      }
    }
    return { columns: 4, note: 'Rows are gauge, columns are wear. Seed 7.', cells };
  }
  const variants: [string, StampConfigInput][] = [
    ['square · bleed', { size: { width: 26, height: 26 }, print: { area: 'bleed' } }],
    ['square · bordered', { size: { width: 26, height: 26 }, print: { area: 'bordered' } }],
    ['portrait · bleed', { size: { width: 24, height: 30 }, print: { area: 'bleed' } }],
    ['landscape · bordered', { size: { width: 30, height: 24 }, print: { area: 'bordered' } }],
  ];
  const cells: Cell[] = [];
  for (const corners of CORNER_MODES) {
    for (const [label, variant] of variants) {
      cells.push({
        label: `${corners} · ${label}`,
        config: { ...base, ...variant, seed: 7, perforation: { corners } },
      });
    }
  }
  return {
    columns: 4,
    note: 'Rows are corner modes; columns are shape and print area. Seed 7, preset wear.',
    cells,
  };
}

// --- Stamp markup -----------------------------------------------------------

type StampOptions = { scale: number; idPrefix?: string; zoomCorner?: boolean };

function stampMarkup(config: StampConfigInput, layout: StampLayout, opts: StampOptions): string {
  let svg = renderSvg(config, currentImage(), {
    scale: opts.scale,
    ...(opts.idPrefix ? { idPrefix: opts.idPrefix } : {}),
  });
  svg = svg.replace('</svg>', `${overlayMarkup(layout, state.layers)}</svg>`);
  if (opts.zoomCorner) svg = zoomTopLeft(svg, 4);
  return svg;
}

/** Re-frames the root `<svg>` on its top-left corner at `zoom`x, keeping the pixel size. */
function zoomTopLeft(svg: string, zoom: number): string {
  return svg.replace(/^<svg[^>]*>/, (tag) => {
    const box = /viewBox="([^"]+)"/.exec(tag)?.[1]?.split(' ').map(Number) ?? [];
    const [, , w = 0, h = 0] = box;
    const vw = w / zoom;
    const vh = h / zoom;
    // Framed as the prototype did: the trim corner a fifth of the way in.
    return tag.replace(/viewBox="[^"]+"/, `viewBox="${-vw * 0.2} ${-vh * 0.2} ${vw} ${vh}"`);
  });
}

// --- Rendering --------------------------------------------------------------

function must<T extends Element>(selector: string, type: new () => T): T {
  const el = document.querySelector(selector);
  if (!(el instanceof type)) throw new Error(`lab: missing ${selector}`);
  return el;
}

const nav = must('#views', HTMLElement);
const controls = must('#controls', HTMLElement);
const focusPanel = must('#focus', HTMLElement);
const main = must('#grid', HTMLElement);

function segmented<T extends string>(
  name: string,
  options: readonly T[] | Record<T, string>,
  current: T,
): string {
  const entries: [string, string][] = Array.isArray(options)
    ? options.map((o) => [o, o])
    : Object.entries(options);
  return (
    `<div class="seg" role="group" aria-label="${name}">` +
    entries
      .map(
        ([value, label]) =>
          `<button type="button" data-${name}="${value}" aria-pressed="${value === current}">${label}</button>`,
      )
      .join('') +
    `</div>`
  );
}

function renderChrome(): void {
  nav.innerHTML = segmented('view', VIEWS, state.view);
  const presetOptions = Object.keys(PRESETS)
    .map((p) => `<option${p === state.preset ? ' selected' : ''}>${p}</option>`)
    .join('');
  const layerBoxes = LAYERS.map(
    (layer) =>
      `<label class="check"><input type="checkbox" data-layer="${layer}"${state.layers.has(layer) ? ' checked' : ''}> ${LAYER_LABELS[layer]}</label>`,
  ).join('');
  const legend = state.layers.has('spans')
    ? `<div class="legend">${['clean', 'step', 'nibble', 'spur', 'lean', 'frayed']
        .map((p) => `<span><i style="background:${profileColour(p)}"></i>${p}</span>`)
        .join(
          '',
        )}<span><i style="background:${NO_PROFILE_COLOUR}"></i>none</span><span class="muted">dashed = pulled</span></div>`
    : '';
  controls.hidden = state.view === 'determinism';
  controls.innerHTML =
    `<label class="field">Preset <select data-preset>${presetOptions}</select></label>` +
    // The corners view sets its own corner modes and print areas.
    (state.view === 'corners'
      ? ''
      : `<div class="field">Corners ${segmented('corners', CORNER_MODES, state.corners)}</div>` +
        `<div class="field">Print ${segmented('print', PRINT_AREAS, state.print)}</div>`) +
    `<label class="field">Image <select data-image>${Object.entries(IMAGES)
      .map(([k, v]) => `<option value="${k}"${k === state.image ? ' selected' : ''}>${v}</option>`)
      .join('')}</select></label>` +
    `<input type="file" accept="image/*" data-file hidden>` +
    `<div class="field layers">${layerBoxes}</div>` +
    legend;
}

function renderGrid(): void {
  if (state.view === 'determinism') {
    renderDeterminism();
    return;
  }
  const { columns, note, cells } = grid(state.view);
  main.style.setProperty('--columns', String(columns));
  main.innerHTML =
    `<p class="note">${note} Click a stamp to inspect it.</p><div class="cells">` +
    cells
      .map(({ label, config }) => {
        const layout = createLayout(config);
        return `<button type="button" class="cell" data-focus="${escapeHtml(JSON.stringify(config)).replaceAll('"', '&quot;')}">${stampMarkup(config, layout, { scale: 6 })}<span>${label}</span></button>`;
      })
      .join('') +
    `</div>`;
}

function renderFocus(): void {
  const config = state.focus;
  focusPanel.hidden = config === null || state.view === 'determinism';
  if (!config || focusPanel.hidden) {
    focusPanel.innerHTML = '';
    return;
  }
  const layout = createLayout(config);
  const { fibres } = stampPath(layout);
  const mm = (units: number) => (units / 10).toFixed(3);
  const rows = layout.edges
    .map((e) => {
      const pulled = e.teeth.filter((t) => t.pull > 0).length;
      return `<tr><td>${e.side}</td><td>${e.holes.length}</td><td>${e.teeth.length}</td><td>${mm(e.step)}</td><td>${pulled}</td><td>${e.cornerStart ? mm(e.cornerStart) : '–'}</td></tr>`;
    })
    .join('');
  const tally = new Map<string, number>();
  for (const e of layout.edges) {
    for (const t of e.teeth)
      tally.set(t.profile ?? 'none', (tally.get(t.profile ?? 'none') ?? 0) + 1);
  }
  const { printRect: r } = layout;
  focusPanel.innerHTML =
    `<div class="focus-head"><h2>Inspect</h2><code>${escapeHtml(JSON.stringify(layout.config))}</code><button type="button" data-close>Close</button></div>` +
    `<div class="focus-body">` +
    `<figure>${stampMarkup(config, layout, { scale: 18, idPrefix: 'focus-full' })}<figcaption>1×</figcaption></figure>` +
    `<figure>${stampMarkup(config, layout, { scale: 18, idPrefix: 'focus-corner', zoomCorner: true })}<figcaption>4× top-left corner</figcaption></figure>` +
    `<div class="stats">` +
    `<table><thead><tr><th>edge</th><th>holes</th><th>teeth</th><th>step mm</th><th>pulled</th><th>corner r mm</th></tr></thead><tbody>${rows}</tbody></table>` +
    `<dl>` +
    `<dt>pitch</dt><dd>${mm(layout.pitch)} mm</dd>` +
    `<dt>print rect</dt><dd>${mm(r.x)}, ${mm(r.y)} · ${mm(r.width)} × ${mm(r.height)} mm</dd>` +
    `<dt>fibres</dt><dd>${fibres.length} strokes</dd>` +
    `<dt>profiles</dt><dd>${[...tally].map(([p, c]) => `${p} ${c}`).join(' · ')}</dd>` +
    `</dl></div></div>`;
}

function renderDeterminism(): void {
  const started = performance.now();
  const actual = computeDigests();
  const elapsed = performance.now() - started;
  const reference: Readonly<Record<string, string>> = expected;
  const keys = Object.keys(reference);
  const failures = keys.filter((k) => actual[k] !== reference[k]);
  const extra = Object.keys(actual).filter((k) => !(k in reference));
  const ok = failures.length === 0 && extra.length === 0;
  main.style.removeProperty('--columns');
  main.innerHTML =
    `<div class="verdict ${ok ? 'pass' : 'fail'}">` +
    `<strong>${ok ? 'Match' : 'Mismatch'}</strong>: ${keys.length - failures.length} of ${keys.length} configs give the same outline and SVG bytes as Node` +
    (extra.length
      ? `, and ${extra.length} configs have no Node reference (rerun the lab tests)`
      : '') +
    `. Computed in ${elapsed.toFixed(0)} ms.</div>` +
    `<p class="note">Digests are FNV-1a and length of the outline path, then of the whole SVG with the calibration card. ` +
    `The Node side is <code>apps/lab/src/expected-digests.json</code>, written by the lab's Vitest suite.</p>` +
    `<p class="note">${escapeHtml(navigator.userAgent)}</p>` +
    `<table class="digests"><thead><tr><th>seed/corners/wear/print</th><th>browser</th><th>node</th></tr></thead><tbody>` +
    keys
      .map(
        (k) =>
          `<tr class="${actual[k] === reference[k] ? '' : 'bad'}"><td>${k}</td><td>${actual[k] ?? '–'}</td><td>${reference[k] ?? '–'}</td></tr>`,
      )
      .join('') +
    `</tbody></table>`;
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function render(): void {
  writeHash();
  renderChrome();
  renderFocus();
  renderGrid();
}

// --- Events -----------------------------------------------------------------

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('button');
  if (!button) return;
  const { view, corners, print, focus } = button.dataset;
  if (view !== undefined && isView(view)) {
    state.view = view;
  } else if (corners && isCorner(corners)) {
    state.corners = corners;
  } else if (print && isPrint(print)) {
    state.print = print;
  } else if (focus) {
    state.focus = parseConfig(focus);
    render();
    focusPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  } else if ('close' in button.dataset) {
    state.focus = null;
  } else {
    return;
  }
  render();
});

document.addEventListener('change', (event) => {
  const target = event.target;
  if (target instanceof HTMLSelectElement && 'preset' in target.dataset) {
    state.preset = target.value;
  } else if (target instanceof HTMLSelectElement && 'image' in target.dataset) {
    if (target.value === 'file') {
      must('[data-file]', HTMLInputElement).click();
      return;
    }
    if (isImage(target.value)) state.image = target.value;
  } else if (target instanceof HTMLInputElement && target.dataset['layer']) {
    const layer = target.dataset['layer'];
    if (isLayer(layer)) {
      if (target.checked) state.layers.add(layer);
      else state.layers.delete(layer);
    }
  } else if (target instanceof HTMLInputElement && 'file' in target.dataset) {
    const file = target.files?.[0];
    if (file) void loadFile(file);
    return;
  } else {
    return;
  }
  render();
});

/** A local image becomes an object URL; the core gets it as data, like any consumer would pass it. */
async function loadFile(file: File): Promise<void> {
  const href = URL.createObjectURL(file);
  const img = new Image();
  img.src = href;
  await img.decode();
  if (fileImage) URL.revokeObjectURL(fileImage.href);
  fileImage = { href, width: img.naturalWidth, height: img.naturalHeight };
  state.image = 'file';
  render();
}

window.addEventListener('hashchange', () => {
  Object.assign(state, readHash());
  render();
});

render();
