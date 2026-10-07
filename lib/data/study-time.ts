import "server-only";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import type { StudySurface } from "@/lib/study-time/surfaces";
import { getStudyTimezone } from "@/lib/time/study-timezone";
import { fetchAllPages } from "@/lib/data/query-pagination";

const HEARTBEAT_LIMIT = { limit: 12, windowMs: 60_000 };

export interface StudyTime {
  totalSeconds: number;
  days: { day: string; seconds: number }[];
}

export async function getStudyTime(from: Date, to: Date): Promise<StudyTime> {
  const { timeZone } = await getStudyTimezone();
  const supabase = createClient();
  const query = supabase.rpc("study_time", {
    p_tz: timeZone,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  const ordered = query.order("day", { ascending: true });
  const rows = await fetchAllPages<{ day: string; seconds: number | string }>(
    (start, end) => ordered.range(start, end),
  );
  const days = rows.map(({ day, seconds }) => ({
    day, seconds: Number(seconds),
  }));
  return { totalSeconds: days.reduce((sum, row) => sum + row.seconds, 0), days };
}

export async function getTrackedSince(): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("study_tracked_since");
  if (error) throw error;
  return data === null ? null : new Date(data as string).toISOString();
}

export type HeartbeatKind = "start" | "beat" | "stop";
export interface HeartbeatInput {
  clientPresenceId: string;
  sessionId: string | null;
  surface: StudySurface;
  contextId: string | null;
  seq: number;
  kind: HeartbeatKind;
}
export type HeartbeatResult =
  | { kind: "ok"; sessionId: string; acceptedSeq: number; segmented: boolean }
  | { kind: "unauthorized" }
  | { kind: "not_found" }
  | { kind: "rate_limited"; retryAfter: number };

export async function heartbeat(input: HeartbeatInput, now = new Date()): Promise<HeartbeatResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { kind: "unauthorized" };
  const limited = rateLimit(`study:heartbeat:${user.id}`, HEARTBEAT_LIMIT, now.getTime());
  if (!limited.ok) return { kind: "rate_limited", retryAfter: limited.retryAfter };
  const { data, error } = await supabase.rpc("study_heartbeat", {
    p_client_presence: input.clientPresenceId,
    p_session: input.sessionId,
    p_surface: input.surface,
    p_context: input.contextId,
    p_seq: input.seq,
    p_kind: input.kind,
  });
  if (error) {
    if ((error as { code?: string }).code === "P0002") return { kind: "not_found" };
    throw error;
  }
  const row = (data as { session_id: string; accepted_seq: number; segmented: boolean }[] | null)?.[0];
  if (!row) throw new Error("study_heartbeat returned no row");
  return { kind: "ok", sessionId: row.session_id, acceptedSeq: row.accepted_seq, segmented: row.segmented };
}
