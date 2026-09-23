# Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **In this repo the implementer is Codex**, one task per `codex exec` dispatch, in
> `.worktrees/settings-page`, with `- Owner: Codex` in `docs/superpowers/run-state/settings-page.md`.
> Codex's sandbox cannot write `.git`: implement, verify, leave changes uncommitted, flip the Owner
> line back to Claude. Claude reviews the diff, re-verifies and commits. Do only the task you were
> given.

**Goal:** Port Figma Global settings `220:16032` onto `/settings` with a real consumer behind every
control, plus a working Erase Korume Memory.

**Architecture:** One new table `user_preferences` (+ a `security invoker` erase function) behind
`GET/PATCH /api/user/preferences`. Engines take the preference as a parameter (SRS multiplier,
difficulty band, streak schedule); session-wide appearance (display scale, reduced motion) is set on
`<html>` before paint by the `(protected)` layout and exposed to client code through a
`PreferencesProvider`. The page is composed of `SettingsSection` / `SettingsRow` with per-control
optimistic saves guarded against stale responses.

**Tech Stack:** Next.js 14.2 App Router, React 18, TypeScript strict, Tailwind (repo tokens),
next-intl, Supabase (`@supabase/ssr`, Postgres RLS), zod 3, Vitest + RTL, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-22-settings-page-design.md` — read it in full first. The
plan argues from it; where they disagree, stop and report instead of choosing.

## Global Constraints

- Figma is the frame, but a row with no real destination is **omitted**: no Discord, Facebook,
  TikTok, Privacy Policy, Terms of Service, Send Feedback or Contact Support row (spec §1.7). No
  Theme, Accent Color, Learning Reminders section or Study Reminder Time row (spec §1.3, §10).
- Keep the `(app)` shell with the sidebar; do not port the frame's own top bar (spec §1.2).
- `/settings/privacy` stays and is **not** redirected (spec §1.6).
- Tokens only: spacing `2xs xs sm md md-lg lg xl 2xl 3xl`; type `caption body body-lg heading
  heading-lg title display hero`; `h-control-sm|md|lg`; `size-icon-xs|sm|md|lg`. **Never**
  `text-xs|sm|base|lg|xl`, never a numeric step for padding, margin, gap, `space-*` or insets, no
  px/rem literals. `components/ui/token-scale-adoption.test.ts` is the authority.
- Every new string exists in `messages/en/settings.json` **and** `messages/vi/settings.json` in the
  same commit. Vietnamese is written, not machine-translated.
- Every `/api/user/*` route follows `app/api/user/model-training-consent/route.ts`: zod parse →
  400 with `details`; data-layer `{ ok:false, status }` → that status (429 with `Retry-After`);
  a thrown error → opaque 500 `"Something went wrong. Please try again."`, logged server-side only.
- Migrations: this branch adds exactly one file, `supabase/migrations/20260922000033_user_preferences.sql`.
  It is edited in place if it needs to change (AGENTS.md §6). Explicit grants, as in
  `20260716000015_companion_memories.sql`.
- One fact, one home: preference option lists live in `lib/preferences/options.ts` and nowhere
  else; the zod schema, the UI and the migration test all import or pin them.
- Mascot images: hand-cut `supplied` poses only (`scripts/mascot/poses.json` → `supplied`).
- Guard tests over existing code are mutation-checked (break → red → restore → green, report both).
  Pattern-gathered collections assert their size.
- Lint with `npm run lint`. Full vitest: `npm test -- --reporter=dot > <file>`, then read the file.
- Playwright needs Docker Desktop + `npx supabase start`; `:3000` must be free. Never build or
  serve in the main checkout.
- No `path:NN` line citations in code comments.

## File map

| File | Task | Responsibility |
| --- | --- | --- |
| `lib/preferences/options.ts` (+ test) | 1 | Option lists, defaults, canonical schedule days |
| `supabase/migrations/20260922000033_user_preferences.sql` (+ `.test.ts`) | 1 | Table, RLS, grants, `erase_companion_memory()` |
| `supabase/tests/settings-page.sql`, `scripts/verify-settings-gate.ps1`, `package.json` | 1 | Live Postgres gate |
| `lib/validation/preferences.ts` (+ test) | 1 | One-control PATCH schema, schedule canonicalisation |
| `lib/data/preferences.ts` (+ test) | 1 | Read with defaults, write one control |
| `app/api/user/preferences/route.ts` (+ test) | 1 | GET / PATCH |
| `lib/srs/sm2.ts`, `lib/data/srs.ts`, `lib/data/mining.ts` | 2 | Review-frequency multiplier |
| `lib/difficulty/score.ts`, `lib/data/difficulty.ts`, `lib/data/recommendations.ts` | 2 | Difficulty band |
| `lib/gamification/streak.ts`, `lib/data/gamification.ts` | 2 | Schedule-aware streak |
| `components/ui/switch.tsx`, `components/ui/segmented-control.tsx` (+ tests) | 3 | New primitives |
| `app/globals.css`, `lib/design-tokens.test.ts` | 4 | `--display-scale` in the unit |
| `lib/preferences/appearance-script.ts` (+ test) | 4 | Pre-paint `<html>` attributes |
| `components/providers/preferences-provider.tsx` (+ test) | 4 | Client access to preferences |
| `app/[locale]/(protected)/layout.tsx`, `components/providers/theme-provider.tsx` | 4 | Wire both |
| `tests/e2e/display-scale.spec.ts` | 4 | Computed-value measurement |
| `lib/media/device-gate.ts` (+ test), `components/video-player/recorder.tsx` | 5 | Microphone / camera gate |
| `lib/user-export/tables.ts` (+ guard test), `lib/csv/write.ts` (+ test) | 6 | Export table list, CSV writer |
| `lib/data/user-export.ts`, `app/api/user/export/route.ts`, `app/api/user/history.csv/route.ts` (+ tests) | 6 | Export + history |
| `lib/data/memory-erase.ts`, `app/api/user/memory-erase/route.ts` (+ tests) | 7 | Erase Memory API |
| `app/[locale]/(protected)/(app)/settings/privacy/memory/page.tsx`, `components/settings/memory-erase-form.tsx` (+ test) | 7 | Confirmation page |
| `components/settings/use-preference-save.ts` (+ test) | 8 | Per-control optimistic save, stale-response guard |
| `components/settings/settings-section.tsx`, `settings-row.tsx` (+ tests) | 8 | Layout primitives |
| `components/settings/learning-section.tsx`, `appearance-section.tsx`, `privacy-data-section.tsx` (+ tests) | 8 | The three control sections |
| `components/settings/deletion-controls.tsx` (+ test), `components/settings/privacy-screen.tsx` | 9 | Extracted deletion state, reused by both pages |
| `components/settings/settings-page.tsx`, `app/[locale]/(protected)/(app)/settings/page.tsx` | 9 | Page assembly |
| `components/shadowing/hub-companion-rail.tsx`, `app/[locale]/(protected)/(app)/shadowing/page.tsx` | 9 | Daily goal consumer |
| `lib/product/screen-registry.ts`, `app/[locale]/(protected)/(app)/upcoming-routes.test.tsx` | 7, 9 | Registry + placeholder list |
| `tests/e2e/settings.spec.ts` | 9 | End-to-end |

---

### Task 1: Preferences storage, validation, data layer and API

**Files:**
- Create: `lib/preferences/options.ts`, `lib/preferences/options.test.ts`
- Create: `supabase/migrations/20260922000033_user_preferences.sql`, `supabase/migrations/20260922000033_user_preferences.test.ts`
- Create: `supabase/tests/settings-page.sql`, `scripts/verify-settings-gate.ps1`
- Modify: `package.json` (script `verify:db:settings`)
- Create: `lib/validation/preferences.ts`, `lib/validation/preferences.test.ts`
- Create: `lib/data/preferences.ts`, `lib/data/preferences.test.ts`
- Create: `app/api/user/preferences/route.ts`, `app/api/user/preferences/route.test.ts`

**Interfaces:**
- Produces: `UserPreferences`, `DEFAULT_PREFERENCES`, option tuples, `canonicalScheduleDays()` (options.ts);
  `preferencesPatchSchema`, `PreferencesPatch` (validation);
  `readPreferences(supabase, userId): Promise<UserPreferences>` (never throws — defaults on any failure),
  `getMyPreferences(): Promise<UserPreferences | null>` (null when signed out),
  `updateMyPreferences(patch): Promise<UpdatePreferencesResult>` (data).

- [ ] **Step 1: Write `lib/preferences/options.test.ts` (failing)**

```ts
import { describe, expect, it } from "vitest";
import {
  DAILY_MINUTES_OPTIONS, DEFAULT_PREFERENCES, DIFFICULTY_OPTIONS, DISPLAY_SCALE_OPTIONS,
  LEARNING_SCHEDULE_OPTIONS, REVIEW_FREQUENCY_OPTIONS, canonicalScheduleDays,
} from "./options";

describe("preference options", () => {
  it("pins every option list the spec names", () => {
    expect(LEARNING_SCHEDULE_OPTIONS).toEqual(["every_day", "weekdays", "custom"]);
    expect(REVIEW_FREQUENCY_OPTIONS).toEqual(["normal", "more", "relaxed"]);
    expect(DIFFICULTY_OPTIONS).toEqual(["adaptive", "easy", "challenge"]);
    expect(DISPLAY_SCALE_OPTIONS).toEqual(["normal", "large", "extra_large"]);
    expect(DAILY_MINUTES_OPTIONS).toEqual([5, 10, 15, 20, 30, 45, 60]);
  });

  it("canonicalises the fixed schedules and normalises custom days", () => {
    expect(canonicalScheduleDays("every_day", [])).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(canonicalScheduleDays("weekdays", [6])).toEqual([1, 2, 3, 4, 5]);
    expect(canonicalScheduleDays("custom", [5, 1, 5, 3])).toEqual([1, 3, 5]);
  });

  it("defaults match the migration defaults", () => {
    expect(DEFAULT_PREFERENCES).toEqual({
      learningSchedule: "every_day", scheduleDays: [1, 2, 3, 4, 5, 6, 7],
      reviewFrequency: "normal", difficulty: "adaptive", displayScale: "normal",
      reduceMotion: false, microphoneEnabled: true, cameraEnabled: false, dailyMinutes: 15,
    });
  });
});
```

- [ ] **Step 2: Run** `npx vitest run lib/preferences` — expected FAIL (module not found).

- [ ] **Step 3: Write `lib/preferences/options.ts`**

```ts
/** The one home of every Settings option list (spec §3). Zod, UI and the migration test import these. */
export const LEARNING_SCHEDULE_OPTIONS = ["every_day", "weekdays", "custom"] as const;
export const REVIEW_FREQUENCY_OPTIONS = ["normal", "more", "relaxed"] as const;
export const DIFFICULTY_OPTIONS = ["adaptive", "easy", "challenge"] as const;
export const DISPLAY_SCALE_OPTIONS = ["normal", "large", "extra_large"] as const;
export const DAILY_MINUTES_OPTIONS = [5, 10, 15, 20, 30, 45, 60] as const;

