import { NextResponse } from "next/server";
import { z } from "zod";
import { heartbeat } from "@/lib/data/study-time";
import { CONTEXT_ID_MAX } from "@/lib/study-time/constants";
import { STUDY_SURFACES, isValidContext } from "@/lib/study-time/surfaces";

// The server never trusts a client duration: .strict() rejects every key but these.
const bodySchema = z
  .object({
    clientPresenceId: z.string().uuid(),
    sessionId: z.string().uuid().nullable(),
    surface: z.enum(STUDY_SURFACES),
    contextId: z.string().max(CONTEXT_ID_MAX).nullable(),
    seq: z.number().int().min(0),
    kind: z.enum(["start", "beat", "stop"]),
  })
  .strict()
  .refine((b) => isValidContext(b.surface, b.contextId), { path: ["contextId"], message: "Invalid context" });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid heartbeat", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  try {
    const result = await heartbeat(parsed.data);
    switch (result.kind) {
      case "ok":
        return NextResponse.json({
          data: { sessionId: result.sessionId, acceptedSeq: result.acceptedSeq, segmented: result.segmented },
        });
      case "unauthorized":
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      case "not_found":
        return NextResponse.json({ error: "Unknown session" }, { status: 404 });
      case "rate_limited":
        return NextResponse.json(
          { error: "Too many heartbeats" },
          { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
        );
    }
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
