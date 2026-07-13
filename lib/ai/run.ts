/**
 * Small internal helpers shared by the feature wrappers: extracting text from a
 * message and unwrapping a parsed structured-output result with a null guard.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { AiError } from "./errors";

/** Returns the first `text` content block's text, or "" if there is none. */
export function firstText(content: Anthropic.Messages.ContentBlock[]): string {
  for (const block of content) {
    if (block.type === "text") return block.text;
  }
  return "";
}

/**
 * Unwraps `messages.parse()`'s `parsed_output`, throwing a typed
 * `invalid_output` {@link AiError} if it is null (the SDK sets it to null — or
 * throws — when the response can't be parsed/validated against the schema,
 * e.g. truncated JSON). Callers should wrap the surrounding call in
 * `toAiError` to catch the throw path too.
 */
export function requireParsed<T>(parsed: T | null | undefined): T {
  if (parsed == null) {
    throw new AiError(
      "invalid_output",
      "Claude response did not match the expected schema.",
    );
  }
  return parsed;
}
