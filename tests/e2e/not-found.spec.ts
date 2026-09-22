import { expect, test } from "@playwright/test";

test("localized unknown paths render the standalone 404 surface", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const response = await page.goto("/en/this-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "We couldn't find this place." })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("/en/this-does-not-exist");
  await expect(page.getByRole("navigation")).toHaveCount(0);

  expect((await page.goto("/vi/khong-co"))?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Chúng tôi không tìm thấy nơi này." })).toBeVisible();
});
