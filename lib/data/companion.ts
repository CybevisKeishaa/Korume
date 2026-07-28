import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  dedupeKeyFor,
  qualifiesAsLineMastered,
  relationshipPhaseForXp,
  TARGET_SCORE,
  type CompanionMemory,
  type MemoryType,
} from "@/lib/companion";
import type { MemoryRef } from "@/lib/companion/dedupe";
import type { LearningOutcomeSource, SourceIdParts } from "@/lib/gamification";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
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
  dedupe_key: string | null;
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
    dedupeKey: row.dedupe_key,
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
        // Discovered memories persist NO rendered title (L9a, spec §4.4):
        // this is a service-role write path with no request locale in
        // scope, so freezing one locale's copy here would be wrong for
        // every reader in every other locale. `memoryTitleFor()`
        // (lib/companion/dedupe.ts) resolves the descriptor {key, values}
        // this memory_type + ref maps to; the Journal (L9b) renders it at
        // READ time via `t(descriptor.key, descriptor.values)`, in the
        // reader's own locale.
        title: null,
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
  "id, kind, memory_type, title, video_id, transcript_line_id, timestamp_seconds, line_text_jp, note, is_anchor, occurred_at, dedupe_key";

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
  /** Only meaningful when `source === 'jlpt_submit'` — a genuine pass. */
  passed?: boolean;
  now?: Date;
}

/** The capture gate (spec §4.3). Observes a completed learning outcome and
 * records any milestone memory it produces. MUST NEVER throw into the caller —
 * it runs on the learning hot path and a memory hiccup must never fail study
 * (§6.5). Best-effort, mirroring recordActivity. Wires the self-contained
 * `companion_grew` producer plus the source-specific producers that key off
 * `input.parts` (mining_saved, jlpt_passed). `first_shadow`, `line_mastered`,
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

    if (input.source === "jlpt_submit" && input.parts.testId && input.passed === true) {
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

export interface ShadowScoreCaptureInput {
  userId: string;
  sessionId: string;
  videoId: string | null;
  transcriptLineId: string | null;
  pronunciationScore: number;
}

/**
 * `first_shadow` + `line_mastered` producers (spec §6). Hooks the pronunciation
 * score WRITE, not session creation — scores don't exist yet when a shadowing
 * session row is inserted; Azure fills them in later (see
 * `lib/data/pronunciation.ts::scorePronunciation`).
 *
 * Best-effort and idempotent: it MUST NEVER throw into the scoring request
 * (§6.5), and the dedupe keys make repeats no-ops — `first_shadow` is a
 * constant key (the first line the learner ever shadows to target, DB-enforced
 * by the unique upsert), `line_mastered` is keyed per line.
 */
export async function captureShadowScoreMemories(input: ShadowScoreCaptureInput): Promise<void> {
  if (input.pronunciationScore < TARGET_SCORE) return;

  // Service role: discovered memories have a gifted-only RLS insert policy,
  // so the capture gate writes with the same client `recordDiscoveredMemory`
  // documents.
  let service: SupabaseClient;
  let lineTextJp: string | null = null;
  let timestampSeconds: number | null = null;
  try {
    service = createServiceClient();
    if (input.transcriptLineId) {
      const { data: line, error: lineError } = await service
        .from("transcript_lines")
        .select("text_jp, start_time")
        .eq("id", input.transcriptLineId)
        .maybeSingle();
      // A FAILED lookup abandons the whole capture. `first_shadow`'s dedupe
      // key is a constant and duplicates are ignored, so an anchor written
      // now with null pointers because the lookup blipped would be frozen
      // forever — the learner's first-shadow memory could never link back to
      // the moment. A missed memory is recoverable on the next at-target
      // score; a frozen degraded one is not. A row that simply isn't there
      // (`line` null, no error) is NOT a failure — null pointers are correct.
      if (lineError) throw lineError;
      const l = line as { text_jp: string | null; start_time: number | null } | null;
      lineTextJp = l?.text_jp ?? null;
      timestampSeconds = l?.start_time ?? null;
    }
  } catch (err) {
    console.error("[companion] captureShadowScoreMemories line lookup failed:", err);
    return;
  }

  // Each producer gets its OWN try/catch: they are independent milestones, so
  // one failing must never prevent the other from being evaluated. Neither may
  // throw into the scoring request (§6.5).
  try {
    await recordDiscoveredMemory(service, {
      userId: input.userId,
      memoryType: "first_shadow",
      isAnchor: true,
      videoId: input.videoId,
      transcriptLineId: input.transcriptLineId,
      lineTextJp,
      timestampSeconds,
    });
  } catch (err) {
    console.error("[companion] captureShadowScoreMemories first_shadow failed:", err);
  }

  try {
    if (input.transcriptLineId) {
      // This learner's OTHER scored attempts on this same line — the struggle
      // history `qualifiesAsLineMastered` arbitrates on.
      const { data: rows } = await service
        .from("shadowing_sessions")
        .select("pronunciation_score")
        .eq("user_id", input.userId)
        .eq("transcript_line_id", input.transcriptLineId)
        .neq("id", input.sessionId)
        .not("pronunciation_score", "is", null);
      const previous = ((rows ?? []) as { pronunciation_score: number | null }[])
        .map((r) => r.pronunciation_score)
        .filter((score): score is number => score != null);
      if (qualifiesAsLineMastered(previous, input.pronunciationScore)) {
        await recordDiscoveredMemory(service, {
          userId: input.userId,
          memoryType: "line_mastered",
          ref: { lineId: input.transcriptLineId },
          videoId: input.videoId,
          transcriptLineId: input.transcriptLineId,
          lineTextJp,
          timestampSeconds,
        });
      }
    }
  } catch (err) {
    console.error("[companion] captureShadowScoreMemories line_mastered failed:", err);
  }
}

