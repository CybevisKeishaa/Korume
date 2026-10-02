import { expect, expectTypeOf, it } from "vitest";
import { toTranscriptLineRow, type WorkspaceLine } from "./types";

it("keeps canonical numeric timing and narrowed furigana types", () => {
  expectTypeOf<WorkspaceLine["startTime"]>().toEqualTypeOf<number>();
  expectTypeOf<WorkspaceLine["furigana"]>().toEqualTypeOf<{ text: string; reading?: string }[] | null>();
});

it("adapts a workspace line back to the transcript row the mine and pin controls take", () => {
  const furigana = [{ text: "日本", reading: "にほん" }];
  expect(toTranscriptLineRow({ id: "l1", index: 4, startTime: 1.5, endTime: null, textJp: "日本", textTranslation: null, furigana }))
    .toEqual({ id: "l1", start_time: 1.5, end_time: null, text_jp: "日本", text_translation: null, furigana_json: furigana });
});
