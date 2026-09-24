import { test, expect, type Page } from "@playwright/test";
import { registerViaUi } from "./fixtures/auth";
import en from "../../messages/en/settings.json";

/**
 * `/settings` end to end (settings spec §8).
 *
 * The unit suite proves each control calls `save` with the right body. It
 * cannot prove the value came back: the save hook applies the SERVER's answer
 * over its optimistic one, the route writes two different tables, and the
 * page re-reads through `PreferencesProvider` on the next load. Only a real
 * round trip closes that loop, which is why every case here **reloads** and
 * asserts what the page shows afterwards rather than trusting the click.
 *
 * Labels come from the catalog, not from literals — the copy is the owner's
 * to edit (`messages/README.md`), and a hardcoded string here would make this
 * file a second owner of it.
 */

const copy = en.page;

/** A fresh account per test: every preference below is per-user server state. */
async function signUp(page: Page, tag: string, testInfo: { workerIndex: number; testId: string }) {
  const email = `e2e_settings_${tag}_${Date.now()}_${testInfo.workerIndex}_${testInfo.testId}@example.com`;
  await page.goto("/en/register");
  await registerViaUi(page, { name: "E2E Settings Tester", email, password: "password123" });
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15000 });
}

const radio = (page: Page, name: string) => page.getByRole("radio", { name, exact: true });
const switchFor = (page: Page, name: string) => page.getByRole("switch", { name, exact: true });

