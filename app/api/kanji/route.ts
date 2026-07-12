import { NextResponse } from "next/server";
import { getKanjiList } from "@/lib/data/content";
import { levelQuerySchema } from "@/lib/validation/content";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = levelQuerySchema.safeParse({
    level: searchParams.get("level") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid level", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const data = await getKanjiList(parsed.data.level);
  return NextResponse.json({ data });
}
