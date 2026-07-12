import { NextResponse } from "next/server";
import { z } from "zod";
import { getKanjiById } from "@/lib/data/content";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const kanji = await getKanjiById(params.id);
  if (!kanji) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data: kanji });
}
