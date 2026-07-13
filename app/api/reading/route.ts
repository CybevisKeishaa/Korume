import { NextResponse } from "next/server";
import { listReadingPassages } from "@/lib/data/reading";
import { readingQuerySchema } from "@/lib/validation/reading";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = readingQuerySchema.safeParse({
    level: searchParams.get("level") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid level", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const data = await listReadingPassages(parsed.data.level);
  return NextResponse.json({ data });
}
