import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { getActiveSnapshotId, getDictionaryAttribution } from "@/lib/dictionary/snapshot";
import { getOrGenerateSection } from "@/lib/knowledge/orchestrator";
import { createFakeProvider, type FakeProviderHandle } from "@/lib/ai/providers/fake";
import type { AiProvider } from "@/lib/ai/port";
import { createMemoryKnowledgeStore, type MemoryKnowledgeStore } from "@/lib/knowledge/memory-store";
import type { KnowledgeConfig } from "@/lib/knowledge/config";
import { getGloss, requestGloss } from "./lookup";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/dictionary/snapshot", () => ({ getActiveSnapshotId: vi.fn(), getDictionaryAttribution: vi.fn() }));
vi.mock("@/lib/knowledge/orchestrator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/knowledge/orchestrator")>();
  return { ...actual, getOrGenerateSection: vi.fn(actual.getOrGenerateSection) };
});

const AME = { ent_seq: 1141070, kanji_forms: ["雨"], kana_forms: ["あめ"], senses: [{ gloss: ["rain"] }, { gloss: ["rainy day"] }] };
const CONFIG: KnowledgeConfig = { freeSentencesPerDay: 3, plusCreditsPerMonth: 1000, plusMaxSectionsPerDay: 200, globalBudgetUsdPerDay: 5, creditUsdUnit: 0.001 };
const USAGE = { model: "claude-haiku-4-5", usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0 } };

let store: MemoryKnowledgeStore;
let fake: FakeProviderHandle;
let provider: AiProvider;
let curated: { meaning_vi: string | null; reading: string | null }[];

beforeEach(() => {
  vi.clearAllMocks();
  curated = [];
  store = createMemoryKnowledgeStore(new Date("2026-10-02T09:00:00Z"));
  fake = createFakeProvider();
  provider = { ...fake.provider, name: "anthropic" };
  vi.mocked(rateLimit).mockReturnValue({ ok: true, retryAfter: 0 });
  vi.mocked(getActiveSnapshotId).mockResolvedValue("snap-1");
  vi.mocked(getDictionaryAttribution).mockResolvedValue([{ source: "jmdict", version: "2026-10-02", url: "u", license: "l" }]);
  useUser({ id: "u-gloss" });
});

function useUser(user: { id: string } | null, entry: typeof AME | null = AME) {
  vi.mocked(createClient).mockReturnValue(createMockSupabase({
    user,
    tables: {
      dict_entries: () => ({ data: entry, error: null }),
      vocab: () => ({ data: curated, error: null }),
    },
  }) as ReturnType<typeof createClient>);
}

const deps = () => ({ store: store.store, provider, config: CONFIG, aiEnabled: true });

describe("getGloss", () => {
  it("never starts a generation: a miss is `missing`", async () => {
    await expect(getGloss(AME.ent_seq, { store: store.store })).resolves.toEqual({
      kind: "ok", gloss: { entSeq: AME.ent_seq, status: "missing", glossesVi: [], note: null, source: null },
    });
    expect(getOrGenerateSection).not.toHaveBeenCalled();
    expect(store.entries.size).toBe(0);
    expect(store.reservations).toHaveLength(0);
  });

  it("prefers the curated vocab meaning, split into glosses", async () => {
    curated = [{ meaning_vi: "mưa; cơn mưa", reading: "あめ" }];
    await expect(getGloss(AME.ent_seq, { store: store.store })).resolves.toEqual({
      kind: "ok", gloss: { entSeq: AME.ent_seq, status: "ready", glossesVi: ["mưa", "cơn mưa"], note: null, source: "vocab" },
    });
  });

  it("is not found for an entry outside the active snapshot", async () => {
    useUser({ id: "u-gloss" }, null);
    await expect(getGloss(42, { store: store.store })).resolves.toEqual({ kind: "not_found" });
  });
});

describe("requestGloss", () => {
  it("generates a system-funded gloss recorded against the requester, never their entitlement", async () => {
    fake.queueStructured({ glosses: ["mưa"], note: "" }, USAGE);
    await expect(requestGloss(AME.ent_seq, deps())).resolves.toEqual({
      kind: "ok", gloss: { entSeq: AME.ent_seq, status: "ready", glossesVi: ["mưa"], note: null, source: "ai" },
    });
    expect(vi.mocked(getOrGenerateSection).mock.calls[0]?.[0]).toMatchObject({ billing: { scope: "system", userId: "u-gloss" } });
    expect(store.reservations).toEqual([expect.objectContaining({ billingScope: "system", entitlementKind: null, requestedBy: "u-gloss" })]);
    expect(store.charges).toHaveLength(0);
    expect(fake.requests[0]?.messages[0]?.content).toBe("<dictionary>雨 | あめ | rain</dictionary>");

    // The same sense of the same JMdict version is then read from the cache, with no further generation.
    await expect(getGloss(AME.ent_seq, { store: store.store })).resolves.toMatchObject({ gloss: { status: "ready", source: "ai" } });
    const [entry] = [...store.entries.values()];
    expect(entry?.key.contextKey).toBe("1141070:0:2026-10-02");
  });

  it("does not generate when a curated meaning exists", async () => {
    curated = [{ meaning_vi: "mưa", reading: null }];
    await expect(requestGloss(AME.ent_seq, deps())).resolves.toMatchObject({ gloss: { source: "vocab" } });
    expect(getOrGenerateSection).not.toHaveBeenCalled();
  });

  it("is rate-limited per user at 20 a minute, and unavailable when the budget is spent", async () => {
    await requestGloss(AME.ent_seq, { ...deps(), config: { ...CONFIG, globalBudgetUsdPerDay: 0 } }).then((result) => {
      expect(result).toEqual({ kind: "unavailable" });
    });
    expect(rateLimit).toHaveBeenCalledWith("dictionary:gloss:generate:u-gloss", { limit: 20, windowMs: 60_000 });
    vi.mocked(rateLimit).mockReturnValue({ ok: false, retryAfter: 1_000 });
    await expect(requestGloss(AME.ent_seq, deps())).resolves.toEqual({ kind: "rate_limited", retryAfter: 1_000 });
  });
});
