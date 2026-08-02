/** Case Runner — Stage 2 UI shell: tier select, game screen, result/chain flow,
 * settings (relaxed mode, sound, reduced motion, color-blind), tutorial. */
import './ui/styles.css';
import { TIERS } from './engine/tiers';
import { initialStreak, nextStreak, type StreakState } from './engine/streak';
import type { GameResult, GameState, TierConfig } from './engine/types';
import { configureAudio, sfxCashOut, sfxDeal } from './ui/audio';
import { renderGameScreen } from './ui/game-screen';

interface Settings {
  sound: boolean;
  music: boolean;
  reducedMotion: boolean;
  colorBlind: boolean;
  relaxed: boolean;
  tutorialSeen: boolean;
}

const LS_SETTINGS = 'case-runner:settings';
const LS_UNLOCK = 'case-runner:unlocked-tier';

const settings: Settings = loadSettings();
let streak: StreakState = initialStreak();
let currentTier: TierConfig = TIERS[0];

const app = document.getElementById('app')!;

function loadSettings(): Settings {
  try {
    return { sound: true, music: true, reducedMotion: false, colorBlind: false, relaxed: false, tutorialSeen: false, ...JSON.parse(localStorage.getItem(LS_SETTINGS) ?? '{}') };
  } catch {
    return { sound: true, music: true, reducedMotion: false, colorBlind: false, relaxed: false, tutorialSeen: false };
  }
}
function saveSettings(): void {
  localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
  applySettings();
}
function applySettings(): void {
  configureAudio({ sound: settings.sound, music: settings.music });
  document.body.classList.toggle('reduced-motion', settings.reducedMotion);
  document.body.classList.toggle('color-blind', settings.colorBlind);
}
function unlockedTier(): number {
  return Number(localStorage.getItem(LS_UNLOCK) ?? '1');
}
const fmt = (n: number): string => '$' + Math.round(n).toLocaleString('en-US');

function topbar(title: string): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'topbar';
  const h = document.createElement('div');
  h.innerHTML = `<span class="title" style="font-size:22px">${title}</span>` +
    (settings.relaxed ? ' <span class="relaxed-flag">RELAXED</span>' : '');
  const gear = document.createElement('button');
  gear.className = 'btn-icon';
  gear.textContent = '⚙ Settings';
  gear.addEventListener('click', showSettings);
  bar.append(h, gear);
  return bar;
}

/* ---------- tier select ---------- */
function showTierSelect(): void {
  app.innerHTML = '';
  const screen = document.createElement('div');
  screen.className = 'screen';
  screen.appendChild(topbar('CASE RUNNER'));
  const sub = document.createElement('div');
  sub.className = 'subtitle';
  sub.textContent = '20 cases. 4 offers. One clock. Beat EV to grow the chain.';
  screen.appendChild(sub);
  if (streak.chain > 0) {
    const pill = document.createElement('div');
    pill.className = 'chain-pill';
    pill.textContent = `Chain ×${streak.multiplier} · run ${fmt(streak.runTotal)}`;
    screen.appendChild(pill);
  }
  const grid = document.createElement('div');
  grid.className = 'tier-grid';
  const unlocked = unlockedTier();
  for (const tier of TIERS) {
    const card = document.createElement('button');
    const locked = tier.id > unlocked;
    card.className = 'tier-card' + (locked ? ' locked' : '');
    card.disabled = locked;
    card.innerHTML =
      `<span class="tier-name">${locked ? '🔒 ' : ''}${tier.name}</span>` +
      `<span class="tier-top">Top ${fmt(tier.topPrize)}</span>` +
      `<span class="tier-meta">Chain target ${fmt(tier.chainTarget)} · ${tier.pickClockMs / 1000}s picks${tier.id <= unlocked - 0 && tier.id > 1 ? '' : ''}</span>` +
      (locked ? `<span class="tier-meta">Hit tier ${tier.id - 1} chain target to unlock</span>` : '');
    card.addEventListener('click', () => {
      currentTier = tier;
      if (!settings.tutorialSeen) showTutorial(() => startGame());
      else startGame();
    });
    grid.appendChild(card);
  }
  screen.appendChild(grid);
  app.appendChild(screen);
}