/**
 * `first_video_completed` producer (spec §6). Hooks the video-progress WRITE in
 * `lib/data/videos.ts::updateProgress`, which does NOT go through
 * `recordActivity` — finishing a video is not an XP outcome (G1), so the
 * capture gate has to observe the progress row directly.
 *
 * The dedupe key is a constant, so "the first video the learner EVER finishes"
 * is enforced by the `(user_id, dedupe_key)` unique upsert — race-free at the
 * DB, no pre-check. Every later completion (and every re-completion of the same
 * video) is an ignored duplicate, which also preserves the original
 * `occurred_at`. Never throws (§6.5): a memory hiccup must not fail the
 * learner's progress request.
 */
export async function captureFirstVideoCompleted(userId: string, videoId: string): Promise<void> {
  try {
    // Service role: discovered memories have a gifted-only RLS insert policy.
    const service = createServiceClient();
    await recordDiscoveredMemory(service, {
      userId,
      memoryType: "first_video_completed",
      isAnchor: true,
      videoId,
    });
  } catch (err) {
    console.error("[companion] captureFirstVideoCompleted failed:", err);
  }
}

/**
 * `first_meeting` producer (spec D8): the domain event is "the learner opens
 * the Journal" — the Journal page's server render calls this before reading the
 * journal, so the very first view already contains the first page. There is
 * deliberately no HTTP route: same event, same idempotent server-side capture,
 * one fewer round-trip (precedent: L5's lazy furigana cache writes on read).
 *
 * Auth-aware, so unlike the other producers it resolves the caller itself off
 * the REQUEST-scoped client; the write still goes through the service role,
 * since discovered memories have a gifted-only RLS insert policy. Signed out is
 * a silent no-op, not an error.
 *
 * `resolved` lets a caller that has ALREADY resolved the request-scoped client
 * and its user hand both over, so the Journal's render costs exactly one
 * Supabase auth round-trip instead of two (the page needs the same pair for its
 * own guard and for `listJournal`). Omitting it self-resolves, exactly as
 * before — the resolution deliberately stays INSIDE the guard, so a client that
 * fails to construct is still caught rather than thrown at the render.
 *
 * The dedupe key is a constant, so the first open wins and its `occurred_at` is
 * that moment — every later open is an ignored duplicate. Best-effort and never
 * throws (§6.5): the WHOLE body is guarded, not just the write, because this
 * runs inside the Journal's render and a failure must only mean the page shows
 * up on the next open — never a blank Journal.
 */
export async function recordFirstMeeting(resolved?: {
  supabase: SupabaseClient;
  user: NonNullable<Awaited<ReturnType<typeof requireUser>>>;
}): Promise<void> {
  try {
    const supabase = resolved?.supabase ?? createClient();
    const user = resolved?.user ?? (await requireUser(supabase));
    if (!user) return;
    const service = createServiceClient();
    await recordDiscoveredMemory(service, {
      userId: user.id,
      memoryType: "first_meeting",
      isAnchor: true,
    });
  } catch (err) {
    console.error("[companion] recordFirstMeeting failed:", err);
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
