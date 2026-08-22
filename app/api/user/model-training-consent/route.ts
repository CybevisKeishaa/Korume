import { NextResponse } from "next/server";
import { setModelTrainingConsent } from "@/lib/data/model-training-consent";
import { modelTrainingConsentSchema } from "@/lib/validation/model-training-consent";

/**
 * The data layer (`lib/data/model-training-consent.ts`) rethrows raw database
 * errors on unexpected failures; it never wraps them in a result. This route
 * is the boundary that MUST catch those throws and never let a database
 * error string, code, or stack reach the client — CLAUDE.md §2/§6, and the
 * exact defect class L9a closed five times (a raw server string reaching a
 * `role="alert"` node in the UI). The real error is logged server-side only.
 * Mirrors `app/api/user/deletion/route.ts`.
 */
const OPAQUE_ERROR = "Something went wrong. Please try again.";

const opaque500 = (context: string, error: unknown): NextResponse => {
  // eslint-disable-next-line no-console -- server-side only; never in the response body.
  console.error(`[api/user/model-training-consent] ${context}:`, error);
  return NextResponse.json({ error: OPAQUE_ERROR }, { status: 500 });
};

export async function PATCH(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = modelTrainingConsentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await setModelTrainingConsent(parsed.data);
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
    return opaque500("PATCH failed", error);
  }
}
