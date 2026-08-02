# Case Runner

A real-time case-elimination PWA: 20 cases, a pick clock, decaying offers,
partial deals, and a streak multiplier across chained runs.

**Stage 1 (this commit):** engine + tests only. `src/main.ts` is a debug
console simulation; the real UI lands in Stage 2.

## Mechanics (see plan §3/§4)

- 20 cases dealt from per-tier value tables; pick your case untimed.
- Each elimination pick is on a clock — timeout auto-opens a random case.
- Offers decay linearly over a window to a per-tier floor; expire = gone.
  Accepting in the final 3s earns a +5% clutch bonus.
- **Partial deal** (once per game): bank 25–100% of a live offer; the whole
  board (incl. your case) scales down proportionally and later offers use
  the scaled board.
- **Streak multiplier**: consecutive above-EV finishes climb ×1.1 → ×2;
  a below-EV finish resets the chain.
- 4 tiers in `src/data/tiers.json`; relaxed mode doubles clocks and flattens
  decay to a 90% floor (scored separately).

## Commands

```sh
npm install
npm run dev    # local dev
npm run test   # vitest
npm run build  # tsc + vite build (PWA)
```

Deploys to GitHub Pages at `/game-case-runner/` on push to `main`.
