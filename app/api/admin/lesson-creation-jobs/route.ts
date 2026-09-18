import { NextResponse } from "next/server";
import { enqueueAdminLessonCreationJob } from "@/lib/data/lesson-creation-jobs";
import { adminEnqueueLessonCreationSchema } from "@/lib/validation/lesson-creation";

/**
 * Catalogue seeding uses the same queue and the same worker as a learner's own
 * creation — there is no special synchronous admin path. `origin` is forced
 * server-side; the body may only name the video and a shippable access level
 * (`PRIVATE` belongs to the learner origin and the schema rejects it).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = adminEnqueueLessonCreationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid lesson creation request", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await enqueueAdminLessonCreationJob({
    youtubeVideoId: parsed.data.youtubeVideoId,
    libraryAccess: parsed.data.libraryAccess,
  });
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many imports, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    const message =
      result.status === 401
        ? "Unauthorized"
        : result.status === 403
          ? "Forbidden"
          : "Lesson creation is temporarily unavailable";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data }, { status: 202 });
}
