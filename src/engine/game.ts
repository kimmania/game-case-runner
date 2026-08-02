import { mulberry32, shuffled } from './rng';
import { expectedValue } from './tiers';
import { effectiveRules, isClutch, offerAtTime, CLUTCH_BONUS } from './clock';
import type { GameResult, GameState, TierConfig } from './types';

/** Elimination schedule: 20 cases, player keeps 1, 18 eliminated over 4 rounds,
 * leaving 2 cases (player + 1) for the timed final swap. One offer per round. */
export const ROUND_PICKS = [6, 5, 4, 3];

/** Minimum fraction of a live offer acceptable as a partial deal. */
export const MIN_PARTIAL = 0.25;

export interface GameOptions {
  tier: TierConfig;
  seed: number;
  relaxed?: boolean;
  /** Multiplier carried in from the streak chain. */
  streakMultiplier?: number;
}

export function createGame(options: GameOptions): GameState {
  const { tier, seed } = options;
  if (tier.values.length !== 20) throw new Error('Tier must define exactly 20 case values');
  const rand = mulberry32(seed);
  return {
    tier,
    rules: effectiveRules(tier, options.relaxed ?? false),
    relaxed: options.relaxed ?? false,
    streakMultiplier: options.streakMultiplier ?? 1,
    rand,
    caseValues: shuffled(tier.values, rand),
    phase: 'pickCase',
    playerCase: null,
    opened: new Array(20).fill(false),
    boardScale: 1,
    banked: 0,
    partialUsed: false,
    round: 0,
    picksLeftInRound: ROUND_PICKS[0],
    offer: null,
    result: null,
  };
}

/** Board EV at game start (unscaled — the fairness yardstick for streaks). */
export function startingEv(state: GameState): number {
  return expectedValue(state.tier.values);
}

function unopenedCases(state: GameState): number[] {
  const out: number[] = [];
  for (let i = 0; i < 20; i++) {
    if (!state.opened[i] && i !== state.playerCase) out.push(i);
  }
  return out;
}

/** Live EV of everything still in play (player case + unopened), at current board scale. */
export function liveEv(state: GameState): number {
  const remaining = unopenedCases(state).map((i) => state.caseValues[i]);
  if (state.playerCase !== null) remaining.push(state.caseValues[state.playerCase]);
  return expectedValue(remaining) * state.boardScale;
}

export function pickPlayerCase(state: GameState, index: number): void {
  if (state.phase !== 'pickCase') throw new Error('Not in pickCase phase');
  if (index < 0 || index >= 20) throw new Error(`Invalid case index: ${index}`);
  state.playerCase = index;
  state.phase = 'eliminate';
}

/**
 * Make an elimination pick. If `elapsedMs` exceeds the pick clock (or no pick
 * is supplied), the pick times out and a random unopened case is auto-opened.
 * Returns the index actually opened.
 */
export function makePick(state: GameState, index: number | null, elapsedMs: number): number {
  if (state.phase !== 'eliminate') throw new Error('Not in eliminate phase');
  const timedOut = elapsedMs > state.rules.pickClockMs || index === null;
  let chosen: number;
  if (timedOut) {
    const candidates = unopenedCases(state);
    chosen = candidates[Math.floor(state.rand() * candidates.length)];
  } else {
    if (index === state.playerCase) throw new Error('Cannot open your own case');
    if (index < 0 || index >= 20 || state.opened[index]) {
      throw new Error(`Case ${index} is not available`);
    }
    chosen = index;
  }
  state.opened[chosen] = true;
  state.picksLeftInRound -= 1;
  if (state.picksLeftInRound === 0) {
    state.offer = { base: liveEv(state) * state.tier.offerCurve[state.round], round: state.round };
    state.phase = 'offer';
  }
  return chosen;
}

/** Current value of the live offer at the given elapsed time (0 if expired/none). */
export function currentOfferValue(state: GameState, elapsedMs: number): number {
  if (!state.offer) return 0;
  return offerAtTime(state.offer.base, state.rules.decayWindowMs, state.rules.decayFloor, elapsedMs);
}

function advanceAfterOffer(state: GameState): void {
  state.offer = null;
  state.round += 1;
  if (state.round >= ROUND_PICKS.length) {
    state.phase = 'finalSwap';
  } else {
    state.picksLeftInRound = ROUND_PICKS[state.round];
    state.phase = 'eliminate';
  }
}

/**
 * Accept `fraction` (0.25–1) of the live offer at `elapsedMs` into the window.
 * - fraction 1: full deal, game ends.
 * - fraction < 1: partial deal — once per game. The accepted portion is banked
 *   safe; every remaining board value (including the player case) scales down
 *   by (1 - fraction); play continues and later offers use the scaled board.
 * Throws if the offer has expired.
 */
export function acceptOffer(state: GameState, elapsedMs: number, fraction = 1): void {
  if (state.phase !== 'offer' || !state.offer) throw new Error('No live offer');
  const value = currentOfferValue(state, elapsedMs);
  if (value <= 0) throw new Error('Offer expired');
  const clutch = isClutch(state.rules.decayWindowMs, elapsedMs);
  const accepted = value * (clutch ? CLUTCH_BONUS : 1);

  if (fraction < 1) {
    if (state.partialUsed) throw new Error('Partial deal already used this game');
    if (fraction < MIN_PARTIAL) throw new Error(`Partial must be at least ${MIN_PARTIAL * 100}%`);
    state.banked += accepted * fraction;
    state.boardScale *= 1 - fraction;
    state.partialUsed = true;
    advanceAfterOffer(state);
    return;
  }
  finish(state, 'deal', accepted, clutch, false);
}

/** Let the offer expire (or decline it) and play on. */
export function declineOffer(state: GameState): void {
  if (state.phase !== 'offer') throw new Error('No live offer');
  advanceAfterOffer(state);
}

/**
 * Timed final-swap decision. Timeout (elapsed > pick clock) = keep your case.
 * Then reveal: winnings are the (scaled) player case value plus any banked partial.
 */
export function finalSwap(state: GameState, swap: boolean, elapsedMs: number): void {
  if (state.phase !== 'finalSwap') throw new Error('Not in finalSwap phase');
  const timedOut = elapsedMs > state.rules.pickClockMs;
  const doSwap = swap && !timedOut;
  if (doSwap) {
    const other = unopenedCases(state)[0];
    const pv = state.caseValues[state.playerCase!];
    state.caseValues[state.playerCase!] = state.caseValues[other];
    state.caseValues[other] = pv;
  }
  const caseValue = state.caseValues[state.playerCase!] * state.boardScale;
  finish(state, 'hold', caseValue + state.banked, false, doSwap);
}

function finish(
  state: GameState,
  outcome: 'deal' | 'hold',
  rawWinnings: number,
  clutch: boolean,
  swappedAtEnd: boolean,
): void {
  const totalRaw = outcome === 'deal' ? rawWinnings + state.banked : rawWinnings;
  const result: GameResult = {
    outcome,
    payout: totalRaw * state.streakMultiplier,
    rawWinnings: totalRaw,
    caseValue: state.caseValues[state.playerCase!] * state.boardScale,
    offerTaken: outcome === 'deal' ? rawWinnings : null,
    clutch,
    swappedAtEnd,
    aboveEv: totalRaw > startingEv(state),
  };
  state.result = result;
  state.phase = 'done';
}
