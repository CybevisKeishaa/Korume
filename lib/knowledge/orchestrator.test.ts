import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { createFakeProvider, type FakeProviderHandle } from "@/lib/ai/providers/fake";
import { AiError } from "@/lib/ai/errors";
import type { AiProvider, AiRequest, AiResult } from "@/lib/ai/port";
import { createMemoryKnowledgeStore, type MemoryKnowledgeStore } from "./memory-store";
import { getOrGenerateSection, type GenerateInput } from "./orchestrator";
import { fingerprint } from "./canonical";
import type { KnowledgeConfig } from "./config";
import { KNOWLEDGE_SECTIONS, type SectionDefinition } from "./types";

const CONFIG: KnowledgeConfig = {
  freeSentencesPerDay: 3,
  plusCreditsPerMonth: 1000,
  plusMaxSectionsPerDay: 200,
  askKorumeFreeTurnsPerDay: 10,
  askKorumePlusTurnsPerDay: 100,
  globalBudgetUsdPerDay: 5,
  creditUsdUnit: 0.001,
};
const NOW = new Date("2026-10-02T09:00:00Z");
const USAGE = { model: "claude-haiku-4-5", usage: { inputTokens: 400, outputTokens: 300, cacheReadTokens: 0, cacheWriteTokens: 0 } };
const SENTINEL = "FULL-ONLY-SENTINEL";

const nuanceFull = z.object({ nuance: z.string(), secret: z.string() });
const nuancePreview = z.object({ nuance: z.string() });

function definition(overrides: Partial<SectionDefinition> = {}): SectionDefinition {
  return {
    section: "lite",
    schema: z.object({ summary: z.string() }),
    previewSchema: null,
    schemaVersion: 1,
    generatorVersion: 1,
    contextPolicy: "none",
    access: "free_full",
    maxOutputTokens: { full: 800, preview: null },
    buildPrompt: (input) => ({ system: [{ text: "Explain the sentence.", cacheable: true }], user: `<sentence>${input.sentence}</sentence>` }),
    projectPreview: () => null,
    ...overrides,
  };
}

const LITE = definition();
const NUANCE = definition({
  section: "native_nuance",
  schema: nuanceFull,
  previewSchema: nuancePreview,
  access: "free_preview",
  contextPolicy: "video",
  maxOutputTokens: { full: 900, preview: 200 },
  projectPreview: (full) => ({ nuance: (full as z.infer<typeof nuanceFull>).nuance }),
});
const GLOSS = definition({ section: "word_gloss_vi", access: "system", schema: z.object({ glosses: z.array(z.string()) }) });

let store: MemoryKnowledgeStore;
let fake: FakeProviderHandle;
let provider: AiProvider;

beforeEach(() => {
  store = createMemoryKnowledgeStore(NOW);
  fake = createFakeProvider();
  // The fake answers as provider "none", which has no price; the orchestrator prices the provider it is handed.
  provider = { ...fake.provider, name: "anthropic" };
});

function input(overrides: Partial<GenerateInput> = {}): GenerateInput {
  const sentence = overrides.targetText ?? "今日は雨です。";
  return {
    definition: LITE,
    locale: "vi",
    targetText: sentence,
    contextKey: "",
    parentFingerprint: fingerprint(sentence),
    tier: "plus",
    billing: { scope: "learner", userId: "u-1" },
    promptInput: { sentence, locale: "vi" },
    now: NOW,
    ...overrides,
  };
}

const run = (overrides: Partial<GenerateInput> = {}, deps: Parameters<typeof getOrGenerateSection>[1] = {}) =>
  getOrGenerateSection(input(overrides), { store: store.store, provider, config: CONFIG, aiEnabled: true, ...deps });

