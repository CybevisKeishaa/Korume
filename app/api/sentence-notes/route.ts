import { NextResponse } from "next/server";
import { SENTENCE_NOTE_MAX_BYTES, sentenceNoteBodySchema, sentenceNoteKeySchema } from "@/lib/validation/notes";
import { deleteSentenceNote, setSentenceNote, type NoteWriteResult } from "@/lib/data/notes";
import { readJsonBody } from "@/lib/http/read-json-body";

const OPAQUE_ERROR = "Something went wrong. Please try again.";

async function handle(request: Request, save: boolean): Promise<NextResponse> {
  const body = await readJsonBody(request, SENTENCE_NOTE_MAX_BYTES);
  if (!body.ok) return NextResponse.json({ error: body.status === 413 ? "Payload too large" : "Invalid JSON" }, { status: body.status });
  const parsed = save
    ? sentenceNoteBodySchema.safeParse(body.value)
    : sentenceNoteKeySchema.transform((key) => ({ ...key, body: null })).safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { transcriptLineId, body: note } = parsed.data;
  try {
    const result: NoteWriteResult = note === null
      ? await deleteSentenceNote(transcriptLineId)
      : await setSentenceNote(transcriptLineId, note);
    if (!result.ok) {
      if (result.status === 429) return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
      return NextResponse.json({ error: result.status === 401 ? "Unauthorized" : "Not found" }, { status: result.status });
    }
    return NextResponse.json({ data: { saved: save } });
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side diagnostics never reach the client.
    console.error("[api/sentence-notes] request failed:", error);
    return NextResponse.json({ error: OPAQUE_ERROR }, { status: 500 });
  }
}

export async function PUT(request: Request) { return handle(request, true); }
export async function DELETE(request: Request) { return handle(request, false); }
