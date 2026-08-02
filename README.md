# 🧳 Case Runner

A neon-arcade, portrait-first Deal-or-No-Deal-style PWA: 20 cases, 4 decaying
banker offers, one relentless clock. Beat the board's EV to grow your chain
multiplier — and cash out before a bad game resets the run.

**Play:** https://kimmania.github.io/game-case-runner/

## Mechanics

- **Pick clock** — a ring around the case wall drains per pick; timeout auto-opens a random case.
- **Decaying offers** — after each round the banker's offer falls live to a floor; the number and the bar drop together. Accepting in the final 3 s adds a **+5% clutch bonus**.
- **Split slider** — once per game, bank 25–90 % of an offer onto the locked gold strip; the rest of the board scales down and play continues.
- **Final swap** — down to two cases? Swap or keep against the clock (timeout = keep).
- **Chain scoring** — finish above starting EV to grow the streak multiplier; hit the chain target to unlock the next of 4 tiers. CASH OUT banks the run.
- **Daily Sprint** — one seeded deal per day (mulberry32 of the date), tier 2 rules, a single game, one attempt — shareable score with copy-to-clipboard.
- **Relaxed mode** — 2× clocks, flat 90 % decay floor; scores flagged separately.
- Settings: sound, music, reduced motion, colour-blind palette, relaxed mode; first-launch tutorial.

## Tech

Vite + TypeScript, DOM/CSS rendering (conic-gradient clock ring), single
`requestAnimationFrame` clock, synthesized Web Audio SFX, `localStorage`
progression, Workbox PWA, mulberry32 seeded RNG. Engine covered by 33 vitest
unit tests incl. Monte Carlo decision-time assertions.

## Commands

```bash
npm install
npm run dev     # local dev server
npm run build   # type-check + production build to dist/
npm test        # 33 engine/unit tests
npm run smoke   # Playwright WebKit smoke test → screenshots in docs/smoke/
```

## Smoke test

`npm run smoke` serves `dist/` locally and drives WebKit (touch viewport,
`?test=1` for deterministic reduced-motion screenshots), capturing:

1. `docs/smoke/01-tier-select.png` — tier select + Daily Sprint entry
2. `docs/smoke/02-case-wall-clock-ring.png` — case wall mid-game with pick-clock ring
3. `docs/smoke/03-offer-panel-split.png` — offer panel: decaying value, decay bar, split slider
4. `docs/smoke/04-result-chain.png` — result / chain screen

## Deploy

GitHub Pages via `deploy.yml` on push to `main`
(base path `/game-case-runner/`).