export type LearningSchedule = (typeof LEARNING_SCHEDULE_OPTIONS)[number];
export type ReviewFrequency = (typeof REVIEW_FREQUENCY_OPTIONS)[number];
export type Difficulty = (typeof DIFFICULTY_OPTIONS)[number];
export type DisplayScale = (typeof DISPLAY_SCALE_OPTIONS)[number];
/** ISO weekday, Monday = 1 … Sunday = 7, taken from the VN-local date (spec §4.3). */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const ALL_DAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];
export const WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5];

export interface UserPreferences {
  learningSchedule: LearningSchedule;
  scheduleDays: IsoWeekday[];
  reviewFrequency: ReviewFrequency;
  difficulty: Difficulty;
  displayScale: DisplayScale;
  reduceMotion: boolean;
  microphoneEnabled: boolean;
  cameraEnabled: boolean;
  /** Lives on `users.daily_minutes`; carried here so one read serves the page. */
  dailyMinutes: number;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  learningSchedule: "every_day",
  scheduleDays: [...ALL_DAYS],
  reviewFrequency: "normal",
  difficulty: "adaptive",
  displayScale: "normal",
  reduceMotion: false,
  microphoneEnabled: true,
  cameraEnabled: false,
  dailyMinutes: 15,
};

export function canonicalScheduleDays(schedule: LearningSchedule, days: readonly number[]): IsoWeekday[] {
  if (schedule === "every_day") return [...ALL_DAYS];
  if (schedule === "weekdays") return [...WEEKDAYS];
  return [...new Set(days)].sort((a, b) => a - b) as IsoWeekday[];
}

export const DISPLAY_SCALE_FACTOR: Record<DisplayScale, number> = {
  normal: 1,
  large: 1.125,
  extra_large: 1.25,
};
```

- [ ] **Step 4: Run** `npx vitest run lib/preferences` — expected PASS.

- [ ] **Step 5: Write the migration `supabase/migrations/20260922000033_user_preferences.sql`**

```sql
-- Settings page (spec docs/superpowers/specs/2026-09-22-settings-page-design.md §3, §4.8).
-- One row per user, created lazily on first write; reads fall back to defaults.
create table user_preferences (
  user_id uuid primary key references users (id) on delete cascade,
  learning_schedule text not null default 'every_day'
    check (learning_schedule in ('every_day', 'weekdays', 'custom')),
  schedule_days smallint[] not null default '{1,2,3,4,5,6,7}',
  review_frequency text not null default 'normal'
    check (review_frequency in ('normal', 'more', 'relaxed')),
  difficulty text not null default 'adaptive'
    check (difficulty in ('adaptive', 'easy', 'challenge')),
  display_scale text not null default 'normal'
    check (display_scale in ('normal', 'large', 'extra_large')),
  reduce_motion boolean not null default false,
  microphone_enabled boolean not null default true,
  camera_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  -- Range and non-empty. Uniqueness/order are normalised by zod before the
  -- write (a CHECK on array uniqueness is not practical, spec §3).
  constraint user_preferences_schedule_days_range check (
    cardinality(schedule_days) between 1 and 7
    and schedule_days <@ '{1,2,3,4,5,6,7}'::smallint[]
  ),
  constraint user_preferences_schedule_days_canonical check (
    (learning_schedule = 'every_day' and schedule_days = '{1,2,3,4,5,6,7}'::smallint[])
    or (learning_schedule = 'weekdays' and schedule_days = '{1,2,3,4,5}'::smallint[])
    or learning_schedule = 'custom'
  )
);

alter table user_preferences enable row level security;

create policy user_preferences_select_own on user_preferences
  for select to authenticated using (user_id = auth.uid());
create policy user_preferences_insert_own on user_preferences
  for insert to authenticated with check (user_id = auth.uid());
create policy user_preferences_update_own on user_preferences
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- No delete grant: the row goes with the account through the users cascade.
grant select, insert, update on user_preferences to authenticated;
revoke delete on user_preferences from authenticated;
grant all on user_preferences to service_role;

-- Erase Korume Memory (spec §4.8): companion memories and conversation
-- memories, together, for the caller only. SECURITY INVOKER: the existing
-- owner-only delete policies on both tables are what scope it.
create function erase_companion_memory() returns void
  language sql
  security invoker
  set search_path = public
as $$
  delete from companion_memories where user_id = auth.uid();
  delete from conversation_sessions where user_id = auth.uid();
$$;

