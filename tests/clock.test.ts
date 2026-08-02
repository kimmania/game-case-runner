import { describe, it, expect } from 'vitest';
import { effectiveRules, offerAtTime, isClutch, CLUTCH_BONUS } from '../src/engine/clock';
import { getTier } from '../src/engine/tiers';

describe('offer decay curve', () => {
  // tier 2: 15s window, 70% floor
  const base = 10000;
  const windowMs = 15000;
  const floor = 0.7;

  it('is full base at t=0', () => {
    expect(offerAtTime(base, windowMs, floor, 0)).toBeCloseTo(base);
  });

  it('is halfway between base and floor at mid-window', () => {
    expect(offerAtTime(base, windowMs, floor, 7500)).toBeCloseTo(base * 0.85);
  });

  it('reaches the floor exactly at window end and expires', () => {
    expect(offerAtTime(base, windowMs, floor, windowMs - 1)).toBeCloseTo(base * floor, 0);
    expect(offerAtTime(base, windowMs, floor, windowMs)).toBe(0);
    expect(offerAtTime(base, windowMs, floor, windowMs + 5000)).toBe(0);
  });

  it('clamps negative elapsed to t=0', () => {
    expect(offerAtTime(base, windowMs, floor, -100)).toBeCloseTo(base);
  });
});

describe('clutch window', () => {
  it('is clutch only in the final 3s before expiry', () => {
    expect(isClutch(15000, 11999)).toBe(false);
    expect(isClutch(15000, 12000)).toBe(true);
    expect(isClutch(15000, 14999)).toBe(true);
    expect(isClutch(15000, 15000)).toBe(false);
    expect(CLUTCH_BONUS).toBe(1.05);
  });
});

describe('relaxed mode rules', () => {
  it('doubles clocks and flattens decay to a 90% floor', () => {
    const tier4 = getTier(4); // 8s clock, 12s window, 50% floor
    const relaxed = effectiveRules(tier4, true);
    expect(relaxed.pickClockMs).toBe(16000);
    expect(relaxed.decayWindowMs).toBe(24000);
    expect(relaxed.decayFloor).toBe(0.9);
  });

  it('keeps a floor already above 90% untouched', () => {
    const relaxed = effectiveRules(getTier(1), true); // floor 0.8 -> 0.9
    expect(relaxed.decayFloor).toBe(0.9);
    const normal = effectiveRules(getTier(1), false);
    expect(normal.decayFloor).toBe(0.8);
    expect(normal.pickClockMs).toBe(12000);
  });
});
