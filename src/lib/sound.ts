/**
 * Synthesized chess sounds via Web Audio API.
 * No audio files, no dependencies, no licensing issues.
 * All functions are safe to call on the server (no-op) and
 * respect the persisted mute flag.
 */

const MUTE_KEY = "chess-review-muted";

let ctx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted =
  typeof localStorage !== "undefined" && localStorage.getItem(MUTE_KEY) === "1";

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    // Private mode etc: sound still toggles for this session.
  }
}

function ac(): AudioContext | null {
  if (typeof window === "undefined" || muted) return null;
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  c: AudioContext,
  freq: number,
  dur: number,
  opts?: { type?: OscillatorType; gain?: number; at?: number; slideTo?: number },
): void {
  const t0 = c.currentTime + (opts?.at ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts?.type ?? "triangle";
  osc.frequency.setValueAtTime(freq, t0);
  if (opts?.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(opts?.gain ?? 0.2, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function thud(c: AudioContext, at = 0): void {
  let buf = noiseBuf;
  if (!buf) {
    buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.15), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    noiseBuf = buf;
  }
  const t0 = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 700;
  const g = c.createGain();
  g.gain.setValueAtTime(0.25, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
  src.connect(filter).connect(g).connect(c.destination);
  src.start(t0);
}

/** Quiet piece move. */
export function playMove(): void {
  const c = ac();
  if (!c) return;
  tone(c, 190, 0.09, { gain: 0.18 });
}

/** Capture: heavier thud. */
export function playCapture(): void {
  const c = ac();
  if (!c) return;
  tone(c, 115, 0.13, { gain: 0.22 });
  thud(c);
}

/** Castling: double thock. */
export function playCastle(): void {
  const c = ac();
  if (!c) return;
  tone(c, 190, 0.08, { gain: 0.18 });
  tone(c, 170, 0.09, { gain: 0.18, at: 0.07 });
  thud(c, 0.07);
}

/** Check: bright two-tone ding. */
export function playCheck(): void {
  const c = ac();
  if (!c) return;
  tone(c, 880, 0.14, { type: "sine", gain: 0.16 });
  tone(c, 1318, 0.16, { type: "sine", gain: 0.12, at: 0.07 });
}

/** Game end jingle: up for 1-0, down for 0-1, neutral otherwise. */
export function playEnd(result: string): void {
  const c = ac();
  if (!c) return;
  const notes =
    result === "1-0"
      ? [523, 659, 784]
      : result === "0-1"
        ? [659, 523, 392]
        : [523, 659];
  notes.forEach((f, i) => tone(c, f, 0.16, { type: "sine", gain: 0.14, at: i * 0.11 }));
}
