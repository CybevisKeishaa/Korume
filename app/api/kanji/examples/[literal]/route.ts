import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { getKanjiExamples } from "@/lib/data/kanji-lessons";
import { rateLimit } from "@/lib/rate-limit";
import { parseKanjiLiteral } from "@/lib/dictionary/literal";

/** `?offset=n` (integer 0-300) pages the lesson examples for one kanji, 3 at a time. */
export async function GET(request: Request, { params }: { params: { literal: string } }) {
  try {
    const literal = parseKanjiLiteral(params.literal);
    const raw = new URL(request.url).searchParams.get("offset") ?? "0";
    const offset = /^\d+$/.test(raw) ? Number(raw) : -1;
    if (!literal || offset > 300 || offset < 0) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const user = await requireUser(createClient());
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const limited = rateLimit(`kanji-examples:${user.id}`, { limit: 60, windowMs: 60_000 });
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(limited.retryAfter / 1000)) } },
      );
    }
    return NextResponse.json({ data: await getKanjiExamples(literal, offset) });
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side diagnostics never reach the client.
    console.error("[api/kanji/examples] request failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
