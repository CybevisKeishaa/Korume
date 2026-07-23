import { test, expect } from "@playwright/test";

// End-to-end: proves the locale survives a full login round trip.
//
// app/[locale]/(auth)/actions.ts's login() strips a locale prefix off
// `redirectTo` (built by lib/supabase/middleware.ts's signed-out bounce) and
// re-adds one via the locale-aware `redirect()` helper. A bug in that
// strip/re-add composition would double the prefix ("/en/en/dashboard") or
// drop it entirely ("/dashboard") — invisible to unit tests, which mock the
// redirect target rather than following a real browser redirect chain.
//
// The round trip: register (lands on /en/dashboard) -> sign out -> hit a
// protected route while signed out, which the middleware bounces to
// /en/login?redirectTo=/en/dashboard (the ALREADY-PREFIXED case that
// exercises the strip/re-add path, unlike a bare /en/login visit, which
// never populates `redirectTo`) -> sign back in -> assert the final URL is
// exactly /en/dashboard.
test("register -> sign out -> sign in bounces back to /en/dashboard, not double-prefixed", async ({
  page,
}) => {
  const email = `e2e_locale_${Date.now()}@example.com`;
  const password = "password123";

  await page.goto("/en/register");
  await page.getByLabel("Name").fill("E2E Locale Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /create account/i }).click();

  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15000 });

  // Sign out via the nav's sign-out form (posts to /auth/signout, which
  // redirects to unprefixed "/" — the intl middleware then negotiates it
  // back to /en, since Playwright's Chrome sends Accept-Language: en-US and
  // the config also pins locale: "en").
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/en\/?$/, { timeout: 15000 });

  // Visiting a protected route while signed out triggers the middleware's
  // bounce to /en/login?redirectTo=/en/dashboard — the prefixed redirectTo
  // that actions.ts must strip before re-adding the locale prefix.
  await page.goto("/en/dashboard");
  await expect(page).toHaveURL(/\/en\/login\?redirectTo=%2Fen%2Fdashboard/, {
    timeout: 15000,
  });

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Assert on the URL settling, not on page.url() read synchronously after
  // the click — the submit goes through a pending transition (the button
  // reads "Please wait…" while the server action runs) before the redirect
  // resolves, and toHaveURL polls until it does.
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15000 });
  expect(new URL(page.url()).pathname).toBe("/en/dashboard");
});
