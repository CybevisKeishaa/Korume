# AI Provider Abstraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `lib/ai` provider-agnostic and turn configuration mistakes into startup failures instead of silent runtime 503s.

**Architecture:** `lib/ai` splits into three layers — *feature* (business logic, provider-blind), *port* (two operations + a stable error union), *adapter* (knows exactly one provider). A shared env runner validates registered schemas once at startup. Provider selection is explicit (`AI_PROVIDER`, `SPEECH_PROVIDER`); `none` means intentionally disabled and keeps the existing 503 path, while a named provider with bad config fails at boot.

**Tech Stack:** Next.js 14.2.35 (App Router), TypeScript strict, zod 3.25.76 (`zod` v3 API for env; `zod/v4` subpath only in `lib/ai/schemas.ts`), Vitest + RTL, `@anthropic-ai/sdk` 0.111.0, `@google/genai` (new).

**Spec:** `docs/superpowers/specs/2026-07-15-ai-provider-abstraction-design.md` (commits `b8ae7d9`, `de3b8ed`). Decisions are referenced as D1–D9; verification items as V1–V6.

## Global Constraints

- **TDD is mandatory** (CLAUDE.md §7): write the failing test, run it, see it fail, then implement. Never claim a pass without showing command output.
- **TypeScript strict.** No `any` without a justifying comment (CLAUDE.md §6).
- **Never log or embed a credential value** anywhere — not in error messages, not in tests. Messages name the variable and the expectation only (Spec §5.2).
- **Never infer, never silently fall back** (Spec §2). Provider selection is explicit; absence of a key is never read as intent.
- **Baseline: 1098 unit tests green.** Verify commands: `npm test` · `npm run typecheck` · `npm run lint` · `npm run build`.
- **Files stay focused;** extract past ~300 lines (CLAUDE.md §6).
- **Commit after every task.** Never push (standing rule: commit freely, ask before pushing).
- `AiErrorKind` and `lib/http-status.ts` **do not change** (D1). Tests asserting `.kind` must stay green throughout.
- Repo DI convention (as in `lib/gamification`'s clock injection): dependencies are injected via an **optional last parameter defaulting to the real one**. The port follows this.

---

### Task 1: Verify Gemini key and model before any rule is written (V3, V5)

Spec §8 names this the highest-risk item: `GEMINI_API_KEY` currently starts with `AQ.`, while this assistant expects `AIza`. **If `AQ.` is legitimate, a structural rule built on the assumption would reject a valid key.** Task 4 cannot be written until this is answered with a real request.

**Files:**
- Modify: `docs/superpowers/specs/2026-07-15-ai-provider-abstraction-design.md` (§7 table rows V3, V5)

**Interfaces:**
- Consumes: nothing.
- Produces: the verified structural marker for `GEMINI_API_KEY` and the verified model id, both consumed by Task 4 and Task 7.

- [ ] **Step 1: Load the key into a shell variable without printing it**

```bash
cd "C:/Users/tplon/Documents/GitHub/JPWeb/japan-web"
GEMINI_KEY=$(grep -E '^GEMINI_API_KEY=' .env.local | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')
test -n "$GEMINI_KEY" && echo "key loaded, length=${#GEMINI_KEY}, prefix=${GEMINI_KEY:0:4}"
```

Expected: prints a length and a 4-character prefix. **This prefix is the evidence Task 4 needs.** Do not print the whole key.

- [ ] **Step 2: Ask Google which models this key can actually see**

```bash
curl -s -o /tmp/models.json -w '%{http_code}\n' \
  "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_KEY"
```

Expected: `200` if the key is valid; `400`/`403` if it is not.

- [ ] **Step 3: Record the outcome**

If `200`:

```bash
node -e "const m=require('/tmp/models.json').models||[];console.log(m.map(x=>x.name).join('\n'))" | grep -i flash
```

Answer three questions and write the answers into the spec §7 table (replace the V3 and V5 rows with the verified finding and today's date):
1. Is the key valid? (HTTP status)
2. Does `gemini-3.1-flash-lite` appear in the list? If not, **which flash-lite model does?** That id replaces `GEMINI_MODEL` everywhere in this plan.
3. What is the real key prefix? That string — not `AIza` — is the structural marker Task 4 encodes.

If the status is **not** `200`: **STOP and report to the user.** The key is invalid, this is scope B (key provisioning), and Tasks 4/7 cannot proceed on a key that does not work. Do not invent a rule to match a broken key.

- [ ] **Step 4: Commit the verified findings**

```bash
git add docs/superpowers/specs/2026-07-15-ai-provider-abstraction-design.md
git commit -m "docs(spec): record verified Gemini key structure and model id (V3, V5)"
```

---

### Task 2: Move `lib/env.ts` into `lib/env/index.ts`

Pure move, zero behaviour change. `@/lib/env` keeps resolving (→ `index.ts`), so all 6 importers are untouched. This clears the name for the runner (Spec §5.6).

**Files:**
- Move: `lib/env.ts` → `lib/env/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `lib/env/` as a directory; `@/lib/env` continues to export `requiredEnv(name: string): string`, `publicEnv`, `hasPublicSupabaseEnv(): boolean` unchanged.

- [ ] **Step 1: Move the file, preserving history**

```bash
cd "C:/Users/tplon/Documents/GitHub/JPWeb/japan-web"
mkdir -p lib/env && git mv lib/env.ts lib/env/index.ts
```

- [ ] **Step 2: Prove nothing broke**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; **1098 tests pass**. No import statement anywhere should need editing — if typecheck complains about `@/lib/env`, stop and report rather than rewriting importers.

- [ ] **Step 3: Commit**

```bash
git add -A lib/env
git commit -m "refactor(env): move lib/env.ts to lib/env/index.ts

Clears the lib/env/ namespace for the startup validation runner.
'@/lib/env' still resolves via index.ts, so all 6 importers are untouched."
```

---

### Task 3: The shared env validation runner

**Files:**
- Create: `lib/env/validate.ts`
- Test: `lib/env/validate.test.ts`

**Interfaces:**
- Consumes: `lib/env/index.ts` (namespace only).
- Produces — used by Tasks 4, 12, 13:

```ts
export interface EnvCheckResult { errors?: string[]; warnings?: string[] }
export interface EnvSpec<T> {
  name: string;
  schema: z.ZodType<T>;
  check?: (value: T) => EnvCheckResult;
}
export function registerEnvSpec<T>(spec: EnvSpec<T>): void
export function validateEnv(env?: EnvSource): void   // throws EnvValidationError; memoized
export type EnvSource = NodeJS.ProcessEnv | Record<string, string>;
export function resetEnvValidationForTesting(): void
export class EnvValidationError extends Error {}
```

Why `check`: the capability-gap comparison (D-capabilities) and the `APP_ENV`+provider policy (D7) are not expressible as a zod shape, but must be reported in the **same aggregated startup report** as schema failures (Spec §5.2). `warnings` exists because a capability gap is an error in production but a report in dev.

- [ ] **Step 1: Write the failing test**

```ts
// lib/env/validate.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  EnvValidationError,
  registerEnvSpec,
  resetEnvValidationForTesting,
  validateEnv,
} from "./validate";

describe("validateEnv", () => {
  beforeEach(() => resetEnvValidationForTesting());

  it("passes when every registered schema is satisfied", () => {
    registerEnvSpec({ name: "demo", schema: z.object({ FOO: z.string().min(1) }) });
    expect(() => validateEnv({ FOO: "ok" })).not.toThrow();
  });

  it("aggregates failures from every spec into one error", () => {
    registerEnvSpec({ name: "a", schema: z.object({ FOO: z.string().min(1) }) });
    registerEnvSpec({ name: "b", schema: z.object({ BAR: z.string().min(1) }) });

    let message = "";
    try {
      validateEnv({});
    } catch (err) {
      message = (err as Error).message;
    }
    // The 2026-07-14 audit found TWO env bugs at once; one restart must surface both.
    expect(message).toContain("FOO");
    expect(message).toContain("BAR");
  });

  it("never puts a credential value in the error message", () => {
    registerEnvSpec({
      name: "secret",
      schema: z.object({
        TOKEN: z.string().refine((v) => v.startsWith("sk-"), {
          message: "expected a key beginning with the documented prefix",
        }),
      }),
    });

    let message = "";
    try {
      validateEnv({ TOKEN: "super-secret-value" });
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain("TOKEN");
    expect(message).not.toContain("super-secret-value");
  });

  it("reports check() errors alongside schema errors", () => {
    registerEnvSpec({
      name: "policy",
      schema: z.object({ MODE: z.string() }),
      check: (v) => (v.MODE === "bad" ? { errors: ["MODE is not allowed here"] } : {}),
    });
    expect(() => validateEnv({ MODE: "bad" })).toThrow(EnvValidationError);
  });

  it("logs warnings without throwing", () => {
    // `() => undefined`, not `() => {}` — the repo's eslint config errors on
    // empty functions, and this matches the existing console-spy pattern in
    // lib/data/gamification.test.ts and lib/data/reading.test.ts.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    registerEnvSpec({
      name: "gap",
      schema: z.object({ MODE: z.string() }),
      check: () => ({ warnings: ["capability gap: streaming"] }),
    });
    expect(() => validateEnv({ MODE: "x" })).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("capability gap: streaming"));
    warn.mockRestore();
  });

  it("is memoized so any startup hook may call it twice", () => {
    const check = vi.fn(() => ({}));
    registerEnvSpec({ name: "once", schema: z.object({}), check });
    validateEnv({});
    validateEnv({});
    expect(check).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run lib/env/validate.test.ts`
Expected: FAIL — `Failed to resolve import "./validate"`.

- [ ] **Step 3: Implement the runner**

```ts
// lib/env/validate.ts
/**
 * Shared startup validation for environment configuration.
 *
 * Framework-agnostic by design: this module imports nothing from Next and is
 * idempotent, so the startup mechanism (today `instrumentation.ts`) can be
 * replaced without touching the architecture. See the Spec §5.1 — "validate
 * exactly once before serving the first request" is the requirement; the hook
 * is only the current implementation.
 *
 * Failures are AGGREGATED and reported once: the 2026-07-14 audit found two
 * misconfigured credentials simultaneously, and fail-at-first-error would have
 * meant fix / restart / discover the next one / restart.
 *
 * Error text NEVER contains a credential value (CLAUDE.md §6) — crash logs go
 * to the host console.
 */
import type { z } from "zod";

export interface EnvCheckResult {
  errors?: string[];
  warnings?: string[];
}

export interface EnvSpec<T> {
  /** Subsystem name, used to group messages in the report. */
  name: string;
  schema: z.ZodType<T>;
  /**
   * Cross-field rules a zod shape cannot express (deployment policy, provider
   * capability gaps). Errors abort startup; warnings are reported and allowed.
   */
  check?: (value: T) => EnvCheckResult;
}

export class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvValidationError";
  }
}

// `unknown` is the only sound element type for a heterogeneous spec list; each
// spec's own schema re-establishes its type at validation time.
const specs: EnvSpec<unknown>[] = [];
let validated = false;

export function registerEnvSpec<T>(spec: EnvSpec<T>): void {
  specs.push(spec as EnvSpec<unknown>);
}

/** Test-only: clears registrations and the memo. */
export function resetEnvValidationForTesting(): void {
  specs.length = 0;
  validated = false;
}

export function validateEnv(env: EnvSource = process.env): void {
  if (validated) return;

  const errors: string[] = [];
  const warnings: string[] = [];

  for (const spec of specs) {
    const parsed = spec.schema.safeParse(env);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const variable = issue.path.join(".") || "(root)";
        errors.push(`[${spec.name}] ${variable}: ${issue.message}`);
      }
      continue; // check() needs a parsed value; skip it when the shape failed.
    }
    const result = spec.check?.(parsed.data) ?? {};
    for (const e of result.errors ?? []) errors.push(`[${spec.name}] ${e}`);
    for (const w of result.warnings ?? []) warnings.push(`[${spec.name}] ${w}`);
  }

  for (const warning of warnings) {
    console.warn(`Environment warning: ${warning}`);
  }

  if (errors.length > 0) {
    throw new EnvValidationError(
      `Invalid environment configuration (${errors.length} problem(s)):\n` +
        errors.map((e) => `  - ${e}`).join("\n") +
        `\nSee .env.local.example.`,
    );
  }

  validated = true;
}
```

Note the redaction contract: messages are built from `issue.path` and `issue.message` only, never `issue.input`. Any custom refinement registered by a later task must therefore write value-free messages — Task 4's tests re-assert this.

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run lib/env/validate.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/env/validate.ts lib/env/validate.test.ts
git commit -m "feat(env): shared startup validation runner

Aggregates every registered spec's failures into one report (the audit found
two bad credentials at once), never emits credential values, and is memoized
and framework-agnostic so the startup hook stays replaceable."
```

