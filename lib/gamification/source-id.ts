/**
 * Natural idempotency keys for `xp_events.source_id`. One key per completed
 * learning unit. Daily eligibility is enforced separately by the database.
 */
import type { LearningOutcomeSource } from "./types";

export const DAILY_SOURCES: readonly LearningOutcomeSource[] = [
  "srs_review", "dictation", "shadowing", "mining_review", "jlpt_submit", "reading_submit",
];

/**
 * Superset of fields any source might need. Each source reads only the
 * fields its format requires; missing required fields throw.
 */
export interface SourceIdParts {
  /** SRS schedule the item belongs to — kanji and vocab are scheduled separately. */
  itemType?: "kanji" | "vocab";
  itemId?: string;
  lineId?: string;
  cardId?: string;
  testId?: string;
  mode?: "section" | "full";
  passageId?: string;
  /** Already globally unique — carries no date component. */
  sessionId?: string;
}

function required<K extends keyof SourceIdParts>(
  parts: SourceIdParts,
  key: K,
  source: LearningOutcomeSource,
): NonNullable<SourceIdParts[K]> {
  const value = parts[key];
  if (value === undefined || value === null || value === "") {
    throw new TypeError(`sourceIdFor(${source}, ...): missing required part "${String(key)}"`);
  }
  return value as NonNullable<SourceIdParts[K]>;
}

/** Build the `xp_events.source_id` idempotency key for a completed learning outcome. */
export function sourceIdFor(
  source: LearningOutcomeSource,
  parts: SourceIdParts,
): string {
  switch (source) {
    case "srs_review": {
      const itemType = required(parts, "itemType", source);
      const itemId = required(parts, "itemId", source);
      return `${itemType}:${itemId}`;
    }
    case "dictation":
    case "shadowing": {
      const lineId = required(parts, "lineId", source);
      return lineId;
    }
    case "mining_review": {
      const cardId = required(parts, "cardId", source);
      return cardId;
    }
    case "jlpt_submit": {
      const testId = required(parts, "testId", source);
      const mode = required(parts, "mode", source);
      return `${testId}:${mode}`;
    }
    case "reading_submit": {
      const passageId = required(parts, "passageId", source);
      return passageId;
    }
    case "conversation": {
      const sessionId = required(parts, "sessionId", source);
      return sessionId;
    }
  }
}
