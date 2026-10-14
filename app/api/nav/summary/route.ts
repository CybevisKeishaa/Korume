import { NextResponse } from "next/server";
import { getNavSummary } from "@/lib/data/nav-summary";

/** The sidebar's refresh read (spec §3.3). Per-user and private: never cached by Next or any shared cache. */
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET() {
  const data = await getNavSummary();
  if (!data) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  return NextResponse.json({ data }, { headers: NO_STORE });
}
