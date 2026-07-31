import { NextResponse } from "next/server";
import { z } from "zod";
import { demoteVideo } from "@/lib/data/admin-videos";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const result = await demoteVideo(params.id);
  if (!result.ok) {
    const message = result.status === 401 ? "Unauthorized" : result.status === 403 ? "Forbidden" : "Not found";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}
