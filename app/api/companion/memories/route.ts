import { NextResponse } from "next/server";
import { pinMemory } from "@/lib/data/companion";
import { pinMemorySchema } from "@/lib/validation/companion";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = pinMemorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid pin", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const result = await pinMemory(parsed.data);
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many pins, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    const message =
      result.status === 401 ? "Unauthorized" : result.status === 400 ? "Invalid transcript line" : "Could not pin";
    return NextResponse.json({ error: message }, { status: result.status });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
