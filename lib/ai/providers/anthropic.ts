/**
 * Anthropic adapter. The ONLY place (besides providers/gemini.ts) allowed to
 * import a provider SDK — enforced by the lint rule in Task 15.
 *
 * Per the Anthropic API rules for these models: never send temperature/top_p/
 * top_k or a budget_tokens thinking config — they 400.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod/v4";
import { AiError, type AiErrorKind } from "../errors";
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

/**
 * Maps any thrown value into a typed {@link AiError}. Uses the SDK's typed
 * classes (never message string-matching), most-specific first:
 *   RateLimitError (429) → AuthenticationError (401) → APIConnectionError →
 *   APIError (5xx/429 → unavailable, else unknown) → AnthropicError base
 *   (structured-output parse failures) → unknown.
 */
function toAiError(err: unknown): AiError {
  if (err instanceof AiError) return err;

  // RateLimitError is a subclass of APIError — check it first.
  if (err instanceof Anthropic.RateLimitError) {
    return new AiError("rate_limited", err.message, { cause: err });
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return new AiError("auth", err.message, { cause: err });
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new AiError("unavailable", err.message, { cause: err });
  }
  if (err instanceof Anthropic.APIError) {
    const status = err.status ?? 0;
    const kind: AiErrorKind = status >= 500 || status === 429 ? "unavailable" : "unknown";
    return new AiError(kind, err.message, { cause: err });
  }
  // Base AnthropicError that isn't an APIError = client-side failure, most
  // notably `messages.parse()` failing to parse/validate structured output.
  if (err instanceof Anthropic.AnthropicError) {
    return new AiError("invalid_output", err.message, { cause: err });
  }

  const message = err instanceof Error ? err.message : String(err);
  return new AiError("unknown", message, {
    cause: err instanceof Error ? err : undefined,
  });
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
