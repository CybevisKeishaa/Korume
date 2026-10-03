import { NextResponse } from "next/server";

const retryAfterSeconds = (ms: number) => String(Math.max(1, Math.ceil(ms / 1000)));

type Refusal =
  | { kind: "unauthorized" } | { kind: "disabled" } | { kind: "unavailable" } | { kind: "invalid" }
  | { kind: "not_found" } | { kind: "conflict" } | { kind: "rate_limited"; retryAfter: number };

/**
 * The shared refusal bodies of `/api/korume/*` (spec §4.4). Every 404 is the same body whatever the reason — a
 * missing thread, someone else's, or a scenario session must be indistinguishable.
 */
export function korumeRefusal(result: Refusal): NextResponse {
  switch (result.kind) {
    case "unauthorized": return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    case "disabled": return NextResponse.json({ error: "companion_disabled" }, { status: 403 });
    case "unavailable": return NextResponse.json({ error: "ai_unavailable", reason: "preferences_unavailable" }, { status: 503 });
    case "invalid": return NextResponse.json({ error: "invalid" }, { status: 400 });
    case "not_found": return NextResponse.json({ error: "not_found" }, { status: 404 });
    case "conflict": return NextResponse.json({ error: "thread_conflict" }, { status: 409 });
    case "rate_limited": return NextResponse.json(
      { error: "rate_limited" }, { status: 429, headers: { "Retry-After": retryAfterSeconds(result.retryAfter) } },
    );
  }
}

export function korumeServerError(where: string, error: unknown): NextResponse {
  // eslint-disable-next-line no-console -- server-side diagnostics never reach the client.
  console.error(`[api/korume] ${where} failed:`, error);
  return NextResponse.json({ error: "server_error" }, { status: 500 });
}
