import { expect, test, type Page } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./fixtures/auth";
import type { WorkspaceData } from "./fixtures/workspace-data";
import { seedDashboardData, seedDashboardWorkspaceData } from "./fixtures/dashboard-data";
import dashboard from "../../messages/en/dashboard.json";
import common from "../../messages/en/common.json";

test.describe.configure({ mode: "default" });
let lesson: WorkspaceData;
let userId: string | undefined;
let registrationEmail: string | undefined;
let evidence: { cleanup(): Promise<void> } | undefined;
const area = (page: Page, name: string) => page.locator(`[data-area="${name}"]`);

test.beforeAll(async () => { lesson = await seedDashboardWorkspaceData(); });
test.afterAll(async () => { await lesson?.cleanup(); });
test.afterEach(async ({ page }) => {
  try {
    await page.close();
    await evidence?.cleanup();
  } finally {
    evidence = undefined;
    if (!userId && registrationEmail) {
      const user = await lesson.admin.from("users").select("id").eq("email", registrationEmail).maybeSingle();
      if (user.error) throw user.error;
      userId = user.data?.id;
    }
    if (userId) {
      const deleted = await lesson.admin.auth.admin.deleteUser(userId);
      if (deleted.error) throw deleted.error;
      userId = undefined;
    }
    registrationEmail = undefined;
  }
});

async function register(page: Page): Promise<string> {
  const email = uniqueEmail("e2e_dashboard");
  registrationEmail = email;
  await page.goto("/en/register");
  await registerViaUi(page, { name: "Dashboard Learner", email, password: "password123" });
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15_000 });
  userId = await lesson.userIdByEmail(email);
  await settled(page);
  await page.waitForLoadState("networkidle");
  return userId;
}

async function populate(page: Page): Promise<void> {
  const id = await register(page);
  // Pause browser prefetch while seeding: a second dashboard render must not freeze a half-seeded cycle.
  await page.goto("about:blank");
  evidence = await seedDashboardData(lesson.admin, id, lesson);
  await page.goto("/en/dashboard");
  await settled(page);
}

async function settled(page: Page): Promise<void> {
  await expect(page.locator(".dashboard-header")).toBeVisible();
  await expect(page.locator(".dashboard-grid [data-area]")).toHaveCount(9);
  await expect(page.locator(".dashboard-grid [aria-busy='true']")).toHaveCount(0);
  await expect(area(page, "activity").locator("[data-state]")).toHaveCount(56);
  await expect(page.getByText(dashboard.card.error, { exact: true })).toHaveCount(0);
  await expect(page.getByText(dashboard.mission.error, { exact: true })).toHaveCount(0);
}

async function geometry(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const bounds = await page.locator(".dashboard-row--lead").evaluate((row) => ({
    bottom: row.getBoundingClientRect().bottom,
    scrollWidth: document.documentElement.scrollWidth,
    width: window.innerWidth,
    height: window.innerHeight,
    rowHeight: row.getBoundingClientRect().height,
  }));
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width);
  expect(bounds.rowHeight).toBeGreaterThan(0);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.height + 4);
}

