import { NextResponse } from "next/server";
import { z } from "zod";
import { lessonNoteBodySchema } from "@/lib/validation/notes";
import { deleteLessonNote, setLessonNote, type NoteWriteResult } from "@/lib/data/notes";

const OPAQUE_ERROR = "Something went wrong. Please try again.";

async function handle(request: Request, id: string, save: boolean): Promise<NextResponse> {
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  let note: string | null = null;
  if (save) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = lessonNoteBodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    note = parsed.data.body;
  }
  try {
    const result: NoteWriteResult = note === null ? await deleteLessonNote(id) : await setLessonNote(id, note);
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
    console.error("[api/videos/notes] request failed:", error);
    return NextResponse.json({ error: OPAQUE_ERROR }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) { return handle(request, params.id, true); }
export async function DELETE(request: Request, { params }: { params: { id: string } }) { return handle(request, params.id, false); }
