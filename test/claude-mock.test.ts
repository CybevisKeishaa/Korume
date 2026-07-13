/**
 * Pattern test for `claude-mock.ts` — executable documentation for the
 * ai-engineer's `lib/ai` Claude wrapper. Exercises the mock directly against
 * `fetch` (standing in for whatever `lib/ai` will call under the hood,
 * whether that's a raw `fetch` or `new Anthropic().messages.create(...)` with
 * its default fetch — see the file-level comment in `claude-mock.ts`).
 */
import { afterEach, describe, expect, it } from "vitest";
import { installClaudeMock, type ClaudeMockHandle } from "./claude-mock";
import {
  claudeErrorResponse,
  claudeTextResponse,
  claudeToolUseResponse,
  claudeTruncatedResponse,
} from "./fixtures/claude-responses";

async function callMessagesApi(body: Record<string, unknown>): Promise<Response> {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": "test-key" },
    body: JSON.stringify(body),
  });
}

describe("installClaudeMock", () => {
  let claude: ClaudeMockHandle | undefined;

  afterEach(() => {
    claude?.restore();
    claude = undefined;
  });

  it("serves a queued text response and captures the request payload", async () => {
    claude = installClaudeMock({
      responses: [{ body: claudeTextResponse("こんにちは、元気ですか?") }],
    });

    const requestBody = {
      model: "claude-opus-4-8",
      system: "You are a Japanese conversation partner.",
      max_tokens: 1024,
      messages: [{ role: "user", content: "Say hello in Japanese." }],
    };
    const response = await callMessagesApi(requestBody);
    const json = (await response.json()) as { content: Array<{ type: string; text?: string }> };

    expect(response.status).toBe(200);
    expect(json.content[0]).toEqual({ type: "text", text: "こんにちは、元気ですか?" });

    // The captured request lets tests assert on exactly what lib/ai sent.
    expect(claude.calls).toHaveLength(1);
    expect(claude.calls[0]?.body.model).toBe("claude-opus-4-8");
    expect(claude.calls[0]?.body.system).toBe("You are a Japanese conversation partner.");
    expect(claude.calls[0]?.body.max_tokens).toBe(1024);
    expect(claude.calls[0]?.body.messages).toEqual([
      { role: "user", content: "Say hello in Japanese." },
    ]);
  });

  it("serves a tool-use response with a JSON payload", async () => {
    claude = installClaudeMock({
      responses: [
        {
          body: claudeToolUseResponse("generate_example_sentence", {
            word: "食べる",
            sentence: "朝ご飯を食べる。",
          }),
        },
      ],
    });

    const response = await callMessagesApi({
      model: "claude-opus-4-8",
      max_tokens: 512,
      messages: [{ role: "user", content: "Give an example sentence for 食べる." }],
      tools: [{ name: "generate_example_sentence", input_schema: {} }],
    });
    const json = (await response.json()) as {
      content: Array<{ type: string; name?: string; input?: Record<string, unknown> }>;
    };

    expect(json.content[0]?.type).toBe("tool_use");
    expect(json.content[0]?.name).toBe("generate_example_sentence");
    expect(json.content[0]?.input).toEqual({ word: "食べる", sentence: "朝ご飯を食べる。" });
  });

  it("serves a truncated (max_tokens) response", async () => {
    claude = installClaudeMock({
      responses: [{ body: claudeTruncatedResponse("This response gets cut off mid") }],
    });

    const response = await callMessagesApi({
      model: "claude-opus-4-8",
      max_tokens: 16,
      messages: [{ role: "user", content: "Write a long essay." }],
    });
    const json = (await response.json()) as { stop_reason: string };

    expect(json.stop_reason).toBe("max_tokens");
  });

  it("serves a 429 rate_limit_error", async () => {
    const fixture = claudeErrorResponse(429);
    claude = installClaudeMock({ responses: [{ status: fixture.status, body: fixture.body }] });

    const response = await callMessagesApi({
      model: "claude-opus-4-8",
      max_tokens: 16,
      messages: [{ role: "user", content: "Hi" }],
    });
    const json = (await response.json()) as { error: { type: string } };

    expect(response.status).toBe(429);
    expect(json.error.type).toBe("rate_limit_error");
  });

  it("serves a 529 overloaded_error", async () => {
    const fixture = claudeErrorResponse(529);
    claude = installClaudeMock({ responses: [{ status: fixture.status, body: fixture.body }] });

    const response = await callMessagesApi({
      model: "claude-opus-4-8",
      max_tokens: 16,
      messages: [{ role: "user", content: "Hi" }],
    });
    const json = (await response.json()) as { error: { type: string } };

    expect(response.status).toBe(529);
    expect(json.error.type).toBe("overloaded_error");
  });

  it("enqueue() adds responses for a second call once the initial queue is drained", async () => {
    claude = installClaudeMock({ responses: [{ body: claudeTextResponse("first") }] });
    claude.enqueue({ body: claudeTextResponse("second") });

    const first = await (await callMessagesApi({ model: "m", max_tokens: 1, messages: [] })).json();
    const second = await (await callMessagesApi({ model: "m", max_tokens: 1, messages: [] })).json();

    expect((first as { content: Array<{ text: string }> }).content[0]?.text).toBe("first");
    expect((second as { content: Array<{ text: string }> }).content[0]?.text).toBe("second");
    expect(claude.calls).toHaveLength(2);
  });

  it("throws instead of hitting the network when the queue is exhausted", async () => {
    claude = installClaudeMock({ responses: [] });
    await expect(callMessagesApi({ model: "m", max_tokens: 1, messages: [] })).rejects.toThrow(
      /no queued response/,
    );
  });

  it("throws instead of silently passing through a non-matching URL", async () => {
    claude = installClaudeMock({ responses: [{ body: claudeTextResponse("x") }] });
    await expect(fetch("https://example.com/not-claude")).rejects.toThrow(/non-matching URL/);
  });
});
