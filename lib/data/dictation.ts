import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  chunkDisplays,
  chunkUnits,
  displayMap,
  displayRange,
  grapheme4Units,
  normalizeJa,
  scoreTyping,
  scoreWordBank,
  scoreWordBankLcs,
  type ListeningRevealData,
  type ListeningSubmitData,
  type Range,
} from "@/lib/dictation";
import { CHUNKERS, CURRENT_CHUNKER, chunkLine, grammarRanges, lineTextHash, lineTokens, typingHintUnit } from "@/lib/dictation/chunk";
import { CURRENT_CLOZE_SELECTOR, clozeBlank, clozeCandidates, graphemes, scoreCloze, tokenRanges } from "@/lib/dictation/cloze";
import { grapheme1Units } from "@/lib/dictation/listening-score";
import { isHelped } from "@/lib/helped";
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
const inOrder = (xs: number[]) => xs.every((x, p) => x === p);
/** The indices are exactly 0..k-1, in any order. */
const isPrefix = (xs: number[]) => inOrder([...xs].sort((x, y) => x - y));

/**
 * Cloze hints are flat indices over the blanks' readings laid end to end; each blank's share must be its own
 * prefix (💡 fills from the first character). Per-blank offsets, or `null` when they are not.
 */
function hintedPerBlank(hinted: number[], lengths: number[]): number[][] | null {
  if (!distinctWithin(hinted, lengths.reduce((a, b) => a + b, 0))) return null;
  let start = 0;
  const per = lengths.map((len) => {
    const mine = hinted.filter((h) => h >= start && h < start + len).map((h) => h - start);
    start += len;
    return mine;
  });
  return per.every(isPrefix) ? per : null;
}

