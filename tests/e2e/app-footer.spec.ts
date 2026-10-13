// tests/e2e/app-footer.spec.ts
import { test, expect, type Page } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./fixtures/auth";
import marketing from "../../messages/en/marketing.json";
import settings from "../../messages/en/settings.json";
import nav from "../../messages/en/nav.json";

/**
 * App footer (spec T5 + the runtime half of T2, plan P3). Unit tests prove each surface calls the route; only a
 * real round trip proves the two surfaces agree through `users.newsletter_opt_in_at`, and that a save on either
 * surface survives a client navigation that discards its `router.refresh()` (Review Focus 3).
 */
const copy = marketing.appFooter.newsletter;

async function signUp(page: Page, tag: string) {
  await page.goto("/en/register");
  await registerViaUi(page, { name: "E2E Footer Tester", email: uniqueEmail(`e2e_footer_${tag}`), password: "password123" });
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15000 });
}

/** Statically reachable routes from spec F1 (the two [param] routes are covered by the static test). */
const WITH_FOOTER = ["/en/shadowing", "/en/shadowing/explore", "/en/pronunciation", "/en/pronunciation/paths",
  "/en/kanji", "/en/grammar", "/en/conversation", "/en/certification", "/en/playlists", "/en/mining", "/en/profile"];
const WITHOUT_FOOTER = ["/en/dashboard", "/en/settings", "/en/kanji/review", "/en/korume/chat"];

test.describe("app footer", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("subscribe in the footer, see it in Settings, turn it off, footer offers it again", async ({ page }) => {
    await signUp(page, "flow");
    await page.goto("/en/shadowing");
    const footer = page.locator("[data-app-footer]");
    await footer.getByRole("button", { name: copy.submit }).click();
    await expect(footer.getByText(copy.subscribed)).toBeVisible();

    await footer.getByRole("link", { name: copy.manage }).click();
    await expect(page).toHaveURL(/\/en\/settings#newsletter$/);
    const toggle = page.getByRole("switch", { name: settings.newsletter.title, exact: true });
    await expect(toggle).toBeChecked();

    // Clicking "Manage" at once discards the footer's router.refresh(), so /shadowing comes back from the router
    // cache as it was before the save: only the footer's tab write shows "saved" here.
    const mainNav = page.getByRole("navigation", { name: nav.ariaLabel });
    await mainNav.getByRole("link", { name: nav.lessons }).click();
    await expect(page.locator("[data-app-footer]").getByText(copy.subscribed)).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/en\/settings#newsletter$/);
    await expect(toggle).toBeChecked();

    const saved = page.waitForResponse((r) => r.url().endsWith("/api/user/newsletter") && r.request().method() === "PATCH");
    await toggle.click();
    expect((await saved).status()).toBe(200);

    // At once, inside the 30s router-cache window: the footer would follow its own earlier tab write ("saved");
    // only Settings' newer tab write turns it back to the form.
    await mainNav.getByRole("link", { name: nav.lessons }).click();
    await expect(page).toHaveURL(/\/en\/shadowing$/);
    await expect(page.locator("[data-app-footer]").getByRole("button", { name: copy.submit })).toBeVisible();
  });

  test("exactly one footer on each listed page, none elsewhere", async ({ page }) => {
    await signUp(page, "placement");
    for (const route of WITH_FOOTER) {
      await page.goto(route);
      await expect(page.locator("[data-app-footer]"), route).toHaveCount(1);
    }
    for (const route of WITHOUT_FOOTER) {
      await page.goto(route);
      await expect(page.locator("[data-app-footer]"), route).toHaveCount(0);
    }
  });
});