revoke all on function erase_companion_memory() from public;
grant execute on function erase_companion_memory() to authenticated;
```

- [ ] **Step 6: Write `supabase/migrations/20260922000033_user_preferences.test.ts`** — a source test
  in the style of `20260913000032_lesson_creation_jobs.test.ts`: read the file with comments
  stripped and lower-cased, assert (a) exactly one migration file mentions `user_preferences`,
  (b) each of the four option lists from `lib/preferences/options.ts` appears verbatim inside its
  `check (... in (...))`, (c) `enable row level security`, the three `_own` policies and
  `revoke delete on user_preferences from authenticated` are present, (d) the function is
  `security invoker` with `set search_path = public` and `grant execute ... to authenticated`.
  Assert the matched-policy collection has length 3.

- [ ] **Step 7: Write the live gate `supabase/tests/settings-page.sql`** following
  `supabase/tests/lesson-creation-jobs.sql` (`\set ON_ERROR_STOP on`, own fixtures under
  `settingsgate-%@example.invalid`, cleans up after itself). It must prove, each with a
  `raise notice 'PASS ...'` or `raise exception 'FAIL ...'`:
  1. user A inserts and reads their row; user B (`set local role authenticated` +
     `request.jwt.claims` for B) selects 0 rows of A's and an update of A's row affects 0 rows;
  2. `insert ... (learning_schedule, schedule_days) values ('weekdays', '{1,2,3}')` fails with a
     check violation; `('custom', '{}')` fails; `('custom', '{0}')` fails; `('custom', '{2,4}')` succeeds;
  3. A has 2 `companion_memories` and 1 `conversation_sessions` with 1 message, B has the same;
     calling `erase_companion_memory()` as A leaves A with 0/0/0 and B with 2/1/1, and A's
     `user_stats` row unchanged.

  `scripts/verify-settings-gate.ps1` is a copy of `scripts/verify-lesson-creation-gate.ps1`
  reduced to running this one SQL file (no contention section). `package.json`:
  `"verify:db:settings": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-settings-gate.ps1"`.

- [ ] **Step 8: Write `lib/validation/preferences.test.ts` (failing)**

```ts
import { describe, expect, it } from "vitest";
import { preferencesPatchSchema } from "./preferences";

const parse = (body: unknown) => preferencesPatchSchema.safeParse(body);

describe("preferencesPatchSchema — one logical control per PATCH (spec §3)", () => {
  it("accepts each single control", () => {
    for (const body of [
      { dailyMinutes: 20 },
      { learningSchedule: "weekdays" },
      { learningSchedule: "custom", scheduleDays: [3, 1] },
      { reviewFrequency: "relaxed" },
      { difficulty: "challenge" },
      { displayScale: "extra_large" },
      { reduceMotion: true },
      { microphoneEnabled: false },
      { cameraEnabled: true },
    ]) expect(parse(body).success, JSON.stringify(body)).toBe(true);
  });

  it("canonicalises schedule days", () => {
    expect(parse({ learningSchedule: "every_day" })).toMatchObject({
      success: true, data: { learningSchedule: "every_day", scheduleDays: [1, 2, 3, 4, 5, 6, 7] },
    });
    expect(parse({ learningSchedule: "custom", scheduleDays: [5, 1, 5] })).toMatchObject({
      success: true, data: { scheduleDays: [1, 5] },
    });
  });

  it("rejects custom with no days, a day out of range, or days sent for a fixed schedule", () => {
    expect(parse({ learningSchedule: "custom", scheduleDays: [] }).success).toBe(false);
    expect(parse({ learningSchedule: "custom", scheduleDays: [8] }).success).toBe(false);
    expect(parse({ learningSchedule: "custom" }).success).toBe(false);
    expect(parse({ learningSchedule: "weekdays", scheduleDays: [1] }).success).toBe(false);
  });

  it("rejects dailyMinutes mixed with any preferences field", () => {
    expect(parse({ dailyMinutes: 20, reduceMotion: true }).success).toBe(false);
  });

  it("rejects two controls, an empty body, unknown keys and off-list values", () => {
    expect(parse({ difficulty: "easy", displayScale: "large" }).success).toBe(false);
    expect(parse({}).success).toBe(false);
    expect(parse({ theme: "light" }).success).toBe(false);
    expect(parse({ dailyMinutes: 25 }).success).toBe(false);
  });
});
```

- [ ] **Step 9: Run** `npx vitest run lib/validation/preferences.test.ts` — expected FAIL.

- [ ] **Step 10: Write `lib/validation/preferences.ts`**

```ts
import { z } from "zod";
import {
  DAILY_MINUTES_OPTIONS, DIFFICULTY_OPTIONS, DISPLAY_SCALE_OPTIONS, REVIEW_FREQUENCY_OPTIONS,
  canonicalScheduleDays, type IsoWeekday,
} from "@/lib/preferences/options";

const day = z.number().int().min(1).max(7);

/**
 * One PATCH mutates one logical control (spec §3), so no request can
 * half-succeed across `users` and `user_preferences`. A union of strict
 * single-control objects: a mixed or two-control body matches no member.
 */
const schedule = z.discriminatedUnion("learningSchedule", [
  z.object({ learningSchedule: z.literal("every_day") }).strict(),
  z.object({ learningSchedule: z.literal("weekdays") }).strict(),
  z.object({ learningSchedule: z.literal("custom"), scheduleDays: z.array(day).min(1).max(7) }).strict(),
]).transform((v) => ({
  learningSchedule: v.learningSchedule,
  scheduleDays: canonicalScheduleDays(v.learningSchedule, "scheduleDays" in v ? v.scheduleDays : []),
}));

const dailyMinutes = z.object({
  dailyMinutes: z.number().refine((n) => (DAILY_MINUTES_OPTIONS as readonly number[]).includes(n)),
}).strict();

export const preferencesPatchSchema = z.union([
  dailyMinutes,
  schedule,
  z.object({ reviewFrequency: z.enum(REVIEW_FREQUENCY_OPTIONS) }).strict(),
  z.object({ difficulty: z.enum(DIFFICULTY_OPTIONS) }).strict(),
  z.object({ displayScale: z.enum(DISPLAY_SCALE_OPTIONS) }).strict(),
  z.object({ reduceMotion: z.boolean() }).strict(),
  z.object({ microphoneEnabled: z.boolean() }).strict(),
  z.object({ cameraEnabled: z.boolean() }).strict(),
]);

export type PreferencesPatch = z.output<typeof preferencesPatchSchema>;
export type { IsoWeekday };
```

- [ ] **Step 11: Run** the validation test — expected PASS.

- [ ] **Step 12: Write `lib/data/preferences.test.ts` (failing)** with the repo's supabase mock
  (`test/supabase-mock.ts`, see `lib/data/model-training-consent.test.ts` for usage). Cases:
  `readPreferences` returns `DEFAULT_PREFERENCES` with `dailyMinutes` from `users` when no
  preferences row exists; maps snake_case columns to the camelCase shape when one exists; returns
  defaults (and does not throw) when either query errors. `updateMyPreferences`: 401 when signed
  out; 429 past 30 writes/minute; `{ dailyMinutes }` updates `users.daily_minutes` and never
  touches `user_preferences`; any other patch upserts `user_preferences` with `onConflict:
  "user_id"` and an `updated_at`, never touches `users`; returns the full merged preferences.

- [ ] **Step 13: Write `lib/data/preferences.ts`**

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import { DEFAULT_PREFERENCES, type IsoWeekday, type UserPreferences } from "@/lib/preferences/options";
import type { PreferencesPatch } from "@/lib/validation/preferences";

type Supabase = ReturnType<typeof createClient>;
const WRITE_LIMIT = { limit: 30, windowMs: 60_000 };

interface PreferencesRow {
  learning_schedule: UserPreferences["learningSchedule"];
  schedule_days: number[];
  review_frequency: UserPreferences["reviewFrequency"];
  difficulty: UserPreferences["difficulty"];
  display_scale: UserPreferences["displayScale"];
  reduce_motion: boolean;
  microphone_enabled: boolean;
  camera_enabled: boolean;
}

const COLUMNS =
  "learning_schedule, schedule_days, review_frequency, difficulty, display_scale, reduce_motion, microphone_enabled, camera_enabled";

function fromRow(row: PreferencesRow | null, dailyMinutes: number): UserPreferences {
  if (!row) return { ...DEFAULT_PREFERENCES, dailyMinutes };
  return {
    learningSchedule: row.learning_schedule,
    scheduleDays: row.schedule_days as IsoWeekday[],
    reviewFrequency: row.review_frequency,
    difficulty: row.difficulty,
    displayScale: row.display_scale,
    reduceMotion: row.reduce_motion,
    microphoneEnabled: row.microphone_enabled,
    cameraEnabled: row.camera_enabled,
    dailyMinutes,
  };
}

/**
 * Engines and layouts call this on hot paths, so it never throws: any failure
 * yields the defaults, which are the behaviour every user had before this
 * branch (normal intervals, adaptive band, every-day streak, scale 1).
 */
