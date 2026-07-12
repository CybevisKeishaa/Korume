import { NextResponse } from "next/server";
import { z } from "zod";
import { updateProgress } from "@/lib/data/videos";
import { progressSchema } from "@/lib/validation/video";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = progressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid progress", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await updateProgress(params.id, parsed.data);
  if (!result.ok) {
    const message = result.status === 401 ? "Unauthorized" : "Invalid video";
    return NextResponse.json({ error: message }, { status: result.status });
  }
  return NextResponse.json({ data: result.data });
}
