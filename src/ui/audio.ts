/** Synthesized Web Audio SFX — no assets. All sounds gated on settings. */

export interface AudioSettings {
  sound: boolean;
  music: boolean;
}

let ctx: AudioContext | null = null;
let settings: AudioSettings = { sound: true, music: true };

export function configureAudio(s: AudioSettings): void {
  settings = s;
}

function ac(): AudioContext | null {
  if (!settings.sound) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function blip(freq: number, dur: number, type: OscillatorType = 'square', gain = 0.06, slideTo?: number): void {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur);
}

/** Case popped open. */
export function sfxPop(): void {
  blip(220, 0.12, 'square', 0.07, 90);
}

/** Tick-tock under 3 seconds on the pick clock. */
export function sfxTick(): void {
  blip(1200, 0.05, 'square', 0.05);
}

/** Offer panel arrives. */
export function sfxOfferChime(): void {
  blip(523, 0.15, 'sine', 0.07);
  setTimeout(() => blip(784, 0.2, 'sine', 0.07), 110);
}

/** Low hum while the offer decays (one short pulse; call per second). */
export function sfxDecayHum(): void {
  blip(110, 0.25, 'sawtooth', 0.025);
}

/** Partial deal tears off to the banked strip. */
export function sfxSplitTear(): void {
  blip(400, 0.3, 'sawtooth', 0.06, 1400);
}

/** Deal taken. */
export function sfxDeal(): void {
  blip(660, 0.12, 'triangle', 0.08);
  setTimeout(() => blip(880, 0.18, 'triangle', 0.08), 90);
}

/** Cash-out jingle. */
export function sfxCashOut(): void {
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'triangle', 0.08), i * 100));
}

/** Bad news (low value revealed / chain reset). */
export function sfxThud(): void {
  blip(140, 0.25, 'sawtooth', 0.07, 60);
}
