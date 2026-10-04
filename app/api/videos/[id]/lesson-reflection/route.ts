import { NextResponse } from "next/server";
import { z } from "zod";
import { requestLessonReflection } from "@/lib/summary/reflection/service";

const OPAQUE_ERROR = "Something went wrong. Please try again.";
const localeSchema = z.enum(["vi", "en"]);
const bodySchema = z.object({ locale: localeSchema }).strict();
const retryAfterSeconds = (ms: number) => String(Math.max(1, Math.ceil(ms / 1000)));
const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Spec §5.4. Every reflection state is a 200 except `pending` (202): `not_found` here means "no reflection yet",
 * which the client answers with a POST; a lesson the learner cannot see is the 404 with `{ error }`.
 */
async function respond(videoId: string, locale: "vi" | "en", mode: "read" | "generate"): Promise<NextResponse> {
  try {
    const result = await requestLessonReflection(videoId, locale, mode);
    switch (result.kind) {
      case "unauthorized": return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
      case "not_found": return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
      case "rate_limited": return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { ...NO_STORE, "Retry-After": retryAfterSeconds(result.retryAfter) } },
      );
    }
    const { body } = result;
    if (body.state === "pending") {
      return NextResponse.json(body, { status: 202, headers: { ...NO_STORE, "Retry-After": retryAfterSeconds(body.retryAfterMs) } });
    }
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side diagnostics never reach the client.
    console.error("[api/videos/lesson-reflection] request failed:", error);
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
