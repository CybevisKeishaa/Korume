import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteMiningCard } from "@/lib/data/mining";

export async function DELETE(_request: Request, { params }: { params: { cardId: string } }) {
  if (!z.string().uuid().safeParse(params.cardId).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const result = await deleteMiningCard(params.cardId);
  if (!result.ok) {
    return NextResponse.json({ error: result.status === 401 ? "Unauthorized" : "Not found" }, { status: result.status });
  }
  return new NextResponse(null, { status: 204 });
}
