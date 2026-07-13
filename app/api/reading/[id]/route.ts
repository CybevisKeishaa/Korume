import { NextResponse } from "next/server";
import { z } from "zod";
import { getReadingPassageDetail } from "@/lib/data/reading";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const passage = await getReadingPassageDetail(params.id);
  if (!passage) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data: passage });
}
