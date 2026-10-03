import { afterEach, describe, expect, it, vi } from "vitest";
import { runRetrieval, type RetrievalContext, type Tool } from "./retrieval";

vi.mock("server-only", () => ({}));
vi.mock("./tools/line-analysis", () => ({ lineAnalysisTool: vi.fn() }));
vi.mock("./tools/dictionary", () => ({ dictionaryTool: vi.fn() }));
vi.mock("./tools/memory", () => ({ memoryTool: vi.fn() }));
vi.mock("./tools/knowledge", () => ({ knowledgeTool: vi.fn() }));
vi.mock("./tools/exposure", () => ({ exposureTool: vi.fn() }));

const ctx = { supabase: {}, userId: "u", tier: "free", locale: "en", anchor: null } as unknown as RetrievalContext;
const clock = { toolMs: 20, stageMs: 30 };
const ok: Tool = async () => ({ status: "ok", data: { fine: true } });
const never: Tool = () => new Promise(() => undefined);

afterEach(() => vi.restoreAllMocks());

describe("runRetrieval", () => {
  it("times out a hanging tool without holding up the others", async () => {
    const results = await runRetrieval(
      [{ tool: "dictionary_lookup", term: "は" }, { tool: "memory_lookup", topic: "は" }],
      ctx, { dictionary_lookup: never, memory_lookup: ok }, clock,
    );
    expect(results).toEqual([
      { tool: "dictionary_lookup", key: "dictionary_lookup:は", status: "error", errorCode: "timeout" },
      { tool: "memory_lookup", key: "memory_lookup:は", status: "ok", data: { fine: true } },
    ]);
  });

  it("turns a thrown error into a code and never leaks its message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const results = await runRetrieval(
      [{ tool: "dictionary_lookup", term: "は" }, { tool: "memory_lookup", topic: "x" }],
      ctx, { dictionary_lookup: async () => { throw new Error("db down"); }, memory_lookup: ok }, clock,
    );
    expect(results[0]).toEqual({ tool: "dictionary_lookup", key: "dictionary_lookup:は", status: "error", errorCode: "unavailable" });
    expect(results[1]?.status).toBe("ok");
    expect(JSON.stringify(results)).not.toContain("db down");
  });

  it("cuts every unfinished tool at the stage deadline and is not changed by a late finisher", async () => {
    const late: Tool = () => new Promise((resolve) => setTimeout(() => resolve({ status: "ok", data: 1 }), 25));
    const results = await runRetrieval([{ tool: "memory_lookup", topic: "x" }], ctx, { memory_lookup: late }, { toolMs: 100, stageMs: 10 });
    expect(results).toEqual([{ tool: "memory_lookup", key: "memory_lookup:x", status: "error", errorCode: "timeout" }]);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(results[0]?.status).toBe("error");
  });

  it("reports a planned tool with no implementation as unavailable", async () => {
    const results = await runRetrieval([{ tool: "learner_exposure", term: "は" }], ctx, {}, clock);
    expect(results).toEqual([{ tool: "learner_exposure", key: "learner_exposure:は", status: "error", errorCode: "unavailable" }]);
  });

  it("passes not_found through", async () => {
    const results = await runRetrieval([{ tool: "memory_lookup", topic: "x" }], ctx, { memory_lookup: async () => ({ status: "not_found" }) }, clock);
    expect(results).toEqual([{ tool: "memory_lookup", key: "memory_lookup:x", status: "not_found" }]);
  });
});
