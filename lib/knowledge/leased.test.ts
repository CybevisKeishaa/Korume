import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { createFakeProvider, type FakeProviderHandle } from "@/lib/ai/providers/fake";
import type { AiProvider, AiRequest, AiResult } from "@/lib/ai/port";
import type { KnowledgeConfig } from "./config";
import { FOLLOWER_RETRY_MS, LEASE_SECONDS, runLeasedGeneration, type LeasedGeneration, type LeaseStore } from "./leased";
import { createMemoryKnowledgeStore, createMemoryLeaseStore, type MemoryKnowledgeStore } from "./memory-store";
import type { KnowledgeKey } from "./types";

const CONFIG: KnowledgeConfig = {
  freeSentencesPerDay: 3,
  plusCreditsPerMonth: 1000,
  plusMaxSectionsPerDay: 200,
  askKorumeFreeTurnsPerDay: 10,
  askKorumePlusTurnsPerDay: 100,
  systemGenerationsPerUserPerDay: 100,
  globalBudgetUsdPerDay: 5,
  creditUsdUnit: 0.001,
};
const NOW = new Date("2026-10-04T09:00:00Z");
const USAGE = { model: "claude-haiku-4-5", usage: { inputTokens: 400, outputTokens: 300, cacheReadTokens: 0, cacheWriteTokens: 0 } };
const KEY: KnowledgeKey = {
  fingerprint: "fp-1", section: "lesson_analysis", locale: "vi", contextKey: "video-1",
  schemaVersion: 1, generatorVersion: 1, contentVariant: "full",
};

let store: MemoryKnowledgeStore;
let fake: FakeProviderHandle;
let provider: AiProvider;

beforeEach(() => {
  store = createMemoryKnowledgeStore(NOW);
  fake = createFakeProvider();
  provider = { ...fake.provider, name: "anthropic" };
});

type Done = { ok: true };
function job<K = KnowledgeKey>(overrides: Partial<LeasedGeneration<K, Done>> = {}): LeasedGeneration<K, Done> {
  return {
    leases: store.store as unknown as LeaseStore<K>,
    budget: store.store,
    key: KEY as unknown as K,
    section: "lesson_analysis",
    knowledgeEntry: true,
    billing: { scope: "system", userId: "u-1", entitlementKind: null, chargesCredits: false },
    reserveFingerprint: "fp-1",
    prompt: { system: [{ text: "s", cacheable: true }], user: "u" },
    schema: z.object({ value: z.string() }),
    maxTokens: 400,
    finalize: (parsed) => {
      if ((parsed as { value: string }).value !== "good") throw new Error("bad");
      return { ok: true };
    },
    provider: () => provider,
    config: () => CONFIG,
    now: store.now(),
    ...overrides,
  };
}

/** A provider whose calls hang until the test resolves them, in call order. */
function controllableProvider() {
  const pending: { resolve: (value: AiResult & { parsed: unknown }) => void }[] = [];
  const waiters: { count: number; resolve: () => void }[] = [];
  const held: AiProvider = {
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
    provider: held,
    called: (count: number) => new Promise<void>((resolve) => {
      if (pending.length >= count) resolve();
      else waiters.push({ count, resolve });
    }),
    resolve: (index: number, parsed: unknown) => pending[index]?.resolve({ parsed, truncated: false, ...USAGE }),
  };
}

