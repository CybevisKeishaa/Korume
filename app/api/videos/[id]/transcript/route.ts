import { NextResponse } from "next/server";
import { z } from "zod";
import { getTranscript, saveTranscript } from "@/lib/data/transcripts";
import { transcriptIngestSchema } from "@/lib/validation/video";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const result = await getTranscript(params.id);
  if (!result.ok) {
    const message = result.status === 401 ? "Unauthorized" : "Not found";
    return NextResponse.json({ error: message }, { status: result.status });
  }
  return NextResponse.json({ data: result.data });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = transcriptIngestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid transcript", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await saveTranscript(params.id, parsed.data);
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many transcript submissions, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    const message =
      result.status === 401 ? "Unauthorized" : result.status === 404 ? "Video not found" : "Could not parse transcript";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data }, { status: 201 });
}
