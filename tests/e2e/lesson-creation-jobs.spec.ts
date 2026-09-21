import { test, expect, type Page } from "@playwright/test";
import { registerViaUi } from "./fixtures/auth";
import enVideos from "@/messages/en/videos.json";

/**
 * C4 browser acceptance: a lesson is created by a durable job, and the learner
 * is told the truth about it the whole way.
 *
 * The YouTube seam is `tests/e2e/fixtures/youtube-stub.cjs`, preloaded into the
 * server process by `playwright.c4.config.ts` — no real YouTube endpoint is
 * reachable from this run, and an unknown video id makes the stub throw rather
 * than fall through to the network.
 */

const WITH_CAPTIONS = "e2ecap00001";
const WITHOUT_CAPTIONS = "e2enocap001";
const JOB_TIMEOUT = 60_000;

/** Every string the progress UI can render, so the no-ETA check has a subject. */
const PROGRESS_STRINGS = [
  enVideos.creation.steps.preparing,
  enVideos.creation.steps.findingTranscript,
  enVideos.creation.steps.building,
  enVideos.creation.steps.ready,
];

async function registerLearner(page: Page, label: string): Promise<void> {
  const email = `e2e_lesson_jobs_${label}_${Date.now()}@example.com`;
  await page.goto("/en/register");
  await registerViaUi(page, { name: "E2E Job Tester", email, password: "password123" });
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15_000 });
}

async function submitVideo(page: Page, videoId: string): Promise<void> {
  await page.goto("/en/shadowing");
  const url = page.getByLabel(enVideos.urlLabel);
  await expect(url).toBeVisible();
  await url.fill(`https://www.youtube.com/watch?v=${videoId}`);
  await page.getByRole("button", { name: enVideos.import }).click();
}

async function tabTo(page: Page, target: ReturnType<Page["getByRole"]>, limit = 40): Promise<void> {
  for (let index = 0; index < limit; index += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => document.activeElement === element)) return;
  }
  throw new Error(`Keyboard focus did not reach the control within ${limit} Tab presses.`);
}

test("a queued lesson reports durable progress and lands the learner on the lesson", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await registerLearner(page, "ok");
  await submitVideo(page, WITH_CAPTIONS);

  // The response is a job, not a lesson: progress appears and the URL stays put.
  const progress = page.getByRole("status", { name: enVideos.creation.progressLabel });
  await expect(progress).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/en\/shadowing$/);
  for (const label of PROGRESS_STRINGS) {
    await expect(progress.getByText(label, { exact: true })).toBeVisible();
  }

  // Reduced motion must not hide state, and no stage may be a timed promise.
  const progressText = (await progress.textContent()) ?? "";
  expect(progressText.length).toBeGreaterThan(0);
  expect(progressText).not.toMatch(/%|\bETA\b|remaining|estimat/i);

  // The worker finishes it and the learner is taken to the real lesson.
  await expect(page).toHaveURL(/\/en\/shadowing\/[0-9a-f-]{36}$/, { timeout: JOB_TIMEOUT });
  await expect(page.getByRole("heading", { name: "E2E Job Lesson With Captions" })).toBeVisible({
    timeout: 15_000,
  });
});

test("a video with no captions fails honestly and offers a keyboard retry", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await registerLearner(page, "nocap");
  await submitVideo(page, WITHOUT_CAPTIONS);

  const alert = page.getByRole("alert").filter({ hasText: enVideos.creation.errors.transcriptUnavailable });
  await expect(alert).toBeVisible({ timeout: JOB_TIMEOUT });
  // A failure keeps the learner in context — no navigation to a lesson that
  // was never created.
  await expect(page).toHaveURL(/\/en\/shadowing$/);

  const retry = page.getByRole("button", { name: enVideos.creation.retry });
  await expect(retry).toBeVisible();
  await tabTo(page, retry);
  await expect(retry).toBeFocused();
  await page.keyboard.press("Enter");

  // The retry re-queues the same job: progress returns, then the same honest
  // failure, because the video still has no captions.
  await expect(page.getByRole("status", { name: enVideos.creation.progressLabel })).toBeVisible();
  await expect(alert).toBeVisible({ timeout: JOB_TIMEOUT });
});

test("no progress surface promises a percentage or a time", async ({ page }) => {
  await registerLearner(page, "eta");
  await submitVideo(page, WITH_CAPTIONS);

  const progress = page.getByRole("status", { name: enVideos.creation.progressLabel });
  await expect(progress).toBeVisible({ timeout: 15_000 });

  // Guard the guard: an empty list would make every assertion below vacuous.
  expect(PROGRESS_STRINGS).toHaveLength(4);
  for (const label of PROGRESS_STRINGS) {
    expect(label).not.toMatch(/%|\bETA\b|remaining|estimat/i);
  }
  await expect(page.locator('[role="progressbar"]')).toHaveCount(0);
  await expect(page.locator("progress")).toHaveCount(0);
});
