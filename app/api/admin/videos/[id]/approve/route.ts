import { NextResponse } from "next/server";
import { z } from "zod";
import { approveVideo } from "@/lib/data/admin-videos";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const result = await approveVideo(params.id);
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    const message = result.status === 401 ? "Unauthorized" : result.status === 403 ? "Forbidden" : "Not found";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}
