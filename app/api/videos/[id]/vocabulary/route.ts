import { NextResponse } from "next/server";
import { z } from "zod";
import { VOCABULARY_PAGE_MAX, getLessonVocabulary } from "@/lib/analysis/lesson-vocabulary";

const querySchema = z.object({
  cursor: z.string().regex(/^\d{1,9}$/).optional(),
  limit: z.coerce.number().int().min(1).max(VOCABULARY_PAGE_MAX).optional(),
}).strict();

export async function GET(request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  if (!z.string().uuid().safeParse(params.id).success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  try {
    const result = await getLessonVocabulary(params.id, query.data);
    switch (result.kind) {
      case "unauthorized": return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      case "not_found": return NextResponse.json({ error: "Not found" }, { status: 404 });
      case "invalid_cursor": return NextResponse.json({ error: "Invalid input" }, { status: 400 });
      case "rate_limited": return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(result.retryAfter / 1000))) } },
      );
      case "ok": return NextResponse.json({ data: result.page }, { headers: { "Cache-Control": "private, no-store" } });
    }
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side diagnostics never reach the client.
    console.error("[api/videos/vocabulary] request failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
