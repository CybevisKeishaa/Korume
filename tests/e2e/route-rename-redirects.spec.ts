import { test, expect } from "@playwright/test";

// Spec §3.1.1. Three explicit rules, not one wildcard: the lesson rule
// COLLAPSES a segment (`/videos/:id/shadowing` → `/shadowing/:id`) rather than
// renaming a prefix. Getting that one wrong sends a learner silently into the
// wrong lesson mode instead of to an error, which is why it is asserted here.
const ID = "00000000-0000-0000-0000-000000000000";

test("hub route redirects", async ({ page }) => {
  await page.goto("/en/videos");
  await expect(page).toHaveURL(/\/en\/shadowing(\?|$)/);
});

test("lesson route redirects and drops the trailing segment", async ({ page }) => {
  await page.goto(`/en/videos/${ID}/shadowing`);
  await expect(page).toHaveURL(new RegExp(`/en/shadowing/${ID}(\\?|$)`));
});

test("dictation route redirects and keeps its segment", async ({ page }) => {
  await page.goto(`/en/videos/${ID}/dictation`);
  await expect(page).toHaveURL(new RegExp(`/en/shadowing/${ID}/dictation(\\?|$)`));
});
