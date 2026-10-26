import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { REVIEW_DICTATION_BELOW, REVIEW_PRONUNCIATION_BELOW } from "@/lib/summary/thresholds";
import type { PracticeStatsMode } from "@/lib/shadowing-workspace/learning-modes";

const numeric = z.coerce.number();
const statsSchema = z.object({
  lineCount: numeric,
  scoredLines: numeric,
  mean: numeric.nullable(),
  /** Listening only (049): lines whose latest submitted attempt was helped. */
  helpedLines: numeric.optional(),
  lines: z.array(z.object({
    lineId: z.string(),
    state: z.enum(["scored", "needs_review", "unscored", "revealed", "helped"]),
    score: numeric.nullable(),
  })),
});

export type PracticeLineState = "none" | "scored" | "needs_review" | "unscored" | "revealed" | "helped";
/** The one review cut per mode; Listening's two exercises share `REVIEW_DICTATION_BELOW` (R2). */
const REVIEW_BELOW: Record<PracticeStatsMode, number> = { pronunciation: REVIEW_PRONUNCIATION_BELOW, dictation: REVIEW_DICTATION_BELOW, cloze: REVIEW_DICTATION_BELOW };
export interface PracticeStats {
  lineCount: number;
  scoredLines: number;
  mean: number | null;
  /** `null` for pronunciation, which has no help. */
  helpedLines: number | null;
  lines: Record<string, { state: PracticeLineState; score: number | null }>;
}

export async function loadPracticeStats(videoId: string, mode: PracticeStatsMode):
  Promise<{ ok: true; data: PracticeStats } | { ok: false; status: 401 }> {
  // R11: `practice_stats` reads pronunciation for a NULL mode, so an unknown mode never reaches it.
  if (!Object.hasOwn(REVIEW_BELOW, mode)) throw new Error(`practice stats: unknown mode ${String(mode)}`);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401 };

  const { data, error } = await supabase.rpc("practice_stats", {
    p_video: videoId, p_mode: mode, p_review_below: REVIEW_BELOW[mode],
  });
  if (error) throw error;
  const parsed = statsSchema.parse(data);
  return { ok: true, data: {
    ...parsed,
    mean: parsed.mean === null ? null : Math.round(parsed.mean),
    helpedLines: parsed.helpedLines ?? null,
    lines: Object.fromEntries(parsed.lines.map((line) => [line.lineId, {
      state: line.state, score: line.score === null ? null : Math.round(line.score),
    }])),
  } };
}
