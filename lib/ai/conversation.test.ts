// @vitest-environment node
/**
 * Tests for the conversation chatbot + post-session corrections, and the
 * configured/not-configured gate. All requests go through the fetch-level
 * Claude mock — no real network (CLAUDE.md §7).
 *
 * Runs in the `node` environment (not jsdom): `lib/ai` is server-only, and the
 * Anthropic SDK refuses to construct under a browser-like global (jsdom) unless
 * `dangerouslyAllowBrowser` is set — which we must NOT set for a server module.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installClaudeMock, type ClaudeMockHandle } from "@/test/claude-mock";
import {
  claudeTextResponse,
  claudeTruncatedResponse,
} from "@/test/fixtures/claude-responses";
import { conversationReply, sessionCorrections } from "./conversation";
import { AiNotConfiguredError, type AiError } from "./errors";
import { SCENARIO_IDS } from "./scenarios";
import type { ScenarioId } from "./types";

let claude: ClaudeMockHandle | undefined;

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
});

afterEach(() => {
  claude?.restore();
  claude = undefined;
  vi.unstubAllEnvs();
});

/** Narrow the request body's `system` field to the block-array form. */
function systemBlocks(
  handle: ClaudeMockHandle,
  call = 0,
): Array<{ type: string; text: string; cache_control?: unknown }> {
  const system = handle.calls[call]?.body.system;
  if (!Array.isArray(system)) {
    throw new Error("expected system to be a block array");
  }
  return system as Array<{ type: string; text: string; cache_control?: unknown }>;
}

describe("conversationReply", () => {
  it("sends the model, the scenario system prompt (cached), and the level guidance", async () => {
    claude = installClaudeMock({
      responses: [{ body: claudeTextResponse("いらっしゃいませ。何名様ですか?") }],
    });

    const result = await conversationReply({
      scenario: "restaurant",
      level: "N4",
      messages: [{ role: "user", content: "こんばんは" }],
    });

    expect(result.reply).toBe("いらっしゃいませ。何名様ですか?");
    expect(result.truncated).toBe(false);
    expect(result.model).toBe("claude-opus-4-8");

    const body = claude.calls[0]?.body;
    expect(body?.model).toBe("claude-opus-4-8");
    expect(body?.max_tokens).toBe(1024);

    const blocks = systemBlocks(claude);
    expect(blocks[0]?.text).toContain("server at a casual Japanese restaurant");
    // Frozen scenario text is cached; level guidance is a separate uncached block.
    expect(blocks[0]?.cache_control).toEqual({ type: "ephemeral" });
    expect(blocks[1]?.text).toContain("N4");
    expect(blocks[1]?.cache_control).toBeUndefined();
  });

  it("passes prior turns through, mapping the `ai` role to `assistant`", async () => {
    claude = installClaudeMock({ responses: [{ body: claudeTextResponse("はい") }] });

    await conversationReply({
      scenario: "free-talk",
      level: "N3",
      messages: [
        { role: "user", content: "週末は何をしましたか?" },
        { role: "ai", content: "映画を見ました。" },
        { role: "user", content: "いいですね。" },
      ],
    });

    expect(claude.calls[0]?.body.messages).toEqual([
      { role: "user", content: "週末は何をしましたか?" },
      { role: "assistant", content: "映画を見ました。" },
      { role: "user", content: "いいですね。" },
    ]);
  });

  it("does not send a thinking config for the simple chat generation", async () => {
    claude = installClaudeMock({ responses: [{ body: claudeTextResponse("はい") }] });
    await conversationReply({
      scenario: "shopping",
      level: "N5",
      messages: [{ role: "user", content: "これをください" }],
    });
    expect(claude.calls[0]?.body.thinking).toBeUndefined();
  });

  it("flags a reply truncated by max_tokens", async () => {
    claude = installClaudeMock({
      responses: [{ body: claudeTruncatedResponse("すみません、ちょっと") }],
    });

    const result = await conversationReply({
      scenario: "directions",
      level: "N2",
      messages: [{ role: "user", content: "駅はどこですか?" }],
    });

    expect(result.truncated).toBe(true);
    expect(result.reply).toBe("すみません、ちょっと");
  });

  it("uses a distinct system prompt for each scenario id", async () => {
    const seen = new Set<string>();
    for (const scenario of SCENARIO_IDS) {
      claude?.restore();
      claude = installClaudeMock({ responses: [{ body: claudeTextResponse("x") }] });
      await conversationReply({
        scenario: scenario as ScenarioId,
        level: "N3",
        messages: [{ role: "user", content: "hi" }],
      });
      seen.add(systemBlocks(claude)[0]?.text ?? "");
    }
    expect(seen.size).toBe(SCENARIO_IDS.length);
  });
});

