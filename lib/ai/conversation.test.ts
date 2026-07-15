// @vitest-environment node
/**
 * Tests for the conversation chatbot + post-session corrections. These are
 * FEATURE tests (Spec D6): they run against the in-memory fake provider and
 * assert business logic only (which turns get analysed, prompt content
 * selection, truncation/model propagation, error propagation). Request-shape
 * assertions (cache_control placement, output_config, literal model ids)
 * belong to the adapter and live in `lib/ai/providers/anthropic.test.ts`.
 *
 * Runs in the `node` environment (not jsdom) for consistency with the rest of
 * `lib/ai` — this module is server-only.
 */
import { describe, expect, it } from "vitest";
import { createFakeProvider } from "./providers/fake";
import { MAX_TOKENS } from "./constants";
import { conversationReply, sessionCorrections } from "./conversation";
import { AiError, AiNotConfiguredError } from "./errors";
import { SCENARIO_IDS } from "./scenarios";
import type { ScenarioId } from "./types";

describe("conversationReply", () => {
  it("requests tier=deep with the scenario system prompt (cached) and level guidance (uncached)", async () => {
    const fake = createFakeProvider();
    fake.queueText("いらっしゃいませ。何名様ですか?");

    const result = await conversationReply(
      {
        scenario: "restaurant",
        level: "N4",
        messages: [{ role: "user", content: "こんばんは" }],
      },
      fake.provider,
    );

    expect(result.reply).toBe("いらっしゃいませ。何名様ですか?");
    expect(result.truncated).toBe(false);
    expect(result.model).toBe("fake-deep");

    const req = fake.requests[0];
    expect(req?.tier).toBe("deep");
    expect(req?.maxTokens).toBe(MAX_TOKENS.chat);
    expect(req?.system[0]?.text).toContain("server at a casual Japanese restaurant");
    // Frozen scenario text is cached; level guidance is a separate uncached block.
    expect(req?.system[0]?.cacheable).toBe(true);
    expect(req?.system[1]?.text).toContain("N4");
    expect(req?.system[1]?.cacheable).toBe(false);
  });

  it("passes prior turns through unchanged and in order", async () => {
    const fake = createFakeProvider();
    fake.queueText("はい");

    const messages = [
      { role: "user" as const, content: "週末は何をしましたか?" },
      { role: "ai" as const, content: "映画を見ました。" },
      { role: "user" as const, content: "いいですね。" },
    ];

    await conversationReply({ scenario: "free-talk", level: "N3", messages }, fake.provider);

    expect(fake.requests[0]?.messages).toEqual(messages);
  });

  it("requests no reasoning — a reply is a simple generation", async () => {
    const fake = createFakeProvider();
    fake.queueText("はい");

    await conversationReply(
      { scenario: "shopping", level: "N5", messages: [{ role: "user", content: "これをください" }] },
      fake.provider,
    );

    expect(fake.requests[0]?.reasoning).toBe(false);
  });

  it("flags a reply truncated by max_tokens", async () => {
    const fake = createFakeProvider();
    fake.queueText("すみません、ちょっと", { truncated: true });

    const result = await conversationReply(
      { scenario: "directions", level: "N2", messages: [{ role: "user", content: "駅はどこですか?" }] },
      fake.provider,
    );

    expect(result.truncated).toBe(true);
    expect(result.reply).toBe("すみません、ちょっと");
  });

  it("uses a distinct system prompt for each scenario id", async () => {
    const seen = new Set<string>();
    for (const scenario of SCENARIO_IDS) {
      const fake = createFakeProvider();
      fake.queueText("x");
      await conversationReply(
        { scenario: scenario as ScenarioId, level: "N3", messages: [{ role: "user", content: "hi" }] },
        fake.provider,
      );
      seen.add(fake.requests[0]?.system[0]?.text ?? "");
    }
    expect(seen.size).toBe(SCENARIO_IDS.length);
  });
});

describe("sessionCorrections", () => {
  it("requests structured output (tier=fast, reasoning) and returns corrections + encouragement", async () => {
    const fake = createFakeProvider();
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
    fake.queueStructured(payload);

    const result = await sessionCorrections(
      [
        { role: "user", content: "私は学校に行く" },
        { role: "ai", content: "そうですか。" },
      ],
      fake.provider,
    );

    expect(result.corrections).toEqual(payload.corrections);
    expect(result.encouragement).toBe(payload.encouragement);
    expect(result.model).toBe("fake-fast");

    const req = fake.requests[0];
    expect(req?.tier).toBe("fast");
    // Grammar analysis benefits from reasoning.
    expect(req?.reasoning).toBe(true);
    expect(req?.maxTokens).toBe(MAX_TOKENS.corrections);
    expect(req?.system[0]?.cacheable).toBe(true);
  });

  it("sends only the learner's (user) utterances for analysis", async () => {
    const fake = createFakeProvider();
    fake.queueStructured({ corrections: [], encouragement: "Nice!" });

    await sessionCorrections(
      [
        { role: "user", content: "美味しいでした" },
        { role: "ai", content: "本当ですか?" },
        { role: "user", content: "はい、とても" },
      ],
      fake.provider,
    );

    const content = fake.requests[0]?.messages[0]?.content ?? "";
    expect(content).toContain("美味しいでした");
    expect(content).toContain("はい、とても");
    // The AI's own line must not be fed back in as something to correct.
    expect(content).not.toContain("本当ですか");
  });

  it("uses placeholder copy when the session had no user turns", async () => {
    const fake = createFakeProvider();
    fake.queueStructured({ corrections: [], encouragement: "Nice!" });

    await sessionCorrections([{ role: "ai", content: "こんにちは!" }], fake.provider);

    expect(fake.requests[0]?.messages[0]?.content).toBe(
      "The learner did not produce any Japanese sentences this session.",
    );
  });
});

describe("error propagation", () => {
  // Feature functions no longer wrap provider calls in try/catch — adapters
  // produce AiError directly now. These guard that removal: errors thrown by
  // the provider must reach the caller unchanged, not be swallowed or reshaped.
  it("propagates AiNotConfiguredError from the provider unchanged", async () => {
    const fake = createFakeProvider();
    fake.queueError(new AiNotConfiguredError());

    await expect(
      conversationReply(
        { scenario: "restaurant", level: "N5", messages: [{ role: "user", content: "hi" }] },
        fake.provider,
      ),
    ).rejects.toBeInstanceOf(AiNotConfiguredError);
  });

  it("propagates an invalid_output AiError from the provider unchanged", async () => {
    const fake = createFakeProvider();
    fake.queueError(
      new AiError("invalid_output", "Model response did not match the expected schema."),
    );

    await expect(
      sessionCorrections([{ role: "user", content: "テスト" }], fake.provider),
    ).rejects.toMatchObject({ kind: "invalid_output" });
  });
});
