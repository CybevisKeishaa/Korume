import { NextResponse } from "next/server";
import { lessonCreationRefusalMessage } from "@/lib/http-status";
import { retryLearnerLessonCreationJob } from "@/lib/data/lesson-creation-jobs";
import { lessonCreationJobIdSchema } from "@/lib/validation/lesson-creation";

/**
 * Re-queues the requester's own failed job. A job that is still queued,
 * running, or already succeeded is a `409`, not a second attempt — and an
 * unowned job stays a `404`, the same answer a missing one gets.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const parsed = lessonCreationJobIdSchema.safeParse(params.id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const result = await retryLearnerLessonCreationJob(parsed.data);
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many retries, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    const message =
      result.status === 401
        ? "Unauthorized"
        : result.status === 403
          ? lessonCreationRefusalMessage(result.reason)
          : result.status === 404
            ? "Not found"
            : "This job cannot be retried";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data }, { status: 202 });
}
