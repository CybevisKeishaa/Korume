import { NextResponse } from "next/server";
import { z } from "zod";
import { createReview } from "@/lib/data/peer-review";
import { createReviewSchema } from "@/lib/validation/peer-review";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const result = await createReview(params.id, parsed.data);
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    if (result.status === 409) {
      return NextResponse.json({ error: "You have already reviewed this share" }, { status: 409 });
    }
    if (result.status === 403) {
      return NextResponse.json({ error: "You cannot review your own share" }, { status: 403 });
    }
    const message = result.status === 401 ? "Unauthorized" : "Not found";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data }, { status: 201 });
}