for (const viewport of [{ width: 1280, height: 529 }, { width: 1440, height: 900 }]) {
  test.describe(`${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test("new learner has honest empty states, C2 journey, fold and no overflow", async ({ page }) => {
      await register(page);
      await settled(page);
      // C2 has core lessons: Continue offers the real first lesson, and N5 is current at 0%.
      await expect(area(page, "continue")).toContainText(dashboard.continue.eyebrow.startNext);
      await expect(area(page, "continue").getByRole("link", { name: dashboard.continue.cta.start })).toBeVisible();
      await expect(area(page, "mission")).toContainText(dashboard.mission.onboarding);
      await expect(area(page, "journey").getByRole("listitem")).toHaveCount(3);
      await expect(area(page, "journey").getByRole("listitem").first()).toHaveText("N5 0%");
      await expect(area(page, "weakness")).toContainText(dashboard.weakness.empty);
      await expect(area(page, "weekly")).toContainText(dashboard.weekly.notTracked);
      await expect(area(page, "activity")).toContainText(dashboard.activity.noStreak);
      await expect(area(page, "activity").locator('[data-state="active"]')).toHaveCount(0);
      await expect(area(page, "korume").getByRole("button", { name: dashboard.korume.viewWeakness })).toHaveCount(0);
      const achievements = area(page, "achievements").getByRole("listitem");
      await expect(achievements).toHaveCount(3);
      await expect(area(page, "achievements")).not.toContainText(dashboard.achievements.earnedToday);
      await expect(area(page, "quick").getByRole("link")).toHaveCount(4);
      await expect(area(page, "quick")).toContainText(dashboard.quick.caughtUp);
      await geometry(page);
    });

    test("populated learner reviews the frozen due card and sees persisted 1/1 mission progress", async ({ page }) => {
      await populate(page);
      const rows = area(page, "mission").getByRole("listitem");
      await expect(rows).toHaveCount(3);
      const review = rows.filter({ hasText: dashboard.mission.item.review.replace("{target}", "1") });
      await expect(review).toHaveCount(1);
      await expect(review).toContainText("0/1");
      await expect(area(page, "continue")).toContainText(lesson.prefix);
      await expect(area(page, "continue")).toContainText("32% completed");
      await expect(area(page, "quick")).toContainText(dashboard.quick.due.replace("{count}", "2"));
      await geometry(page);
      await page.goto("/en/kanji/review");
      await page.getByRole("button", { name: common.srs.showAnswer }).click();
      const saved = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/srs/review" && response.request().method() === "POST");
      await page.getByRole("button", { name: common.srs.good, exact: false }).click();
      expect((await saved).status()).toBe(200);
      await page.goto("/en/dashboard");
      await settled(page);
      await expect(review).toContainText("1/1");
      await page.reload();
      await settled(page);
      await expect(review).toContainText("1/1");
    });
  });
}

test("streak, View weakness and trophy move focus to their real targets", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await populate(page);
  await page.locator(".dashboard-streak").click();
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("learning-activity");
  await area(page, "korume").getByRole("button", { name: dashboard.korume.viewWeakness }).click();
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("weakness-snapshot");
  await area(page, "achievements").getByRole("link", { name: dashboard.achievements.viewAll }).click();
  await expect(page).toHaveURL(/\/en\/profile#achievements$/);
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("achievements");
});

test("Korume off removes its card and lets both remaining cards fill row two", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const id = await register(page);
  await settled(page);
  await expect(area(page, "korume")).toHaveCount(1);
  const changed = await lesson.admin.from("user_preferences").upsert({ user_id: id, companion_enabled: false });
  if (changed.error) throw changed.error;
  await page.reload();
  await expect(page.locator(".dashboard-grid [data-area]")).toHaveCount(8);
  await expect(page.locator(".dashboard-grid [aria-busy='true']")).toHaveCount(0);
  await expect(area(page, "korume")).toHaveCount(0);
  const boxes = await page.locator(".dashboard-row--three").evaluate((row) => ({
    row: row.getBoundingClientRect().toJSON(),
    children: Array.from(row.children).map((card) => card.getBoundingClientRect().toJSON()),
    columns: getComputedStyle(row).gridTemplateColumns.split(" ").length,
  }));
  expect(boxes.children).toHaveLength(2);
  expect(boxes.columns).toBe(2);
  expect(boxes.children[0].left).toBeCloseTo(boxes.row.left, 0);
  expect(boxes.children[1].left).toBeGreaterThan(boxes.children[0].right);
  expect(boxes.children[1].right).toBeCloseTo(boxes.row.right, 0);
  expect(boxes.children[0].width).toBeCloseTo(boxes.children[1].width, 0);
});
