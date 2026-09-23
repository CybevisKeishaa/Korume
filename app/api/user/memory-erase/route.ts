import { NextResponse } from "next/server";
import { eraseMyMemory } from "@/lib/data/memory-erase";
import { memoryEraseSchema } from "@/lib/validation/memory-erase";

const OPAQUE_ERROR = "Something went wrong. Please try again.";

/**
 * Erase Korume Memory (spec §4.8). Mirrors
 * `app/api/user/model-training-consent/route.ts`: the data layer rethrows raw
 * database errors, and this route is the boundary that MUST catch them so no
 * error string, code or stack reaches the client. The real error is logged
 * server-side only.
 *
 * The typed confirmation is re-validated here and not merely in the form.
 * The client half is UX; this half is the control — the same split
 * `DeleteDataDialog` makes for its own confirmation.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = memoryEraseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await eraseMyMemory();
    if (!result.ok) {
      if (result.status === 429) {
        return NextResponse.json(
          { error: "Too many requests, slow down" },
          { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
        );
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: result.status });
    }
    return NextResponse.json({ data: result.data });
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side only; never in the response body.
    console.error("[api/user/memory-erase] POST failed:", error);
    return NextResponse.json({ error: OPAQUE_ERROR }, { status: 500 });
  }
}
