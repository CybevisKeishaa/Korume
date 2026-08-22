import { describe, expect, it } from "vitest";
import en from "./en/settings.json";
import vi from "./vi/settings.json";

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
 *
 * It lives at `messages/`, not `messages/en/`, precisely because it guards
 * both locales — the whole-branch review flagged the old `messages/en/`
 * location as claiming an EN-only scope this file has not had since the VI
 * half was added.
 */
describe("settings.json EN — the 7-day window", () => {
  it("never claims the deletion is irreversible", () => {
    const all = JSON.stringify(en).toLowerCase();
    expect(all).not.toContain("cannot be undone");
    expect(all).not.toContain("permanently remove");
  });

  /**
   * Whole-branch review: the branch ruling forbids irreversibility AND
   * immediacy, and only the first half was ever guarded. Nothing on this
   * screen happens when the user confirms — a row is written and the
   * scheduler acts seven days later — so any copy claiming an immediate
   * effect is false at the moment the user is deciding, which is the same
   * defect class as C1's reopen promise.
   */
  it("never claims anything happens immediately", () => {
    const all = JSON.stringify(en).toLowerCase();
    expect(all).not.toContain("immediately");
  });

  it("states the cancelable window in the erase-all dialog note", () => {
    expect(en.deleteDialog.erase_all.note).toBe(
      "You have 7 days to change your mind. We keep your data untouched until then, and you can cancel any time from this page. Some records may be retained where required for legal, security, or billing purposes.",
    );
  });

  it("pins the two erase-all dialog buttons", () => {
    expect(en.deleteDialog.erase_all.keep).toBe("Keep my data");
    expect(en.deleteDialog.erase_all.confirm).toBe("Delete all my data");
  });

  it("pins the three Danger Zone rows", () => {
    expect(en.dangerZone.memory.title).toBe("Delete Korume Memory");
    expect(en.dangerZone.closeAccount.title).toBe("Delete Account");
    expect(en.dangerZone.eraseAll.title).toBe("Delete all my data");
  });

  /**
   * ⭐ C1 (whole-branch review, USER RULING). This key shipped saying "Your
   * learning data is kept, and you can come back" — and closing an account
   * bans the GoTrue user for `876000h` (~100 years) with nothing that lifts
   * it. `liftBan` has exactly one caller, the scheduler's failure handler;
   * there is no reopen endpoint, no admin un-ban surface, no email flow, and
   * a banned user cannot obtain a session, so they cannot even reach
   * `/settings/privacy` to try. The copy stated a falsehood at the exact
   * moment the user was deciding.
   *
   * This key had NO assertion of any kind before now, which is how it
   * shipped. It is pinned in FULL, in both locales, rather than by a
   * substring: a partial check would let the promise creep back in the half
   * that was not pinned.
   *
   * The wording may state that CLOSING is permanent — it is — but must not
   * claim the 7-day cancellation window is absent or that anything happens
   * on confirm. The window still applies to the request, and
   * `deleteDialog.close_account.note` is what states it.
   */
  it("pins the close-account row body, which must not promise a reopen path", () => {
    expect(en.dangerZone.closeAccount.body).toBe(
      "Your account closes and stays closed. Your learning data is kept, not deleted.",
    );
    expect(vi.dangerZone.closeAccount.body).toBe(
      "Tài khoản của bạn sẽ đóng và không mở lại được. Dữ liệu học vẫn được giữ lại, không bị xóa.",
    );
  });

  it("names the consent toggle for what it actually covers", () => {
    expect(en.aiTraining.title).toBe("Help improve Korume's models");
    expect(en.aiTraining.body).toBe(
      "Let us use your recordings and learning data to improve our models. Off unless you turn it on. Your Companion remembers your learning either way — that is not model training.",
    );
  });
});

/**
 * `close_account` reuses `DeleteDataDialog`'s structure with `tier`
 * (fix round 1, 2026-08-21) — `dangerZone.closeAccount.body` states "Your
 * account closes and stays closed. Your learning data is kept, not deleted"
 * (reworded by C1), so the dialog's own copy for this tier must say the same
 * thing, never the erase-all block's "will be deleted" language. These pins hold that promise; the global
 * "never claims irreversible" test above already covers this block too
 * (it scans the whole `en` object).
 */
