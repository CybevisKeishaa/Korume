import type { Quality } from "@/lib/summary/thresholds";

export type ResultBand = Exclude<Quality, "not_started">;

/**
 * Result chimes (owner 2026-10-31): small enough never to annoy. Synthesised with Web Audio — no files, no library.
 * Strong = a bright rising triad, practiced = two rising notes, needs work = one soft low note (never a "wrong" buzz).
 * Peak gain stays ≤ 0.05 and every chime is over in under half a second.
 */
export const CHIMES: Record<ResultBand, { notes: number[]; wave: OscillatorType; peak: number; step: number; decay: number }> = {
  strong: { notes: [659.25, 830.61, 987.77], wave: "sine", peak: 0.05, step: 0.08, decay: 0.28 },
  practiced: { notes: [587.33, 739.99], wave: "sine", peak: 0.045, step: 0.09, decay: 0.3 },
  needs_work: { notes: [329.63], wave: "triangle", peak: 0.035, step: 0, decay: 0.34 },
};

let context: AudioContext | null = null;

/** Plays one band's chime. Never throws: no Web Audio, a blocked context or any audio error just means silence. */
export function playResultChime(band: ResultBand): void {
  try {
    const Ctor = typeof window === "undefined" ? undefined : window.AudioContext;
    if (!Ctor) return;
    context ??= new Ctor();
    const ctx = context;
    // The learner just pressed Check, so the page has user activation and resume() is allowed.
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    const { notes, wave, peak, step, decay } = CHIMES[band];
    const t0 = ctx.currentTime + 0.01;
    notes.forEach((frequency, i) => {
      const start = t0 + i * step;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peak, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + decay + 0.02);
    });
  } catch {
    // Silence is the fallback.
  }
}
