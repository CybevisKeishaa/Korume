/**
 * Scenario-based conversation chatbot and post-session grammar corrections.
 *
 * `conversationReply` is a simple generation (no reasoning). `sessionCorrections`
 * asks for structured output and benefits from reasoning, so it requests it.
 *
 * Both speak the provider-agnostic port (`AiProvider`) — never a specific SDK.
 * The active provider is injected via an optional last parameter defaulting to
 * `getProvider()` (the repo's clock-injection convention, per `lib/gamification`).
 */
import type { AiProvider } from "./port";
import { MAX_TOKENS } from "./constants";
import { getProvider } from "./registry";
import { CorrectionsSchema } from "./schemas";
import { levelGuidance, scenarioSystemPrompt } from "./scenarios";
import type {
  ConversationReplyInput,
  ConversationReplyResult,
  ConversationTurn,
  SessionCorrectionsResult,
} from "./types";

/**
 * One turn of scenario conversation. The frozen scenario prompt goes in a
 * cached system block; the learner's level guidance in a second, uncached one.
 * Returns the reply text plus a `truncated` flag (reply hit `max_tokens`).
 */
export async function conversationReply(
  input: ConversationReplyInput,
  provider: AiProvider = getProvider(),
): Promise<ConversationReplyResult> {
  const result = await provider.generateText({
    tier: "deep", // conversation = Opus (business-model.md)
    reasoning: false, // a reply is a simple generation
    maxTokens: MAX_TOKENS.chat,
    system: [
      { text: scenarioSystemPrompt(input.scenario), cacheable: true },
      { text: levelGuidance(input.level), cacheable: false },
    ],
    messages: input.messages,
  });

  return { reply: result.text, truncated: result.truncated, model: result.model };
}

const CORRECTIONS_SYSTEM =
  "You are a supportive Japanese teacher reviewing a learner's utterances from a finished conversation practice session. " +
  "Look ONLY at the learner's own Japanese sentences. Identify grammar, particle, conjugation, and word-choice mistakes. " +
  "For each mistake, give the original sentence, a corrected natural version, and a short explanation IN ENGLISH of what was wrong and why. " +
  "Do not invent mistakes; if a sentence is already correct, do not include it. " +
  "Also give one short, warm one-line encouragement in English.";

/**
 * Analyses the USER's utterances from a finished session and returns a
 * structured list of corrections plus a one-line encouragement. Non-user turns
 * are ignored. Structured output via {@link CorrectionsSchema}.
 */
export async function sessionCorrections(
  messages: ConversationTurn[],
  provider: AiProvider = getProvider(),
): Promise<SessionCorrectionsResult> {
  const userLines = messages
    .filter((turn) => turn.role === "user")
    .map((turn, i) => `${i + 1}. ${turn.content}`)
    .join("\n");

  const userContent =
    userLines.length > 0
      ? `Here are my Japanese sentences from the session:\n${userLines}`
      : "The learner did not produce any Japanese sentences this session.";

  const result = await provider.generateStructured(
    {
      tier: "fast",
      reasoning: true,
      maxTokens: MAX_TOKENS.corrections,
      system: [{ text: CORRECTIONS_SYSTEM, cacheable: true }],
      messages: [{ role: "user", content: userContent }],
    },
    CorrectionsSchema,
  );

  return {
    corrections: result.parsed.corrections,
    encouragement: result.parsed.encouragement,
    model: result.model,
  };
}
