import { test, expect } from "@playwright/test";

// End-to-end: proves the Journal exists as a real, reachable surface and that
// opening it IS the first-meeting domain event (spec D8).
//
// Unit tests can only prove `JournalView` renders a memories prop and that
// `recordFirstMeeting` writes when called. What no unit test can prove is the
// composition: a brand-new account, whose `companion_memories` table is empty,
// navigating to /journal through the real nav and finding its first page
// already written by that very render. That round trip — server render →
// service-role write → owner-scoped read, all inside one request — is exactly
// what this covers.
//
// Registration mechanics + the fresh-email convention are copied from
// tests/e2e/auth-locale-round-trip.spec.ts.
test("a brand-new learner opens the Journal and finds the first page already written", async ({
  page,
}) => {
  const email = `e2e_journal_${Date.now()}@example.com`;
  const password = "password123";

  await page.goto("/en/register");
  await page.getByLabel("Name").fill("E2E Journal Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /create account/i }).click();

  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15000 });

  // Through the real chrome, not a direct goto: the nav entry is part of what
  // Task 10 ships, so a Journal that exists but is unreachable must fail here.
  // The nav link and the page heading are deliberately different words: Plan
  // B Task 3 renamed the nav entry to "Journey" (messages/en/nav.json) while
  // the surface itself is still titled "Journal" (messages/en/companion.json)
  // — don't "fix" one of them into agreement with the other.
  await page.getByRole("link", { name: "Journey", exact: true }).click();

  await expect(page).toHaveURL(/\/en\/journal$/, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Journal", level: 1 })).toBeVisible();

  // The first-meeting anchor this very render recorded. Its title is resolved
  // at READ time from the descriptor (§4.4) — no row ever stored this string.
  await expect(page.getByText("The day the two of you met.")).toBeVisible();
});
