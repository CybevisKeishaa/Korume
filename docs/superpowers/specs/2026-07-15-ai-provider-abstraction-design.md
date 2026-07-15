# Spec A — AI Provider Abstraction & Startup Configuration Validation

> **Status:** Design approved (2026-07-15). Not implemented. No code changed yet.
> **Scope:** Make `lib/ai` provider-agnostic, and make configuration errors fail at startup
> instead of at request time. Prerequisite for Layer 8.
> **Related:** root `CLAUDE.md` §2 (non-negotiables) · `docs/product/business-model.md`
> (Positioning — "model-independent"; Knowledge Economy; model tiering) ·
> Serena `mem:product_readiness_audit_2026-07-14` (the two env bugs that motivate this) ·
> Serena `mem:design_checkpoint_ai_provider_abstraction_2026-07-15` (brainstorm trail).
> **Scope split:** This is **A** of A/B/C/D. B = pre-L8 blockers (transcript UI, GDPR delete,
> key verification, register-page copy). C = Layer 8 core. D = almostgone.vn deploy.

---

## 1. Problem

Two failures, one root cause.

**Product debt.** `business-model.md` (Positioning) promises the product is *model-independent*
— "AI Sensei is ONE component… Claude/GPT/Gemini". The code contradicts this: `lib/ai` is
100% Anthropic SDK, and `getClient()` reads `ANTHROPIC_API_KEY` directly. Layer 8 builds model
tiering (Haiku for cacheable, Opus for conversation), the Knowledge Economy cache, and the
automatic kill-switch — **all of which live inside the AI layer**. Building those on a hardcoded
Anthropic client means building them twice.

**Configuration debt.** The 2026-07-14 audit found two env bugs that had been silently live:
`ANTHROPIC_API_KEY` absent (all Claude features dead), and `AZURE_SPEECH_KEY` present but
invalid — a resource ID pasted instead of Key1 (401 from Azure; JLPT listening, pronunciation
scoring, voice mode, and pitch reference all dead). Both surfaced only as runtime 5xx on the
affected route. Nothing failed at boot. Nobody noticed for weeks.

The two are the same problem: **the app infers its own capabilities from whichever keys happen
to be present, and degrades quietly when it guesses wrong.**

Current state (verified 2026-07-15): `ANTHROPIC_API_KEY` is gone from `.env.local`; the user
replaced it with Gemini free-tier variables. **All AI features are therefore off right now.**
The app does not run Gemini — Gemini and PayOS exist in `.env.local` only and are wired into
zero lines of code.

---

## 2. Principles

Stated by the user; these govern every decision below.

> **Explicit configuration. Fail fast. Never infer. Never silently fall back.**

- Provider is selected by an explicit variable — **never** inferred from which keys exist.
- The app never changes provider by itself.
- A provider that violates deployment policy **fails loudly at startup**.

And the scope constraint, stated during design review:

> **This abstraction must not narrow the product.** Capabilities may be temporarily unavailable
> because a provider is intentionally `none`, or unimplemented during development. Those are
> **implementation deferrals, not product decisions**. The port is designed around the long-term
> product defined by the specification — **not around Gemini Free**. When a production provider
> is enabled later, every planned AI capability must be reachable **without another architectural
> redesign**.

Corollary, applied throughout: **requirement ≠ implementation.** The spec fixes invariants; it
names current mechanisms as current, so they can be replaced without touching the architecture.

---

## 3. Non-goals (explicitly out of scope for Spec A)

