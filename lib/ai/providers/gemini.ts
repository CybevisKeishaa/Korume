/**
 * Gemini adapter — DEV-ONLY provider (CLAUDE.md §2 / Spec D7). `lib/ai/env.ts`
 * refuses to boot with `APP_ENV=production` + `AI_PROVIDER=gemini`: Gemini's
 * free tier permits Google to train on submitted data, so real user data must
 * never reach it. This adapter exists so local development can run without an
 * Anthropic key, not as a production path.
 *
 * The ONLY other place (besides providers/anthropic.ts) allowed to import a
 * provider SDK — enforced by the lint rule in Task 15.
 *
 * Capabilities are declared honestly for what THIS ADAPTER implements, not
 * for what the Gemini API could do in principle:
 *  - `promptCaching: false` — `gemini-3.1-flash-lite` advertises
 *    `createCachedContent`, but this adapter never calls it; `cacheable` on a
 *    `SystemBlock` is accepted by the port but has no effect here.
 *  - `reasoning: false` — no `thinkingConfig` is wired up; `req.reasoning` is
 *    ignored.
 *  - `structuredOutput: true` — implemented via `responseSchema` + JSON parse
 *    + zod validation (see `generateStructured` below).
 * A `false` here is not a bug: it surfaces as a startup capability-gap report
 * in dev and would block production, which is the designed outcome (Spec
 * §5.4). Never weaken the port to make a gap disappear.
 */
import { ApiError, FinishReason, GoogleGenAI } from "@google/genai";
import type { GenerateContentResponseUsageMetadata } from "@google/genai";
import { z } from "zod/v4";
import { AiError } from "../errors";
import type { AiProvider, AiRequest, AiResult, Tier, TokenUsage } from "../port";

function toSystemInstruction(req: AiRequest): string | undefined {
  const text = req.system.map((block) => block.text).join("\n\n");
  return text.length > 0 ? text : undefined;
}

function toContents(req: AiRequest) {
  return req.messages.map((turn) => ({
    role: turn.role === "ai" ? "model" : "user",
    parts: [{ text: turn.content }],
  }));
}

function toUsage(usage: GenerateContentResponseUsageMetadata | undefined): TokenUsage | null {
  if (!usage) return null;
  return {
    inputTokens: usage.promptTokenCount ?? 0,
    outputTokens: usage.candidatesTokenCount ?? 0,
    cacheReadTokens: usage.cachedContentTokenCount ?? 0,
    // This adapter never writes to the cache — see promptCaching: false above.
    cacheWriteTokens: 0,
  };
}

/**
 * Maps any thrown value onto the shared {@link AiErrorKind} union (Spec
 * §5.5) — the same union `providers/anthropic.ts` produces, which is what
 * keeps `lib/http-status.ts` provider-blind.
 *
 * `@google/genai` (v2.11.0, verified Task 7 Step 1) surfaces every HTTP
 * failure as its own exported `ApiError` class — `extends Error`, with only
 * `.name` and `.status: number` — not a family of typed subclasses the way
 * the Anthropic SDK does. Status code is therefore the only signal available.
 */
function mapError(err: unknown): AiError {
  if (err instanceof AiError) return err;

  if (err instanceof ApiError) {
    const status = err.status;
    if (status === 429) return new AiError("rate_limited", err.message, { cause: err });
    if (status === 401) return new AiError("auth", err.message, { cause: err });
    if (status >= 500) return new AiError("unavailable", err.message, { cause: err });
    return new AiError("unknown", err.message, { cause: err });
  }

  const message = err instanceof Error ? err.message : String(err);
  return new AiError("unknown", message, {
    cause: err instanceof Error ? err : undefined,
  });
}

/** Parses and validates a Gemini structured-output response against `schema`. */
function parseStructured<T>(text: string | undefined, schema: z.ZodType<T>): T {
  if (text == null) {
    throw new AiError("invalid_output", "Gemini returned no text to parse as structured output.");
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (parseErr) {
    throw new AiError("invalid_output", "Gemini response was not valid JSON.", {
      cause: parseErr instanceof Error ? parseErr : undefined,
    });
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    throw new AiError(
      "invalid_output",
      `Gemini response did not match the expected schema: ${result.error.message}`,
      { cause: result.error },
    );
  }
  return result.data;
}

/** Builds an {@link AiProvider} backed by the real Gemini `generateContent` API. */
export function createGeminiProvider(cfg: {
  apiKey: string;
  fastModel: string;
  deepModel: string;
}): AiProvider {
  const client = new GoogleGenAI({ apiKey: cfg.apiKey });
  const MODEL_BY_TIER: Record<Tier, string> = { fast: cfg.fastModel, deep: cfg.deepModel };

  return {
    name: "gemini",
    capabilities: { promptCaching: false, reasoning: false, structuredOutput: true },

    async generateText(req) {
      const model = MODEL_BY_TIER[req.tier];
      try {
        const response = await client.models.generateContent({
          model,
          contents: toContents(req),
          config: {
            systemInstruction: toSystemInstruction(req),
            maxOutputTokens: req.maxTokens,
          },
        });
        const finishReason = response.candidates?.[0]?.finishReason;
        return {
          text: response.text ?? "",
          model: response.modelVersion ?? model,
          truncated: finishReason === FinishReason.MAX_TOKENS,
          usage: toUsage(response.usageMetadata),
        } satisfies AiResult & { text: string };
      } catch (err) {
        throw mapError(err);
      }
    },

    async generateStructured<T>(req: AiRequest, schema: z.ZodType<T>) {
      const model = MODEL_BY_TIER[req.tier];
      try {
        const response = await client.models.generateContent({
          model,
          contents: toContents(req),
          config: {
            systemInstruction: toSystemInstruction(req),
            maxOutputTokens: req.maxTokens,
            responseMimeType: "application/json",
            responseSchema: z.toJSONSchema(schema),
          },
        });
        const parsed = parseStructured(response.text, schema);
        const finishReason = response.candidates?.[0]?.finishReason;
        return {
          parsed,
          model: response.modelVersion ?? model,
          truncated: finishReason === FinishReason.MAX_TOKENS,
          usage: toUsage(response.usageMetadata),
        };
      } catch (err) {
        throw mapError(err);
      }
    },
  };
}
