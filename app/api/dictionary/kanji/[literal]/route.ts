import { NextResponse } from "next/server";
import { getKanjiForLearner } from "@/lib/dictionary/kanji-data-service";

const MESSAGES: Record<number, string> = { 400: "Invalid kanji", 401: "Unauthorized", 404: "Not found" };

/** GET /api/dictionary/kanji/[literal] — KanjiQuickInspect data from the active dictionary snapshot. */
export async function GET(_request: Request, { params }: { params: { literal: string } }) {
  try {
    const result = await getKanjiForLearner(params.literal);
    if (result.ok) return NextResponse.json({ data: result.data });
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    return NextResponse.json({ error: MESSAGES[result.status] }, { status: result.status });
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side diagnostics never reach the client.
    console.error("[api/dictionary/kanji] request failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