| Out of scope | Where it belongs |
| --- | --- |
| PayOS env registration | Layer 8 (C) — PayOS is wired into zero lines today; requiring its env now would break boot for machines that legitimately lack the keys |
| Knowledge Economy cache; per-user Knowledge-Gen quota; automatic kill-switch | Layer 8 (C) — they consume this abstraction, they are not part of it |
| Switching production to Anthropic | Blocked: the user has no Anthropic key |
| Verifying `GEMINI_API_KEY` / `AZURE_SPEECH_KEY` liveness; transcript-ingestion UI; GDPR delete-my-data; register-page "7-day trial" copy | Scope B (pre-L8 blockers) |
| Streaming responses | Not required by the specification (see D8) |
| Registering Supabase env in the validator | **Removed from scope during planning (2026-07-15).** Supabase is not a swappable provider, had no audit bug, and `lib/env.ts` already ships `hasPublicSupabaseEnv()` — a deliberate degrade ("lets the app run (marketing + auth pages) before .env.local exists, instead of crashing every route", used by `app/(app)/layout.tsx`, `app/(admin)/admin/layout.tsx`, `lib/supabase/middleware.ts`). Requiring Supabase env at startup would destroy that shipped decision — the same collision D9 caught for speech. The shared runner remains open for Supabase to register later if ever wanted |
| Changing `CLAUDE.md` §2 | §2 stands unchanged. Gemini is a dev-only provider *because* of §2, not an exception to it |

---

## 4. Decisions

| # | Decision |
| --- | --- |
| D1 | Two distinct failure modes: `none` = intentionally disabled → keep the existing 503 path. A named provider with missing/invalid config → **startup failure**. |
| D2 | Startup performs **structural validation** (offline, deterministic). Real liveness is an **on-demand admin health check**, never a boot dependency. |
| D3 | One shared env-validation module; each consumer **registers its own schema**. |
| D4 | The port takes an application-level **tier (`fast` \| `deep`)**, never a provider model id. |
| D5 | The Gemini adapter uses the `@google/genai` SDK. |
| D6 | Feature tests run against a **fake provider**; provider-shape assertions move to **adapter tests**. |
| D7 | An explicit **`APP_ENV`** enforces the dev/prod boundary — `NODE_ENV` alone is insufficient. |
| D8 | **No streaming** in the port. |
| D9 | **`SPEECH_PROVIDER`** mirrors `AI_PROVIDER` exactly — one provider lifecycle, two subsystems. |

### D1 — Two failure modes, not one

"Misconfigured" and "deliberately off" are different states that today's code collapses into one.
That collapse is precisely what hid the missing `ANTHROPIC_API_KEY` from the team until an audit
found it: a 503 saying "not configured" is indistinguishable from a 503 saying "we meant to
turn this off".

Splitting them satisfies fail-fast **without deleting a deliberate, shipped, well-tested
architecture** (`AiNotConfiguredError`, `lib/http-status.ts`, the session-level no-retry memory in
`components/conversation/message-bubble.tsx` and `components/jlpt/jlpt-listening-play-button.tsx`,
and ~10 test files).

The payoff is that the 503 path becomes **more honest than it is today**, not merely preserved:

> After this change, `not_configured` has exactly one meaning: **intentionally disabled**.
> A missing or structurally invalid key can no longer reach that path — it crashes at boot.

**This is load-bearing for the first deploy.** The user has no Anthropic key. `almostgone.vn`
will therefore launch with `APP_ENV=production` + `AI_PROVIDER=none` — production with all AI
intentionally off, deployable today. That must be a conscious launch decision, not a discovery
made after deploying.

### D2 — Structural validation at startup; liveness on demand

Presence checking alone would not have caught **either** audit bug: both keys existed, they were
merely wrong. Both, however, were detectable **offline** from their structure.

Startup validation MUST therefore verify **stable, documented structural markers** of each
credential — not merely that the variable is non-empty. The spec deliberately does not mandate
*which* marker or *which* technique: the current implementation may use prefix checks; the
requirement is only that the marker be stable and documented, so the implementation can evolve
without changing the architecture.

Liveness (revoked key, wrong region, exhausted quota) is verified by an **on-demand** admin
health check — `GET /api/admin/health` behind `requireAdmin()`, calling the configured providers
for real and reporting per-subsystem status.

**Boot must never depend on a third party's uptime.** A startup liveness probe would convert an
Anthropic or Azure outage into "almostgone.vn cannot restart", and would spend quota on every
boot. Rejected for that reason.

### D3 — Shared validation module, per-consumer schemas

`lib/env/validate.ts` is a shared runner. Each consumer owns and registers its own schema — in
Spec A that is `lib/ai/env.ts` and `lib/speech-scoring/env.ts`. The **extensible thing is the
runner**, not a central list of every variable in the app — so this does not become a god-module,
and PayOS can register itself in Layer 8 by adding one file.

