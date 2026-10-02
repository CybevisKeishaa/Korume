import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getActivePlanTier } from "@/lib/data/subscriptions";
import { rateLimit } from "@/lib/rate-limit";
import { createFakeProvider, type FakeProviderHandle } from "@/lib/ai/providers/fake";
import type { AiProvider } from "@/lib/ai/port";
import { createMemoryKnowledgeStore, type MemoryKnowledgeStore } from "@/lib/knowledge/memory-store";
import { fingerprint } from "@/lib/knowledge/canonical";
import type { KnowledgeConfig } from "@/lib/knowledge/config";
import { getKnowledgeUsage, requestKnowledgeSection } from "./knowledge";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/data/subscriptions", () => ({ getActivePlanTier: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));

const USER = { id: "u-know" };
const LINE_ID = "a0000000-0000-0000-0000-000000000001";
const TEXT = "𠮷野家で今日は雨です。";
const CONFIG: KnowledgeConfig = { freeSentencesPerDay: 3, plusCreditsPerMonth: 1000, plusMaxSectionsPerDay: 200, globalBudgetUsdPerDay: 5, creditUsdUnit: 0.001 };
const USAGE = { model: "claude-haiku-4-5", usage: { inputTokens: 400, outputTokens: 300, cacheReadTokens: 0, cacheWriteTokens: 0 } };
const SENTINEL = "FULL-ONLY-SENTINEL";

let store: MemoryKnowledgeStore;
let fake: FakeProviderHandle;
let provider: AiProvider;
let lineVisible: boolean;

beforeEach(() => {
  vi.clearAllMocks();
  lineVisible = true;
  store = createMemoryKnowledgeStore(new Date("2026-10-02T09:00:00Z"));
  fake = createFakeProvider();
  provider = { ...fake.provider, name: "anthropic" };
  vi.mocked(rateLimit).mockReturnValue({ ok: true, retryAfter: 0 });
  vi.mocked(getActivePlanTier).mockResolvedValue("plus");
  useUser(USER);
});

function useUser(user: { id: string } | null) {
  vi.mocked(createClient).mockReturnValue(createMockSupabase({
    user,
    tables: {
      transcript_lines: () => ({
        data: lineVisible ? { id: LINE_ID, text_jp: TEXT, transcripts: { video_id: "v-1", videos: { title: "天気" } } } : null,
        error: null,
      }),
    },
  }) as ReturnType<typeof createClient>);
}

const deps = () => ({ store: store.store, provider, config: CONFIG, aiEnabled: true });
const request = (overrides: Record<string, unknown> = {}) =>
  requestKnowledgeSection({ transcriptLineId: LINE_ID, section: "lite", locale: "vi", ...overrides }, deps());

