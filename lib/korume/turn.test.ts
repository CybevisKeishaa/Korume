import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeProvider, type FakeProviderHandle } from "@/lib/ai/providers/fake";
import { AiError } from "@/lib/ai/errors";
import { readKnowledgeConfig } from "@/lib/knowledge/config";
import { createMemoryKnowledgeStore, type MemoryKnowledgeStore } from "@/lib/knowledge/memory-store";
import { getOrGenerateSection, readCachedSection } from "@/lib/knowledge/orchestrator";
import type { AiProvider } from "@/lib/ai/port";
import { createMemoryKorumeStore, type MemoryKorumeStore } from "./memory-store";
import { plannerPrompt } from "./prompts";
import { runTurn, type TurnDeps, type TurnInput } from "./turn";
import type { Tool } from "./retrieval";
import { knowledgeTool } from "./tools/knowledge";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/knowledge/orchestrator", () => ({ readCachedSection: vi.fn(async () => null), getOrGenerateSection: vi.fn() }));
vi.mock("@/lib/data/subscriptions", () => ({ getActivePlanTier: vi.fn() }));

const ME = "a0000000-0000-4000-8000-000000000001";
const THREAD = "b0000000-0000-4000-8000-000000000001";
const VIDEO = "c0000000-0000-4000-8000-000000000001";
const LINE = "d0000000-0000-4000-8000-000000000001";
const TURN = "e0000000-0000-4000-8000-000000000001";
const START = new Date("2026-10-03T00:00:00Z");

const PLAN_USAGE = { model: "claude-haiku-4-5", usage: { inputTokens: 1_000, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 } };
const ANSWER_USAGE = { model: "claude-opus-4-8", usage: { inputTokens: 4_000, outputTokens: 800, cacheReadTokens: 0, cacheWriteTokens: 0 } };
const PLAN_USD = (1_000 * 1 + 100 * 5) / 1e6;
const ANSWER_USD = (4_000 * 5 + 800 * 25) / 1e6;

const ANSWER = { blocks: [
  { type: "paragraph", runs: [{ text: "は marks the topic." }] },
  { type: "context_card", entityRef: "ent:1", note: "today" },
  { type: "context_card", entityRef: "ent:999", note: "invented" },
  { type: "followups", chips: ["What about が?"] },
] };

const lineTool: Tool = async () => ({ status: "ok", data: { tokens: [
  { surface: "今日", base: "今日", reading: "キョウ", pos: "名詞", entSeq: 1, headword: "今日", gloss: "today", jlpt: 5 },
], grammar: [] } });

let knowledge: MemoryKnowledgeStore;
let korume: MemoryKorumeStore;
let fake: FakeProviderHandle;
let provider: AiProvider;

function deps(over: Partial<TurnDeps> = {}): TurnDeps {
  return {
    korume, knowledge: knowledge.store, provider, config: readKnowledgeConfig({}), aiEnabled: true, tier: "free",
    tools: { line_analysis: lineTool, knowledge_lookup: knowledgeTool }, clock: { toolMs: 50, stageMs: 80 }, ...over,
  };
}
const input = (over: Partial<TurnInput> = {}): TurnInput =>
  ({ supabase: {} as never, userId: ME, threadId: THREAD, turnId: TURN, text: "Why は here?", locale: "en", ...over });
const queueHappy = () => { fake.queueStructured({ steps: [{ tool: "line_analysis" }] }, PLAN_USAGE); fake.queueStructured(ANSWER, ANSWER_USAGE); };
const assistantRows = () => korume.messages.filter((m) => m.role === "ai");
const userRows = () => korume.messages.filter((m) => m.role === "user");

beforeEach(() => {
  vi.clearAllMocks();
  knowledge = createMemoryKnowledgeStore(START);
  korume = createMemoryKorumeStore(knowledge, ME);
  korume.threads.push({
    id: THREAD, userId: ME, kind: "ask_korume", title: null, originVideoId: VIDEO, originLineId: LINE,
    originSpan: null, originRoute: `/shadowing/${VIDEO}?line=${LINE}`, updatedAt: START.toISOString(),
  });
  korume.lines.push({ lineId: LINE, lineText: "今日は晴れ", translation: null, startTime: 1, videoId: VIDEO, videoTitle: "Ep" });
  fake = createFakeProvider();
  provider = { ...fake.provider, name: "anthropic" };
});

