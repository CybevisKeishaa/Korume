import { test, expect } from "@playwright/test";

export const AUTH_ROUTES_UNDER_TEST = ["/en/login", "/en/register"];

test("auth routes keep the card usable without extra providers", async ({ page }) => {
  expect(AUTH_ROUTES_UNDER_TEST).toHaveLength(2);
  for (const route of AUTH_ROUTES_UNDER_TEST) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(route);
    const card = page.getByRole("main");
    await expect(card).toBeVisible();
    expect((await card.boundingBox())?.width).toBeGreaterThanOrEqual(480);
    expect((await card.boundingBox())?.width).toBeLessThanOrEqual(544);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /apple|github/i })).toHaveCount(0);
    await page.setViewportSize({ width: 1024, height: 768 });
    const story = page.locator("section").first();
    const cardColumn = page.getByRole("main");
    await expect(story).toBeVisible();
    await expect(cardColumn).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
    const [storyBox, cardColumnBox] = await Promise.all([story.boundingBox(), cardColumn.boundingBox()]);
    if (!storyBox || !cardColumnBox) throw new Error("Expected both auth columns to have bounds");
    expect(storyBox.x + storyBox.width).toBeLessThanOrEqual(cardColumnBox.x);
    await page
      .getByRole("button", { name: route.endsWith("login") ? "Sign in" : "Create account" })
      .scrollIntoViewIfNeeded();
  }
});