describe("requestKnowledgeSection", () => {
  it("refuses an anonymous caller and a rate-limited one before reading anything", async () => {
    useUser(null);
    await expect(request()).resolves.toEqual({ kind: "unauthorized" });
    useUser(USER);
    vi.mocked(rateLimit).mockReturnValue({ ok: false, retryAfter: 9_000 });
    await expect(request()).resolves.toEqual({ kind: "rate_limited", retryAfter: 9_000 });
    expect(rateLimit).toHaveBeenCalledWith("knowledge:section:u-know", { limit: 30, windowMs: 60_000 });
    expect(fake.requests).toHaveLength(0);
  });

  it("answers a line the learner cannot read with not_found and no generation", async () => {
    lineVisible = false;
    await expect(request()).resolves.toEqual({ kind: "not_found" });
    expect(store.entries.size).toBe(0);
    expect(getActivePlanTier).not.toHaveBeenCalled();
  });

  it.each([
    [{ section: "nope" }],
    [{ section: "word_gloss_vi" }],
    [{ section: "phrase_analysis" }],
    [{ section: "lite", span: { start: 0, end: 2 } }],
    [{ section: "phrase_analysis", span: { start: 0, end: 99 } }],
    [{ section: "phrase_analysis", span: { start: 1, end: 4 } }],
  ])("rejects %j as invalid without generating", async (overrides) => {
    await expect(request(overrides)).resolves.toEqual({ kind: "invalid" });
    expect(store.entries.size).toBe(0);
  });

  it("generates for the learner's tier and keys vi and en apart", async () => {
    fake.queueStructured({ summary: "雨", literal: "rain", keyPoints: [] }, USAGE);
    fake.queueStructured({ summary: "rain", literal: "rain", keyPoints: [] }, USAGE);
    await expect(request()).resolves.toMatchObject({ kind: "outcome", section: "lite", outcome: { status: "ready", access: "full" } });
    await expect(request({ locale: "en" })).resolves.toMatchObject({ outcome: { status: "ready", content: { summary: "rain" } } });
    expect(store.entries.size).toBe(2);
    expect(fake.requests[0]?.messages[0]?.content).toBe(`<sentence>${TEXT}</sentence>`);
    // Plus pays per generated section: one charge per locale.
    expect(store.charges).toEqual(Array(2).fill(expect.objectContaining({ userId: USER.id, entitlementKind: "plus_section", fingerprint: fingerprint(TEXT) })));
  });

  it("projects a cached full entry for a Free learner and never sends the full object", async () => {
    fake.queueStructured({ items: [{ mistake: "a", correction: "b", why: SENTINEL }, { mistake: "c", correction: "d", why: SENTINEL }] }, USAGE);
    await request({ section: "common_mistakes" });
    vi.mocked(getActivePlanTier).mockResolvedValue("free");
    const free = await request({ section: "common_mistakes" });
    expect(free).toMatchObject({ outcome: { status: "ready", access: "preview" } });
    const content = (free as { outcome: { content: { items: unknown[] } } }).outcome.content;
    expect(content.items).toHaveLength(1);
    expect(JSON.stringify(free).split(SENTINEL)).toHaveLength(2); // the one projected item, never the second
  });

  it("analyses a phrase keyed by its parent sentence and charges the parent's Free slot", async () => {
    vi.mocked(getActivePlanTier).mockResolvedValue("free");
    fake.queueStructured({ phrase: "𠮷野家", breakdown: [], nuance: "" }, USAGE);
    await expect(request({ section: "phrase_analysis", span: { start: 0, end: 4 } })).resolves.toMatchObject({ outcome: { status: "ready" } });
    const [entry] = [...store.entries.values()];
    expect(entry?.key).toMatchObject({ fingerprint: fingerprint("𠮷野家"), contextKey: fingerprint(TEXT) });
    expect(store.charges).toEqual([expect.objectContaining({ entitlementKind: "free_sentence", fingerprint: fingerprint(TEXT) })]);
    expect(fake.requests[0]?.messages[0]?.content).toContain("<phrase>𠮷野家</phrase>");
  });
});

describe("getKnowledgeUsage", () => {
  const NOW = new Date("2026-10-02T09:00:00Z");
  beforeEach(() => {
    vi.mocked(createServiceClient).mockReturnValue(createMockSupabase({
      tables: {},
      rpcs: { ai_usage_snapshot: () => ({ data: { freeSentencesUsed: 2, plusCreditsUsed: 250 }, error: null }) },
    }) as unknown as ReturnType<typeof createServiceClient>);
  });

  it("shows a Free learner sentences used of the daily limit", async () => {
    vi.mocked(getActivePlanTier).mockResolvedValue("free");
    await expect(getKnowledgeUsage(NOW)).resolves.toEqual({
      kind: "ok", usage: { plan: "free", used: 2, limit: 3, resetsAt: "2026-10-03T00:00:00.000Z" },
    });
  });

  it("shows a Plus learner only a remaining percentage, never credits, tokens or USD", async () => {
    vi.stubEnv("AI_PLUS_CREDITS_PER_MONTH", "1000");
    const result = await getKnowledgeUsage(NOW);
    vi.unstubAllEnvs();
    expect(result).toEqual({ kind: "ok", usage: { plan: "plus", remainingPercent: 75, resetsAt: "2026-11-01T00:00:00.000Z" } });
    expect(JSON.stringify(result)).not.toMatch(/credit|token|usd/i);
  });

  it("refuses an anonymous caller", async () => {
    useUser(null);
    await expect(getKnowledgeUsage(NOW)).resolves.toEqual({ kind: "unauthorized" });
  });
});
