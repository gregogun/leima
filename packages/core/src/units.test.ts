import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, PRESETS, SHAPES, pitchMm, pitchUnits, roundCoord } from './index.js';

describe('units', () => {
  it('derives pitch from gauge', () => {
    expect(pitchMm(14)).toBeCloseTo(1.4286, 4);
    expect(pitchMm(10)).toBe(2);
    expect(pitchUnits(10)).toBe(20);
  });

  it('rounds coordinates to 2 decimals', () => {
    expect(roundCoord(1.23456)).toBe(1.23);
    expect(roundCoord(-0.005)).toBe(-0);
  });
});

describe('defaults', () => {
  it('matches the brief: seed 7, gauge 14, wear 0.38, square, bleed', () => {
    expect(DEFAULT_CONFIG.seed).toBe(7);
    expect(DEFAULT_CONFIG.perforation.gauge).toBe(14);
    expect(DEFAULT_CONFIG.perforation.holeSize).toBe(0.55);
    expect(DEFAULT_CONFIG.wear).toBe(0.38);
    expect(DEFAULT_CONFIG.size).toEqual(SHAPES.square);
    expect(DEFAULT_CONFIG.print).toEqual({ area: 'bleed' });
  });

  it('keeps the config JSON-serialisable, so it round-trips through a URL', () => {
    expect(JSON.parse(JSON.stringify(DEFAULT_CONFIG))).toEqual(DEFAULT_CONFIG);
  });

  it('presets are partial configs', () => {
    for (const preset of Object.values(PRESETS)) {
      expect(JSON.parse(JSON.stringify(preset))).toEqual(preset);
    }
  });
});
