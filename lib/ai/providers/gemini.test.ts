// @vitest-environment node
/**
 * Tests for the Gemini adapter — the dev-only implementation of the
 * `AiProvider` port (Task 5). Gemini never runs in production (CLAUDE.md §2 /
 * Spec D7); this adapter exists to keep local development moving without an
 * Anthropic key.
 *
 * Mocks the `@google/genai` module rather than `fetch`: this adapter's job is
 * mapping the port onto the SDK's `models.generateContent` call, and that is
 * exactly what a module mock observes. `ApiError` is kept real (spread from
 * the actual module) so the fixtures constructed here are `instanceof` the
 * same class the adapter's error mapping checks against — see Step 1's
 * findings in the task report for why a generic `Error` + `.status` would not
 * have matched the real SDK shape.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";

const generateContent = vi.fn();
vi.mock("@google/genai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@google/genai")>();
  return {
    ...actual,
    GoogleGenAI: class {
      models = { generateContent };
    },
  };
});

// Import AFTER vi.mock so the adapter picks up the mocked module.
const { createGeminiProvider } = await import("./gemini");
const { ApiError } = await import("@google/genai");

const cfg = { apiKey: "test-key", fastModel: "model-fast", deepModel: "model-deep" };
const req = {
  tier: "fast" as const,
  system: [{ text: "sys", cacheable: true }],
  messages: [{ role: "user" as const, content: "hi" }],
  maxTokens: 100,
  reasoning: false,
};

/**
 * Shapes an error the way `@google/genai` actually surfaces HTTP failures
 * (verified against a live 400 response in Task 7 Step 1): the SDK throws its
 * own exported `ApiError` class — `extends Error`, `.name = "ApiError"`,
 * `.status: number` — not a bare `Error` with `.status` bolted on.
 */
const apiError = (status: number) => new ApiError({ message: `HTTP ${status}`, status });

/**
 * `vi.clearAllMocks()`, not `generateContent.mockReset()`: referencing the
 * `vi.mock`-captured `generateContent` binding from inside a `beforeEach`
 * closure (rather than from a test body) trips a phantom unhandled-rejection
 * failure on the rejection-mapping tests below, even though the adapter's
 * `try/catch` demonstrably maps the error correctly (verified by instrumenting
 * `generateText` directly). `vi.clearAllMocks()` resets the same mock without
 * closing over it here, and sidesteps the issue.
 */
beforeEach(() => vi.clearAllMocks());

describe("gemini adapter", () => {
  it("maps each tier to its configured model", async () => {
    generateContent.mockResolvedValue({ text: "ok" });
    const provider = createGeminiProvider(cfg);

    await provider.generateText(req);
    expect(generateContent.mock.calls[0]?.[0].model).toBe("model-fast");

    await provider.generateText({ ...req, tier: "deep" });
    expect(generateContent.mock.calls[1]?.[0].model).toBe("model-deep");
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
    expect(generateContent.mock.calls[0]?.[0].config.responseSchema).toBeDefined();
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

  it("maps a 500 onto the shared unavailable kind", async () => {
    generateContent.mockRejectedValue(apiError(500));
    await expect(createGeminiProvider(cfg).generateText(req)).rejects.toMatchObject({
      kind: "unavailable",
    });
  });

  it("maps output that fails the schema onto invalid_output", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ wrong: true }) });
    await expect(
      createGeminiProvider(cfg).generateStructured(req, z.object({ n: z.number() })),
    ).rejects.toMatchObject({ kind: "invalid_output" });
  });

  it("maps unparseable JSON onto invalid_output", async () => {
    generateContent.mockResolvedValue({ text: "not json" });
    await expect(
      createGeminiProvider(cfg).generateStructured(req, z.object({ n: z.number() })),
    ).rejects.toMatchObject({ kind: "invalid_output" });
  });

  it("declares capabilities honestly for what this adapter implements", () => {
    const provider = createGeminiProvider(cfg);
    expect(provider.capabilities).toEqual({
      promptCaching: false,
      reasoning: false,
      structuredOutput: true,
    });
  });
});
