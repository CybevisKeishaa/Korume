import { NextResponse } from "next/server";
import { z } from "zod";
import { getVideo, setVideoDuration } from "@/lib/data/videos";
import { durationSchema } from "@/lib/validation/video";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const result = await getVideo(params.id);
  if (!result.ok) {
    const message = result.status === 401 ? "Unauthorized" : "Not found";
    return NextResponse.json({ error: message }, { status: result.status });
  }
  return NextResponse.json({ data: result.data });
}

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

  const parsed = durationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid duration", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await setVideoDuration(params.id, parsed.data.durationSeconds);
  if (!result.ok) {
    const message = result.status === 401 ? "Unauthorized" : "Not found";
    return NextResponse.json({ error: message }, { status: result.status });
  }
  return NextResponse.json({ data: result.data });
}
