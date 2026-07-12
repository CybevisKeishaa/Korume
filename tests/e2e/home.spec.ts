import { test, expect } from "@playwright/test";

test("landing page renders the hero and auth links", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /learn japanese/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /start free trial/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
});
