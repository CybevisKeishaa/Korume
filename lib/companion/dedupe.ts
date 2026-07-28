import type { MemoryType, RelationshipPhase } from "./types";

export interface MemoryRef {
  lineId?: string;
  cardId?: string;
  jlptLevel?: string;
  phase?: RelationshipPhase;
}

function need<T>(value: T | undefined, type: MemoryType, field: string): T {
  if (value === undefined || value === null || value === "") {
    throw new TypeError(`dedupeKeyFor(${type}): missing required ref "${field}"`);
  }
  return value;
}

/** Natural idempotency key for `companion_memories.dedupe_key` (§4.3). */
export function dedupeKeyFor(type: MemoryType, ref: MemoryRef = {}): string {
  switch (type) {
    case "first_shadow":
      return "first_shadow";
    case "companion_grew":
      return `companion_grew:${need(ref.phase, type, "phase")}`;
    case "line_mastered":
      return `line_mastered:${need(ref.lineId, type, "lineId")}`;
    case "mining_saved":
      return `mining_saved:${need(ref.cardId, type, "cardId")}`;
    case "first_video_completed":
      // Constant on purpose: "first EVER completed video" is enforced by the
      // (user_id, dedupe_key) unique upsert itself — race-free at the DB.
      return "first_video_completed";
    case "first_meeting":
      return "first_meeting";
    case "jlpt_passed":
      return `jlpt_passed:${need(ref.jlptLevel, type, "jlptLevel")}`;
    case "pinned_line":
      return `pinned_line:${need(ref.lineId, type, "lineId")}`;
    default: {
      const exhaustive: never = type;
      throw new TypeError(`dedupeKeyFor: unhandled memory type ${String(exhaustive)}`);
    }
  }
}

export interface MemoryTitleDescriptor {
  /** Key within the `companion` namespace. */
  key: string;
  /** ICU values for that message. */
  values: Record<string, string | number>;
}

/** The message descriptor for a discovered memory's title (spec §4.4) — NEVER
 * AI-generated. Returns null for gifted pins: the learner supplies their own
 * title, and their words are never translated.
 *
 * Returns a descriptor rather than a string because titles are rendered at
 * READ time, in the reader's locale. Rendering at capture time would freeze
 * one locale's copy into the database (the capture gate is a service-role
 * write path with no request locale in scope). */
export function memoryTitleFor(
  type: MemoryType,
  ref: MemoryRef = {},
): MemoryTitleDescriptor | null {
  switch (type) {
    case "first_shadow":
      return { key: "memoryTitle.firstShadow", values: {} };
    case "line_mastered":
      return { key: "memoryTitle.lineMastered", values: {} };
    case "mining_saved":
      return { key: "memoryTitle.miningSaved", values: {} };
    case "first_video_completed":
      return { key: "memoryTitle.firstVideoCompleted", values: {} };
    case "jlpt_passed":
      return { key: "memoryTitle.jlptPassed", values: { level: ref.jlptLevel ?? "" } };
    case "companion_grew":
      return { key: `memoryTitle.companionGrew.${ref.phase ?? 1}`, values: {} };
    case "first_meeting":
      return { key: "memoryTitle.firstMeeting", values: {} };
    case "pinned_line":
      return null;
  }
}

/**
 * Read-time inverse of `dedupeKeyFor` for the types whose titles carry ICU
 * values. Rows persist no ref (titles render at READ time, in the reader's
 * locale) — the dedupe key is the one place the value survives. Total and
 * forgiving: anything malformed yields {} and the title falls back to its
 * value-less rendering.
 */
export function refFromDedupeKey(type: MemoryType, dedupeKey: string | null): MemoryRef {
  if (!dedupeKey) return {};
  const separator = dedupeKey.indexOf(":");
  const value = separator === -1 ? "" : dedupeKey.slice(separator + 1);
  switch (type) {
    case "jlpt_passed":
      return value ? { jlptLevel: value } : {};
    case "companion_grew": {
      const phase = Number(value);
      return phase === 1 || phase === 2 || phase === 3 || phase === 4 ? { phase } : {};
    }
    case "line_mastered":
    case "pinned_line":
      return value ? { lineId: value } : {};
    case "mining_saved":
      return value ? { cardId: value } : {};
    case "first_shadow":
    case "first_video_completed":
    case "first_meeting":
      return {};
  }
}