---

### Task 4: `lib/ai/env.ts` — provider lifecycle and deployment policy

Implements D1, D2, D7 and the AI half of D9. **Blocked by Task 1** — the `GEMINI_API_KEY` marker below must be the verified one.

**Files:**
- Create: `lib/ai/env.ts`
- Test: `lib/ai/env.test.ts`

**Interfaces:**
- Consumes: `registerEnvSpec`, `EnvSpec` from `@/lib/env/validate`.
- Produces — used by Tasks 7, 8, 11:

```ts
export type AppEnv = "dev" | "staging" | "production";
export type AiProviderName = "none" | "anthropic" | "gemini";
export type AiEnvShape = z.infer<typeof aiEnvSchema>;
export const aiEnvSchema: z.ZodType<AiEnvShape>
export interface AiEnv { APP_ENV: AppEnv; AI_PROVIDER: AiProviderName; }
export function readAiEnv(env?: EnvSource): AiEnv   // throws if unset/invalid
```

**Env parameters take `EnvSource`, not `NodeJS.ProcessEnv`** — verified 2026-07-15: Next augments `ProcessEnv` with a **required** `readonly NODE_ENV` (`next/types/global.d.ts:22`), so a test literal like `{ APP_ENV: "dev", AI_PROVIDER: "none" }` fails typecheck against bare `ProcessEnv` (TS2345). Every `env?:` parameter in this plan means `EnvSource`.

This module owns the **schema**, not the registered spec. The spec needs `capabilityGaps`, which lives in the registry — so `aiEnvSpec` is assembled in `lib/ai/registry.ts` (Task 8). That placement is deliberate: putting it here would make `env.ts` import `registry.ts`, which already imports `env.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/ai/env.test.ts
import { describe, expect, it } from "vitest";
import { aiEnvSchema, readAiEnv } from "./env";

const base = { APP_ENV: "dev", AI_PROVIDER: "none" };

describe("readAiEnv", () => {
  it("requires APP_ENV — it is never inferred from NODE_ENV", () => {
    expect(() => readAiEnv({ AI_PROVIDER: "none" })).toThrow();
  });

  it("requires AI_PROVIDER — absence of a key is not a decision", () => {
    expect(() => readAiEnv({ APP_ENV: "dev" })).toThrow();
  });

  it("accepts none without demanding any credential", () => {
    expect(readAiEnv(base)).toEqual({ APP_ENV: "dev", AI_PROVIDER: "none" });
  });
});

describe("aiEnvSchema + policy", () => {
  const validate = (env: Record<string, string>) => {
    const parsed = aiEnvSchema.safeParse(env);
    if (!parsed.success) return parsed.error.issues.map((i) => i.message);
    return [];
  };

  it("rejects a named provider whose credential is absent", () => {
    expect(validate({ APP_ENV: "dev", AI_PROVIDER: "gemini" }).length).toBeGreaterThan(0);
  });

  it("rejects a credential that fails its structural marker", () => {
    const issues = validate({
      APP_ENV: "dev",
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "not-a-real-key-shape",
      GEMINI_MODEL_FAST: "m",
      GEMINI_MODEL_DEEP: "m",
    });
    expect(issues.length).toBeGreaterThan(0);
    // Redaction contract from Task 3.
    expect(issues.join(" ")).not.toContain("not-a-real-key-shape");
  });

  it("refuses Gemini in production — its free tier trains on submitted data (CLAUDE.md §2)", () => {
    const issues = validate({
      APP_ENV: "production",
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: VERIFIED_GEMINI_KEY_SAMPLE,
      GEMINI_MODEL_FAST: "m",
      GEMINI_MODEL_DEEP: "m",
    });
    expect(issues.join(" ")).toMatch(/production/i);
  });

  it("allows production with AI intentionally off — the launch state (D1)", () => {
    expect(validate({ APP_ENV: "production", AI_PROVIDER: "none" })).toEqual([]);
  });
});
```

Define at the top of the test file — a **fake** string matching the marker Task 1 verified. Never paste the real key into a test.

```ts
// Matches the 53-char `AQ.` shape verified against the live API on 2026-07-15
// (spec §7 V3). `AIza…` is equally valid and must also be accepted.
const VERIFIED_GEMINI_KEY_SAMPLE = "AQ.Ab" + "x".repeat(48);
```

Add one more case proving the rule is not over-fitted to a single format:

```ts
it("accepts both documented Google key shapes", () => {
  const base = { APP_ENV: "dev", AI_PROVIDER: "gemini", GEMINI_MODEL_FAST: "m", GEMINI_MODEL_DEEP: "m" };
  expect(validate({ ...base, GEMINI_API_KEY: VERIFIED_GEMINI_KEY_SAMPLE })).toEqual([]);
  expect(validate({ ...base, GEMINI_API_KEY: "AIza" + "x".repeat(35) })).toEqual([]);
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run lib/ai/env.test.ts`
Expected: FAIL — cannot resolve `./env`.

- [ ] **Step 3: Implement**

```ts
// lib/ai/env.ts
/**
 * AI provider selection, credential structure, and deployment policy.
 *
 * Implements the provider lifecycle (Spec D9): selection is explicit and
 * required; `none` means INTENTIONALLY DISABLED and keeps the 503 path; a named
 * provider with missing or structurally invalid configuration is a startup
 * failure. Nothing here is ever inferred from which keys happen to be present —
 * that inference is what hid a missing ANTHROPIC_API_KEY until the 2026-07-14
 * audit.
 */
import { z } from "zod";
import type { EnvSpec } from "@/lib/env/validate";

export type AppEnv = "dev" | "staging" | "production";
export type AiProviderName = "none" | "anthropic" | "gemini";

/**
 * Structural markers, per Spec D2: startup validates STABLE, DOCUMENTED
 * structure — not merely presence, since both 2026-07-14 audit bugs were
 * present-but-wrong. Kept as loose as possible while still catching the known
 * bad shapes, because a wrong rule here blocks boot (Spec §8).
 *
 * ANTHROPIC: unverifiable today — the user has no key, so this marker comes
 * from documentation, NOT from a real key. Most likely rule to false-crash.
 *
 * GEMINI: verified against the live API on 2026-07-15 (spec §7 V3). Google
 * issues BOTH shapes and both are valid, so accept either — the working key in
 * use is the 53-char `AQ.` form, and a rule assuming only `AIza` would reject
 * it and block boot. This is the whole reason Task 1 runs before this file.
 */
const ANTHROPIC_KEY_PREFIX = "sk-ant-";
const GEMINI_KEY_PREFIXES = ["AIza", "AQ."] as const;

const providerName = z.enum(["none", "anthropic", "gemini"]);
const appEnv = z.enum(["dev", "staging", "production"]);

const requiredMsg = (v: string, hint: string) =>
  `${v} is required (${hint}). It is never inferred — see .env.local.example.`;

export const aiEnvSchema = z
  .object({
    APP_ENV: appEnv,
    AI_PROVIDER: providerName,
    ANTHROPIC_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL_FAST: z.string().optional(),
    GEMINI_MODEL_DEEP: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    const fail = (message: string, path: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });

    if (env.AI_PROVIDER === "none") return; // Intentionally disabled: check nothing.

    if (env.APP_ENV === "production" && env.AI_PROVIDER === "gemini") {
      fail(
        "Gemini must not run in production: its free tier permits training on " +
          "submitted data, and real user data must never reach it (CLAUDE.md §2).",
        "AI_PROVIDER",
      );
      return;
    }

    if (env.AI_PROVIDER === "anthropic") {
      if (!env.ANTHROPIC_API_KEY) {
        fail(requiredMsg("ANTHROPIC_API_KEY", "AI_PROVIDER=anthropic"), "ANTHROPIC_API_KEY");
      } else if (!env.ANTHROPIC_API_KEY.startsWith(ANTHROPIC_KEY_PREFIX)) {
        fail(
          `ANTHROPIC_API_KEY does not match the documented key structure ` +
            `(expected it to begin with "${ANTHROPIC_KEY_PREFIX}").`,
          "ANTHROPIC_API_KEY",
        );
      }
    }

    if (env.AI_PROVIDER === "gemini") {
      if (!env.GEMINI_API_KEY) {
        fail(requiredMsg("GEMINI_API_KEY", "AI_PROVIDER=gemini"), "GEMINI_API_KEY");
      } else if (!GEMINI_KEY_PREFIXES.some((p) => env.GEMINI_API_KEY?.startsWith(p))) {
        fail(
          `GEMINI_API_KEY does not match a documented Google API key structure ` +
            `(expected it to begin with one of: ${GEMINI_KEY_PREFIXES.join(", ")}).`,
          "GEMINI_API_KEY",
        );
      }
      if (!env.GEMINI_MODEL_FAST) {
        fail(requiredMsg("GEMINI_MODEL_FAST", "AI_PROVIDER=gemini"), "GEMINI_MODEL_FAST");
      }
      if (!env.GEMINI_MODEL_DEEP) {
        fail(requiredMsg("GEMINI_MODEL_DEEP", "AI_PROVIDER=gemini"), "GEMINI_MODEL_DEEP");
      }
    }
  });

export type AiEnvShape = z.infer<typeof aiEnvSchema>;

export interface AiEnv {
  APP_ENV: AppEnv;
  AI_PROVIDER: AiProviderName;
}

/** Reads the validated selection. Throws if unset/invalid — never guesses. */
export function readAiEnv(env: EnvSource = process.env): AiEnv {
  const parsed = aiEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      `AI environment is invalid: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return { APP_ENV: parsed.data.APP_ENV, AI_PROVIDER: parsed.data.AI_PROVIDER };
}
```

Note the unused `EnvSpec` import is intentionally **absent** here: the registered spec is assembled in `registry.ts` (Task 8), because it needs `capabilityGaps`.

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run lib/ai/env.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/env.ts lib/ai/env.test.ts
git commit -m "feat(ai): explicit provider selection + deployment policy

AI_PROVIDER and APP_ENV are required and never inferred. 'none' means
intentionally disabled and checks no credential (keeps the 503 path). A named
provider validates its credential's documented structure. Gemini in production
is a startup failure: its free tier trains on submitted data (CLAUDE.md §2)."
```

