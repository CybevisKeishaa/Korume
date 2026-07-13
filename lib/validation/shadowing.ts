import { z } from "zod";

/** POST /api/shadowing/session — non-file fields (multipart form). The audio
 * itself arrives as a file part and is validated separately via
 * `validateAudioFile`, since zod doesn't model multipart file parts. */
export const shadowingSessionSchema = z.object({
  videoId: z.string().uuid(),
  lineId: z.string().uuid(),
  /** Self-reported pitch-accent score (differentiator #1), computed
   * client-side by `lib/pitch` by comparing the user's recording against a
   * reference contour — the server never recomputes it, only clamps/
   * validates the range before persisting. Optional: the pitch pipeline is
   * newer than the base shadowing flow. */
  pitchScore: z.coerce.number().min(0).max(100).optional(),
});
export type ShadowingSessionInput = z.infer<typeof shadowingSessionSchema>;

/** Audio upload constraints for shadowing recordings (CLAUDE.md §6 — validate every input). */
export const MAX_AUDIO_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_AUDIO_MIME_TYPES = ["audio/webm", "audio/ogg", "audio/mp4"] as const;
export type AllowedAudioMimeType = (typeof ALLOWED_AUDIO_MIME_TYPES)[number];

/** Minimal shape we need from a File/Blob — kept structural so tests don't need a real Blob. */
export interface AudioFileLike {
  size: number;
  type: string;
}

export type AudioValidationResult = { ok: true } | { ok: false; reason: "too_large" | "bad_type" };

/**
 * Validate an uploaded recording's MIME type and size before it ever touches
 * storage. Pure and dependency-free (no Supabase, no "server-only") so it's
 * directly unit-testable — see shadowing.test.ts.
 */
export function validateAudioFile(file: AudioFileLike): AudioValidationResult {
  if (!ALLOWED_AUDIO_MIME_TYPES.includes(file.type as AllowedAudioMimeType)) {
    return { ok: false, reason: "bad_type" };
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return { ok: false, reason: "too_large" };
  }
  return { ok: true };
}
