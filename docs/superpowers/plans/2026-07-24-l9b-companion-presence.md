# L9b Companion Presence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Companion visible — presence architecture (state machine, context bus, arbitration, Ambient Layer, anchors), the Journal UI at `/journal`, gifted-pin UI, a MASCOT.md-leaning placeholder sprite, and the four remaining discovered-memory producers.

**Architecture:** Pure deterministic core in `lib/companion/presence/` (no React, no I/O) + a thin React shell in `components/companion/` mounted once in the `(app)` layout. Producers hook existing server write paths via the shipped never-throw capture pattern. No new read endpoints — phase from `/api/user/stats`, memories from `/api/companion/journal`.

**Tech Stack:** Next.js 14 App Router, TS strict, next-intl 4 (vi/en), Tailwind + L9a design-system primitives, Vitest + RTL (`@/test/render`), Playwright, Supabase (`@/test/supabase-mock` for lib/data tests).

**Specs:** `docs/superpowers/specs/2026-07-24-l9b-companion-presence-design.md` (this plan's spec, D1–D9) governed by `docs/superpowers/specs/2026-07-16-companion-system-design.md` (Spec 1 — P0–P12, §5 semantics).

## Global Constraints

- **Branch:** `layer-9b-companion-presence` off master (create in Task 1 Step 0; merge `--no-ff` only after DoD).
- TS strict, no `any` without a justifying comment. TDD: failing test first, every task.
- **i18n invariants (L9a, permanent):** new keys land in en + vi in the SAME commit with identical key trees and identical ICU placeholders; vi plurals use CLDR `other` only; `messages/en/*.pin.test.ts` updated with literal `toBe` pins for every new leaf; `useTranslations(ns)` for ALL synchronous components, `await getTranslations` only for genuinely-async server components.
- **Copy rule D9:** every Companion line looks forward, never apologizes for the present ("no memories yet" is forbidden copy).
- **Naming:** `relationship_phase` / "phase" — the word "stage" is forbidden in identifiers and copy (P12).
- **Never-throw capture:** every producer wraps its whole body in try/catch + `console.error("[companion] …")` — a Companion failure must never fail a learning request (§6.5). No Companion error ever reaches the DOM (L9a convention #4).
- **§5.4 structural:** `CompanionAnchor` may be imported ONLY by files on the allowlist in `components/companion/anchor-boundary.test.ts` (Task 7). `emitContext` is callable anywhere.
- **Determinism (§12.2):** every meaningful decision (speak/silent, what, when) lives in pure functions; randomness only in sprite rendering.
- **Gates per task:** `npx tsc --noEmit` clean · `npx vitest run` green · `npm run lint` exit 0 with 0 NEW problems (baseline: 80 warnings / 23 files). Known CPU-contention flakes (standalone-green): `pitch-contour.test.tsx`, `waveform.test.tsx`.
- Component tests import `render` from `@/test/render` (NextIntl provider, locale="en", real EN catalogs).
- **Convention #2:** before touching a file, grep the import graph of every exported API you change; the file lists below are a strong hypothesis, not ground truth.
- Commit after every task (standing permission to commit; never push).

---

### Task 1: Presence core — contexts + state machine + config

**Files:**
- Create: `lib/companion/presence/contexts.ts`
- Create: `lib/companion/presence/state-machine.ts`
- Create: `lib/companion/presence/config.ts`
- Test: `lib/companion/presence/state-machine.test.ts`, `lib/companion/presence/contexts.test.ts`

**Interfaces:**
- Consumes: nothing (pure, leaf modules).
- Produces (later tasks import these exact names):
  - `ExperienceContext` = `"finished_shadowing" | "memory_created" | "empty_library" | "empty_mining_deck"`
  - `CONTEXT_PRIORITY: Record<ExperienceContext, number>`
  - `CompanionState` = `"idle" | "observing" | "listening" | "speaking" | "silent"`
  - `CompanionEvent` (union, see below), `transition(state, event): CompanionState`
  - `COOLDOWN_WINDOW_MS`, `CONTEXT_TTL_MS`, `COOLDOWN_OVERRIDE_MAX_PRIORITY`, `SPEECH_AUTO_FADE_MS`

- [ ] **Step 0: Create the branch**

```bash
git checkout master && git checkout -b layer-9b-companion-presence
```

- [ ] **Step 1: Write the failing tests**

`lib/companion/presence/state-machine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { transition, type CompanionState } from "./state-machine";

describe("transition (spec 1 §5.8)", () => {
  it("walks the address path: idle → observing → speaking → silent → idle", () => {
    let s: CompanionState = "idle";
    s = transition(s, { type: "context_arrived" });
    expect(s).toBe("observing");
    s = transition(s, { type: "address_granted", speechKey: "speech.finishedShadowing" });
    expect(s).toBe("speaking");
    s = transition(s, { type: "speech_dismissed" });
    expect(s).toBe("silent");
    s = transition(s, { type: "settled" });
    expect(s).toBe("idle");
  });

  it("denied address goes deliberately silent, never speaking", () => {
    expect(transition("observing", { type: "address_denied" })).toBe("silent");
  });

  it("listening is entered and left only by learner activity", () => {
    expect(transition("idle", { type: "learner_active" })).toBe("listening");
    expect(transition("listening", { type: "learner_idle" })).toBe("idle");
  });

  it("unknown transitions are no-ops (deterministic, never throws)", () => {
    expect(transition("speaking", { type: "context_arrived" })).toBe("speaking");
    expect(transition("idle", { type: "settled" })).toBe("idle");
  });
});
```

`lib/companion/presence/contexts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CONTEXT_PRIORITY, type ExperienceContext } from "./contexts";

describe("CONTEXT_PRIORITY (spec 1 §5.10 bands)", () => {
  it("covers every context with an ambient-band priority (≥50) — no context in this plan is a milestone", () => {
    const entries = Object.entries(CONTEXT_PRIORITY) as [ExperienceContext, number][];
    expect(entries.length).toBe(4);
    for (const [, priority] of entries) expect(priority).toBeGreaterThanOrEqual(50);
  });

  it("post-session address outranks empty-state guidance", () => {
    expect(CONTEXT_PRIORITY.finished_shadowing).toBeLessThan(CONTEXT_PRIORITY.empty_library);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/companion/presence`
Expected: FAIL — cannot resolve `./state-machine` / `./contexts`.

- [ ] **Step 3: Implement**

`lib/companion/presence/contexts.ts`:

```ts
/**
 * Experience contexts (Spec 1 §5.3): surfaces announce WHAT HAPPENED, never
 * business payloads and never what to say (§5.12). Every context in this
 * union is addressable — a surface merely being visited is presence (an
 * anchor), not a context: "a rest point with nothing meaningful to say gets
 * silence, not a scripted greeting" (Spec 1 §3.4).
 */
export type ExperienceContext =
  | "finished_shadowing"
  | "memory_created"
  | "empty_library"
  | "empty_mining_deck";

/**
 * Deterministic priority (lower number wins). Bands mirror Spec 1 §5.10:
 * 10 learner milestone · 20 relationship milestone · 30 reflection ·
 * 40 seasonal · 50+ ambient flavor. Everything this plan emits is ambient —
 * the milestone bands are reserved for later plans.
 */
export const CONTEXT_PRIORITY: Record<ExperienceContext, number> = {
  finished_shadowing: 50,
  memory_created: 51,
  empty_library: 52,
  empty_mining_deck: 53,
};
```

`lib/companion/presence/config.ts`:

```ts
/** Tuning constants (hidden — never surfaced in UI, like PHASE_THRESHOLDS). */

/** Experience-cooldown window (Spec 1 §5.10): after one address, further
 * ambient-band contexts inside this window are suppressed. */
export const COOLDOWN_WINDOW_MS = 90_000;

/** A pending context older than this is stale and silently discarded —
 * relevance decay, not a behavior-initiating timer (§5.7 is not violated). */
export const CONTEXT_TTL_MS = 5 * 60_000;

/** Priorities at or below this may break through an active cooldown
 * ("significantly higher priority", §5.10) — i.e. milestone bands only. */
export const COOLDOWN_OVERRIDE_MAX_PRIORITY = 20;

/** A finished address may auto-fade after this long — ending a speech turn
 * is presentation, not a timer-initiated behavior. */
export const SPEECH_AUTO_FADE_MS = 8_000;
```

`lib/companion/presence/state-machine.ts`:

```ts
/** Spec 1 §5.8 — five states, no animation, just state. Motion maps looks
 * onto these later (Spec 2); the System owns only states and transitions. */
export type CompanionState = "idle" | "observing" | "listening" | "speaking" | "silent";

export type CompanionEvent =
  | { type: "context_arrived" }
  | { type: "address_granted"; speechKey: string }
  | { type: "address_denied" }
  | { type: "speech_dismissed" }
  | { type: "learner_active" }
  | { type: "learner_idle" }
  | { type: "settled" };

/** Pure, total transition function. Unknown (state, event) pairs are no-ops
 * so the machine is deterministic and never throws (§12.2). */
export function transition(state: CompanionState, event: CompanionEvent): CompanionState {
  switch (state) {
    case "idle":
      if (event.type === "context_arrived") return "observing";
      if (event.type === "learner_active") return "listening";
      return state;
    case "observing":
      if (event.type === "address_granted") return "speaking";
      if (event.type === "address_denied") return "silent";
      return state;
    case "listening":
      if (event.type === "learner_idle") return "idle";
      return state;
    case "speaking":
      if (event.type === "speech_dismissed") return "silent";
      return state;
    case "silent":
      if (event.type === "settled") return "idle";
      return state;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/companion/presence`
Expected: PASS (2 files).

- [ ] **Step 5: Gates + commit**

```bash
npx tsc --noEmit && npm run lint
git add lib/companion/presence
git commit -m "feat(companion): presence core — contexts, state machine, tuning config (L9b Presence Task 1)"
```

---

### Task 2: Presence core — arbitration + speech-key selection

**Files:**
- Create: `lib/companion/presence/arbitration.ts`
- Create: `lib/companion/presence/speech.ts`
- Test: `lib/companion/presence/arbitration.test.ts`, `lib/companion/presence/speech.test.ts`

**Interfaces:**
- Consumes: `ExperienceContext`, `CONTEXT_PRIORITY` (Task 1); `COOLDOWN_WINDOW_MS`, `CONTEXT_TTL_MS`, `COOLDOWN_OVERRIDE_MAX_PRIORITY` (Task 1); `RelationshipPhase` from `@/lib/companion`.
- Produces:
  - `PendingContext { context: ExperienceContext; emittedAt: number }`
  - `CooldownState { lastAddressAt: number | null }`
  - `Resolution = { kind: "address"; context: ExperienceContext } | { kind: "silence" }`
  - `prunePending(pending: PendingContext[], now: number): PendingContext[]`
  - `resolve(pending: PendingContext[], cooldown: CooldownState, now: number): Resolution`
  - `speechKeyFor(context: ExperienceContext, phase: RelationshipPhase): string` — returns keys `"speech.finishedShadowing" | "speech.memoryCreated" | "speech.emptyLibrary" | "speech.emptyMiningDeck"` (catalog entries land in Task 7).

- [ ] **Step 1: Write the failing tests**

`lib/companion/presence/arbitration.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prunePending, resolve, type PendingContext } from "./arbitration";
import { CONTEXT_TTL_MS, COOLDOWN_WINDOW_MS } from "./config";

const at = (context: PendingContext["context"], emittedAt: number): PendingContext => ({ context, emittedAt });
const noCooldown = { lastAddressAt: null };

describe("resolve (spec 1 §5.10 — at most one address, deterministic)", () => {
  it("is silent with nothing pending", () => {
    expect(resolve([], noCooldown, 1_000)).toEqual({ kind: "silence" });
  });

  it("a burst of contexts yields exactly ONE address — the highest priority", () => {
    const pending = [at("empty_library", 10), at("finished_shadowing", 20), at("memory_created", 30)];
    expect(resolve(pending, noCooldown, 1_000)).toEqual({ kind: "address", context: "finished_shadowing" });
  });

  it("equal priority ties break by earliest emittedAt — same inputs, same choice", () => {
    const pending = [at("memory_created", 500), at("memory_created", 100)];
    expect(resolve(pending, noCooldown, 1_000)).toEqual({ kind: "address", context: "memory_created" });
    // determinism: repeated call, identical result (§12.2)
    expect(resolve(pending, noCooldown, 1_000)).toEqual(resolve(pending, noCooldown, 1_000));
  });

  it("ambient contexts inside an active cooldown are suppressed, not queued", () => {
    const cooldown = { lastAddressAt: 1_000 };
    const pending = [at("finished_shadowing", 1_500)];
    expect(resolve(pending, cooldown, 1_000 + COOLDOWN_WINDOW_MS - 1)).toEqual({ kind: "silence" });
    expect(resolve(pending, cooldown, 1_000 + COOLDOWN_WINDOW_MS + 1)).toEqual({
      kind: "address",
      context: "finished_shadowing",
    });
  });

  it("stale contexts are discarded by prunePending", () => {
    const pending = [at("empty_library", 0), at("memory_created", 10_000)];
    expect(prunePending(pending, CONTEXT_TTL_MS + 1)).toEqual([at("memory_created", 10_000)]);
  });
});
```

`lib/companion/presence/speech.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { speechKeyFor } from "./speech";
import type { ExperienceContext } from "./contexts";

describe("speechKeyFor", () => {
  it("maps every context to a distinct companion.* key", () => {
    const contexts: ExperienceContext[] = ["finished_shadowing", "memory_created", "empty_library", "empty_mining_deck"];
    const keys = contexts.map((c) => speechKeyFor(c, 1));
    expect(keys).toEqual([
      "speech.finishedShadowing",
      "speech.memoryCreated",
      "speech.emptyLibrary",
      "speech.emptyMiningDeck",
    ]);
    expect(new Set(keys).size).toBe(4);
  });

  it("is phase-stable in this plan (register shifts arrive with adaptive voice)", () => {
    expect(speechKeyFor("finished_shadowing", 1)).toBe(speechKeyFor("finished_shadowing", 4));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/companion/presence`
Expected: FAIL — cannot resolve `./arbitration` / `./speech`.

- [ ] **Step 3: Implement**

`lib/companion/presence/arbitration.ts`:

```ts
import { CONTEXT_PRIORITY, type ExperienceContext } from "./contexts";
import { CONTEXT_TTL_MS, COOLDOWN_OVERRIDE_MAX_PRIORITY, COOLDOWN_WINDOW_MS } from "./config";

export interface PendingContext {
  context: ExperienceContext;
  emittedAt: number;
}

export interface CooldownState {
  lastAddressAt: number | null;
}

export type Resolution = { kind: "address"; context: ExperienceContext } | { kind: "silence" };

/** Drop contexts older than CONTEXT_TTL_MS — stale moments are discarded,
 * never queued into a monologue (§5.10). */
export function prunePending(pending: PendingContext[], now: number): PendingContext[] {
  return pending.filter((p) => now - p.emittedAt <= CONTEXT_TTL_MS);
}

/**
 * Deterministic arbitration (Spec 1 §5.10): at most one address. Order:
 * priority (lower wins) → emittedAt (earlier wins) → context name. An active
 * experience cooldown suppresses everything except milestone-band priorities
 * (≤ COOLDOWN_OVERRIDE_MAX_PRIORITY — none exist in this plan).
 */
export function resolve(pending: PendingContext[], cooldown: CooldownState, now: number): Resolution {
  const live = prunePending(pending, now);
  if (live.length === 0) return { kind: "silence" };

  const [best] = [...live].sort((a, b) => {
    const byPriority = CONTEXT_PRIORITY[a.context] - CONTEXT_PRIORITY[b.context];
    if (byPriority !== 0) return byPriority;
    if (a.emittedAt !== b.emittedAt) return a.emittedAt - b.emittedAt;
    return a.context.localeCompare(b.context);
  });

  const cooldownActive = cooldown.lastAddressAt != null && now - cooldown.lastAddressAt <= COOLDOWN_WINDOW_MS;
  if (cooldownActive && CONTEXT_PRIORITY[best.context] > COOLDOWN_OVERRIDE_MAX_PRIORITY) {
    return { kind: "silence" };
  }
  return { kind: "address", context: best.context };
}
```

`lib/companion/presence/speech.ts`:

```ts
import type { RelationshipPhase } from "../types";
import type { ExperienceContext } from "./contexts";

/**
 * (context, phase) → key inside the `companion` catalog namespace. Phase is
 * accepted now so the signature is stable when register shifts arrive with
 * adaptive voice (Companion Plan 3); in this plan every phase speaks the
 * same template.
 */
export function speechKeyFor(context: ExperienceContext, phase: RelationshipPhase): string {
  void phase;
  switch (context) {
    case "finished_shadowing":
      return "speech.finishedShadowing";
    case "memory_created":
      return "speech.memoryCreated";
    case "empty_library":
      return "speech.emptyLibrary";
    case "empty_mining_deck":
      return "speech.emptyMiningDeck";
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/companion/presence`
Expected: PASS (4 files).

- [ ] **Step 5: Gates + commit**

```bash
npx tsc --noEmit && npm run lint
git add lib/companion/presence
git commit -m "feat(companion): deterministic arbitration + speech-key selection (L9b Presence Task 2)"
```

---

### Task 3: Domain prep — `first_meeting` type, mastery rule, carried cleanups, catalog keys

**Files:**
- Modify: `lib/companion/types.ts` (MemoryType union), `lib/companion/dedupe.ts` (new case + key change + never-guard), `lib/companion/phase.ts` (drop redundant `!`s), `lib/companion/index.ts` (export mastery)
- Create: `lib/companion/mastery.ts`
- Modify: `messages/en/companion.json`, `messages/vi/companion.json` (add `memoryTitle.firstMeeting`), `messages/en/companion.pin.test.ts`
- Modify: `lib/companion/dedupe.test.ts`, `lib/data/companion.test.ts` (remove dead service mock)
- Test: `lib/companion/mastery.test.ts`

**Interfaces:**
- Consumes: existing `MemoryType`, `MemoryRef`, `memoryTitleFor`, `dedupeKeyFor`.
- Produces:
  - `MemoryType` gains `"first_meeting"`.
  - `dedupeKeyFor("first_meeting")` → `"first_meeting"`; **`dedupeKeyFor("first_video_completed")` becomes the constant `"first_video_completed"`** (once-per-lifetime enforced at the DB by the `(user_id, dedupe_key)` upsert — no rows exist yet, safe to change).
  - `memoryTitleFor("first_meeting")` → `{ key: "memoryTitle.firstMeeting", values: {} }`.
  - `TARGET_SCORE = 80`, `MASTERY_ATTEMPTS = 3`, `qualifiesAsLineMastered(previousScores: number[], currentScore: number): boolean` from `lib/companion/mastery.ts` (re-exported by `@/lib/companion`).

- [ ] **Step 1: Write the failing tests**

`lib/companion/mastery.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MASTERY_ATTEMPTS, TARGET_SCORE, qualifiesAsLineMastered } from "./mastery";

describe("qualifiesAsLineMastered (spec D5 — deterministic, honest)", () => {
  it("qualifies: ≥3 attempts, current ≥80, at least one earlier attempt <80", () => {
    expect(qualifiesAsLineMastered([60, 75], 85)).toBe(true);
  });

  it("does not qualify when the current attempt misses the target", () => {
    expect(qualifiesAsLineMastered([60, 75], 79)).toBe(false);
  });

  it("does not qualify without enough attempts", () => {
    expect(qualifiesAsLineMastered([60], 85)).toBe(false); // 2 total < MASTERY_ATTEMPTS
  });

  it("first-try success is first_shadow's territory, never mastery-through-struggle", () => {
    expect(qualifiesAsLineMastered([90, 85], 88)).toBe(false); // no earlier struggle
  });

  it("constants are the spec's (hidden tuning, not UI)", () => {
    expect(TARGET_SCORE).toBe(80);
    expect(MASTERY_ATTEMPTS).toBe(3);
  });
});
```

Add to `lib/companion/dedupe.test.ts` (inside the existing `dedupeKeyFor` describe):

```ts
  it("first_meeting and first_video_completed are once-per-lifetime constants", () => {
    expect(dedupeKeyFor("first_meeting")).toBe("first_meeting");
    // Constant (not per-video): the (user_id, dedupe_key) unique upsert is
    // what enforces "first EVER completed video" race-free at the DB.
    expect(dedupeKeyFor("first_video_completed", { videoId: "v1" })).toBe("first_video_completed");
  });
```

and for the title descriptor (inside the existing `memoryTitleFor` describe):

```ts
  it("first_meeting maps to its own descriptor", () => {
    expect(memoryTitleFor("first_meeting")).toEqual({ key: "memoryTitle.firstMeeting", values: {} });
  });
```

**Delete** any existing `dedupe.test.ts` assertion expecting `first_video_completed:<videoId>` — the key is now constant.

Add to `messages/en/companion.pin.test.ts`, in the once-in-a-lifetime pin block:

```ts
    expect(en.memoryTitle.firstMeeting).toBe("The day the two of you met.");
```

and mirror the file's existing vi-assertion pattern with:

```ts
    expect(vi.memoryTitle.firstMeeting).toBe("Ngày hai bạn gặp nhau.");
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/companion messages/en/companion.pin.test.ts`
Expected: FAIL — `./mastery` unresolved; `first_meeting` not assignable to `MemoryType`; pin misses `firstMeeting`.

- [ ] **Step 3: Implement**

`lib/companion/types.ts` — extend the union (keep order, append):

```ts
export type MemoryType =
  | "first_shadow"
  | "line_mastered"
  | "mining_saved"
  | "first_video_completed"
  | "jlpt_passed"
  | "companion_grew"
  | "pinned_line"
  | "first_meeting";
```

`lib/companion/mastery.ts`:

```ts
/** Hidden tuning constants for the score-based producers (spec D5) — code
 * config like PHASE_THRESHOLDS, never surfaced in UI. */
export const TARGET_SCORE = 80;
export const MASTERY_ATTEMPTS = 3;

/**
 * `line_mastered` rule (spec D5, made deterministic): the current attempt
 * reaches the target, the line has ≥ MASTERY_ATTEMPTS scored attempts in
 * total, and at least one EARLIER attempt fell short — it *finally* got
 * there. First-try success is `first_shadow`'s territory.
 */
export function qualifiesAsLineMastered(previousScores: number[], currentScore: number): boolean {
  if (currentScore < TARGET_SCORE) return false;
  if (previousScores.length + 1 < MASTERY_ATTEMPTS) return false;
  return previousScores.some((score) => score < TARGET_SCORE);
}
```

`lib/companion/dedupe.ts` — in `dedupeKeyFor`, change the `first_video_completed` case and add `first_meeting`; add the exhaustiveness guard (carried cleanup #1):

```ts
    case "first_video_completed":
      // Constant on purpose: "first EVER completed video" is enforced by the
      // (user_id, dedupe_key) unique upsert itself — race-free at the DB.
      return "first_video_completed";
    case "first_meeting":
      return "first_meeting";
    default: {
      const exhaustive: never = type;
      throw new TypeError(`dedupeKeyFor: unhandled memory type ${String(exhaustive)}`);
    }
```

In `memoryTitleFor`, add before the `pinned_line` case:

```ts
    case "first_meeting":
      return { key: "memoryTitle.firstMeeting", values: {} };
```

`lib/companion/phase.ts` — carried cleanup #2, drop the three redundant `!`s (readonly tuple positions are never undefined):

```ts
export function relationshipPhaseForXp(xp: number): RelationshipPhase {
  if (xp >= PHASE_THRESHOLDS[3]) return 4;
  if (xp >= PHASE_THRESHOLDS[2]) return 3;
  if (xp >= PHASE_THRESHOLDS[1]) return 2;
  return 1;
}
```

`lib/companion/index.ts`:

```ts
export * from "./types";
export * from "./phase";
export * from "./dedupe";
export * from "./mastery";
```

`lib/data/companion.test.ts` — carried cleanup #3: delete the dead mock lines

```ts
import { createServiceClient } from "@/lib/supabase/service";
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
```

(verify `createServiceClient` is unused elsewhere in the file first; if a later test in the file actually uses it, it is not dead — leave it and note that in the commit message).

`messages/en/companion.json` — add inside `memoryTitle`, after `firstVideoCompleted`:

```json
    "firstMeeting": "The day the two of you met.",
```

`messages/vi/companion.json` — same position:

```json
    "firstMeeting": "Ngày hai bạn gặp nhau.",
```

(`companionGrew.1` keeps its existing copy — it is unreachable in practice, phase 1 is never *crossed into*, but the per-phase `Record` stays complete.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/companion lib/data/companion.test.ts messages/en/companion.pin.test.ts lib/i18n/catalog.test.ts test/messages.test.ts`
Expected: PASS — including the ICU catalog AST test over the new keys.

- [ ] **Step 5: Gates + commit**

```bash
npx tsc --noEmit && npm run lint
git add lib/companion lib/data/companion.test.ts messages/en/companion.json messages/vi/companion.json messages/en/companion.pin.test.ts
git commit -m "feat(companion): first_meeting type + mastery rule + carried Core cleanups (L9b Presence Task 3)"
```

---

### Task 4: Producers — `first_shadow` + `line_mastered` (hook the pronunciation-score write)

**Files:**
- Modify: `lib/data/companion.ts` (new `captureShadowScoreMemories`)
- Modify: `lib/data/pronunciation.ts` (extend ownership lookup + call capture after the score UPDATE)
- Test: `lib/data/companion.test.ts`, `lib/data/pronunciation.test.ts` (extend both)

**Interfaces:**
- Consumes: `recordDiscoveredMemory`, `createServiceClient` (`@/lib/supabase/service`), `TARGET_SCORE`, `qualifiesAsLineMastered` (`@/lib/companion`).
- Produces:
  - `ShadowScoreCaptureInput { userId: string; sessionId: string; videoId: string | null; transcriptLineId: string | null; pronunciationScore: number }`
  - `captureShadowScoreMemories(input: ShadowScoreCaptureInput): Promise<void>` — never throws; exported from `lib/data/companion.ts`.
- **Hook point (verified at planning time):** scores do NOT exist at session creation — `scorePronunciation` (`lib/data/pronunciation.ts`) is where `pronunciation_score` is persisted, so the capture hooks THERE, after the UPDATE at the end of the function. NOT `recordActivity`.

- [ ] **Step 1: Write the failing tests**

Extend `lib/data/companion.test.ts` (follow the file's existing `@/test/supabase-mock` idiom for chainable query mocks; mock `@/lib/supabase/service` so `createServiceClient` returns the mock client):

```ts
describe("captureShadowScoreMemories", () => {
  it("does nothing below TARGET_SCORE", async () => {
    await captureShadowScoreMemories({
      userId: "u1", sessionId: "s1", videoId: "v1", transcriptLineId: "l1", pronunciationScore: 79,
    });
    expect(serviceClientMock.from).not.toHaveBeenCalled();
  });

  it("records first_shadow (anchor) with line pointers when the score reaches target", async () => {
    // arrange mock: transcript_lines select → { text_jp: "こんにちは", start_time: 12.5 };
    // shadowing_sessions history select → [] (no earlier scored attempts)
    await captureShadowScoreMemories({
      userId: "u1", sessionId: "s1", videoId: "v1", transcriptLineId: "l1", pronunciationScore: 85,
    });
    // assert an upsert on companion_memories with memory_type "first_shadow",
    // is_anchor true, line_text_jp "こんにちは", timestamp_seconds 12.5
  });

  it("records line_mastered only when the struggle rule holds", async () => {
    // history [60, 75] → qualifies; assert second upsert memory_type "line_mastered"
    // history [90, 85] → does NOT qualify; assert no line_mastered upsert
  });

  it("never throws — a failing insert only console.errors", async () => {
    // make the mock upsert reject; expect the call to resolve undefined
  });
});
```

(Write the arrangements with the concrete mock-builder calls the file already uses for `captureCompanionMemories` — mirror its structure; the assertions above are the behaviour contract.)

Extend `lib/data/pronunciation.test.ts`: mock `captureShadowScoreMemories` (`vi.mock("@/lib/data/companion", …)` partial mock) and assert:

```ts
  it("captures shadow-score memories after persisting scores to an owned session", async () => {
    // successful scorePronunciation with shadowingSessionId → expect
    // captureShadowScoreMemories called with { userId, sessionId,
    // videoId, transcriptLineId, pronunciationScore } from the session row
  });

  it("does not capture when no shadowingSessionId is supplied", async () => {});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/data/companion.test.ts lib/data/pronunciation.test.ts`
Expected: FAIL — `captureShadowScoreMemories` is not exported.

- [ ] **Step 3: Implement**

Append to `lib/data/companion.ts` (imports: add `createServiceClient` from `@/lib/supabase/service`, `TARGET_SCORE`, `qualifiesAsLineMastered` to the existing `@/lib/companion` import):

```ts
export interface ShadowScoreCaptureInput {
  userId: string;
  sessionId: string;
  videoId: string | null;
  transcriptLineId: string | null;
  pronunciationScore: number;
}

/**
 * first_shadow + line_mastered producers (spec §6). Hooks the pronunciation
 * score WRITE (scores don't exist at session creation). Best-effort and
 * idempotent: never throws into the scoring request (§6.5); dedupe keys make
 * repeats no-ops.
 */
export async function captureShadowScoreMemories(input: ShadowScoreCaptureInput): Promise<void> {
  try {
    if (input.pronunciationScore < TARGET_SCORE) return;
    const service = createServiceClient();

    let lineTextJp: string | null = null;
    let timestampSeconds: number | null = null;
    if (input.transcriptLineId) {
      const { data: line } = await service
        .from("transcript_lines")
        .select("text_jp, start_time")
        .eq("id", input.transcriptLineId)
        .maybeSingle();
      const l = line as { text_jp: string | null; start_time: number | null } | null;
      lineTextJp = l?.text_jp ?? null;
      timestampSeconds = l?.start_time ?? null;
    }

    await recordDiscoveredMemory(service, {
      userId: input.userId,
      memoryType: "first_shadow",
      isAnchor: true,
      videoId: input.videoId,
      transcriptLineId: input.transcriptLineId,
      lineTextJp,
      timestampSeconds,
    });

    if (input.transcriptLineId) {
      const { data: rows } = await service
        .from("shadowing_sessions")
        .select("pronunciation_score")
        .eq("user_id", input.userId)
        .eq("transcript_line_id", input.transcriptLineId)
        .neq("id", input.sessionId)
        .not("pronunciation_score", "is", null);
      const previous = ((rows ?? []) as { pronunciation_score: number | null }[])
        .map((r) => r.pronunciation_score)
        .filter((s): s is number => s != null);
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
    console.error("[companion] captureShadowScoreMemories failed:", err);
  }
}
```

`lib/data/pronunciation.ts` — two edits:

1. Extend the ownership lookup select and keep the row (replace `select("id")`):

```ts
    const { data: session, error: lookupError } = await supabase
      .from("shadowing_sessions")
      .select("id, video_id, transcript_line_id")
      .eq("id", input.shadowingSessionId)
      .eq("user_id", user.id)
      .maybeSingle();
```

Hold it in a variable usable after scoring, typed:

```ts
  let ownedSession: { id: string; video_id: string | null; transcript_line_id: string | null } | null = null;
  // … inside the `if (input.shadowingSessionId)` block, after the null check:
  ownedSession = session as { id: string; video_id: string | null; transcript_line_id: string | null };
```

2. After the score UPDATE succeeds (immediately after the `if (updateError) throw updateError;` line):

```ts
    if (ownedSession) {
      // Best-effort — captureShadowScoreMemories never throws (§6.5).
      await captureShadowScoreMemories({
        userId: user.id,
        sessionId: ownedSession.id,
        videoId: ownedSession.video_id,
        transcriptLineId: ownedSession.transcript_line_id,
        pronunciationScore: result.pronunciationScore,
      });
    }
```

with `import { captureShadowScoreMemories } from "@/lib/data/companion";` at the top.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/data/companion.test.ts lib/data/pronunciation.test.ts`
Expected: PASS.

- [ ] **Step 5: Gates + commit**

```bash
npx tsc --noEmit && npm run lint
git add lib/data/companion.ts lib/data/pronunciation.ts lib/data/companion.test.ts lib/data/pronunciation.test.ts
git commit -m "feat(companion): first_shadow + line_mastered producers on the score write (L9b Presence Task 4)"
```

---

### Task 5: Producer — `first_video_completed` (hook `updateProgress`)

**Files:**
- Modify: `lib/data/companion.ts` (new `captureFirstVideoCompleted`), `lib/data/videos.ts` (`updateProgress` success path)
- Test: `lib/data/companion.test.ts`, `lib/data/videos.test.ts` (extend)

**Interfaces:**
- Consumes: `recordDiscoveredMemory`, `createServiceClient`.
- Produces: `captureFirstVideoCompleted(userId: string, videoId: string): Promise<void>` — never throws.
- Note: `updateProgress` does NOT go through `recordActivity` (video completion is not an XP outcome, G1) — the capture hooks the write path directly. The constant dedupe key from Task 3 makes "first EVER" race-free; repeats and re-completions are DB no-ops, and `ignoreDuplicates` preserves the original `occurred_at`.

- [ ] **Step 1: Write the failing tests**

Extend `lib/data/companion.test.ts`:

```ts
describe("captureFirstVideoCompleted", () => {
  it("records the anchor memory via the service client with the video pointer", async () => {
    await captureFirstVideoCompleted("u1", "v1");
    // assert companion_memories upsert: memory_type "first_video_completed",
    // is_anchor true, video_id "v1", dedupe key handled by recordDiscoveredMemory
  });

  it("never throws when the write fails", async () => {
    // reject the upsert; expect resolution, console.error spied
  });
});
```

Extend `lib/data/videos.test.ts` (mock `@/lib/data/companion` partial):

```ts
  it("captures first_video_completed only when the PATCH marks completion", async () => {
    // updateProgress with { position: 10, completed: true } → capture called with (userId, videoId)
    // updateProgress with { position: 10 } → capture NOT called
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/data/companion.test.ts lib/data/videos.test.ts`
Expected: FAIL — `captureFirstVideoCompleted` not exported.

- [ ] **Step 3: Implement**

Append to `lib/data/companion.ts`:

```ts
/** first_video_completed producer (spec §6). The constant dedupe key makes
 * "first EVER completed video" a DB-level once-per-lifetime; every later
 * completion is an ignored duplicate. Never throws (§6.5). */
export async function captureFirstVideoCompleted(userId: string, videoId: string): Promise<void> {
  try {
    const service = createServiceClient();
    await recordDiscoveredMemory(service, {
      userId,
      memoryType: "first_video_completed",
      ref: { videoId },
      isAnchor: true,
      videoId,
    });
  } catch (err) {
    console.error("[companion] captureFirstVideoCompleted failed:", err);
  }
}
```

`lib/data/videos.ts` — in `updateProgress`, after the upsert error check (the `if (error) return { ok: false, status: 400 };` line) and before the return:

```ts
  if (input.completed) {
    // Best-effort companion capture — never fails the progress request (§6.5).
    await captureFirstVideoCompleted(user.id, videoId);
  }
```

with `import { captureFirstVideoCompleted } from "@/lib/data/companion";` at the top. (Check for an import cycle: `lib/data/companion.ts` must not import from `lib/data/videos.ts` at module top level — it currently imports `requireUser` from there; if the cycle bites at runtime in tests, move the `captureFirstVideoCompleted` import in `videos.ts` to a lazy `await import("@/lib/data/companion")` inside the branch and note it.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/data/companion.test.ts lib/data/videos.test.ts`
Expected: PASS.

- [ ] **Step 5: Gates + commit**

```bash
npx tsc --noEmit && npm run lint
git add lib/data/companion.ts lib/data/videos.ts lib/data/companion.test.ts lib/data/videos.test.ts
git commit -m "feat(companion): first_video_completed producer on the progress write (L9b Presence Task 5)"
```

---

### Task 6: `first_meeting` capture — `recordFirstMeeting()` + carried cleanup #4 (pinMemory status coverage)

**Files:**
- Modify: `lib/data/companion.ts`
- Test: `lib/data/companion.test.ts`

**Interfaces:**
- Consumes: `createClient` (`@/lib/supabase/server`), `requireUser` (already imported in the file), `createServiceClient`, `recordDiscoveredMemory`.
- Produces: `recordFirstMeeting(): Promise<void>` — auth-aware, idempotent, never throws. **Called by the Journal page's server render (Task 10)** — the domain event is "the learner opens the Journal" (spec D8; planning-time simplification: no HTTP route — same event, same idempotent server-side capture, no extra round-trip; precedent: L5's lazy furigana cache writes on read).

- [ ] **Step 1: Write the failing tests**

Extend `lib/data/companion.test.ts`:

```ts
describe("recordFirstMeeting", () => {
  it("records the anchor memory for the signed-in user", async () => {
    // requireUser → { id: "u1" }; assert companion_memories upsert with
    // memory_type "first_meeting", is_anchor true (dedupe "first_meeting")
  });

  it("is a silent no-op when signed out", async () => {
    // requireUser → null; assert no service write
  });

  it("never throws when the write fails", async () => {});
});
```

Also add the **carried cleanup #4** coverage (Companion Core follow-up — `pinMemory` unit tests for its non-happy statuses, using the same mock arrangements the file already has for `pinMemory`'s happy path):

```ts
describe("pinMemory statuses (carried Core cleanup #4)", () => {
  it("returns 401 when signed out", async () => {
    // requireUser → null
    // expect { ok: false, status: 401 }
  });

  it("returns 429 with retryAfter when the pin rate limit trips", async () => {
    // drive rateLimit to reject (call pinMemory PIN_LIMIT.limit + 1 times with the same now)
    // expect { ok: false, status: 429, retryAfter: expect.any(Number) }
  });

  it("returns 400 for a transcript line that does not resolve", async () => {
    // transcript_lines lookup → null
    // expect { ok: false, status: 400 }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/data/companion.test.ts`
Expected: FAIL — `recordFirstMeeting` not exported (the pinMemory status tests should PASS immediately if the shipped behavior is correct — they are coverage, not new behavior; if one FAILS, that is a real Core defect: report it, then fix it in this task).

- [ ] **Step 3: Implement**

Append to `lib/data/companion.ts`:

```ts
/**
 * first_meeting producer (spec D8): the domain event is "the learner opens
 * the Journal" — the Journal page's server render calls this before reading
 * the journal, so the very first view already contains the first page.
 * Idempotent (constant dedupe key: the first open wins, occurred_at is that
 * moment) and best-effort: a failure only means the page appears on the next
 * open instead (§6.5).
 */
export async function recordFirstMeeting(): Promise<void> {
  try {
    const supabase = createClient();
    const user = await requireUser(supabase);
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/data/companion.test.ts`
Expected: PASS.

- [ ] **Step 5: Gates + commit**

```bash
npx tsc --noEmit && npm run lint
git add lib/data/companion.ts lib/data/companion.test.ts
git commit -m "feat(companion): recordFirstMeeting + pinMemory status coverage (L9b Presence Task 6)"
```

---

### Task 7: Ambient shell — provider, 4-verb hook, anchor, sprite, bubble + §5.4 scan + speech catalog

**Files:**
- Create: `components/companion/ambient-provider.tsx`, `components/companion/use-companion.ts`, `components/companion/companion-anchor.tsx`, `components/companion/companion-sprite.tsx`, `components/companion/speech-bubble.tsx`
- Create: `components/companion/anchor-boundary.test.ts` (§5.4 scan)
- Modify: `app/[locale]/(app)/layout.tsx` (mount provider), `messages/en/companion.json`, `messages/vi/companion.json` (speech + a11y keys), `messages/en/companion.pin.test.ts`
- Test: `components/companion/ambient.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–2 (`transition`, `resolve`, `prunePending`, `speechKeyFor`, constants, types); `relationshipPhaseForXp` from `@/lib/companion`; `useRouter` from `@/lib/i18n/navigation`; `useTheme` from `@/components/providers/theme-provider` (`reduceMotion`).
- Produces (later tasks import these exact names):
  - `AmbientProvider({ children })` — client component, mounted once in the `(app)` layout.
  - `useCompanion(): CompanionApi` where `CompanionApi { getCurrentState(): { state: CompanionState; phase: RelationshipPhase | null }; emitContext(context: ExperienceContext): void; openJournal(): void; requestReflection(): Promise<{ available: false }> }`. **Outside a provider it returns a no-op API** (silent, §6.5) — never throws.
  - `CompanionAnchor({ surface, pose, context }: { surface: string; pose: "sitting" | "standing" | "reading"; context?: ExperienceContext })` — the slot a surface renders to invite the Companion; optional `context` is emitted once on mount (a surface announcing what happened, §5.12-compliant).
- Behavior contract:
  - Anchor mount → provider fetches phase ONCE per session (`GET /api/user/stats` → `data.xp` → `relationshipPhaseForXp`); fetch failure → phase stays null, sprite still renders (presence needs no data), no error UI, `console.error` only.
  - `emitContext` pushes `{ context, emittedAt: Date.now() }`, drives machine `context_arrived`, then (only when an anchor is mounted) runs `resolve`; address → machine `address_granted` + `speechKey = speechKeyFor(context, phase ?? 1)` + `cooldown.lastAddressAt = now` + the addressed context removed from pending; silence → `address_denied` then `settled` back to idle.
  - Bubble: `role="status"` (polite live region), rendered text `t(speechKey)`, dismiss button (`a11y.dismissSpeech`), auto-fade after `SPEECH_AUTO_FADE_MS` → machine `speech_dismissed` → `settled`.
  - Sprite: focusable `<button>` with `aria-label={t("a11y.sprite")}`, activate → `openJournal()`; idle breathe animation class suppressed when `reduceMotion`.
  - Dormant surface = no anchor = nothing rendered, zero fetches; provider state persists across client-side navigation.

- [ ] **Step 1: Write the failing tests**

`components/companion/ambient.test.tsx` (use `@/test/render`; mock `@/lib/i18n/navigation`'s `useRouter`; stub `global.fetch` for `/api/user/stats`):

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test/render";
import { AmbientProvider } from "./ambient-provider";
import { CompanionAnchor } from "./companion-anchor";
import { useCompanion } from "./use-companion";

const pushMock = vi.fn();
vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push: pushMock }),
}));

function Emitter({ context }: { context: Parameters<ReturnType<typeof useCompanion>["emitContext"]>[0] }) {
  const companion = useCompanion();
  return <button onClick={() => companion.emitContext(context)}>emit</button>;
}

beforeEach(() => {
  pushMock.mockClear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { xp: 0 } }) }));
});

describe("Ambient shell", () => {
  it("renders nothing (dormant) without an anchor, and fetches nothing", () => {
    render(<AmbientProvider><div>page</div></AmbientProvider>);
    expect(screen.queryByRole("button", { name: /companion/i })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("an anchored surface renders the sprite; a context yields exactly ONE address", async () => {
    const user = userEvent.setup();
    render(
      <AmbientProvider>
        <CompanionAnchor surface="dashboard" pose="sitting" />
        <Emitter context="finished_shadowing" />
      </AmbientProvider>,
    );
    await user.click(screen.getByText("emit"));
    expect(await screen.findByRole("status")).toHaveTextContent(/journey/i); // speech.finishedShadowing EN
    // second ambient context inside the cooldown window → suppressed
    await user.click(screen.getByText("emit"));
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("sprite is a focusable door to the journal", async () => {
    const user = userEvent.setup();
    render(
      <AmbientProvider>
        <CompanionAnchor surface="dashboard" pose="sitting" />
      </AmbientProvider>,
    );
    await user.click(screen.getByRole("button", { name: /companion/i }));
    expect(pushMock).toHaveBeenCalledWith("/journal");
  });

  it("useCompanion outside a provider is a silent no-op API (§6.5)", () => {
    // render Emitter WITHOUT provider; clicking must not throw
  });

  it("a stats fetch failure leaves presence intact — sprite renders, no error UI", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    render(
      <AmbientProvider>
        <CompanionAnchor surface="dashboard" pose="sitting" />
      </AmbientProvider>,
    );
    expect(await screen.findByRole("button", { name: /companion/i })).toBeInTheDocument();
    expect(screen.queryByText(/error|down/i)).toBeNull();
  });

  it("reduced motion strips the idle breathe animation (spec 1 §9 / CLAUDE.md §2.4)", () => {
    // render with the theme provider forced to reduceMotion=true (follow the
    // reduced-motion arrangement transcript-pane.test.tsx / waveform.test.tsx use)
    // → the sprite button must NOT carry the "companion-breathe" class
  });
});
```

`components/companion/anchor-boundary.test.ts` (§5.4 structural scan — model on `components/ui/logical-properties.test.ts`):

```ts
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Spec 1 §5.4 made structural: the Companion CANNOT appear inside a learning
 * loop — enforced as an ALLOWLIST of files permitted to import the anchor.
 * A surface not on this list rendering CompanionAnchor is a build-breaking
 * defect, not a review nit. emitContext is callable anywhere (emitting is
 * not appearing).
 */
const ALLOWLIST = new Set([
  "app/[locale]/(app)/dashboard/page.tsx",
  "app/[locale]/(app)/journal/page.tsx",
  "app/[locale]/(app)/videos/page.tsx",
  "components/companion/journal-view.tsx",
  "components/companion/ambient.test.tsx",
  "components/video-player/mining-deck-list.tsx",
]);

function collectSources(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectSources(fullPath));
    else if (/\.tsx?$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

describe("CompanionAnchor import boundary (spec 1 §5.4)", () => {
  it("only allowlisted surfaces invite the Companion", () => {
    const roots = ["app", "components"].map((d) => path.join(process.cwd(), d));
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of collectSources(root)) {
        const rel = path.relative(process.cwd(), file).replaceAll(path.sep, "/");
        if (rel === "components/companion/companion-anchor.tsx") continue;
        const source = readFileSync(file, "utf8");
        if (source.includes("companion-anchor") && !ALLOWLIST.has(rel)) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});
```

(The allowlist names files Tasks 10/12 will create — the scan passes today because nothing imports the anchor yet, and locks the boundary from now on.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/companion`
Expected: FAIL — modules do not exist.

- [ ] **Step 3: Implement the pure-shell components**

`components/companion/use-companion.ts`:

```tsx
"use client";

import { createContext, useContext } from "react";
import type { RelationshipPhase } from "@/lib/companion";
import type { CompanionState } from "@/lib/companion/presence/state-machine";
import type { ExperienceContext } from "@/lib/companion/presence/contexts";

export interface CompanionApi {
  getCurrentState(): { state: CompanionState; phase: RelationshipPhase | null };
  emitContext(context: ExperienceContext): void;
  openJournal(): void;
  /** Plan 2 stub — AI reflection is Companion Plan 3. Always unavailable,
   * and the Companion simply says nothing about it (spec 1 §6.3). */
  requestReflection(): Promise<{ available: false }>;
}

/** Outside a provider the Companion simply isn't there — a silent no-op, so
 * no consumer can ever crash a surface over Companion wiring (§6.5). */
const NOOP_API: CompanionApi = {
  getCurrentState: () => ({ state: "idle", phase: null }),
  emitContext: () => {},
  openJournal: () => {},
  requestReflection: async () => ({ available: false }),
};

export const CompanionContext = createContext<CompanionApi | null>(null);
/** Internal registration channel for anchors; separate from the public
 * 4-verb API so surfaces cannot reach provider internals (spec 1 §5.9). */
export const CompanionAnchorContext = createContext<{
  registerAnchor: () => () => void;
  rendered: { speechKey: string | null; phase: RelationshipPhase | null; dismiss: () => void };
} | null>(null);

export function useCompanion(): CompanionApi {
  return useContext(CompanionContext) ?? NOOP_API;
}
```

`components/companion/ambient-provider.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { relationshipPhaseForXp, type RelationshipPhase } from "@/lib/companion";
import { transition, type CompanionState } from "@/lib/companion/presence/state-machine";
import { resolve, type CooldownState, type PendingContext } from "@/lib/companion/presence/arbitration";
import { speechKeyFor } from "@/lib/companion/presence/speech";
import { SPEECH_AUTO_FADE_MS } from "@/lib/companion/presence/config";
import type { ExperienceContext } from "@/lib/companion/presence/contexts";
import { CompanionAnchorContext, CompanionContext, type CompanionApi } from "./use-companion";

/**
 * The Ambient Layer (spec 1 §5.1): owns the creature's existence and state;
 * surfaces only declare where it stands (CompanionAnchor). Mounted once in
 * the (app) layout, so state — pending contexts, cooldown, machine —
 * persists across client-side navigation (§5.11). Dialogue is ephemeral by
 * design: a full reload clears pending contexts; only recorded memories are
 * canon (§6.2).
 */
export function AmbientProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [machine, setMachine] = useState<CompanionState>("idle");
  const [phase, setPhase] = useState<RelationshipPhase | null>(null);
  const [speechKey, setSpeechKey] = useState<string | null>(null);
  const [anchorCount, setAnchorCount] = useState(0);
  const pendingRef = useRef<PendingContext[]>([]);
  const cooldownRef = useRef<CooldownState>({ lastAddressAt: null });
  const phaseRequestedRef = useRef(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    setSpeechKey(null);
    setMachine((s) => transition(transition(s, { type: "speech_dismissed" }), { type: "settled" }));
  }, []);

  const runArbitration = useCallback(() => {
    if (anchorCount === 0 || speechKey !== null) return;
    const now = Date.now();
    const resolution = resolve(pendingRef.current, cooldownRef.current, now);
    if (resolution.kind === "address") {
      const key = speechKeyFor(resolution.context, phase ?? 1);
      pendingRef.current = pendingRef.current.filter((p) => p.context !== resolution.context);
      cooldownRef.current = { lastAddressAt: now };
      setSpeechKey(key);
      setMachine((s) => transition(s, { type: "address_granted", speechKey: key }));
      fadeTimerRef.current = setTimeout(dismiss, SPEECH_AUTO_FADE_MS);
    } else {
      setMachine((s) => transition(transition(s, { type: "address_denied" }), { type: "settled" }));
    }
  }, [anchorCount, speechKey, phase, dismiss]);

  const emitContext = useCallback(
    (context: ExperienceContext) => {
      pendingRef.current = [...pendingRef.current, { context, emittedAt: Date.now() }];
      setMachine((s) => transition(s, { type: "context_arrived" }));
      runArbitration();
    },
    [runArbitration],
  );

  // Anchors register on mount; the first one triggers the one-time phase read.
  const registerAnchor = useCallback(() => {
    setAnchorCount((n) => n + 1);
    return () => setAnchorCount((n) => n - 1);
  }, []);

  useEffect(() => {
    if (anchorCount === 0 || phaseRequestedRef.current) return;
    phaseRequestedRef.current = true;
    void fetch("/api/user/stats")
      .then(async (res) => (res.ok ? ((await res.json()) as { data?: { xp?: number } }) : null))
      .then((body) => {
        if (body?.data?.xp != null) setPhase(relationshipPhaseForXp(body.data.xp));
      })
      .catch((err) => {
        // Presence needs no data — the Companion is simply quieter (§6.5).
        console.error("[companion] phase fetch failed:", err);
      });
  }, [anchorCount]);

  // A surface with an anchor may have pending contexts waiting from a
  // dormant surface — arbitrate when an anchor arrives.
  useEffect(() => {
    runArbitration();
  }, [runArbitration]);

  const api = useMemo<CompanionApi>(
    () => ({
      getCurrentState: () => ({ state: machine, phase }),
      emitContext,
      openJournal: () => router.push("/journal"),
      requestReflection: async () => ({ available: false }),
    }),
    [machine, phase, emitContext, router],
  );

  const anchorValue = useMemo(
    () => ({ registerAnchor, rendered: { speechKey, phase, dismiss } }),
    [registerAnchor, speechKey, phase, dismiss],
  );

  return (
    <CompanionContext.Provider value={api}>
      <CompanionAnchorContext.Provider value={anchorValue}>{children}</CompanionAnchorContext.Provider>
    </CompanionContext.Provider>
  );
}
```

`components/companion/companion-anchor.tsx`:

```tsx
"use client";

import { useContext, useEffect, useRef } from "react";
import type { ExperienceContext } from "@/lib/companion/presence/contexts";
import { CompanionAnchorContext, useCompanion } from "./use-companion";
import { CompanionSprite, type CompanionPose } from "./companion-sprite";
import { SpeechBubble } from "./speech-bubble";

export interface CompanionAnchorProps {
  /** Stable surface id — used for nothing but debugging today; the contract
   * (spec 1 §5.2) is that the SURFACE declares where the creature stands. */
  surface: string;
  pose: CompanionPose;
  /** Optional experience context announced once on mount — the surface says
   * WHAT HAPPENED, never what to say (spec 1 §5.12). */
  context?: ExperienceContext;
}

/** The slot a surface renders to invite the Companion (spec 1 §5.2). No
 * anchor on a surface = the Companion is dormant there — it never creates
 * its own anchor. */
export function CompanionAnchor({ surface, pose, context }: CompanionAnchorProps) {
  const registration = useContext(CompanionAnchorContext);
  const companion = useCompanion();
  const emittedRef = useRef(false);

  useEffect(() => {
    if (!registration) return;
    const unregister = registration.registerAnchor();
    return unregister;
  }, [registration]);

  useEffect(() => {
    if (context && !emittedRef.current) {
      emittedRef.current = true;
      companion.emitContext(context);
    }
  }, [context, companion]);

  if (!registration) return null;
  const { speechKey, dismiss } = registration.rendered;

  return (
    <div className="flex items-end gap-2" data-companion-surface={surface}>
      <CompanionSprite pose={pose} onActivate={companion.openJournal} />
      {speechKey ? <SpeechBubble speechKey={speechKey} onDismiss={dismiss} /> : null}
    </div>
  );
}
```

`components/companion/companion-sprite.tsx`:

```tsx
"use client";

import { useTranslations } from "@/lib/i18n";
import { useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

export type CompanionPose = "sitting" | "standing" | "reading";

/**
 * Placeholder sprite (spec D2 + Spec 1 §7): a neutral creature-shaped SVG
 * leaning on MASCOT.md's visual direction — cream body, pale-teal ear-leaves,
 * amber memory orb — with NO name anywhere. It holds the anchor contract
 * (size + pose); Character Identity (Spec 2) later swaps the art with zero
 * logic change. Randomless markup: any idle variation is CSS-only.
 */
const POSE_CLASS: Record<CompanionPose, string> = {
  sitting: "translate-y-0.5",
  standing: "",
  reading: "-rotate-3",
};

export function CompanionSprite({ pose, onActivate }: { pose: CompanionPose; onActivate: () => void }) {
  const t = useTranslations("companion");
  const { reduceMotion } = useTheme();
  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label={t("a11y.sprite")}
      className={cn(
        "inline-flex h-12 w-12 items-center justify-center rounded-full",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
        POSE_CLASS[pose],
        !reduceMotion && "companion-breathe",
      )}
    >
      <svg viewBox="0 0 48 48" aria-hidden="true" className="h-12 w-12">
        {/* body: cream */}
        <ellipse cx="24" cy="30" rx="13" ry="11" fill="#F3ECD9" stroke="#D9CFB4" />
        {/* head: oversized (MASCOT.md), cream */}
        <circle cx="24" cy="16" r="10" fill="#F5EFE0" stroke="#D9CFB4" />
        {/* leaf/wing ears: pale teal */}
        <path d="M15 9 C 11 3, 19 2, 19 8 Z" fill="#BFE3DC" />
        <path d="M33 9 C 37 3, 29 2, 29 8 Z" fill="#BFE3DC" />
        {/* minimal expressive eyes */}
        <circle cx="20.5" cy="15.5" r="1.4" fill="#4A4A44" />
        <circle cx="27.5" cy="15.5" r="1.4" fill="#4A4A44" />
        {/* tail: light ribbon */}
        <path d="M36 33 C 44 30, 44 22, 39 20" fill="none" stroke="#BFE3DC" strokeWidth="2" strokeLinecap="round" />
        {/* memory orb: amber, always nearby */}
        <circle cx="40" cy="12" r="3" fill="#E8B84B" opacity="0.9" />
      </svg>
    </button>
  );
}
```

Add the breathe keyframes to `app/globals.css` next to the existing one-shot keyframes (they are already behind the global reduced-motion kill switch — mirror the pattern used by the L6 keyframes):

```css
@keyframes companion-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
}
.companion-breathe { animation: companion-breathe 4.5s ease-in-out infinite; }
```

`components/companion/speech-bubble.tsx`:

```tsx
"use client";

import { useTranslations } from "@/lib/i18n";

/** Renders one template address. role="status" = polite live region; the
 * text is a companion.* template chosen by the pure core — surfaces never
 * script it (spec 1 §5.12). */
export function SpeechBubble({ speechKey, onDismiss }: { speechKey: string; onDismiss: () => void }) {
  const t = useTranslations("companion");
  return (
    <div role="status" className="max-w-xs rounded-lg border border-border bg-surface px-3 py-2 text-sm">
      {/* Dynamic key — resolved through the same idiom as conversation's
          scenarioLabel (L9a Task 15): the catalog guarantees the key exists. */}
      {t(speechKey as Parameters<typeof t>[0])}
      <button type="button" onClick={onDismiss} aria-label={t("a11y.dismissSpeech")} className="ms-2 text-muted-foreground">
        ×
      </button>
    </div>
  );
}
```

(If `bg-surface` is not a token in this repo's tailwind config, use the surface token the L9a design system actually ships — check `components/ui/dialog.tsx`'s panel classes and reuse them.)

- [ ] **Step 4: Mount the provider in the (app) layout**

`app/[locale]/(app)/layout.tsx` — wrap `<main>`:

```tsx
import { AmbientProvider } from "@/components/companion/ambient-provider";
// … in the returned JSX:
      <AmbientProvider>
        <main className="flex-1">{children}</main>
      </AmbientProvider>
```

- [ ] **Step 5: Add the speech + a11y catalog keys**

`messages/en/companion.json` — add top-level siblings of `memoryTitle`:

```json
  "speech": {
    "finishedShadowing": "Another line has become part of your journey.",
    "memoryCreated": "That moment is safe in the journal now.",
    "emptyLibrary": "The first video you bring here will start a new chapter.",
    "emptyMiningDeck": "Lines you save will gather here, ready to be remembered."
  },
  "a11y": {
    "sprite": "Your companion — open the journal",
    "dismissSpeech": "Dismiss"
  }
```

`messages/vi/companion.json` — identical tree:

```json
  "speech": {
    "finishedShadowing": "Thêm một câu thoại nữa đã thành một phần hành trình của bạn.",
    "memoryCreated": "Khoảnh khắc ấy đã được giữ lại trong nhật ký.",
    "emptyLibrary": "Video đầu tiên bạn mang về đây sẽ mở ra một chương mới.",
    "emptyMiningDeck": "Những câu bạn lưu sẽ tụ về đây, chờ được ghi nhớ."
  },
  "a11y": {
    "sprite": "Bạn đồng hành của bạn — mở nhật ký",
    "dismissSpeech": "Đóng lời nhắn"
  }
```

Add literal pins for all new EN leaves (and the vi mirrors, following the file's pattern) to `messages/en/companion.pin.test.ts`. Every line obeys D9 — forward-looking, no "empty", no apology.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run components/companion messages/en/companion.pin.test.ts lib/i18n/catalog.test.ts`
Expected: PASS — ambient behavior, boundary scan, pins, ICU AST.

- [ ] **Step 7: Gates + commit**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
git add components/companion "app/[locale]/(app)/layout.tsx" app/globals.css messages/en/companion.json messages/vi/companion.json messages/en/companion.pin.test.ts
git commit -m "feat(companion): ambient shell — provider, 4-verb API, anchor, placeholder sprite, §5.4 scan (L9b Presence Task 7)"
```

---

### Task 8: Journal read side — expose `dedupeKey`, `refFromDedupeKey`

**Files:**
- Modify: `lib/data/companion.ts` (`MEMORY_COLUMNS`, `MemoryRow`, `toMemory`), `lib/companion/types.ts` (`CompanionMemory.dedupeKey`), `lib/companion/dedupe.ts` (`refFromDedupeKey`)
- Test: `lib/companion/dedupe.test.ts`, `lib/data/companion.test.ts`

**Interfaces:**
- Consumes: existing `MemoryRef`, `MemoryType`.
- Produces:
  - `CompanionMemory` gains `dedupeKey: string | null` (mapped from the new `dedupe_key` column in `MEMORY_COLUMNS`).
  - `refFromDedupeKey(type: MemoryType, dedupeKey: string | null): MemoryRef` — the inverse of `dedupeKeyFor` for the two types whose titles need ICU values (`jlpt_passed` → `{ jlptLevel }`, `companion_grew` → `{ phase }`); everything else `{}`. This is how the Journal UI (Task 10) reconstructs `memoryTitleFor` values at READ time — the row stores no ref.

- [ ] **Step 1: Write the failing tests**

Add to `lib/companion/dedupe.test.ts`:

```ts
describe("refFromDedupeKey (read-time inverse for title values)", () => {
  it("recovers the JLPT level and the phase", () => {
    expect(refFromDedupeKey("jlpt_passed", "jlpt_passed:N4")).toEqual({ jlptLevel: "N4" });
    expect(refFromDedupeKey("companion_grew", "companion_grew:3")).toEqual({ phase: 3 });
  });

  it("is total: null, malformed, and value-less keys yield {}", () => {
    expect(refFromDedupeKey("jlpt_passed", null)).toEqual({});
    expect(refFromDedupeKey("companion_grew", "companion_grew:9")).toEqual({});
    expect(refFromDedupeKey("first_meeting", "first_meeting")).toEqual({});
  });

  it("round-trips with dedupeKeyFor for the value-carrying types", () => {
    expect(refFromDedupeKey("jlpt_passed", dedupeKeyFor("jlpt_passed", { jlptLevel: "N2" }))).toEqual({ jlptLevel: "N2" });
    expect(refFromDedupeKey("companion_grew", dedupeKeyFor("companion_grew", { phase: 2 }))).toEqual({ phase: 2 });
  });
});
```

Extend the `listJournal` test in `lib/data/companion.test.ts`: the selected columns now include `dedupe_key`, and the mapped memory exposes `dedupeKey`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/companion/dedupe.test.ts lib/data/companion.test.ts`
Expected: FAIL — `refFromDedupeKey` not exported; column mismatch.

- [ ] **Step 3: Implement**

`lib/companion/dedupe.ts` — append:

```ts
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
```

`lib/companion/types.ts` — add to `CompanionMemory` after `isAnchor`:

```ts
  /** Raw idempotency key — read-time source for title ICU values (see
   * refFromDedupeKey); never rendered directly. */
  dedupeKey: string | null;
```

`lib/data/companion.ts`:

```ts
const MEMORY_COLUMNS =
  "id, kind, memory_type, title, video_id, transcript_line_id, timestamp_seconds, line_text_jp, note, is_anchor, occurred_at, dedupe_key";
```

Extend `MemoryRow` with `dedupe_key: string | null;` and `toMemory` with `dedupeKey: row.dedupe_key,`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/companion lib/data/companion.test.ts`
Expected: PASS. (If other suites construct `CompanionMemory` fixtures, tsc will point at them — add `dedupeKey: null`.)

- [ ] **Step 5: Gates + commit**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
git add lib/companion lib/data/companion.ts lib/data/companion.test.ts
git commit -m "feat(companion): expose dedupeKey + read-time ref inverse for journal titles (L9b Presence Task 8)"
```

---

### Task 9: Shadowing deep link — `?line=<id>` selects and seeks

**Files:**
- Modify: `components/video-player/shadowing-view.tsx`
- Test: `components/video-player/shadowing-view.test.tsx` (extend)

**Interfaces:**
- Consumes: `useSearchParams` (`next/navigation`); the component's existing `playerRef` (`YouTubePlayerHandle` — verify its seek method name at the `handleLineSelect` implementation and use the same call).
- Produces: navigating to `/videos/[id]/shadowing?line=<transcriptLineId>` seeks the player to that line's `start_time` and makes it the active line. This is the target of the Journal's "return to the moment" links (Task 10). Unknown/absent `line` param = exactly today's behavior.

- [ ] **Step 1: Write the failing test**

Extend `components/video-player/shadowing-view.test.tsx` (the file already stubs the YouTube IFrame player — follow its established mock; mock `next/navigation`'s `useSearchParams` to return `new URLSearchParams("line=<the fixture line id>")`):

```tsx
  it("seeks to the ?line= target once the player is ready (journal deep link)", async () => {
    // render with searchParams line=<second line id>
    // fire the player-ready path the file's other tests use
    // expect the seek spy to have been called with that line's start_time
    // and the line's button to carry aria-current="true" after the seek
  });

  it("ignores an unknown ?line= id", async () => {
    // searchParams line=nonexistent → seek spy NOT called with any line start
  });
```

(Write them concretely against the file's existing fixtures/spies — same transcript fixture, same player stub. The behavior contract is above; the mechanics must match the file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/video-player/shadowing-view.test.tsx`
Expected: FAIL — no seek occurs.

- [ ] **Step 3: Implement**

In `shadowing-view.tsx`:

```tsx
import { useSearchParams } from "next/navigation";
// inside ShadowingView:
const searchParams = useSearchParams();
const deepLinkLineIdRef = useRef<string | null>(searchParams.get("line"));
```

In `handleReady`, after the duration-report block:

```tsx
    if (deepLinkLineIdRef.current) {
      const target = lines.find((l) => l.id === deepLinkLineIdRef.current);
      deepLinkLineIdRef.current = null; // one-shot: a deep link is an arrival, not a mode
      if (target) {
        // Use the exact same seek call handleLineSelect makes (verify there).
        playerRef.current?.seekTo(target.start_time, true);
        setCurrentTime(target.start_time);
      }
    }
```

`handleReady`'s dependency array gains `lines`. ((app) layout is `force-dynamic`, so `useSearchParams` needs no Suspense boundary here.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/video-player/shadowing-view.test.tsx`
Expected: PASS.

- [ ] **Step 5: Gates + commit**

```bash
npx tsc --noEmit && npm run lint
git add components/video-player/shadowing-view.tsx components/video-player/shadowing-view.test.tsx
git commit -m "feat(shadowing): ?line= deep link seeks to the remembered moment (L9b Presence Task 9)"
```

---

### Task 10: Journal UI — `/journal` page, nav entry, first-meeting on open, e2e smoke

**Files:**
- Create: `app/[locale]/(app)/journal/page.tsx`, `components/companion/journal-view.tsx`
- Modify: `components/layout/app-nav.tsx` (NAV_ITEMS), `messages/en/nav.json`, `messages/vi/nav.json`, `messages/en/nav.pin.test.ts` (if the nav pins live there — locate the nav pin block and extend it), `messages/en/companion.json`, `messages/vi/companion.json` (journal.* keys), `messages/en/companion.pin.test.ts`
- Create: `tests/e2e/journal.spec.ts`
- Test: `components/companion/journal-view.test.tsx`

**Interfaces:**
- Consumes: `recordFirstMeeting`, `getJournal` (`@/lib/data/companion`); `memoryTitleFor`, `refFromDedupeKey`, type `CompanionMemory` (`@/lib/companion`); `CompanionAnchor` (Task 7); `Link` from `@/lib/i18n/navigation`; `useFormatter` from next-intl for dates; metadata pattern copied from `app/[locale]/(app)/videos/page.tsx` (`generateMetadata` + `getTranslations`).
- Produces: route `/journal` (localized `/vi/journal`, `/en/journal`); `JournalView({ memories }: { memories: CompanionMemory[] })`.

- [ ] **Step 1: Write the failing tests**

`components/companion/journal-view.test.tsx` (via `@/test/render`; build `CompanionMemory` fixtures inline):

```tsx
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "@/test/render";
import { JournalView } from "./journal-view";
import type { CompanionMemory } from "@/lib/companion";

const memory = (overrides: Partial<CompanionMemory>): CompanionMemory => ({
  id: "m1", kind: "discovered", memoryType: "first_meeting", title: null,
  videoId: null, transcriptLineId: null, timestampSeconds: null, lineTextJp: null,
  note: null, isAnchor: true, occurredAt: "2026-07-24T10:00:00Z", dedupeKey: "first_meeting",
  ...overrides,
});

describe("JournalView (spec §5 — a keepsake, never a log)", () => {
  it("renders discovered titles at read time from the descriptor", () => {
    render(<JournalView memories={[memory({})]} />);
    expect(screen.getByText("The day the two of you met.")).toBeInTheDocument();
  });

  it("renders ICU-valued titles from the dedupe key (jlpt_passed:N4 → level N4)", () => {
    render(<JournalView memories={[memory({ id: "m2", memoryType: "jlpt_passed", dedupeKey: "jlpt_passed:N4" })]} />);
    expect(screen.getByText("JLPT N4 milestone")).toBeInTheDocument();
  });

  it("a gifted memory shows the learner's own title and note verbatim, never translated", () => {
    render(
      <JournalView
        memories={[memory({ id: "m3", kind: "gifted", memoryType: "pinned_line", title: "Câu này làm mình nổi da gà", note: "xem lần đầu", lineTextJp: "逃げるは恥だが役に立つ", dedupeKey: "pinned_line:l1" })]}
      />,
    );
    expect(screen.getByText("Câu này làm mình nổi da gà")).toBeInTheDocument();
    expect(screen.getByText("xem lần đầu")).toBeInTheDocument();
  });

  it("links back to the moment when the pointer is complete", () => {
    render(
      <JournalView
        memories={[memory({ id: "m4", memoryType: "first_shadow", videoId: "v1", transcriptLineId: "l1", dedupeKey: "first_shadow" })]}
      />,
    );
    const link = screen.getByRole("link", { name: /return to this moment/i });
    expect(link).toHaveAttribute("href", expect.stringContaining("/videos/v1/shadowing?line=l1"));
  });

  it("empty journal looks forward, never apologizes (D9)", () => {
    render(<JournalView memories={[]} />);
    expect(screen.getByText(/first page is waiting/i)).toBeInTheDocument();
    expect(screen.queryByText(/no memories|empty/i)).toBeNull();
  });

  it("orders strictly by occurredAt (the API already sorts; the view must not re-sort by anything else)", () => {
    const older = memory({ id: "a", occurredAt: "2026-01-01T00:00:00Z" });
    const newer = memory({ id: "b", memoryType: "first_shadow", dedupeKey: "first_shadow", occurredAt: "2026-06-01T00:00:00Z" });
    render(<JournalView memories={[newer, older]} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("The first line you shadowed successfully.");
    expect(items[1]).toHaveTextContent("The day the two of you met.");
  });
});
```

`tests/e2e/journal.spec.ts` — model login + navigation mechanics on `tests/e2e/auth-locale-round-trip.spec.ts` (same seeded credentials and helpers):

```ts
// login (same helper/creds as auth-locale-round-trip) → click nav "Journal"
// → expect URL /en/journal and the journal heading visible
// → the first-meeting page ("The day the two of you met.") is on screen
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/companion/journal-view.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

`components/companion/journal-view.tsx`:

```tsx
"use client";

import { useFormatter } from "next-intl";
import { useTranslations } from "@/lib/i18n"; // repo convention — not bare next-intl
import { Link } from "@/lib/i18n/navigation";
import { memoryTitleFor, refFromDedupeKey, type CompanionMemory } from "@/lib/companion";
import { CompanionAnchor } from "./companion-anchor";

function resolvedTitle(m: CompanionMemory, t: ReturnType<typeof useTranslations>): string {
  if (m.title) return m.title; // learner's own words — never translated
  const descriptor = memoryTitleFor(m.memoryType, refFromDedupeKey(m.memoryType, m.dedupeKey));
  if (descriptor) {
    // Dynamic catalog key — same idiom as conversation's scenarioLabel.
    return t(descriptor.key as Parameters<typeof t>[0], descriptor.values);
  }
  return t("journal.untitledGifted");
}

export function JournalView({ memories }: { memories: CompanionMemory[] }) {
  const t = useTranslations("companion");
  const format = useFormatter();
  return (
    <div className="mx-auto max-w-2xl">
      <header className="flex items-end justify-between">
        <h1 className="text-2xl font-bold">{t("journal.title")}</h1>
        <CompanionAnchor surface="journal" pose="reading" />
      </header>
      {memories.length === 0 ? (
        <p className="mt-8 text-muted-foreground">{t("journal.empty")}</p>
      ) : (
        <ol className="mt-8 space-y-6">
          {memories.map((m) => (
            <li key={m.id} className="rounded-lg border border-border p-4">
              <p className="font-medium">{resolvedTitle(m, t)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {format.dateTime(new Date(m.occurredAt), { dateStyle: "long" })}
                <span className="sr-only">
                  {m.kind === "gifted" ? t("journal.giftedMarker") : t("journal.discoveredMarker")}
                </span>
                {m.kind === "gifted" ? <span aria-hidden="true"> ✎</span> : null}
              </p>
              {m.lineTextJp ? <p className="mt-2 font-jp">{m.lineTextJp}</p> : null}
              {m.note ? <p className="mt-2 text-sm">{m.note}</p> : null}
              {m.videoId && m.transcriptLineId ? (
                <Link
                  href={`/videos/${m.videoId}/shadowing?line=${m.transcriptLineId}`}
                  className="mt-3 inline-block text-sm text-primary underline"
                >
                  {t("journal.returnToMoment")}
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
```

`app/[locale]/(app)/journal/page.tsx` (copy the exact `generateMetadata` + `Locale` imports from `app/[locale]/(app)/videos/page.tsx`):

```tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getJournal, recordFirstMeeting } from "@/lib/data/companion";
import { JournalView } from "@/components/companion/journal-view";
import type { Locale } from "@/lib/i18n"; // ← use the videos page's exact import path

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "companion" });
  return { title: t("journal.metaTitle") };
}

export default async function JournalPage() {
  // Opening the Journal IS the first-meeting domain event (spec D8):
  // idempotent, best-effort — the first open writes the first page.
  await recordFirstMeeting();
  const result = await getJournal();
  return <JournalView memories={result.ok ? result.data : []} />;
}
```

`components/layout/app-nav.tsx` — insert into `NAV_ITEMS` before `profile`:

```ts
  { href: "/journal", key: "journal" },
```

`messages/en/nav.json`: add `"journal": "Journal"` (before `"profile"`); `messages/vi/nav.json`: `"journal": "Nhật ký"`. Extend the nav pin test with both literals.

`messages/en/companion.json` — add a `journal` block:

```json
  "journal": {
    "metaTitle": "Journal",
    "title": "Journal",
    "empty": "The first page is waiting for the stories we'll discover together.",
    "returnToMoment": "Return to this moment",
    "giftedMarker": "A memory you gifted",
    "discoveredMarker": "A memory discovered along the way",
    "untitledGifted": "A line you kept."
  }
```

`messages/vi/companion.json`:

```json
  "journal": {
    "metaTitle": "Nhật ký",
    "title": "Nhật ký",
    "empty": "Trang đầu tiên đang chờ những câu chuyện chúng ta sẽ cùng khám phá.",
    "returnToMoment": "Quay lại khoảnh khắc này",
    "giftedMarker": "Ký ức bạn trao gửi",
    "discoveredMarker": "Ký ức được phát hiện trên đường đi",
    "untitledGifted": "Một câu thoại bạn đã giữ lại."
  }
```

Pin every new EN leaf (+ vi mirrors) in `messages/en/companion.pin.test.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/companion components/layout/app-nav.test.tsx messages/en/companion.pin.test.ts lib/i18n/catalog.test.ts`
Expected: PASS (fix the app-nav test's expected item list if it enumerates NAV_ITEMS).

- [ ] **Step 5: e2e**

Run: `npx playwright test tests/e2e/journal.spec.ts`
Expected: PASS (local Supabase running; `npx supabase db reset` if the seed is stale — known from the L9a e2e baseline).

- [ ] **Step 6: Gates + commit**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
git add "app/[locale]/(app)/journal" components/companion components/layout/app-nav.tsx messages/en messages/vi tests/e2e/journal.spec.ts
git commit -m "feat(companion): /journal — the learner's book, first-meeting on open, nav entry, e2e (L9b Presence Task 10)"
```

---

### Task 11: Gifted-pin UI — pin a line to the journal from shadowing + dictation

**Files:**
- Create: `components/video-player/pin-line-control.tsx`
- Modify: `components/video-player/transcript-pane.tsx` (optional `videoId` prop + render pin control), `components/video-player/shadowing-view.tsx` (pass `videoId`), `components/video-player/dictation-view.tsx` (pin control on the current line — verify where the line text renders and place it beside; thread the video id from the component's existing props)
- Modify: `messages/en/companion.json`, `messages/vi/companion.json` (pin.* keys), `messages/en/companion.pin.test.ts`
- Test: `components/video-player/pin-line-control.test.tsx`, extend `components/video-player/transcript-pane.test.tsx`

**Interfaces:**
- Consumes: `Dialog` from `@/components/ui/dialog` (`{ open, onClose, title, closeLabel, children }`); `useCompanion` (Task 7 — no-op-safe outside the provider, so these tests need no provider wrapper); `POST /api/companion/memories` (shipped; zod `pinMemorySchema`: `transcriptLineId` uuid, optional `videoId`, `lineTextJp` ≤1000, `timestampSeconds` ≥0, `note` ≤500); `TranscriptLineRow` from `@/lib/video-types`; `common.errors.network` + `common.actions.save` / `common.actions.cancel` (reuse — **record the +1 consumer per key for the audit: surface `video-player`**).
- Produces: `PinLineControl({ line, videoId }: { line: TranscriptLineRow; videoId?: string })`.
- Boundary note (spec §5): the pin button is the learner writing in their own book — ordinary UI, translated error states allowed. It is NOT the Companion appearing; no anchor exists on these surfaces (the §5.4 scan stays green — this file imports `use-companion`, not `companion-anchor`).

- [ ] **Step 1: Write the failing tests**

`components/video-player/pin-line-control.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test/render";
import { PinLineControl } from "./pin-line-control";
import type { TranscriptLineRow } from "@/lib/video-types";

const line: TranscriptLineRow = {
  id: "l1", transcript_id: "t1", start_time: 12.5, end_time: 15,
  text_jp: "逃げるは恥だが役に立つ", text_translation: null, furigana_json: null,
};

beforeEach(() => vi.restoreAllMocks());

describe("PinLineControl", () => {
  it("opens the dialog and POSTs the pin with pointers + note", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<PinLineControl line={line} videoId="v1" />);
    await user.click(screen.getByRole("button", { name: /pin to journal/i }));
    await user.type(screen.getByLabelText(/a few words/i), "chills");
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/companion/memories",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          transcriptLineId: "l1", videoId: "v1", lineTextJp: "逃げるは恥だが役に立つ",
          timestampSeconds: 12.5, note: "chills",
        }),
      }),
    );
    expect(await screen.findByText(/it's in your journal now/i)).toBeInTheDocument();
  });

  it("shows the translated network error on fetch failure — no raw diagnostics (convention #4)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    const user = userEvent.setup();
    render(<PinLineControl line={line} />);
    await user.click(screen.getByRole("button", { name: /pin to journal/i }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(await screen.findByText(/network error/i)).toBeInTheDocument();
    expect(screen.queryByText(/ECONNRESET/)).toBeNull();
  });

  it("maps 429 to the gentle too-fast message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }));
    const user = userEvent.setup();
    render(<PinLineControl line={line} />);
    await user.click(screen.getByRole("button", { name: /pin to journal/i }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(await screen.findByText(/take a breath/i)).toBeInTheDocument();
  });
});
```

Extend `components/video-player/transcript-pane.test.tsx`: with `videoId` supplied, each line renders BOTH the mine control and the pin control; without `videoId`, the pin control still renders (videoId merely optional in the payload).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/video-player/pin-line-control.test.tsx components/video-player/transcript-pane.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

`components/video-player/pin-line-control.tsx`:

```tsx
"use client";

import { useId, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { Dialog } from "@/components/ui/dialog";
import { useCompanion } from "@/components/companion/use-companion";
import type { TranscriptLineRow } from "@/lib/video-types";

type Status = "idle" | "submitting" | "success" | "error" | "tooMany";

/** Gifted pin (spec D6): the learner keeps a line in their own journal.
 * Ordinary learner UI — translated feedback allowed; the Companion itself
 * stays dormant on learning surfaces (§5.4). */
export function PinLineControl({ line, videoId }: { line: TranscriptLineRow; videoId?: string }) {
  const t = useTranslations("companion");
  const tCommon = useTranslations("common");
  const companion = useCompanion();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const noteId = useId();

  async function submit() {
    setStatus("submitting");
    try {
      const res = await fetch("/api/companion/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcriptLineId: line.id,
          ...(videoId ? { videoId } : {}),
          lineTextJp: line.text_jp,
          timestampSeconds: line.start_time,
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      if (res.ok) {
        setStatus("success");
        companion.emitContext("memory_created");
      } else {
        setStatus(res.status === 429 ? "tooMany" : "error");
      }
    } catch (err) {
      console.error("[companion] pin failed:", err); // devs only — convention #4
      setStatus("error");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setStatus("idle"); setOpen(true); }}
        aria-label={t("pin.trigger")}
        title={t("pin.trigger")}
        className="rounded p-1 text-muted-foreground hover:text-foreground"
      >
        ✎
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("pin.dialogTitle")} closeLabel={tCommon("actions.cancel")}>
        <p className="font-jp">{line.text_jp}</p>
        <label htmlFor={noteId} className="mt-3 block text-sm">{t("pin.noteLabel")}</label>
        <textarea
          id={noteId}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={3}
          className="mt-1 w-full rounded-md border border-border bg-transparent p-2 text-sm"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm">
            {tCommon("actions.cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={status === "submitting"}
            className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
          >
            {tCommon("actions.save")}
          </button>
        </div>
        <p role="status" className="mt-2 min-h-5 text-sm">
          {status === "success" ? t("pin.success") : null}
          {status === "error" ? tCommon("errors.network") : null}
          {status === "tooMany" ? t("pin.tooMany") : null}
        </p>
      </Dialog>
    </>
  );
}
```

(Error nuance: a non-429 API failure shows `tCommon("errors.network")` — the shipped API's failure modes here are effectively network/validation; do NOT surface `body.error`.)

`components/video-player/transcript-pane.tsx`: add `videoId?: string` to `TranscriptPaneProps`, and beside `<MineLineControl line={line} />` render `<PinLineControl line={line} videoId={videoId} />`. `shadowing-view.tsx` passes `videoId={video.id}` to `TranscriptPane`. `dictation-view.tsx`: place `<PinLineControl line={currentLine} videoId={video.id} />` next to where the current line's text renders after an attempt (verify the exact spot + the video prop name in the file; if the component only receives a videoId string, thread that).

Catalog keys — `messages/en/companion.json`:

```json
  "pin": {
    "trigger": "Pin to journal",
    "dialogTitle": "Keep this line in your journal",
    "noteLabel": "A few words of your own (optional)",
    "success": "Kept. It's in your journal now.",
    "tooMany": "You're pinning fast — take a breath and try again shortly."
  }
```

`messages/vi/companion.json`:

```json
  "pin": {
    "trigger": "Ghim vào nhật ký",
    "dialogTitle": "Giữ câu thoại này trong nhật ký của bạn",
    "noteLabel": "Đôi lời của riêng bạn (tùy chọn)",
    "success": "Đã giữ lại. Câu này giờ nằm trong nhật ký của bạn.",
    "tooMany": "Bạn đang ghim nhanh quá — nghỉ một nhịp rồi thử lại nhé."
  }
```

Pin all new EN leaves (+ vi mirrors). **Audit note for the final review: `common.errors.network` +1 surface (video-player pin), `common.actions.save` +1, `common.actions.cancel` +1.**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/video-player messages/en/companion.pin.test.ts`
Expected: PASS (including the untouched video-player suites — the pane gained a child; fix any snapshot-ish assertions the pane tests carry).

- [ ] **Step 5: Gates + commit**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
git add components/video-player messages/en messages/vi
git commit -m "feat(companion): gifted-pin UI in shadowing + dictation transcripts (L9b Presence Task 11)"
```

---

### Task 12: Anchors + context emissions — dashboard, empty states, post-session

**Files:**
- Modify: `app/[locale]/(app)/dashboard/page.tsx`, `app/[locale]/(app)/videos/page.tsx` (empty branch), `components/video-player/mining-deck-list.tsx` (empty branch), `components/video-player/shadowing-recorder-panel.tsx` (emit `finished_shadowing` on save success)
- Test: extend `components/video-player/mining-deck-list.test.tsx`, `components/video-player/shadowing-recorder-panel.test.tsx`; update `components/companion/anchor-boundary.test.ts` ONLY if a path differs from its allowlist

**Interfaces:**
- Consumes: `CompanionAnchor` (Task 7), `useCompanion` (Task 7).
- Produces: the D3 anchor set is live — Dashboard (sitting), Journal (done in Task 10), videos empty state (standing + `empty_library`), mining empty state (standing + `empty_mining_deck`) — and the recorder emits `finished_shadowing` so the Companion can speak at the next anchored rest point (§5.5: the address happens on arrival at Dashboard/Journal, never inside the loop).

- [ ] **Step 1: Write the failing tests**

Extend `components/video-player/mining-deck-list.test.tsx`:

```tsx
  it("invites the Companion only in the empty state", () => {
    // render with cards=[] → expect document.querySelector('[data-companion-surface="mining-empty"]') non-null
    // render with 1 card → expect it null
  });
```

Extend `components/video-player/shadowing-recorder-panel.test.tsx` (the suite already exercises the save-success path — add):

```tsx
  it("announces finished_shadowing after a successful session save", async () => {
    // wrap render in <AmbientProvider> (no anchor → nothing may render, no fetch beyond the panel's own)
    // drive the existing successful-save flow the file already tests
    // assert via a probe component or by spying on the provider that the pending
    // context was emitted — simplest: render an anchored probe surface AFTER save
    // and assert the finished_shadowing speech bubble appears
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/video-player/mining-deck-list.test.tsx components/video-player/shadowing-recorder-panel.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`app/[locale]/(app)/dashboard/page.tsx` — inside the progress `<section>` (beside `LevelCard`):

```tsx
import { CompanionAnchor } from "@/components/companion/companion-anchor";
// … first child of the progress section:
          <CompanionAnchor surface="dashboard" pose="sitting" />
```

`app/[locale]/(app)/videos/page.tsx` — in the empty branch next to `{t("empty")}`:

```tsx
import { CompanionAnchor } from "@/components/companion/companion-anchor";
// …
            <CompanionAnchor surface="videos-empty" pose="standing" context="empty_library" />
```

`components/video-player/mining-deck-list.tsx` — the empty branch becomes:

```tsx
    return (
      <div className="flex flex-col items-center gap-3">
        <CompanionAnchor surface="mining-empty" pose="standing" context="empty_mining_deck" />
        <p className="text-sm text-muted-foreground">{t("deck.empty")}</p>
      </div>
    );
```

`components/video-player/shadowing-recorder-panel.tsx` — at the session-save success point (locate the code path the panel's existing success tests drive — where the POST to `/api/shadowing/session` resolves ok):

```tsx
import { useCompanion } from "@/components/companion/use-companion";
// inside the component:
const companion = useCompanion();
// at save success:
companion.emitContext("finished_shadowing");
```

(No anchor exists on the shadowing route — emitting is not appearing; the context waits, TTL-bounded, for the next anchored surface.)

- [ ] **Step 4: Run tests + the boundary scan**

Run: `npx vitest run components/video-player components/companion`
Expected: PASS — including `anchor-boundary.test.ts` (dashboard/videos/mining-deck-list are allowlisted; the recorder panel imports `use-companion` only).

- [ ] **Step 5: Gates + commit**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
git add "app/[locale]/(app)/dashboard/page.tsx" "app/[locale]/(app)/videos/page.tsx" components/video-player
git commit -m "feat(companion): live anchors (dashboard, empty states) + post-session context (L9b Presence Task 12)"
```

---

### Task 13: Whole-branch verification

**Files:** none new — verification + fixes only.

- [ ] **Step 1: Full gates**

```bash
npx tsc --noEmit          # expect: clean
npx vitest run            # expect: all green (re-run pitch-contour/waveform standalone if CPU-flaky)
npm run lint              # expect: exit 0, 0 new vs the 80-warning/23-file baseline
npm run build             # expect: OK, /journal present in both locales' page manifest
npx playwright test       # expect: all specs (5 existing + journal) green; db reset first if seed stale
```

- [ ] **Step 2: Spec-coverage sweep**

Walk `docs/superpowers/specs/2026-07-24-l9b-companion-presence-design.md` §1 In-scope items 1–6 and §9's test list; confirm each maps to a shipped task; walk Spec 1 §8's obligations touched by this plan (capture idempotency, degradation, state machine, arbitration determinism, §5.4 boundary, timeline order, phase naming). Record any gap as a fix or a carried Minor.

- [ ] **Step 3: Mutation-testing report (standing convention #1 — TWO layers)**

Catalog: run append/prepend/punctuation mutations against the new `companion.json` leaves → the pin tests must catch each. Wiring: with pin tests disabled, swap `speech.*` keys pairwise, point `journal.giftedMarker`/`discoveredMarker` at one key, drop the `videoId` thread from `TranscriptPane` → the RTL suites must catch each. Report `Catalog: N/X · Wiring: M/Y` separately.

- [ ] **Step 4: Commit any fixes; hand the branch to review**

```bash
git add -A && git commit -m "test(companion): whole-branch verification fixes (L9b Presence Task 13)"
```

Then: independent code review of the whole branch (repo cadence), merge decision stays with the user.