/**
 * Score (`submit`) or record a Show answer (`reveal`) for one Listening attempt (spec §5.4–§5.7; cloze, star
 * hints and easy mode: 2026-10-26 spec §3.3–§3.6). Everything the score depends on — the line text, its chunks or
 * cloze candidates, the hint unit — is recomputed here from the line the learner's RLS lets them read in the
 * requested lesson; nothing scoring-relevant is taken from the client but the arrangement, the typed text, the
 * chosen blanks and the hinted indices, all validated against it. The row is written through the service client
 * with the verified user id (D25, §7.1): `authenticated` holds no INSERT on `dictation_attempts`. A reveal is
 * never a score and never a mission outcome (D11).
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
  const base = normalizeJa(text);
  const display = displayMap(text);

  const insert = async (values: Record<string, unknown>) => {
    const { error } = await createServiceClient().from("dictation_attempts").insert({
      user_id: user.id,
      video_id: input.videoId,
      transcript_line_id: input.lineId,
      format: input.format,
      hinted_units: input.hintedUnits,
      ...values,
    });
    if (error) throw error;
  };
  const revealed = async (values: Record<string, unknown>, data: ListeningRevealData): Promise<ListeningAttemptResult> => {
    await insert({ ...values, user_input: "", status: "revealed", accuracy_score: null, chunk_order: null });
    return { ok: true, data };
  };
  /** Mission first (best-effort), then the row, then activity: the order every submit keeps. */
  const submitted = async (values: Record<string, unknown>, data: ListeningSubmitData): Promise<ListeningAttemptResult> => {
    try {
      await ensureDailyMission(user.id);
    } catch (err) {
      console.error("[missions] ensure before dictation failed:", err);
    }
    await insert({ ...values, status: "submitted", accuracy_score: data.score });
    // Best-effort: gamification never fails a learning-flow request (lib/data/gamification.ts::recordActivity).
    await recordActivity({ userId: user.id, source: "dictation", parts: { lineId: input.lineId } });
    await claimActiveMission(user.id);
    return { ok: true, data };
  };

  if (input.format === "cloze") {
    // §3.4: re-tokenise with the stored selector; the chosen blanks must be candidates, ascending, never touching.
    if (input.version !== CURRENT_CLOZE_SELECTOR) return { ok: false, status: 409, error: "chunker_version" };
    const tokens = await lineTokens(text);
    const ranges = tokenRanges(tokens, base);
    const candidates = ranges ? clozeCandidates(tokens) : [];
    if (!input.blanks.every((b, i) => candidates.includes(b) && (i === 0 || b > input.blanks[i - 1]! + 1))) {
      return { ok: false, status: 400 };
    }
    const blanks = input.blanks.map((i) => clozeBlank(tokens, i));
    const hinted = hintedPerBlank(input.hintedUnits, blanks.map((b) => graphemes(b.reading)));
    if (!hinted) return { ok: false, status: 400 };
    const values = {
      hint_unit: input.hintedUnits.length > 0 ? "grapheme1" : null,
      easy_mode: input.easy,
      chunker_version: CURRENT_CHUNKER,
      chunk_snapshot: blanks.map((b) => b.surface),
      cloze_selector_version: input.version,
      cloze_blanks: input.blanks,
    };
    if (input.kind === "reveal") {
      return revealed({ ...values, cloze_answers: null }, {
        kind: "reveal", answer: text, chunks: values.chunk_snapshot, display: input.blanks.map((i) => displayRange(display, base, ranges![i]!)),
      });
    }
    const { score, blanks: results, metrics } = scoreCloze(blanks, input.answers, hinted);
    return submitted(
      { ...values, user_input: input.answers.join(" "), chunk_order: null, cloze_answers: input.answers },
      { kind: "submit", score, blanks: results, metrics, answer: text, helped: isHelped({ easyMode: input.easy, hintedUnits: input.hintedUnits }) },
    );
  }

  if (!CHUNKERS[input.version]) return { ok: false, status: 409, error: "chunker_version" };
  const cut = await chunkLine(text, input.version);

  // §5.4: the hint unit is the server's, never the client's choice; Typing's star hints (§3.3) are `grapheme1`.
  let unit: "chunk" | "grapheme4" | "grapheme1";
  if (input.format === "word_bank") {
    if (!cut.reliable) return { ok: false, status: 400 };
    unit = "chunk";
  } else {
    if (input.hintUnit !== "grapheme1" && input.hintUnit !== typingHintUnit(cut)) return { ok: false, status: 400 };
    unit = input.hintUnit;
  }
  const units = unit === "chunk" ? chunkUnits(cut.chunks) : unit === "grapheme4" ? grapheme4Units(base) : grapheme1Units(base);
  if (!distinctWithin(input.hintedUnits, units.length)) return { ok: false, status: 400 };
  if (input.kind === "submit" && input.format === "word_bank"
    && !(input.chunkOrder.length === cut.chunks.length && distinctWithin(input.chunkOrder, cut.chunks.length))) {
    return { ok: false, status: 400 };
  }

  // v2 Word Bank (WP spec §3.4): the hinted pieces are exactly the prefix 0..k-1, placed first in the answer.
  const k = input.hintedUnits.length;
  if (input.format === "word_bank" && input.version >= 2) {
    if (!isPrefix(input.hintedUnits)) return { ok: false, status: 400 };
    if (input.kind === "submit" && !inOrder(input.chunkOrder.slice(0, k))) return { ok: false, status: 400 };
  }

  // §3.10: every Word Bank attempt is Chế độ dễ.
  const easyMode = input.format === "word_bank";
  const values = {
    hint_unit: k > 0 ? unit : null,
    easy_mode: easyMode,
    chunker_version: input.version,
    chunk_snapshot: cut.chunks,
  };
  const helped = isHelped({ easyMode, hintedUnits: input.hintedUnits });

  if (input.kind === "reveal") {
    return revealed(values, { kind: "reveal", answer: text, chunks: cut.chunks, display: chunkDisplays(display, base, cut.chunks) });
  }

  if (input.format === "word_bank") {
    const { score, slots, metrics } = input.version >= 2
      ? scoreWordBankLcs(cut.chunks, input.chunkOrder, k)
      : scoreWordBank(cut.chunks, input.chunkOrder, new Set(input.hintedUnits));
    return submitted(
      { ...values, user_input: input.chunkOrder.map((i) => cut.chunks[i]).join(""), chunk_order: input.chunkOrder },
      { kind: "submit", score, slots, metrics, answer: text, helped },
    );
  }
  const hinted = input.hintedUnits.flatMap((i): Range[] => (units[i] ? [units[i]] : []));
  const { score, diff, metrics } = scoreTyping(base, input.input, hinted, await grammarRanges(text), display);
  return submitted({ ...values, user_input: input.input, chunk_order: null }, { kind: "submit", score, diff, metrics, answer: text, helped });
}