test.describe("settings", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signUp(page, "main", testInfo);
  });

  /**
   * One test walks every control rather than one test each: a fresh account
   * costs a full registration round trip, and the assertion that matters —
   * "it survived a reload" — is identical for all of them.
   */
  test("every control keeps its value across a reload", async ({ page }) => {
    await page.goto("/en/settings");
    await expect(page.getByRole("heading", { level: 1, name: copy.title })).toBeVisible();

    // Segmented controls.
    await radio(page, copy.schedule.weekdays).click();
    await radio(page, copy.reviewFrequency.relaxed).click();
    await radio(page, copy.difficulty.challenge).click();
    await radio(page, copy.displayScale.large).click();

    // Switches. Microphone defaults on, camera defaults off, motion defaults off.
    await switchFor(page, copy.reducedMotion.label).click();
    await switchFor(page, copy.microphone.label).click();
    await switchFor(page, copy.camera.label).click();

    // The daily goal is a select; pick a value that is not the 15-minute default.
    await page.getByRole("combobox", { name: copy.dailyGoal.label }).click();
    await page.getByRole("option", { name: copy.dailyGoal.option.replace("{minutes}", "30") }).click();

    // Give the last PATCH time to land before throwing the page away — a
    // reload mid-flight would test the race, not the persistence.
    await expect.poll(async () => {
      const response = await page.request.get("/api/user/preferences");
      return (await response.json()).data?.dailyMinutes;
    }).toBe(30);

    await page.reload();

    await expect(radio(page, copy.schedule.weekdays)).toBeChecked();
    await expect(radio(page, copy.reviewFrequency.relaxed)).toBeChecked();
    await expect(radio(page, copy.difficulty.challenge)).toBeChecked();
    await expect(radio(page, copy.displayScale.large)).toBeChecked();
    await expect(switchFor(page, copy.reducedMotion.label)).toHaveAttribute("aria-checked", "true");
    await expect(switchFor(page, copy.microphone.label)).toHaveAttribute("aria-checked", "false");
    await expect(switchFor(page, copy.camera.label)).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("combobox", { name: copy.dailyGoal.label })).toContainText("30");
  });

  /**
   * Custom is the only schedule mode with a second half. The server
   * canonicalises the other two, so this is the one where what the page sends
   * and what it shows can genuinely diverge.
   */
  test("a custom schedule keeps exactly the days that were chosen", async ({ page }) => {
    await page.goto("/en/settings");
    await radio(page, copy.schedule.custom).click();

    const days = page.getByRole("group", { name: copy.schedule.daysLabel });
    await expect(days).toBeVisible();

    // Start from every day on; turn five off, leaving Monday and Thursday.
    for (const iso of ["2", "3", "5", "6", "7"] as const) {
      await days.getByRole("button", { name: copy.schedule.day[iso], exact: true }).click();
    }

    await expect.poll(async () => {
      const response = await page.request.get("/api/user/preferences");
      return (await response.json()).data?.scheduleDays;
    }).toEqual([1, 4]);

    await page.reload();
    await expect(days.getByRole("button", { name: copy.schedule.day["1"], exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(days.getByRole("button", { name: copy.schedule.day["4"], exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(days.getByRole("button", { name: copy.schedule.day["2"], exact: true })).toHaveAttribute("aria-pressed", "false");
  });

  test("refuses to leave the schedule with no days at all", async ({ page }) => {
    await page.goto("/en/settings");
    await radio(page, copy.schedule.custom).click();

    const days = page.getByRole("group", { name: copy.schedule.daysLabel });
    for (const iso of ["2", "3", "4", "5", "6", "7"] as const) {
      await days.getByRole("button", { name: copy.schedule.day[iso], exact: true }).click();
    }
    // Only Monday is left; turning it off must be refused, not sent and 400'd.
    await days.getByRole("button", { name: copy.schedule.day["1"], exact: true }).click();

    // Located by its TEXT, then asserted to carry the role — `getByRole
    // ("alert")` alone is ambiguous here, because Next renders its own
    // always-present `__next-route-announcer__` with the same role. Asserting
    // the attribute on this specific element keeps the a11y half of the claim
    // (the refusal is announced) that a bare text query would lose.
    const hint = page.getByText(copy.schedule.atLeastOne);
    await expect(hint).toBeVisible();
    await expect(hint).toHaveAttribute("role", "alert");
    await expect(days.getByRole("button", { name: copy.schedule.day["1"], exact: true })).toHaveAttribute("aria-pressed", "true");
  });

  /**
   * ⚠️ Asserting what is NOT on the page. Spec §1.3, §1.7 and §10 drop these
   * rows because nothing in this repo is behind them, and a row that goes
   * nowhere reads as finished. The list's own length is asserted, or an empty
   * array would make this pass while checking nothing.
   */
  test("ships no row that leads nowhere", async ({ page }) => {
    await page.goto("/en/settings");
    await expect(page.getByRole("heading", { level: 1, name: copy.title })).toBeVisible();

    const absent = [
      "Theme", "Accent Color", "Study Reminder Time", "Learning Reminders",
      "Discord", "Facebook", "TikTok", "Privacy Policy", "Terms of Service",
      "Send Feedback", "Contact Support",
    ];
    expect(absent).toHaveLength(11);

    for (const label of absent) {
      await expect(page.getByText(label, { exact: true })).toHaveCount(0);
    }
  });

  test("keeps /settings/privacy as its own page, not a redirect", async ({ page }) => {
    await page.goto("/en/settings/privacy");
    await expect(page).toHaveURL(/\/en\/settings\/privacy$/);
    await expect(page.getByRole("heading", { level: 1, name: en.privacy.title })).toBeVisible();
  });

  test("exports the caller's own data, preferences included", async ({ page }) => {
    await page.goto("/en/settings");
    const response = await page.request.get("/api/user/export");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-disposition"]).toMatch(/attachment; filename="korume-export-/);
    const body = await response.json();
    expect(Object.keys(body.tables)).toContain("user_preferences");
  });

  /**
   * The one behaviour on this branch that destroys data, so it is asserted
   * from the outside: what the export holds before, and after.
   *
   * ⚠️ `/en/journal` is visited exactly ONCE. Opening it records the
   * first-meeting memory, so a second visit after the erase would re-create
   * the row this test is checking is gone, and the test would fail against
   * correct code.
   */
  test("erasing Korume memory removes memories and conversations, and nothing else", async ({ page }) => {
    await page.goto("/en/journal");
    await expect(page.locator("main:visible")).toBeVisible();

    const before = await (await page.request.get("/api/user/export")).json();
    expect(
      before.tables.companion_memories.length,
      "the journal visit must have recorded a memory, or this test proves nothing",
    ).toBeGreaterThan(0);

    await page.goto("/en/settings/privacy/memory");
    await page.getByLabel(new RegExp(en.memoryErase.confirmWord)).fill(en.memoryErase.confirmWord);
    await page.getByRole("button", { name: en.memoryErase.submit, exact: true }).click();
    await expect(page).toHaveURL(/\/en\/settings/);

    const after = await (await page.request.get("/api/user/export")).json();
    expect(after.tables.companion_memories).toHaveLength(0);
    expect(after.tables.conversation_sessions).toHaveLength(0);
    // The promise the confirmation page makes: learning progress survives.
    expect(after.tables.user_stats).toEqual(before.tables.user_stats);
  });

  /**
   * ⚠️ This case exists because **jsdom cannot host it**. Probed directly:
   * focus a `<button>` in jsdom, set `disabled = true`, and
   * `document.activeElement` is still that button — so a unit test asserting
   * focus passes whether or not the control disables itself mid-save. A real
   * browser moves focus to `<body>`.
   *
   * The defect: `SegmentedControl.move()` focuses the next option and then
   * calls `onValueChange`; while the controls rendered `disabled={saving}`,
   * the save blurred the element the arrow key had just focused. With a
   * roving tabindex, recovering meant tabbing from the top of the page.
   *
   * `sections.test.tsx` guards the structural cause — the options stay
   * enabled mid-save. This proves the consequence the user actually feels.
   */
  test("keyboard focus survives a display-scale change", async ({ page }) => {
    await page.goto("/en/settings");
    const group = page.getByRole("radiogroup", { name: copy.displayScale.label, exact: true });
    await expect(group).toBeVisible();
    await group.getByRole("radio", { name: copy.displayScale.normal, exact: true }).focus();

    await page.keyboard.press("ArrowRight");

    // ⚠️ These assertions auto-retry and nothing holds the response open, so
    // they do NOT sample the in-flight window — an earlier version of this
    // comment claimed they did. What they prove is that focus is still on the
    // option AFTER the save settles, which is the part that actually broke:
    // the defect blurred the element and never gave focus back. Measured, with
    // `disabled={scale.saving}` restored and rebuilt, this went red with the
    // trace showing `<button disabled role="radio">` and focus "inactive"
    // across 11 polls — long past the PATCH completing.
    const large = group.getByRole("radio", { name: copy.displayScale.large, exact: true });
    await expect(large).toBeChecked();
    await expect(large).toBeFocused();
  });

  test("fits the owner's viewport without horizontal scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 529 });
    await page.goto("/en/settings");
    await expect(page.getByRole("heading", { level: 1, name: copy.title })).toBeVisible();

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
