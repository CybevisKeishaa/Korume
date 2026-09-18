import { NextResponse } from "next/server";
import { retryAdminLessonCreationJob } from "@/lib/data/lesson-creation-jobs";
import { lessonCreationJobIdSchema } from "@/lib/validation/lesson-creation";

/** Re-queues a failed catalogue job, scoped to the admin who requested it. */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const parsed = lessonCreationJobIdSchema.safeParse(params.id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const result = await retryAdminLessonCreationJob(parsed.data);
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
          ? "Forbidden"
          : result.status === 404
            ? "Not found"
            : "This job cannot be retried";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data }, { status: 202 });
}
