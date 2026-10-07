import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeProvider, type FakeProviderHandle } from "@/lib/ai/providers/fake";
import type { AiProvider, AiRequest, AiResult } from "@/lib/ai/port";
import type { AnalysisToken, StaticLineAnalysis } from "@/lib/analysis/types";
import type { KnowledgeConfig } from "@/lib/knowledge/config";
import { createMemoryKnowledgeStore, type MemoryKnowledgeStore } from "@/lib/knowledge/memory-store";
import { requireUser, selectVideoById } from "@/lib/data/videos";
import { getTranscript } from "@/lib/data/transcripts";
import { staticAnalyses } from "@/lib/analysis/line-analysis";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";
import { analysisFingerprint, buildAnalysisInput } from "./input";
import { analysisStatusForReflection, requestLessonAnalysis } from "./service";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(() => ({})) }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/data/videos", () => ({ requireUser: vi.fn(), selectVideoById: vi.fn() }));
vi.mock("@/lib/data/transcripts", () => ({ getTranscript: vi.fn() }));
vi.mock("@/lib/analysis/line-analysis", () => ({ staticAnalyses: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => ({ ok: true, retryAfter: 0 })) }));
vi.mock("./hydrate", () => ({
  hydrateAnalysis: vi.fn(async (_supabase: unknown, stored: { overview: string }) => ({
    overview: stored.overview, words: [], expressions: [], grammar: [], culture: [],
  })),
}));

const VIDEO = "c0000000-0000-4000-8000-000000000001";
const USER = "u0000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-10-04T09:00:00Z");
const CONFIG: KnowledgeConfig = {
  freeSentencesPerDay: 3, plusCreditsPerMonth: 1000, plusMaxSectionsPerDay: 200, askKorumeFreeTurnsPerDay: 10,
  askKorumePlusTurnsPerDay: 100, systemGenerationsPerUserPerDay: 100, globalBudgetUsdPerDay: 5, creditUsdUnit: 0.001,
};
const USAGE = { model: "gemini-2.5-flash", usage: { inputTokens: 900, outputTokens: 700, cacheReadTokens: 0, cacheWriteTokens: 0 } };
const LINES = [
  { id: "line-1", start_time: 0, end_time: 2, text_jp: "注文をお願いします。", text_translation: null, furigana_json: null },
  { id: "line-2", start_time: 2, end_time: 4, text_jp: "   ", text_translation: null, furigana_json: null },
];
const TOKEN: AnalysisToken = {
  index: 0, surface: "注文", base: "注文", reading: "チュウモン", pos: "名詞", posDetail1: null, span: { start: 0, end: 2 },
  entries: [{ entSeq: 1394140, headword: "注文", reading: "ちゅうもん", glossEn: "order", jlpt: 3 }], vocabId: null, curatedVi: null,
};
const ANALYSES = new Map<string, StaticLineAnalysis>([["line-1", { lineId: "line-1", snapshotId: "s", tokens: [TOKEN], grammar: [] }]]);
const GOOD = {
  overview: "Ordering at a counter.",
  words: [{ candidate_id: "v1", why_it_matters: "you order food", usage_note: "polite request" }],
  expressions: [], grammar: [], culture: [],
};

let store: MemoryKnowledgeStore;
let fake: FakeProviderHandle;
let provider: AiProvider;

/** The service client's knowledge_entries read, answered from the memory store, so read and generate share state. */
function serviceClientOverMemory() {
  return {
    from: () => {
      const filters: Record<string, unknown> = {};
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => { filters[column] = value; return chain; },
        maybeSingle: async () => {
          const entry = [...store.entries.values()].find(({ key }) =>
            key.fingerprint === filters.fingerprint && key.section === filters.section && key.locale === filters.locale &&
            key.contextKey === filters.context_key && key.schemaVersion === filters.schema_version &&
            key.generatorVersion === filters.generator_version && key.contentVariant === filters.content_variant);
          return {
            data: entry ? {
              status: entry.status, content: entry.content,
              lease_until: entry.leaseUntil?.toISOString() ?? null, retry_after: entry.retryAfter?.toISOString() ?? null,
            } : null,
            error: null,
          };
        },
      };
      return chain;
    },
  };
}

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