---

### Task 5: The port and the fake provider

**Files:**
- Create: `lib/ai/port.ts`, `lib/ai/providers/fake.ts`
- Test: `lib/ai/providers/fake.test.ts`

**Interfaces:**
- Consumes: `ConversationTurn` from `lib/ai/types.ts`.
- Produces — used by Tasks 6, 7, 8, 9, 10:

```ts
export type Tier = "fast" | "deep";
export interface SystemBlock { text: string; cacheable: boolean }
export interface TokenUsage { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }
export interface AiRequest { tier: Tier; system: SystemBlock[]; messages: ConversationTurn[]; maxTokens: number; reasoning: boolean }
export interface AiResult { model: string; truncated: boolean; usage: TokenUsage | null }
export interface Capabilities { promptCaching: boolean; reasoning: boolean; structuredOutput: boolean }
export interface AiProvider {
  readonly name: AiProviderName;
  readonly capabilities: Capabilities;
  generateText(req: AiRequest): Promise<AiResult & { text: string }>;
  generateStructured<T>(req: AiRequest, schema: z.ZodType<T>): Promise<AiResult & { parsed: T }>;
}
export function createFakeProvider(overrides?: Partial<Capabilities>): FakeProviderHandle
export interface FakeProviderHandle {
  provider: AiProvider;
  requests: AiRequest[];
  queueText(text: string, opts?: Partial<AiResult>): void;
  queueStructured(parsed: unknown, opts?: Partial<AiResult>): void;
  queueError(err: Error): void;
}
```

`generateStructured` takes `z.ZodType` from **`zod/v4`** — `lib/ai/schemas.ts` is defined against the `zod/v4` subpath (verified: zod 3.25.76 installed, subpath resolves, `z.toJSONSchema` is a function). Do not convert those schemas to v3.

- [ ] **Step 1: Write the failing test**

```ts
// lib/ai/providers/fake.test.ts
import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { createFakeProvider } from "./fake";

const req = {
  tier: "fast" as const,
  system: [{ text: "sys", cacheable: true }],
  messages: [{ role: "user" as const, content: "hi" }],
  maxTokens: 100,
  reasoning: false,
};

describe("fake provider", () => {
  it("returns queued text and records the request", async () => {
    const fake = createFakeProvider();
    fake.queueText("hello");
    const result = await fake.provider.generateText(req);
    expect(result.text).toBe("hello");
    expect(result.model).toBe("fake-fast");
    expect(fake.requests[0]).toEqual(req);
  });

  it("returns queued structured output", async () => {
    const fake = createFakeProvider();
    fake.queueStructured({ n: 1 });
    const result = await fake.provider.generateStructured(req, z.object({ n: z.number() }));
    expect(result.parsed).toEqual({ n: 1 });
  });

  it("validates structured output against the schema so tests cannot fake an invalid shape", async () => {
    const fake = createFakeProvider();
    fake.queueStructured({ wrong: true });
    await expect(
      fake.provider.generateStructured(req, z.object({ n: z.number() })),
    ).rejects.toThrow();
  });

  it("throws queued errors", async () => {
    const fake = createFakeProvider();
    fake.queueError(new Error("boom"));
    await expect(fake.provider.generateText(req)).rejects.toThrow("boom");
  });

  it("fails loudly when nothing is queued", async () => {
    const fake = createFakeProvider();
    await expect(fake.provider.generateText(req)).rejects.toThrow(/queued/i);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run lib/ai/providers/fake.test.ts`
Expected: FAIL — cannot resolve `./fake`.

- [ ] **Step 3: Implement the port**

```ts
// lib/ai/port.ts
/**
 * The provider-agnostic port. Two operations, expressed in APPLICATION terms.
 *
 * Designed around the long-term product, never around whichever provider is
 * configured today (Spec §2). Specifically:
 *  - `system` is an array of blocks with a `cacheable` flag, not a string:
 *    prompt caching is the cost mechanism the Knowledge Economy rests on
 *    (business-model.md), and `conversationReply` already relies on a cached
 *    frozen scenario prompt plus an uncached level-guidance block.
 *  - `usage` is returned even though nothing reads it yet: the north-star
 *    "Knowledge Reuse Ratio" and "AI cost per active user" KPIs need token
 *    counts, and `cacheReadTokens` is reuse measured at the AI layer.
 *  - `reasoning` is independent of `tier`: sessionCorrections needs reasoning
 *    and conversationReply does not, yet both are conversation.
 *
 * `tier` is an application intent (cheap-and-cacheable vs deep). Model ids are a
 * PROVIDER concept and never cross this boundary (Spec D4).
 */
import type { z } from "zod/v4";
import type { AiProviderName } from "./env";
import type { ConversationTurn } from "./types";

export type Tier = "fast" | "deep";

export interface SystemBlock {
  text: string;
  /** Stable prefix → the adapter applies provider-native prompt caching. */
  cacheable: boolean;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface AiRequest {
  tier: Tier;
  system: SystemBlock[];
  messages: ConversationTurn[];
  maxTokens: number;
  reasoning: boolean;
}

export interface AiResult {
  /** Resolved provider model id — CLAUDE.md §2.3 traceability. Always present. */
  model: string;
  truncated: boolean;
  usage: TokenUsage | null;
}

/** What a provider can honour. Compared against REQUIRED_CAPABILITIES at startup. */
export interface Capabilities {
  promptCaching: boolean;
  reasoning: boolean;
  structuredOutput: boolean;
}

export interface AiProvider {
  readonly name: AiProviderName;
  readonly capabilities: Capabilities;
  generateText(req: AiRequest): Promise<AiResult & { text: string }>;
  generateStructured<T>(req: AiRequest, schema: z.ZodType<T>): Promise<AiResult & { parsed: T }>;
}
```

- [ ] **Step 4: Implement the fake provider**

```ts
// lib/ai/providers/fake.ts
/**
 * In-memory provider for FEATURE tests (Spec D6). Feature tests assert business
 * logic and must not know which provider exists; provider request/response
 * shape belongs in adapter tests.
 *
 * It validates queued structured output against the caller's schema so a test
 * cannot pass a shape the real providers would reject.
 */
import type { z } from "zod/v4";
import type { AiProvider, AiRequest, AiResult, Capabilities } from "../port";

type Queued =
  | { kind: "text"; text: string; opts?: Partial<AiResult> }
  | { kind: "structured"; parsed: unknown; opts?: Partial<AiResult> }
  | { kind: "error"; err: Error };

export interface FakeProviderHandle {
  provider: AiProvider;
  /** Every request received, in call order. */
  requests: AiRequest[];
  queueText(text: string, opts?: Partial<AiResult>): void;
  queueStructured(parsed: unknown, opts?: Partial<AiResult>): void;
  queueError(err: Error): void;
}

const FULL_CAPABILITIES: Capabilities = {
  promptCaching: true,
  reasoning: true,
  structuredOutput: true,
};

export function createFakeProvider(
  overrides: Partial<Capabilities> = {},
): FakeProviderHandle {
  const queue: Queued[] = [];
  const requests: AiRequest[] = [];

  const take = (req: AiRequest): Queued => {
    requests.push(req);
    const next = queue.shift();
    if (!next) throw new Error("FakeProvider: no response queued for this call.");
    if (next.kind === "error") throw next.err;
    return next;
  };

  const baseResult = (req: AiRequest, opts?: Partial<AiResult>): AiResult => ({
    model: `fake-${req.tier}`,
    truncated: false,
    usage: null,
    ...opts,
  });

  const provider: AiProvider = {
    name: "none",
    capabilities: { ...FULL_CAPABILITIES, ...overrides },

    async generateText(req) {
      const next = take(req);
      if (next.kind !== "text") throw new Error("FakeProvider: queued response is not text.");
      return { ...baseResult(req, next.opts), text: next.text };
    },

    async generateStructured<T>(req: AiRequest, schema: z.ZodType<T>) {
      const next = take(req);
      if (next.kind !== "structured") {
        throw new Error("FakeProvider: queued response is not structured.");
      }
      const parsed = schema.parse(next.parsed);
      return { ...baseResult(req, next.opts), parsed };
    },
  };

  return {
    provider,
    requests,
    queueText: (text, opts) => queue.push({ kind: "text", text, opts }),
    queueStructured: (parsed, opts) => queue.push({ kind: "structured", parsed, opts }),
    queueError: (err) => queue.push({ kind: "error", err }),
  };
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run lib/ai/providers/fake.test.ts && npm run typecheck`
Expected: PASS, 5 tests; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/port.ts lib/ai/providers/fake.ts lib/ai/providers/fake.test.ts
git commit -m "feat(ai): provider-agnostic port + fake provider

