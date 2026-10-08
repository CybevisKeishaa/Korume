import { describe, expect, it } from "vitest";
import { JLPT_CURRICULUM } from "@/content/curriculum/jlpt";
import { validateCurriculumManifest } from "./manifest";

const empty = { N5: [], N4: [], N3: [], N2: [], N1: [] };

describe("validateCurriculumManifest", () => {
  it("accepts the empty production manifest", () => {
    expect(validateCurriculumManifest(empty)).toEqual([]);
    expect(validateCurriculumManifest(JLPT_CURRICULUM)).toEqual([]);
  });

  it("rejects a duplicate inside one level", () => {
    expect(validateCurriculumManifest({ ...empty, N5: ["abcdefghijk", "abcdefghijk"] })).toEqual([
      "N5 lists abcdefghijk twice",
    ]);
  });

  it("rejects a lesson in two levels", () => {
    expect(validateCurriculumManifest({ ...empty, N5: ["abcdefghijk"], N4: ["abcdefghijk"] })).toEqual([
      "abcdefghijk is in N5 and N4",
    ]);
  });

  it("rejects fixture-shaped ids so the e2e fixture never reaches production", () => {
    expect(validateCurriculumManifest({ ...empty, N5: ["e2e_curriculum_n5_02", "demo3"] })).toEqual([
      "N5: e2e_curriculum_n5_02 is a fixture id",
      "N5: demo3 is a fixture id",
    ]);
  });

  it("rejects an unknown level key", () => {
    expect(validateCurriculumManifest({ ...empty, N6: [] })).toEqual(["unknown level N6"]);
  });
});
