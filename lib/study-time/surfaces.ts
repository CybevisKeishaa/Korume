import { CONTEXT_ID_MAX } from "./constants";

/** Surfaces measured from real routes on 2026-10-07 (spec §5.6). Adding one = edit the SQL check in place too. */
export const STUDY_SURFACES = [
  "shadowing", "dictation", "summary", "srs_review", "kanji", "certification", "conversation", "korume_chat",
] as const;
export type StudySurface = (typeof STUDY_SURFACES)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVIEW_DECKS = new Set(["kanji", "mining", "vocab"]);

/** Ids only — never titles, transcripts, queries or chat text (spec §5.1). */
export function isValidContext(surface: StudySurface, contextId: string | null): boolean {
  if (contextId === null) return surface === "conversation" || surface === "korume_chat";
  if (contextId.length > CONTEXT_ID_MAX) return false;
  if (surface === "srs_review") return REVIEW_DECKS.has(contextId);
  return UUID.test(contextId);
}
