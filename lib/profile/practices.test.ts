import { expect, it } from "vitest";
import { PREFERRED_PRACTICES } from "./practices";

it("lists the practice codes in order", () => {
  expect(PREFERRED_PRACTICES).toEqual([
    "shadowing", "listening", "pronunciation", "vocabulary", "kanji", "grammar", "reading", "conversation",
  ]);
});