describe("settings.json EN — close_account tells the truth about what happens", () => {
  it("never claims the account's data is deleted or erased", () => {
    // "not erased" / "not deleted" are the honest disclaimer this copy is
    // FOR, so the banned phrases are the claims themselves, not the bare
    // words — a substring check on "erased" alone would flag its own
    // negation.
    const closeAccount = JSON.stringify(en.deleteDialog.close_account).toLowerCase();
    expect(closeAccount).not.toContain("will be deleted");
    expect(closeAccount).not.toContain("will be erased");
    expect(closeAccount).not.toContain("your data will no longer");
  });

  it("states plainly that learning data is kept, not deleted", () => {
    expect(en.deleteDialog.close_account.subtitle).toBe(
      "Close your Korume account. Your learning data is not deleted.",
    );
    expect(en.deleteDialog.close_account.note).toContain("does not delete your learning data");
  });

  /**
   * ⭐ C1, the other half. The Danger Zone row above is pinned exactly; the
   * dialog block is longer and changes more often, so it is guarded by the
   * specific promises the repo cannot keep rather than by a full pin. Each
   * phrase below is one that actually shipped (`items.profile.body` said
   * "until you reopen your account", `items.progress.body` said "preserved
   * for when you come back") plus the two adjacent phrasings a writer would
   * reach for next.
   */
  it("never offers a way back into a closed account, in either locale", () => {
    const enClose = JSON.stringify(en.deleteDialog.close_account).toLowerCase();
    expect(enClose).not.toContain("reopen");
    expect(enClose).not.toContain("come back");
    expect(enClose).not.toContain("sign back in");

    const viClose = JSON.stringify(vi.deleteDialog.close_account).toLowerCase();
    expect(viClose).not.toContain("mở lại");
    expect(viClose).not.toContain("quay lại");
    expect(viClose).not.toContain("kích hoạt lại");
  });

  it("still applies the 7-day cancelable window to closing, the same as erasing", () => {
    expect(en.deleteDialog.close_account.note).toContain("You have 7 days to change your mind");
  });

  it("pins the two close-account dialog buttons, distinct from erase-all's", () => {
    expect(en.deleteDialog.close_account.keep).toBe("Keep my account");
    expect(en.deleteDialog.close_account.confirm).toBe("Close my account");
  });

  /**
   * `erase_all` and `close_account` must carry the exact same KEY structure
   * — only the copy differs by tier (fix round 1's explicit requirement).
   *
   * What a missing key actually does: next-intl does NOT fall back to a
   * sibling key or to the other tier's content — there is no cross-tier
   * fallback mechanism at all. A missing key renders its own literal key
   * path (e.g. the raw string `"deleteDialog.close_account.confirmBody"`)
   * via `getMessageFallback`, or throws, depending on configuration; either
   * way the failure is LOUD, not a silent switch to erase-all's "will be
   * deleted" wording. So this test does not guard against the misstatement
   * itself (a rendering bug can't reach INTO the other tier's content) — it
   * guards against a raw, un-reviewed key path shipping next to a live
   * "Close my account" button, which is its own real defect on a
   * destructive-action surface, just not the one the original comment here
   * described.
   */
  it("erase_all and close_account carry identical key structure", () => {
    const eraseAllKeys = leafKeyPaths(en.deleteDialog.erase_all).sort();
    const closeAccountKeys = leafKeyPaths(en.deleteDialog.close_account).sort();

    // Non-vacuity + exact expected size (CLAUDE.md §7): both collections are
    // gathered by walking the object shape, so an empty or short list would
    // make the equality check below pass by accident. 25 was measured
    // directly against the committed JSON (`node -e`), not guessed:
    // eyebrow/title/subtitle/whatHeading/noteLabel/note/confirmLabel/
    // confirmHeading/confirmBody/typePrompt/acknowledge/keep/confirm (13)
    // + items.{profile,progress,memory,companion,saved,practice}.{title,body}
    // (12) = 25.
    expect(eraseAllKeys).toHaveLength(25);
    expect(closeAccountKeys).toHaveLength(25);
    expect(eraseAllKeys).toEqual(closeAccountKeys);
  });
});

/**
 * Fix round 1 (2026-08-21), Important #1: `pending.erase_all` and
 * `pending.close_account` must carry the exact same KEY structure — only the
 * copy differs by tier, mirroring `deleteDialog`'s own key-parity guard
 * above. A partial override (falling back to erase-all's title/body when a
 * close_account key is missing) is exactly the misstatement class this
 * branch keeps finding — a `close_account` request is data-preserving, and
 * silently showing it erase-all's "scheduled for deletion" wording would be
 * a false statement to the user inside a GDPR flow.
 */
describe("settings.json EN — pending tier copy blocks", () => {
  it("erase_all and close_account carry identical key structure", () => {
    const eraseAllKeys = leafKeyPaths(en.pending.erase_all).sort();
    const closeAccountKeys = leafKeyPaths(en.pending.close_account).sort();

    // Non-vacuity + exact expected size (CLAUDE.md §7): title/body/switchNote
    // = 3 leaf keys per block, measured directly against the committed JSON.
    expect(eraseAllKeys).toHaveLength(3);
    expect(closeAccountKeys).toHaveLength(3);
    expect(eraseAllKeys).toEqual(closeAccountKeys);
  });

  it("never claims the close_account request deletes anything", () => {
    const closeAccount = JSON.stringify(en.pending.close_account).toLowerCase();
    expect(closeAccount).not.toContain("scheduled for deletion");
    expect(closeAccount).not.toContain("will be deleted");
  });
});

