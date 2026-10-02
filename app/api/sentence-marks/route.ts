import { NextResponse } from "next/server";
import { sentenceMarkBodySchema } from "@/lib/validation/sentence-marks";
import { setSentenceMark, type SetSentenceMarkResult } from "@/lib/data/sentence-marks";

const OPAQUE_ERROR = "Something went wrong. Please try again.";

async function handle(request: Request, marked: boolean): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = sentenceMarkBodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  try {
    const result: SetSentenceMarkResult = await setSentenceMark(parsed.data.transcriptLineId, parsed.data.kind, marked);
    if (!result.ok) {
      if (result.status === 429) return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
      return NextResponse.json({ error: result.status === 401 ? "Unauthorized" : "Not found" }, { status: result.status });
    }
    return NextResponse.json({ data: { marked } });
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side diagnostics never reach the client.
    console.error("[api/sentence-marks] request failed:", error);
    return NextResponse.json({ error: OPAQUE_ERROR }, { status: 500 });
  }
}

export async function PUT(request: Request) { return handle(request, true); }
export async function DELETE(request: Request) { return handle(request, false); }
