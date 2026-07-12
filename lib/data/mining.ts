import "server-only";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/data/videos";
import { reviewItem, type Quality, type SrsState } from "@/lib/srs";
import type { CreateMiningCardInput, ReviewMiningCardInput } from "@/lib/validation/mining";

/**
 * Sentence mining (CLAUDE.md §5 differentiator #3). Self-contained data layer:
 * cards are keyed by their own surrogate `id`, NOT the composite
 * (user, itemType, itemId) key `lib/data/srs.ts` uses for vocab/kanji — so
 * this module never touches `lib/data/srs.ts` or `lib/validation/content.ts`.
 * The shared, already-tested SM-2 engine (`lib/srs`) is reused as-is; only
 * the storage shape differs.
 *
 * §2 compliance: a card stores no media of any kind. Replay is always
 * `{video_id, start_time, end_time}` seeked through the official YouTube
 * IFrame player — never a downloaded frame or audio clip.
 */

const CREATE_LIMIT = { limit: 60, windowMs: 60_000 };

export interface MiningCardRow {
  id: string;
  user_id: string;
  video_id: string;
  transcript_line_id: string | null;
  target_word: string;
  reading: string | null;
  sentence_jp: string;
  sentence_translation: string | null;
  start_time: number | null;
  end_time: number | null;
  created_at: string;
  srs_stage: number;
  interval_days: number;
  ease_factor: number;
  next_review_at: string | null;
  last_reviewed_at: string | null;
}

// A single string literal (not `+`-concatenated) so `const` preserves its
// literal type — Supabase's `.select()` generic needs that to infer the
// result shape; a widened `string` degrades it to a generic error type.
const CARD_COLUMNS =
  "id, user_id, video_id, transcript_line_id, target_word, reading, sentence_jp, sentence_translation, start_time, end_time, created_at, srs_stage, interval_days, ease_factor, next_review_at, last_reviewed_at";

export type CreateMiningCardResult =
  | { ok: true; data: MiningCardRow }
  | { ok: false; status: 401 | 400 }
  | { ok: false; status: 429; retryAfter: number };

/**
 * Mint a fresh SRS-scheduled sentence-mining card from a tapped transcript
 * line. The sentence text, translation fallback, and replay timestamps are
 * derived server-side from the `transcript_lines` row — a client can supply
 * only the target word/reading and an optional translation override, never
 * the sentence or times themselves. SM-2 columns are left at their table
 * defaults (a card starts unseen, exactly like a fresh vocab/kanji item).
 */
export async function createMiningCard(
  input: CreateMiningCardInput,
  now: Date = new Date(),
): Promise<CreateMiningCardResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`mining:create:${user.id}`, CREATE_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  // RLS confines this to lines whose parent transcript's video is visible to
  // the caller; a lineId that doesn't resolve (bad id, or not visible) is a
  // 400, not a 500.
  const { data: line, error: lineError } = await supabase
    .from("transcript_lines")
    .select("id, transcript_id, start_time, end_time, text_jp, text_translation")
    .eq("id", input.lineId)
    .maybeSingle();
  if (lineError) throw lineError;
  if (!line) return { ok: false, status: 400 };

  const lineRow = line as {
    id: string;
    transcript_id: string;
    start_time: number;
    end_time: number | null;
    text_jp: string;
    text_translation: string | null;
  };

  const { data: transcript, error: transcriptError } = await supabase
    .from("transcripts")
    .select("video_id")
    .eq("id", lineRow.transcript_id)
    .maybeSingle();
  if (transcriptError) throw transcriptError;
  if (!transcript) return { ok: false, status: 400 };

  const { data: inserted, error: insertError } = await supabase
    .from("sentence_mining_cards")
    .insert({
      user_id: user.id,
      video_id: (transcript as { video_id: string }).video_id,
      transcript_line_id: lineRow.id,
      target_word: input.targetWord,
      reading: input.reading ?? null,
      sentence_jp: lineRow.text_jp,
      sentence_translation: lineRow.text_translation ?? input.sentenceTranslation ?? null,
      start_time: lineRow.start_time,
      end_time: lineRow.end_time,
    })
    .select(CARD_COLUMNS)
    .single();
  if (insertError) return { ok: false, status: 400 };

  return { ok: true, data: inserted as MiningCardRow };
}

export type ReviewMiningCardResult =
  | { ok: true; data: { repetitions: number; intervalDays: number; easeFactor: number; nextReviewAt: string } }
  | { ok: false; status: 401 | 400 };

/**
 * Apply one SM-2 review to a mining card, looked up by its own `id` (the
 * id-keyed variant of `submitReview` in `lib/data/srs.ts`, which is
 * composite-keyed on itemType/itemId). RLS confines the lookup to the
 * caller's own cards, so an id that doesn't resolve is a 400.
 */
