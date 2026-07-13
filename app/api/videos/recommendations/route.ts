import { NextResponse } from "next/server";
import { getRecommendations } from "@/lib/data/recommendations";
import { recommendationsQuerySchema } from "@/lib/validation/recommendations";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = recommendationsQuerySchema.safeParse({
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await getRecommendations(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: result.status });
  }
  return NextResponse.json({ data: result.data });
}
