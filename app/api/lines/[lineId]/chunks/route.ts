import { NextResponse } from "next/server";
import { z } from "zod";
import { loadLineChunks } from "@/lib/data/line-chunks";

// The chunks are the line's answer: never shared across learners or cached.
const PRIVATE = { "Cache-Control": "private, no-store" };

export async function GET(_request: Request, { params }: { params: { lineId: string } }): Promise<NextResponse> {
  if (!z.string().uuid().safeParse(params.lineId).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400, headers: PRIVATE });
  }
  try {
    const result = await loadLineChunks(params.lineId);
    switch (result.kind) {
      case "unauthorized": return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: PRIVATE });
      case "not_found": return NextResponse.json({ error: "Not found" }, { status: 404, headers: PRIVATE });
      case "ok": return NextResponse.json({ data: result.data }, { headers: PRIVATE });
    }
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side diagnostics never reach the client.
    console.error("[api/lines/chunks] request failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500, headers: PRIVATE });
  }
}
