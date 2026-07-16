// @vitest-environment node
/**
 * Tests for transcript summarisation and example-sentence generation. These
 * are FEATURE tests (Spec D6): they run against the in-memory fake provider
 * and assert business logic only (transcript capping, prompt content
 * selection, truncation/model propagation, error propagation). Request-shape
 * assertions (cache_control placement, output_config, literal model ids,
 * typed HTTP-status error mapping) belong to the adapter and live in
 * `lib/ai/providers/anthropic.test.ts`.
 *
 * Runs in the `node` environment (see conversation.test.ts for why).
 */
import { describe, expect, it } from "vitest";
import { createFakeProvider } from "./providers/fake";
import { MAX_TOKENS, TRANSCRIPT_CHAR_CAP } from "./constants";
import { summarizeTranscript } from "./summary";
import { generateExamples } from "./examples";
import { AiError, AiNotConfiguredError } from "./errors";

describe("summarizeTranscript", () => {
  const payload = {
    summary: "A short cooking vlog about making miso soup.",
    keyVocab: [{ word: "味噌", reading: "みそ", meaning: "miso" }],
    keyGrammar: [{ pattern: "〜てから", explanation: "after doing something" }],
  };

  it("returns the summary, key vocab, and key grammar mapped to columns", async () => {
    const fake = createFakeProvider();
    fake.queueStructured(payload);

    const result = await summarizeTranscript(
      {
        title: "味噌汁の作り方",
        lines: ["まず、だしを作ります。", "次に、味噌を入れます。"],
      },
      fake.provider,
    );

    expect(result.summary).toBe(payload.summary);
    expect(result.keyVocab).toEqual(payload.keyVocab);
    expect(result.keyGrammar).toEqual(payload.keyGrammar);
    expect(result.model).toBe("fake-fast");
    expect(result.inputTruncated).toBe(false);

    const req = fake.requests[0];
    // Deliberate tier/reasoning combination: cacheable fast tier + reasoning.
    expect(req?.tier).toBe("fast");
    expect(req?.reasoning).toBe(true);
    expect(req?.maxTokens).toBe(MAX_TOKENS.summary);
    expect(req?.system[0]?.cacheable).toBe(true);
    // Title and transcript reach the model.
    const userMessage = req?.messages[0]?.content ?? "";
    expect(userMessage).toContain("味噌汁の作り方");
    expect(userMessage).toContain("だしを作ります");
  });

  it("truncates an over-long transcript deterministically and flags it", async () => {
    const fake = createFakeProvider();
    fake.queueStructured(payload);

    const longLine = "あ".repeat(TRANSCRIPT_CHAR_CAP + 500);
    const result = await summarizeTranscript(
      { title: "Long", lines: [longLine] },
      fake.provider,
    );

    expect(result.inputTruncated).toBe(true);

    const userMessage = (fake.requests[0]?.messages[0]?.content ?? "") as string;
    // The prompt must not carry more transcript than the cap, and must say so.
    const transcriptPart = userMessage.split("Transcript:\n")[1] ?? "";
    expect(transcriptPart.length).toBeLessThan(longLine.length);
    expect(userMessage).toContain("truncated");
  });
});

describe("generateExamples", () => {
  it("returns 3 example sentences shaped for vocab_examples with an ai_generated source", async () => {
    const fake = createFakeProvider();
    const payload = {
      examples: [
        { sentenceJp: "毎朝ご飯を食べる。", sentenceTranslation: "I eat breakfast every morning." },
        { sentenceJp: "何を食べますか?", sentenceTranslation: "What will you eat?" },
        { sentenceJp: "もう食べました。", sentenceTranslation: "I already ate." },
      ],
    };
    fake.queueStructured(payload);

    const result = await generateExamples(
      { word: "食べる", reading: "たべる", meaning: "to eat", level: "N5" },
      fake.provider,
    );

    expect(result.examples).toEqual(payload.examples);
    expect(result.model).toBe("fake-fast");
    // AI-generated content is labelled so the human-review gate can find it (§3.3).
    expect(result.source).toBe("ai_generated");

    const req = fake.requests[0];
    expect(req?.tier).toBe("fast");
    expect(req?.reasoning).toBe(false);
    expect(req?.maxTokens).toBe(MAX_TOKENS.examples);
    expect(req?.system[0]?.cacheable).toBe(true);
    const userMessage = req?.messages[0]?.content ?? "";
    expect(userMessage).toContain("食べる");
    expect(userMessage).toContain("N5");
    // The "exactly 3" cardinality requirement lives in the prompt, not the schema.
    expect(userMessage).toContain("exactly 3");
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
      summarizeTranscript({ title: "t", lines: ["a"] }, fake.provider),
    ).rejects.toBeInstanceOf(AiNotConfiguredError);
  });

  it("propagates an invalid_output AiError from the provider unchanged", async () => {
    const fake = createFakeProvider();
    fake.queueError(
      new AiError("invalid_output", "Model response did not match the expected schema."),
    );

    await expect(
      generateExamples(
        { word: "本", reading: "ほん", meaning: "book", level: "N5" },
        fake.provider,
      ),
    ).rejects.toMatchObject({ kind: "invalid_output" });
  });
});
