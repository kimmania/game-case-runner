/** Core game screen: 20-case wall, pick-clock ring, decaying offer panel with
 * split slider, final swap. Drives the Stage 1 engine and reports the result. */
import {
  acceptOffer,
  createGame,
  currentOfferValue,
  declineOffer,
  finalSwap,
  liveEv,
  makePick,
  pickPlayerCase,
  MIN_PARTIAL,
} from '../engine/game';
import type { GameResult, GameState, TierConfig } from '../engine/types';
import { sfxDecayHum, sfxDeal, sfxOfferChime, sfxPop, sfxSplitTear, sfxThud, sfxTick } from './audio';

export interface GameScreenOptions {
  tier: TierConfig;
  relaxed: boolean;
  streakMultiplier: number;
  chainTotal: number;
  onDone: (result: GameResult, state: GameState) => void;
}

const fmt = (n: number): string =>
  '$' + (n >= 1000 ? Math.round(n).toLocaleString('en-US') : n.toFixed(n % 1 ? 2 : 0));

export function renderGameScreen(root: HTMLElement, opts: GameScreenOptions): void {
  const state = createGame({
    tier: opts.tier,
    seed: (Math.random() * 2 ** 31) | 0,
    relaxed: opts.relaxed,
    streakMultiplier: opts.streakMultiplier,
  });

  root.innerHTML = '';
  const screen = el('div', 'screen');
  root.appendChild(screen);

  // HUD
  const hud = el('div', 'hud');
  const roundEl = el('span', 'round');
  const evEl = el('span', 'ev');
  const multEl = el('span', 'chain-pill');
  multEl.textContent = `×${state.streakMultiplier} chain ${fmt(opts.chainTotal)} / ${fmt(opts.tier.chainTarget)}`;
  hud.append(roundEl, evEl, multEl);
  screen.appendChild(hud);

  const bankedEl = el('div', 'banked-strip');
  screen.appendChild(bankedEl);

  // Case wall with clock ring
  const wrap = el('div', 'case-wall-wrap');
  const ring = el('div', 'clock-ring');
  const wall = el('div', 'case-wall');
  wrap.append(ring, wall);
  screen.appendChild(wrap);

  const hint = el('div', 'subtitle');
  screen.appendChild(hint);

  // Value board
  const board = el('div', 'value-board');
  screen.appendChild(board);
  const sortedValues = [...opts.tier.values].sort((a, b) => a - b);
  const boardCells = sortedValues.map((v) => {
    const s = document.createElement('span');
    s.textContent = fmt(v);
    board.appendChild(s);
    return { v, s };
  });

  // Offer panel
  const panel = el('div', 'offer-panel');
  const offerAmount = el('div', 'offer-amount');
  const offerEv = el('div', 'offer-ev');
  const decayBar = el('div', 'decay-bar');
  const decayFill = document.createElement('div');
  decayBar.appendChild(decayFill);
  const actions = el('div', 'offer-actions');
  const dealBtn = btn('🤝 DEAL', 'btn-gold btn-icon');
  const noDealBtn = btn('▶ NO DEAL', 'btn-icon');
  const splitRow = el('div', 'split-row');
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = String(MIN_PARTIAL * 100);
  slider.max = '90';
  slider.value = '50';
  const splitLabel = el('span', 'split-label');
  const splitBtn = btn('✂ SPLIT', 'btn-icon');
  splitRow.append(slider, splitLabel, splitBtn);
  actions.append(dealBtn, noDealBtn);
  panel.append(offerAmount, offerEv, decayBar, actions, splitRow);
  screen.appendChild(panel);

  // Case buttons
  const caseBtns: HTMLButtonElement[] = [];
  for (let i = 0; i < 20; i++) {
    const b = document.createElement('button');
    b.className = 'case';
    b.textContent = String(i + 1);
    b.setAttribute('aria-label', `Case ${i + 1}`);
    b.addEventListener('click', () => onCaseClick(i));
    wall.appendChild(b);
    caseBtns.push(b);
  }

  // Clock state
  let pickStart = 0;
  let offerStart = 0;
  let lastTickSec = -1;
  let lastHumSec = -1;
  let raf = 0;
  let done = false;

  function el(tag: string, cls: string): HTMLElement {
    const e = document.createElement(tag);
    e.className = cls;
    return e;
  }
  function btn(label: string, cls: string): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = cls;
    b.textContent = label;
    return b;
  }

  function refreshStatic(): void {
    roundEl.textContent =
      state.phase === 'pickCase'
        ? 'Pick your case'
        : state.phase === 'eliminate'
          ? `Round ${state.round + 1}/4 — ${state.picksLeftInRound} pick${state.picksLeftInRound > 1 ? 's' : ''}`
          : state.phase === 'finalSwap'
            ? 'Final swap!'
            : '';
    evEl.textContent = `EV ${fmt(liveEv(state))}`;
    const openedVals = new Set<number>();
    for (let i = 0; i < 20; i++) if (state.opened[i]) openedVals.add(state.caseValues[i]);
    for (const c of boardCells) {
      const struck = openedVals.has(c.v);
      c.s.classList.toggle('struck', struck);
      c.s.textContent = fmt(c.v * state.boardScale);
    }
    if (state.banked > 0) {
      bankedEl.classList.add('visible');
      bankedEl.textContent = `🔒 BANKED ${fmt(state.banked)} (safe ×${state.streakMultiplier} at payout)`;
    }
    for (let i = 0; i < 20; i++) {
      const b = caseBtns[i];
      b.classList.toggle('player', state.playerCase === i);
      b.classList.toggle('opened', state.opened[i]);
      if (state.opened[i]) b.textContent = fmt(state.caseValues[i] * state.boardScale);
      b.disabled =
        state.opened[i] ||
        i === state.playerCase ||
        (state.phase !== 'pickCase' && state.phase !== 'eliminate');
      if (state.phase === 'pickCase') b.disabled = false;
    }
    hint.textContent =
      state.phase === 'pickCase'
        ? 'Choose the case you keep to the end.'
        : state.phase === 'eliminate'
          ? 'Open cases before the clock runs out — timeout opens one at random.'
          : state.phase === 'finalSwap'
            ? 'Swap your case for the last one? Timeout = keep.'
            : '';
  }

  function onCaseClick(i: number): void {
    if (state.phase === 'pickCase') {
      pickPlayerCase(state, i);
      sfxPop();
      pickStart = performance.now();
      lastTickSec = -1;
      refreshStatic();
      return;
    }
    if (state.phase !== 'eliminate') return;
    doPick(i, false);
  }

  function doPick(i: number | null, timedOut: boolean): void {
    const elapsed = performance.now() - pickStart;
    let openedIdx: number;
    try {
      openedIdx = makePick(state, i, timedOut ? state.rules.pickClockMs + 1 : elapsed);
    } catch {
      return;
    }
    caseBtns[openedIdx].classList.add('auto');
    sfxPop();
    pickStart = performance.now();
    lastTickSec = -1;
    if (state.phase === 'offer') {
      offerStart = performance.now();
      lastHumSec = -1;
      slider.disabled = state.partialUsed;
      splitBtn.disabled = state.partialUsed;
      panel.classList.add('visible');
      sfxOfferChime();
    }
    refreshStatic();
  }

  function closeOffer(): void {
    panel.classList.remove('visible');
    pickStart = performance.now();
    lastTickSec = -1;
    refreshStatic();
  }

  dealBtn.addEventListener('click', () => {
    try {
      acceptOffer(state, performance.now() - offerStart, 1);
    } catch {
      return;
    }
    sfxDeal();
    endGame();
  });

  splitBtn.addEventListener('click', () => {
    const frac = Number(slider.value) / 100;
    try {
      acceptOffer(state, performance.now() - offerStart, frac);
    } catch {
      return;
    }
    sfxSplitTear();
    closeOffer();
  });

  noDealBtn.addEventListener('click', () => {
    declineOffer(state);
    sfxThud();
    closeOffer();
  });

  slider.addEventListener('input', () => {
    splitLabel.textContent = `${slider.value}%`;
  });
  splitLabel.textContent = '50%';

  function showFinalSwap(): void {
    refreshStatic();
    const row = el('div', 'swap-row');
    const keep = btn('✋ KEEP', 'btn-primary btn-icon');
    const swap = btn('🔄 SWAP', 'btn-danger btn-icon');
    const decide = (doSwap: boolean, timedOut = false) => {
      if (state.phase !== 'finalSwap') return;
      finalSwap(state, doSwap, timedOut ? state.rules.pickClockMs + 1 : performance.now() - pickStart);
      row.remove();
      endGame();
    };
    keep.addEventListener('click', () => decide(false));
    swap.addEventListener('click', () => decide(true));
    row.append(keep, swap);
    screen.appendChild(row);
    swapTimeoutRow = row;
  }
  let swapTimeoutRow: HTMLElement | null = null;

  function endGame(): void {
    done = true;
    cancelAnimationFrame(raf);
    panel.classList.remove('visible');
    opts.onDone(state.result!, state);
  }

  function tick(now: number): void {
    if (done) return;
    if (state.phase === 'eliminate' || state.phase === 'finalSwap') {
      const elapsed = now - pickStart;
      const p = Math.max(0, 1 - elapsed / state.rules.pickClockMs);
      ring.style.setProperty('--p', String(p));
      const remainMs = state.rules.pickClockMs - elapsed;
      ring.classList.toggle('urgent', remainMs < 3000);
      const sec = Math.ceil(remainMs / 1000);
      if (remainMs < 3000 && remainMs > 0 && sec !== lastTickSec) {
        lastTickSec = sec;
        sfxTick();
      }
      if (remainMs <= 0) {
        if (state.phase === 'eliminate') {
          doPick(null, true);
        } else {
          if (swapTimeoutRow) swapTimeoutRow.remove();
          finalSwap(state, false, state.rules.pickClockMs + 1);
          endGame();
          return;
        }
      }
    } else {
      ring.style.setProperty('--p', '1');
      ring.classList.remove('urgent');
    }

    if (state.phase === 'offer' && state.offer) {
      const elapsed = now - offerStart;
      const val = currentOfferValue(state, elapsed);
      const p = Math.max(0, 1 - elapsed / state.rules.decayWindowMs);
      offerAmount.textContent = fmt(val);
      offerEv.textContent = `live EV ${fmt(liveEv(state))} · board scale ×${state.boardScale.toFixed(2)}`;
      const clutch = state.rules.decayWindowMs - elapsed <= 3000 && val > 0;
      offerAmount.classList.toggle('clutch', clutch);
      decayFill.style.width = `${p * 100}%`;
      decayBar.className = 'decay-bar' + (p < 0.25 ? ' crit' : p < 0.55 ? ' warn' : '');
      const sec = Math.floor(elapsed / 1000);
      if (sec !== lastHumSec) {
        lastHumSec = sec;
        sfxDecayHum();
      }
      if (val <= 0) {
        declineOffer(state);
        sfxThud();
        closeOffer();
      }
    }

    if (state.phase === 'finalSwap' && !swapTimeoutRow) showFinalSwap();
    raf = requestAnimationFrame(tick);
  }

  refreshStatic();
  raf = requestAnimationFrame(tick);
}
