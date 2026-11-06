import { NextResponse } from "next/server";
import type { KanjiActionResult } from "@/lib/data/kanji-learner";

const MESSAGES: Record<number, string> = { 400: "Invalid kanji", 401: "Unauthorized", 404: "Not found" };

/** Shared route mapping for the kanji learner actions: result to JSON envelope, 429 `Retry-After`, opaque 500. */
export async function kanjiActionResponse(route: string, run: () => Promise<KanjiActionResult>, data: object): Promise<NextResponse> {
  try {
    const result = await run();
    if (result.ok) return NextResponse.json({ data });
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    return NextResponse.json({ error: MESSAGES[result.status] }, { status: result.status });
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side diagnostics never reach the client.
    console.error(`[api/kanji/${route}] request failed:`, error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
