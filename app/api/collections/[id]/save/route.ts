import { NextResponse } from "next/server";
import { z } from "zod";
import { setCollectionSaved, type SaveCollectionResult } from "@/lib/data/collections";

/** PUT saves a learning path for the caller, DELETE unsaves it; both are idempotent. */
async function handle(id: string, saved: boolean): Promise<NextResponse> {
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const result: SaveCollectionResult = await setCollectionSaved(id, saved);
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    return NextResponse.json({ error: result.status === 401 ? "Unauthorized" : "Not found" }, { status: result.status });
  }

  return NextResponse.json({ data: { saved } });
}

export async function PUT(_request: Request, { params }: { params: { id: string } }) {
  return handle(params.id, true);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  return handle(params.id, false);
}
