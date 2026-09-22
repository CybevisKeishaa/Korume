import { expect, test } from "@playwright/test";
import { registerViaUi } from "./fixtures/auth";

test("route errors stay in the live app shell", async ({ page }) => {
  const email = `e2e_route_error_${Date.now()}@example.com`;
  const password = "password123";

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/en/register");
  await registerViaUi(page, { name: "E2E Route Error Tester", email, password });
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15000 });

  const before = await page.getByRole("navigation").boundingBox();
  if (!before) throw new Error("Expected the app sidebar before the route error");

  await page.goto("/en/e2e-route-error");
  if (await page.getByRole("heading", { name: "We couldn't find this place." }).count()) {
    throw new Error("E2E_ROUTE_ERROR must be 1 for the route-error trigger");
  }

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Something interrupted this page." })).toBeVisible();
  const after = await page.getByRole("navigation").boundingBox();
  if (!after) throw new Error("Expected the app sidebar after the route error");
  expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(0.5);

  const panel = main.locator("section", {
    has: page.getByRole("heading", { name: "Something interrupted this page." }),
  });
  await expect(panel).toBeVisible();
  expect(await panel.evaluate((element) => element.closest("[data-density='reference']"))).toBeNull();

  const retry = panel.getByRole("button", { name: "Try again" });
  await retry.focus();
  await page.keyboard.press("Tab");
  await expect(panel.getByRole("link", { name: "Go to Dashboard" })).toBeFocused();
});
