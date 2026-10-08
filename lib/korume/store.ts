import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchAllPages, fetchByIdChunks } from "@/lib/data/query-pagination";
import type { Utf16Span } from "@/lib/analysis/types";
import type { AnswerV1 } from "./answer";
import { NATIVE_LANGUAGES } from "@/lib/profile/languages";
import { PREFERRED_PRACTICES } from "@/lib/profile/practices";
import type { LearnerProfileContext } from "./prompts";
import type { GroundedEntity } from "./types";

type Supabase = ReturnType<typeof createClient>;

export interface ThreadRow {
  id: string;
  userId: string;
  kind: "scenario" | "ask_korume";
  title: string | null;
  originVideoId: string | null;
  originLineId: string | null;
  originSpan: Utf16Span | null;
  originRoute: string | null;
  updatedAt: string;
}

export interface MessageRow {
  id: string;
  turnId: string | null;
  role: "user" | "ai";
  content: string;
  contentJson: unknown;
  contentSchemaVersion: number | null;
  groundingJson: unknown;
  groundingSchemaVersion: number | null;
  createdAt: string;
}

export interface AnchorLine {
  lineId: string;
  lineText: string;
  translation: string | null;
  startTime: number;
  videoId: string;
  videoTitle: string;
}

export interface NewThread {
  id: string;
  userId: string;
  anchor: { videoId: string; lineId: string; span: Utf16Span | null; route: string } | null;
}

export type ReservationState = "held" | "settled" | "released";

export interface CompleteTurnArgs {
  sessionId: string; turnId: string; reservationId: string; generationId: string;
  credits: number; usd: number; content: string; contentJson: AnswerV1; groundingJson: GroundedEntity[]; title: string;
}

/**
 * Everything Ask Korume reads and writes in SQL. Reads go through the learner's client (RLS: another learner's
 * thread is indistinguishable from none). Writes go through the service client (plan Correction 10: migration
 * 041's restrictive policies forbid direct learner writes to `ask_korume` rows) — so every write takes a
 * `userId` that the caller already proved through `korumeGate()`.
 */
export interface KorumeStore {
  insertThread(row: NewThread): Promise<"created" | "conflict">;
  readThreadRow(supabase: Supabase, id: string): Promise<ThreadRow | null>;
  listThreadRows(supabase: Supabase, limit: number, before: { updatedAt: string; id: string } | null): Promise<ThreadRow[]>;
  readMessages(supabase: Supabase, sessionId: string): Promise<MessageRow[]>;
  readAnchorLines(supabase: Supabase, lineIds: string[]): Promise<Map<string, AnchorLine>>;
  /** Newest reservation status per turn. Never leaves the server: only the projection does (spec §4.3). */
  reservationStates(turnIds: string[]): Promise<Map<string, ReservationState>>;
  /** The learner's question; a second insert of the same `(session, turn, 'user')` is `exists`, never a 2nd row. */
  insertUserMessage(sessionId: string, turnId: string, text: string): Promise<"created" | "exists">;
  /** Of these video ids, the ones the learner can still read (RLS) — a lesson link points only there. */
  readableVideoIds(supabase: Supabase, ids: string[]): Promise<Set<string>>;
  /** The caller's own profile fields for the answer prompt (RLS: own row); null when nothing is set. */
  readLearnerProfile(supabase: Supabase, userId: string): Promise<LearnerProfileContext | null>;
  /** `korume_complete_turn`: the answer, its grounding, the settle, the title and `updated_at` in ONE transaction. */
  completeTurn(args: CompleteTurnArgs): Promise<{ messageId: string; charged: boolean }>;
}

const THREAD_COLUMNS = "id, user_id, kind, title, origin_video_id, origin_line_id, origin_span, origin_route, updated_at";

interface ThreadDbRow {
  id: string; user_id: string; kind: ThreadRow["kind"]; title: string | null; origin_video_id: string | null;
  origin_line_id: string | null; origin_span: Utf16Span | null; origin_route: string | null; updated_at: string;
}

const toThread = (r: ThreadDbRow): ThreadRow => ({
  id: r.id, userId: r.user_id, kind: r.kind, title: r.title, originVideoId: r.origin_video_id,
  originLineId: r.origin_line_id, originSpan: r.origin_span, originRoute: r.origin_route, updatedAt: r.updated_at,
});

const UNIQUE_VIOLATION = "23505";

