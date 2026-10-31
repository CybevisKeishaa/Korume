import { NextResponse } from "next/server";
import { z } from "zod";
import { loadLineCloze } from "@/lib/data/line-cloze";

// The blanks and their readings are the line's answer: never shared across learners or cached.
const PRIVATE = { "Cache-Control": "private, no-store" };

export async function GET(_request: Request, { params }: { params: { lineId: string } }): Promise<NextResponse> {
  if (!z.string().uuid().safeParse(params.lineId).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400, headers: PRIVATE });
  }
  try {
    const result = await loadLineCloze(params.lineId);
    switch (result.kind) {
      case "unauthorized": return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: PRIVATE });
      case "not_found": return NextResponse.json({ error: "Not found" }, { status: 404, headers: PRIVATE });
      case "rate_limited": return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { ...PRIVATE, "Retry-After": String(Math.max(1, Math.ceil(result.retryAfter / 1000))) } },
      );
      case "ok": return NextResponse.json({ data: result.data }, { headers: PRIVATE });
    }
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side diagnostics never reach the client.
    console.error("[api/lines/cloze] request failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500, headers: PRIVATE });
  }
}
