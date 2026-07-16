import { NextResponse } from "next/server";
import { getJournal } from "@/lib/data/companion";

export async function GET() {
  const result = await getJournal();
  if (!result.ok) return NextResponse.json({ error: "Unauthorized" }, { status: result.status });
  return NextResponse.json({ data: result.data });
}
