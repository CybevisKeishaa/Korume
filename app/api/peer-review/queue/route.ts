import { NextResponse } from "next/server";
import { listQueue } from "@/lib/data/peer-review";
import { peerReviewQueueQuerySchema } from "@/lib/validation/peer-review";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = peerReviewQueueQuerySchema.safeParse({
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const result = await listQueue(parsed.data);
  if (!result.ok) return NextResponse.json({ error: "Unauthorized" }, { status: result.status });
  return NextResponse.json({ data: result.data });
}
