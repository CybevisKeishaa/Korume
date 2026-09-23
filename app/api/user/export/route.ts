import { NextResponse } from "next/server";
import { exportMyData } from "@/lib/data/user-export";

const OPAQUE_ERROR = "Something went wrong. Please try again.";

/** `korume-export-YYYY-MM-DD.json` — the date the reader asked for it. */
function filename(now: Date): string {
  return `korume-export-${now.toISOString().slice(0, 10)}.json`;
}

export async function GET(): Promise<NextResponse> {
  try {
    const now = new Date();
    const result = await exportMyData(now);

    if (!result.ok) {
      if (result.status === 429) {
        return NextResponse.json(
          { error: "Too many requests, slow down" },
          { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
        );
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: result.status });
    }

    return NextResponse.json(result.data, {
      headers: { "Content-Disposition": `attachment; filename="${filename(now)}"` },
    });
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side only; never in the response body.
    console.error("[api/user/export] GET failed:", error);
    return NextResponse.json({ error: OPAQUE_ERROR }, { status: 500 });
  }
}
