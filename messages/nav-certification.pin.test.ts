import { describe, expect, it } from "vitest";
import enNav from "./en/nav.json";
import viNav from "./vi/nav.json";

/**
 * A17 (user ruling, 2026-08-14): the certification module's nav row reads
 * "Certification" in EN and "Luyện thi" in VI — the ACTIVITY, not the
 * credential ("Chứng chỉ" was offered and declined).
 *
 * Pinned because nothing else asserts this row: there is no
 * messages/en/nav.pin.test.ts, and messages/vi/nav.pin.test.ts does not cover
 * it — so before this file, changing or reverting either label left the suite
 * green.
 *
 * ⚠️ The KEY stays `jlpt` on purpose. R9 makes `screenId` the catalog key and
 * the screenId was not renamed (Phase 1b precedent: identity is not renamed to
 * prettify a key). A14 is the same shape — a group's heading is not its id.
 * Renaming this key to `certification` is therefore a defect, not a tidy-up.
 */
describe("A17 — the certification nav row", () => {
  it("reads 'Certification' in EN, under the unchanged key `jlpt`", () => {
    expect(enNav.jlpt).toBe("Certification");
  });

  it("reads 'Luyện thi' in VI — the activity, not the credential", () => {
    expect(viNav.jlpt).toBe("Luyện thi");
  });
});
