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

  // Through the real chrome, not a direct goto: a Journal that exists but is
  // unreachable must fail here.
  //
  // The door changed in Phase 1b. This used to click the sidebar's "Journey"
  // row, but the LOCKED IA moved that label onto /roadmap (A8) and absorbed
  // the Diary into Companion (A2), so no nav row points here any more. The
  // companion sprite is the real door and always was — `ambient-provider.tsx`
  // wires `openJournal: () => router.push("/journal")`, and `/dashboard`
  // mounts a `CompanionAnchor`. Clicking it is a *stronger* reachability
  // check than the nav link was, because it is the path the product intends.
  //
  // The control's label and the page heading are deliberately different
  // words — "open the journal" vs the "Journal" heading. Don't "fix" one into
  // agreement with the other.
  //
  // ⚠️ `emulateMedia` is REQUIRED, not hygiene. The sprite carries
  // `companion-breathe` (globals.css: `4.5s ... infinite`, scale 1 -> 1.03),
  // applied whenever the app's reduce-motion toggle is off — which is the
  // default. Playwright's click actionability waits for a STABLE bounding
  // box, and an infinitely animating element never has one, so the click
  // times out (measured: 3/3 timeouts at ~8s without this line, ~90ms with
  // it). `prefers-reduced-motion: reduce` trips the global kill switch in
  // globals.css, which forces `animation-iteration-count: 1`.
  //
  // Do NOT "fix" this with `force: true` instead — that skips the hit-target
  // check, which is part of what this spec is proving.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: "Your companion — open the journal" })
    .click();

  await expect(page).toHaveURL(/\/en\/journal$/, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Journal", level: 1 })).toBeVisible();

  // The first-meeting anchor this very render recorded. Its title is resolved
  // at READ time from the descriptor (§4.4) — no row ever stored this string.
  await expect(page.getByText("The day the two of you met.")).toBeVisible();
});
