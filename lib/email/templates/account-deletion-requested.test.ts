import { describe, expect, it } from "vitest";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { template } from "./account-deletion-requested";

const { render } = template;

const EXECUTE_AFTER = "2026-08-27T10:00:00.000Z";
const CANCEL_URL = "https://app.korume.example/settings/privacy?ref=email&tab=danger";

const eraseAll = { tier: "erase_all" as const, executeAfter: EXECUTE_AFTER, cancelUrl: CANCEL_URL };
const closeAccount = { tier: "close_account" as const, executeAfter: EXECUTE_AFTER, cancelUrl: CANCEL_URL };

describe("account-deletion-requested template", () => {
  /**
   * Parameterised over BOTH locale and tier (re-review N6): running only
   * `eraseAll` here would leave `close_account`'s own `nothingYet(date)`
   * interpolation unguarded except by the weaker "text differs from
   * erase_all" check further down.
   */
  it.each([
    ["en", "en-US", "erase_all", eraseAll],
    ["en", "en-US", "close_account", closeAccount],
    ["vi", "vi-VN", "erase_all", eraseAll],
    ["vi", "vi-VN", "close_account", closeAccount],
  ] as const)("renders %s/%s with the formatted execution date, the cancel link, and support contact", (locale, intlLocale, tier, variables) => {
    expect(variables.tier).toBe(tier);
    const result = render(locale, variables);
    const expectedDate = new Intl.DateTimeFormat(intlLocale, {
      dateStyle: "long",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date(EXECUTE_AFTER));

    expect(result.subject.length).toBeGreaterThan(0);
    expect(result.text).toContain(expectedDate);
    expect(result.html).toContain(expectedDate);
    expect(result.text).toContain(CANCEL_URL);
    expect(result.html).toContain(SUPPORT_EMAIL);
    expect(result.text).toContain(SUPPORT_EMAIL);
  });

  it("escapes the cancel URL's ampersand inside the HTML body but not in the plain-text body", () => {
    const result = render("en", eraseAll);
    expect(result.html).toContain("ref=email&amp;tab=danger");
    expect(result.html).not.toContain("ref=email&tab=danger");
    expect(result.text).toContain("ref=email&tab=danger");
  });

  it("links the cancel URL as an href in the HTML body", () => {
    const result = render("en", eraseAll);
    expect(result.html).toMatch(/<a[^>]+href="https:\/\/app\.korume\.example\/settings\/privacy\?ref=email&amp;tab=danger"/);
  });

  it("never claims the deletion already happened or is irreversible, in either locale or tier", () => {
    for (const locale of ["en", "vi"] as const) {
      for (const variables of [eraseAll, closeAccount]) {
        const result = render(locale, variables);
        const all = (result.subject + result.html + result.text).toLowerCase();
        expect(all).not.toContain("cannot be undone");
        expect(all).not.toContain("permanently remove");
        expect(all).not.toContain("immediately");
        expect(all).not.toContain("không thể hoàn tác");
        expect(all).not.toContain("ngay lập tức");
      }
    }
  });

  it("the plain-text body carries no HTML markup", () => {
    const result = render("en", eraseAll);
    expect(result.text).not.toMatch(/<[a-z][\s\S]*>/i);
  });

  /**
   * `deleteDialog.close_account.subtitle` (both locales) states plainly that
   * closing does NOT delete learning data — this is the same promise
   * `messages/settings.pin.test.ts`'s "close_account tells the truth about
   * what happens" block pins on the in-app copy. Mirrored here because the
   * template used to hardcode erase-all's "we deleted your data" framing for
   * BOTH tiers (code review, `feat/email-notification-system`).
   */
  it("close_account never claims data is deleted, in either locale, and stays distinct from erase_all's wording", () => {
    for (const locale of ["en", "vi"] as const) {
      const closeResult = render(locale, closeAccount);
      const eraseResult = render(locale, eraseAll);
      const closeAll = (closeResult.subject + closeResult.html + closeResult.text).toLowerCase();

      expect(closeAll).not.toContain("will be deleted");
      expect(closeAll).not.toContain("sẽ bị xóa");
      expect(closeResult.subject).not.toBe(eraseResult.subject);
      expect(closeResult.text).not.toBe(eraseResult.text);
    }
  });

  it("close_account states plainly that learning data is not deleted, in both locales", () => {
    expect(render("en", closeAccount).text).toContain("Your learning data is not deleted");
    expect(render("vi", closeAccount).text).toContain("Dữ liệu học của bạn không bị xóa");
  });
});
