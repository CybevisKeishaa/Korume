/**
 * Client-safe shared types + helpers for the JLPT test-engine UI (spec
 * §5.7-§5.8, CLAUDE.md §5). Mirrors the response shapes returned by
 * `lib/data/jlpt.ts` / `/api/jlpt/*` without importing that (server-only)
 * module — same duplication pattern as `lib/video-types.ts` /
 * `lib/conversation-types.ts`, so this file has zero server-only imports and
 * is safe to pull into any client component.
 */
export type {
  JlptLevel,
  JlptMode,
  JlptSection,
  JlptPillar,
  JlptAttemptResult,
  PillarScore,
  SectionScore,
  WeaknessStat,
} from "@/lib/jlpt";
import type { JlptLevel, JlptSection } from "@/lib/jlpt";

/** A `jlpt_tests` row as the list/detail endpoints return it. */
export interface JlptTestListItem {
  id: string;
  level: JlptLevel;
  title: string;
  section_config: unknown;
}

export interface PublicQuestionData {
  stem: string;
  passage?: string;
  audio_text?: string;
  choices: string[];
}

export interface JlptQuestionPublic {
  id: string;
  section: JlptSection;
  question_type: string;
  order_index: number;
  question_data: PublicQuestionData;
}

export interface JlptTestDetail extends JlptTestListItem {
  questions: JlptQuestionPublic[];
}

export interface JlptAttemptRow {
  id: string;
  test_id: string;
  score: number | null;
  section_scores: unknown;
  mode: "full" | "section";
  section: JlptSection | null;
  started_at: string;
  completed_at: string | null;
}

export interface JlptPerQuestionResult {
  id: string;
  correct: boolean;
  correctAnswer: string;
  explanation: string | null;
}

/** `POST /api/jlpt/tests/[id]/submit`'s `data` shape. */
export interface JlptSubmitResult {
  result: import("@/lib/jlpt").JlptAttemptResult;
  weakness: import("@/lib/jlpt").WeaknessStat[];
  perQuestion: JlptPerQuestionResult[];
  attemptId: string;
}

/** One `section_config.sections[]` entry (see migration 20260713000012). */
export interface JlptSectionConfigEntry {
  section: JlptSection;
  question_count: number;
  time_limit_minutes: number;
}

const VALID_SECTIONS = new Set<string>(["vocab", "grammar", "reading", "listening"]);

/**
 * Defensive parse of the `jlpt_tests.section_config` jsonb column. Returns
 * `[]` for anything malformed rather than throwing — a content-authoring bug
 * in seed data should degrade the test card, never crash the page (same
 * defensive posture as `toPublicQuestionData` in `lib/data/jlpt.ts`).
 */
export function parseSectionConfig(raw: unknown): JlptSectionConfigEntry[] {
  const obj = raw as { sections?: unknown } | null | undefined;
  if (!obj || !Array.isArray(obj.sections)) return [];

  const out: JlptSectionConfigEntry[] = [];
  for (const item of obj.sections) {
    const s = item as Partial<JlptSectionConfigEntry> | null;
    if (
      s &&
      typeof s.section === "string" &&
      VALID_SECTIONS.has(s.section) &&
      typeof s.question_count === "number" &&
      typeof s.time_limit_minutes === "number"
    ) {
      out.push({
        section: s.section as JlptSection,
        question_count: s.question_count,
        time_limit_minutes: s.time_limit_minutes,
      });
    }
  }
  return out;
}

/** Sum of every section's time limit — used as the full-mock countdown duration. */
export function totalMinutes(entries: JlptSectionConfigEntry[]): number {
  return entries.reduce((n, e) => n + e.time_limit_minutes, 0);
}

/** Sum of every section's question count — shown on the test card. */
export function totalQuestionCount(entries: JlptSectionConfigEntry[]): number {
  return entries.reduce((n, e) => n + e.question_count, 0);
}

/**
 * Where the "Suggested review" link for a weak section lands (CLAUDE.md §5
 * — weakness stats should drive the learner straight back into the right
 * module). Listening has no dedicated drill module yet, so it points at the
 * video library, which is the closest analog for listening practice.
 */
export function reviewHrefForSection(section: JlptSection, level: JlptLevel): string {
  switch (section) {
    case "vocab":
      return `/vocab?level=${level}`;
    case "grammar":
      return `/grammar?level=${level}`;
    case "reading":
      return `/reading?level=${level}`;
    case "listening":
      return `/shadowing?level=${level}`;
  }
}

/** "0".."3" → true. Guards a submit-body answer value before it's sent. */
export function isAnswerValue(v: string): v is "0" | "1" | "2" | "3" {
  return v === "0" || v === "1" || v === "2" || v === "3";
}
