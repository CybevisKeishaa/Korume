import { NextResponse } from "next/server";
import { listMine } from "@/lib/data/peer-review";

export async function GET() {
  const result = await listMine();
  if (!result.ok) return NextResponse.json({ error: "Unauthorized" }, { status: result.status });
  return NextResponse.json({ data: result.data });
}