**Registration is opt-in, and Spec A registers only the two audited subsystems.** Supabase is
deliberately not registered (see §3), because a subsystem that ships an intentional
"run without this configured" path must not have that path deleted by making its env mandatory.
D9 states the general rule; §3 records the two subsystems it excludes today.

This is consistent with `CLAUDE.md` §6, which already requires validating every input with zod.
Environment is input.

### D4 — Tier, not model id

`business-model.md` has already decided model tiering: Haiku for Lite/cascade/cacheable work,
Opus for conversation. Tier is therefore **not speculation** — it is a locked product decision,
so YAGNI does not apply.

"Tier" is an **application** concept (cheap-and-cacheable vs deep reasoning). "Model id" is a
**provider** concept. A port that accepts model ids leaks the provider back into application code
— the exact coupling this spec exists to cut — and would force every call site to know which
provider is running in order to pass a valid id.

Each adapter maps tier → model. Gemini mapping both tiers to one dev model is legitimate.

### D5 — Gemini via `@google/genai`

User decision. Accepted trade-off: a production dependency for a provider production does not
use, to be removed when Gemini is dropped. In exchange: reliable structured output and typed
errors, in the provider that will be used daily during development.

> Note: the brainstorm checkpoint claimed raw `fetch` was preferable because it "matches
> `test/claude-mock.ts`". **That argument was wrong and is retracted.** `test/claude-mock.ts`
> mocks at the `fetch` layer by URL pattern, and its own comments state the Anthropic SDK routes
> through global `fetch`; a fetch-level mock therefore works for SDKs and raw fetch alike. See
> V1 for what must actually be verified.

### D6 — Fake provider for features, adapter tests for shapes

`lib/ai/content.test.ts` and `lib/ai/conversation.test.ts` currently assert against **Anthropic
request-body shape** (`output_config`). Those are adapter assertions living in feature tests.
Left alone, swapping providers turns a pile of tests red that have nothing to do with the change.

Feature tests move to a fake provider (they test business logic). The provider-shape assertions
are **moved, not deleted**, into per-adapter tests.

### D7 — `APP_ENV`, explicit

`NODE_ENV` cannot express this: `npm run build` locally is `NODE_ENV=production` and is a
legitimate development workflow.

```
APP_ENV=dev        + AI_PROVIDER=gemini    → OK
APP_ENV=production + AI_PROVIDER=gemini    → STARTUP FAILURE  (CLAUDE.md §2)
APP_ENV=production + AI_PROVIDER=anthropic → OK
APP_ENV=production + AI_PROVIDER=none      → OK (AI intentionally off — the launch state)
APP_ENV unset                              → STARTUP FAILURE  (never infer)
```

**Why this rule exists:** Gemini's free tier permits Google to train on submitted data; the paid
tier does not. Free-tier Gemini must therefore never touch real user data. `CLAUDE.md` §2 makes
this non-negotiable, and the boundary must be **enforced in code, not by human memory** — the
stated risk being "pre-release testing" with real beta users.

Rejected: an `ALLOW_DEV_AI_PROVIDER` escape hatch. `.env` files get copied from dev to prod; a
leftover permission flag is a silent §2 breach. `APP_ENV` fails closed, and misusing it requires
actively asserting a falsehood rather than forgetting to remove a flag.

Rejected: excluding the Gemini adapter from production builds entirely. It would break
`npm run build && npm start` locally — the only way to exercise a production build before deploy.

**Reused in Layer 8:** `APP_ENV` is what will distinguish PayOS sandbox from live keys.

### D8 — No streaming

The specification does not ask for streamed responses, and no call site streams today:
`conversationReply` uses a non-streaming request and the UI waits for the whole reply.

This is **not** in tension with the §2 scope constraint. That constraint forbids narrowing **the
surface the specification defines**; it does not ask for speculative capability. Streaming is not
in that surface, so it is not preserved.

Accepted consequence, recorded deliberately: adding streaming later **will** change the port
signature (`Promise` → `AsyncIterable`) and is therefore exactly the kind of later redesign the
scope constraint otherwise guards against. The user weighed that and chose to keep the port
minimal. If streaming is ever required, reopening the port is the accepted cost.