The port speaks application intent (tier, cacheable system blocks, reasoning)
and never model ids. usage/cacheReadTokens are carried from day one because the
Knowledge Reuse Ratio KPI needs them and retrofitting would reopen the port."
```

---

### Task 6: The Anthropic adapter

Moves the Anthropic-specific request shape and error mapping out of the feature modules (Spec §5.5).

**Files:**
- Create: `lib/ai/providers/anthropic.ts`
- Test: `lib/ai/providers/anthropic.test.ts`

`lib/ai/errors.ts` is **not touched in this task.** `toAiError` stays where it is and this adapter imports it; it relocates in Task 10, once the three feature modules have stopped importing it. Moving it now would red-line typecheck for four commits and break `git bisect` across them, violating CLAUDE.md §9 at every one.

**Interfaces:**
- Consumes: `AiProvider`, `AiRequest`, `AiResult` (Task 5); `AiError`, `AiErrorKind` from `lib/ai/errors.ts`.
- Produces: `export function createAnthropicProvider(apiKey: string): AiProvider` — used by Task 8.

Tier→model map (business-model.md: Haiku for cacheable/lite, Opus for conversation):

```ts
const MODEL_BY_TIER: Record<Tier, string> = {
  fast: "claude-haiku-4-5-20251001",
  deep: "claude-opus-4-8",
};
```

- [ ] **Step 1: Write the failing adapter test**

These are the assertions **moved** out of `lib/ai/content.test.ts` / `conversation.test.ts` (D6) — they were always adapter assertions living in feature tests.

```ts
// lib/ai/providers/anthropic.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { installClaudeMock, type ClaudeMockHandle } from "@/test/claude-mock";
import { AiError } from "../errors";
import { createAnthropicProvider } from "./anthropic";

let mock: ClaudeMockHandle;
afterEach(() => mock?.restore());

const req = {
  tier: "deep" as const,
  system: [
    { text: "cached prefix", cacheable: true },
    { text: "variable suffix", cacheable: false },
  ],
  messages: [{ role: "user" as const, content: "hi" }],
  maxTokens: 512,
  reasoning: false,
};

