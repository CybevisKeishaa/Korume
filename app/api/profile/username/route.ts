import { NextResponse } from "next/server";
import { checkUsername } from "@/lib/data/profile-write";

export async function GET(request: Request): Promise<NextResponse> {
  const value = new URL(request.url).searchParams.get("value") ?? "";
  try {
    const result = await checkUsername(value);
    if (result.ok) return NextResponse.json({ data: result.data });
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side only; never in the response body.
    console.error("[api/profile/username] GET failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
