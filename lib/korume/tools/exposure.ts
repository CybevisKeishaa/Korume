import "server-only";
import { entriesFor, lookupForms, staticAnalyses } from "@/lib/analysis/line-analysis";
import { getActiveSnapshotId } from "@/lib/dictionary/snapshot";
import type { AnalysisToken } from "@/lib/analysis/types";
import type { Tool } from "../retrieval";

export const EXPOSURE_MAX_VIDEOS = 20;
export const EXPOSURE_MAX_LINES = 3_000;

export interface ExposureData {
  term: string;
  /** `ent:<entSeq>` for a dictionary word, `tok:<base>:<pos>` for a particle or anything JMdict does not hold. */
  identity: string;
  seenCount: number;
  /** True when the line cap cut the scan: the count is a floor and the UI says "N+". */
  capped: boolean;
  label: string;
  reading?: string;
  pos?: string;
  firstSeen?: { videoId: string; lineId: string };
}

export interface ProgressRow { videoId: string; lastWatchedPosition: number; completed: boolean }
export interface ExposureLine { id: string; videoId: string; startTime: number; textJp: string }

export function tokenIdentity(token: AnalysisToken): string {
  const entry = token.entries[0];
  return entry ? `ent:${entry.entSeq}` : `tok:${token.base}:${token.pos}`;
}

/**
 * The lines this learner actually reached (spec §5.3): all of a completed video, the part of an unfinished one
 * up to where they last were, and any line they shadowed. No high-water mark — after a rewind the count can drop,
 * which undercounts rather than claims they saw what they skipped. Order: video recency, then time in the video.
 */
export function seenLines(progress: ProgressRow[], lines: ExposureLine[], shadowed: Set<string>): ExposureLine[] {
  const rank = new Map(progress.map((p, i) => [p.videoId, i]));
  const byVideo = new Map(progress.map((p) => [p.videoId, p]));
  return lines
    .filter((l) => {
      const p = byVideo.get(l.videoId);
      return !!p && (p.completed || l.startTime <= p.lastWatchedPosition || shadowed.has(l.id));
    })
    .sort((a, b) => (rank.get(a.videoId) ?? 0) - (rank.get(b.videoId) ?? 0) || a.startTime - b.startTime || a.id.localeCompare(b.id));
}

/**
 * How many seen lines contain the term — by identity, never by substring: 日本 does not match 日本語. A term can
 * name several identities (は the particle, 歯 read は); the one on the most lines is the one the learner means.
 */
export function countExposure(
  term: string, termEntSeqs: Set<number>, lines: { videoId: string; lineId: string; tokens: AnalysisToken[] }[],
): Omit<ExposureData, "capped"> {
  const tally = new Map<string, { count: number; token: AnalysisToken; first: { videoId: string; lineId: string } }>();
  for (const line of lines) {
    const inLine = new Map<string, AnalysisToken>();
    for (const token of line.tokens) {
      const entry = token.entries[0];
      const matches = entry ? termEntSeqs.has(entry.entSeq) : token.base === term || token.surface === term;
      if (matches && !inLine.has(tokenIdentity(token))) inLine.set(tokenIdentity(token), token);
    }
    for (const [identity, token] of inLine) {
      const seen = tally.get(identity);
      if (seen) seen.count += 1;
      else tally.set(identity, { count: 1, token, first: { videoId: line.videoId, lineId: line.lineId } });
    }
  }
  let best: [string, { count: number; token: AnalysisToken; first: { videoId: string; lineId: string } }] | undefined;
  for (const entry of tally) if (!best || entry[1].count > best[1].count) best = entry;
  if (!best) return { term, identity: `tok:${term}:`, seenCount: 0, label: term };
  const [identity, { count, token, first }] = best;
  const entry = token.entries[0];
  return {
    term, identity, seenCount: count,
    label: entry?.headword ?? token.base,
    ...(entry?.reading ? { reading: entry.reading } : token.reading ? { reading: token.reading } : {}),
    pos: token.pos,
    firstSeen: first,
  };
}

