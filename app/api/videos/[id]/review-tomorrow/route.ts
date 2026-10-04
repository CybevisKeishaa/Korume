import { NextResponse } from "next/server";
import { z } from "zod";
import { scheduleReviewTomorrow } from "@/lib/summary/review-tomorrow";

const OPAQUE_ERROR = "Something went wrong. Please try again.";
const bodySchema = z.object({ timeZone: z.string().min(1).max(64) }).strict();
const retryAfterSeconds = (ms: number): string => String(Math.max(1, Math.ceil(ms / 1000)));

export async function POST(request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  try {
    const result = await scheduleReviewTomorrow(params.id, parsed.data.timeZone);
    switch (result.kind) {
      case "invalid": return NextResponse.json({ error: "Invalid input" }, { status: 400 });
      case "unauthorized": return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      case "not_found": return NextResponse.json({ error: "Not found" }, { status: 404 });
      case "rate_limited": return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { "Retry-After": retryAfterSeconds(result.retryAfter) } },
      );
      case "ok": return NextResponse.json({ data: { scheduled: result.scheduled, dueAt: result.dueAt } });
    }
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side diagnostics never reach the client.
    console.error("[api/videos/review-tomorrow] request failed:", error);
    return NextResponse.json({ error: OPAQUE_ERROR }, { status: 500 });
  }
}