describe("runTurn — the happy path", () => {
  it("plans, retrieves, answers and settles once, persisting content, structure and grounding", async () => {
    queueHappy();
    const outcome = await runTurn(input(), deps());
    expect(outcome.status).toBe("answered");
    expect(fake.requests.map((r) => r.tier)).toEqual(["fast", "deep"]);
    expect(knowledge.generations.map((g) => [g.section, g.outcome, g.turnId])).toEqual([
      ["korume_plan", "success", TURN], ["korume_answer", "success", TURN],
    ]);
    expect(knowledge.reservations.map((r) => [r.status, r.entitlementKind, r.turnId])).toEqual([["settled", "korume_free_turn", TURN]]);
    expect(knowledge.charges).toHaveLength(1);
    expect(knowledge.charges[0]?.credits).toBe(0);
    const [stored] = assistantRows();
    expect(stored?.content).toBe("は marks the topic.\n\n今日: today");
    // The invented card is gone; the grounded one stays.
    expect(JSON.stringify(stored?.contentJson)).not.toContain("ent:999");
    expect(stored?.groundingJson).toEqual([{ id: "ent:1", label: "今日", kind: "vocabulary", gloss: "today", jlpt: "N5" }]);
    expect(korume.threads[0]?.title).toBe("Why は here?");
    if (outcome.status === "answered") expect(outcome.message).toMatchObject({ role: "assistant", turnId: TURN, grounding: stored?.groundingJson });
  });

  it("charges a Plus turn credits for what it actually cost", async () => {
    queueHappy();
    await runTurn(input(), deps({ tier: "plus" }));
    expect(knowledge.reservations[0]?.entitlementKind).toBe("korume_plus_turn");
    expect(knowledge.charges[0]?.credits).toBe(Math.ceil((PLAN_USD + ANSWER_USD) / 0.001));
  });
});

describe("runTurn — idempotency (spec §5.1)", () => {
  it("replays an answered turn with the same message and no provider call or reservation", async () => {
    queueHappy();
    const first = await runTurn(input(), deps());
    const second = await runTurn(input(), deps());
    expect(second).toEqual({ status: "answered", message: expect.objectContaining({ id: first.status === "answered" ? first.message.id : "x" }) });
    expect(fake.requests).toHaveLength(2);
    expect(knowledge.reservations).toHaveLength(1);
  });

  it("refuses the same turn id with a different question before reserving or calling anyone", async () => {
    queueHappy();
    await runTurn(input(), deps());
    const requests = fake.requests.length;
    await expect(runTurn(input({ text: "Something else" }), deps())).resolves.toEqual({ status: "conflict" });
    expect(fake.requests).toHaveLength(requests);
    expect(knowledge.reservations).toHaveLength(1);
  });

  it("treats whitespace and width variants of the same question as the same question", async () => {
    queueHappy();
    await runTurn(input(), deps());
    await expect(runTurn(input({ text: "  Why   は here?  " }), deps())).resolves.toMatchObject({ status: "answered" });
  });

  it("answers pending while another request holds the turn", async () => {
    await knowledge.store.reserve({
      requestedBy: ME, billingScope: "learner", entitlementKind: "korume_free_turn", fingerprint: `korume:${TURN}`, turnId: TURN,
      reservedCredits: 0, reservedUsd: 0.01, ttlSeconds: 180,
      limits: { globalUsdPerDay: 5, freeSentencesPerDay: 3, plusMaxSectionsPerDay: 200, plusCreditsPerMonth: 1000, askKorumeFreeTurnsPerDay: 10, askKorumePlusTurnsPerDay: 100, systemGenerationsPerUserPerDay: 100 },
    });
    await expect(runTurn(input(), deps())).resolves.toEqual({ status: "pending" });
    expect(fake.requests).toHaveLength(0);
  });

  it("runs again after a released attempt, reusing the stored question", async () => {
    fake.queueStructured({ steps: [] }, PLAN_USAGE);
    fake.queueError(new AiError("unavailable", "boom"));
    await expect(runTurn(input(), deps())).resolves.toEqual({ status: "answer_failed" });
    queueHappy();
    await expect(runTurn(input(), deps())).resolves.toMatchObject({ status: "answered" });
    expect(userRows()).toHaveLength(1);
    expect(knowledge.reservations.map((r) => r.status)).toEqual(["released", "settled"]);
  });

  it("runs one pipeline for two simultaneous sends of one turn (Correction 3)", async () => {
    queueHappy();
    const outcomes = await Promise.all([runTurn(input(), deps()), runTurn(input(), deps())]);
    expect(outcomes.map((o) => o.status).sort()).toEqual(["answered", "pending"]);
    expect(fake.requests).toHaveLength(2);
    expect(knowledge.reservations).toHaveLength(1);
    expect(userRows()).toHaveLength(1);
    expect(assistantRows()).toHaveLength(1);
  });
});

