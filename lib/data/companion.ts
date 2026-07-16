import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dedupeKeyFor, titleFor, type CompanionMemory, type MemoryType } from "@/lib/companion";
import type { MemoryRef } from "@/lib/companion/dedupe";

export interface DiscoveredMemoryInput {
  userId: string;
  memoryType: MemoryType;
  ref?: MemoryRef;
  isAnchor?: boolean;
  videoId?: string | null;
  transcriptLineId?: string | null;
  timestampSeconds?: number | null;
  lineTextJp?: string | null;
  occurredAt?: string;
}

interface MemoryRow {
  id: string;
  kind: CompanionMemory["kind"];
  memory_type: MemoryType;
  title: string | null;
  video_id: string | null;
  transcript_line_id: string | null;
  timestamp_seconds: number | null;
  line_text_jp: string | null;
  note: string | null;
  is_anchor: boolean;
  occurred_at: string;
}

function toMemory(row: MemoryRow): CompanionMemory {
  return {
    id: row.id,
    kind: row.kind,
    memoryType: row.memory_type,
    title: row.title,
    videoId: row.video_id,
    transcriptLineId: row.transcript_line_id,
    timestampSeconds: row.timestamp_seconds,
    lineTextJp: row.line_text_jp,
    note: row.note,
    isAnchor: row.is_anchor,
    occurredAt: row.occurred_at,
  };
}

/** Insert-or-ignore a DISCOVERED memory on its natural dedupe key (§4.3). Returns
 * true iff a row was newly created — same idempotency pattern as xp_events. The
 * caller passes a SERVICE-ROLE client (the capture gate); a learner can never
 * forge a discovered memory (RLS insert policy is gifted-only). */
export async function recordDiscoveredMemory(
  supabase: SupabaseClient,
  input: DiscoveredMemoryInput,
): Promise<boolean> {
  const dedupeKey = dedupeKeyFor(input.memoryType, input.ref);
  const { data, error } = await supabase
    .from("companion_memories")
    .upsert(
      {
        user_id: input.userId,
        kind: "discovered",
        memory_type: input.memoryType,
        title: titleFor(input.memoryType, input.ref),
        video_id: input.videoId ?? null,
        transcript_line_id: input.transcriptLineId ?? null,
        timestamp_seconds: input.timestampSeconds ?? null,
        line_text_jp: input.lineTextJp ?? null,
        is_anchor: input.isAnchor ?? false,
        dedupe_key: dedupeKey,
        ...(input.occurredAt ? { occurred_at: input.occurredAt } : {}),
      },
      { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data != null;
}

const MEMORY_COLUMNS =
  "id, kind, memory_type, title, video_id, transcript_line_id, timestamp_seconds, line_text_jp, note, is_anchor, occurred_at";

/** The learner's Journal, newest moment first. ALWAYS ordered by occurred_at,
 * never created_at (§4.2). Pass an owner-scoped client so RLS returns only the
 * learner's rows (§12.4). */
export async function listJournal(supabase: SupabaseClient, userId: string): Promise<CompanionMemory[]> {
  const { data, error } = await supabase
    .from("companion_memories")
    .select(MEMORY_COLUMNS)
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as MemoryRow[]).map(toMemory);
}

/** The Companion's own anchor memories (§6.4) — the bounded set reflection reads. */
export async function getAnchorMemories(supabase: SupabaseClient, userId: string): Promise<CompanionMemory[]> {
  const { data, error } = await supabase
    .from("companion_memories")
    .select(MEMORY_COLUMNS)
    .eq("user_id", userId)
    .eq("is_anchor", true)
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as MemoryRow[]).map(toMemory);
}
