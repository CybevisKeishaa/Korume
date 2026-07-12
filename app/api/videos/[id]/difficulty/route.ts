import { NextResponse } from "next/server";
import { z } from "zod";
import { getVideoDifficulty } from "@/lib/data/difficulty";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const result = await getVideoDifficulty(params.id);
  if (!result.ok) {
    const message = result.status === 401 ? "Unauthorized" : "Video not found";
    return NextResponse.json({ error: message }, { status: result.status });
  }
  return NextResponse.json({ data: result.data });
}