describe("getOrGenerateSection", () => {
  it("serves a cache hit with no provider call and no reservation", async () => {
    fake.queueStructured({ summary: "雨" }, USAGE);
    await expect(run()).resolves.toMatchObject({ status: "ready", access: "full", content: { summary: "雨" } });
    const reservations = store.reservations.length;
    await expect(run()).resolves.toEqual({ status: "ready", access: "full", content: { summary: "雨" }, model: "claude-haiku-4-5" });
    expect(fake.requests).toHaveLength(1);
    expect(store.reservations).toHaveLength(reservations);
  });

  it("makes exactly one provider call for ten concurrent misses (single flight)", async () => {
    fake.queueStructured({ summary: "雨" }, USAGE);
    const results = await Promise.all(Array.from({ length: 10 }, () => run()));
    expect(fake.requests).toHaveLength(1);
    expect(results.filter((r) => r.status === "ready")).toHaveLength(1);
    expect(results.filter((r) => r.status === "pending")).toEqual(Array(9).fill({ status: "pending", retryAfterMs: 1500 }));
    expect(store.reservations.filter((r) => r.status === "settled")).toHaveLength(1);
  });

  it("charges a Free learner one daily slot for all nine sections of a sentence, and refuses a fourth sentence", async () => {
    for (const section of KNOWLEDGE_SECTIONS) {
      fake.queueStructured({ summary: section }, USAGE);
      await expect(run({ tier: "free", definition: definition({ section }) })).resolves.toMatchObject({ status: "ready" });
    }
    expect(store.charges).toHaveLength(1);
    for (const sentence of ["二つ目。", "三つ目。"]) {
      fake.queueStructured({ summary: sentence }, USAGE);
      await expect(run({ tier: "free", targetText: sentence })).resolves.toMatchObject({ status: "ready" });
    }
    await expect(run({ tier: "free", targetText: "四つ目。" })).resolves.toEqual({
      status: "quota_exhausted", resetsAt: "2026-10-03T00:00:00.000Z",
    });
    expect(store.charges).toHaveLength(3);
    expect(fake.requests).toHaveLength(11);
  });

  it("charges Plus credits from the real cost and returns the unused upper bound", async () => {
    fake.queueStructured({ summary: "雨" }, USAGE);
    await run();
    // 400 in × $1/M + 300 out × $5/M = $0.0019 → 2 credits at $0.001.
    expect(store.charges).toEqual([expect.objectContaining({ credits: 2, entitlementKind: "plus_section" })]);
    expect(store.budgetFor(NOW)).toEqual({ reservedUsd: 0, spentUsd: 0.0019 });
  });

  it("releases on a provider error, backs off, and does not call the provider inside the backoff", async () => {
    fake.queueError(new AiError("unavailable", "overloaded"));
    await expect(run()).resolves.toEqual({ status: "ai_unavailable", reason: "provider" });
    expect(store.reservations.map((r) => r.status)).toEqual(["released"]);
    const [entry] = [...store.entries.values()];
    expect(entry).toMatchObject({ status: "failed", errorCode: "provider_error", retryAfter: new Date(NOW.getTime() + 30_000) });
    expect(store.generations).toEqual([expect.objectContaining({ outcome: "provider_error", estimatedCostUsd: 0 })]);

    await expect(run()).resolves.toEqual({ status: "ai_unavailable", reason: "backoff" });
    expect(fake.requests).toHaveLength(1);
    expect(store.charges).toHaveLength(0);
  });

  it("keeps a validation error's spend on the budget but never charges the learner", async () => {
    fake.queueStructured({ wrong: true }, USAGE);
    await expect(run({ tier: "free" })).resolves.toEqual({ status: "ai_unavailable", reason: "provider" });
    const [generation] = store.generations;
    expect(generation).toMatchObject({ outcome: "validation_error" });
    expect(generation?.estimatedCostUsd).toBeGreaterThan(0);
    expect(store.reservations.map((r) => r.status)).toEqual(["released"]);
    expect(store.budgetFor(NOW)).toEqual({ reservedUsd: 0, spentUsd: generation?.estimatedCostUsd });
    expect(store.charges).toHaveLength(0);
    expect([...store.entries.values()][0]).toMatchObject({ status: "failed", errorCode: "validation_error" });
  });

  it("lets a stale leader neither overwrite the new leader's content nor charge twice", async () => {
    const gate = controllableProvider();
    const first = getOrGenerateSection(input(), { store: store.store, provider: gate.provider, config: CONFIG, aiEnabled: true });
    await gate.called(1);
    store.advance(120_000); // the first leader's lease expires while its provider call hangs
    const second = getOrGenerateSection(input(), { store: store.store, provider: gate.provider, config: CONFIG, aiEnabled: true });
    await gate.called(2);
    gate.resolve(1, { summary: "second" });
    await expect(second).resolves.toMatchObject({ status: "ready", content: { summary: "second" } });
    gate.resolve(0, { summary: "stale" });
    await expect(first).resolves.toMatchObject({ status: "ready", content: { summary: "second" } });

    expect([...store.entries.values()][0]).toMatchObject({ status: "ready", content: { summary: "second" } });
    expect(store.charges).toHaveLength(1);
    expect(store.reservations.map((r) => r.status).sort()).toEqual(["released", "settled"]);
    expect(store.budgetFor(store.now()).spentUsd).toBeCloseTo(0.0038, 9); // both calls really cost money
  });

  it("refuses to generate when AI is disabled, before any reservation, and still serves the cache", async () => {
    fake.queueStructured({ summary: "雨" }, USAGE);
    await run();
    const reservations = store.reservations.length;
    await expect(run({}, { aiEnabled: false })).resolves.toMatchObject({ status: "ready", content: { summary: "雨" } });
    await expect(run({ targetText: "新しい文。" }, { aiEnabled: false })).resolves.toEqual({ status: "ai_unavailable", reason: "disabled" });
    expect(store.reservations).toHaveLength(reservations);
    expect(store.entries.size).toBe(1);
  });

  it("frees the lease when the budget refuses, so the entry is retryable at once", async () => {
    await expect(run({}, { config: { ...CONFIG, globalBudgetUsdPerDay: 0.000001 } })).resolves.toEqual({
      status: "ai_unavailable", reason: "budget",
    });
    expect(fake.requests).toHaveLength(0);
    fake.queueStructured({ summary: "雨" }, USAGE);
    await expect(run()).resolves.toMatchObject({ status: "ready" });
  });

  it("projects a cached full entry for Free on the server and never returns the full object", async () => {
    fake.queueStructured({ nuance: "やわらかい", secret: SENTINEL }, USAGE);
    await run({ definition: NUANCE });
    const free = await run({ definition: NUANCE, tier: "free" });
    expect(free).toMatchObject({ status: "ready", access: "preview", content: { nuance: "やわらかい" } });
    expect(JSON.stringify(free)).not.toContain(SENTINEL);
    expect(fake.requests).toHaveLength(1);
  });

  it("generates only the preview variant for Free when nothing is cached", async () => {
    fake.queueStructured({ nuance: "やわらかい" }, USAGE);
    await expect(run({ definition: NUANCE, tier: "free" })).resolves.toMatchObject({ status: "ready", access: "preview" });
    expect(fake.requests[0]?.maxTokens).toBe(200);
    expect([...store.entries.values()][0]).toMatchObject({ key: expect.objectContaining({ contentVariant: "preview" }) });
    expect(store.charges).toEqual([expect.objectContaining({ entitlementKind: "free_sentence" })]);
  });

  it("bills a system section to the system scope with no entitlement and no charge", async () => {
    fake.queueStructured({ glosses: ["mưa"] }, USAGE);
    await run({ definition: GLOSS, billing: { scope: "system", userId: "u-1" } });
    expect(store.reservations).toEqual([expect.objectContaining({ billingScope: "system", entitlementKind: null })]);
    expect(store.charges).toHaveLength(0);
  });

  it("asks the fast tier without reasoning and keeps the sentence in the user turn", async () => {
    fake.queueStructured({ summary: "雨" }, USAGE);
    await run();
    expect(fake.requests[0]).toMatchObject({ tier: "fast", reasoning: false, maxTokens: 800 });
    expect(fake.requests[0]?.messages).toEqual([{ role: "user", content: "<sentence>今日は雨です。</sentence>" }]);
  });
});

