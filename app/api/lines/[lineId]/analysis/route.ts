import { NextResponse } from "next/server";
import { z } from "zod";
import { getLineAnalysisForLearner } from "@/lib/analysis/line-analysis";

export async function GET(_request: Request, { params }: { params: { lineId: string } }): Promise<NextResponse> {
  if (!z.string().uuid().safeParse(params.lineId).success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    const result = await getLineAnalysisForLearner(params.lineId);
    switch (result.kind) {
      case "unauthorized": return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      case "not_found": return NextResponse.json({ error: "Not found" }, { status: 404 });
      case "rate_limited": return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(result.retryAfter / 1000))) } },
      );
      case "ok": return NextResponse.json({ data: result.analysis }, { headers: { "Cache-Control": "private, no-store" } });
    }
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side diagnostics never reach the client.
    console.error("[api/lines/analysis] request failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
