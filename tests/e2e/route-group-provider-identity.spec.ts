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

/**
 * Spec §8.1's other crossing: `(app) -> (focus)`. This is the one a learner
 * actually takes entering a lesson (Lessons -> a video -> Shadowing), and the
 * one where Companion pending-contexts matter most — unlike `(immersive)`,
 * `(focus)` keeps the Nav Column mounted, just hidden by default
 * (`app-nav.tsx` `defaultVisible={false}`), so this also exercises the F1 fix
 * (final whole-branch review, 2026-08-07): the reduce-motion control must
 * still be reachable, and the show/hide toggle must recover the column
 * without ever registering as a second `<nav>` landmark.
 *
 * Reaching a real `(focus)/videos/[id]/shadowing` route needs a real video
 * row: `getVideo()` 404s (and, since no `not-found.tsx` exists anywhere in
 * the app, that 404 renders the framework default page OUTSIDE this whole
 * layout tree, defeating the crossing entirely) unless one exists. Creating
 * one for real goes through `lib/data/lesson-creation.ts`, which calls the
 * live YouTube oEmbed endpoint (`lib/youtube/oembed.ts`) and requires
 * `requireAdmin()` — neither belongs in a deterministic e2e gate, and
 * `requireAdmin()`'s `ADMIN_EMAILS` bootstrap is keyed to a fixed email,
 * incompatible with this file's fresh-email-per-run convention. No prior
 * `tests/e2e/` spec seeds a video, and `supabase/seed.sql` seeded none
 * either — so this spec adds the one dev-only row it needs there (`FREE`
 * library_access, so any authenticated user can read it under
 * `videos_read`), rather than inventing a fixture inline here.
 */
test("Companion state survives the (app) -> (focus) boundary, and the hidden nav stays recoverable", async ({
  page,
}) => {
  const email = `e2e_group_focus_${Date.now()}@example.com`;
  const password = "password123";

  let statsRequests = 0;
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/api/user/stats") statsRequests += 1;
  });

  await page.goto("/en/register");
  await page.getByLabel("Name").fill("E2E Route Group Focus Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15000 });

  await expect.poll(() => statsRequests, { timeout: 15000 }).toBe(1);

  await page.evaluate(() => {
    (window as unknown as { __groupFocusSentinel?: number }).__groupFocusSentinel = 1;
  });

  // Real chrome, real clicks — not a direct `page.goto` to the shadowing URL,
  // which would be a full document load and trivially pass every assertion
  // below for the wrong reason. `NAV_GROUPS`' `lessons` entry ("Lessons")
  // still lives in `(app)`; the seeded video card IS the shadowing link
  // (`components/video/video-card.tsx`).
  await page.getByRole("link", { name: "Lessons", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/videos$/, { timeout: 15000 });
  await page.getByRole("link", { name: /E2E Seed Video/ }).click();
  await expect(page).toHaveURL(/\/en\/videos\/.+\/shadowing$/, { timeout: 15000 });

  // 1. The navigation stayed client-side.
  expect(
    await page.evaluate(
      () => (window as unknown as { __groupFocusSentinel?: number }).__groupFocusSentinel,
    ),
  ).toBe(1);

  // 2. The provider was not remounted — no extra phase fetch crossing into
  //    (focus). Unlike the (immersive) test above, the shadowing page mounts
  //    no CompanionAnchor, so there is no positive DOM signal to wait on
  //    first; settle for network-idle before trusting the count.
  await page.waitForLoadState("networkidle");
  expect(statsRequests).toBe(1);

  // 3. The (focus) chrome contract: nav mounted but hidden by default. No
  //    <nav> landmark yet, but the show/hide affordance IS present — this is
  //    "hidden", not "not mounted" (that's (immersive), covered above).
  await expect(page.getByRole("navigation")).toHaveCount(0);
  const showNav = page.getByRole("button", { name: /show navigation/i });
  await expect(showNav).toBeVisible();
  await expect(showNav).toHaveAttribute("aria-expanded", "false");

  // 4. F1: the reduce-motion control survives the hidden state — it must not
  //    have been silently dropped along with the rest of the nav column.
  await expect(page.getByRole("checkbox", { name: /reduce motion/i })).toBeVisible();

  // 5. Activating the toggle recovers the column, and it is a real <nav>
  //    landmark once shown.
  await showNav.click();
  await expect(page.getByRole("navigation")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /hide navigation/i })).toHaveAttribute(
    "aria-expanded",
    "true",
  );

  // 6. The boundary is symmetric: crossing back preserves both signals too.
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15000 });

  expect(
    await page.evaluate(
      () => (window as unknown as { __groupFocusSentinel?: number }).__groupFocusSentinel,
    ),
  ).toBe(1);

  await page.waitForLoadState("networkidle");
  expect(statsRequests).toBe(1);
});
