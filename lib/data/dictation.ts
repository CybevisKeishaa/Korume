import "server-only";
import { createClient } from "@/lib/supabase/server";
import { scoreDictation, type DictationDiff } from "@/lib/dictation";
import { rateLimit } from "@/lib/rate-limit";
import type { DictationAttemptInput } from "@/lib/validation/dictation";

const ATTEMPT_LIMIT = { limit: 60, windowMs: 60_000 };

export type SubmitAttemptResult =
  | { ok: true; data: { accuracy: number; diff: DictationDiff[] } }
  | { ok: false; status: 401 | 400 }
  | { ok: false; status: 429; retryAfter: number };

/**
 * Score one dictation attempt for the current user against the reference
 * transcript line, persist it, and return the result. RLS confines the
 * `transcript_lines` read to lines whose parent video is approved (or owned
 * by the current user) — an id that doesn't exist or isn't reachable comes
 * back as `null` from `maybeSingle`, which we surface as 400 rather than 500.
 */
export async function submitAttempt(
  input: DictationAttemptInput,
): Promise<SubmitAttemptResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`dictation:attempt:${user.id}`, ATTEMPT_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { data: line, error: lineError } = await supabase
    .from("transcript_lines")
    .select("text_jp")
    .eq("id", input.lineId)
    .maybeSingle();
  if (lineError) throw lineError;
  if (!line) return { ok: false, status: 400 };

  const { accuracy, diff } = scoreDictation(line.text_jp, input.userInput);

  const { error: insertError } = await supabase.from("dictation_attempts").insert({
    user_id: user.id,
    video_id: input.videoId,
    transcript_line_id: input.lineId,
    user_input: input.userInput,
    accuracy_score: accuracy,
  });
  // A bad videoId (FK violation) or other write failure — surface as 400.
  if (insertError) return { ok: false, status: 400 };

  return { ok: true, data: { accuracy, diff } };
}