describe("runTurn — planner failures never fail the turn", () => {
  it("falls back to the anchor when the planner throws, and records a free provider_error", async () => {
    fake.queueError(new AiError("unavailable", "planner down"));
    fake.queueStructured(ANSWER, ANSWER_USAGE);
    await expect(runTurn(input(), deps())).resolves.toMatchObject({ status: "answered" });
    expect(knowledge.generations[0]).toMatchObject({ section: "korume_plan", outcome: "provider_error", estimatedCostUsd: 0 });
    expect(assistantRows()[0]?.groundingJson).toEqual([expect.objectContaining({ id: "ent:1" })]);
    expect(knowledge.charges).toHaveLength(1);
  });

  it("counts an invalid plan at its upper bound and falls back", async () => {
    fake.queueStructured({ steps: [{ tool: "write_memory" }] }, PLAN_USAGE);
    fake.queueStructured(ANSWER, ANSWER_USAGE);
    await expect(runTurn(input(), deps())).resolves.toMatchObject({ status: "answered" });
    expect(knowledge.generations[0]).toMatchObject({ section: "korume_plan", outcome: "validation_error" });
    expect(knowledge.generations[0]?.estimatedCostUsd).toBeGreaterThan(0);
  });
});

describe("runTurn — answer failures release, never charge", () => {
  it("releases with the planner's spend after an answer provider error, keeping the question", async () => {
    fake.queueStructured({ steps: [{ tool: "line_analysis" }] }, PLAN_USAGE);
    fake.queueError(new AiError("unavailable", "answer down"));
    const release = vi.spyOn(knowledge.store, "release");
    await expect(runTurn(input(), deps())).resolves.toEqual({ status: "answer_failed" });
    expect(release).toHaveBeenCalledWith(knowledge.reservations[0]?.id, PLAN_USD);
    expect(knowledge.charges).toHaveLength(0);
    expect(userRows()).toHaveLength(1);
    expect(assistantRows()).toHaveLength(0);
  });

  it("releases with planner + answer upper bound after an invalid answer", async () => {
    fake.queueStructured({ steps: [] }, PLAN_USAGE);
    fake.queueStructured({ blocks: [{ type: "html", html: "<b>" }] }, ANSWER_USAGE);
    const release = vi.spyOn(knowledge.store, "release");
    await expect(runTurn(input(), deps())).resolves.toEqual({ status: "answer_failed" });
    const spent = release.mock.calls[0]?.[1] as number;
    expect(spent).toBeGreaterThan(PLAN_USD);
    expect(knowledge.generations[1]).toMatchObject({ section: "korume_answer", outcome: "validation_error" });
    expect(knowledge.charges).toHaveLength(0);
  });
});

