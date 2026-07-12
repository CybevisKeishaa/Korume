import { NextResponse } from "next/server";
import { submitReview } from "@/lib/data/srs";
import { srsReviewSchema } from "@/lib/validation/content";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = srsReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid review", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await submitReview(parsed.data);
  if (!result.ok) {
    const message = result.status === 401 ? "Unauthorized" : "Invalid item";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}
