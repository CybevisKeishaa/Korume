import { expectTypeOf, it } from "vitest";
import type { WorkspaceLine } from "./types";

it("keeps canonical numeric timing and narrowed furigana types", () => {
  expectTypeOf<WorkspaceLine["startTime"]>().toEqualTypeOf<number>();
  expectTypeOf<WorkspaceLine["furigana"]>().toEqualTypeOf<{ text: string; reading?: string }[] | null>();
});
