import { isPronunciationResultMode, shadowingHubQuerySchema, type PronunciationDisplay } from "@/lib/validation/shadowing-hub";

/** The one bound on a search term lives on the Hub query schema; read it, never restate it. */
const MAX_QUERY_LENGTH = shadowingHubQuerySchema.shape.q.unwrap().maxLength ?? Infinity;

/** The concrete search tabs; absence of `type` is All (never written as `type=all`). */
export const SEARCH_TYPES = ["lessons", "paths", "goals", "library"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

/**
 * A trimmed query cut to the schema's bound (a longer term is searched by its
 * start, not dropped); nothing but spaces is no query at all.
 */
export function normalizeSearchQuery(raw: string | undefined): string | null {
  const query = raw?.trim().slice(0, MAX_QUERY_LENGTH).trim();
  return query || null;
}

/** `canonical: false` means the URL spelled All some other way and should redirect without `type`. */
export function parseSearchType(raw: string | undefined): { type: SearchType | null; canonical: boolean } {
  if (raw === undefined) return { type: null, canonical: true };

  const type = SEARCH_TYPES.find((candidate) => candidate === raw);
  return type ? { type, canonical: true } : { type: null, canonical: false };
}

export type PronunciationSurface =
  | { state: "default" }
  | { state: "browse" }
  | { state: "search"; q: string; type: SearchType | null };

/** Default → curated shelves; Browse → lesson grid (no tabs); Search → grouped results. */
export function pronunciationSurface(input: {
  q: string | null;
  filter?: string;
  display: PronunciationDisplay;
  type: SearchType | null;
}): PronunciationSurface {
  if (input.q) return { state: "search", q: input.q, type: input.type };
  return isPronunciationResultMode({ filter: input.filter }, input.display) ? { state: "browse" } : { state: "default" };
}

const LESSON_KEYS = ["filter", "sort", "duration", "hideCompleted"] as const;
export type LessonParams = Partial<Record<(typeof LESSON_KEYS)[number], string>>;

/** A search URL: lesson settings ride along everywhere (preserved, ignored outside lessons). */
export function searchHref(input: {
  q: string;
  type: SearchType | null;
  lesson: LessonParams;
  shown?: number;
}): string {
  const params = new URLSearchParams({ q: input.q });

  if (input.type) params.set("type", input.type);
  for (const key of LESSON_KEYS) {
    const value = input.lesson[key];
    if (value) params.set(key, value);
  }
  if (input.type && input.shown !== undefined) params.set("shown", String(input.shown));

  return `/pronunciation?${params.toString()}`;
}