describe("sessionCorrections", () => {
  it("requests structured output and returns corrections + encouragement", async () => {
    const payload = {
      corrections: [
        {
          original: "私は学校に行く",
          corrected: "私は学校へ行きます",
          explanation: "Use へ for direction and the polite form 行きます.",
        },
      ],
      encouragement: "Great effort — your sentences are getting clearer!",
    };
    claude = installClaudeMock({
      responses: [{ body: claudeTextResponse(JSON.stringify(payload)) }],
    });

    const result = await sessionCorrections([
      { role: "user", content: "私は学校に行く" },
      { role: "ai", content: "そうですか。" },
    ]);

    expect(result.corrections).toEqual(payload.corrections);
    expect(result.encouragement).toBe(payload.encouragement);
    expect(result.model).toBe("claude-opus-4-8");

    const body = claude.calls[0]?.body;
    expect((body?.output_config as { format?: { type?: string } })?.format?.type).toBe(
      "json_schema",
    );
    // Grammar analysis benefits from reasoning → adaptive thinking.
    expect(body?.thinking).toEqual({ type: "adaptive" });
  });

  it("sends only the learner's (user) utterances for analysis", async () => {
    claude = installClaudeMock({
      responses: [
        { body: claudeTextResponse(JSON.stringify({ corrections: [], encouragement: "Nice!" })) },
      ],
    });

    await sessionCorrections([
      { role: "user", content: "美味しいでした" },
      { role: "ai", content: "本当ですか?" },
      { role: "user", content: "はい、とても" },
    ]);

    const messages = claude.calls[0]?.body.messages as Array<{ content: string }>;
    expect(messages[0]?.content).toContain("美味しいでした");
    expect(messages[0]?.content).toContain("はい、とても");
    // The AI's own line must not be fed back in as something to correct.
    expect(messages[0]?.content).not.toContain("本当ですか");
  });

  it("throws an invalid_output AiError when the response is not parseable", async () => {
    claude = installClaudeMock({
      responses: [{ body: claudeTextResponse("Sorry, I cannot do that.") }],
    });

    await expect(
      sessionCorrections([{ role: "user", content: "テスト" }]),
    ).rejects.toMatchObject({ kind: "invalid_output" });
  });
});

describe("configuration gate", () => {
  it("throws AiNotConfiguredError without making any request when unconfigured", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    claude = installClaudeMock({ responses: [{ body: claudeTextResponse("unused") }] });

    await expect(
      conversationReply({
        scenario: "restaurant",
        level: "N5",
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toBeInstanceOf(AiNotConfiguredError);

    // No fetch was attempted.
    expect(claude.calls).toHaveLength(0);
  });

  it("reports configuration status from isAiConfigured", async () => {
    const { isAiConfigured } = await import("./client");
    expect(isAiConfigured()).toBe(true);
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(isAiConfigured()).toBe(false);
  });

  it("surfaces the not_configured kind on the thrown error", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    let caught: AiError | undefined;
    try {
      await sessionCorrections([{ role: "user", content: "x" }]);
    } catch (err) {
      caught = err as AiError;
    }
    expect(caught?.kind).toBe("not_configured");
  });
});
