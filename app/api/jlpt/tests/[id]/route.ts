import { NextResponse } from "next/server";
import { z } from "zod";
import { getJlptTestDetail } from "@/lib/data/jlpt";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const test = await getJlptTestDetail(params.id);
  if (!test) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data: test });
}