describe("anthropic adapter", () => {
  it("maps tier to the model and marks only cacheable system blocks", async () => {
    mock = installClaudeMock();
    mock.queueText("ok");
    const provider = createAnthropicProvider("sk-ant-test");
    await provider.generateText(req);

    const body = JSON.parse(mock.requests[0].bodyText);
    expect(body.model).toBe("claude-opus-4-8");
    expect(body.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(body.system[1].cache_control).toBeUndefined();
  });

  it("maps the fast tier to Haiku", async () => {
    mock = installClaudeMock();
    mock.queueText("ok");
    const provider = createAnthropicProvider("sk-ant-test");
    await provider.generateText({ ...req, tier: "fast" });
    expect(JSON.parse(mock.requests[0].bodyText).model).toBe("claude-haiku-4-5-20251001");
  });

  it("sends output_config for structured output", async () => {
    mock = installClaudeMock();
    mock.queueStructured({ n: 1 });
    const provider = createAnthropicProvider("sk-ant-test");
    const result = await provider.generateStructured(req, z.object({ n: z.number() }));
    expect(result.parsed).toEqual({ n: 1 });
    expect(JSON.parse(mock.requests[0].bodyText).output_config).toBeDefined();
  });

  it("enables thinking only when reasoning is requested", async () => {
    mock = installClaudeMock();
    mock.queueText("ok");
    const provider = createAnthropicProvider("sk-ant-test");
    await provider.generateText({ ...req, reasoning: true });
    expect(JSON.parse(mock.requests[0].bodyText).thinking).toEqual({ type: "adaptive" });
  });

  it("maps a 429 to the rate_limited kind", async () => {
    mock = installClaudeMock();
    mock.queueStatus(429);
    const provider = createAnthropicProvider("sk-ant-test");
    await expect(provider.generateText(req)).rejects.toMatchObject({ kind: "rate_limited" });
  });

  it("maps a 401 to the auth kind", async () => {
    mock = installClaudeMock();
    mock.queueStatus(401);
    const provider = createAnthropicProvider("sk-ant-test");
    // Assert the KIND, not just the type: lib/http-status.ts maps kind → HTTP
    // status, and ~10 downstream suites depend on that mapping. `toBeInstanceOf`
    // would still pass if 401 regressed to "unknown".
    await expect(provider.generateText(req)).rejects.toMatchObject({ kind: "auth" });
  });
});
```

**Before writing this test, read `test/claude-mock.ts`** and use its real API. The names `queueText` / `queueStructured` / `queueStatus` / `requests[].bodyText` above are the shapes this task needs; if the existing handle exposes different names, use the existing ones and do not rename the shared harness — other suites depend on it.

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run lib/ai/providers/anthropic.test.ts`
Expected: FAIL — cannot resolve `./anthropic`.

- [ ] **Step 3: Implement the adapter**

Import `toAiError` from `../errors` — do **not** move or copy it here. It is Anthropic-specific and will relocate into this file in Task 10, after the feature modules stop importing it.

```ts
// lib/ai/providers/anthropic.ts
/**
 * Anthropic adapter. The ONLY place (besides providers/gemini.ts) allowed to
 * import a provider SDK — enforced by the lint rule in Task 15.
 *
 * Per the Anthropic API rules for these models: never send temperature/top_p/
 * top_k or a budget_tokens thinking config — they 400.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod/v4";
import { AiError, toAiError } from "../errors";
import type { AiProvider, AiRequest, AiResult, Tier, TokenUsage } from "../port";

const MODEL_BY_TIER: Record<Tier, string> = {
  fast: "claude-haiku-4-5-20251001",
  deep: "claude-opus-4-8",
};

function toSystem(req: AiRequest): Anthropic.Messages.TextBlockParam[] {
  return req.system.map((block) => ({
    type: "text",
    text: block.text,
    ...(block.cacheable ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));
}

function toMessages(req: AiRequest): Anthropic.Messages.MessageParam[] {
  return req.messages.map((turn) => ({
    role: turn.role === "ai" ? "assistant" : "user",
    content: turn.content,
  }));
}

function toUsage(usage: Anthropic.Messages.Usage | undefined): TokenUsage | null {
  if (!usage) return null;
  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
  };
}

function baseParams(req: AiRequest) {
  return {
    model: MODEL_BY_TIER[req.tier],
    max_tokens: req.maxTokens,
    system: toSystem(req),
    messages: toMessages(req),
    ...(req.reasoning ? { thinking: { type: "adaptive" as const } } : {}),
  };
}

export function createAnthropicProvider(apiKey: string): AiProvider {
  const client = new Anthropic({ apiKey, maxRetries: 0 });

  return {
    name: "anthropic",
    capabilities: { promptCaching: true, reasoning: true, structuredOutput: true },

    async generateText(req) {
      try {
        const response = await client.messages.create(baseParams(req));
        const text = response.content.find((b) => b.type === "text");
        return {
          text: text && text.type === "text" ? text.text : "",
          model: response.model,
          truncated: response.stop_reason === "max_tokens",
          usage: toUsage(response.usage),
        } satisfies AiResult & { text: string };
      } catch (err) {
        throw toAiError(err);
      }
    },

    async generateStructured<T>(req: AiRequest, schema: z.ZodType<T>) {
      try {
        const response = await client.messages.parse({
          ...baseParams(req),
          output_config: { format: zodOutputFormat(schema) },
        });
        if (response.parsed_output == null) {
          throw new AiError(
            "invalid_output",
            "Model response did not match the expected schema.",
          );
        }
        return {
          parsed: response.parsed_output as T,
          model: response.model,
          truncated: response.stop_reason === "max_tokens",
          usage: toUsage(response.usage),
        };
      } catch (err) {
        throw toAiError(err);
      }
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run lib/ai/providers/anthropic.test.ts && npm run typecheck && npm test`
Expected: adapter tests PASS, typecheck clean, **full suite still green**. Nothing else changed yet — the feature modules keep working exactly as before, through the code path they already used.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/providers/anthropic.ts lib/ai/providers/anthropic.test.ts
git commit -m "feat(ai): Anthropic adapter behind the port

Adds the adapter alongside the existing code path; the feature modules move
over in Tasks 9-10, so the tree stays green at every commit. AiErrorKind and
lib/http-status.ts are untouched: the adapter maps the SDK's typed errors onto
the same union, so the ~10 suites asserting 503 stay green. Tier maps to model
here — call sites never name a model."
```

---

### Task 7: The Gemini adapter

**Blocked by Task 1** (model id). **Answers V1** (does `@google/genai` route through global `fetch`?).

**Files:**
- Create: `lib/ai/providers/gemini.ts`
- Test: `lib/ai/providers/gemini.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: the port (Task 5); `AiError` from `lib/ai/errors.ts`.
- Produces: `export function createGeminiProvider(cfg: { apiKey: string; fastModel: string; deepModel: string }): AiProvider` — used by Task 8.

- [ ] **Step 1: Install the SDK and answer V1**

```bash
npm install @google/genai
node -e "const g=require('@google/genai');console.log(Object.keys(g).slice(0,20))"
```

Then determine whether the client issues requests through the global `fetch`. Set a probe:

```bash
node -e "
const orig = globalThis.fetch;
globalThis.fetch = (...a) => { console.log('GLOBAL FETCH USED:', String(a[0]).slice(0,60)); return orig(...a); };
const { GoogleGenAI } = require('@google/genai');
new GoogleGenAI({ apiKey: 'probe' }).models.generateContent({ model: 'gemini-2.0-flash', contents: 'hi' })
  .then(() => {}, () => {});
"
```

If `GLOBAL FETCH USED` prints, mock at the fetch layer in Step 2, mirroring `test/claude-mock.ts` (add `test/gemini-mock.ts` in the same shape). If it does **not** print, mock the module instead with `vi.mock("@google/genai", ...)`. **Record the answer in spec §7 row V1 either way** — this is the fact the spec says must not be assumed.

- [ ] **Step 2: Write the failing test**

Mock the **module**, not `fetch`. Unlike the Anthropic adapter — which has a fetch-level harness already (`test/claude-mock.ts`) — nothing here needs the wire shape: this adapter's job is mapping the port onto the SDK's API, and that is exactly what a module mock observes. This also makes the test independent of V1's outcome. Record V1 anyway; it is a spec commitment, and it decides whether a fetch-level `test/gemini-mock.ts` is even possible later.

```ts
// lib/ai/providers/gemini.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";

const generateContent = vi.fn();
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

// Import AFTER vi.mock so the adapter picks up the mocked module.
const { createGeminiProvider } = await import("./gemini");

const cfg = { apiKey: "test-key", fastModel: "model-fast", deepModel: "model-deep" };
const req = {
  tier: "fast" as const,
  system: [{ text: "sys", cacheable: true }],
  messages: [{ role: "user" as const, content: "hi" }],
  maxTokens: 100,
  reasoning: false,
};

/** Shapes an error the way the SDK surfaces HTTP failures. Adjust to the real
 *  SDK error shape once Step 1 has shown it. */
const apiError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

beforeEach(() => generateContent.mockReset());

describe("gemini adapter", () => {
  it("maps each tier to its configured model", async () => {
    generateContent.mockResolvedValue({ text: "ok" });
    const provider = createGeminiProvider(cfg);

    await provider.generateText(req);
    expect(generateContent.mock.calls[0][0].model).toBe("model-fast");

    await provider.generateText({ ...req, tier: "deep" });
    expect(generateContent.mock.calls[1][0].model).toBe("model-deep");
  });

  it("returns parsed structured output", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ n: 1 }) });
    const provider = createGeminiProvider(cfg);
    const result = await provider.generateStructured(req, z.object({ n: z.number() }));
    expect(result.parsed).toEqual({ n: 1 });
    expect(result.model).toBe("model-fast");
  });

  it("sends a responseSchema derived from the zod schema", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ n: 1 }) });
    const provider = createGeminiProvider(cfg);
    await provider.generateStructured(req, z.object({ n: z.number() }));
    expect(generateContent.mock.calls[0][0].config.responseSchema).toBeDefined();
  });

  it("maps a 429 onto the shared rate_limited kind", async () => {
    generateContent.mockRejectedValue(apiError(429));
    await expect(createGeminiProvider(cfg).generateText(req)).rejects.toMatchObject({
      kind: "rate_limited",
    });
  });

  it("maps a 401 onto the shared auth kind", async () => {
    generateContent.mockRejectedValue(apiError(401));
    await expect(createGeminiProvider(cfg).generateText(req)).rejects.toMatchObject({
      kind: "auth",
    });
  });

  it("maps output that fails the schema onto invalid_output", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ wrong: true }) });
    await expect(
      createGeminiProvider(cfg).generateStructured(req, z.object({ n: z.number() })),
    ).rejects.toMatchObject({ kind: "invalid_output" });
  });
});
```

Assert on `.kind`, never on message strings — this is the same union the Anthropic adapter produces (Spec §5.5), which is what keeps `lib/http-status.ts` provider-blind.

- [ ] **Step 3: Run the test and watch it fail**

Run: `npx vitest run lib/ai/providers/gemini.test.ts`
Expected: FAIL — cannot resolve `./gemini`.

- [ ] **Step 4: Implement, resolving V2 first**

Convert the zod schema with `z.toJSONSchema(schema)` (verified available: zod 3.25.76, `zod/v4` subpath). Gemini's `responseSchema` accepts a subset of OpenAPI — check the produced JSON against it and massage if required. The three real schemas (`CorrectionsSchema`, `VideoSummarySchema`, `ExamplesSchema`) are flat, all-string, with no unions/refinements/recursion/numeric constraints, so the translation should be near 1:1. **Record what massaging was needed in spec §7 row V2.**

Capabilities must be declared honestly — this is the whole point of the capability mechanism (Spec §5.4). **Declare what this adapter actually implements, not what the API is capable of in principle.** Task 1 verified that `gemini-3.1-flash-lite` advertises `createCachedContent`, so `promptCaching: true` is reachable — but only declare it `true` if this adapter really wires caching up; otherwise `false` is the honest answer and the gap report is working as designed.

**Do not weaken the port to make a gap disappear** (Spec §2): a `false` surfaces as a startup gap report in dev and a hard failure in production, which is the designed outcome. Since Gemini never runs in production (D7), a `false` here costs nothing but honesty in dev.

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run lib/ai/providers/gemini.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/ai/providers/gemini.ts lib/ai/providers/gemini.test.ts docs/superpowers/specs/2026-07-15-ai-provider-abstraction-design.md
git commit -m "feat(ai): Gemini adapter behind the port (dev provider)

Maps Gemini's SDK onto the same AiErrorKind union as Anthropic. Capabilities are
declared honestly rather than by weakening the port; gaps surface at startup.
Records V1/V2 findings in the spec."
```

---

### Task 8: The registry — explicit selection and the capability gate

**Files:**
- Create: `lib/ai/registry.ts`, `lib/ai/capabilities.ts`
- Test: `lib/ai/registry.test.ts`

**Interfaces:**
- Consumes: `readAiEnv`, `aiEnvSchema` (Task 4); `createAnthropicProvider` (Task 6); `createGeminiProvider` (Task 7); `AiProvider`, `Capabilities` (Task 5).
- Produces — used by Tasks 9, 10, 11, 13:

```ts
export const REQUIRED_CAPABILITIES: Capabilities   // in capabilities.ts
export function getProvider(env?: EnvSource): AiProvider   // throws AiNotConfiguredError when AI_PROVIDER=none
export function isAiEnabled(env?: EnvSource): boolean      // AI_PROVIDER !== "none"
export function capabilityGaps(provider: AiProvider): string[]
export function setProviderForTesting(p: AiProvider | null): void
export const aiEnvSpec: EnvSpec<AiEnvShape>   // assembled here; registered by Task 13
```

`REQUIRED_CAPABILITIES` states what the **product** needs, permanently: `{ promptCaching: true, reasoning: true, structuredOutput: true }`. All three are load-bearing today — prompt caching for the Knowledge Economy, reasoning for `sessionCorrections`/`summarizeTranscript`, structured output for all three schemas.

- [ ] **Step 1: Write the failing test**

```ts
// lib/ai/registry.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiNotConfiguredError } from "./errors";
import { capabilityGaps, getProvider, isAiEnabled, setProviderForTesting } from "./registry";
import { createFakeProvider } from "./providers/fake";

beforeEach(() => setProviderForTesting(null));

describe("isAiEnabled", () => {
  it("is false when AI is intentionally disabled", () => {
    expect(isAiEnabled({ APP_ENV: "dev", AI_PROVIDER: "none" })).toBe(false);
  });
  it("is true for a named provider", () => {
    expect(isAiEnabled({ APP_ENV: "dev", AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "sk-ant-x" })).toBe(true);
  });
});

describe("getProvider", () => {
  it("throws AiNotConfiguredError when AI_PROVIDER=none — the deliberate 503 path (D1)", () => {
    expect(() => getProvider({ APP_ENV: "dev", AI_PROVIDER: "none" })).toThrow(AiNotConfiguredError);
  });

  it("never falls back to another provider when the selected one is unusable", () => {
    // A missing credential is a startup failure, never a silent substitution.
    expect(() => getProvider({ APP_ENV: "dev", AI_PROVIDER: "anthropic" })).toThrow();
  });
});

describe("capabilityGaps", () => {
  it("is empty for a fully capable provider", () => {
    const fake = createFakeProvider();
    expect(capabilityGaps(fake.provider)).toEqual([]);
  });

  it("names each capability the product requires but the provider lacks", () => {
    const fake = createFakeProvider({ promptCaching: false });
    expect(capabilityGaps(fake.provider).join(" ")).toContain("promptCaching");
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run lib/ai/registry.test.ts`
Expected: FAIL — cannot resolve `./registry`.

- [ ] **Step 3: Implement**

```ts
// lib/ai/capabilities.ts
/**
 * What the PRODUCT requires of any AI provider — declared permanently, in
 * application terms, independent of who is configured (Spec §5.4).
 *
 * A provider that cannot meet these cannot serve production. In dev the gap is
 * reported at startup and the app runs; a provider's limits are never a reason
 * to narrow the port (Spec §2).
 */
import type { Capabilities } from "./port";

export const REQUIRED_CAPABILITIES: Capabilities = {
  promptCaching: true,   // Knowledge Economy cost model (business-model.md)
  reasoning: true,       // sessionCorrections + summarizeTranscript
  structuredOutput: true // all three schemas in lib/ai/schemas.ts
};
```

```ts
// lib/ai/registry.ts
/**
 * Explicit provider selection. No inference, no fallback (Spec §2): the app
 * never substitutes a provider, and absence of a key is never read as intent.
 */
import { REQUIRED_CAPABILITIES } from "./capabilities";
import { aiEnvSchema, readAiEnv } from "./env";
import { AiNotConfiguredError } from "./errors";
import type { AiProvider } from "./port";
import { createAnthropicProvider } from "./providers/anthropic";
import { createGeminiProvider } from "./providers/gemini";

let testProvider: AiProvider | null = null;

/** Test-only injection point. */
export function setProviderForTesting(provider: AiProvider | null): void {
  testProvider = provider;
}

export function isAiEnabled(env: EnvSource = process.env): boolean {
  return readAiEnv(env).AI_PROVIDER !== "none";
}

export function getProvider(env: EnvSource = process.env): AiProvider {
  if (testProvider) return testProvider;

  const parsed = aiEnvSchema.safeParse(env);
  if (!parsed.success) {
    // Startup validation should have caught this; reaching here means a route
    // ran before validation, so fail loudly rather than degrade.
    throw new Error(
      `AI provider is misconfigured: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }

  const cfg = parsed.data;
  switch (cfg.AI_PROVIDER) {
    case "none":
      throw new AiNotConfiguredError();
    case "anthropic":
      return createAnthropicProvider(cfg.ANTHROPIC_API_KEY as string);
    case "gemini":
      return createGeminiProvider({
        apiKey: cfg.GEMINI_API_KEY as string,
        fastModel: cfg.GEMINI_MODEL_FAST as string,
        deepModel: cfg.GEMINI_MODEL_DEEP as string,
      });
  }
}

/** Capabilities the product requires that this provider does not declare. */
export function capabilityGaps(provider: AiProvider): string[] {
  return (Object.keys(REQUIRED_CAPABILITIES) as (keyof typeof REQUIRED_CAPABILITIES)[])
    .filter((key) => REQUIRED_CAPABILITIES[key] && !provider.capabilities[key])
    .map((key) => `provider "${provider.name}" does not support ${key}`);
}

/**
 * The registered startup spec, assembled HERE rather than in env.ts because the
 * capability comparison needs `getProvider`/`capabilityGaps` — and env.ts is
 * already imported by this module.
 *
 * Capability gaps ride in the same aggregated report as schema failures
 * (Spec §5.2). Production must never serve silently degraded output; dev shows
 * the gap and runs anyway (Spec §5.4).
 */
export const aiEnvSpec: EnvSpec<AiEnvShape> = {
  name: "ai",
  schema: aiEnvSchema,
  check: (env) => {
    if (env.AI_PROVIDER === "none") return {};
    const gaps = capabilityGaps(getProvider(env));
    if (gaps.length === 0) return {};
    return env.APP_ENV === "production" ? { errors: gaps } : { warnings: gaps };
  },
};
```

Add the matching imports at the top of `registry.ts`:

```ts
import type { EnvSpec } from "@/lib/env/validate";
import { aiEnvSchema, readAiEnv, type AiEnvShape } from "./env";
```

- [ ] **Step 4: Update `AiNotConfiguredError`'s message**

In `lib/ai/errors.ts`, the default message currently reads `"AI features are not configured: ANTHROPIC_API_KEY is not set."` — untrue under Gemini (Spec §5.5). Change it to:

```ts
constructor(message = "AI features are disabled for this deployment (AI_PROVIDER=none).") {
```

Then find every test asserting on that string:

```bash
grep -rn "ANTHROPIC_API_KEY is not set" --include=*.ts --include=*.tsx .
```

Update those assertions. Assertions on `.kind` must **not** change — if you find yourself editing a `.kind` expectation, stop: that means behaviour drifted, which D1 forbids.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run lib/ai/registry.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/registry.ts lib/ai/capabilities.ts lib/ai/registry.test.ts lib/ai/errors.ts
git commit -m "feat(ai): explicit provider registry + capability gate

Selection comes from AI_PROVIDER only — never from which keys exist, never with
a fallback. REQUIRED_CAPABILITIES declares what the product needs so a provider's
limits surface as a startup gap instead of silently narrowing the port."
```

---

### Task 9: Move `conversation.ts` onto the port

**Files:**
- Modify: `lib/ai/conversation.ts`, `lib/ai/conversation.test.ts`

**Interfaces:**
- Consumes: `getProvider` (Task 8); `AiProvider` (Task 5).
- Produces: `conversationReply(input, provider?)` and `sessionCorrections(messages, provider?)` — the optional last parameter defaults to `getProvider()`, matching the repo's clock-injection convention.

- [ ] **Step 1: Rewrite `conversationReply` against the port**

```ts
export async function conversationReply(
  input: ConversationReplyInput,
  provider: AiProvider = getProvider(),
): Promise<ConversationReplyResult> {
  const result = await provider.generateText({
    tier: "deep",                 // conversation = Opus (business-model.md)
    reasoning: false,             // a reply is a simple generation
    maxTokens: MAX_TOKENS.chat,
    system: [
      { text: scenarioSystemPrompt(input.scenario), cacheable: true },
      { text: levelGuidance(input.level), cacheable: false },
    ],
    messages: input.messages,
  });

  return { reply: result.text, truncated: result.truncated, model: result.model };
}
```

The role mapping (`ai` → `assistant`) moves into the adapter, so `toApiMessages` and the `import type Anthropic` line are deleted from this file. Delete `firstText` usage here — the adapter extracts text now.

- [ ] **Step 2: Rewrite `sessionCorrections` against the port**

Same shape: `tier: "fast"` (cacheable per business-model), `reasoning: true`, `maxTokens: MAX_TOKENS.corrections`, one cacheable system block holding `CORRECTIONS_SYSTEM`, one user message built from the existing `userLines` logic (keep that logic verbatim — it is business logic and must not change), and `provider.generateStructured(req, CorrectionsSchema)`. Drop the `try/catch { throw toAiError(err) }` — adapters now produce `AiError` directly.

- [ ] **Step 3: Convert `conversation.test.ts` to the fake provider**

Replace `installClaudeMock` with `createFakeProvider`, and pass `fake.provider` as the second argument. Assertions about **business logic** stay (only user turns are analysed; empty-session copy; `truncated` propagation; `model` propagation). Assertions about **Anthropic request body shape** (`output_config`, `cache_control`, `model: "claude-opus-4-8"`) are **deleted here** — they live in `lib/ai/providers/anthropic.test.ts` now (Task 6). Assert intent instead where it matters:

```ts
expect(fake.requests[0].tier).toBe("deep");
expect(fake.requests[0].system[0].cacheable).toBe(true);
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run lib/ai/conversation.test.ts && npm run typecheck`
Expected: PASS. `lib/ai/conversation.ts` must no longer contain the string `@anthropic-ai/sdk` — check with `grep -n "anthropic" lib/ai/conversation.ts` (expect no output).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/conversation.ts lib/ai/conversation.test.ts
git commit -m "refactor(ai): conversation speaks the port, not the Anthropic SDK

Feature tests now run against the fake provider and assert business logic; the
request-shape assertions moved to the adapter test where they belong."
```

---

### Task 10: Move `summary.ts` and `examples.ts` onto the port

**Files:**
- Modify: `lib/ai/summary.ts`, `lib/ai/examples.ts`, `lib/ai/content.test.ts`, `lib/ai/run.ts`, `lib/ai/constants.ts`, `lib/ai/errors.ts`, `lib/ai/providers/anthropic.ts`

**Interfaces:**
- Consumes: `getProvider` (Task 8); `AiProvider` (Task 5).
- Produces: `summarizeTranscript(input, provider?)`, `generateExamples(input, provider?)`.

- [ ] **Step 1: Rewrite both against the port**

`summarizeTranscript`: `tier: "fast"`, `reasoning: true`, `maxTokens: MAX_TOKENS.summary`, one cacheable system block (`SUMMARY_SYSTEM`), one user message from the existing `capTranscript` logic (**keep `capTranscript` and `TRANSCRIPT_CHAR_CAP` exactly as they are** — deterministic input capping is business logic), then `provider.generateStructured(req, VideoSummarySchema)`. Keep returning `inputTruncated: truncated`.

> Note the tier/reasoning combination is deliberate and is why the port keeps the two axes separate (Spec §5.3): summary is `fast` (cacheable, per business-model) **and** `reasoning: true`.

`generateExamples`: `tier: "fast"`, `reasoning: false`, `maxTokens: MAX_TOKENS.examples`, one cacheable system block (`EXAMPLES_SYSTEM`), the existing `userContent` string verbatim, `provider.generateStructured(req, ExamplesSchema)`. Keep `source: AI_SOURCE`.

- [ ] **Step 2: Relocate `toAiError` and clean up `run.ts` / `constants.ts`**

**`errors.ts`:** now that no feature module imports it, move `toAiError` into `lib/ai/providers/anthropic.ts` (delete it here along with the `import Anthropic from "@anthropic-ai/sdk"` line, and drop the `../errors` import of it in the adapter). Keep the mapping order — most specific first: `RateLimitError` → `AuthenticationError` → `APIConnectionError` → `APIError` → `AnthropicError` base → unknown — and bring its doc comment with it. Keep `AiError`, `AiErrorKind` and `AiNotConfiguredError` in `errors.ts` exactly as they are: **D1 depends on that union not changing**, and `lib/http-status.ts` consumes it. When you are done, `errors.ts` must import nothing from any SDK — that is what makes the Task 15 lint rule pass.

**`run.ts`:** delete `firstText` (Anthropic `ContentBlock[]` — adapter concern) and `requireParsed` (adapters raise `invalid_output` themselves now). If the file ends up empty, delete it and drop its imports.

`constants.ts`: delete `AI_MODEL` — tier→model now lives per adapter (D4). Keep `AI_SOURCE`, `MAX_TOKENS`, `TRANSCRIPT_CHAR_CAP`. Then confirm nothing outside referenced it:

```bash
grep -rn "AI_MODEL" --include=*.ts --include=*.tsx . | grep -v docs/
```

Expected: no hits outside `lib/ai`. Remove its re-export from `lib/ai/index.ts` too.

- [ ] **Step 3: Convert `content.test.ts` to the fake provider**

Same rule as Task 9: keep business-logic assertions (transcript capping + the truncation note, "exactly 3" prompt wording, `source: "ai_generated"`, `model` propagation); delete Anthropic body-shape assertions (they moved to the adapter test in Task 6).

- [ ] **Step 4: Run the tests**

Run: `npx vitest run lib/ai && npm run typecheck`
Expected: PASS, and typecheck now clean again (Task 6 Step 5's expected breakage is resolved).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/summary.ts lib/ai/examples.ts lib/ai/content.test.ts lib/ai/run.ts lib/ai/constants.ts lib/ai/index.ts lib/ai/errors.ts lib/ai/providers/anthropic.ts
git commit -m "refactor(ai): summary + examples speak the port

Relocates toAiError into the Anthropic adapter now that no feature module
imports it, leaving errors.ts free of any SDK import. Drops AI_MODEL: tier maps
to a model inside each adapter now. Business logic (transcript capping, prompt
wording, AI_SOURCE labelling) is unchanged."
```

---

### Task 11: Delete `client.ts` and retire `isAiConfigured`

**Files:**
- Delete: `lib/ai/client.ts`
- Modify: `lib/ai/index.ts`, `lib/data/vocab-examples.ts:75`, `lib/data/video-summary.ts:77`, `lib/data/conversation.ts:181`, `lib/data/conversation.ts:252`

**Interfaces:**
- Consumes: `isAiEnabled` (Task 8).
- Produces: `@/lib/ai` exports `isAiEnabled` in place of `isAiConfigured`.

`isAiConfigured()` inferred capability from key presence — exactly what D1 abolishes. The **503 behaviour at all four call sites must not change**: each keeps `return { ok: false, status: 503 }`.

- [ ] **Step 1: Update the barrel**

In `lib/ai/index.ts`: remove `export { isAiConfigured } from "./client";`, add `export { isAiEnabled, setProviderForTesting } from "./registry";`, and remove `AI_MODEL` from the constants re-export.

- [ ] **Step 2: Update the four call sites**

Each is a one-line swap, e.g. in `lib/data/vocab-examples.ts`:

```ts
import { AiError, generateExamples, isAiEnabled, type JlptLevel } from "@/lib/ai";
// ...
if (!isAiEnabled()) return { ok: false, status: 503 };
```

Apply the same change at `lib/data/video-summary.ts:77`, `lib/data/conversation.ts:181`, and `lib/data/conversation.ts:252`.

- [ ] **Step 3: Delete `client.ts`**

```bash
git rm lib/ai/client.ts
grep -rn "isAiConfigured\|from \"./client\"\|lib/ai/client" --include=*.ts --include=*.tsx .
```

Expected: no hits outside docs.

- [ ] **Step 4: Run the full suite**

Run: `npm test && npm run typecheck && npm run lint`
Expected: **all tests pass** (count ≥ 1098 plus this plan's new tests). Any 503-related suite that goes red means behaviour drifted — fix the code, not the test.

- [ ] **Step 5: Commit**

```bash
git add -A lib/ai lib/data
git commit -m "refactor(ai): replace isAiConfigured with registry isAiEnabled

isAiConfigured inferred capability from key presence — the inference that hid a
missing ANTHROPIC_API_KEY until the audit. The four 503 gates keep identical
behaviour; only the question they ask changed."
```

---

### Task 12: `SPEECH_PROVIDER` — the same lifecycle for Azure

Implements the speech half of D9. `isSpeechConfigured()` currently infers from key presence, and Azure's key was the audit's *other* bug.

**Files:**
- Create: `lib/speech-scoring/env.ts`, `lib/speech-scoring/env.test.ts`
- Modify: `lib/speech-scoring/config.ts`, `lib/speech-scoring/config.test.ts`

**Interfaces:**
- Consumes: `EnvSpec` from `@/lib/env/validate`.
- Produces: `speechEnvSpec` (registered by Task 13); `isSpeechEnabled(env?): boolean`.

- [ ] **Step 1: Verify the Azure key's real structure first (V6)**

The user replaced this key after the audit, and it is unverified (spec §7 V6). Same rule as Task 1: **if the real key does not match the rule, the rule is wrong — report, do not force it.**

```bash
cd "C:/Users/tplon/Documents/GitHub/JPWeb/japan-web"
AZ_KEY=$(grep -E '^AZURE_SPEECH_KEY=' .env.local | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')
AZ_REGION=$(grep -E '^AZURE_SPEECH_REGION=' .env.local | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')
echo "length=${#AZ_KEY} region=$AZ_REGION"
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  -H "Ocp-Apim-Subscription-Key: $AZ_KEY" -H "Content-Length: 0" \
  "https://$AZ_REGION.api.cognitive.microsoft.com/sts/v1.0/issueToken"
```

Expected: `200` and `length=32`. The audit's bug was a 36-character GUID (a resource id) returning `401`. If you get `401`, **stop and report** — that is scope B, and Task 12 must not encode a rule around a broken key.

- [ ] **Step 2: Write the failing test**

```ts
// lib/speech-scoring/env.test.ts
import { describe, expect, it } from "vitest";
import { speechEnvSchema } from "./env";

// A fake key matching the verified structure. Never paste the real key here.
const VALID_KEY = "0123456789abcdef0123456789abcdef";

const issues = (env: Record<string, string>) => {
  const parsed = speechEnvSchema.safeParse(env);
  return parsed.success ? [] : parsed.error.issues.map((i) => i.message);
};

describe("speechEnvSchema", () => {
  it("requires SPEECH_PROVIDER — absence of a key is not a decision", () => {
    expect(issues({}).length).toBeGreaterThan(0);
  });

  it("accepts none and demands no credential — the deliberate 503 path (D9)", () => {
    expect(issues({ SPEECH_PROVIDER: "none" })).toEqual([]);
  });

  it("rejects azure without a key", () => {
    expect(issues({ SPEECH_PROVIDER: "azure", AZURE_SPEECH_REGION: "japanwest" }).length)
      .toBeGreaterThan(0);
  });

  it("rejects azure without a region", () => {
    expect(issues({ SPEECH_PROVIDER: "azure", AZURE_SPEECH_KEY: VALID_KEY }).length)
      .toBeGreaterThan(0);
  });

  it("rejects a resource id pasted in place of Key1 — the actual 2026-07-14 audit bug", () => {
    const guid = "8f14e45f-ceea-467a-9c1e-2b3f4d5a6b7c"; // 36 chars, what was really pasted
    const found = issues({
      SPEECH_PROVIDER: "azure",
      AZURE_SPEECH_KEY: guid,
      AZURE_SPEECH_REGION: "japanwest",
    });
    expect(found.length).toBeGreaterThan(0);
    expect(found.join(" ")).not.toContain(guid); // redaction contract (Task 3)
  });

  it("accepts a well-formed azure configuration", () => {
    expect(
      issues({ SPEECH_PROVIDER: "azure", AZURE_SPEECH_KEY: VALID_KEY, AZURE_SPEECH_REGION: "japanwest" }),
    ).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `npx vitest run lib/speech-scoring/env.test.ts`
Expected: FAIL — cannot resolve `./env`.

- [ ] **Step 4: Implement `lib/speech-scoring/env.ts`**

```ts
// lib/speech-scoring/env.ts
/**
 * Speech provider selection and credential structure.
 *
 * This is the SAME provider lifecycle as lib/ai/env.ts, not a coincidental
 * resemblance (Spec D9): selection is explicit and required; `none` means
 * INTENTIONALLY DISABLED and preserves the SpeechNotConfiguredError → 503 path;
 * a named provider with missing or structurally invalid configuration is a
 * startup failure. A third subsystem should inherit this shape, not invent one.
 */
import { z } from "zod";
import type { EnvSpec } from "@/lib/env/validate";

export type SpeechProviderName = "none" | "azure";

/**
 * Azure Speech Key1/Key2 are 32 hex characters. The 2026-07-14 audit found a
 * 36-character GUID here — the resource id, copied instead of the key — which
 * returned 401 and silently killed TTS, STT, pronunciation scoring and the pitch
 * reference. Verified against the live key in Step 1 (spec §7 V6).
 */
const AZURE_KEY_PATTERN = /^[0-9a-f]{32}$/i;

export const speechEnvSchema = z
  .object({
    SPEECH_PROVIDER: z.enum(["none", "azure"]),
    AZURE_SPEECH_KEY: z.string().optional(),
    AZURE_SPEECH_REGION: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.SPEECH_PROVIDER === "none") return; // Intentionally disabled.

    const fail = (message: string, path: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });

    if (!env.AZURE_SPEECH_KEY) {
      fail(
        "AZURE_SPEECH_KEY is required (SPEECH_PROVIDER=azure). It is never " +
          "inferred — see .env.local.example.",
        "AZURE_SPEECH_KEY",
      );
    } else if (!AZURE_KEY_PATTERN.test(env.AZURE_SPEECH_KEY)) {
      fail(
        "AZURE_SPEECH_KEY does not match the documented key structure " +
          "(expected 32 hexadecimal characters — Key1/Key2 from the Azure " +
          "portal, not the resource id).",
        "AZURE_SPEECH_KEY",
      );
    }

    if (!env.AZURE_SPEECH_REGION) {
      fail(
        "AZURE_SPEECH_REGION is required (SPEECH_PROVIDER=azure).",
        "AZURE_SPEECH_REGION",
      );
    }
  });

export type SpeechEnvShape = z.infer<typeof speechEnvSchema>;

/** Whether speech is intentionally enabled. Never inferred from key presence. */
export function isSpeechEnabled(env: EnvSource = process.env): boolean {
  return env.SPEECH_PROVIDER === "azure";
}

/** Registered at startup by `instrumentation.ts` (Task 13). */
export const speechEnvSpec: EnvSpec<SpeechEnvShape> = {
  name: "speech",
  schema: speechEnvSchema,
};
```

- [ ] **Step 5: Rewire `config.ts`**

```ts
/**
 * `isSpeechConfigured` used to infer "speech is on" from key presence. That
 * inference is what let an invalid AZURE_SPEECH_KEY (a resource id, not Key1)
 * sit live until the 2026-07-14 audit. Intent now comes from SPEECH_PROVIDER
 * (Spec D9); structure is validated at startup.
 */
export function isSpeechConfigured(): boolean {
  return isSpeechEnabled();
}
```

Keep the exported name `isSpeechConfigured` so its callers and the existing `config.test.ts` keep working, and keep `speechCredentials()` as-is: `SpeechNotConfiguredError` remains the 503 path.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run lib/speech-scoring && npm run typecheck`
Expected: PASS. `config.test.ts`, `tts.test.ts`, `stt.test.ts` and `pronunciation.test.ts` all set `AZURE_SPEECH_KEY`/`AZURE_SPEECH_REGION` directly and will now also need `SPEECH_PROVIDER` in their env setup — **update the setup, not the expectations.** If an expectation has to move, behaviour drifted: stop and reconsider.

- [ ] **Step 7: Commit**

```bash
git add lib/speech-scoring
git commit -m "feat(speech): SPEECH_PROVIDER — same provider lifecycle as AI

none = intentionally disabled, keeps the 503 path; azure validates Key1's
documented structure at startup, catching the 36-char GUID the audit found. One
lifecycle, two subsystems (Spec D9)."
```

---

### Task 13: Wire startup validation

**Files:**
- Create: `instrumentation.ts`
- Modify: `next.config.mjs`, `.env.local.example`, `.env.local` (local only, never committed)

**Interfaces:**
- Consumes: `validateEnv`, `registerEnvSpec` (Task 3); `aiEnvSpec` (Task 8); `speechEnvSpec` (Task 12).
- Produces: startup validation, running once before the first request.

> The requirement is *"validate exactly once before the app serves its first request"*; `instrumentation.ts` is only the current mechanism (Spec §5.1). Keep `validateEnv()` free of Next imports so the hook can be swapped without touching the architecture.

Both specs already carry their own schema and policy (Tasks 8 and 12). This task only wires them up — it writes no policy of its own.

- [ ] **Step 1: Enable the hook**

```js
// next.config.mjs
const nextConfig = {
  reactStrictMode: true,
  experimental: { instrumentationHook: true },
  images: { /* unchanged */ },
};
```

- [ ] **Step 2: Write `instrumentation.ts`**

```ts
/**
 * Startup configuration validation.
 *
 * MECHANISM ONLY. The requirement is that validation runs exactly once before
 * the app serves its first request (Spec §5.1); this hook is today's way of
 * meeting it. `validateEnv()` imports nothing from Next and is memoized, so
 * this file can be replaced without touching the architecture.
 */
import { registerEnvSpec, validateEnv } from "@/lib/env/validate";

export async function register() {
  // The hook also runs on the edge runtime, where these server-only modules
  // must not load.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { aiEnvSpec } = await import("@/lib/ai/registry");
  const { speechEnvSpec } = await import("@/lib/speech-scoring/env");

  registerEnvSpec(aiEnvSpec);
  registerEnvSpec(speechEnvSpec);
  validateEnv();
}
```

- [ ] **Step 3: Update `.env.local` and `.env.local.example`**

Add the three new required variables to both, with comments explaining the policy. `.env.local.example` carries no real values:

```bash
# Deployment environment. Required, never inferred: `next build` is NODE_ENV=production
# even on a laptop, so NODE_ENV cannot express this. Also gates PayOS sandbox vs live (L8).
APP_ENV=dev

# Which AI provider to use. Required. `none` = intentionally disabled (features return 503).
# `gemini` is DEV ONLY — its free tier permits training on submitted data, so it must never
# see real user data (CLAUDE.md §2). APP_ENV=production + gemini fails at startup.
AI_PROVIDER=none
# ANTHROPIC_API_KEY=
# GEMINI_API_KEY=
# GEMINI_MODEL_FAST=
# GEMINI_MODEL_DEEP=

# Which speech provider to use. Required. `none` = intentionally disabled (503).
SPEECH_PROVIDER=none
```

In the real `.env.local`, set `APP_ENV=dev`, `AI_PROVIDER=gemini` (with the verified key + the Task 1 model id in both `GEMINI_MODEL_FAST`/`GEMINI_MODEL_DEEP`), and `SPEECH_PROVIDER=azure`. Replace the old single `GEMINI_MODEL` variable. **Never commit `.env.local`.**

- [ ] **Step 4: Verify startup actually fails on bad config**

```bash
npm run build
APP_ENV=production AI_PROVIDER=gemini npx next start
```

Expected: `next start` **exits with the aggregated `EnvValidationError`**, naming the production+Gemini violation and printing **no key values**. Then confirm the good path:

```bash
npm run dev
```

Expected: boots. Record in spec §7 row V4 whether validation ran at boot or on first request under `next dev` — that is the fact the spec says not to assume.

- [ ] **Step 5: Commit**

```bash
git add instrumentation.ts next.config.mjs .env.local.example docs/superpowers/specs/2026-07-15-ai-provider-abstraction-design.md
git commit -m "feat(env): validate configuration once at startup

Misconfiguration now fails at boot instead of surfacing as a runtime 503 on
whichever route happens to need it — the failure mode that hid both audit bugs.
Capability gaps are reported in the same aggregated report. Records V4."
```

---

### Task 14: The admin liveness health check

Presence and structure are checked offline at startup; **liveness is checked only here, on demand** — boot must never depend on a third party's uptime (Spec D2).

**Files:**
- Create: `app/api/admin/health/route.ts`, `lib/admin/health.ts`, `lib/admin/health.test.ts`

**Interfaces:**
- Consumes: `requireAdmin` from `lib/admin/guard.ts`; `getProvider`, `isAiEnabled` (Task 8); `isSpeechConfigured` (Task 12).
- Produces: `GET /api/admin/health` → `{ ai: SubsystemHealth; speech: SubsystemHealth }` where `SubsystemHealth = { status: "ok" | "disabled" | "error"; detail?: string }`.

- [ ] **Step 1: Write the failing test**

Logic lives in `lib/admin/health.ts`; the route stays thin and untested (repo convention).

```ts
// lib/admin/health.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { AiError } from "@/lib/ai";
import { setProviderForTesting } from "@/lib/ai/registry";
import { createFakeProvider } from "@/lib/ai/providers/fake";
import { checkAiHealth } from "./health";

const enabled = { APP_ENV: "dev", AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "sk-ant-x" };

beforeEach(() => setProviderForTesting(null));

describe("checkAiHealth", () => {
  it("reports disabled without touching the network when AI is intentionally off", async () => {
    const fake = createFakeProvider();
    setProviderForTesting(fake.provider);
    // Nothing queued: if a call were attempted, the fake would throw.
    expect(await checkAiHealth({ APP_ENV: "dev", AI_PROVIDER: "none" })).toEqual({
      status: "disabled",
    });
    expect(fake.requests).toHaveLength(0);
  });

  it("reports ok when the provider answers", async () => {
    const fake = createFakeProvider();
    fake.queueText("pong");
    setProviderForTesting(fake.provider);
    expect(await checkAiHealth(enabled)).toEqual({ status: "ok" });
  });

  it("reports the error kind, not the message", async () => {
    const fake = createFakeProvider();
    // A realistic upstream error whose message embeds the credential.
    fake.queueError(new AiError("auth", "401 unauthorized for key sk-ant-SECRET123"));
    setProviderForTesting(fake.provider);

    const result = await checkAiHealth(enabled);
    expect(result).toEqual({ status: "error", detail: "auth" });
    expect(JSON.stringify(result)).not.toContain("sk-ant-SECRET123");
  });

  it("maps an unexpected throw to error without leaking it", async () => {
    const fake = createFakeProvider();
    fake.queueError(new Error("connect ECONNREFUSED 10.0.0.1:443"));
    setProviderForTesting(fake.provider);

    const result = await checkAiHealth(enabled);
    expect(result.status).toBe("error");
    expect(JSON.stringify(result)).not.toContain("10.0.0.1");
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run lib/admin/health.test.ts`
Expected: FAIL — cannot resolve `./health`.

- [ ] **Step 3: Implement**

```ts
// lib/admin/health.ts
/**
 * On-demand liveness. Startup validates credential STRUCTURE offline; only this
 * endpoint proves a credential actually works — catching revoked keys, wrong
 * regions and spent quota. It is deliberately NOT wired into startup: boot must
 * never depend on a third party's uptime (Spec D2).
 *
 * `detail` carries the error KIND only. Upstream messages can embed credentials,
 * and this response is rendered in an admin UI.
 */
import { AiError } from "@/lib/ai/errors";
import { getProvider, isAiEnabled } from "@/lib/ai/registry";
import { isSpeechConfigured } from "@/lib/speech-scoring";

export interface SubsystemHealth {
  status: "ok" | "disabled" | "error";
  /** Error kind only — never an upstream message. */
  detail?: string;
}

export async function checkAiHealth(
  env: EnvSource = process.env,
): Promise<SubsystemHealth> {
  if (!isAiEnabled(env)) return { status: "disabled" };

  try {
    await getProvider(env).generateText({
      tier: "fast",
      reasoning: false,
      maxTokens: 1,
      system: [{ text: "health check", cacheable: false }],
      messages: [{ role: "user", content: "ping" }],
    });
    return { status: "ok" };
  } catch (err) {
    return {
      status: "error",
      detail: err instanceof AiError ? err.kind : "unknown",
    };
  }
}

export async function checkSpeechHealth(): Promise<SubsystemHealth> {
  if (!isSpeechConfigured()) return { status: "disabled" };

  const { speechCredentials } = await import("@/lib/speech-scoring/config");
  try {
    const { key, region } = speechCredentials();
    const response = await fetch(
      `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      { method: "POST", headers: { "Ocp-Apim-Subscription-Key": key } },
    );
    return response.ok ? { status: "ok" } : { status: "error", detail: `http_${response.status}` };
  } catch {
    return { status: "error", detail: "request" };
  }
}

export async function checkHealth(): Promise<{ ai: SubsystemHealth; speech: SubsystemHealth }> {
  // allSettled: one subsystem's failure must not mask the other's report.
  const [ai, speech] = await Promise.allSettled([checkAiHealth(), checkSpeechHealth()]);
  const unwrap = (r: PromiseSettledResult<SubsystemHealth>): SubsystemHealth =>
    r.status === "fulfilled" ? r.value : { status: "error", detail: "unknown" };
  return { ai: unwrap(ai), speech: unwrap(speech) };
}
```

- [ ] **Step 4: Write the route**

```ts
// app/api/admin/health/route.ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { checkHealth } from "@/lib/admin/health";

export async function GET() {
  // requireAdmin(), not isAdmin(): the ADMIN_EMAILS bootstrap promotion only
  // fires inside requireAdmin (see project conventions).
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
  return NextResponse.json(await checkHealth());
}
```

Read `lib/admin/guard.ts` first and match its real return shape.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run lib/admin/health.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/admin/health.ts lib/admin/health.test.ts "app/api/admin/health/route.ts"
git commit -m "feat(admin): on-demand provider liveness health check

Catches what structural validation cannot — revoked keys, wrong region, spent
quota — without making boot depend on a third party's uptime."
```

---

### Task 15: Lint the abstraction shut

Without this, the abstraction decays the first time someone imports the SDK directly (Spec §5.6: "the one-line test for whether this abstraction is real").

**Files:**
- Modify: `.eslintrc.json` (or the repo's existing ESLint config file)

- [ ] **Step 1: Add the restriction**

```json
{
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": [{
        "group": ["@anthropic-ai/sdk", "@anthropic-ai/sdk/*", "@google/genai"],
        "message": "Provider SDKs may only be imported inside lib/ai/providers/. Application code speaks the port (lib/ai/port.ts). See docs/superpowers/specs/2026-07-15-ai-provider-abstraction-design.md."
      }]
    }]
  },
  "overrides": [{
    "files": ["lib/ai/providers/*.ts", "test/claude-mock.ts"],
    "rules": { "no-restricted-imports": "off" }
  }]
}
```

Read the existing config first and merge into it rather than replacing it.

- [ ] **Step 2: Prove the rule is real**

Run: `npm run lint`
Expected: clean. Then temporarily add `import Anthropic from "@anthropic-ai/sdk";` to `lib/ai/summary.ts`, re-run `npm run lint`, and confirm it **errors**. Remove the line. A rule that never fires is not a rule.

- [ ] **Step 3: Full verification**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: all green; test count ≥ 1098 plus this plan's additions.

- [ ] **Step 4: Commit**

```bash
git add .eslintrc.json
git commit -m "chore(lint): forbid provider SDK imports outside lib/ai/providers

Makes the abstraction enforceable rather than aspirational."
```

---

## Verification checklist

Before calling this plan done:

- [ ] `npm test` — all green, count ≥ 1098
- [ ] `npm run typecheck` — clean
- [ ] `npm run lint` — clean
- [ ] `npm run build` — succeeds
- [ ] `grep -rn "@anthropic-ai/sdk\|@google/genai" lib app --include=*.ts --include=*.tsx | grep -v "lib/ai/providers/"` — **no output**
- [ ] `APP_ENV=production AI_PROVIDER=gemini npx next start` — refuses to start, names the §2 violation, prints no key values
- [ ] `AI_PROVIDER=none` — app boots; AI routes return 503 exactly as before
- [ ] Spec §7 rows V1–V5 replaced with verified findings, not assumptions
- [ ] `code-reviewer` has reviewed the diff (CLAUDE.md §9)
