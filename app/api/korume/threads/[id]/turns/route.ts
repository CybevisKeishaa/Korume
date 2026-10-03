import { NextResponse } from "next/server";
import { z } from "zod";
import { postTurnSchema } from "@/lib/validation/korume";
import { postTurn } from "@/lib/data/korume";
import { korumeRefusal, korumeServerError } from "@/lib/korume/http";

const idSchema = z.string().uuid();
const secondsUntil = (iso: string) => String(Math.max(1, Math.ceil((Date.parse(iso) - Date.now()) / 1000)));

/** Spec §4.4: 200 answered · 202 pending · 400 · 401 · 402 · 403 · 404 · 409 · 429 · 502 · 503. */
export async function POST(request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  if (!idSchema.safeParse(params.id).success) return korumeRefusal({ kind: "not_found" });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return korumeRefusal({ kind: "invalid" });
  }
  const parsed = postTurnSchema.safeParse(body);
  if (!parsed.success) return korumeRefusal({ kind: "invalid" });
  try {
    const result = await postTurn(params.id, parsed.data);
    if ("kind" in result) return korumeRefusal(result);
    switch (result.status) {
      case "answered": return NextResponse.json({ message: result.message });
      case "pending": return NextResponse.json({ pending: true }, { status: 202 });
      case "not_found": return korumeRefusal({ kind: "not_found" });
      case "conflict": return NextResponse.json({ error: "turn_conflict" }, { status: 409 });
      case "quota_exhausted": return NextResponse.json(
        result.reason === "free_daily_limit"
          ? { error: "quota_exhausted", reason: result.reason, limit: result.limit, resetsAt: result.resetsAt }
          : { error: "quota_exhausted", reason: result.reason, resetsAt: result.resetsAt },
        { status: 402 },
      );
      case "fuse_tripped": return NextResponse.json(
        { error: "fuse_tripped", resetsAt: result.resetsAt }, { status: 429, headers: { "Retry-After": secondsUntil(result.resetsAt) } },
      );
      case "answer_failed": return NextResponse.json({ error: "answer_failed", retryable: true }, { status: 502 });
      case "ai_unavailable": return NextResponse.json({ error: "ai_unavailable", reason: result.reason }, { status: 503 });
    }
  } catch (error) {
    return korumeServerError("post turn", error);
  }
}
