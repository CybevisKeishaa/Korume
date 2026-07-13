import { NextResponse } from "next/server";
import { z } from "zod";
import { getConversationMessages } from "@/lib/data/conversation";

/** GET /api/conversation/session/[id] — the full message history for one owned session. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const result = await getConversationMessages(params.id);
  if (!result.ok) {
    const message = result.status === 401 ? "Unauthorized" : "Session not found";
    return NextResponse.json({ error: message }, { status: result.status });
  }
  return NextResponse.json({ data: result.data });
}
