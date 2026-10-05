import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeProvider, type FakeProviderHandle } from "@/lib/ai/providers/fake";
import type { AiProvider, AiRequest, AiResult } from "@/lib/ai/port";
import type { KnowledgeConfig } from "@/lib/knowledge/config";
import { createMemoryKnowledgeStore, createMemoryLeaseStore, type MemoryKnowledgeStore } from "@/lib/knowledge/memory-store";
import type { KnowledgeLocale } from "@/lib/knowledge/types";
import { rateLimit } from "@/lib/rate-limit";
import type { LessonAnalysisView } from "../analysis/view";
import type { LoadedSummary } from "../load-snapshot";
import type { LessonSnapshot } from "../snapshot";
import { evidenceFingerprint, projectEvidence } from "./evidence";
import { requestLessonReflection, type ReflectionDeps } from "./service";
import type { ReflectionKey, ReflectionRow, ReflectionStore } from "./store";

vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => ({ ok: true, retryAfter: 0 })) }));
vi.mock("./store", () => ({ createSqlReflectionStore: vi.fn(() => { throw new Error("tests inject a store"); }) }));

const VIDEO = "c0000000-0000-4000-8000-000000000001";
const USER_A = "u0000000-0000-4000-8000-00000000000a";
const USER_B = "u0000000-0000-4000-8000-00000000000b";
const NOW = new Date("2026-10-04T09:00:00Z");
const CONFIG: KnowledgeConfig = {
  freeSentencesPerDay: 3, plusCreditsPerMonth: 1000, plusMaxSectionsPerDay: 200, askKorumeFreeTurnsPerDay: 10,
  askKorumePlusTurnsPerDay: 100, systemGenerationsPerUserPerDay: 100, globalBudgetUsdPerDay: 5, creditUsdUnit: 0.001,
};
const USAGE = { model: "gemini-2.5-flash", usage: { inputTokens: 500, outputTokens: 80, cacheReadTokens: 0, cacheWriteTokens: 0 } };
const reply = (text: string) => ({ text, highlight_line_id: "R1", highlight_span: "ありがとう" });

const SNAPSHOT: LessonSnapshot = {
  status: {
    shadowing: { kind: "in_progress", percent: 43 },
    pronunciation: { kind: "scored", score: 57 },
    listening: { kind: "not_started" },
    retention: { kind: "not_enough_data" },
  },
  savedKnowledge: { vocabulary: 4, expressions: 0, grammar: 0, retention: { kind: "not_enough_data" } },
  reviewTargets: [{ lineId: "line-a", lineText: "注文をお願いします", reasons: ["pronunciation"], focusSpan: null }],
  bestLine: { lineId: "line-b", lineText: "ありがとうございました" },
};
const EMPTY: LessonSnapshot = {
  status: {
    shadowing: { kind: "not_started" }, pronunciation: { kind: "not_started" },
    listening: { kind: "not_started" }, retention: { kind: "not_enough_data" },
  },
  savedKnowledge: { vocabulary: 0, expressions: 0, grammar: 0, retention: { kind: "not_enough_data" } },
  reviewTargets: [],
  bestLine: null,
};
const LINES = [{ id: "line-b", index: 0, textJp: "ありがとうございました", translation: null, startTime: 0, endTime: 1 }];
const ANALYSES = new Map();
const VIEW: LessonAnalysisView = { overview: "Ordering coffee.", words: [], expressions: [], grammar: [], culture: [] };

let budget: MemoryKnowledgeStore;
let fake: FakeProviderHandle;
let provider: AiProvider;
let snapshot: LessonSnapshot;
let analysisFp: string;
let user: string;
const stores = new Map<string, ReflectionStore>();
const entriesOf = new Map<string, Map<string, { key: ReflectionKey; status: ReflectionRow["status"]; content: unknown; leaseUntil: Date | null; retryAfter: Date | null }>>();

