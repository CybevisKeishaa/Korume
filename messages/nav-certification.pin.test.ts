import { describe, expect, it } from "vitest";
import enNav from "./en/nav.json";
import viNav from "./vi/nav.json";

/**
 * A17 (user ruling, 2026-08-14): the certification module's nav row reads
 * "Certification" in EN and "Luyện thi" in VI — the ACTIVITY, not the
 * credential ("Chứng chỉ" was offered and declined).
 *
 * No CATALOG-level pin covered either label before this file: there is no
 * messages/en/nav.pin.test.ts, and messages/vi/nav.pin.test.ts does not
 * mention `jlpt`.
 *
 * EN already had a RENDER-level pin, though:
 * components/layout/app-nav.test.tsx's `EXPECTED_LABELS.jlpt` asserts the
 * rendered link text directly (deliberately not sourced from nav.json, so the
 * check isn't circular) and was updated to "Certification" in the same commit
 * that changed the catalog value — before that edit, changing `jlpt` in
 * en/nav.json would have failed it immediately. VI has no render pin at all:
 * `@/test/render` mounts every component test at `locale="en"`, so Vietnamese
 * was genuinely unprotected at both levels. That is the real gap this file
 * closes.
 *
 * Both pins are kept, not just one: the render pin proves the UI wires the
 * right catalog KEY to the right nav row; this catalog pin proves the copy
 * ITSELF is stable — a typo introduced in nav.json without touching
 * app-nav.tsx would still pass the render pin (right key, wrong string) and
 * would only be caught here. Same shape as the two assertions kept side by
 * side in lib/product/nav-derivation.test.ts:13-17, for the same reason: each
 * one fails a mutation the other one's blind to.
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
