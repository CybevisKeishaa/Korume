import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import { parseKanjiLiteral } from "@/lib/dictionary/literal";
import { getActiveSnapshotId } from "@/lib/dictionary/snapshot";
import type { KanjiFavorite, KanjiLearnerState } from "@/lib/kanji/learner-types";

export type KanjiActionResult =
  | { ok: true }
  | { ok: false; status: 400 | 401 | 404 }
  | { ok: false; status: 429; retryAfter: number };

const ACTION_LIMIT = { limit: 60, windowMs: 60_000 };

/** The caller and a literal known to the active snapshot, or the refusal to return (401, 400, 429, 404 in that order). */
async function guard(rawLiteral: string, route: "favorite" | "review") {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { fail: { ok: false, status: 401 } as const };
  const literal = parseKanjiLiteral(rawLiteral);
  if (!literal) return { fail: { ok: false, status: 400 } as const };
  const limit = rateLimit(`kanji-${route}:${user.id}`, ACTION_LIMIT);
  if (!limit.ok) return { fail: { ok: false, status: 429, retryAfter: limit.retryAfter } as const };
  const snapshotId = await getActiveSnapshotId();
  if (!snapshotId) return { fail: { ok: false, status: 404 } as const };
  const { data, error } = await supabase.from("dict_kanji").select("literal").eq("snapshot_id", snapshotId).eq("literal", literal).maybeSingle();
  if (error) throw error;
  if (!data) return { fail: { ok: false, status: 404 } as const };
  return { supabase, userId: user.id, literal };
}

/** Star or unstar a kanji; both directions are idempotent. */
export async function setKanjiFavorite(rawLiteral: string, favorite: boolean): Promise<KanjiActionResult> {
  const g = await guard(rawLiteral, "favorite");
  if (g.fail) return g.fail;
  const table = g.supabase.from("user_kanji_favorites");
  const { error } = favorite
    ? await table.upsert({ user_id: g.userId, literal: g.literal }, { onConflict: "user_id,literal", ignoreDuplicates: true })
    : await table.delete().eq("user_id", g.userId).eq("literal", g.literal);
  if (error) throw error;
  return { ok: true };
}

/** Start reviewing a kanji today; a kanji already in review is left exactly as it is. */
export async function addKanjiToReview(rawLiteral: string): Promise<KanjiActionResult> {
  const g = await guard(rawLiteral, "review");
  if (g.fail) return g.fail;
  const { error } = await g.supabase.from("user_kanji_progress").upsert(
    { user_id: g.userId, literal: g.literal, srs_stage: 0, next_review_at: new Date().toISOString(), reviews: 0 },
    { onConflict: "user_id,literal", ignoreDuplicates: true },
  );
  if (error) throw error;
  return { ok: true };
}

/** The caller favorite flag and review progress for one (already validated) literal. */
export async function getKanjiLearnerState(literal: string): Promise<KanjiLearnerState> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { favorite: false, progress: null };
  const [fav, progress] = await Promise.all([
    supabase.from("user_kanji_favorites").select("literal").eq("user_id", user.id).eq("literal", literal).maybeSingle(),
    supabase.from("user_kanji_progress").select("srs_stage, reviews, lapses, next_review_at").eq("user_id", user.id).eq("literal", literal).maybeSingle(),
  ]);
  if (fav.error) throw fav.error;
  if (progress.error) throw progress.error;
  const row = progress.data as { srs_stage: number; reviews: number; lapses: number; next_review_at: string | null } | null;
  return {
    favorite: Boolean(fav.data),
    progress: row ? { stage: row.srs_stage, reviews: row.reviews, lapses: row.lapses, nextReviewAt: row.next_review_at } : null,
  };
}

/** The caller starred kanji, newest first, with Han-Viet readings from the active snapshot. */
export async function listKanjiFavorites(): Promise<KanjiFavorite[]> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return [];
  const { data, error } = await supabase
    .from("user_kanji_favorites")
    .select("literal")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const literals = ((data ?? []) as { literal: string }[]).map((row) => row.literal);
  const snapshotId = literals.length > 0 ? await getActiveSnapshotId() : null;
  if (!snapshotId) return literals.map((literal) => ({ literal, hanViet: [] }));
  const { data: kanji, error: kanjiError } = await supabase
    .from("dict_kanji")
    .select("literal, vi_readings")
    .eq("snapshot_id", snapshotId)
    .in("literal", literals);
  if (kanjiError) throw kanjiError;
  const readings = new Map(((kanji ?? []) as { literal: string; vi_readings: string[] }[]).map((row) => [row.literal, row.vi_readings]));
  return literals.map((literal) => ({ literal, hanViet: readings.get(literal) ?? [] }));
}
