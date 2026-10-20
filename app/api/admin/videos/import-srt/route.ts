import { NextResponse } from "next/server";
import { importVideoFromSrt } from "@/lib/data/admin-videos";
import { adminSrtImportSchema } from "@/lib/validation/admin-video";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = adminSrtImportSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors;
    // The first field message ("Subtitle file is too long…") is what the admin can act on.
    const first = Object.values(details).flat()[0];
    return NextResponse.json({ error: first ?? "Invalid import", details }, { status: 400 });
  }

  const result = await importVideoFromSrt(parsed.data);
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    if (result.status === 409) {
      return NextResponse.json(
        { error: "This video already has a lesson. Replacing its transcript needs confirmation.", exists: true },
        { status: 409 },
      );
    }
    const message =
      result.status === 401
        ? "Unauthorized"
        : result.status === 403
          ? "Forbidden"
          : result.status === 503
            ? "Could not read this video's title and thumbnail from YouTube"
            : "Could not parse the subtitle file, or it has more than 2,000 lines";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data }, { status: result.data.created ? 201 : 200 });
}
