// @vitest-environment node
/**
 * Tests for transcript summarisation, example-sentence generation, and the
 * typed error mapping (429 / 529 / auth) shared by all wrappers.
 *
 * Runs in the `node` environment (see conversation.test.ts for why).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installClaudeMock, type ClaudeMockHandle } from "@/test/claude-mock";
import {
  claudeErrorResponse,
  claudeTextResponse,
} from "@/test/fixtures/claude-responses";
import { summarizeTranscript } from "./summary";
import { generateExamples } from "./examples";
import { TRANSCRIPT_CHAR_CAP } from "./constants";

let claude: ClaudeMockHandle | undefined;

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
});

afterEach(() => {
  claude?.restore();
  claude = undefined;
  vi.unstubAllEnvs();
});

describe("summarizeTranscript", () => {
  const payload = {
    summary: "A short cooking vlog about making miso soup.",
    keyVocab: [{ word: "味噌", reading: "みそ", meaning: "miso" }],
    keyGrammar: [{ pattern: "〜てから", explanation: "after doing something" }],
  };

  it("returns the summary, key vocab, and key grammar mapped to columns", async () => {
    claude = installClaudeMock({
      responses: [{ body: claudeTextResponse(JSON.stringify(payload)) }],
    });

    const result = await summarizeTranscript({
      title: "味噌汁の作り方",
      lines: ["まず、だしを作ります。", "次に、味噌を入れます。"],
    });

    expect(result.summary).toBe(payload.summary);
    expect(result.keyVocab).toEqual(payload.keyVocab);
    expect(result.keyGrammar).toEqual(payload.keyGrammar);
    expect(result.model).toBe("claude-opus-4-8");
    expect(result.inputTruncated).toBe(false);

    const body = claude.calls[0]?.body;
    expect(body?.max_tokens).toBe(4096);
    expect((body?.output_config as { format?: { type?: string } })?.format?.type).toBe(
      "json_schema",
    );
    expect(body?.thinking).toEqual({ type: "adaptive" });
    // Title and transcript reach the model.
    const userMessage = (body?.messages as Array<{ content: string }>)[0]?.content ?? "";
    expect(userMessage).toContain("味噌汁の作り方");
    expect(userMessage).toContain("だしを作ります");
  });

  it("truncates an over-long transcript deterministically and flags it", async () => {
    claude = installClaudeMock({
      responses: [{ body: claudeTextResponse(JSON.stringify(payload)) }],
    });

    const longLine = "あ".repeat(TRANSCRIPT_CHAR_CAP + 500);
    const result = await summarizeTranscript({ title: "Long", lines: [longLine] });

    expect(result.inputTruncated).toBe(true);

    const userMessage = (claude.calls[0]?.body.messages as Array<{ content: string }>)[0]
      ?.content as string;
    // The prompt must not carry more transcript than the cap, and must say so.
    const transcriptPart = userMessage.split("Transcript:\n")[1] ?? "";
    expect(transcriptPart.length).toBeLessThan(longLine.length);
    expect(userMessage).toContain("truncated");
  });
});

describe("generateExamples", () => {
  it("returns 3 example sentences shaped for vocab_examples with an ai_generated source", async () => {
    const payload = {
      examples: [
        { sentenceJp: "毎朝ご飯を食べる。", sentenceTranslation: "I eat breakfast every morning." },
        { sentenceJp: "何を食べますか?", sentenceTranslation: "What will you eat?" },
        { sentenceJp: "もう食べました。", sentenceTranslation: "I already ate." },
      ],
    };
    claude = installClaudeMock({
      responses: [{ body: claudeTextResponse(JSON.stringify(payload)) }],
    });

    const result = await generateExamples({
      word: "食べる",
      reading: "たべる",
      meaning: "to eat",
      level: "N5",
    });

    expect(result.examples).toEqual(payload.examples);
    expect(result.model).toBe("claude-opus-4-8");
    // AI-generated content is labelled so the human-review gate can find it (§3.3).
    expect(result.source).toBe("ai_generated");

    const body = claude.calls[0]?.body;
    expect(body?.max_tokens).toBe(1024);
    expect((body?.output_config as { format?: { type?: string } })?.format?.type).toBe(
      "json_schema",
    );
    const userMessage = (body?.messages as Array<{ content: string }>)[0]?.content ?? "";
    expect(userMessage).toContain("食べる");
    expect(userMessage).toContain("N5");
  });
});

describe("typed error mapping", () => {
  it("maps a 429 to a rate_limited AiError", async () => {
    const fixture = claudeErrorResponse(429);
    claude = installClaudeMock({
      responses: [{ status: fixture.status, body: fixture.body }],
    });

    await expect(
      generateExamples({ word: "本", reading: "ほん", meaning: "book", level: "N5" }),
    ).rejects.toMatchObject({ kind: "rate_limited" });
  });

  it("maps a 529 overloaded to an unavailable AiError", async () => {
    const fixture = claudeErrorResponse(529);
    claude = installClaudeMock({
      responses: [{ status: fixture.status, body: fixture.body }],
    });

    await expect(
      summarizeTranscript({ title: "t", lines: ["a"] }),
    ).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("maps a 401 to an auth AiError", async () => {
    claude = installClaudeMock({
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

    await expect(
      generateExamples({ word: "水", reading: "みず", meaning: "water", level: "N5" }),
    ).rejects.toMatchObject({ kind: "auth" });
  });
});
