import { NextResponse } from "next/server";
import { readAdminLessonCreationJob } from "@/lib/data/lesson-creation-jobs";
import { lessonCreationJobIdSchema } from "@/lib/validation/lesson-creation";

/**
 * Reads one catalogue job. Scoped to the admin who requested it, not to the
 * admin role: this is a status endpoint, not a queue console.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const parsed = lessonCreationJobIdSchema.safeParse(params.id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const result = await readAdminLessonCreationJob(parsed.data);
  if (!result.ok) {
    const message = result.status === 401 ? "Unauthorized" : result.status === 403 ? "Forbidden" : "Not found";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}
