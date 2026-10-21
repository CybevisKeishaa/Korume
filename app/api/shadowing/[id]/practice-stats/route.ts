import { NextResponse } from "next/server";
import { z } from "zod";
import { loadPracticeStats } from "@/lib/data/practice-stats";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
const requestSchema = z.object({ id: z.string().uuid(), mode: z.enum(["pronunciation", "word_bank", "typing"]) });

export async function GET(request: Request, { params }: { params: { id: string } }): Promise<Response> {
  const parsed = requestSchema.safeParse({ id: params.id, mode: new URL(request.url).searchParams.get("mode") });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid lesson or mode" }, { status: 400, headers: PRIVATE_HEADERS });
  }

  try {
    const result = await loadPracticeStats(parsed.data.id, parsed.data.mode);
    if (!result.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: result.status, headers: PRIVATE_HEADERS });
    }
    return NextResponse.json({ data: result.data }, { headers: PRIVATE_HEADERS });
  } catch {
    return NextResponse.json({ error: "Could not load practice stats" }, { status: 500, headers: PRIVATE_HEADERS });
  }
}
