import { NextResponse } from "next/server";
import { reviewMiningCard } from "@/lib/data/mining";
import { reviewMiningCardSchema } from "@/lib/validation/mining";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = reviewMiningCardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid review", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await reviewMiningCard(parsed.data);
  if (!result.ok) {
    const message = result.status === 401 ? "Unauthorized" : "Invalid card";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}