describe("memory-store", () => {
  it("is imported by tests only", () => {
    const importers: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name.startsWith(".")) continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && name !== "memory-store.ts" && readFileSync(path, "utf8").includes("memory-store")) importers.push(path);
      }
    };
    for (const root of ["app", "lib", "components"]) walk(join(process.cwd(), root));
    expect(importers).toEqual([]);
  });
});

/** A provider whose calls hang until the test resolves them, in call order. */
function controllableProvider() {
  const pending: { resolve: (value: AiResult & { parsed: unknown }) => void }[] = [];
  const waiters: { count: number; resolve: () => void }[] = [];
  const provider: AiProvider = {
    name: "anthropic",
    capabilities: fake.provider.capabilities,
    generateText: () => Promise.reject(new Error("not used")),
    generateStructured<T>(_req: AiRequest) {
      return new Promise<AiResult & { parsed: T }>((resolve) => {
        pending.push({ resolve: resolve as (value: AiResult & { parsed: unknown }) => void });
        for (const waiter of waiters.filter((w) => pending.length >= w.count)) waiter.resolve();
      });
    },
  };
  return {
    provider,
    called: (count: number) => new Promise<void>((resolve) => {
      if (pending.length >= count) resolve();
      else waiters.push({ count, resolve });
    }),
    resolve: (index: number, parsed: unknown) => pending[index]?.resolve({ parsed, truncated: false, ...USAGE }),
  };
}
