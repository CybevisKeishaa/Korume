import { NextResponse } from "next/server";
import { z } from "zod";
import { generateVocabExamples } from "@/lib/data/vocab-examples";
import { generateVocabExamplesSchema } from "@/lib/validation/vocab-examples";

const FALLBACK_RETRY_AFTER_MS = 60_000;

const STATUS_MESSAGES: Record<number, string> = {
  401: "Unauthorized",
  404: "Vocab word not found",
  500: "Example generation is misconfigured",
  502: "Example generation failed, please try again",
  503: "Example generation is not configured",
};

/**
 * POST /api/vocab/[id]/examples {level?} — generates (or returns already-
 * generated) AI example sentences for a vocab word, labelled
 * `source: "ai_generated"`. Capped at 6 generated examples per word — once
 * reached, returns the existing rows instead of calling Claude again.
 * Rate-limited (5 req/min/user).
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: unknown = {};
  const rawText = await request.text();
  if (rawText.length > 0) {
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  const parsed = generateVocabExamplesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await generateVocabExamples(params.id, parsed.data.level);
  if (!result.ok) {
    if (result.status === 429) {
      const retryAfterMs = result.retryAfter ?? FALLBACK_RETRY_AFTER_MS;
      return NextResponse.json(
        { error: "Too many example requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
      );
    }
    const message = STATUS_MESSAGES[result.status] ?? "Could not generate examples";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data, cached: result.cached });
}