### D9 — One provider lifecycle, two subsystems

`SPEECH_PROVIDER` is **not a parallel rule that happens to resemble `AI_PROVIDER`**. Both are
instances of a single **provider lifecycle**, which is defined once and inherited:

> **Provider lifecycle.** Selection is explicit and required. `none` means *intentionally
> disabled* → the subsystem's `not_configured` → 503 path. A named provider is validated
> structurally at startup; missing or structurally invalid configuration is a **startup failure**.
> The app never substitutes a different provider.

Instances: `AI_PROVIDER` = `none | anthropic | gemini`; `SPEECH_PROVIDER` = `none | azure`.
A third subsystem inherits the lifecycle rather than inventing one.

This closes a gap found during design review: `lib/speech-scoring` has its own
`SpeechErrorKind.not_configured → 503` path, commented "a normal, expected state today". Had
Azure's env schema simply been made mandatory (D3), a machine without an Azure key would crash at
boot — silently destroying the same deliberate 503 path D1 exists to protect. Conversely,
treating "key absent" as "speech off" would reintroduce **inference** — the very thing that hid
the missing Anthropic key.

---

## 5. Architecture

### 5.1 Startup validation

**Requirement:** environment validation runs **exactly once, before the application serves its
first request**.

**Current implementation:** `instrumentation.ts` (Next 14), which requires
`experimental.instrumentationHook: true` in `next.config.mjs` (verified 2026-07-15: **not
currently present**) and a `NEXT_RUNTIME === "nodejs"` guard, since the hook also runs on edge.

**The mechanism is replaceable; the invariant is not.** To keep it replaceable, `validate()`:

- imports nothing from Next and knows nothing about the framework,
- is **idempotent and memoized**, so calling it twice (HMR, a second hook, a test) is safe,
- is a plain function any startup hook can call in one line.

If `instrumentation.ts` proves limited across runtimes or deployment targets, validation moves to
another hook **without architectural change**.

> Implementation note, unverified: on Next 14.2.35 `instrumentation.ts` may not execute under
> `next dev` until the first request. If so, dev surfaces the crash on first request rather than
> at "ready" — still fail-fast, one beat later. `next start` (production) runs it at boot. See V4.

### 5.2 Env validation module

`lib/env/validate.ts` collects registered `{ name, schema }` specs and validates `process.env`.

**Aggregate every failure; report once.** The audit found *two* bugs simultaneously. Stopping at
the first error means: fix Anthropic → restart → discover Azure → fix → restart. One report shows
everything.

**Never log a credential value.** Messages name the variable and the expectation only — e.g.
`AZURE_SPEECH_KEY: expected <documented structural marker>, got <shape summary>`. Crash logs go to
the host console; printing keys there creates the leak this spec is meant to prevent.

Structural rules live in **one file, each with a documented source and a test** — this is the
file that will produce a false crash if a provider changes its credential format, so it must be
cheap and obvious to fix.

### 5.3 The port

Derived from the real call sites (`conversation.ts`, `summary.ts`, `examples.ts`), not from any
provider's API:

```ts
type Tier = "fast" | "deep";

interface SystemBlock {
  text: string;
  /** Stable prefix → adapter applies provider-native prompt caching. */
  cacheable: boolean;
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

interface AiRequest {
  tier: Tier;
  system: SystemBlock[];
  messages: ConversationTurn[];   // app-level roles: user | ai
  maxTokens: number;
  reasoning: boolean;
}

interface AiResult {
  model: string;            // CLAUDE.md §2.3 traceability — always present
  truncated: boolean;       // hit maxTokens
  usage: TokenUsage | null; // null when the provider does not report it
}

interface AiProvider {
  readonly name: AiProviderName;
  readonly capabilities: Capabilities;
  generateText(req: AiRequest): Promise<AiResult & { text: string }>;
  generateStructured<T>(req: AiRequest, schema: z.ZodType<T>): Promise<AiResult & { parsed: T }>;
}
```

Three shape decisions, each a direct consequence of the §2 scope constraint:

