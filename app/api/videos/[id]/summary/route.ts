import { NextResponse } from "next/server";
import { z } from "zod";
import { generateVideoSummary, getVideoSummary } from "@/lib/data/video-summary";

const FALLBACK_RETRY_AFTER_MS = 60_000;

const STATUS_MESSAGES: Record<number, string> = {
  401: "Unauthorized",
  404: "Video not found",
  422: "This video has no transcript to summarize yet",
  500: "Summarization is misconfigured",
  502: "Summarization failed, please try again",
  503: "Summarization is not configured",
};

/** GET /api/videos/[id]/summary — the cached AI-generated summary, if one exists. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const result = await getVideoSummary(params.id);
  if (!result.ok) {
    const message = result.status === 401 ? "Unauthorized" : "No summary yet";
    return NextResponse.json({ error: message }, { status: result.status });
  }
  return NextResponse.json({ data: result.data });
}

/**
 * POST /api/videos/[id]/summary — generate-once: returns the existing
 * summary (`cached: true`) if one was already generated, otherwise
 * summarises the video's transcript via Claude. Rate-limited (5 req/min/user).
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const result = await generateVideoSummary(params.id);
  if (!result.ok) {
    if (result.status === 429) {
      const retryAfterMs = result.retryAfter ?? FALLBACK_RETRY_AFTER_MS;
      return NextResponse.json(
        { error: "Too many summary requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
      );
    }
    const message = STATUS_MESSAGES[result.status] ?? "Could not generate summary";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json(
    { data: result.data, cached: result.cached, inputTruncated: result.inputTruncated ?? false },
    { status: result.cached ? 200 : 201 },
  );
}
