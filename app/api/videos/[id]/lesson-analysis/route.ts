import { NextResponse } from "next/server";
import { z } from "zod";
import { requestLessonAnalysis } from "@/lib/summary/analysis/service";
import type { AnalysisResponse } from "@/lib/summary/analysis/view";

const OPAQUE_ERROR = "Something went wrong. Please try again.";
const localeSchema = z.enum(["vi", "en"]);
const bodySchema = z.object({ locale: localeSchema }).strict();
const retryAfterSeconds = (ms: number) => String(Math.max(1, Math.ceil(ms / 1000)));
const NO_STORE = { "Cache-Control": "private, no-store" };

const STATUS: Record<AnalysisResponse["status"], number> = {
  ready: 200, pending: 202, not_ready: 404, no_transcript: 422, unavailable: 503, retryable_error: 503,
};

/** Spec §4.2: GET reads the shared lesson analysis, POST asks for it to be generated. Same body either way. */
async function respond(videoId: string, locale: "vi" | "en", mode: "read" | "generate"): Promise<NextResponse> {
  try {
    const result = await requestLessonAnalysis(videoId, locale, mode);
    switch (result.kind) {
      case "unauthorized": return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
      case "not_found": return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
      case "rate_limited": return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { ...NO_STORE, "Retry-After": retryAfterSeconds(result.retryAfter) } },
      );
    }
    const { body } = result;
    const headers: Record<string, string> = { ...NO_STORE };
    if (body.status === "pending") headers["Retry-After"] = retryAfterSeconds(body.retryAfterMs);
    if (body.status === "retryable_error") headers["Retry-After"] = retryAfterSeconds(new Date(body.retryAfter).getTime() - Date.now());
    return NextResponse.json(body, { status: STATUS[body.status], headers });
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side diagnostics never reach the client.
    console.error("[api/videos/lesson-analysis] request failed:", error);
    return NextResponse.json({ error: OPAQUE_ERROR }, { status: 500, headers: NO_STORE });
  }
}

const invalid = (error: string) => NextResponse.json({ error }, { status: 400, headers: NO_STORE });

export async function GET(request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  if (!z.string().uuid().safeParse(params.id).success) return invalid("Invalid id");
  const locale = localeSchema.safeParse(new URL(request.url).searchParams.get("locale"));
  if (!locale.success) return invalid("Invalid input");
  return respond(params.id, locale.data, "read");
}

export async function POST(request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  if (!z.string().uuid().safeParse(params.id).success) return invalid("Invalid id");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalid("Invalid JSON");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return invalid("Invalid input");
  return respond(params.id, parsed.data.locale, "generate");
}
