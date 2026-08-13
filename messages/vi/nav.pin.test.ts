import { describe, expect, it } from "vitest";
import vi from "./nav.json";

/**
 * Pins the Vietnamese nav literals that Phase 1b authors.
 *
 * This file replaces `messages/en/nav.pin.test.ts`, which Phase 1b deleted
 * rather than updated. That file had become three kinds of duplicate, and
 * `CLAUDE.md` §6 ("one fact, one home") now forbids keeping it:
 *   - its EN label pins are also in `components/layout/app-nav.test.tsx`'s
 *     `EXPECTED_LABELS`, which is strictly stronger — those are render-checked
 *     through NextIntlClientProvider, so they fail if the catalog value, the
 *     lookup key, or the rendering all stop agreeing;
 *   - its structural role is covered by that file's key-set parity test;
 *   - six of the nine keys it pinned no longer exist, their rows having been
 *     hidden or absorbed by the LOCKED IA (A2/A4/A5/A10).
 *
 * Vietnamese VALUES, by contrast, were pinned nowhere: `@/test/render` mounts
 * every component test at `locale="en"`, and `lib/i18n/catalog.test.ts` checks
 * that locales share key sets and ICU shapes — never what a string says. This
 * app is VN-first, so that was the gap worth filling.
 *
 * Only what 1b authors is pinned, matching the old file's scope rule. The
 * unchanged VN labels (Tổng quan, Bài học, …) are deliberately not restated.
 */
describe("nav.json VI — the literals Phase 1b authors", () => {
  it("pins the three new group headings", () => {
    expect(vi.groups.practice).toBe("Luyện tập");
    expect(vi.groups.remember).toBe("Ghi nhớ");
    // "Trưởng thành", not "Hành trình": the /roadmap row inside this group
    // owns "Hành trình" (A8), and a heading repeating it would read as a
    // duplicate. User ruling, 2026-08-13.
    expect(vi.groups.journey).toBe("Trưởng thành");
  });

  it("pins the two labels that carry a product decision", () => {
    expect(vi.mining).toBe("Bộ sưu tập"); // A7 — Mining becomes Collection
    expect(vi.roadmap).toBe("Hành trình"); // A8 — Journey moves off the Diary
  });

  it("pins the two new destinations, whose keys are screenIds not words", () => {
    expect(vi["pronunciation-library"]).toBe("Phát âm");
    expect(vi["companion-home"]).toBe("Đồng hành");
  });
});
