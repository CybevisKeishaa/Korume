import { NextResponse } from "next/server";
import { knowledgeSectionRequestSchema } from "@/lib/validation/knowledge";
import { requestKnowledgeSection } from "@/lib/data/knowledge";

const OPAQUE_ERROR = "Something went wrong. Please try again.";
const retryAfterSeconds = (ms: number) => String(Math.max(1, Math.ceil(ms / 1000)));

/** Spec §5.3: 200 ready · 202 pending (poll) · 402 quota · 503 AI unavailable. The body never carries a price. */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = knowledgeSectionRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  try {
    const result = await requestKnowledgeSection(parsed.data);
    switch (result.kind) {
      case "unauthorized": return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      case "invalid": return NextResponse.json({ error: "Invalid input" }, { status: 400 });
      case "not_found": return NextResponse.json({ error: "Not found" }, { status: 404 });
      case "rate_limited": return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { "Retry-After": retryAfterSeconds(result.retryAfter) } },
      );
    }
    const { outcome, section } = result;
    switch (outcome.status) {
      case "ready":
        return NextResponse.json({
          data: { status: "ready", section, access: outcome.access, content: outcome.content, model: outcome.model, source: "ai_generated" },
        });
      case "pending":
        return NextResponse.json(
          { data: { status: "pending", section, retryAfterMs: outcome.retryAfterMs } },
          { status: 202, headers: { "Retry-After": retryAfterSeconds(outcome.retryAfterMs) } },
        );
      case "quota_exhausted":
        return NextResponse.json({ error: "quota_exhausted", resetsAt: outcome.resetsAt }, { status: 402 });
      case "ai_unavailable":
        return NextResponse.json({ error: "ai_unavailable", reason: outcome.reason }, { status: 503 });
    }
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side diagnostics never reach the client.
    console.error("[api/knowledge/sections] request failed:", error);
    return NextResponse.json({ error: OPAQUE_ERROR }, { status: 500 });
  }
}