describe("runLeasedGeneration", () => {
  it("serves a ready entry with no provider call and no reservation", async () => {
    const claim = await store.store.claimLease(KEY, LEASE_SECONDS);
    if (claim.outcome !== "leader") throw new Error("expected leader");
    await store.store.complete(claim.entryId, claim.leaseToken, { ok: true }, "m", "p");
    await expect(runLeasedGeneration(job())).resolves.toEqual({ status: "ready", content: { ok: true }, model: "m" });
    expect(fake.requests).toHaveLength(0);
    expect(store.reservations).toHaveLength(0);
  });

  it("stores the FINALIZED content, not the raw parse, and settles", async () => {
    fake.queueStructured({ value: "good" }, USAGE);
    await expect(runLeasedGeneration(job())).resolves.toEqual({ status: "ready", content: { ok: true }, model: "claude-haiku-4-5" });
    expect([...store.entries.values()][0]).toMatchObject({ status: "ready", content: { ok: true } });
    expect(store.generations.map((g) => g.outcome)).toEqual(["success"]);
    expect(store.reservations.map((r) => r.status)).toEqual(["settled"]);
  });

  it("treats a finalize throw as a paid validation error with backoff", async () => {
    fake.queueStructured({ value: "bad" }, USAGE);
    const outcome = await runLeasedGeneration(job());
    expect(outcome).toMatchObject({ status: "validation_error" });
    if (outcome.status !== "validation_error") throw new Error("unreachable");
    expect(new Date(outcome.retryAfter).getTime()).toBeGreaterThan(NOW.getTime());
    const [generation] = store.generations;
    expect(generation).toMatchObject({ outcome: "validation_error", model: "claude-haiku-4-5", inputTokens: 400 });
    expect(generation?.estimatedCostUsd).toBeGreaterThan(0);
    expect(store.reservations.map((r) => r.status)).toEqual(["released"]);
    expect(store.budgetFor(NOW).spentUsd).toBe(generation?.estimatedCostUsd);
    expect([...store.entries.values()][0]).toMatchObject({ status: "failed", errorCode: "validation_error" });
    await expect(runLeasedGeneration(job())).resolves.toEqual({ status: "backoff", retryAfter: outcome.retryAfter });
    expect(fake.requests).toHaveLength(1);
  });

  it("never lets a follower reserve", async () => {
    const gate = controllableProvider();
    const first = runLeasedGeneration(job({ provider: () => gate.provider }));
    await gate.called(1);
    await expect(runLeasedGeneration(job({ provider: () => gate.provider }))).resolves.toEqual({
      status: "pending", retryAfterMs: FOLLOWER_RETRY_MS,
    });
    expect(store.reservations).toHaveLength(1);
    gate.resolve(0, { value: "good" });
    await expect(first).resolves.toMatchObject({ status: "ready" });
  });

  it("refuses before any spend and leaves the entry retryable at once", async () => {
    await expect(runLeasedGeneration(job({ config: () => ({ ...CONFIG, globalBudgetUsdPerDay: 0 }) }))).resolves.toMatchObject({
      status: "refused", outcome: "budget_exhausted",
    });
    expect(fake.requests).toHaveLength(0);
    expect([...store.entries.values()][0]).toMatchObject({ status: "failed", retryAfter: NOW });
    fake.queueStructured({ value: "good" }, USAGE);
    await expect(runLeasedGeneration(job())).resolves.toMatchObject({ status: "ready" });
  });

  it("lets a stale leader release its reservation and return the winner's content", async () => {
    const gate = controllableProvider();
    const first = runLeasedGeneration(job({ provider: () => gate.provider }));
    await gate.called(1);
    store.advance((LEASE_SECONDS + 1) * 1000);
    const second = runLeasedGeneration(job({ provider: () => gate.provider, now: store.now() }));
    await gate.called(2);
    gate.resolve(1, { value: "good" });
    await expect(second).resolves.toMatchObject({ status: "ready", content: { ok: true } });
    gate.resolve(0, { value: "good" });
    await expect(first).resolves.toMatchObject({ status: "ready", content: { ok: true } });
    expect(store.reservations.map((r) => r.status).sort()).toEqual(["released", "settled"]);
  });

  it("records no knowledge entry id when the entry is not a knowledge_entries row", async () => {
    fake.queueStructured({ value: "good" }, USAGE);
    await runLeasedGeneration(job({ knowledgeEntry: false }));
    expect(store.generations[0]).toMatchObject({ knowledgeEntryId: null, section: "lesson_analysis" });
  });

  describe("over a generic lease store", () => {
    it("stores finalized content and keeps followers off the budget", async () => {
      const leases = createMemoryLeaseStore<{ id: string }>(() => store.now(), (key) => key.id);
      const generic = (overrides: Partial<LeasedGeneration<{ id: string }, Done>> = {}) =>
        job<{ id: string }>({ leases: leases.store, key: { id: "reflection-1" }, knowledgeEntry: false, ...overrides });

      const gate = controllableProvider();
      const first = runLeasedGeneration(generic({ provider: () => gate.provider }));
      await gate.called(1);
      await expect(runLeasedGeneration(generic({ provider: () => gate.provider }))).resolves.toEqual({
        status: "pending", retryAfterMs: FOLLOWER_RETRY_MS,
      });
      expect(store.reservations).toHaveLength(1);
      gate.resolve(0, { value: "good" });
      await expect(first).resolves.toMatchObject({ status: "ready", content: { ok: true } });
      expect(leases.entries.get("reflection-1")).toMatchObject({ status: "ready", content: { ok: true } });
      expect(store.entries.size).toBe(0);
    });
  });
});
