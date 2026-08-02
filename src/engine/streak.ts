/** Multiplier ladder by consecutive above-EV finishes (index = chain length, capped). */
export const STREAK_LADDER = [1, 1.1, 1.25, 1.5, 1.75, 2];

export interface StreakState {
  /** Consecutive games finished above starting EV. */
  chain: number;
  /** Multiplier applied to the NEXT game's winnings. */
  multiplier: number;
  /** Total banked across the current run. */
  runTotal: number;
}

export function initialStreak(): StreakState {
  return { chain: 0, multiplier: 1, runTotal: 0 };
}

export function streakMultiplierFor(chain: number): number {
  return STREAK_LADDER[Math.min(chain, STREAK_LADDER.length - 1)];
}

/**
 * Update the streak after a finished game.
 * Above starting EV: chain grows, multiplier climbs the ladder.
 * Below EV: chain and multiplier reset (run total keeps accumulating
 * only while the chain is alive — a reset zeroes it, per plan "run
 * score = total banked across the chain").
 */
export function nextStreak(
  state: StreakState,
  payout: number,
  aboveEv: boolean,
): StreakState {
  if (aboveEv) {
    const chain = state.chain + 1;
    return {
      chain,
      multiplier: streakMultiplierFor(chain),
      runTotal: state.runTotal + payout,
    };
  }
  return initialStreak();
}
