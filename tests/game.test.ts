import { describe, it, expect } from 'vitest';
import {
  createGame, pickPlayerCase, makePick, acceptOffer, declineOffer, finalSwap,
  liveEv, startingEv, currentOfferValue, ROUND_PICKS, MIN_PARTIAL,
} from '../src/engine/game';
import { getTier } from '../src/engine/tiers';

const tier1 = getTier(1);

function startedGame(seed = 7, relaxed = false) {
  const s = createGame({ tier: tier1, seed, relaxed });
  pickPlayerCase(s, 0);
  return s;
}

/** Play to the first offer, always picking the lowest unopened case. */
function playToOffer(s: ReturnType<typeof startedGame>) {
  while (s.phase === 'eliminate') {
    const idx = s.caseValues.findIndex((_v, i) => !s.opened[i] && i !== s.playerCase);
    makePick(s, idx, 1000);
  }
}

describe('game setup', () => {
  it('deals 20 cases deterministically from the tier table', () => {
    const a = createGame({ tier: tier1, seed: 5 });
    const b = createGame({ tier: tier1, seed: 5 });
    expect(a.caseValues).toEqual(b.caseValues);
    expect([...a.caseValues].sort((x, y) => x - y)).toEqual([...tier1.values].sort((x, y) => x - y));
  });

  it('has 20 cases and a 4-round schedule eliminating 18', () => {
    expect(tier1.values).toHaveLength(20);
    expect(ROUND_PICKS.reduce((a, b) => a + b, 0)).toBe(18);
  });
});

describe('timed picks', () => {
  it('opens the requested case inside the clock', () => {
    const s = startedGame();
    const opened = makePick(s, 5, s.rules.pickClockMs - 1);
    expect(opened).toBe(5);
    expect(s.opened[5]).toBe(true);
  });

  it('auto-opens a random unopened case on timeout', () => {
    const s = startedGame();
    const opened = makePick(s, 5, s.rules.pickClockMs + 1);
    expect(opened).not.toBe(s.playerCase);
    expect(s.opened[opened]).toBe(true);
    expect(s.picksLeftInRound).toBe(ROUND_PICKS[0] - 1);
  });

  it('timeout auto-open is deterministic per seed', () => {
    const a = startedGame(11);
    const b = startedGame(11);
    expect(makePick(a, null, 99999)).toBe(makePick(b, null, 99999));
  });

  it('relaxed mode doubles the pick clock', () => {
    const s = startedGame(7, true);
    // 13s would time out on tier 1's 12s clock but not relaxed 24s
    expect(makePick(s, 5, 13000)).toBe(5);
  });

  it('rejects invalid picks', () => {
    const s = startedGame();
    expect(() => makePick(s, 0, 100)).toThrow(); // own case
    makePick(s, 5, 100);
    expect(() => makePick(s, 5, 100)).toThrow(); // already opened
  });
});

describe('offers', () => {
  it('arrives after a round and decays per tier rules', () => {
    const s = startedGame();
    playToOffer(s);
    expect(s.phase).toBe('offer');
    const base = s.offer!.base;
    expect(base).toBeCloseTo(liveEv(s) * tier1.offerCurve[0]);
    expect(currentOfferValue(s, 0)).toBeCloseTo(base);
    expect(currentOfferValue(s, s.rules.decayWindowMs)).toBe(0);
  });

  it('full deal ends the game with decayed value at accept time', () => {
    const s = startedGame();
    playToOffer(s);
    const expected = currentOfferValue(s, 5000);
    acceptOffer(s, 5000);
    expect(s.phase).toBe('done');
    expect(s.result!.outcome).toBe('deal');
    expect(s.result!.rawWinnings).toBeCloseTo(expected);
  });

  it('applies the clutch bonus in the final 3s', () => {
    const s = startedGame();
    playToOffer(s);
    const t = s.rules.decayWindowMs - 1000;
    acceptOffer(s, t);
    expect(s.result!.clutch).toBe(true);
    expect(s.result!.rawWinnings).toBeCloseTo(currentOfferValueAtBase(s, t) * 1.05);
  });

  it('expired offers cannot be accepted; decline advances play', () => {
    const s = startedGame();
    playToOffer(s);
    expect(() => acceptOffer(s, s.rules.decayWindowMs)).toThrow('expired');
    declineOffer(s);
    expect(s.phase).toBe('eliminate');
    expect(s.round).toBe(1);
  });
});

