import { expect, test, type Locator, type Page } from "@playwright/test";
import enPronunciation from "@/messages/en/pronunciation.json";
import { registerViaUi } from "./fixtures/auth";
import { seedSearchData } from "./fixtures/search-data";

// Search spec 2026-10-01, measured acceptance at the owner's viewport 1280x529.
const { search, display } = enPronunciation.hub;
let seeded: Awaited<ReturnType<typeof seedSearchData>>;

test.beforeAll(async () => { seeded = await seedSearchData(30); });
// afterAll runs when a test fails too, so the prefix never outlives the run.
test.afterAll(async () => { await seeded?.cleanup(); });

async function registerLearner(page: Page): Promise<void> {
  await page.goto("/en/register");
  await registerViaUi(page, { name: "E2E Search Tester", email: `e2e_search_${crypto.randomUUID()}@example.com`, password: "password123" });
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15_000 });
}

const columns = (grid: Locator) => grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
const visibleCardWidths = (grid: Locator) => grid.evaluate((element) => [...element.children]
  .filter((child) => getComputedStyle(child).display !== "none")
  .map((child) => child.getBoundingClientRect().width));
const noHorizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test("All previews one real row per group under counted tabs; the rest leave the accessibility tree", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 529 });
  await registerLearner(page);
  await page.goto(`/en/pronunciation?q=${seeded.prefix}`);

  const tabs = page.getByRole("navigation", { name: search.tabsLabel });
  await expect(tabs.getByRole("link", { name: "Lessons (30)" })).toBeVisible();
  await expect(tabs.getByRole("link", { name: "Learning paths (1)" })).toBeVisible();
  await expect(tabs.getByRole("link", { name: search.tabs.all })).toHaveAttribute("aria-current", "page");

  const lessons = page.getByRole("region", { name: search.groups.lessons });
  const grid = lessons.getByRole("list");
  const count = await columns(grid);
  expect(count).toBe(3);
  const cards = grid.locator(":scope > li");
  await expect(cards).toHaveCount(4); // four fetched ...
  for (let index = 0; index < 4; index += 1) {
    if (index < count) await expect(cards.nth(index)).toBeVisible();
    else await expect(cards.nth(index)).toBeHidden(); // ... one row shown
  }
  // Hidden by display: none, so not merely clipped: out of the accessibility tree.
  await expect(grid.getByRole("listitem")).toHaveCount(count);
  await expect(lessons.getByRole("link", { name: new RegExp(`^${seeded.prefix} Ramen`) })).toHaveCount(count);
});

test("the grid reflows from 3 to 4 columns when the AppNav hides, cards stay 200-235 px, nothing overflows", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 529 });
  await registerLearner(page);
  await page.goto(`/en/pronunciation?q=${seeded.prefix}&type=lessons`);

  const grid = page.locator(".result-grid").first();
  expect(await columns(grid)).toBe(3);
  for (const width of await visibleCardWidths(grid)) {
    expect(width).toBeGreaterThanOrEqual(200);
    expect(width).toBeLessThanOrEqual(235);
  }
  expect(await noHorizontalOverflow(page)).toBe(true);

  await page.getByRole("button", { name: "Hide navigation" }).click();
  // Without reload: the container query and the auto-fill grid follow the pane.
  await expect.poll(() => columns(grid)).toBe(4);
  for (const width of await visibleCardWidths(grid)) {
    expect(width).toBeGreaterThanOrEqual(200);
    expect(width).toBeLessThanOrEqual(235);
  }
  expect(await noHorizontalOverflow(page)).toBe(true);
});

for (const width of [1024, 1440]) {
  test(`at ${width}px no card is wider than 300 px and nothing overflows`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await registerLearner(page);
    await page.goto(`/en/pronunciation?q=${seeded.prefix}&type=lessons`);

    const grid = page.locator(".result-grid").first();
    await expect(grid.getByRole("listitem").first()).toBeVisible();
    for (const card of await visibleCardWidths(grid)) expect(card).toBeLessThanOrEqual(300);
    expect(await noHorizontalOverflow(page)).toBe(true);
  });
}

test("Show more by keyboard focuses the first new card; tabs keep the lesson settings", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 529 });
  await registerLearner(page);
  await page.goto(`/en/pronunciation?q=${seeded.prefix}&type=lessons&sort=shortest`);

  const cards = page.locator(".result-grid").first().getByRole("listitem");
  await expect(cards).toHaveCount(24);
  const more = page.getByRole("link", { name: search.showMore.lessons });
  await more.focus();
  await page.keyboard.press("Enter");
  await expect(cards).toHaveCount(30);
  await expect(page).toHaveURL(/shown=48/);
  await expect(cards.nth(24).getByRole("link")).toBeFocused();

  // Paths: a kind the lesson controls cannot shape, so they are not offered.
  await page.getByRole("link", { name: /^Learning paths \(1\)/ }).click();
  await expect(page).toHaveURL(/type=paths/);
  await expect(page).not.toHaveURL(/shown=/);
  await expect(page.getByRole("button", { name: new RegExp(`^${display.trigger}`) })).toHaveCount(0);
  await expect(page.getByRole("link", { name: new RegExp(`${seeded.prefix} Ramen Path`) }).first()).toBeVisible();

  // Back to Lessons: the sort rode along in the URL, and the controls show it.
  await page.getByRole("link", { name: /^Lessons \(30\)/ }).click();
  await expect(page).toHaveURL(/type=lessons/);
  await expect(page).toHaveURL(/sort=shortest/);
  await page.getByRole("button", { name: new RegExp(`^${display.trigger}`) }).click();
  await expect(page.getByRole("radio", { name: display.shortest })).toBeChecked();
});

test("an unknown type lands on the URL without it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 529 });
  await registerLearner(page);
  await page.goto(`/en/pronunciation?q=${seeded.prefix}&type=xyz&shown=48`);

  await expect(page).toHaveURL(new RegExp(`/en/pronunciation\\?q=${seeded.prefix}$`));
  await expect(page.getByRole("navigation", { name: search.tabsLabel }).getByRole("link", { name: search.tabs.all })).toHaveAttribute("aria-current", "page");
});