export async function readPreferences(supabase: Supabase, userId: string): Promise<UserPreferences> {
  try {
    const [prefs, user] = await Promise.all([
      supabase.from("user_preferences").select(COLUMNS).eq("user_id", userId).maybeSingle(),
      supabase.from("users").select("daily_minutes").eq("id", userId).maybeSingle(),
    ]);
    if (prefs.error) throw prefs.error;
    if (user.error) throw user.error;
    const dailyMinutes = (user.data as { daily_minutes: number } | null)?.daily_minutes ?? DEFAULT_PREFERENCES.dailyMinutes;
    return fromRow(prefs.data as PreferencesRow | null, dailyMinutes);
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side only.
    console.error("[data/preferences] readPreferences failed:", error);
    return { ...DEFAULT_PREFERENCES };
  }
}

export async function getMyPreferences(): Promise<UserPreferences | null> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return null;
  return readPreferences(supabase, user.id);
}

export type UpdatePreferencesResult =
  | { ok: true; data: UserPreferences }
  | { ok: false; status: 401 }
  | { ok: false; status: 429; retryAfter: number };

const TO_COLUMN: Record<string, string> = {
  learningSchedule: "learning_schedule",
  scheduleDays: "schedule_days",
  reviewFrequency: "review_frequency",
  difficulty: "difficulty",
  displayScale: "display_scale",
  reduceMotion: "reduce_motion",
  microphoneEnabled: "microphone_enabled",
  cameraEnabled: "camera_enabled",
};

