import { describe, expect, it } from "vitest";
import en from "./settings.json";
import vi from "../vi/settings.json";

/**
 * Characterization pins for `settings.json`. Copy corrected from Figma
 * 337:3323 / 339:3612 per spec §2 — the frames say "cannot be undone", the
 * LOCKED lifecycle is cancelable for 7 days, and the ruling chose the
 * lifecycle. These pins are what stops the wrong sentence coming back.
 *
 * `routing.defaultLocale` is `"vi"` — Vietnamese is the catalog most users
 * actually read, not `en`. An EN-only guard protects the locale almost
 * nobody sees and leaves the shipped one unguarded, so the guard below runs
 * against BOTH catalogs. `catalog.test.ts` never checks copy content (only
 * structure, ICU validity, argument names, tag names), so this file is the
 * only place either forbidden claim is caught.
 */
describe("settings.json EN — the 7-day window", () => {
  it("never claims the deletion is irreversible", () => {
    const all = JSON.stringify(en).toLowerCase();
    expect(all).not.toContain("cannot be undone");
    expect(all).not.toContain("permanently remove");
  });

  it("states the cancelable window in the dialog note", () => {
    expect(en.deleteDialog.note).toBe(
      "You have 7 days to change your mind. We keep your data untouched until then, and you can cancel any time from this page. Some records may be retained where required for legal, security, or billing purposes.",
    );
  });

  it("pins the two dialog buttons", () => {
    expect(en.deleteDialog.keep).toBe("Keep my data");
    expect(en.deleteDialog.confirm).toBe("Delete all my data");
  });

  it("pins the three Danger Zone rows", () => {
    expect(en.dangerZone.memory.title).toBe("Delete Korume Memory");
    expect(en.dangerZone.closeAccount.title).toBe("Delete Account");
    expect(en.dangerZone.eraseAll.title).toBe("Delete all my data");
  });

  it("names the consent toggle for what it actually covers", () => {
    expect(en.aiTraining.title).toBe("Help improve Korume's models");
    expect(en.aiTraining.body).toBe(
      "Let us use your recordings and learning data to improve our models. Off unless you turn it on. Your Companion remembers your learning either way — that is not model training.",
    );
  });
});

/**
 * `vi` is `routing.defaultLocale` — the catalog this product's primary
 * audience actually reads (spec D2, VN-first). The forbidden phrases are the
 * Vietnamese equivalents a designer or translator would realistically reach
 * for, not a literal back-translation of the English pair:
 *  - "không thể hoàn tác" — direct equivalent of "cannot be undone".
 *  - "không thể khôi phục" — "cannot be recovered/restored"; the natural way
 *    to say a deletion is unrecoverable, distinct from "undone" but carries
 *    the same irreversibility claim.
 *  - "không thể đảo ngược" — "cannot be reversed"; the direct rendering of
 *    "irreversible" as an adjective, a phrasing a stricter/legal-register
 *    translation would reach for.
 *  - "xóa vĩnh viễn không thể khôi phục" — the compound "permanently delete,
 *    cannot be recovered", the closest Vietnamese analogue of "permanently
 *    remove" when it is used to assert the ACTION itself is irrecoverable
 *    (as opposed to `dangerZone.eraseAll.body`'s "xóa vĩnh viễn" alone,
 *    which — like EN's "permanent deletion" — describes the true terminal
 *    state per spec §4 without claiming it happens immediately; every string
 *    adjacent to the action states the 7-day window explicitly).
 */
describe("settings.json VI — the 7-day window (primary learner locale)", () => {
  it("never claims the deletion is irreversible", () => {
    const all = JSON.stringify(vi).toLowerCase();
    expect(all).not.toContain("không thể hoàn tác");
    expect(all).not.toContain("không thể khôi phục");
    expect(all).not.toContain("không thể đảo ngược");
    expect(all).not.toContain("xóa vĩnh viễn không thể khôi phục");
  });

  it("states the cancelable window in the dialog note", () => {
    expect(vi.deleteDialog.note).toBe(
      "Bạn có 7 ngày để đổi ý. Trong thời gian đó dữ liệu được giữ nguyên và bạn có thể hủy bất cứ lúc nào ngay tại trang này. Một số bản ghi có thể được lưu lại khi pháp luật, bảo mật hoặc thanh toán yêu cầu.",
    );
  });

  it("pins the two dialog buttons", () => {
    expect(vi.deleteDialog.keep).toBe("Giữ lại dữ liệu");
    expect(vi.deleteDialog.confirm).toBe("Xóa toàn bộ dữ liệu của tôi");
  });
});
