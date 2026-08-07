import { test, expect } from "@playwright/test";

/**
 * Spec §8.1 — the gate for the whole chrome architecture.
 *
 * `AmbientProvider` owns Companion state. It lives in `(protected)`, above the
 * chrome groups, precisely so a chrome change does not reset it. Two things
 * have to hold for that to be true, and neither is observable from the DOM:
 *
 *   1. The transition is client-side. A window sentinel survives one and is
 *      wiped by a document load.
 *   2. The provider instance survives. `phaseRequestedRef` makes the phase read
 *      fire ONCE per provider lifetime, so a second `/api/user/stats` request
 *      after crossing the boundary is a remount — no instrumentation needed.
 *
 * Registration mechanics + the fresh-email convention are copied from
 * tests/e2e/journal.spec.ts.
 */
test("Companion state survives the (app) -> (immersive) boundary", async ({ page }) => {
  const email = `e2e_group_${Date.now()}@example.com`;
  const password = "password123";

  let statsRequests = 0;
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/api/user/stats") statsRequests += 1;
  });

  await page.goto("/en/register");
  await page.getByLabel("Name").fill("E2E Route Group Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15000 });

  // The dashboard mounts a CompanionAnchor, which triggers the provider's
  // one-time phase read. Wait for it before the count means anything.
  await expect.poll(() => statsRequests, { timeout: 15000 }).toBe(1);

  await page.evaluate(() => {
    (window as unknown as { __groupSentinel?: number }).__groupSentinel = 1;
  });

  await page.getByRole("link", { name: "Journey", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/journal$/, { timeout: 15000 });
  await expect(page.getByText("The day the two of you met.")).toBeVisible();

  // 1. The navigation stayed client-side.
  expect(
    await page.evaluate(
      () => (window as unknown as { __groupSentinel?: number }).__groupSentinel,
    ),
  ).toBe(1);

  // 2. The provider was not remounted. /journal mounts its own anchor; if the
  //    provider had been rebuilt, its fresh `phaseRequestedRef` would have
  //    fired a second phase read.
  expect(statsRequests).toBe(1);

  // 3. The chrome contract actually changed: (immersive) mounts no nav.
  await expect(page.getByRole("navigation", { name: /main/i })).toHaveCount(0);
});
