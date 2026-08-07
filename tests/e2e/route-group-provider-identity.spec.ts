import { test, expect } from "@playwright/test";

/**
 * Spec §8.1 — the gate for the whole chrome architecture.
 *
 * `AmbientProvider` owns Companion state. It lives in `(protected)`, above the
 * chrome groups, precisely so a chrome change does not reset it. Three things
 * have to hold for that to be true, and none is observable from the DOM alone:
 *
 *   1. The transition is client-side. A window sentinel survives one and is
 *      wiped by a document load.
 *   2. The provider instance survives. `phaseRequestedRef` makes the phase
 *      read fire ONCE per provider lifetime, so a second `/api/user/stats`
 *      request after crossing the boundary is a remount. That proxy is only
 *      sound while `/journal` actually mounts a `CompanionAnchor`
 *      (ambient-provider.tsx gates the fetch on `anchorCount === 0 ||
 *      phaseRequestedRef.current`) — so the anchor's own DOM marker
 *      (`data-companion-surface="journal"`, companion-anchor.tsx) is asserted
 *      as a precondition before the count is trusted.
 *   3. The boundary is symmetric: crossing back (immersive -> app) preserves
 *      the same sentinel and the same one-shot request count. A gate that
 *      only proves the forward direction would miss a remount on the way
 *      back.
 *
 * Registration mechanics + the fresh-email convention are copied from
 * tests/e2e/journal.spec.ts.
 */
test("Companion state survives the (app) <-> (immersive) boundary", async ({ page }) => {
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

  // Precondition for assertion 2: /journal's own CompanionAnchor actually
  // mounted. Without this, a provider that WAS rebuilt but whose fresh
  // instance happens to render no anchor here would also fire zero extra
  // requests — a false pass for the wrong reason.
  await expect(page.locator('[data-companion-surface="journal"]')).toBeVisible();

  // 2. The provider was not remounted. If it had been, this anchor's mount
  //    would have triggered a second, genuinely async phase fetch — wait for
  //    the network to go quiet before trusting the count.
  await page.waitForLoadState("networkidle");
  expect(statsRequests).toBe(1);

  // 3. The chrome contract actually changed: (immersive) mounts no nav
  //    landmark AT ALL — not merely one whose accessible name isn't "main".
  await expect(page.getByRole("navigation")).toHaveCount(0);

  // 4. The boundary is symmetric: crossing back preserves both signals too.
  await page.getByRole("link", { name: "Back to dashboard" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15000 });

  expect(
    await page.evaluate(
      () => (window as unknown as { __groupSentinel?: number }).__groupSentinel,
    ),
  ).toBe(1);

  await page.waitForLoadState("networkidle");
  expect(statsRequests).toBe(1);
});
