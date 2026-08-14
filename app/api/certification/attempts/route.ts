import { NextResponse } from "next/server";
import { listJlptAttempts } from "@/lib/data/jlpt";
import { jlptAttemptsQuerySchema } from "@/lib/validation/jlpt";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = jlptAttemptsQuerySchema.safeParse({
    testId: searchParams.get("testId") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid testId", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await listJlptAttempts(parsed.data.testId);
  if (!result.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: result.status });
  }
  return NextResponse.json({ data: result.data });
}
