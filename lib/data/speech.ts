import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import {
  isSpeechConfigured,
  recognizeSpeech,
  SpeechError,
  synthesizeSpeech,
  type SpeechRecognitionResult,
} from "@/lib/speech-scoring";
import { speechErrorStatus, SPEECH_THROTTLE_RETRY_AFTER_MS } from "@/lib/http-status";
import { validateAudioSize } from "@/lib/validation/audio";

const TTS_LIMIT = { limit: 20, windowMs: 60_000 };
const STT_LIMIT = { limit: 10, windowMs: 60_000 };

export interface SynthesizeSpeechInput {
  text: string;
  voice?: string;
  format?: string;
}

export type SynthesizeSpeechResult =
  | { ok: true; data: ArrayBuffer }
  | { ok: false; status: 401 | 502 | 503 }
  | { ok: false; status: 429; retryAfter: number };

/** Text-to-speech for the current user (voice replies + pitch-pipeline
 * reference audio). Auth-gated and rate-limited (CLAUDE.md §6). */
export async function synthesizeSpeechForUser(
  input: SynthesizeSpeechInput,
): Promise<SynthesizeSpeechResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`speech:tts:${user.id}`, TTS_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  if (!isSpeechConfigured()) return { ok: false, status: 503 };

  try {
    const audio = await synthesizeSpeech({ text: input.text, voice: input.voice, format: input.format });
    return { ok: true, data: audio };
  } catch (err) {
    if (err instanceof SpeechError) {
      if (err.kind === "throttled") {
        return { ok: false, status: 429, retryAfter: SPEECH_THROTTLE_RETRY_AFTER_MS };
      }
      return { ok: false, status: speechErrorStatus(err.kind) as 502 | 503 };
    }
    throw err;
  }
}

export type TranscribeSpeechResult =
  | { ok: true; data: SpeechRecognitionResult }
  | { ok: false; status: 401 | 422 | 502 | 503 }
  | { ok: false; status: 429; retryAfter: number };

/** Plain STT for voice-conversation mode. Result is AI-generated and must be
 * labelled "may be wrong" at the UI. */
export async function transcribeSpeechForUser(audio: Blob): Promise<TranscribeSpeechResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`speech:stt:${user.id}`, STT_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  if (!isSpeechConfigured()) return { ok: false, status: 503 };

  const sizeCheck = validateAudioSize({ size: audio.size });
  if (!sizeCheck.ok) return { ok: false, status: 422 };

  const buffer = await audio.arrayBuffer();
  try {
    const result = await recognizeSpeech({ audio: buffer });
    return { ok: true, data: result };
  } catch (err) {
    if (err instanceof SpeechError) {
      if (err.kind === "throttled") {
        return { ok: false, status: 429, retryAfter: SPEECH_THROTTLE_RETRY_AFTER_MS };
      }
      return { ok: false, status: speechErrorStatus(err.kind) as 422 | 502 | 503 };
    }
    throw err;
  }
}
