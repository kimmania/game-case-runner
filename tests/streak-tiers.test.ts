import { describe, it, expect } from 'vitest';
import { initialStreak, nextStreak, streakMultiplierFor, STREAK_LADDER } from '../src/engine/streak';
import { TIERS, getTier } from '../src/engine/tiers';

describe('streak multiplier', () => {
  it('builds the ladder on consecutive above-EV finishes', () => {
    let s = initialStreak();
    expect(s.multiplier).toBe(1);
    s = nextStreak(s, 1000, true);
    expect(s.chain).toBe(1);
    expect(s.multiplier).toBe(1.1);
    s = nextStreak(s, 1000, true);
    expect(s.multiplier).toBe(1.25);
    s = nextStreak(s, 1000, true);
    expect(s.multiplier).toBe(1.5);
    expect(s.runTotal).toBe(3000);
  });

  it('resets chain, multiplier and run total on a below-EV finish', () => {
    let s = initialStreak();
    s = nextStreak(s, 1000, true);
    s = nextStreak(s, 1000, true);
    s = nextStreak(s, 500, false);
    expect(s).toEqual(initialStreak());
  });

  it('caps the ladder at its top rung', () => {
    const top = STREAK_LADDER[STREAK_LADDER.length - 1];
    expect(streakMultiplierFor(99)).toBe(top);
  });
});

describe('tiers data', () => {
  it('has 4 tiers with 20 values each and correct spec §4.2 clocks', () => {
    expect(TIERS).toHaveLength(4);
    for (const t of TIERS) {
      expect(t.values).toHaveLength(20);
      expect(Math.max(...t.values)).toBe(t.topPrize);
    }
    expect(getTier(1).pickClockMs).toBe(12000);
    expect(getTier(4).pickClockMs).toBe(8000);
    expect(getTier(1).decayFloor).toBe(0.8);
    expect(getTier(4).decayFloor).toBe(0.5);
    expect(getTier(3).decayWindowMs).toBe(12000);
    expect(getTier(4).chainTarget).toBe(375000);
  });
});