**`system` is an array of blocks with a `cacheable` flag, not a string.** A string would delete
prompt caching from the abstraction — and prompt caching is the cost mechanism the entire
Knowledge Economy rests on. `conversation.ts` already relies on the distinction: a cached frozen
scenario prompt plus an uncached level-guidance block. Providers cache differently; that is
adapter work.

**`usage` is returned even though nothing reads it today.** `business-model.md` sets "AI cost per
active user" and the north-star "Knowledge Reuse Ratio" as KPIs; both need token counts, and
`cacheReadTokens` *is* reuse measured at the AI layer. Omitting it now guarantees the later
redesign this spec's scope constraint forbids.

**`reasoning` is independent of `tier`.** The real call sites prove the axes are orthogonal:
`sessionCorrections` needs reasoning, `conversationReply` does not — and both are conversation.
Folding reasoning into tier would misrepresent at least one existing call site.

### 5.4 Capability declaration

The product declares what it needs; each adapter declares what it has; startup compares.

- `APP_ENV=production` + configured provider lacks a required capability → **startup failure.**
  Real users are never served silently degraded output.
- `APP_ENV=dev` + gap → an explicit **capability-gap report** at startup; the app runs.

This is the scope constraint made mechanical: a provider's limitations become **visible data at
startup**, never a reason to amputate the port. A provider that cannot meet the product's
declared needs cannot reach production.

### 5.5 Error handling

`AiErrorKind` (`not_configured | rate_limited | auth | unavailable | invalid_output | unknown`)
is **already provider-agnostic and does not change**. `lib/http-status.ts` (`aiErrorStatus`,
`speechErrorStatus`) is pure, takes the kind, and **does not change**. The ~10 tests asserting
503 stay green because the kind is unchanged — only the condition that produces it narrows.

`toAiError()` **moves into each adapter**: every adapter maps its own SDK's typed errors onto the
same union. The Anthropic mapping (RateLimitError → AuthenticationError → APIConnectionError →
APIError → AnthropicError base) moves as-is into `providers/anthropic.ts`.

**Breaking detail:** `AiNotConfiguredError`'s message — currently `"AI features are not
configured: ANTHROPIC_API_KEY is not set."` — becomes untrue under Gemini and must change to name
the real cause (`AI_PROVIDER=none`). Tests asserting on `.kind` are unaffected; tests asserting on
the message string will fail and must be audited during implementation.

### 5.6 File layout

```
lib/env.ts        → lib/env/index.ts   [MOVE, git mv] existing requiredEnv/publicEnv/
                                       hasPublicSupabaseEnv, unchanged. `@/lib/env` still
                                       resolves (→ index.ts), so its 6 importers are untouched
lib/env/validate.ts   [NEW]  shared runner (zod, idempotent, memoized, framework-agnostic)
instrumentation.ts    [NEW]  one-line call; current mechanism only
next.config.mjs       + experimental.instrumentationHook: true   [verified absent]

lib/ai/
  env.ts            [NEW]  AI_PROVIDER + APP_ENV policy + per-provider credential schema
  port.ts           [NEW]  AiProvider, Tier, AiRequest, AiResult, Capabilities
  registry.ts       [NEW]  explicit AI_PROVIDER → adapter; no inference, no fallback
  capabilities.ts   [NEW]  REQUIRED_CAPABILITIES (what the product needs)
  errors.ts         KEEP   AiError + AiErrorKind unchanged; toAiError moves out
  constants.ts      CHANGE AI_MODEL → per-adapter tier→model maps; MAX_TOKENS/AI_SOURCE stay
  client.ts         DELETE getClient/isAiConfigured superseded by registry
  run.ts            CHANGE firstText() is Anthropic-shaped → adapter; requireParsed stays
  providers/
    anthropic.ts    [NEW]  SDK + zodOutputFormat + cache_control + thinking + error mapping
    gemini.ts       [NEW]  @google/genai + responseSchema + error mapping
    fake.ts         [NEW]  in-memory: queued responses, recorded requests
  conversation.ts | summary.ts | examples.ts   CHANGE  import the port only

lib/speech-scoring/env.ts     [NEW]     SPEECH_PROVIDER + Azure credential schema
lib/speech-scoring/config.ts  CHANGE    isSpeechConfigured() infers from key presence →
                                        reads SPEECH_PROVIDER (D9); speechCredentials() stays
```

