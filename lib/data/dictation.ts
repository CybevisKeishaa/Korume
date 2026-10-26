import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  chunkDisplays,
  chunkUnits,
  displayMap,
  grapheme4Units,
  normalizeJa,
  scoreTyping,
  scoreWordBank,
  scoreWordBankLcs,
  type ListeningRevealData,
  type ListeningSubmitData,
  type Range,
} from "@/lib/dictation";
import { CHUNKERS, chunkLine, grammarRanges, lineTextHash, typingHintUnit } from "@/lib/dictation/chunk";
import { rateLimit } from "@/lib/rate-limit";
import { recordActivity } from "@/lib/data/gamification";
import { claimActiveMission, ensureDailyMission } from "@/lib/data/missions";
import type { DictationAttemptInput } from "@/lib/validation/dictation";

const ATTEMPT_LIMIT = { limit: 60, windowMs: 60_000 };

export type ListeningAttemptResult =
  | { ok: true; data: ListeningSubmitData | ListeningRevealData }
  | { ok: false; status: 400 | 401 }
  | { ok: false; status: 409; error: "line_changed" | "chunker_version" }
  | { ok: false; status: 429; retryAfter: number };

/** Every index once, each within `[0, n)`. */
const distinctWithin = (indices: number[], n: number): boolean =>
  new Set(indices).size === indices.length && indices.every((i) => i >= 0 && i < n);

/**
 * Score (`submit`) or record a Show answer (`reveal`) for one Listening attempt (spec §5.4–§5.7).
 * Everything the score depends on — the line text, its chunks, the hint unit — is recomputed here from
 * the line the learner's RLS lets them read in the requested lesson; nothing scoring-relevant is taken
 * from the client but the arrangement, the typed text and the hinted indices, all validated against it.
 * The row is written through the service client with the verified user id (D25, §7.1): `authenticated`
 * holds no INSERT on `dictation_attempts`. A reveal is never a score and never a mission outcome (D11).
 */
export async function submitListeningAttempt(input: DictationAttemptInput): Promise<ListeningAttemptResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`dictation:attempt:${user.id}`, ATTEMPT_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { data: line, error: lineError } = await supabase
    .from("transcript_lines")
    .select("text_jp, transcripts!inner(video_id)")
    .eq("id", input.lineId)
    .eq("transcripts.video_id", input.videoId)
    .maybeSingle();
  if (lineError) throw lineError;
  if (!line) return { ok: false, status: 400 };
  const text: string = line.text_jp;

  if (lineTextHash(text) !== input.textHash) return { ok: false, status: 409, error: "line_changed" };
  if (!CHUNKERS[input.version]) return { ok: false, status: 409, error: "chunker_version" };
  const cut = await chunkLine(text, input.version);
  const base = normalizeJa(text);
  const display = displayMap(text);

  // §5.4: the hint unit is the server's, never the client's choice.
  let unit: "chunk" | "grapheme4";
  if (input.format === "word_bank") {
    if (!cut.reliable) return { ok: false, status: 400 };
    unit = "chunk";
  } else {
    unit = typingHintUnit(cut);
    if (input.hintUnit !== unit) return { ok: false, status: 400 };
  }
  const units = unit === "chunk" ? chunkUnits(cut.chunks) : grapheme4Units(base);
  if (!distinctWithin(input.hintedUnits, units.length)) return { ok: false, status: 400 };
  if (input.kind === "submit" && input.format === "word_bank"
    && !(input.chunkOrder.length === cut.chunks.length && distinctWithin(input.chunkOrder, cut.chunks.length))) {
    return { ok: false, status: 400 };
  }

  // v2 Word Bank (WP spec §3.4): the hinted pieces are exactly the prefix 0..k-1, placed first in the answer.
  const k = input.hintedUnits.length;
  if (input.format === "word_bank" && input.version >= 2) {
    const prefix = (xs: number[]) => xs.every((x, p) => x === p);
    if (!prefix([...input.hintedUnits].sort((x, y) => x - y))) return { ok: false, status: 400 };
    if (input.kind === "submit" && !prefix(input.chunkOrder.slice(0, k))) return { ok: false, status: 400 };
  }

  const row = {
    user_id: user.id,
    video_id: input.videoId,
    transcript_line_id: input.lineId,
    format: input.format,
    hint_unit: input.hintedUnits.length > 0 ? unit : null,
    hinted_units: input.hintedUnits,
    chunker_version: input.version,
    chunk_snapshot: cut.chunks,
  };
  const insert = async (values: Record<string, unknown>) => {
    const { error } = await createServiceClient().from("dictation_attempts").insert({ ...row, ...values });
    if (error) throw error;
  };

  if (input.kind === "reveal") {
    await insert({ user_input: "", status: "revealed", accuracy_score: null, chunk_order: null });
    return { ok: true, data: { kind: "reveal", answer: text, chunks: cut.chunks, display: chunkDisplays(display, base, cut.chunks) } };
  }

  try {
    await ensureDailyMission(user.id);
  } catch (err) {
    console.error("[missions] ensure before dictation failed:", err);
  }

  let data: ListeningSubmitData;
  if (input.format === "word_bank") {
    const { score, slots, metrics } = input.version >= 2
      ? scoreWordBankLcs(cut.chunks, input.chunkOrder, k)
      : scoreWordBank(cut.chunks, input.chunkOrder, new Set(input.hintedUnits));
    data = { kind: "submit", score, slots, metrics, answer: text };
    await insert({
      user_input: input.chunkOrder.map((i) => cut.chunks[i]).join(""),
      status: "submitted",
      accuracy_score: score,
      chunk_order: input.chunkOrder,
    });
  } else {
    const hinted = input.hintedUnits.flatMap((i): Range[] => (units[i] ? [units[i]] : []));
    const { score, diff, metrics } = scoreTyping(base, input.input, hinted, await grammarRanges(text), display);
    data = { kind: "submit", score, diff, metrics, answer: text };
    await insert({ user_input: input.input, status: "submitted", accuracy_score: score, chunk_order: null });
  }

  // Best-effort: gamification never fails a learning-flow request (lib/data/gamification.ts::recordActivity).
  await recordActivity({ userId: user.id, source: "dictation", parts: { lineId: input.lineId } });
  await claimActiveMission(user.id);
  return { ok: true, data };
}
