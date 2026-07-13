/**
 * Scenario-based conversation chatbot and post-session grammar corrections.
 *
 * `conversationReply` is a simple generation (no thinking). `sessionCorrections`
 * asks for structured output and benefits from reasoning, so it enables
 * adaptive thinking.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClient } from "./client";
import { AI_MODEL, MAX_TOKENS } from "./constants";
import { toAiError } from "./errors";
import { firstText, requireParsed } from "./run";
import { CorrectionsSchema } from "./schemas";
import { levelGuidance, scenarioSystemPrompt } from "./scenarios";
import type {
  ConversationReplyInput,
  ConversationReplyResult,
  ConversationTurn,
  SessionCorrectionsResult,
} from "./types";

/** Maps app turns (`ai`/`user`) to Anthropic message params (`assistant`/`user`). */
function toApiMessages(
  turns: ConversationTurn[],
): Anthropic.Messages.MessageParam[] {
  return turns.map((turn) => ({
    role: turn.role === "ai" ? "assistant" : "user",
    content: turn.content,
  }));
}

/**
 * One turn of scenario conversation. The frozen scenario prompt goes in a
 * cached system block; the learner's level guidance in a second, uncached one.
 * Returns the reply text plus a `truncated` flag (reply hit `max_tokens`).
 */
export async function conversationReply(
  input: ConversationReplyInput,
): Promise<ConversationReplyResult> {
  const client = getClient();

  const system: Anthropic.Messages.TextBlockParam[] = [
    {
      type: "text",
      text: scenarioSystemPrompt(input.scenario),
      cache_control: { type: "ephemeral" },
    },
    { type: "text", text: levelGuidance(input.level) },
  ];

  try {
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS.chat,
      system,
      messages: toApiMessages(input.messages),
    });

    return {
      reply: firstText(response.content),
      truncated: response.stop_reason === "max_tokens",
      model: response.model,
    };
  } catch (err) {
    throw toAiError(err);
  }
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
): Promise<SessionCorrectionsResult> {
  const client = getClient();

  const userLines = messages
    .filter((turn) => turn.role === "user")
    .map((turn, i) => `${i + 1}. ${turn.content}`)
    .join("\n");

  const userContent =
    userLines.length > 0
      ? `Here are my Japanese sentences from the session:\n${userLines}`
      : "The learner did not produce any Japanese sentences this session.";

  try {
    const response = await client.messages.parse({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS.corrections,
      thinking: { type: "adaptive" },
      system: [
        {
          type: "text",
          text: CORRECTIONS_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userContent }],
      output_config: { format: zodOutputFormat(CorrectionsSchema) },
    });

    const parsed = requireParsed(response.parsed_output);
    return {
      corrections: parsed.corrections,
      encouragement: parsed.encouragement,
      model: response.model,
    };
  } catch (err) {
    throw toAiError(err);
  }
}