/* ---------- game ---------- */
function startGame(): void {
  renderGameScreen(app, {
    tier: currentTier,
    relaxed: settings.relaxed,
    streakMultiplier: streak.multiplier,
    chainTotal: streak.runTotal,
    onDone: showResult,
  });
}

/* ---------- result ---------- */
function showResult(result: GameResult, state: GameState): void {
  const prev = streak;
  streak = nextStreak(streak, result.payout, result.aboveEv);
  const unlockedNow = unlockedTier();
  if (streak.runTotal >= currentTier.chainTarget && currentTier.id === unlockedNow && currentTier.id < TIERS.length) {
    localStorage.setItem(LS_UNLOCK, String(currentTier.id + 1));
  }

  app.innerHTML = '';
  const screen = document.createElement('div');
  screen.className = 'screen';
  screen.appendChild(topbar(result.outcome === 'deal' ? 'DEAL!' : 'CASE REVEAL'));

  const card = document.createElement('div');
  card.className = 'result-card';
  const big = document.createElement('div');
  big.className = 'result-big';
  big.textContent = fmt(result.payout);
  card.appendChild(big);

  const verdict = document.createElement('div');
  verdict.className = result.aboveEv ? 'above-ev' : 'below-ev';
  verdict.textContent = result.aboveEv ? '▲ Above EV — chain grows!' : '▼ Below EV — chain reset';
  card.appendChild(verdict);

  const lines: [string, string][] = [
    ['Outcome', result.outcome === 'deal' ? `Deal ${fmt(result.offerTaken ?? 0)}${result.clutch ? ' (CLUTCH +5%)' : ''}` : `Held case: ${fmt(result.caseValue)}`],
    ['Raw winnings', fmt(result.rawWinnings)],
    ['Streak multiplier', `×${state.streakMultiplier}`],
    ['Final swap', result.swappedAtEnd ? 'Swapped' : result.outcome === 'hold' ? 'Kept' : '—'],
    ['Chain', `${streak.chain} game${streak.chain === 1 ? '' : 's'} · run ${fmt(streak.runTotal)} / ${fmt(currentTier.chainTarget)}`],
  ];
  if (settings.relaxed) lines.push(['Mode', 'RELAXED (scores flagged separately)']);
  for (const [k, v] of lines) {
    const row = document.createElement('div');
    row.className = 'result-line';
    row.innerHTML = `<span>${k}</span><b>${v}</b>`;
    card.appendChild(row);
  }
  screen.appendChild(card);

  if (result.aboveEv) sfxDeal();

  const row = document.createElement('div');
  row.className = 'offer-actions';
  const next = document.createElement('button');
  next.className = 'btn-primary btn-icon';
  next.textContent = `▶ NEXT GAME (×${streak.multiplier})`;
  next.addEventListener('click', startGame);
  const cashOut = document.createElement('button');
  cashOut.className = 'btn-gold btn-icon';
  cashOut.textContent = `💰 CASH OUT ${fmt(streak.runTotal)}`;
  cashOut.addEventListener('click', () => {
    sfxCashOut();
    streak = initialStreak();
    showTierSelect();
  });
  const menu = document.createElement('button');
  menu.className = 'btn-icon';
  menu.textContent = '🏠 Tiers';
  menu.addEventListener('click', showTierSelect);
  row.append(next, cashOut, menu);
  screen.appendChild(row);
  if (prev.chain > 0 && !result.aboveEv) {
    const note = document.createElement('div');
    note.className = 'subtitle';
    note.textContent = `Run of ${fmt(prev.runTotal)} lost — cash out before the chain breaks!`;
    screen.appendChild(note);
  }
  app.appendChild(screen);
}

