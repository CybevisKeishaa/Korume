import { NextResponse } from "next/server";
import { getMyPreferences, updateMyPreferences } from "@/lib/data/preferences";
import { preferencesPatchSchema } from "@/lib/validation/preferences";

const OPAQUE_ERROR = "Something went wrong. Please try again.";

const opaque500 = (context: string, error: unknown): NextResponse => {
  // eslint-disable-next-line no-console -- server-side only; never in the response body.
  console.error(`[api/user/preferences] ${context}:`, error);
  return NextResponse.json({ error: OPAQUE_ERROR }, { status: 500 });
};

export async function GET(): Promise<NextResponse> {
  try {
    const data = await getMyPreferences();
    if (!data) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ data });
  } catch (error) {
    return opaque500("GET failed", error);
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = preferencesPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await updateMyPreferences(parsed.data);
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
