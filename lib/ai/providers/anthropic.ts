/**
 * Anthropic adapter. The ONLY place (besides providers/gemini.ts) allowed to
 * import a provider SDK — enforced by the lint rule in Task 15.
 *
 * Per the Anthropic API rules for these models: never send temperature/top_p/
 * top_k or a budget_tokens thinking config — they 400.
 *
 * `lib/ai/errors.ts` is not touched here: `toAiError` stays where it is and
 * this adapter just imports it. It relocates into this file in Task 10, once
 * the feature modules (conversation.ts, summary.ts, examples.ts) have moved
 * off the old code path and stopped importing it directly.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod/v4";
import { AiError, toAiError } from "../errors";
import type { AiProvider, AiRequest, AiResult, Tier, TokenUsage } from "../port";

const MODEL_BY_TIER: Record<Tier, string> = {
  fast: "claude-haiku-4-5-20251001",
  deep: "claude-opus-4-8",
};

function toSystem(req: AiRequest): Anthropic.Messages.TextBlockParam[] {
  return req.system.map((block) => ({
    type: "text",
    text: block.text,
    ...(block.cacheable ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));
}

function toMessages(req: AiRequest): Anthropic.Messages.MessageParam[] {
  return req.messages.map((turn) => ({
    role: turn.role === "ai" ? "assistant" : "user",
    content: turn.content,
  }));
}

function toUsage(usage: Anthropic.Messages.Usage | undefined): TokenUsage | null {
  if (!usage) return null;
  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
  };
}

function baseParams(req: AiRequest) {
  return {
    model: MODEL_BY_TIER[req.tier],
    max_tokens: req.maxTokens,
    system: toSystem(req),
    messages: toMessages(req),
    ...(req.reasoning ? { thinking: { type: "adaptive" as const } } : {}),
  };
}

/** Builds an {@link AiProvider} backed by the real Anthropic Messages API. */
export function createAnthropicProvider(apiKey: string): AiProvider {
  const client = new Anthropic({ apiKey, maxRetries: 0 });

  return {
    name: "anthropic",
    capabilities: { promptCaching: true, reasoning: true, structuredOutput: true },

    async generateText(req) {
      try {
        const response = await client.messages.create(baseParams(req));
        const text = response.content.find((b) => b.type === "text");
        return {
          text: text && text.type === "text" ? text.text : "",
          model: response.model,
          truncated: response.stop_reason === "max_tokens",
          usage: toUsage(response.usage),
        } satisfies AiResult & { text: string };
      } catch (err) {
        throw toAiError(err);
      }
    },

    async generateStructured<T>(req: AiRequest, schema: z.ZodType<T>) {
      try {
        const response = await client.messages.parse({
          ...baseParams(req),
          output_config: { format: zodOutputFormat(schema) },
        });
        if (response.parsed_output == null) {
          throw new AiError(
            "invalid_output",
            "Model response did not match the expected schema.",
          );
        }
        return {
          parsed: response.parsed_output as T,
          model: response.model,
          truncated: response.stop_reason === "max_tokens",
          usage: toUsage(response.usage),
        };
      } catch (err) {
        throw toAiError(err);
      }
    },
  };
}