export async function updateMyPreferences(
  patch: PreferencesPatch,
  now: Date = new Date(),
): Promise<UpdatePreferencesResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`preferences:${user.id}`, WRITE_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  if ("dailyMinutes" in patch) {
    const { error } = await supabase.from("users").update({ daily_minutes: patch.dailyMinutes }).eq("id", user.id);
    if (error) throw error;
  } else {
    const row: Record<string, unknown> = { user_id: user.id, updated_at: now.toISOString() };
    for (const [key, value] of Object.entries(patch)) row[TO_COLUMN[key]] = value;
    const { error } = await supabase.from("user_preferences").upsert(row, { onConflict: "user_id" });
    if (error) throw error;
  }
  return { ok: true, data: await readPreferences(supabase, user.id) };
}
```

- [ ] **Step 14: Write `app/api/user/preferences/route.test.ts` then `route.ts`.** Mirror
  `app/api/user/model-training-consent/route.test.ts` case for case (invalid JSON 400 without a data
  call; schema failure 400 incl. the mixed `{ dailyMinutes, reduceMotion }` body; 401; 429 with
  `Retry-After`; 200 echoes `{ data }`; thrown error → opaque 500 whose body contains neither the
  error message nor a stack). `GET`: 401 when `getMyPreferences()` returns null, else `{ data }`.
  The route file is the consent route with `modelTrainingConsentSchema` → `preferencesPatchSchema`,
  `setModelTrainingConsent` → `updateMyPreferences`, context `[api/user/preferences]`, plus:

```ts
export async function GET(): Promise<NextResponse> {
  try {
    const data = await getMyPreferences();
    if (!data) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ data });
  } catch (error) {
    return opaque500("GET failed", error);
  }
}
```

- [ ] **Step 15: Verify.** `npx vitest run lib/preferences lib/validation/preferences.test.ts lib/data/preferences.test.ts app/api/user/preferences supabase/migrations`
  → PASS. `npx supabase db reset` then `npm run verify:db:settings` → every line PASS. `npx tsc
  --noEmit` 0, `npm run lint` 0 errors, full vitest to a file, exit 0.
- [ ] **Step 16: Hand back.** Leave changes uncommitted; set `- Owner: Claude` in the run state with
  the verification output. Claude commits as `feat(settings): user preferences storage and API`.

---

### Task 2: Engines read the preferences

**Files:**
- Modify: `lib/srs/sm2.ts`, `lib/srs/sm2.test.ts`, `lib/data/srs.ts`, `lib/data/mining.ts` (+ their tests)
- Modify: `lib/difficulty/score.ts`, `lib/difficulty/index.ts`, `lib/difficulty/score.test.ts`, `lib/data/difficulty.ts`, `lib/data/recommendations.ts`
- Modify: `lib/gamification/streak.ts`, `lib/gamification/streak.test.ts` (create if absent), `lib/data/gamification.ts`

**Interfaces:**
- Consumes: `readPreferences(supabase, userId)`, `ReviewFrequency`, `Difficulty`, `IsoWeekday`, `ALL_DAYS` (Task 1).
- Produces: `REVIEW_FREQUENCY_MULTIPLIER`, `reviewItem(state, quality, now?, intervalMultiplier = 1)`;
  `DIFFICULTY_BANDS`, `scoreComprehension(lemmas, known, band = DIFFICULTY_BANDS.adaptive)`;
  `advanceStreak(prev, now, scheduleDays = ALL_DAYS)`, `isoWeekdayOfVnDate(date: string): IsoWeekday`.

- [ ] **Step 1: SRS — failing tests** in `lib/srs/sm2.test.ts`:

```ts
describe("review frequency multiplier (settings spec §4.4)", () => {
  const passed = { repetitions: 3, intervalDays: 10, easeFactor: 2.5 };
  const now = new Date("2026-09-22T00:00:00Z");
  it("leaves normal unchanged", () => {
    expect(reviewItem(passed, 4, now, 1).intervalDays).toBe(reviewItem(passed, 4, now).intervalDays);
  });
  it("shortens for more and lengthens for relaxed, rounded, minimum 1", () => {
    const base = reviewItem(passed, 4, now).intervalDays; // 25
    expect(reviewItem(passed, 4, now, REVIEW_FREQUENCY_MULTIPLIER.more).intervalDays).toBe(Math.max(1, Math.round(base * 0.7)));
    expect(reviewItem(passed, 4, now, REVIEW_FREQUENCY_MULTIPLIER.relaxed).intervalDays).toBe(Math.round(base * 1.4));
    expect(reviewItem({ repetitions: 0, intervalDays: 0, easeFactor: 2.5 }, 4, now, 0.7).intervalDays).toBe(1);
  });
  it("nextReviewAt follows the multiplied interval", () => {
    const r = reviewItem(passed, 4, now, 1.4);
    expect(r.nextReviewAt.getTime() - now.getTime()).toBe(r.intervalDays * 86_400_000);
  });
  it("does not touch a failed review", () => {
    expect(reviewItem(passed, 1, now, 1.4).intervalDays).toBe(1);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run lib/srs` — FAIL.
- [ ] **Step 3: Implement.** In `sm2.ts` add
  `export const REVIEW_FREQUENCY_MULTIPLIER: Record<ReviewFrequency, number> = { normal: 1, more: 0.7, relaxed: 1.4 };`
  (import the type from `@/lib/preferences/options`), add the fourth parameter
  `intervalMultiplier = 1`, and on the passed path replace the final interval with
  `Math.max(1, Math.round(intervalDays * intervalMultiplier))` before computing `nextReviewAt`.
  In `lib/data/srs.ts` and `lib/data/mining.ts`, after `requireUser`/`getUser`, read
  `const prefs = await readPreferences(supabase, user.id);` and pass
  `REVIEW_FREQUENCY_MULTIPLIER[prefs.reviewFrequency]`. Update those files' tests: the mock now also
  answers the two preference reads; add one case per file proving `relaxed` reaches `reviewItem`
  (spy on `@/lib/srs` or assert the upserted `interval_days`).
- [ ] **Step 4: Difficulty — failing tests** in `lib/difficulty/score.test.ts`: with 90 known of
  100 words, `adaptive` → `ideal`, `easy` (band [0.88, 0.98]) → `ideal`, `challenge` (band
  [0.70, 0.90]) → `ideal`; with 96 of 100, `adaptive` → `too-easy`, `easy` → `ideal`; with 75 of
  100, `adaptive` → `too-hard`, `challenge` → `ideal`. Existing cases unchanged (default band).
- [ ] **Step 5: Implement.** In `score.ts`:

```ts
export interface DifficultyBand { tooHardMax: number; idealMax: number }
export const DIFFICULTY_BANDS: Record<Difficulty, DifficultyBand> = {
  adaptive: { tooHardMax: TOO_HARD_MAX, idealMax: IDEAL_MAX },
  easy: { tooHardMax: 0.88, idealMax: 0.98 },
  challenge: { tooHardMax: 0.7, idealMax: 0.9 },
};
```

  `scoreComprehension(contentLemmasList, knownLemmas, band: DifficultyBand = DIFFICULTY_BANDS.adaptive)`
  uses `band.tooHardMax` / `band.idealMax` in place of the constants. Export `DIFFICULTY_BANDS` and
  `DifficultyBand` from `lib/difficulty/index.ts`. `lib/data/difficulty.ts` and
  `lib/data/recommendations.ts` read `readPreferences(supabase, user.id)` once per call and pass
  `DIFFICULTY_BANDS[prefs.difficulty]`. Add one test per data file proving the band is passed.
- [ ] **Step 6: Streak — failing tests** in `lib/gamification/streak.test.ts`:

```ts
const at = (vnDate: string) => new Date(`${vnDate}T05:00:00Z`); // 12:00 VN
describe("schedule-aware streak (settings spec §4.3)", () => {
  // 2026-09-18 is a Friday; 19 Sat, 20 Sun, 21 Mon.
  const fri = { current: 4, longest: 4, lastActiveDate: "2026-09-18" };
  it("every day: a missed weekend breaks the streak", () => {
    expect(advanceStreak(fri, at("2026-09-21")).current).toBe(1);
  });
  it("weekdays: Friday then Monday continues", () => {
    expect(advanceStreak(fri, at("2026-09-21"), [1, 2, 3, 4, 5]).current).toBe(5);
  });
  it("weekdays: a missed scheduled Monday still breaks it on Tuesday", () => {
    expect(advanceStreak(fri, at("2026-09-22"), [1, 2, 3, 4, 5]).current).toBe(1);
  });
  it("activity on an unscheduled day still counts", () => {
    expect(advanceStreak(fri, at("2026-09-19"), [1, 2, 3, 4, 5]).current).toBe(5);
  });
  it("weekday is taken from the VN date, not UTC", () => {
    // 2026-09-20T18:00Z is Monday 01:00 in VN.
    expect(isoWeekdayOfVnDate(vnDateString(new Date("2026-09-20T18:00:00Z")))).toBe(1);
  });
});
```

- [ ] **Step 7: Implement** in `streak.ts`:

```ts
/** ISO weekday (Mon = 1 … Sun = 7) of a VN-local 'yyyy-MM-dd' (spec §4.3 day boundary). */
export function isoWeekdayOfVnDate(date: string): IsoWeekday {
  const day = parseDateOnly(date).getUTCDay(); // 0 = Sunday
  return (day === 0 ? 7 : day) as IsoWeekday;
}

export function advanceStreak(prev: StreakState, now: Date, scheduleDays: readonly IsoWeekday[] = ALL_DAYS): StreakState {
  const today = vnDateString(now);
  if (prev.lastActiveDate === today) return prev;
  let isConsecutive = false;
  if (prev.lastActiveDate !== null) {
    const gap = daysBetween(prev.lastActiveDate, today);
    isConsecutive = gap >= 1;
    // Every day strictly between the two must be unscheduled.
    for (let offset = 1; offset < gap && isConsecutive; offset += 1) {
      const between = new Date(parseDateOnly(prev.lastActiveDate).getTime() + offset * MS_PER_DAY)
        .toISOString().slice(0, 10);
      if (scheduleDays.includes(isoWeekdayOfVnDate(between))) isConsecutive = false;
    }
  }
  const current = isConsecutive ? prev.current + 1 : 1;
  return { current, longest: Math.max(prev.longest, current), lastActiveDate: today };
}
```

  Export `isoWeekdayOfVnDate` from `lib/gamification/index.ts`. Update the docstring's bullet list.
  In `lib/data/gamification.ts`, read `readPreferences(supabase, input.userId)` and pass
  `prefs.scheduleDays` to `advanceStreak`. The repo has no read-side streak decay (verified: the
  only caller of `advanceStreak` is this file), so nothing else changes.
- [ ] **Step 8: Verify** `npx vitest run lib/srs lib/difficulty lib/gamification lib/data` PASS;
  tsc 0; lint 0; full vitest to a file, exit 0. Hand back (Owner → Claude). Commit message:
  `feat(settings): SRS, difficulty and streak read the user's preferences`.

---

### Task 3: `Switch` and `SegmentedControl` primitives

**Files:**
- Create: `components/ui/switch.tsx`, `components/ui/switch.test.tsx`
- Create: `components/ui/segmented-control.tsx`, `components/ui/segmented-control.test.tsx`

**Interfaces:**
- Produces:
  `Switch({ checked, onCheckedChange, id?, disabled?, "aria-label"?, "aria-describedby"? })`;
  `SegmentedControl<T extends string>({ value, onValueChange, options: { value: T; label: string }[], "aria-label": string, disabled? })`.

- [ ] **Step 1: Failing tests.** Switch: renders `role="switch"` with `aria-checked` matching
  `checked`; click and Space both call `onCheckedChange(!checked)`; `disabled` blocks both.
  SegmentedControl: renders `role="radiogroup"` with the given `aria-label` and one `role="radio"`
  per option; the selected one has `aria-checked="true"` and `tabIndex=0`, the others `-1`;
  ArrowRight/ArrowDown select the next (wrapping), ArrowLeft/ArrowUp the previous, and move focus;
  clicking selects.
- [ ] **Step 2: Implement**, tokens only. Switch: a `<button type="button" role="switch">` whose
  track is `inline-flex h-icon-md aspect-[2/1] shrink-0 items-center rounded-full p-2xs` with
  `justify-start bg-muted` when off and `justify-end bg-primary` when on (the thumb moves by
  flex alignment, no translate arithmetic); thumb `size-icon-sm rounded-full bg-foreground`;
  `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`; `disabled:opacity-50`. SegmentedControl: `div role="radiogroup"` with
  `inline-flex rounded-full border border-border bg-input-background p-2xs`; each option a
  `button role="radio"` `rounded-full px-sm h-control-sm text-caption`, selected
  `bg-primary/15 text-primary-strong`, unselected `text-muted-foreground hover:text-foreground`.
- [ ] **Step 3: Verify** the two tests, `components/ui/token-scale-adoption.test.ts` and
  `components/ui/logical-properties.test.ts` PASS; tsc; lint. Hand back. Commit:
  `feat(ui): Switch and SegmentedControl primitives`.

---

### Task 4: Session-wide appearance — display scale and reduced motion

**Files:**
- Modify: `app/globals.css`, `lib/design-tokens.test.ts`
- Create: `lib/preferences/appearance-script.ts`, `lib/preferences/appearance-script.test.ts`
- Create: `components/providers/preferences-provider.tsx`, `components/providers/preferences-provider.test.tsx`
- Modify: `app/[locale]/(protected)/layout.tsx`, `components/providers/theme-provider.tsx` (+ its test)
- Create: `tests/e2e/display-scale.spec.ts`

**Interfaces:**
- Consumes: `getMyPreferences`, `DISPLAY_SCALE_FACTOR`, `UserPreferences` (Task 1).
- Produces: `appearanceScript(prefs: Pick<UserPreferences, "displayScale" | "reduceMotion">): string`;
  `PreferencesProvider({ initial, children })`, `usePreferences(): { preferences: UserPreferences; setLocal(patch: Partial<UserPreferences>): void }`
  (throws outside the provider).

- [ ] **Step 1: CSS.** In `app/globals.css`, change the two unit declarations so display scale
  multiplies whatever density resolves to (spec §4.5):

```css
:root {
  /* ... */
  --density-unit: calc(clamp(0.0555556rem, calc(100vw / 1440), 0.0625rem) * var(--display-scale, 1));
}
[data-density="reference"] {
  --density-unit: calc(0.0625rem * var(--display-scale, 1));
}
```

  `--display-scale` is set on `<html>` (the `:root` element itself), so the `:root` declaration
  substitutes it on the same element, and the `[data-density]` reset inherits it. Add a comment
  saying exactly that and pointing to `tests/e2e/display-scale.spec.ts` as the proof. Update
  `lib/design-tokens.test.ts` wherever it pins these two declarations; mutation-check: remove the
  `* var(--display-scale, 1)` from the reset, see the pin fail, restore.
- [ ] **Step 2: Failing test** `lib/preferences/appearance-script.test.ts`: the script for
  `{ displayScale: "large", reduceMotion: true }` run against a JSDOM `document.documentElement`
  (via `new Function(script)()`) sets `style --display-scale` to `1.125` and
  `data-reduce-motion="true"`; for `{ displayScale: "normal", reduceMotion: false }` it sets
  `--display-scale` `1` and `data-reduce-motion` to `"true"` only if `matchMedia("(prefers-reduced-motion: reduce)")`
  matches, else `"false"` — the OR rule of spec §4.5, tested for all four account/OS combinations.
- [ ] **Step 3: Implement** `appearance-script.ts`:

```ts
import { DISPLAY_SCALE_FACTOR, type UserPreferences } from "./options";
import { REDUCE_MOTION_ATTR, REDUCE_MOTION_QUERY } from "@/lib/motion/motion-enabled";

/**
 * Runs before paint (emitted by the (protected) layout). effectiveReduceMotion =
 * account || OS (spec §4.5): Korume may add reduction, never remove the OS's.
 * The values are server-derived enums/booleans, never user text, so inlining is safe.
 */
export function appearanceScript(prefs: Pick<UserPreferences, "displayScale" | "reduceMotion">): string {
  const scale = DISPLAY_SCALE_FACTOR[prefs.displayScale];
  const account = prefs.reduceMotion ? "true" : "false";
  return `(function(){try{var d=document.documentElement;d.style.setProperty("--display-scale","${scale}");var os=window.matchMedia("${REDUCE_MOTION_QUERY}").matches;d.setAttribute("${REDUCE_MOTION_ATTR}",(${account}||os)?"true":"false");}catch(e){}})();`;
}
```

- [ ] **Step 4: `PreferencesProvider`** (client): holds `UserPreferences` in state seeded from
  `initial`; `setLocal(patch)` merges and, when the patch touches `displayScale`, sets
  `--display-scale` on `document.documentElement`, and when it touches `reduceMotion`, calls the
  theme provider's `setReduceMotion(value || osReduces)`. Test: `usePreferences` throws outside
  the provider; `setLocal({ displayScale: "extra_large" })` sets `--display-scale` to `1.25`.
- [ ] **Step 5: Layout.** In `app/[locale]/(protected)/layout.tsx`, after the user check:
  `const preferences = (await getMyPreferences()) ?? DEFAULT_PREFERENCES;` and render

```tsx
<>
  <script dangerouslySetInnerHTML={{ __html: appearanceScript(preferences) }} />
  <PreferencesProvider initial={preferences}>
    <AmbientProvider>{children}</AmbientProvider>
  </PreferencesProvider>
</>
```

- [ ] **Step 6: Theme provider.** Its `setReduceMotion` is unchanged for logged-out pages
  (localStorage). Signed-in persistence happens in Task 8's Appearance row, which calls both
  `PATCH /api/user/preferences` and `setLocal`. Add a test that `setReduceMotion(false)` while
  `matchMedia` reports reduce leaves `motionEnabled()` false (the OR already lives there — this
  pins it).
- [ ] **Step 7: Browser measurement** `tests/e2e/display-scale.spec.ts` (Playwright, signed in via
  `registerViaUi`/`signInViaUi` from `tests/e2e/fixtures/auth.ts`, setting the preference with
  `page.request.patch("/api/user/preferences", { data: { displayScale } })`). For each of `normal`,
  `large`, `extra_large`, read `getComputedStyle(el).paddingTop` of an element with a known
  `--space-*` padding and assert the ratio to `normal` equals the factor within 0.01:
  (a) the `(app)` route `/en/dashboard` at 1280 × 800, (b) the `(immersive)` route `/en/journal`
  (a `data-density="reference"` subtree) at 1280 × 800, (c) an open dialog (portal) on `/en/settings/privacy`,
  and (d) `/en/dashboard` at 1280 × 529 with `extra_large`: `scrollWidth <= clientWidth`. Assert
  the element collection used in each case is non-empty. Reset to `normal` at the end.
- [ ] **Step 8: Verify** unit tests, tsc, lint, full vitest to a file. Claude runs the Playwright spec
  (Codex never runs Playwright). Hand back. Commit: `feat(settings): display scale and account reduced motion`.

---

### Task 5: Microphone and camera gate

**Files:**
- Create: `lib/media/device-gate.ts`, `lib/media/device-gate.test.ts`
- Modify: `components/video-player/recorder.tsx` (+ its test), `messages/en/shadowing.json`, `messages/vi/shadowing.json`

**Interfaces:**
- Consumes: `usePreferences()` (Task 4).
- Produces: `canUseDevice(prefs: Pick<UserPreferences, "microphoneEnabled" | "cameraEnabled">, device: "microphone" | "camera"): boolean`;
  `RecorderState` gains `"disabled-in-settings"`.

- [ ] **Step 1: Failing tests.** `device-gate.test.ts`: the four combinations. Recorder test: with
  `microphoneEnabled: false` in the provider, `start()` sets state `"disabled-in-settings"` and
  `navigator.mediaDevices.getUserMedia` is **never called**; the rendered message links to
  `/settings#privacy`. With `true`, behaviour is unchanged (existing tests stay green).
- [ ] **Step 2: Implement** `canUseDevice` (one line per device, doc comment: every future camera
  feature must call it — spec §1.5). In `useRecorder().start`, before the `getUserMedia` support
  check: `if (!canUseDevice(preferences, "microphone")) { setState("disabled-in-settings"); return; }`.
  The recorder panel renders `shadowing.recorder.disabledInSettings` with a `Link` to
  `/settings#privacy`. Add the string in en and vi.
- [ ] **Step 3: Verify** and hand back. Commit: `feat(settings): Korume's own microphone and camera switches`.

---

### Task 6: Export Data and Download Learning History

**Files:**
- Create: `lib/user-export/tables.ts`, `lib/user-export/tables.test.ts`
- Create: `lib/csv/write.ts`, `lib/csv/write.test.ts`
- Create: `lib/data/user-export.ts`, `lib/data/user-export.test.ts`
- Create: `app/api/user/export/route.ts`, `app/api/user/history.csv/route.ts` (+ tests)

**Interfaces:**
- Produces: `USER_EXPORT_TABLES: readonly { table: string; userColumn: string }[]`,
  `USER_EXPORT_EXCLUSIONS: Record<string, string>` (table → reason);
  `toCsv(header: string[], rows: (string | number | null)[][]): string`;
  `exportMyData(): Promise<ExportResult>`, `myLearningHistoryCsv(): Promise<HistoryResult>`.

- [ ] **Step 1: Guard test (failing first because the list is empty).** `tables.test.ts` reads every
  `supabase/migrations/*.sql`, strips comments, collects table names that declare a column
  `references users` / `references public.users` / `references auth.users` (regex over each
  `create table <name> ( ... );` body), and asserts every collected name is in
  `USER_EXPORT_TABLES` or `USER_EXPORT_EXCLUSIONS`, and every listed name was collected. Assert the
  collected set is non-empty and has the size you measured (record the number in the test comment).
  `users` itself is exported by id (`userColumn: "id"`) and listed explicitly.
- [ ] **Step 2: Fill `tables.ts`** with every collected table. Exclusions need a one-line reason
  each (e.g. `account_deletion_tombstones: "service-role only; no RLS read for the user"`). Include
  `user_preferences`. Mutation-check the guard: delete one entry, see red, restore.
- [ ] **Step 3: `toCsv`** — RFC 4180: fields containing `,`, `"`, CR or LF are quoted, quotes
  doubled; `null` → empty; rows joined with `\r\n`; a leading `=`, `+`, `-` or `@` is prefixed with
  `'` (spreadsheet formula injection). Tests for each rule and a round trip through `parseCsv`.
- [ ] **Step 4: Data + routes.** `exportMyData` (RLS client, `requireUser`, rate limit 3/hour
  keyed `export:<id>`) selects `*` from each table filtered by its `userColumn = user.id` and
  returns `{ exportedAt, userId, tables: Record<string, unknown[]> }`. Route returns it as
  `Content-Type: application/json` with `Content-Disposition: attachment; filename="korume-export-YYYY-MM-DD.json"`.
  `myLearningHistoryCsv` builds one CSV with header `date,kind,item,detail` from
  `user_video_progress` (kind `lesson`), the four `user_*_progress` SRS tables (kind `review`,
  detail = interval days) and `user_badges` (kind `badge`), newest first. Read each table's
  columns from its `create table` in `supabase/migrations/` before writing the query: `date` is
  the table's own most recent timestamp column (e.g. `last_reviewed_at`, `updated_at`,
  `earned_at` — whichever the table actually has), `item` is the joined content's display text
  (video title, kanji character, vocab word, grammar pattern, badge name). If a table has no
  timestamp column, stop and report rather than inventing one; route sets
  `text/csv; charset=utf-8` and `attachment; filename="korume-history-YYYY-MM-DD.csv"`. Both
  routes follow the Global Constraints error contract. Tests: 401, 429, headers, a thrown error is
  opaque, the export contains a `user_preferences` key.
- [ ] **Step 5: Verify** and hand back. Commit: `feat(settings): export data and learning history`.

---

### Task 7: Erase Korume Memory

**Files:**
- Create: `lib/validation/memory-erase.ts`, `lib/data/memory-erase.ts`, `app/api/user/memory-erase/route.ts` (+ tests)
- Create: `components/settings/memory-erase-form.tsx` (+ test)
- Modify: `app/[locale]/(protected)/(app)/settings/privacy/memory/page.tsx`
- Modify: `messages/en/settings.json`, `messages/vi/settings.json`, `messages/*/upcoming.json` (drop `privacyMemory`)
- Modify: `lib/product/screen-registry.ts` (`privacy-memory` → `impl: "built"`), `app/[locale]/(protected)/(app)/upcoming-routes.test.tsx`

**Interfaces:**
- Consumes: `erase_companion_memory()` (Task 1).
- Produces: `memoryEraseSchema` (`{ confirm: "ERASE" }`), `eraseMyMemory(): Promise<{ ok: true } | { ok: false; status: 401 } | { ok: false; status: 429; retryAfter: number }>`.

- [ ] **Step 1: Failing tests.** Route: 400 for `{}` and `{ confirm: "erase" }`; 401; 429 with
  `Retry-After`; 200 `{ data: { erased: true } }`; opaque 500. Data: calls
  `supabase.rpc("erase_companion_memory")` exactly once after the rate limit (3/hour, key
  `memory-erase:<id>`), throws the rpc error. Form: the button stays disabled until the input
  equals the translated confirm word; submit POSTs `{ confirm: "ERASE" }`; on 200 it navigates to
  `/settings#privacy` and toasts `settings.memoryErase.done`; on failure it shows
  `settings.memoryErase.failed` in a `role="alert"` without the server's text.
- [ ] **Step 2: Implement.** The page (server component) renders eyebrow, title, the erased/kept
  lists from spec §4.8 as two short plain-language lists, and `<MemoryEraseForm />`. The typed word
  is shown to the user in their locale, but the request body is always the literal `"ERASE"`.
- [ ] **Step 3: Registry + placeholder list.** `privacy-memory` → `impl: "built"` and remove the
  comment lines that describe it as a placeholder. In `upcoming-routes.test.tsx` remove
  `"settings/privacy/memory"` and set the length to 11 (Task 9 removes `"settings"`).
- [ ] **Step 4: Verify** and hand back. Claude also runs `npm run verify:db:settings` again (the
  erase check). Commit: `feat(settings): erase Korume memory`.

---

### Task 8: Settings controls — save hook and the three control sections

**Files:**
- Create: `components/settings/use-preference-save.ts` (+ test)
- Create: `components/settings/settings-section.tsx`, `components/settings/settings-row.tsx` (+ tests)
- Create: `components/settings/learning-section.tsx`, `components/settings/appearance-section.tsx`, `components/settings/privacy-data-section.tsx` (+ tests)
- Modify: `messages/en/settings.json`, `messages/vi/settings.json`

**Interfaces:**
- Consumes: `Switch`, `SegmentedControl`, `Select`, `usePreferences`, option lists, `preferencesPatchSchema` types.
- Produces: `usePreferenceSave(control: string, endpoint = "/api/user/preferences"): { save(body: Record<string, unknown>, optimistic: Partial<UserPreferences>): Promise<void>; saving: boolean }`;
  `SettingsSection({ id?, title, subtitle, children })`, `SettingsRow({ icon, label, description, control, htmlFor? })`.

- [ ] **Step 1: Failing test for the stale-response rule** (`use-preference-save.test.ts`, fake
  fetch with manually resolved promises):

```tsx
import { act, renderHook } from "@/test/render"; // intl-aware renderHook (test/render.tsx)
import { afterEach, describe, expect, it, vi } from "vitest";
import { PreferencesProvider, usePreferences } from "@/components/providers/preferences-provider";
import { ToastProvider } from "@/components/ui/toast";
import { DEFAULT_PREFERENCES, type UserPreferences } from "@/lib/preferences/options";
import { usePreferenceSave } from "./use-preference-save";

type Deferred = { resolve: (r: Response) => void };
const pending: Deferred[] = [];
const fetchMock = vi.fn(() => new Promise<Response>((resolve) => pending.push({ resolve })));
vi.stubGlobal("fetch", fetchMock);
afterEach(() => { pending.length = 0; fetchMock.mockClear(); });

const ok = (data: Partial<UserPreferences>) =>
  new Response(JSON.stringify({ data: { ...DEFAULT_PREFERENCES, ...data } }), { status: 200 });
const fail = () => new Response(JSON.stringify({ error: "x" }), { status: 500 });

function setup() {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ToastProvider><PreferencesProvider initial={DEFAULT_PREFERENCES}>{children}</PreferencesProvider></ToastProvider>
  );
  return renderHook(() => ({
    difficulty: usePreferenceSave("difficulty"),
    scale: usePreferenceSave("displayScale"),
    prefs: usePreferences().preferences,
  }), { wrapper });
}

describe("usePreferenceSave (settings spec §5)", () => {
  it("an older response arriving after a newer one changes nothing", async () => {
    const { result } = setup();
    let a!: Promise<void>, b!: Promise<void>;
    act(() => { a = result.current.difficulty.save({ difficulty: "easy" }, { difficulty: "easy" }); });
    act(() => { b = result.current.difficulty.save({ difficulty: "challenge" }, { difficulty: "challenge" }); });
    await act(async () => { pending[1].resolve(ok({ difficulty: "challenge" })); await b; });
    await act(async () => { pending[0].resolve(ok({ difficulty: "easy" })); await a; });
    expect(result.current.prefs.difficulty).toBe("challenge");
  });

  it("a failed latest request rolls back to the last confirmed value", async () => {
    const { result } = setup();
    let a!: Promise<void>;
    act(() => { a = result.current.difficulty.save({ difficulty: "easy" }, { difficulty: "easy" }); });
    expect(result.current.prefs.difficulty).toBe("easy");
    await act(async () => { pending[0].resolve(fail()); await a; });
    expect(result.current.prefs.difficulty).toBe("adaptive");
  });

  it("a failed stale request is ignored", async () => {
    const { result } = setup();
    let a!: Promise<void>, b!: Promise<void>;
    act(() => { a = result.current.difficulty.save({ difficulty: "easy" }, { difficulty: "easy" }); });
    act(() => { b = result.current.difficulty.save({ difficulty: "challenge" }, { difficulty: "challenge" }); });
    await act(async () => { pending[1].resolve(ok({ difficulty: "challenge" })); await b; });
    await act(async () => { pending[0].resolve(fail()); await a; });
    expect(result.current.prefs.difficulty).toBe("challenge");
  });

  it("two different controls saving at once do not affect each other", async () => {
    const { result } = setup();
    let a!: Promise<void>, b!: Promise<void>;
    act(() => { a = result.current.difficulty.save({ difficulty: "easy" }, { difficulty: "easy" }); });
    act(() => { b = result.current.scale.save({ displayScale: "large" }, { displayScale: "large" }); });
    await act(async () => { pending[1].resolve(ok({ displayScale: "large" })); await b; });
    await act(async () => { pending[0].resolve(fail()); await a; });
    expect(result.current.prefs).toMatchObject({ difficulty: "adaptive", displayScale: "large" });
  });
});
```
- [ ] **Step 2: Implement** `usePreferenceSave`: a `useRef<Record<string, number>>` of sequence
  numbers keyed by `control`, and a ref of last-confirmed values per control. `save()` increments
  the control's sequence, applies `optimistic` via `setLocal`, `fetch("/api/user/preferences",
  { method: "PATCH", body })`; on response, if `seq !== latest[control]` return; on success apply **only the keys in
  `optimistic`** from `response.data` via `setLocal` (never the whole row — another control may
  have a newer optimistic value in flight) and record them as confirmed; on failure
  restore the confirmed values and `toast({ variant: "danger", title: t("save.failed") })`.
- [ ] **Step 3: Sections** (client components, each row a `SettingsRow` with an icon from the
  repo's icon set used elsewhere in `components/settings`, label and description from
  `settings.page.*`):
  - `LearningSection`: Interface Language (`Select` of the supported locales; on change
    `router.replace(pathname, { locale })` from `@/lib/i18n/navigation`, no PATCH); Daily Learning
    Goal (`Select` of `DAILY_MINUTES_OPTIONS`, label "N min"); Learning Schedule
    (`SegmentedControl`; choosing Custom reveals seven day toggle buttons with `aria-pressed`,
    saving `{ learningSchedule: "custom", scheduleDays }`; deselecting the last day is refused
    with an inline hint, never sent); Review Frequency; Difficulty Preference.
  - `AppearanceSection`: Display Scale (`SegmentedControl`); Reduced Motion (`Switch`). The OS
    note: when `matchMedia(REDUCE_MOTION_QUERY)` matches and the switch is off, show
    `settings.page.reducedMotion.osOverrides` under the row (spec §4.5).
  - `PrivacyDataSection` (`id="privacy"`): Microphone and Camera (`Switch`), AI Training (`Switch`
    calling `PATCH /api/user/model-training-consent` through the same sequencing hook with
    `control: "aiTraining"` and an endpoint override), Export Data and Download Learning History as
    rows whose control is an `<a href="/api/user/export" download>` / `.../history.csv` styled as
    the frame's chevron row.
  Each section test: every control has the accessible name of its visible label; changing it
  calls `save` with exactly one control's fields.
- [ ] **Step 4: Copy.** Add `settings.page.*` (every label, description, option label, the OS
  note, `save.failed`) in en and vi. Section titles and subtitles follow the frame's English copy:
  "Learning — Personalize how you learn every day.", "Appearance — Adjust how Korume looks while you
  study.", "Privacy & Data — Control your learning data and privacy."
- [ ] **Step 5: Verify** and hand back. Commit: `feat(settings): settings controls with per-control saving`.

---

### Task 9: Page assembly, danger zone, daily goal, registry and e2e

**Files:**
- Create: `components/settings/deletion-controls.tsx` (+ test); Modify: `components/settings/privacy-screen.tsx` (+ test)
- Create: `components/settings/settings-page.tsx` (+ test)
- Modify: `app/[locale]/(protected)/(app)/settings/page.tsx`
- Modify: `components/shadowing/hub-companion-rail.tsx` (+ test), `app/[locale]/(protected)/(app)/shadowing/page.tsx`, `messages/*/shadowing.json`
- Modify: `messages/*/settings.json`, `messages/*/upcoming.json` (drop `settings`)
- Modify: `lib/product/screen-registry.ts` (`settings` → `impl: "built"`), `app/[locale]/(protected)/(app)/upcoming-routes.test.tsx` (→ 10)
- Create: `tests/e2e/settings.spec.ts`

**Interfaces:**
- Consumes: everything above; `DangerZone`, `DeleteDataDialog`, `DeletionPendingBanner`, `getPendingDeletion`, `getModelTrainingConsent`.
- Produces: `DeletionControls({ initialPending, variant: "privacy" | "settings" })`.

- [ ] **Step 1: Extract `DeletionControls`** from `PrivacyScreen`: move `openTier`, `pending`,
  `refreshPending` (with its sequence guard), the focus-transition effect, the "unknown" notice,
  `DeletionPendingBanner`, `DangerZone` and `DeleteDataDialog` into it, unchanged.
  `PrivacyScreen` renders its header, `AiTrainingToggle` and `<DeletionControls variant="privacy" />`.
  `privacy-screen.test.tsx` and `danger-zone.test.tsx` must pass **unmodified** — that is the proof
  the extraction changed nothing. `variant="settings"` only changes the section heading to the
  frame's "Danger zone" eyebrow; the three rows (Delete Korume Memory → `/settings/privacy/memory`,
  Erase all data, Delete account) are `DangerZone`'s.
- [ ] **Step 2: `SettingsPage`** (server-fed client component): header (eyebrow "Personal space",
  `h1` "Settings", subtitle "A quiet place to make Korume feel more like yours.", a small
  hand-cut mascot via `MascotPose` — add a `settings` pose name mapped to a `supplied` PNG, e.g.
  `happy.png`, in `components/mascot/mascot-poses.ts` and its test), then `LearningSection`,
  `AppearanceSection`, `PrivacyDataSection`, `DeletionControls variant="settings"`, About (one row:
  Version, value from `package.json` `version` read server-side), the support card ("Korume
  support · Need a hand? · Your Korume is always here whenever you need help." + a primary
  `Link` "Talk with Korume" → `/sensei`, no Contact Support), footer ("Korume · Version x.y.z",
  "Built quietly in Vietnam. Crafted for lifelong learners."). Column `mx-auto max-w-5xl`,
  sections `space-y-lg`, cards `rounded-lg border border-border bg-card p-xl`.
- [ ] **Step 3: Page.** `settings/page.tsx` reads `getMyPreferences()` (redirect to login on null),
  `getModelTrainingConsent()`, `readPendingDeletion()` (move that helper from the privacy page into
  `lib/data/account-deletion.ts` as `readPendingDeletionSafe()` and use it from both pages) and the
  version, and renders `SettingsPage`. `generateMetadata` uses `settings.page.title`.
- [ ] **Step 4: Daily goal consumer.** `HubCompanionRail` takes `dailyGoalMinutes: number | null`;
  when non-null the "Today's goal" card renders `labels.dailyGoal(minutes)` ("Daily goal: 20 min")
  and nothing else — no bar, no "0 of 20" (spec §4.2). The shadowing page passes
  `(await getMyPreferences())?.dailyMinutes ?? null`. Add `hub.rail.dailyGoal` in en and vi; keep
  `noGoal` for the null case. Rail test: renders the goal; renders no `progressbar` role.
- [ ] **Step 5: Registry + placeholders.** `settings` → `impl: "built"`; `upcoming-routes.test.tsx`
  removes `"settings"` → length 10; delete `upcoming.settings.*` strings.
- [ ] **Step 6: e2e `tests/e2e/settings.spec.ts`** (Claude runs it): sign up; open `/en/settings`;
  for Daily goal, Learning Schedule (Weekdays, then Custom with two days), Review Frequency,
  Difficulty, Display Scale, Reduced Motion, Microphone, Camera: change it, reload, assert the new
  value; assert none of Theme, Accent Color, Discord, Facebook, TikTok, Privacy Policy, Terms of
  Service, Send Feedback, Contact Support, Learning Reminders is on the page; `/en/settings/privacy`
  renders its own heading; Export Data downloads a JSON whose `tables` has a `user_preferences`
  key; Erase Memory: visit `/en/journal` once (it records the first-meeting memory), read
  `/api/user/export` and assert `tables.companion_memories` is non-empty, erase through
  `/en/settings/privacy/memory`, then read `/api/user/export` again **without** revisiting the
  journal (a visit re-records first meeting) and assert `companion_memories` and
  `conversation_sessions` are empty while `user_stats` is identical to before; at 1280 × 529 no
  horizontal overflow.
- [ ] **Step 7: Verify** everything: full vitest to a file, tsc, lint, `npm run verify:db:settings`
  on a fresh `npx supabase db reset`, and (Claude) the two Playwright specs. Hand back. Commit:
  `feat(settings): the settings page`.

---

## After Task 9 (Claude)

Whole-branch review (`/code-review high`), fix wave, spec §8 measurements recorded in the run state,
owner review on a `:3001` worktree server (restart it after any Tailwind or `globals.css` change),
then `--no-ff` merge.
