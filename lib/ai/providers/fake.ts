/**
 * In-memory provider for FEATURE tests (Spec D6). Feature tests assert business
 * logic and must not know which provider exists; provider request/response
 * shape belongs in adapter tests.
 *
 * It validates queued structured output against the caller's schema so a test
 * cannot pass a shape the real providers would reject.
 */
import type { z } from "zod/v4";
import type { AiProvider, AiRequest, AiResult, Capabilities } from "../port";

type Queued =
  | { kind: "text"; text: string; opts?: Partial<AiResult> }
  | { kind: "structured"; parsed: unknown; opts?: Partial<AiResult> }
  | { kind: "error"; err: Error };

export interface FakeProviderHandle {
  provider: AiProvider;
  /** Every request received, in call order. */
  requests: AiRequest[];
  queueText(text: string, opts?: Partial<AiResult>): void;
  queueStructured(parsed: unknown, opts?: Partial<AiResult>): void;
  queueError(err: Error): void;
}

const FULL_CAPABILITIES: Capabilities = {
  promptCaching: true,
  reasoning: true,
  structuredOutput: true,
};

export function createFakeProvider(
  overrides: Partial<Capabilities> = {},
): FakeProviderHandle {
  const queue: Queued[] = [];
  const requests: AiRequest[] = [];

  const take = (req: AiRequest): Queued => {
    requests.push(req);
    const next = queue.shift();
    if (!next) throw new Error("FakeProvider: no response queued for this call.");
    if (next.kind === "error") throw next.err;
    return next;
  };

  const baseResult = (req: AiRequest, opts?: Partial<AiResult>): AiResult => ({
    model: `fake-${req.tier}`,
    truncated: false,
    usage: null,
    ...opts,
  });

  const provider: AiProvider = {
    name: "none",
    capabilities: { ...FULL_CAPABILITIES, ...overrides },

    async generateText(req) {
      const next = take(req);
      if (next.kind !== "text") throw new Error("FakeProvider: queued response is not text.");
      return { ...baseResult(req, next.opts), text: next.text };
    },

    async generateStructured<T>(req: AiRequest, schema: z.ZodType<T>) {
      const next = take(req);
      if (next.kind !== "structured") {
        throw new Error("FakeProvider: queued response is not structured.");
      }
      const parsed = schema.parse(next.parsed);
      return { ...baseResult(req, next.opts), parsed };
    },
  };

  return {
    provider,
    requests,
    queueText: (text, opts) => queue.push({ kind: "text", text, opts }),
    queueStructured: (parsed, opts) => queue.push({ kind: "structured", parsed, opts }),
    queueError: (err) => queue.push({ kind: "error", err }),
  };
}
