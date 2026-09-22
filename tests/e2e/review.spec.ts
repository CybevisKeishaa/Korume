import { test, expect } from "@playwright/test";
import { registerViaUi } from "./fixtures/auth";

// End-to-end: a new user registers, opens a vocab review, reveals and grades a
// card, and the session advances (which means POST /api/srs/review succeeded and
// persisted progress under RLS).
test("register → review a vocab card → session advances", async ({ page }) => {
  const email = `e2e_${Date.now()}@example.com`;

  await page.goto("/en/register");
  await registerViaUi(page, { name: "E2E Tester", email, password: "password123" });

  await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 15000 });

  await page.goto("/en/vocab/review");
  await expect(page.getByText("1 / 20")).toBeVisible();

  await page.getByRole("button", { name: /show answer/i }).click();
  await page.getByRole("button", { name: /good/i }).click();

  // Advancing to card 2 proves the review POST succeeded.
  await expect(page.getByText("2 / 20")).toBeVisible({ timeout: 10000 });
});
