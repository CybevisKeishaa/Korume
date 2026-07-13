import "server-only";
import { createClient } from "@/lib/supabase/server";
import { reviewItem, INITIAL_STATE, type Quality, type SrsState } from "@/lib/srs";
import { getKanjiList, getVocabList } from "@/lib/data/content";
import { recordActivity } from "@/lib/data/gamification";
import type { ReviewItem } from "@/lib/learning-types";
import type { ItemType, JlptLevel, SrsReviewInput } from "@/lib/validation/content";

const PROGRESS = {
  kanji: { table: "user_kanji_progress", fk: "kanji_id" },
  vocab: { table: "user_vocab_progress", fk: "vocab_id" },
} as const;

export type SubmitReviewResult =
  | { ok: true; data: { repetitions: number; intervalDays: number; easeFactor: number; nextReviewAt: string } }
  | { ok: false; status: 401 | 400 };

/**
 * Apply one SRS review for the current user: load the item's progress, run the
 * SM-2 engine, and upsert the next state. RLS confines every row to its owner,
 * so a user can only ever move their own progress. `now` is injectable for
 * deterministic tests.
 */
export async function submitReview(
  input: SrsReviewInput,
  now: Date = new Date(),
): Promise<SubmitReviewResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401 };

  const { table, fk } = PROGRESS[input.itemType];

  const { data: existing, error: loadError } = await supabase
    .from(table)
    .select("srs_stage, interval_days, ease_factor")
    .eq("user_id", user.id)
    .eq(fk, input.itemId)
    .maybeSingle();
  if (loadError) throw loadError;

  const state: SrsState = existing
    ? {
        repetitions: existing.srs_stage,
        intervalDays: existing.interval_days,
        easeFactor: Number(existing.ease_factor),
      }
    : { ...INITIAL_STATE };

  const next = reviewItem(state, input.quality as Quality, now);

  const { error: upsertError } = await supabase.from(table).upsert(
    {
      user_id: user.id,
      [fk]: input.itemId,
      srs_stage: next.repetitions,
      interval_days: next.intervalDays,
      ease_factor: next.easeFactor,
      next_review_at: next.nextReviewAt.toISOString(),
      last_reviewed_at: next.lastReviewedAt.toISOString(),
    },
    { onConflict: `user_id,${fk}` },
  );
  // A bad itemId violates the FK — surface as a 400 rather than a 500.
  if (upsertError) return { ok: false, status: 400 };

  // Best-effort: gamification never fails a learning-flow request (see
  // lib/data/gamification.ts::recordActivity).
  await recordActivity({
    userId: user.id,
    source: "srs_review",
    parts: { itemType: input.itemType, itemId: input.itemId },
    now,
  });

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

/**
 * Build a review queue for the current user: items that are due
 * (next_review_at ≤ now, soonest first) followed by never-seen items, capped at
 * `limit`. Items already reviewed and not yet due are held back — this is what
 * makes the session actually spaced.
 */
export async function getReviewQueue(
  itemType: ItemType,
  level: JlptLevel | undefined,
  limit = 20,
  now: Date = new Date(),
): Promise<ReviewItem[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const items: ReviewItem[] =
    itemType === "vocab"
      ? (await getVocabList(level)).map((v) => ({
          id: v.id,
          front: v.word,
          sub: v.reading ?? undefined,
          back: v.meaning_en ?? "",
        }))
      : (await getKanjiList(level)).map((k) => ({
          id: k.id,
          front: k.character,
          back: k.meaning_en ?? "",
        }));

  if (!user) return items.slice(0, limit);

  const { table, fk } = PROGRESS[itemType];
  const { data: progress, error } = await supabase
    .from(table)
    .select(`${fk}, next_review_at`)
    .eq("user_id", user.id);
  if (error) throw error;

  // itemId -> scheduled time (ms); null means seen but unscheduled (treat due).
  const scheduledAt = new Map<string, number | null>();
  for (const row of (progress ?? []) as Record<string, unknown>[]) {
    const id = row[fk] as string;
    const at = row.next_review_at as string | null;
    scheduledAt.set(id, at ? new Date(at).getTime() : null);
  }

  const nowMs = now.getTime();
  const due: { item: ReviewItem; at: number }[] = [];
  const fresh: ReviewItem[] = [];
  for (const item of items) {
    if (!scheduledAt.has(item.id)) {
      fresh.push(item);
      continue;
    }
    const at = scheduledAt.get(item.id) ?? 0;
    if (at <= nowMs) due.push({ item, at });
  }
  due.sort((a, b) => a.at - b.at);

  return [...due.map((d) => d.item), ...fresh].slice(0, limit);
}