/* ---------- settings ---------- */
function showSettings(): void {
  const back = document.createElement('div');
  back.className = 'modal-back';
  const modal = document.createElement('div');
  modal.className = 'modal';
  const h = document.createElement('h2');
  h.textContent = '⚙ Settings';
  modal.appendChild(h);

  const rows: [string, keyof Settings, string][] = [
    ['🔊 Sound effects', 'sound', 'Synthesized case pops, ticks, jingles'],
    ['🎵 Music', 'music', 'Ambient hums'],
    ['🐢 Relaxed mode', 'relaxed', '2× clocks, flat decay — scores flagged separately'],
    ['🎞 Reduced motion', 'reducedMotion', 'Minimize animations'],
    ['👁 Color-blind palette', 'colorBlind', 'Blue/yellow/orange instead of cyan/gold/red'],
  ];
  for (const [label, key, desc] of rows) {
    const row = document.createElement('div');
    row.className = 'setting-row';
    const lab = document.createElement('div');
    lab.innerHTML = `<div>${label}</div><div class="subtitle" style="font-size:12px">${desc}</div>`;
    const t = document.createElement('button');
    t.className = 'toggle' + (settings[key] ? ' on' : '');
    t.setAttribute('aria-label', label);
    t.addEventListener('click', () => {
      (settings[key] as boolean) = !settings[key];
      t.classList.toggle('on', settings[key]);
      saveSettings();
    });
    row.append(lab, t);
    modal.appendChild(row);
  }

  const again = document.createElement('button');
  again.className = 'btn-icon';
  again.textContent = '❓ Replay tutorial';
  again.addEventListener('click', () => {
    back.remove();
    showTutorial(() => showTierSelect());
  });
  modal.appendChild(again);

  const close = document.createElement('button');
  close.className = 'btn-primary';
  close.textContent = 'Done';
  close.addEventListener('click', () => {
    back.remove();
    showTierSelect();
  });
  modal.appendChild(close);
  back.appendChild(modal);
  back.addEventListener('click', (e) => {
    if (e.target === back) back.remove();
  });
  document.body.appendChild(back);
}

/* ---------- tutorial ---------- */
function showTutorial(onDismiss: () => void): void {
  const steps: string[] = [
    '🧳 <b>Pick a case</b> to keep. Then open cases against the <b>pick clock</b> — the ring around the wall drains each pick, turns red under 3s, and a timeout auto-opens a random case.',
    '💰 After each round the banker makes an <b>offer that decays live</b>. The number and the bar fall together; accept in the final 3s for a <b>+5% clutch bonus</b>. Offer and live EV are shown side by side — do the math.',
    '✂ <b>Split slider</b>: once per game, bank 25–90% of an offer onto the locked gold strip. The banked part is safe; every remaining case value scales down. Drag the slider, tap SPLIT.',
    '🔄 Down to two cases? <b>Final swap</b> — swap or keep before the clock dies (timeout = keep). Finish <b>above EV</b> to grow your chain multiplier. CASH OUT to bank the run before a bad game resets it.',
  ];
  let idx = 0;
  const back = document.createElement('div');
  back.className = 'modal-back';
  const modal = document.createElement('div');
  modal.className = 'modal';
  const h = document.createElement('h2');
  h.textContent = 'How to play';
  const body = document.createElement('div');
  body.className = 'tutorial-step';
  const next = document.createElement('button');
  next.className = 'btn-primary';
  const render = () => {
    body.innerHTML = steps[idx];
    next.textContent = idx < steps.length - 1 ? `Next (${idx + 1}/${steps.length})` : "Let's run!";
  };
  next.addEventListener('click', () => {
    idx += 1;
    if (idx >= steps.length) {
      settings.tutorialSeen = true;
      saveSettings();
      back.remove();
      onDismiss();
    } else render();
  });
  modal.append(h, body, next);
  back.appendChild(modal);
  document.body.appendChild(back);
  render();
}

applySettings();
showTierSelect();
