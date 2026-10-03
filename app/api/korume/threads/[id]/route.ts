import { NextResponse } from "next/server";
import { z } from "zod";
import { getThread } from "@/lib/data/korume";
import { korumeRefusal, korumeServerError } from "@/lib/korume/http";

const idSchema = z.string().uuid();

/** Spec §4.3: the thread, its messages and `pendingTurns`. A malformed id is the same 404 as a missing one. */
export async function GET(_request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  if (!idSchema.safeParse(params.id).success) return korumeRefusal({ kind: "not_found" });
  try {
    const result = await getThread(params.id);
    if (result.kind !== "ok") return korumeRefusal(result);
    return NextResponse.json(result.detail);
  } catch (error) {
    return korumeServerError("read thread", error);
  }
}