export const sqlKorumeStore: KorumeStore = {
  async insertThread(row) {
    const { error } = await createServiceClient().from("conversation_sessions").insert({
      id: row.id,
      user_id: row.userId,
      kind: "ask_korume",
      origin_video_id: row.anchor?.videoId ?? null,
      origin_line_id: row.anchor?.lineId ?? null,
      origin_span: row.anchor?.span ?? null,
      origin_route: row.anchor?.route ?? null,
    });
    if (!error) return "created";
    if (error.code === UNIQUE_VIOLATION) return "conflict";
    throw error;
  },

  async readThreadRow(supabase, id) {
    const { data, error } = await supabase.from("conversation_sessions").select(THREAD_COLUMNS).eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? toThread(data as ThreadDbRow) : null;
  },

  async listThreadRows(supabase, limit, before) {
    let query = supabase.from("conversation_sessions").select(THREAD_COLUMNS).eq("kind", "ask_korume");
    if (before) {
      // Keyset under the total order (updated_at desc, id desc). Values are quoted for PostgREST's `or` grammar.
      query = query.or(`updated_at.lt."${before.updatedAt}",and(updated_at.eq."${before.updatedAt}",id.lt.${before.id})`);
    }
    const { data, error } = await query.order("updated_at", { ascending: false }).order("id", { ascending: false }).limit(limit);
    if (error) throw error;
    return ((data ?? []) as ThreadDbRow[]).map(toThread);
  },

  async readMessages(supabase, sessionId) {
    const rows = await fetchAllPages<{
      id: string; turn_id: string | null; role: "user" | "ai"; content: string; content_json: unknown;
      content_schema_version: number | null; grounding_json: unknown; grounding_schema_version: number | null; created_at: string;
    }>((from, to) => supabase.from("conversation_messages")
      .select("id, turn_id, role, content, content_json, content_schema_version, grounding_json, grounding_schema_version, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }).order("id", { ascending: true })
      .range(from, to));
    return rows.map((r) => ({
      id: r.id, turnId: r.turn_id, role: r.role, content: r.content, contentJson: r.content_json,
      contentSchemaVersion: r.content_schema_version, groundingJson: r.grounding_json,
      groundingSchemaVersion: r.grounding_schema_version, createdAt: r.created_at,
    }));
  },

  async readAnchorLines(supabase, lineIds) {
    const rows = await fetchByIdChunks(lineIds, async (ids) => {
      const { data, error } = await supabase.from("transcript_lines")
        .select("id, text_jp, text_translation, start_time, transcripts!inner(video_id, videos!inner(title))")
        .in("id", ids);
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string; text_jp: string | null; text_translation: string | null; start_time: number | string;
        transcripts: { video_id: string; videos: { title: string } };
      }[];
    });
    return new Map(rows.filter((r) => r.text_jp).map((r) => [r.id, {
      lineId: r.id, lineText: r.text_jp as string, translation: r.text_translation, startTime: Number(r.start_time),
      videoId: r.transcripts.video_id, videoTitle: r.transcripts.videos.title,
    }]));
  },

  async reservationStates(turnIds) {
    const supabase = createServiceClient();
    const rows = await fetchByIdChunks(turnIds, async (ids) => {
      const { data, error } = await supabase.from("ai_reservations").select("turn_id, status, created_at")
        .in("turn_id", ids).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as { turn_id: string; status: ReservationState; created_at: string }[];
    });
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const states = new Map<string, ReservationState>();
    for (const r of rows) if (!states.has(r.turn_id)) states.set(r.turn_id, r.status);
    return states;
  },

  async insertUserMessage(sessionId, turnId, text) {
    const { error } = await createServiceClient().from("conversation_messages")
      .insert({ session_id: sessionId, role: "user", content: text, turn_id: turnId });
    if (!error) return "created";
    if (error.code === UNIQUE_VIOLATION) return "exists";
    throw error;
  },

  async readableVideoIds(supabase, ids) {
    if (ids.length === 0) return new Set();
    const rows = await fetchByIdChunks(ids, async (chunk) => {
      const { data, error } = await supabase.from("videos").select("id").in("id", chunk);
      if (error) throw error;
      return (data ?? []) as { id: string }[];
    });
    return new Set(rows.map((r) => r.id));
  },

  async readLearnerProfile(supabase, userId) {
    const { data, error } = await supabase.from("users")
      .select("native_language, target_jlpt_level, learning_goal, preferred_practices").eq("id", userId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const profile: LearnerProfileContext = {
      nativeLanguage: NATIVE_LANGUAGES.find((l) => l === data.native_language) ?? null, targetJlptLevel: data.target_jlpt_level ?? null,
      learningGoal: data.learning_goal?.trim() || null, // The DB only caps the count (R8: codes are app-validated), so an unknown or huge value never reaches the prompt.
      preferredPractices: (data.preferred_practices ?? []).filter((p: string) => (PREFERRED_PRACTICES as readonly string[]).includes(p)),
    };
    const empty = !profile.nativeLanguage && !profile.targetJlptLevel && !profile.learningGoal && profile.preferredPractices.length === 0;
    return empty ? null : profile;
  },

  async completeTurn(args) {
    const { data, error } = await createServiceClient().rpc("korume_complete_turn", {
      p_session: args.sessionId, p_turn: args.turnId, p_reservation: args.reservationId, p_generation: args.generationId,
      p_credits: args.credits, p_usd: args.usd, p_content: args.content, p_content_json: args.contentJson,
      p_grounding_json: args.groundingJson, p_title: args.title,
    });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as { message_id: string; charged: boolean } | undefined;
    if (!row?.message_id) throw new Error("korume_complete_turn returned no message");
    return { messageId: row.message_id, charged: row.charged };
  },
};