/** Recursively collects `"a.b.c"`-style leaf key paths of a plain object. */
function leafKeyPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    leafKeyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

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

  /**
   * Whole-branch review: the guard above only covers the `không thể X`
   * construction. Vietnamese states the same claim just as naturally with the
   * `không X được` frame, and none of those were caught — a translator
   * rewriting "không thể hoàn tác" as "không hoàn tác được" would have
   * reintroduced the forbidden claim with the suite still green.
   *
   * ⚠️ ENUMERATED ON PURPOSE, never a `không.*được` regex. That pattern would
   * match `vi.deleteDialog.erase_all.confirmBody`'s legitimate "không còn
   * truy cập được" ("will no longer be accessible" — a true statement about
   * the terminal state, made in the same breath as "Sau 7 ngày"), and would
   * also match `close_account`'s equally legitimate "không mở lại được" and
   * "không còn truy cập được". The banned list is the irreversibility claims
   * themselves, not the grammatical frame they share.
   */
  it("never claims irreversibility in the `không X được` frame either", () => {
    const all = JSON.stringify(vi).toLowerCase();
    expect(all).not.toContain("không hoàn tác được");
    expect(all).not.toContain("không lấy lại được");
    expect(all).not.toContain("không khôi phục được");
    expect(all).not.toContain("không đảo ngược được");
  });

  /**
   * The VI half of the EN immediacy guard above. Both renderings a writer
   * would reach for: "ngay lập tức" (the ordinary "immediately") and "tức
   * thì" (the terser, more formal one). Nothing on this screen is immediate —
   * every path goes through the 7-day window.
   */
  it("never claims anything happens immediately", () => {
    const all = JSON.stringify(vi).toLowerCase();
    expect(all).not.toContain("ngay lập tức");
    expect(all).not.toContain("tức thì");
  });

  it("states the cancelable window in the erase-all dialog note", () => {
    expect(vi.deleteDialog.erase_all.note).toBe(
      "Bạn có 7 ngày để đổi ý. Trong thời gian đó dữ liệu được giữ nguyên và bạn có thể hủy bất cứ lúc nào ngay tại trang này. Một số bản ghi có thể được lưu lại khi pháp luật, bảo mật hoặc thanh toán yêu cầu.",
    );
  });

  it("pins the two erase-all dialog buttons", () => {
    expect(vi.deleteDialog.erase_all.keep).toBe("Giữ lại dữ liệu");
    expect(vi.deleteDialog.erase_all.confirm).toBe("Xóa toàn bộ dữ liệu của tôi");
  });

  it("close_account tells the truth: learning data is kept, not deleted", () => {
    expect(vi.deleteDialog.close_account.subtitle).toContain("không bị xóa");
    expect(vi.deleteDialog.close_account.note).toContain("không xóa dữ liệu học");
    expect(vi.deleteDialog.close_account.keep).toBe("Giữ tài khoản");
    expect(vi.deleteDialog.close_account.confirm).toBe("Đóng tài khoản");
    // C1: the two item bodies that used to promise a reopen. Both now state
    // the loss of access without offering a way back, and both still say the
    // data itself survives.
    expect(vi.deleteDialog.close_account.items.progress.body).toContain("không bị xóa");
    expect(vi.deleteDialog.close_account.items.profile.body).toContain("Được giữ nguyên");
  });

  /**
   * Fix round 2 (2026-08-21), ruled in from the re-review's "controller
   * decides": the EN half of this guard (`settings.json EN — pending tier
   * copy blocks` above, "never claims the close_account request deletes
   * anything") had no VI equivalent — the same gap Task 8's fix round exists
   * to close (an EN-only guard protects the catalog most users never read).
   * The VI copy is already correct; only the guard was missing, which means
   * it could regress silently. Mirrors `deleteDialog`'s own EN/VI pairing.
   */
  it("pending.close_account never claims anything is deleted", () => {
    // "không bị xóa" ("not deleted") is the honest disclaimer this copy is
    // FOR — same caution as the EN guard above (a substring check on the
    // bare claim would flag its own negation). The banned phrases below are
    // the AFFIRMATIVE claims themselves: erase_all's title ("Đã lên lịch
    // xóa" / "Deletion scheduled"), erase_all's body wording ("được lên
    // lịch xóa" / "scheduled for deletion"), and a generic "will be
    // deleted" claim ("sẽ bị xóa") — none of which appear in "không bị xóa".
    const closeAccount = JSON.stringify(vi.pending.close_account).toLowerCase();
    expect(closeAccount).not.toContain("đã lên lịch xóa");
    expect(closeAccount).not.toContain("được lên lịch xóa");
    expect(closeAccount).not.toContain("sẽ bị xóa");
  });
});
