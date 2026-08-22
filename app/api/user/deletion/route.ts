import { NextResponse } from "next/server";
import { cancelDeletion, getPendingDeletion, requestDeletion } from "@/lib/data/account-deletion";
import { deletionRequestSchema } from "@/lib/validation/account-deletion";

/**
 * The data layer (`lib/data/account-deletion.ts`) rethrows raw database
 * errors on unexpected failures; it never wraps them in a result. This route
 * is the boundary that MUST catch those throws and never let a database
 * error string, code, or stack reach the client — CLAUDE.md §2/§6, and the
 * exact defect class L9a closed five times (a raw server string reaching a
 * `role="alert"` node in the UI). The real error is logged server-side only.
 */
const OPAQUE_ERROR = "Something went wrong. Please try again.";

const opaque500 = (context: string, error: unknown): NextResponse => {
  // eslint-disable-next-line no-console -- server-side only; never in the response body.
  console.error(`[api/user/deletion] ${context}:`, error);
  return NextResponse.json({ error: OPAQUE_ERROR }, { status: 500 });
};

const tooMany = (retryAfter: number): NextResponse =>
  NextResponse.json(
    { error: "Too many requests, slow down" },
    { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfter / 1000)) } },
  );

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = deletionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await requestDeletion(parsed.data);
    if (!result.ok) {
      if (result.status === 429) return tooMany(result.retryAfter);
      if (result.status === 409) {
        return NextResponse.json({ error: "A deletion request is already pending" }, { status: 409 });
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: result.status });
    }
    return NextResponse.json({ data: result.data });
  } catch (error) {
    return opaque500("POST failed", error);
  }
}

export async function DELETE(): Promise<NextResponse> {
  try {
    const result = await cancelDeletion();
    if (!result.ok) {
      if (result.status === 429) return tooMany(result.retryAfter);
      if (result.status === 404) {
        return NextResponse.json({ error: "No pending deletion request" }, { status: 404 });
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: result.status });
    }
    return NextResponse.json({ data: { cancelled: true } });
  } catch (error) {
    return opaque500("DELETE failed", error);
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const result = await getPendingDeletion();
    if (!result.ok) {
      // Whole-branch review cleanup: spec §8 says rate-limit EVERY route, and
      // this was the one that was not. `PrivacyScreen.refreshPending()` maps
      // any non-OK response to `"unknown"` ("we could not check"), which is
      // the honest reading of a 429 — never "no request pending".
      if (result.status === 429) return tooMany(result.retryAfter);
      return NextResponse.json({ error: "Unauthorized" }, { status: result.status });
    }
    return NextResponse.json({ data: result.data });
  } catch (error) {
    return opaque500("GET failed", error);
  }
}