/** `learner_exposure`: "seen N times" over the learner's own recent progress (spec §5.3). */
export const exposureTool: Tool = async (step, ctx) => {
  if (step.tool !== "learner_exposure") return { status: "not_found" };
  const { supabase, userId } = ctx;

  const progress = await supabase.from("user_video_progress")
    .select("video_id, last_watched_position, completed_at")
    .eq("user_id", userId)
    .order("last_watched_at", { ascending: false, nullsFirst: false }).order("video_id", { ascending: true })
    .limit(EXPOSURE_MAX_VIDEOS);
  if (progress.error) throw progress.error;
  const rows: ProgressRow[] = ((progress.data ?? []) as { video_id: string; last_watched_position: number | string; completed_at: string | null }[])
    .map((r) => ({ videoId: r.video_id, lastWatchedPosition: Number(r.last_watched_position), completed: r.completed_at !== null }));
  if (rows.length === 0) return { status: "ok", data: { ...countExposure(step.term, new Set(), []), capped: false } };

  const videoIds = rows.map((r) => r.videoId);
  const transcripts = await supabase.rpc("latest_transcript_ids", { p_video_ids: videoIds });
  if (transcripts.error) throw transcripts.error;
  const videoOf = new Map(((transcripts.data ?? []) as { video_id: string; transcript_id: string }[]).map((t) => [t.transcript_id, t.video_id]));
  const byVideo = new Map(rows.map((r) => [r.videoId, r]));

  const shadow = await supabase.from("shadowing_sessions").select("transcript_line_id")
    .eq("user_id", userId).in("video_id", videoIds).not("transcript_line_id", "is", null).limit(EXPOSURE_MAX_LINES);
  if (shadow.error) throw shadow.error;
  const shadowed = new Set(((shadow.data ?? []) as { transcript_line_id: string }[]).map((s) => s.transcript_line_id));

  // One bounded read per video: the server filters by position, so an unwatched tail never crosses the wire.
  const perVideo = await Promise.all([...videoOf].map(async ([transcriptId, videoId]) => {
    const p = byVideo.get(videoId);
    let query = supabase.from("transcript_lines").select("id, start_time, text_jp").eq("transcript_id", transcriptId);
    if (p && !p.completed) query = query.lte("start_time", p.lastWatchedPosition);
    const { data, error } = await query.order("start_time", { ascending: true }).order("id", { ascending: true }).limit(EXPOSURE_MAX_LINES + 1);
    if (error) throw error;
    return ((data ?? []) as { id: string; start_time: number | string; text_jp: string | null }[])
      .filter((l) => l.text_jp).map((l) => ({ id: l.id, videoId, startTime: Number(l.start_time), textJp: l.text_jp as string }));
  }));
  const known = new Set(perVideo.flat().map((l) => l.id));
  const extraIds = [...shadowed].filter((id) => !known.has(id));
  const extra: ExposureLine[] = [];
  if (extraIds.length) {
    const { data, error } = await supabase.from("transcript_lines").select("id, transcript_id, start_time, text_jp").in("id", extraIds.slice(0, EXPOSURE_MAX_LINES));
    if (error) throw error;
    for (const l of (data ?? []) as { id: string; transcript_id: string; start_time: number | string; text_jp: string | null }[]) {
      const videoId = videoOf.get(l.transcript_id);
      if (videoId && l.text_jp) extra.push({ id: l.id, videoId, startTime: Number(l.start_time), textJp: l.text_jp });
    }
  }

  const seen = seenLines(rows, [...perVideo.flat(), ...extra], shadowed);
  const capped = seen.length > EXPOSURE_MAX_LINES || perVideo.some((v) => v.length > EXPOSURE_MAX_LINES);
  const scanned = seen.slice(0, EXPOSURE_MAX_LINES);
  const analyses = await staticAnalyses(supabase, scanned.map((l) => ({ id: l.id, textJp: l.textJp })), undefined, "lexical");

  const snapshotId = await getActiveSnapshotId();
  const entSeqs = snapshotId
    ? new Set(entriesFor(step.term, step.term, await lookupForms(supabase, snapshotId, [step.term])).map((m) => m.entSeq))
    : new Set<number>();
  const counted = countExposure(step.term, entSeqs, scanned.map((l) => ({ videoId: l.videoId, lineId: l.id, tokens: analyses.get(l.id)?.tokens ?? [] })));
  return { status: "ok", data: { ...counted, capped } satisfies ExposureData };
};
