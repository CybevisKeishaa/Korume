import { NextResponse } from "next/server";
import { getKnowledgeUsage } from "@/lib/data/knowledge";

export async function GET(): Promise<NextResponse> {
  try {
    const result = await getKnowledgeUsage();
    if (result.kind === "unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (result.kind === "rate_limited") return NextResponse.json(
      { error: "Too many requests, slow down" },
      { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(result.retryAfter / 1000))) } },
    );
    return NextResponse.json({ data: result.usage }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side diagnostics never reach the client.
    console.error("[api/knowledge/usage] request failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
