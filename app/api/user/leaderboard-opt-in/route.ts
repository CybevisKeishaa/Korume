import { NextResponse } from "next/server";
import { setLeaderboardOptIn } from "@/lib/data/leaderboard";
import { leaderboardOptInSchema } from "@/lib/validation/leaderboard";

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = leaderboardOptInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const result = await setLeaderboardOptIn(parsed.data);
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
}
