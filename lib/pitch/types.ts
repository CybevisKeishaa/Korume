/**
 * Pitch (F0) contour types — 差別化 #1 (CLAUDE.md §5.1, spec §10.1).
 *
 * These describe the fundamental-frequency track extracted from a recording.
 * They are rendering-agnostic: the numbers here are what `motion-engineer`
 * (task B2) draws as the pitch-accent overlay. No DOM/canvas concepts leak in.
 *
 * Layer 3 scope: we only ever process and visualize the *user's own* recorded
 * audio (CLAUDE.md §2.2). Reference-vs-user comparison scoring is a Layer 4
 * extension — see the documented seam in `f0.ts`.
 */

/**
 * One analysis frame of the F0 track.
 * - `time`   — seconds from the start of the audio (frame centre).
 * - `hz`     — estimated fundamental frequency in Hz, or `null` when the frame
 *              is unvoiced (silence / noise / below the voicing threshold).
 */
export interface F0Frame {
  time: number;
  hz: number | null;
}

/**
 * A full pitch contour: the ordered per-frame F0 track plus the sample rate of
 * the audio it was extracted from (needed to relate frame times back to audio).
 */
export interface PitchContour {
  frames: F0Frame[];
  sampleRate: number;
}
