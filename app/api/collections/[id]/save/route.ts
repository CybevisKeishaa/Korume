import { NextResponse } from "next/server";
import { z } from "zod";
import { setCollectionSaved, type SaveCollectionResult } from "@/lib/data/collections";

const OPAQUE_ERROR = "Something went wrong. Please try again.";

/** PUT saves a learning path for the caller, DELETE unsaves it; both are idempotent. */
async function handle(id: string, saved: boolean): Promise<NextResponse> {
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
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
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side diagnostics never reach the client.
    console.error("[api/collections/save] request failed:", error);
    return NextResponse.json({ error: OPAQUE_ERROR }, { status: 500 });
  }
}

export async function PUT(_request: Request, { params }: { params: { id: string } }) {
  return handle(params.id, true);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  return handle(params.id, false);
}
