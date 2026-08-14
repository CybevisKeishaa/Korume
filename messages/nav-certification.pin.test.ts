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
 * For EN, this catalog pin genuinely overlaps app-nav.test.tsx's render pin —
 * they are not mutually blind. `AppNav`'s `t(item.key …)` call in
 * components/layout/app-nav.tsx renders each item against the real EN catalog
 * (test/render.tsx loads the actual messages/en/*.json, not a fixture), so a
 * typo in `en/nav.json`'s `jlpt` value changes the rendered link's accessible
 * name and fails app-nav.test.tsx's `getByRole("link", { name: … })` lookup
 * too. What this pin adds for EN isn't coverage of a different mutation —
 * it's directness: a break here names the catalog string on its own, with no
 * render involved, instead of surfacing as "can't find a link named X" three
 * layers down. For VI, by contrast, this pin is not redundant with anything —
 * it is the only assertion of either kind, catalog or render, per the
 * `locale="en"` fact above. Keeping the EN half here rather than leaving VI
 * as a lone-locale file is a legibility choice: the pair reads symmetrically,
 * and a reader doesn't have to wonder why VI has a pin and EN doesn't.
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