function currentOfferValueAtBase(s: ReturnType<typeof startedGame>, t: number) {
  // base value at time t without clutch
  return s.offer!.base * (1 - (t / s.rules.decayWindowMs) * (1 - s.rules.decayFloor));
}

describe('partial deal', () => {
  it('banks the accepted portion and scales the board for later offers', () => {
    const s = startedGame();
    playToOffer(s);
    const offerVal = currentOfferValue(s, 0);
    const preEv = liveEv(s);
    acceptOffer(s, 0, 0.5);
    expect(s.banked).toBeCloseTo(offerVal * 0.5);
    expect(s.boardScale).toBeCloseTo(0.5);
    expect(liveEv(s)).toBeCloseTo(preEv * 0.5);
    expect(s.phase).toBe('eliminate');
    // next offer is computed on the scaled board
    playToOffer(s);
    expect(s.offer!.base).toBeCloseTo(liveEv(s) * tier1.offerCurve[1]);
  });

  it('is enforced once per game', () => {
    const s = startedGame();
    playToOffer(s);
    acceptOffer(s, 0, 0.5);
    playToOffer(s);
    expect(() => acceptOffer(s, 0, 0.5)).toThrow('already used');
    acceptOffer(s, 0, 1); // full deal still fine
    expect(s.phase).toBe('done');
  });

  it(`rejects partials below ${MIN_PARTIAL * 100}%`, () => {
    const s = startedGame();
    playToOffer(s);
    expect(() => acceptOffer(s, 0, 0.1)).toThrow();
  });

  it('combines banked partial with a later full deal', () => {
    const s = startedGame();
    playToOffer(s);
    const banked = currentOfferValue(s, 0) * 0.25;
    acceptOffer(s, 0, 0.25);
    playToOffer(s);
    const dealVal = currentOfferValue(s, 0);
    acceptOffer(s, 0, 1);
    expect(s.result!.rawWinnings).toBeCloseTo(dealVal + banked);
  });
});

describe('hold to the end', () => {
  function playToFinal(s: ReturnType<typeof startedGame>) {
    while (s.phase !== 'finalSwap' && s.phase !== 'done') {
      if (s.phase === 'eliminate') {
        const idx = s.caseValues.findIndex((_v, i) => !s.opened[i] && i !== s.playerCase);
        makePick(s, idx, 100);
      } else {
        declineOffer(s);
      }
    }
  }

  it('pays the scaled player case value on a hold', () => {
    const s = startedGame();
    playToFinal(s);
    expect(s.phase).toBe('finalSwap');
    finalSwap(s, false, 1000);
    expect(s.result!.outcome).toBe('hold');
    expect(s.result!.rawWinnings).toBeCloseTo(s.caseValues[0]);
  });

  it('swap exchanges the player case; swap timeout keeps it', () => {
    const a = startedGame(3);
    playToFinal(a);
    finalSwap(a, true, 100);
    expect(a.result!.swappedAtEnd).toBe(true);
    const b = startedGame(3);
    playToFinal(b);
    finalSwap(b, true, 99999);
    expect(b.result!.swappedAtEnd).toBe(false);
    expect(b.result!.caseValue).toBeCloseTo(b.caseValues[0]);
  });

  it('flags above/below starting EV for streaks', () => {
    const s = startedGame();
    playToFinal(s);
    finalSwap(s, false, 100);
    const ev = startingEv(s);
    expect(s.result!.aboveEv).toBe(s.result!.rawWinnings > ev);
  });
});

describe('streak multiplier', () => {
  it('applies the carried multiplier to payout, not to the EV comparison', () => {
    const s = createGame({ tier: tier1, seed: 7, streakMultiplier: 1.5 });
    pickPlayerCase(s, 0);
    while (s.phase === 'eliminate') {
      const idx = s.caseValues.findIndex((_v, i) => !s.opened[i] && i !== s.playerCase);
      makePick(s, idx, 100);
    }
    const val = currentOfferValue(s, 0);
    acceptOffer(s, 0);
    expect(s.result!.rawWinnings).toBeCloseTo(val);
    expect(s.result!.payout).toBeCloseTo(val * 1.5);
  });
});
