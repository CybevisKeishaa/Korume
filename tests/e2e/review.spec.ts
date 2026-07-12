import { test, expect } from "@playwright/test";

// End-to-end: a new user registers, opens a vocab review, reveals and grades a
// card, and the session advances (which means POST /api/srs/review succeeded and
// persisted progress under RLS).
test("register → review a vocab card → session advances", async ({ page }) => {
  const email = `e2e_${Date.now()}@example.com`;

  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: /create account/i }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

  await page.goto("/vocab/review");
  await expect(page.getByText("1 / 20")).toBeVisible();

  await page.getByRole("button", { name: /show answer/i }).click();
  await page.getByRole("button", { name: /good/i }).click();

  // Advancing to card 2 proves the review POST succeeded.
  await expect(page.getByText("2 / 20")).toBeVisible({ timeout: 10000 });
});
