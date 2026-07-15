// @vitest-environment node
/**
 * Tests for the Anthropic adapter — the first real implementation of the
 * `AiProvider` port (Task 5). These are the adapter-shape assertions that
 * used to live inside `lib/ai/content.test.ts` / `conversation.test.ts`
 * (tier→model mapping, cache_control placement, thinking config, typed error
 * mapping); they belong here now that the port exists.
 *
 * Runs in the `node` environment (not jsdom) — same reason as
 * conversation.test.ts: the Anthropic SDK refuses to construct under a
 * browser-like global unless `dangerouslyAllowBrowser` is set, which a
 * server-only adapter must never set.
 */
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { installClaudeMock, type ClaudeMockHandle } from "@/test/claude-mock";
import { claudeErrorResponse, claudeTextResponse } from "@/test/fixtures/claude-responses";
import { AiError } from "../errors";
import { createAnthropicProvider } from "./anthropic";

let mock: ClaudeMockHandle | undefined;

afterEach(() => {
  mock?.restore();
  mock = undefined;
});

const req = {
  tier: "deep" as const,
  system: [
    { text: "cached prefix", cacheable: true },
    { text: "variable suffix", cacheable: false },
  ],
  messages: [{ role: "user" as const, content: "hi" }],
  maxTokens: 512,
  reasoning: false,
};

describe("anthropic adapter", () => {
  it("maps tier to the model and marks only cacheable system blocks", async () => {
    mock = installClaudeMock({ responses: [{ body: claudeTextResponse("ok") }] });
    const provider = createAnthropicProvider("sk-ant-test");
    await provider.generateText(req);

    const body = mock.calls[0]?.body;
    expect(body?.model).toBe("claude-opus-4-8");
    const system = body?.system as Array<{ cache_control?: unknown }>;
    expect(system[0]?.cache_control).toEqual({ type: "ephemeral" });
    expect(system[1]?.cache_control).toBeUndefined();
  });

  it("maps the fast tier to Haiku", async () => {
    mock = installClaudeMock({ responses: [{ body: claudeTextResponse("ok") }] });
    const provider = createAnthropicProvider("sk-ant-test");
    await provider.generateText({ ...req, tier: "fast" });

    expect(mock.calls[0]?.body.model).toBe("claude-haiku-4-5-20251001");
  });

  it("sends output_config for structured output", async () => {
    mock = installClaudeMock({
      responses: [{ body: claudeTextResponse(JSON.stringify({ n: 1 })) }],
    });
    const provider = createAnthropicProvider("sk-ant-test");
    const result = await provider.generateStructured(req, z.object({ n: z.number() }));

    expect(result.parsed).toEqual({ n: 1 });
    const outputConfig = mock.calls[0]?.body.output_config as
      | { format?: { type?: string } }
      | undefined;
    expect(outputConfig?.format?.type).toBe("json_schema");
  });

  it("enables thinking only when reasoning is requested", async () => {
    mock = installClaudeMock({ responses: [{ body: claudeTextResponse("ok") }] });
    const provider = createAnthropicProvider("sk-ant-test");
    await provider.generateText({ ...req, reasoning: true });

    expect(mock.calls[0]?.body.thinking).toEqual({ type: "adaptive" });
  });

  it("does not send a thinking config when reasoning is not requested", async () => {
    mock = installClaudeMock({ responses: [{ body: claudeTextResponse("ok") }] });
    const provider = createAnthropicProvider("sk-ant-test");
    await provider.generateText(req);

    expect(mock.calls[0]?.body.thinking).toBeUndefined();
  });

  it("maps a 429 to the rate_limited kind", async () => {
    const fixture = claudeErrorResponse(429);
    mock = installClaudeMock({ responses: [{ status: fixture.status, body: fixture.body }] });
    const provider = createAnthropicProvider("sk-ant-test");

    await expect(provider.generateText(req)).rejects.toMatchObject({ kind: "rate_limited" });
  });

  it("maps a 401 to the auth kind", async () => {
    mock = installClaudeMock({
      responses: [
        {
          status: 401,
          body: {
            type: "error",
            error: { type: "authentication_error", message: "invalid x-api-key" },
          },
        },
      ],
    });
    const provider = createAnthropicProvider("sk-ant-test");

    await expect(provider.generateText(req)).rejects.toMatchObject({ kind: "auth" });
  });
});
