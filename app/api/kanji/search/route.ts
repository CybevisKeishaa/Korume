import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import { searchKanjiInSnapshot } from "@/lib/dictionary/kanji-data-service";

const querySchema = z.string().trim().min(1).max(40);

/** `?q=` (1–40 characters, trimmed) → kanji of the active snapshot (`lib/kanji/search.ts`), for the `/kanji/[literal]` search. */
export async function GET(request: Request) {
  try {
    const query = querySchema.safeParse(new URL(request.url).searchParams.get("q") ?? "");
    if (!query.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const user = await requireUser(createClient());
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const limited = rateLimit(`kanji-search:${user.id}`, { limit: 120, windowMs: 60_000 });
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(limited.retryAfter / 1000)) } },
      );
    }
    return NextResponse.json(await searchKanjiInSnapshot(query.data));
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side diagnostics never reach the client.
    console.error("[api/kanji/search] request failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
