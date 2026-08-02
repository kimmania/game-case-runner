export interface TierConfig {
  id: number;
  name: string;
  theme: string;
  topPrize: number;
  /** 20 case values. */
  values: number[];
  /** Base offer as fraction of live EV, one entry per round. */
  offerCurve: number[];
  /** Milliseconds allowed per elimination pick. */
  pickClockMs: number;
  /** Milliseconds over which an offer decays to its floor. */
  decayWindowMs: number;
  /** Fraction of base offer remaining at the end of the decay window. */
  decayFloor: number;
  /** Chain total needed for a run win. */
  chainTarget: number;
}

/** Clocks/decay after applying the relaxed-mode flag (plan: relaxed scores flagged separately). */
export interface EffectiveRules {
  pickClockMs: number;
  decayWindowMs: number;
  decayFloor: number;
}

export type Phase = 'pickCase' | 'eliminate' | 'offer' | 'finalSwap' | 'done';

export interface LiveOffer {
  /** Offer value at t=0 of the decay window (already board-scaled, pre-multiplier). */
  base: number;
  /** Round index this offer belongs to. */
  round: number;
}

export interface GameState {
  tier: TierConfig;
  rules: EffectiveRules;
  relaxed: boolean;
  /** Multiplier carried in from the streak chain (applied to winnings). */
  streakMultiplier: number;
  rand: () => number;
  /** Case values as dealt (index = case number). */
  caseValues: number[];
  phase: Phase;
  playerCase: number | null;
  opened: boolean[];
  /** Proportional scaling of the board after a partial deal (1 = full stakes). */
  boardScale: number;
  /** Banked, safe winnings from a partial deal (pre-multiplier). */
  banked: number;
  partialUsed: boolean;
  round: number;
  /** Picks remaining in the current elimination round. */
  picksLeftInRound: number;
  offer: LiveOffer | null;
  result: GameResult | null;
}

export interface GameResult {
  outcome: 'deal' | 'hold';
  /** Total credited to the run: (winnings * streakMultiplier), banked included. */
  payout: number;
  /** Raw winnings before streak multiplier (deal amount + banked, or scaled case value + banked). */
  rawWinnings: number;
  /** Player case value at final board scale. */
  caseValue: number;
  offerTaken: number | null;
  /** True if the accepted offer was in its final 3s (clutch bonus applied). */
  clutch: boolean;
  swappedAtEnd: boolean;
  /** True if the game finished above the board's starting EV. */
  aboveEv: boolean;
}
