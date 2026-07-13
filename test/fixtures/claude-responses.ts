/**
 * Fixture builders for the Anthropic Messages API response shape
 * (`POST /v1/messages`), for use with `installClaudeMock` in `../claude-mock`.
 *
 * Shapes here mirror the real API: a `message`-typed response with a
 * `content` block array, `stop_reason`, and `usage`; error responses use the
 * `{type: "error", error: {type, message}}` envelope Anthropic returns on
 * every non-2xx response (429 `rate_limit_error`, 529 `overloaded_error`).
 * See CLAUDE.md §7 — lib/ai's tests must never hit the real API, so these
 * fixtures are the full substitute for a live response.
 */

export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface ClaudeTextBlock {
  type: "text";
  text: string;
}

export interface ClaudeToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type ClaudeContentBlock = ClaudeTextBlock | ClaudeToolUseBlock;

export type ClaudeStopReason =
  | "end_turn"
  | "max_tokens"
  | "stop_sequence"
  | "tool_use"
  | "refusal"
  | "pause_turn";

/** A `POST /v1/messages` success response body. */
export interface ClaudeMessageResponse {
  id: string;
  type: "message";
  role: "assistant";
  model: string;
  content: ClaudeContentBlock[];
  stop_reason: ClaudeStopReason;
  stop_sequence: string | null;
  usage: ClaudeUsage;
}

/** The `{type: "error", error: {...}}` envelope Anthropic returns on every non-2xx response. */
export interface ClaudeErrorBody {
  type: "error";
  error: {
    type: string;
    message: string;
  };
  request_id?: string;
}

/** A response body with a single `text` content block and `stop_reason: "end_turn"`. */
export function claudeTextResponse(
  text: string,
  overrides: Partial<ClaudeMessageResponse> = {},
): ClaudeMessageResponse {
  return {
    id: "msg_01TESTTEXTFIXTURE0000",
    type: "message",
    role: "assistant",
    model: "claude-opus-4-8",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 24, output_tokens: 18 },
    ...overrides,
  };
}

/**
 * A response body with a single `tool_use` content block — the JSON-payload
 * variant a tool-calling flow (e.g. structured example-sentence generation)
 * must parse from `content[0].input`.
 */
export function claudeToolUseResponse(
  toolName: string,
  input: Record<string, unknown>,
  overrides: Partial<ClaudeMessageResponse> = {},
): ClaudeMessageResponse {
  return {
    id: "msg_01TESTTOOLUSEFIXTURE0",
    type: "message",
    role: "assistant",
    model: "claude-opus-4-8",
    content: [
      {
        type: "tool_use",
        id: "toolu_01TESTTOOLUSEFIXTURE",
        name: toolName,
        input,
      },
    ],
    stop_reason: "tool_use",
    stop_sequence: null,
    usage: { input_tokens: 40, output_tokens: 12 },
    ...overrides,
  };
}

/**
 * A response truncated by the `max_tokens` cap — `stop_reason: "max_tokens"`
 * with a `text` block that (by construction of the fixture, same as a real
 * truncation) does not end on a natural sentence boundary. Callers should
 * assert their code detects this and either retries with a higher
 * `max_tokens` or surfaces a "response was cut off" state.
 */
export function claudeTruncatedResponse(
  text: string,
  overrides: Partial<ClaudeMessageResponse> = {},
): ClaudeMessageResponse {
  return {
    id: "msg_01TESTTRUNCATEDFIXTUR",
    type: "message",
    role: "assistant",
    model: "claude-opus-4-8",
    content: [{ type: "text", text }],
    stop_reason: "max_tokens",
    stop_sequence: null,
    usage: { input_tokens: 24, output_tokens: 1024 },
    ...overrides,
  };
}

export interface ClaudeErrorFixture {
  status: 429 | 529;
  body: ClaudeErrorBody;
}

/**
 * A `429 rate_limit_error` or `529 overloaded_error` response — both
 * retryable per Anthropic's own error-code semantics. `overrides` patches the
 * `error` object (e.g. a custom `message`) without needing to rebuild the
 * whole envelope.
 */
export function claudeErrorResponse(
  status: 429 | 529,
  overrides: Partial<ClaudeErrorBody["error"]> = {},
): ClaudeErrorFixture {
  const defaults =
    status === 429
      ? {
          type: "rate_limit_error",
          message:
            "Number of request tokens has exceeded your per-minute rate limit.",
        }
      : {
          type: "overloaded_error",
          message: "Overloaded",
        };
  return {
    status,
    body: {
      type: "error",
      error: { ...defaults, ...overrides },
      request_id: "req_01TESTERRORFIXTURE0000",
    },
  };
}