describe("runTurn — refusals before any spend", () => {
  it("answers the Free daily limit with the configured number and calls nobody", async () => {
    queueHappy();
    const config = { ...readKnowledgeConfig({}), askKorumeFreeTurnsPerDay: 0 };
    await expect(runTurn(input(), deps({ config }))).resolves.toMatchObject({ status: "quota_exhausted", reason: "free_daily_limit", limit: 0 });
    expect(fake.requests).toHaveLength(0);
    expect(userRows()).toHaveLength(0);
  });

  it("maps Plus credits and the Plus fuse", async () => {
    const credits = { ...readKnowledgeConfig({}), plusCreditsPerMonth: 0 };
    await expect(runTurn(input(), deps({ tier: "plus", config: credits }))).resolves.toMatchObject({ status: "quota_exhausted", reason: "plus_credits_exhausted" });
    const fuse = { ...readKnowledgeConfig({}), askKorumePlusTurnsPerDay: 0 };
    await expect(runTurn(input(), deps({ tier: "plus", config: fuse }))).resolves.toMatchObject({ status: "fuse_tripped" });
    expect(fake.requests).toHaveLength(0);
  });

  it("maps an exhausted global budget, and with AI off reserves nothing", async () => {
    const broke = { ...readKnowledgeConfig({}), globalBudgetUsdPerDay: 0.000_001 };
    await expect(runTurn(input(), deps({ config: broke }))).resolves.toEqual({ status: "ai_unavailable", reason: "budget" });
    await expect(runTurn(input(), deps({ aiEnabled: false }))).resolves.toEqual({ status: "ai_unavailable", reason: "disabled" });
    expect(knowledge.reservations).toHaveLength(0);
    expect(fake.requests).toHaveLength(0);
  });

  it("answers not_found for another learner's thread with no write and no call (spec §7.2)", async () => {
    korume.threads[0]!.userId = "f0000000-0000-4000-8000-000000000009";
    await expect(runTurn(input(), deps())).resolves.toEqual({ status: "not_found" });
    expect(korume.calls).toEqual(["readThreadRow"]);
    expect(knowledge.reservations).toHaveLength(0);
    expect(fake.requests).toHaveLength(0);
  });
});

describe("runTurn — retrieval stays read-only", () => {
  it("never generates Knowledge on a cache miss", async () => {
    fake.queueStructured({ steps: [{ tool: "knowledge_lookup", section: "lite" }] }, PLAN_USAGE);
    fake.queueStructured(ANSWER, ANSWER_USAGE);
    await expect(runTurn(input(), deps())).resolves.toMatchObject({ status: "answered" });
    expect(readCachedSection).toHaveBeenCalled();
    expect(getOrGenerateSection).not.toHaveBeenCalled();
  });
});

describe("runTurn — learner profile (spec §6.4, R4)", () => {
  const PROFILE = { nativeLanguage: "vi", targetJlptLevel: "N2", learningGoal: "Zebra-quartz goal", preferredPractices: ["shadowing"] };
  const text = (r: { system: { text: string }[]; messages: { content: unknown }[] }) => JSON.stringify([r.system, r.messages]);

  it("hands the profile to the answer prompt only, never to the planner", async () => {
    korume.profile = PROFILE;
    fake.queueStructured({ steps: [{ tool: "knowledge_lookup", section: "lite" }] }, PLAN_USAGE);
    fake.queueStructured(ANSWER, ANSWER_USAGE);
    await expect(runTurn(input(), deps())).resolves.toMatchObject({ status: "answered" });
    const [plan, answer] = fake.requests;
    expect(korume.calls).toContain("readLearnerProfile");
    expect(answer?.messages[0]?.content).toContain("<learner_profile>Native language: Vietnamese.");
    expect(answer?.messages[0]?.content).toContain("<locale>English</locale>");
    expect(text(plan!)).not.toMatch(/learner_profile|Zebra-quartz|Vietnamese/);
    expect(plan?.messages[0]?.content).toBe(plannerPrompt({ question: "Why は here?", anchor: { lineText: "今日は晴れ", videoTitle: "Ep" }, recent: [] }).user);
  });

  it("lets no Knowledge read see a profile field", async () => {
    korume.profile = PROFILE;
    fake.queueStructured({ steps: [{ tool: "knowledge_lookup", section: "lite" }] }, PLAN_USAGE);
    fake.queueStructured(ANSWER, ANSWER_USAGE);
    await runTurn(input(), deps());
    expect(readCachedSection).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(readCachedSection).mock.calls)).not.toMatch(/Zebra-quartz|"vi"|N2|shadowing|nativeLanguage|learner/);
    expect(getOrGenerateSection).not.toHaveBeenCalled();
  });

  it("leaves the answer prompt as it was for a learner with no profile", async () => {
    queueHappy();
    await runTurn(input(), deps());
    expect(fake.requests[1]?.messages[0]?.content).not.toContain("learner_profile");
  });
});
