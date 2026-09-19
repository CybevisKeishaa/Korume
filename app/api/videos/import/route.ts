import { NextResponse } from "next/server";
import { lessonCreationRefusalMessage } from "@/lib/http-status";
import { enqueueLearnerLessonCreationJob } from "@/lib/data/lesson-creation-jobs";
import { enqueueLessonCreationSchema } from "@/lib/validation/lesson-creation";

/**
 * The learner entry point keeps its path and its request body, but no longer
 * blocks on metadata or captions: it queues durable work and answers `202`
 * with the job to poll. A `202` never means a lesson exists — that is what the
 * job projection is for.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = enqueueLessonCreationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid video URL", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await enqueueLearnerLessonCreationJob({ youtubeVideoId: parsed.data.youtubeVideoId });
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
          ? lessonCreationRefusalMessage(result.reason)
          : "Lesson creation is temporarily unavailable";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data }, { status: 202 });
}
