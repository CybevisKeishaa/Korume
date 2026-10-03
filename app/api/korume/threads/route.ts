import { NextResponse } from "next/server";
import { createThreadSchema } from "@/lib/validation/korume";
import { createThread, listThreads } from "@/lib/data/korume";
import { korumeRefusal, korumeServerError } from "@/lib/korume/http";

/** Spec §4.1: 201 created · 200 idempotent replay · 400 · 401 · 403 · 404 · 409 · 429 · 503. */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return korumeRefusal({ kind: "invalid" });
  }
  const parsed = createThreadSchema.safeParse(body);
  if (!parsed.success) return korumeRefusal({ kind: "invalid" });
  try {
    const result = await createThread(parsed.data);
    if (result.kind !== "ok") return korumeRefusal(result);
    return NextResponse.json({ thread: result.thread }, { status: result.created ? 201 : 200 });
  } catch (error) {
    return korumeServerError("create thread", error);
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const cursor = new URL(request.url).searchParams.get("cursor");
  try {
    const result = await listThreads(cursor);
    if (result.kind !== "ok") return korumeRefusal(result);
    return NextResponse.json({ threads: result.threads, nextCursor: result.nextCursor });
  } catch (error) {
    return korumeServerError("list threads", error);
  }
}
