'use client';

import { useEffect } from 'react';

/**
 * PROTOTYPE — throwaway. A floating bar that cycles `?variant=`, with ← and →.
 * Never shown in production builds.
 */
export function PrototypeSwitcher<K extends string>({
  variants,
  current,
  onChange,
}: {
  variants: Record<K, string>;
  current: K;
  onChange: (key: K) => void;
}) {
  const keys = Object.keys(variants).filter((k): k is K => k in variants);
  const step = (by: number) => {
    const next = keys[(keys.indexOf(current) + by + keys.length) % keys.length];
    if (next !== undefined) onChange(next);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const { target } = event;
      if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable]'))
        return;
      if (event.key === 'ArrowLeft') step(-1);
      if (event.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (process.env.NODE_ENV === 'production') return null;
  return (
    <div className="proto-switcher" role="toolbar" aria-label="Prototype variants">
      <button type="button" onClick={() => step(-1)} aria-label="Previous variant">
        ←
      </button>
      <span>
        {current} — {variants[current]}
      </span>
      <button type="button" onClick={() => step(1)} aria-label="Next variant">
        →
      </button>
    </div>
  );
}
