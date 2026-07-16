import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dedupeKeyFor, relationshipPhaseForXp, titleFor, type CompanionMemory, type MemoryType } from "@/lib/companion";
import type { MemoryRef } from "@/lib/companion/dedupe";
import type { LearningOutcomeSource, SourceIdParts } from "@/lib/gamification";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/data/videos";
import type { PinMemoryInput } from "@/lib/validation/companion";

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

export interface CaptureInput {
  userId: string;
  source: LearningOutcomeSource;
  parts: SourceIdParts;
  prevXp: number;
  nextXp: number;
  now?: Date;
}

/** Resolves a transcript line back to its video and Japanese text. Used by
 * the `first_shadow` producer (and available to future line-pointer
 * producers) to attach the pointer a discovered memory needs. */
async function resolveLinePointer(
  supabase: SupabaseClient,
  lineId: string,
): Promise<{ videoId: string | null; lineTextJp: string | null; timestampSeconds: number | null }> {
  const { data: line } = await supabase
    .from("transcript_lines")
    .select("text_jp, start_time, transcript_id")
    .eq("id", lineId)
    .maybeSingle();
  const row = line as { text_jp: string | null; start_time: number | null; transcript_id: string | null } | null;
  let videoId: string | null = null;
  if (row?.transcript_id) {
    const { data: t } = await supabase.from("transcripts").select("video_id").eq("id", row.transcript_id).maybeSingle();
    videoId = (t as { video_id: string | null } | null)?.video_id ?? null;
  }
  return { videoId, lineTextJp: row?.text_jp ?? null, timestampSeconds: row?.start_time ?? null };
}

/** The capture gate (spec §4.3). Observes a completed learning outcome and
 * records any milestone memory it produces. MUST NEVER throw into the caller —
 * it runs on the learning hot path and a memory hiccup must never fail study
 * (§6.5). Best-effort, mirroring recordActivity. Wires the self-contained
 * `companion_grew` producer plus the source-specific producers that key off
 * `input.parts` (first_shadow, mining_saved, jlpt_passed). `line_mastered`
 * and `first_video_completed` are deferred to Plan 2 — see the Task 7 scope
 * note in the implementation plan. */
export async function captureCompanionMemories(supabase: SupabaseClient, input: CaptureInput): Promise<void> {
  try {
    const prevPhase = relationshipPhaseForXp(input.prevXp);
    const nextPhase = relationshipPhaseForXp(input.nextXp);
    if (nextPhase > prevPhase) {
      // Record one anchor memory per phase actually crossed (a big single
      // award could cross more than one). Idempotent on dedupe_key.
      for (let phase = prevPhase + 1; phase <= nextPhase; phase++) {
        await recordDiscoveredMemory(supabase, {
          userId: input.userId,
          memoryType: "companion_grew",
          ref: { phase: phase as 1 | 2 | 3 | 4 },
          isAnchor: true,
        });
      }
    }

    // Source-specific milestone producers. Each is idempotent on its dedupe
    // key; the first time it fires becomes a memory, repeats are no-ops.
    if (input.source === "shadowing" && input.parts.lineId) {
      const p = await resolveLinePointer(supabase, input.parts.lineId);
      await recordDiscoveredMemory(supabase, {
        userId: input.userId,
        memoryType: "first_shadow",
        isAnchor: true,
        transcriptLineId: input.parts.lineId,
        videoId: p.videoId,
        lineTextJp: p.lineTextJp,
        timestampSeconds: p.timestampSeconds,
      });
    }

    if (input.source === "mining_review" && input.parts.cardId) {
      const { data: card } = await supabase
        .from("sentence_mining_cards")
        .select("transcript_line_id, sentence_jp, start_time, video_id")
        .eq("id", input.parts.cardId)
        .maybeSingle();
      const c = card as
        | { transcript_line_id: string | null; sentence_jp: string | null; start_time: number | null; video_id: string | null }
        | null;
      await recordDiscoveredMemory(supabase, {
        userId: input.userId,
        memoryType: "mining_saved",
        ref: { cardId: input.parts.cardId },
        transcriptLineId: c?.transcript_line_id ?? null,
        videoId: c?.video_id ?? null,
        lineTextJp: c?.sentence_jp ?? null,
        timestampSeconds: c?.start_time ?? null,
      });
    }

    if (input.source === "jlpt_submit" && input.parts.testId) {
      const { data: test } = await supabase.from("jlpt_tests").select("level").eq("id", input.parts.testId).maybeSingle();
      const level = (test as { level: string | null } | null)?.level;
      if (level) {
        await recordDiscoveredMemory(supabase, {
          userId: input.userId,
          memoryType: "jlpt_passed",
          ref: { jlptLevel: level },
          isAnchor: true,
        });
      }
    }
  } catch (err) {
    console.error("[companion] captureCompanionMemories failed:", err);
  }
}

const PIN_LIMIT = { limit: 60, windowMs: 60_000 };

export type PinMemoryResult =
  | { ok: true }
  | { ok: false; status: 401 | 400 | 500 }
  | { ok: false; status: 429; retryAfter: number };

export type GetJournalResult = { ok: true; data: CompanionMemory[] } | { ok: false; status: 401 };

/** Pin a transcript line as a GIFTED memory. Goes through the USER's client so
 * RLS enforces ownership and kind='gifted' (a learner can only ever create
 * their own gifted memories). A duplicate pin (unique violation) is a no-op
 * success, not an error. */
export async function pinMemory(input: PinMemoryInput, now: Date = new Date()): Promise<PinMemoryResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`companion:pin:${user.id}`, PIN_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  // RLS confines this to lines whose parent transcript's video is visible to
  // the caller; a transcriptLineId that doesn't resolve (bad id, or not
  // visible) is a 400, not a 500 — same pre-check `createMiningCard` does in
  // lib/data/mining.ts before its insert.
  const { data: line, error: lineError } = await supabase
    .from("transcript_lines")
    .select("id")
    .eq("id", input.transcriptLineId)
    .maybeSingle();
  if (lineError) throw lineError;
  if (!line) return { ok: false, status: 400 };

  const { error } = await supabase.from("companion_memories").insert({
    user_id: user.id,
    kind: "gifted",
    memory_type: "pinned_line",
    title: null, // learner-supplied or blank (§4.4) — never AI
    video_id: input.videoId ?? null,
    transcript_line_id: input.transcriptLineId,
    timestamp_seconds: input.timestampSeconds ?? null,
    line_text_jp: input.lineTextJp ?? null,
    note: input.note ?? null,
    dedupe_key: dedupeKeyFor("pinned_line", { lineId: input.transcriptLineId }),
  });
  if (error && error.code !== "23505") return { ok: false, status: 500 };
  return { ok: true };
}

/** The authed learner's Journal (owner-scoped, RLS → only their rows, §12.4). */
export async function getJournal(): Promise<GetJournalResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };
  const data = await listJournal(supabase, user.id);
  return { ok: true, data };
}
