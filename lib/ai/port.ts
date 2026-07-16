/**
 * The provider-agnostic port. Two operations, expressed in APPLICATION terms.
 *
 * Designed around the long-term product, never around whichever provider is
 * configured today (Spec §2). Specifically:
 *  - `system` is an array of blocks with a `cacheable` flag, not a string:
 *    prompt caching is the cost mechanism the Knowledge Economy rests on
 *    (business-model.md), and `conversationReply` already relies on a cached
 *    frozen scenario prompt plus an uncached level-guidance block.
 *  - `usage` is returned even though nothing reads it yet: the north-star
 *    "Knowledge Reuse Ratio" and "AI cost per active user" KPIs need token
 *    counts, and `cacheReadTokens` is reuse measured at the AI layer.
 *  - `reasoning` is independent of `tier`: sessionCorrections needs reasoning
 *    and conversationReply does not, yet both are conversation.
 *
 * `tier` is an application intent (cheap-and-cacheable vs deep). Model ids are a
 * PROVIDER concept and never cross this boundary (Spec D4).
 */
import type { z } from "zod/v4";
import type { AiProviderName } from "./env";
import type { ConversationTurn } from "./types";

export type Tier = "fast" | "deep";

export interface SystemBlock {
  text: string;
  /** Stable prefix → the adapter applies provider-native prompt caching. */
  cacheable: boolean;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface AiRequest {
  tier: Tier;
  system: SystemBlock[];
  messages: ConversationTurn[];
  maxTokens: number;
  reasoning: boolean;
}

export interface AiResult {
  /**
   * Resolved provider model id — traceability for CLAUDE.md §2 item 3 (all
   * study content must be original and attributed; knowing which model
   * produced a result is what makes it reviewable/attributable). Always
   * present.
   */
  model: string;
  truncated: boolean;
  usage: TokenUsage | null;
}

/** What a provider can honour. Compared against REQUIRED_CAPABILITIES at startup. */
export interface Capabilities {
  promptCaching: boolean;
  reasoning: boolean;
  structuredOutput: boolean;
}

export interface AiProvider {
  readonly name: AiProviderName;
  readonly capabilities: Capabilities;
  generateText(req: AiRequest): Promise<AiResult & { text: string }>;
  generateStructured<T>(req: AiRequest, schema: z.ZodType<T>): Promise<AiResult & { parsed: T }>;
}