**Also changed, discovered during planning:** `isAiConfigured()` is exported from `@/lib/ai` and
gates the 503 path at four call sites — `lib/data/vocab-examples.ts:75`,
`lib/data/video-summary.ts:77`, `lib/data/conversation.ts:181` and `:252`. It infers from key
presence, which D1 abolishes. It is replaced by an `isAiEnabled()` (`AI_PROVIDER !== "none"`)
exported from the registry; the four call sites keep their exact `return { ok: false, status: 503 }`
behaviour. `isSpeechConfigured()` in `lib/speech-scoring/config.ts` is the same pattern and gets
the same treatment against `SPEECH_PROVIDER`.

**The one-line test for whether this abstraction is real:** after implementation, no file outside
`lib/ai/providers/` imports `@anthropic-ai/sdk` or `@google/genai`. A lint rule should enforce it.

---

## 6. Testing

```
lib/ai/content.test.ts            → fake provider (business logic; provider-shape asserts removed)
lib/ai/conversation.test.ts       → fake provider

lib/ai/providers/anthropic.test.ts  output_config, zodOutputFormat, cache_control, thinking,
                                    tier→model, error mapping   (claude-mock, fetch-level)
lib/ai/providers/gemini.test.ts     responseSchema, tier→model, error mapping

lib/env/validate.test.ts          table-driven per variable: valid | structurally invalid | absent;
                                  aggregates all failures; never emits a credential value
lib/ai/env.test.ts                lifecycle + policy: production+gemini → throw;
                                  APP_ENV unset → throw; none → no credential check;
                                  capability gap: production → throw, dev → report, no throw
lib/speech-scoring/env.test.ts    same lifecycle, SPEECH_PROVIDER instance
```

Baseline to preserve: **1098 unit tests green**. Verify with `npx tsc --noEmit`, `npm test`,
`npm run lint`, `npm run build`.

---

## 7. Must verify during implementation (do not assume)

| # | Item | Why it matters |
| --- | --- | --- |
| V1 | Does `@google/genai` route through global `fetch`? | Decides whether the Gemini mock is fetch-level (like `claude-mock`) or module-level |
| V2 | Which OpenAPI subset does Gemini `responseSchema` accept; does `z.toJSONSchema()` output need massaging? | `schemas.ts` uses `zod/v4`, so `z.toJSONSchema()` exists — **no new dependency needed**. The 3 schemas are flat, all-string, with no unions/refinements/recursion/numeric constraints (a deliberate L4 choice), so translation should be near 1:1 |
| V3 | `GEMINI_API_KEY` liveness and real structure — the current value starts with `AQ.`, not the `AIza` this assistant expects | **Blocks writing the structural rule.** If `AQ.` is legitimate, a rule built on the assistant's assumption would reject a valid key |
| V4 | `instrumentation.ts` behaviour under `next dev` on 14.2.35 | Determines whether dev fails at boot or at first request |
| V5 | `gemini-3.1-flash-lite` exists and is in the free tier | Model id is post-cutoff for this assistant; unverified |
| V6 | `AZURE_SPEECH_KEY` liveness after the user's fix | Audit found it invalid; the fix is unverified (scope B) |

---

## 8. Risks & accepted trade-offs

**A wrong structural rule blocks boot.** This is the cost of fail-fast, accepted knowingly. Two
mitigations: rules stay as loose as possible while still catching known-bad shapes, and they live
in one tested file so a false positive is a one-line fix, not surgery. Describing the requirement
as *structural validation* rather than any specific technique keeps the fix out of the
architecture.

**The Anthropic rule cannot be verified.** The user has no Anthropic key, so its structural marker
will be written from documentation and this assistant's knowledge (cutoff 2026-01) and cannot be
checked against a real key until one is purchased. Treat it as unverified until then; it is the
most likely rule to false-crash.

**A production dependency for a dev-only provider** (D5), to be removed when Gemini is dropped.

**Gemini is temporary and must not leak into product decisions.** `business-model.md` prices at
49k based on real per-active-user AI cost, not a $0 free tier.

**Production launches with AI off.** `AI_PROVIDER=none` until an Anthropic key exists (D1).