const deps = (overrides: Record<string, unknown> = {}) => ({ store: store.store, provider, config: CONFIG, aiEnabled: true, now: NOW, ...overrides });

beforeEach(() => {
  vi.clearAllMocks();
  store = createMemoryKnowledgeStore(NOW);
  fake = createFakeProvider();
  provider = { ...fake.provider, name: "anthropic" };
  vi.mocked(requireUser).mockResolvedValue({ id: USER } as Awaited<ReturnType<typeof requireUser>>);
  vi.mocked(selectVideoById).mockResolvedValue({ id: VIDEO, title: "At the café" } as Awaited<ReturnType<typeof selectVideoById>>);
  vi.mocked(getTranscript).mockResolvedValue({ ok: true, data: { id: "t", video_id: VIDEO, source: "user_submitted", language: "ja", created_at: "", lines: LINES } } as Awaited<ReturnType<typeof getTranscript>>);
  vi.mocked(staticAnalyses).mockResolvedValue(ANALYSES as Awaited<ReturnType<typeof staticAnalyses>>);
  vi.mocked(rateLimit).mockReturnValue({ ok: true, retryAfter: 0 });
  vi.mocked(createServiceClient).mockReturnValue(serviceClientOverMemory() as unknown as ReturnType<typeof createServiceClient>);
});