/** The SQL store's contract in memory, one per user (the table's identity carries the user). */
function memoryReflections(userId: string): ReflectionStore {
  const existing = stores.get(userId);
  if (existing) return existing;
  const leases = createMemoryLeaseStore<ReflectionKey>(() => budget.now(), (key) => JSON.stringify(key));
  const updated = new Map<string, string>();
  const complete = leases.store.complete;
  entriesOf.set(userId, leases.entries);
  const store: ReflectionStore = {
    ...leases.store,
    async complete(entryId, leaseToken, content, model, providerName) {
      const ok = await complete(entryId, leaseToken, content, model, providerName);
      if (ok) updated.set(entryId, budget.now().toISOString());
      return ok;
    },
    async entry(key) {
      const row = leases.entries.get(JSON.stringify(key));
      return row ? {
        status: row.status, content: row.content, leaseUntil: row.leaseUntil?.toISOString() ?? null,
        retryAfter: row.retryAfter?.toISOString() ?? null, updatedAt: updated.get(row.id) ?? "",
      } : null;
    },
    async latestReady(videoId, locale) {
      const ready = [...leases.entries.values()]
        .filter((row) => row.status === "ready" && row.key.videoId === videoId && row.key.locale === locale)
        .sort((a, b) => (updated.get(b.id) ?? "").localeCompare(updated.get(a.id) ?? ""));
      const row = ready[0];
      return row ? { content: row.content, updatedAt: updated.get(row.id) ?? "" } : null;
    },
  };
  stores.set(userId, store);
  return store;
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

type AnalysisStatus = Awaited<ReturnType<NonNullable<ReflectionDeps["analysisStatus"]>>>;
let analysis: AnalysisStatus;

function deps(overrides: Partial<ReflectionDeps> = {}): ReflectionDeps {
  return {
    reflections: memoryReflections,
    budget: budget.store,
    provider,
    config: CONFIG,
    aiEnabled: true,
    now: budget.now(),
    authenticate: async () => ({ supabase: {} as never, userId: user }),
    loadSummary: async () => ({
      ok: true,
      data: { userId: user, snapshot, video: { id: VIDEO, title: "At the café" }, lines: LINES, analyses: ANALYSES } as unknown as LoadedSummary,
    }),
    analysisStatus: async () => analysis,
    ...overrides,
  };
}
const run = (mode: "read" | "generate", overrides: Partial<ReflectionDeps> = {}, locale: KnowledgeLocale = "en") =>
  requestLessonReflection(VIDEO, locale, mode, deps(overrides));

beforeEach(() => {
  vi.clearAllMocks();
  stores.clear();
  entriesOf.clear();
  budget = createMemoryKnowledgeStore(NOW);
  fake = createFakeProvider();
  provider = { ...fake.provider, name: "anthropic" };
  snapshot = SNAPSHOT;
  analysisFp = "analysis-fp-1";
  analysis = { kind: "ready", fingerprint: analysisFp, view: VIEW };
  user = USER_A;
  vi.mocked(rateLimit).mockReturnValue({ ok: true, retryAfter: 0 });
});

describe("requestLessonReflection", () => {
  it("falls back without AI when the learner has done nothing in the lesson", async () => {
    snapshot = EMPTY;
    for (const mode of ["read", "generate"] as const) {
      await expect(run(mode)).resolves.toEqual({ kind: "ok", body: { state: "fallback", reason: "no_evidence" } });
    }
    expect(fake.requests).toHaveLength(0);
  });

  it("waits for the analysis it builds on, and falls back when the analysis cannot be had", async () => {
    analysis = { kind: "unusable" };
    await expect(run("generate")).resolves.toEqual({ kind: "ok", body: { state: "fallback", reason: "analysis_unusable" } });
    for (const kind of ["pending", "absent"] as const) {
      analysis = { kind };
      await expect(run("read")).resolves.toEqual({ kind: "ok", body: { state: "pending", retryAfterMs: 1500, reflection: null } });
    }
    expect(fake.requests).toHaveLength(0);
  });

  it("generates once on a system budget, keyed by lesson, locale, analysis and evidence, and never sends numbers", async () => {
    fake.queueStructured(reply("You finished strongly on the thank-you line."), USAGE);
    const result = await run("generate");
    expect(result).toEqual({
      kind: "ok",
      body: {
        state: "ready",
        reflection: { text: "You finished strongly on the thank-you line.", highlight: { lineId: "line-b", span: "ありがとう" }, generatedAt: NOW.toISOString() },
      },
    });
    expect(fake.requests).toHaveLength(1);
    const userTurn = String(fake.requests[0]?.messages[0]?.content);
    expect(userTurn).toContain("<practice>");
    for (const value of ["57", "43", ">4<"]) expect(userTurn).not.toContain(value);
    expect([...entriesOf.get(USER_A)!.values()][0]?.key).toEqual({
      videoId: VIDEO, locale: "en", analysisFingerprint: analysisFp,
      evidenceFingerprint: evidenceFingerprint(projectEvidence(SNAPSHOT)), schemaVersion: 1, generatorVersion: 1,
    });
    expect(budget.reservations[0]).toMatchObject({ billingScope: "system", requestedBy: USER_A, entitlementKind: null });
    expect(budget.generations[0]).toMatchObject({ section: "lesson_reflection", knowledgeEntryId: null, outcome: "success" });
    await expect(run("read")).resolves.toMatchObject({ body: { state: "ready", reflection: { text: "You finished strongly on the thank-you line." } } });
  });

  it("serves an older reflection as stale — never as ready — once the evidence band moves, then regenerates", async () => {
    fake.queueStructured(reply("First pass."), USAGE);
    await run("generate");
    snapshot = { ...SNAPSHOT, status: { ...SNAPSHOT.status, listening: { kind: "scored", score: 88 } } };
    await expect(run("read")).resolves.toEqual({
      kind: "ok",
      body: { state: "stale", stale: true, reflection: { text: "First pass.", highlight: { lineId: "line-b", span: "ありがとう" }, generatedAt: NOW.toISOString() } },
    });
    budget.advance(60_000);
    fake.queueStructured(reply("Now with listening too."), USAGE);
    await expect(run("generate")).resolves.toMatchObject({ body: { state: "ready", reflection: { text: "Now with listening too." } } });
    await expect(run("read")).resolves.toMatchObject({ body: { state: "ready", reflection: { text: "Now with listening too." } } });
  });

  it("treats a new analysis as a new identity", async () => {
    fake.queueStructured(reply("First pass."), USAGE);
    await run("generate");
    analysis = { kind: "ready", fingerprint: "analysis-fp-2", view: VIEW };
    await expect(run("read")).resolves.toMatchObject({ body: { state: "stale", stale: true } });
  });

  it("keeps a concurrent caller off the budget", async () => {
    const gate = controllableProvider();
    const first = run("generate", { provider: gate.provider });
    await gate.called(1);
    await expect(run("generate", { provider: gate.provider })).resolves.toEqual({
      kind: "ok", body: { state: "pending", retryAfterMs: 1500, reflection: null },
    });
    await expect(run("read")).resolves.toMatchObject({ body: { state: "pending" } });
    expect(budget.reservations).toHaveLength(1);
    gate.resolve(0, reply("Done."));
    await expect(first).resolves.toMatchObject({ body: { state: "ready" } });
  });

  it("backs off after an invalid reflection, and a read inside the backoff says so", async () => {
    fake.queueStructured(reply("You saved 4 words."), USAGE);
    const result = await run("generate");
    expect(result).toMatchObject({ kind: "ok", body: { state: "fallback", reason: "backoff" } });
    if (result.kind !== "ok" || result.body.state !== "fallback") throw new Error("unreachable");
    expect(new Date(result.body.retryAfter ?? 0).getTime()).toBeGreaterThan(NOW.getTime());
    await expect(run("read")).resolves.toMatchObject({ body: { state: "fallback", reason: "backoff" } });
  });

  it("with AI off: generate falls back, a read of an exact ready row still serves it", async () => {
    fake.queueStructured(reply("First pass."), USAGE);
    await run("generate");
    await expect(run("read", { aiEnabled: false })).resolves.toMatchObject({ body: { state: "ready" } });
    snapshot = { ...SNAPSHOT, bestLine: null };
    await expect(run("generate", { aiEnabled: false })).resolves.toEqual({ kind: "ok", body: { state: "fallback", reason: "unavailable" } });
  });

  it("falls back when the budget refuses", async () => {
    await expect(run("generate", { config: { ...CONFIG, globalBudgetUsdPerDay: 0 } })).resolves.toEqual({
      kind: "ok", body: { state: "fallback", reason: "unavailable" },
    });
    expect(fake.requests).toHaveLength(0);
  });

  it("gives every learner their own reflection of the same lesson", async () => {
    fake.queueStructured(reply("For A."), USAGE);
    await run("generate");
    user = USER_B;
    await expect(run("read")).resolves.toEqual({ kind: "ok", body: { state: "not_found" } });
    fake.queueStructured(reply("For B."), USAGE);
    await expect(run("generate")).resolves.toMatchObject({ body: { state: "ready", reflection: { text: "For B." } } });
    user = USER_A;
    await expect(run("read")).resolves.toMatchObject({ body: { state: "ready", reflection: { text: "For A." } } });
  });

  it("rate-limits read and generate under separate keys", async () => {
    vi.mocked(rateLimit).mockReturnValue({ ok: false, retryAfter: 3000 });
    await expect(run("read")).resolves.toEqual({ kind: "rate_limited", retryAfter: 3000 });
    await expect(run("generate")).resolves.toEqual({ kind: "rate_limited", retryAfter: 3000 });
    expect(vi.mocked(rateLimit).mock.calls.map(([key, opts]) => [key, opts])).toEqual([
      [`summary:reflection:read:${USER_A}`, { limit: 60, windowMs: 60_000 }],
      [`summary:reflection:generate:${USER_A}`, { limit: 10, windowMs: 60_000 }],
    ]);
  });

  it("refuses a signed-out caller and a rate-limited one before loading the lesson (m1)", async () => {
    const loadSummary = vi.fn();
    await expect(run("read", { authenticate: async () => null, loadSummary })).resolves.toEqual({ kind: "unauthorized" });
    expect(rateLimit).not.toHaveBeenCalled();
    vi.mocked(rateLimit).mockReturnValue({ ok: false, retryAfter: 3000 });
    await expect(run("generate", { loadSummary })).resolves.toEqual({ kind: "rate_limited", retryAfter: 3000 });
    expect(loadSummary).not.toHaveBeenCalled();
  });

  it("hands the analysis check the lines and analyses it already loaded (m2)", async () => {
    const analysisStatus = vi.fn(async () => analysis);
    fake.queueStructured(reply("Done."), USAGE);
    await run("generate", { analysisStatus });
    expect(analysisStatus).toHaveBeenCalledWith(VIDEO, "en", { supabase: {}, lines: LINES, analyses: ANALYSES });
  });

  it("passes the lesson-level refusals through", async () => {
    await expect(run("read", { loadSummary: async () => ({ ok: false, status: 401 }) })).resolves.toEqual({ kind: "unauthorized" });
    await expect(run("read", { loadSummary: async () => ({ ok: false, status: 404 }) })).resolves.toEqual({ kind: "not_found" });
  });
});

describe("Summary never reaches Companion memory (R2)", () => {
  it("no source file under lib/summary reads companion_memories or imports lib/data/companion", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
          const source = readFileSync(path, "utf8");
          if (/companion_memories|lib\/data\/companion/.test(source)) offenders.push(path);
        }
      }
    };
    walk(join(process.cwd(), "lib/summary"));
    expect(offenders).toEqual([]);
  });
});
