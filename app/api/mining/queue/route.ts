import { NextResponse } from "next/server";
import { getMiningQueue } from "@/lib/data/mining";
import { miningQueueQuerySchema } from "@/lib/validation/mining";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = miningQueueQuerySchema.safeParse({
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await getMiningQueue(new Date(), parsed.data.limit);
  if (!result.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: result.status });
  }
  return NextResponse.json({ data: result.data });
}