describe("requestLessonAnalysis", () => {
  it("answers unauthorized, not_found and no_transcript before any AI", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce(null);
    await expect(requestLessonAnalysis(VIDEO, "vi", "read", deps())).resolves.toEqual({ kind: "unauthorized" });
    vi.mocked(selectVideoById).mockResolvedValueOnce(null);
    await expect(requestLessonAnalysis(VIDEO, "vi", "read", deps())).resolves.toEqual({ kind: "not_found" });
    vi.mocked(getTranscript).mockResolvedValueOnce({ ok: true, data: null });
    await expect(requestLessonAnalysis(VIDEO, "vi", "generate", deps())).resolves.toEqual({ kind: "ok", body: { status: "no_transcript" } });
    vi.mocked(getTranscript).mockResolvedValueOnce({ ok: false, status: 401 } as Awaited<ReturnType<typeof getTranscript>>);
    await expect(requestLessonAnalysis(VIDEO, "vi", "read", deps())).resolves.toEqual({ kind: "unauthorized" });
    expect(fake.requests).toHaveLength(0);
  });

  it("read never generates: not_ready with AI on, unavailable with AI off", async () => {
    await expect(requestLessonAnalysis(VIDEO, "vi", "read", deps())).resolves.toEqual({ kind: "ok", body: { status: "not_ready" } });
    await expect(requestLessonAnalysis(VIDEO, "vi", "read", deps({ aiEnabled: false }))).resolves.toEqual({ kind: "ok", body: { status: "unavailable" } });
    expect(store.entries.size).toBe(0);
    expect(store.reservations).toHaveLength(0);
  });

  it("generates once on a system budget, keyed by lesson + locale + the input fingerprint", async () => {
    fake.queueStructured(GOOD, USAGE);
    await expect(requestLessonAnalysis(VIDEO, "vi", "generate", deps())).resolves.toMatchObject({
      kind: "ok", body: { status: "ready", data: { overview: "Ordering at a counter." } },
    });
    expect(fake.requests).toHaveLength(1);
    expect(String(fake.requests[0]?.messages[0]?.content)).toContain("L1: 注文をお願いします。");
    const input = buildAnalysisInput([{ id: "line-1", textJp: "注文をお願いします。" }], ANALYSES);
    expect([...store.entries.values()][0]).toMatchObject({
      status: "ready",
      key: {
        fingerprint: analysisFingerprint(input), section: "lesson_analysis", locale: "vi", contextKey: VIDEO,
        schemaVersion: 1, generatorVersion: 3, contentVariant: "full",
      },
    });
    expect(store.reservations[0]).toMatchObject({ billingScope: "system", requestedBy: USER, entitlementKind: null });
    expect(store.generations[0]).toMatchObject({ section: "lesson_analysis", outcome: "success" });
  });

  it("serves the shared artifact from cache, and a read sees it too", async () => {
    fake.queueStructured(GOOD, USAGE);
    await requestLessonAnalysis(VIDEO, "vi", "generate", deps());
    await expect(requestLessonAnalysis(VIDEO, "vi", "generate", deps())).resolves.toMatchObject({ body: { status: "ready" } });
    await expect(requestLessonAnalysis(VIDEO, "vi", "read", deps())).resolves.toMatchObject({ body: { status: "ready" } });
    expect(fake.requests).toHaveLength(1);
  });

  it("generates separately per locale", async () => {
    fake.queueStructured(GOOD, USAGE);
    fake.queueStructured(GOOD, USAGE);
    await requestLessonAnalysis(VIDEO, "vi", "generate", deps());
    await requestLessonAnalysis(VIDEO, "en", "generate", deps());
    expect(fake.requests).toHaveLength(2);
    expect([...store.entries.values()].map((entry) => entry.key.locale).sort()).toEqual(["en", "vi"]);
  });

  it("answers a concurrent request with pending and never reserves for it", async () => {
    const gate = controllableProvider();
    const first = requestLessonAnalysis(VIDEO, "vi", "generate", deps({ provider: gate.provider }));
    await gate.called(1);
    await expect(requestLessonAnalysis(VIDEO, "vi", "generate", deps({ provider: gate.provider }))).resolves.toEqual({
      kind: "ok", body: { status: "pending", retryAfterMs: 1500 },
    });
    await expect(requestLessonAnalysis(VIDEO, "vi", "read", deps())).resolves.toEqual({
      kind: "ok", body: { status: "pending", retryAfterMs: 1500 },
    });
    expect(store.reservations).toHaveLength(1);
    gate.resolve(0, GOOD);
    await expect(first).resolves.toMatchObject({ body: { status: "ready" } });
  });

  it("turns an ungrounded answer into a retryable error that a read also reports", async () => {
    fake.queueStructured({ ...GOOD, words: [{ candidate_id: "v9", why_it_matters: "x", usage_note: "y" }] }, USAGE);
    const generated = await requestLessonAnalysis(VIDEO, "vi", "generate", deps());
    expect(generated).toMatchObject({ kind: "ok", body: { status: "retryable_error" } });
    if (generated.kind !== "ok" || generated.body.status !== "retryable_error") throw new Error("unreachable");
    expect(new Date(generated.body.retryAfter).getTime()).toBeGreaterThan(NOW.getTime());
    await expect(requestLessonAnalysis(VIDEO, "vi", "read", deps())).resolves.toEqual({
      kind: "ok", body: { status: "retryable_error", retryAfter: generated.body.retryAfter },
    });
  });

  it("reports unavailable when the budget refuses", async () => {
    await expect(requestLessonAnalysis(VIDEO, "vi", "generate", deps({ config: { ...CONFIG, globalBudgetUsdPerDay: 0 } }))).resolves.toEqual({
      kind: "ok", body: { status: "unavailable" },
    });
    expect(fake.requests).toHaveLength(0);
  });

  it("rate-limits right after auth, before any lesson load (m1)", async () => {
    vi.mocked(rateLimit).mockReturnValue({ ok: false, retryAfter: 4000 });
    await expect(requestLessonAnalysis(VIDEO, "vi", "generate", deps())).resolves.toEqual({ kind: "rate_limited", retryAfter: 4000 });
    expect(selectVideoById).not.toHaveBeenCalled();
    expect(getTranscript).not.toHaveBeenCalled();
    expect(staticAnalyses).not.toHaveBeenCalled();
  });

  it("rate-limits read and generate under separate keys", async () => {
    vi.mocked(rateLimit).mockReturnValue({ ok: false, retryAfter: 4000 });
    await expect(requestLessonAnalysis(VIDEO, "vi", "read", deps())).resolves.toEqual({ kind: "rate_limited", retryAfter: 4000 });
    await expect(requestLessonAnalysis(VIDEO, "vi", "generate", deps())).resolves.toEqual({ kind: "rate_limited", retryAfter: 4000 });
    expect(vi.mocked(rateLimit).mock.calls.map(([key, opts]) => [key, opts])).toEqual([
      [`summary:analysis:read:${USER}`, { limit: 60, windowMs: 60_000 }],
      [`summary:analysis:generate:${USER}`, { limit: 10, windowMs: 60_000 }],
    ]);
  });

  it("never reads a plan tier (R7: Free = Plus)", () => {
    const source = readFileSync(join(process.cwd(), "lib/summary/analysis/service.ts"), "utf8");
    expect(source).not.toMatch(/getActivePlanTier|isPlus|PlanTier/);
  });
});

