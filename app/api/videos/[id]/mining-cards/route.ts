import { NextResponse } from "next/server";
import { z } from "zod";
import { listMyMiningCardsForVideo } from "@/lib/data/mining";

/** GET /api/videos/[id]/mining-cards — this learner's cards from one lesson, in lesson order. */
export async function GET(_request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  if (!z.string().uuid().safeParse(params.id).success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    const result = await listMyMiningCardsForVideo(params.id);
    if (!result.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ data: result.data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side diagnostics never reach the client.
    console.error("[api/videos/mining-cards] request failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
