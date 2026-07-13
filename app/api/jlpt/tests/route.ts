import { NextResponse } from "next/server";
import { listJlptTests } from "@/lib/data/jlpt";
import { jlptTestsQuerySchema } from "@/lib/validation/jlpt";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = jlptTestsQuerySchema.safeParse({
    level: searchParams.get("level") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid level", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const data = await listJlptTests(parsed.data.level);
  return NextResponse.json({ data });
}
