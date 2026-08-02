import { createGame, pickPlayerCase, makePick, acceptOffer, declineOffer, finalSwap, startingEv } from './game';
import { nextStreak, initialStreak } from './streak';
import { getTier } from './tiers';

/** Console simulation: play one seeded game per tier with a snap-deal policy. */
export function runDebugSimulation(): void {
  let streak = initialStreak();
  for (const tierId of [1, 2, 3, 4]) {
    const tier = getTier(tierId);
    const state = createGame({ tier, seed: 1234 + tierId, streakMultiplier: streak.multiplier });
    pickPlayerCase(state, 7);
    while (state.phase !== 'done') {
      if (state.phase === 'eliminate') {
        // pick highest unopened non-player case, well inside the clock
        const candidates = state.caseValues
          .map((v, i) => ({ v, i }))
          .filter((c) => !state.opened[c.i] && c.i !== state.playerCase)
          .sort((a, b) => b.v - a.v);
        makePick(state, candidates[0].i, 1000);
      } else if (state.phase === 'offer') {
        // snap-deal at >= 90% of live EV, accept 3s in; otherwise let it ride
        if (state.offer && state.offer.base >= startingEv(state) * state.boardScale * 0.9) {
          acceptOffer(state, 3000);
        } else {
          declineOffer(state);
        }
      } else if (state.phase === 'finalSwap') {
        finalSwap(state, false, 1000);
      }
    }
    const r = state.result!;
    console.log(
      `[tier ${tierId} ${tier.name}] ${r.outcome} raw=$${r.rawWinnings.toFixed(0)} ` +
        `payout=$${r.payout.toFixed(0)} (x${state.streakMultiplier}) case=$${r.caseValue.toFixed(0)} ` +
        `aboveEV=${r.aboveEv}`,
    );
    streak = nextStreak(streak, r.payout, r.aboveEv);
  }
  console.log(`[run] chain=${streak.chain} nextMultiplier=x${streak.multiplier} runTotal=$${streak.runTotal.toFixed(0)}`);
}
