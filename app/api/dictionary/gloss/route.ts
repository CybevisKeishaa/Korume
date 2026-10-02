import { NextResponse } from "next/server";
import { glossBodySchema, glossQuerySchema } from "@/lib/validation/dictionary";
import { getGloss, requestGloss, type GlossResult } from "@/lib/dictionary/lookup";

function respond(result: GlossResult): NextResponse {
  switch (result.kind) {
    case "unauthorized": return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    case "not_found": return NextResponse.json({ error: "Not found" }, { status: 404 });
    case "unavailable": return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
    case "rate_limited": return NextResponse.json(
      { error: "Too many requests, slow down" },
      { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(result.retryAfter / 1000))) } },
    );
    case "ok": return NextResponse.json({ data: result.gloss }, { status: result.gloss.status === "pending" ? 202 : 200 });
  }
}

function failed(error: unknown): NextResponse {
  // eslint-disable-next-line no-console -- server-side diagnostics never reach the client.
  console.error("[api/dictionary/gloss] request failed:", error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

/** Read only: a curated or cached gloss, else `missing`. Never starts a generation. */
export async function GET(request: Request): Promise<NextResponse> {
  const parsed = glossQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  try {
    return respond(await getGloss(parsed.data.entryId));
  } catch (error) {
    return failed(error);
  }
}

/** An explicit learner action: requests a system-funded Vietnamese gloss. */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = glossBodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  try {
    return respond(await requestGloss(parsed.data.entryId));
  } catch (error) {
    return failed(error);
  }
}
