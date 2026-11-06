import { setKanjiFavorite } from "@/lib/data/kanji-learner";
import { kanjiActionResponse } from "@/lib/kanji/action-response";

/** PUT stars a kanji for the caller, DELETE unstars it; both are idempotent. */
export async function PUT(_request: Request, { params }: { params: { literal: string } }) {
  return kanjiActionResponse("favorites", () => setKanjiFavorite(params.literal, true), { favorite: true });
}

export async function DELETE(_request: Request, { params }: { params: { literal: string } }) {
  return kanjiActionResponse("favorites", () => setKanjiFavorite(params.literal, false), { favorite: false });
}
