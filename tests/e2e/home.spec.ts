import { test, expect } from "@playwright/test";

test("landing page renders the hero and auth links", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /learn japanese/i }),
  ).toBeVisible();

  // Scope to the hero <main> — "Sign in" also appears in the header and footer.
  const hero = page.getByRole("main");
  await expect(
    hero.getByRole("link", { name: /start free trial/i }),
  ).toBeVisible();
  await expect(hero.getByRole("link", { name: /sign in/i })).toBeVisible();
});
