"use client";

/**
 * Glue for the pitch-accent comparison (差別化 #1): user recording +
 * transcript-line text → `PitchAccentScore` (overlay + 0–100 score).
 *
 * Best-effort by design — resolves `null` whenever any link is missing
 * (TTS not configured/unreachable, Web Audio unavailable, undecodable or
 * fully unvoiced recording). Callers fall back to the user-only
 * `PitchContour` view; nothing here ever throws to the UI.
 */
import { readBlobAsArrayBuffer } from "@/lib/audio/read-blob";
import { contourFromSamples, scorePitchAccent, type PitchAccentScore } from "@/lib/pitch";
import { fetchReferenceContour } from "@/lib/pitch/reference";

/**
 * Compare a recorded take against the cached TTS reference for `lineText`.
 * The user's contour comes from the user's OWN microphone recording only
 * (CLAUDE.md §2 — never YouTube audio).
 */
export async function comparePitchToReference(
  blob: Blob,
  lineText: string,
): Promise<PitchAccentScore | null> {
  const reference = await fetchReferenceContour(lineText);
  if (!reference) return null;

  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  const ctx = new AudioCtx();
  try {
    const audioBuffer = await ctx.decodeAudioData(await readBlobAsArrayBuffer(blob));
    const user = contourFromSamples(audioBuffer.getChannelData(0), audioBuffer.sampleRate);
    if (!user) return null;
    return scorePitchAccent(user, reference);
  } catch {
    return null;
  } finally {
    void ctx.close?.();
  }
}
