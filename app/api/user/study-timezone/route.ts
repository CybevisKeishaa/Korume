import { NextResponse } from "next/server";
import { z } from "zod";
import { detectStudyTimezone } from "@/lib/time/study-timezone";

const bodySchema = z.object({ timeZone: z.string().min(1).max(64) }).strict();

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  try {
    const result = await detectStudyTimezone(parsed.data.timeZone);
    switch (result) {
      case "saved":
      case "already_set": return new NextResponse(null, { status: 204 });
      case "invalid": return NextResponse.json({ error: "Invalid input" }, { status: 400 });
      case "unauthorized": return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side diagnostic only.
    console.error("[api/user/study-timezone] request failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
