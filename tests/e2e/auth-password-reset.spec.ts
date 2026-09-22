import { expect, test } from "@playwright/test";

test("password reset request stays neutral and an expired reset link can request another", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/en/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/en\/forgot-password$/);

  await page.getByLabel("Email").fill("e2e@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("main")).toContainText(
    "If an account exists for that email, we've sent a reset link.",
  );

  await page.goto("/en/reset-password");
  const main = page.getByRole("main");
  await expect(main).toContainText("This reset link has expired. Request a new one.");
  await expect(main.getByRole("link", { name: "Request a new link" })).toHaveAttribute(
    "href",
    "/en/forgot-password",
  );
});
