import type { EffectiveRules, TierConfig } from './types';

/** Relaxed mode: clocks doubled, decay flattened to a 90% floor. */
export const RELAXED_DECAY_FLOOR = 0.9;

/** Final slice of the decay window that earns the clutch bonus. */
export const CLUTCH_WINDOW_MS = 3000;

/** +5% for accepting an offer in its final 3 seconds. */
export const CLUTCH_BONUS = 1.05;

/** Resolve tier rules under the relaxed-mode flag. */
export function effectiveRules(tier: TierConfig, relaxed: boolean): EffectiveRules {
  if (!relaxed) {
    return {
      pickClockMs: tier.pickClockMs,
      decayWindowMs: tier.decayWindowMs,
      decayFloor: tier.decayFloor,
    };
  }
  return {
    pickClockMs: tier.pickClockMs * 2,
    decayWindowMs: tier.decayWindowMs * 2,
    decayFloor: Math.max(tier.decayFloor, RELAXED_DECAY_FLOOR),
  };
}

/**
 * Offer value at a point in the decay window. Pure function of elapsed time:
 * linear decay from `base` at t=0 to `base * floor` at t=windowMs, clamped
 * outside the window. Expired offers return 0 — once it expires, it's gone.
 */
export function offerAtTime(
  base: number,
  windowMs: number,
  floor: number,
  elapsedMs: number,
): number {
  const t = Math.max(0, elapsedMs);
  if (t >= windowMs) return 0;
  const progress = t / windowMs;
  return base * (1 - progress * (1 - floor));
}

/** True when elapsed time is inside the final 3s of the decay window. */
export function isClutch(windowMs: number, elapsedMs: number): boolean {
  return elapsedMs >= windowMs - CLUTCH_WINDOW_MS && elapsedMs < windowMs;
}
