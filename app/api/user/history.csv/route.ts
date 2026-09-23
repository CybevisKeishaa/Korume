import { NextResponse } from "next/server";
import { myLearningHistoryCsv } from "@/lib/data/user-export";

const OPAQUE_ERROR = "Something went wrong. Please try again.";

/** `korume-history-YYYY-MM-DD.csv` — the date the reader asked for it. */
function filename(now: Date): string {
  return `korume-history-${now.toISOString().slice(0, 10)}.csv`;
}

export async function GET(): Promise<NextResponse> {
  try {
    const now = new Date();
    const result = await myLearningHistoryCsv(now);

    if (!result.ok) {
      if (result.status === 429) {
        return NextResponse.json(
          { error: "Too many requests, slow down" },
          { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
        );
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: result.status });
    }

    return new NextResponse(result.csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename(now)}"`,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side only; never in the response body.
    console.error("[api/user/history.csv] GET failed:", error);
    return NextResponse.json({ error: OPAQUE_ERROR }, { status: 500 });
  }
}
