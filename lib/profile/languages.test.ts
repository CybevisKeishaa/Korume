import { expect, it } from "vitest";
import { NATIVE_LANGUAGES } from "./languages";

it("lists the native-language codes in order", () => {
  expect(NATIVE_LANGUAGES).toEqual(["vi", "en", "ja", "zh", "ko", "th", "id", "fil", "fr", "de", "es"]);
});
