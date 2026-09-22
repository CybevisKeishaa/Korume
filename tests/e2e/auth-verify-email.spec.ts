import { expect, test } from "@playwright/test";

test("verify-email distributes the code, submits it, and starts the resend cooldown", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/en/verify-email?email=e2e%40example.com");

  const boxes = page.getByRole("textbox");
  await boxes.nth(0).type("123");
  // Playwright has no locator.paste(); dispatch the real event OtpInput's onPaste reads.
  await boxes.nth(3).evaluate((box) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text", "456");
    box.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }));
  });
  await expect(boxes).toHaveCount(6);
  await expect(boxes.nth(0)).toHaveValue("1");
  await expect(boxes.nth(1)).toHaveValue("2");
  await expect(boxes.nth(2)).toHaveValue("3");
  await expect(boxes.nth(3)).toHaveValue("4");
  await expect(boxes.nth(4)).toHaveValue("5");
  await expect(boxes.nth(5)).toHaveValue("6");
  await expect(page.getByRole("button", { name: "Verify email" })).toBeFocused();

  await page.getByRole("button", { name: "Verify email" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("That code is wrong or has expired.");
  await expect(page.getByRole("button", { name: /Resend code in/ })).toBeVisible();
});
