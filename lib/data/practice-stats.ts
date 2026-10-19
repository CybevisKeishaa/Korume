import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { REVIEW_PRONUNCIATION_BELOW } from "@/lib/summary/thresholds";

const numeric = z.coerce.number();
const statsSchema = z.object({
  lineCount: numeric,
  scoredLines: numeric,
  mean: numeric.nullable(),
  lines: z.array(z.object({
    lineId: z.string(),
    state: z.enum(["scored", "needs_review", "unscored"]),
    score: numeric.nullable(),
  })),
});

export type PracticeLineState = "none" | "scored" | "needs_review" | "unscored";
export interface PracticeStats {
  lineCount: number;
  scoredLines: number;
  mean: number | null;
  lines: Record<string, { state: PracticeLineState; score: number | null }>;
}

export async function loadPracticeStats(videoId: string, mode: "pronunciation"):
  Promise<{ ok: true; data: PracticeStats } | { ok: false; status: 401 }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401 };

  const { data, error } = await supabase.rpc("practice_stats", {
    p_video: videoId, p_mode: mode, p_review_below: REVIEW_PRONUNCIATION_BELOW,
  });
  if (error) throw error;
  const parsed = statsSchema.parse(data);
  return { ok: true, data: {
    ...parsed,
    mean: parsed.mean === null ? null : Math.round(parsed.mean),
    lines: Object.fromEntries(parsed.lines.map((line) => [line.lineId, {
      state: line.state, score: line.score === null ? null : Math.round(line.score),
    }])),
  } };
}
