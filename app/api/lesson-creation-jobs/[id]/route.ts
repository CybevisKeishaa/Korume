import { NextResponse } from "next/server";
import { lessonCreationRefusalMessage } from "@/lib/http-status";
import { readLearnerLessonCreationJob } from "@/lib/data/lesson-creation-jobs";
import { lessonCreationJobIdSchema } from "@/lib/validation/lesson-creation";

/**
 * The poll target for a queued lesson. A job someone else requested and a job
 * that never existed both answer `404` with the same body: this endpoint must
 * not reveal that another learner is creating a given lesson.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const parsed = lessonCreationJobIdSchema.safeParse(params.id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const result = await readLearnerLessonCreationJob(parsed.data);
  if (!result.ok) {
    const message =
      result.status === 401 ? "Unauthorized" : result.status === 403 ? lessonCreationRefusalMessage(result.reason) : "Not found";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}
