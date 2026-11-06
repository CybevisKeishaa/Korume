import { addKanjiToReview } from "@/lib/data/kanji-learner";
import { kanjiActionResponse } from "@/lib/kanji/action-response";

/** PUT starts reviewing a kanji; one already in review is left untouched. */
export async function PUT(_request: Request, { params }: { params: { literal: string } }) {
  return kanjiActionResponse("progress", () => addKanjiToReview(params.literal), { inReview: true });
}