describe("analysisStatusForReflection", () => {
  const LESSON = {
    supabase: {} as never,
    lines: [{ id: "line-1", index: 0, textJp: "注文をお願いします。", translation: null, startTime: 0, endTime: 2 }],
    analyses: ANALYSES,
  };

  it("reports ready with the fingerprint, pending, unusable and absent", async () => {
    await expect(analysisStatusForReflection(VIDEO, "vi", LESSON, deps())).resolves.toEqual({ kind: "absent" });
    await expect(analysisStatusForReflection(VIDEO, "vi", LESSON, deps({ aiEnabled: false }))).resolves.toEqual({ kind: "unusable" });

    const gate = controllableProvider();
    const first = requestLessonAnalysis(VIDEO, "vi", "generate", deps({ provider: gate.provider }));
    await gate.called(1);
    await expect(analysisStatusForReflection(VIDEO, "vi", LESSON, deps())).resolves.toEqual({ kind: "pending" });
    gate.resolve(0, GOOD);
    await first;
    const input = buildAnalysisInput([{ id: "line-1", textJp: "注文をお願いします。" }], ANALYSES);
    await expect(analysisStatusForReflection(VIDEO, "vi", LESSON, deps())).resolves.toMatchObject({
      kind: "ready", fingerprint: analysisFingerprint(input), view: { overview: "Ordering at a counter." },
    });
  });

  it("is unusable for a failed analysis in backoff and for a lesson without transcript", async () => {
    fake.queueStructured({ ...GOOD, words: [{ candidate_id: "v9", why_it_matters: "x", usage_note: "y" }] }, USAGE);
    await requestLessonAnalysis(VIDEO, "en", "generate", deps());
    await expect(analysisStatusForReflection(VIDEO, "en", LESSON, deps())).resolves.toEqual({ kind: "unusable" });
    await expect(analysisStatusForReflection(VIDEO, "vi", { ...LESSON, lines: [] }, deps())).resolves.toEqual({ kind: "unusable" });
  });

  it("builds the key from the lesson it is handed and never reloads it (m2)", async () => {
    vi.clearAllMocks();
    vi.mocked(createServiceClient).mockReturnValue(serviceClientOverMemory() as unknown as ReturnType<typeof createServiceClient>);
    await expect(analysisStatusForReflection(VIDEO, "vi", LESSON, deps())).resolves.toEqual({ kind: "absent" });
    expect(requireUser).not.toHaveBeenCalled();
    expect(selectVideoById).not.toHaveBeenCalled();
    expect(getTranscript).not.toHaveBeenCalled();
    expect(staticAnalyses).not.toHaveBeenCalled();
  });
});