export async function reviewMiningCard(
  input: ReviewMiningCardInput,
  now: Date = new Date(),
): Promise<ReviewMiningCardResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const { data: existing, error: loadError } = await supabase
    .from("sentence_mining_cards")
    .select("srs_stage, interval_days, ease_factor")
    .eq("id", input.cardId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (loadError) throw loadError;
  if (!existing) return { ok: false, status: 400 };

  const state: SrsState = {
    repetitions: existing.srs_stage,
    intervalDays: existing.interval_days,
    easeFactor: Number(existing.ease_factor),
  };

  const next = reviewItem(state, input.quality as Quality, now);

  const { error: updateError } = await supabase
    .from("sentence_mining_cards")
    .update({
      srs_stage: next.repetitions,
      interval_days: next.intervalDays,
      ease_factor: next.easeFactor,
      next_review_at: next.nextReviewAt.toISOString(),
      last_reviewed_at: next.lastReviewedAt.toISOString(),
    })
    .eq("id", input.cardId)
    .eq("user_id", user.id);
  // A bad cardId would already have failed the maybeSingle() lookup above, so
  // any error here reflects a genuine write failure — still surfaced as 400
  // rather than a 500 to keep the endpoint's error contract simple.
  if (updateError) return { ok: false, status: 400 };

  return {
    ok: true,
    data: {
      repetitions: next.repetitions,
      intervalDays: next.intervalDays,
      easeFactor: next.easeFactor,
      nextReviewAt: next.nextReviewAt.toISOString(),
    },
  };
}

/** Review-friendly shape: front = sentence + target, back = reading/translation. */
export interface MiningQueueItem {
  id: string;
  sentenceJp: string;
  targetWord: string;
  reading: string | null;
  translation: string | null;
  videoId: string;
  startTime: number | null;
  endTime: number | null;
}

interface QueueRow {
  id: string;
  sentence_jp: string;
  target_word: string;
  reading: string | null;
  sentence_translation: string | null;
  video_id: string;
  start_time: number | null;
  end_time: number | null;
  next_review_at: string | null;
  last_reviewed_at: string | null;
}

function toQueueItem(row: QueueRow): MiningQueueItem {
  return {
    id: row.id,
    sentenceJp: row.sentence_jp,
    targetWord: row.target_word,
    reading: row.reading,
    translation: row.sentence_translation,
    videoId: row.video_id,
    startTime: row.start_time,
    endTime: row.end_time,
  };
}

export type GetMiningQueueResult = { ok: true; data: MiningQueueItem[] } | { ok: false; status: 401 };

/**
 * Due-then-fresh queue for the current user, mirroring
 * `getReviewQueue`'s ordering (`lib/data/srs.ts`): cards whose
 * `next_review_at` has passed (soonest first), then never-reviewed cards,
 * capped at `limit`. Cards reviewed but not yet due are held back.
 */
export async function getMiningQueue(now: Date = new Date(), limit = 20): Promise<GetMiningQueueResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const { data, error } = await supabase
    .from("sentence_mining_cards")
    .select(
      "id, sentence_jp, target_word, reading, sentence_translation, video_id, start_time, end_time, next_review_at, last_reviewed_at",
    )
    .eq("user_id", user.id);
  if (error) throw error;

  const rows = (data as QueueRow[]) ?? [];
  const nowMs = now.getTime();

  const due: { row: QueueRow; at: number }[] = [];
  const fresh: QueueRow[] = [];
  for (const row of rows) {
    if (!row.last_reviewed_at) {
      fresh.push(row);
      continue;
    }
    const at = row.next_review_at ? new Date(row.next_review_at).getTime() : 0;
    if (at <= nowMs) due.push({ row, at });
  }
  due.sort((a, b) => a.at - b.at);

  const ordered = [...due.map((d) => d.row), ...fresh].slice(0, limit);
  return { ok: true, data: ordered.map(toQueueItem) };
}

export interface MiningCardListItem extends MiningQueueItem {
  createdAt: string;
  srsStage: number;
  intervalDays: number;
  easeFactor: number;
  nextReviewAt: string | null;
  lastReviewedAt: string | null;
}

export type ListMiningCardsResult = { ok: true; data: MiningCardListItem[] } | { ok: false; status: 401 };

/** The current user's full mining deck, newest first, for a deck page. */
export async function listMiningCards(): Promise<ListMiningCardsResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const { data, error } = await supabase
    .from("sentence_mining_cards")
    .select(CARD_COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data as MiningCardRow[]) ?? [];
  return {
    ok: true,
    data: rows.map((row) => ({
      ...toQueueItem(row),
      createdAt: row.created_at,
      srsStage: row.srs_stage,
      intervalDays: row.interval_days,
      easeFactor: Number(row.ease_factor),
      nextReviewAt: row.next_review_at,
      lastReviewedAt: row.last_reviewed_at,
    })),
  };
}
