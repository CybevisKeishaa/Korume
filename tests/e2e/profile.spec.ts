import { randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";
import { test, expect, type Page } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./fixtures/auth";
import profile from "../../messages/en/profile.json";
import companion from "../../messages/en/companion.json";

/**
 * `/profile` and `/profile/edit` end to end (profile spec §11, plan Task 14).
 *
 * The unit suite proves each piece with a mocked neighbour. What only a real
 * round trip proves: the multipart PATCH reaches `save_profile`, the avatar
 * lands in the private bucket and comes back as a SIGNED url, the saved values
 * are what the next server render reads, and the dirty guard really holds the
 * browser on the page. Every scenario therefore **reloads or navigates** and
 * asserts what the page shows afterwards, never what the click just did.
 *
 * Labels come from the catalog (`messages/README.md`): the copy is the owner's
 * to edit, and a literal here would make this file a second owner of it.
 */

const edit = profile.edit;

/** A fresh account per test: every value below is per-user server state. */
async function signUp(page: Page, tag: string, name = "E2E Profile Tester") {
  const email = uniqueEmail(`e2e_profile_${tag}`);
  await page.goto("/en/register");
  await registerViaUi(page, { name, email, password: "password123" });
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15000 });
}

/** 3-20 chars of [a-z0-9_]; unique per call so parallel workers never collide on the username index. */
const uniqueUsername = () => `e2e_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

const combo = (page: Page, name: string) => page.getByRole("combobox", { name, exact: true });
async function choose(page: Page, field: string, option: string) {
  await combo(page, field).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

/** The value cell of a Quick stats row (`<dt>` label, sibling `<dd>` value). */
const stat = (page: Page, label: string) =>
  page.locator("dl > div").filter({ has: page.locator("dt", { hasText: label }) }).locator("dd");

/** A real, decodable PNG built in the test: solid-colour gradient, no fixture file to go stale. */
function makePng(size = 64): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4);
  header[8] = 8; header[9] = 2; // 8-bit RGB
  const rows: number[] = [];
  for (let y = 0; y < size; y++) {
    rows.push(0); // filter: none
    for (let x = 0; x < size; x++) rows.push((x * 4) & 255, (y * 4) & 255, 160);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.from(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

test.describe("profile", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("a new learner sees an honest, empty archive", async ({ page }) => {
    await signUp(page, "empty");
    await page.goto("/en/profile");

    await expect(page.getByRole("heading", { level: 2, name: "E2E Profile Tester" })).toBeVisible();

    // Quick stats: every row present and zero — never hidden, never invented.
    await expect(stat(page, profile.stats.streak)).toHaveText("0 days");
    await expect(stat(page, profile.stats.xp)).toHaveText("0");
    await expect(stat(page, profile.stats.videoLessons)).toHaveText("0");
    await expect(stat(page, profile.stats.words)).toHaveText("0");
    await expect(stat(page, profile.stats.hours)).toContainText("0h 0m");

    // Journey: the empty state and its way in, no milestone list.
    const journey = page.getByRole("region", { name: profile.journey.title });
    await expect(journey.getByText(profile.journey.empty)).toBeVisible();
    await expect(journey.getByRole("link", { name: profile.journey.emptyCta })).toBeVisible();
    await expect(journey.getByRole("listitem")).toHaveCount(0);

    // Korumeship: fresh copy, no invented duration.
    await expect(page.getByText(profile.korume.fresh)).toBeVisible();
    await expect(page.getByText(/walking together/)).toHaveCount(0);

    // Favorite content: empty state, no chips.
    const favorite = page.getByRole("region", { name: profile.favorite.title });
    await expect(favorite.getByText(profile.favorite.empty)).toBeVisible();
    await expect(favorite.getByRole("listitem")).toHaveCount(0);
  });

  test("every edited field survives a reload; the since row waits for a first activity", async ({ page }) => {
    await signUp(page, "fields");
    const username = uniqueUsername();
    await page.goto("/en/profile/edit");

    await page.getByLabel(edit.fields.displayName, { exact: true }).fill("Keisha Edited");
    await page.getByLabel(edit.fields.username, { exact: true }).fill(username);
    await page.getByLabel(edit.fields.bio, { exact: true }).fill("Shadowing every morning before work.");
    await choose(page, edit.fields.country, "Japan");
    await page.getByLabel(edit.fields.timeZone, { exact: true }).fill("Asia/Tokyo");
    await choose(page, edit.fields.nativeLanguage, "Vietnamese");
    await choose(page, edit.fields.targetJlpt, "N3");
    await choose(page, edit.fields.dailyGoal, edit.dailyMinutes.replace("{minutes}", "30"));
    await page.getByLabel(edit.fields.learningGoal, { exact: true }).fill("Watch an anime without subtitles.");
    await choose(page, edit.fields.subtitleStyle, edit.subtitle.hidden);
    await choose(page, edit.fields.defaultFurigana, edit.furigana.hidden);
    const practices = page.getByRole("group", { name: edit.fields.preferredPractice });
    await practices.getByRole("button", { name: edit.practice.kanji, exact: true }).click();
    await practices.getByRole("button", { name: edit.practice.conversation, exact: true }).click();

    await page.getByRole("button", { name: edit.save, exact: true }).click();
    await expect(page).toHaveURL(/\/en\/profile$/, { timeout: 15000 });
    await page.reload();

    // /profile after a reload: the server render, not client state.
    await expect(page.getByRole("heading", { level: 2, name: "Keisha Edited" })).toBeVisible();
    await expect(page.getByText(`@${username}`)).toBeVisible();
    await expect(page.getByText("Shadowing every morning before work.")).toBeVisible();
    const rows = page.locator("[data-identity-rows]");
    await expect(rows).toContainText("Japan");
    await expect(rows).toContainText("UTC+9");
    await expect(rows).toContainText("N3");
    await expect(rows).toContainText("Vietnamese");
    await expect(rows).toContainText(/Current subtitle\s*Japanese$/);
    await expect(page.getByText("Watch an anime without subtitles.")).toBeVisible();
    // No first activity yet, so no "Learning with Korume since": a date we cannot prove is not shown.
    await expect(page.getByText(/Learning with Korume since/)).toHaveCount(0);

    // /profile/edit after a reload shows the saved values in the controls too (the ones /profile does not print).
    await page.goto("/en/profile/edit");
    await expect(page.getByLabel(edit.fields.displayName, { exact: true })).toHaveValue("Keisha Edited");
    await expect(page.getByLabel(edit.fields.username, { exact: true })).toHaveValue(username);
    await expect(page.getByLabel(edit.fields.timeZone, { exact: true })).toHaveValue("Asia/Tokyo");
    await expect(combo(page, edit.fields.dailyGoal)).toContainText("30");
    await expect(combo(page, edit.fields.subtitleStyle)).toContainText(edit.subtitle.hidden);
    await expect(combo(page, edit.fields.defaultFurigana)).toContainText(edit.furigana.hidden);
    const saved = page.getByRole("group", { name: edit.fields.preferredPractice });
    await expect(saved.getByRole("button", { name: edit.practice.kanji, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(saved.getByRole("button", { name: edit.practice.conversation, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(saved.getByRole("button", { name: edit.practice.grammar, exact: true })).toHaveAttribute("aria-pressed", "false");
  });

  test("a username another learner holds is refused on the Username field", async ({ page, browser }) => {
    const username = uniqueUsername();

    await signUp(page, "first");
    await page.goto("/en/profile/edit");
    await page.getByLabel(edit.fields.username, { exact: true }).fill(username);
    await page.getByRole("button", { name: edit.save, exact: true }).click();
    await expect(page).toHaveURL(/\/en\/profile$/, { timeout: 15000 });

    const other = await browser.newContext({ locale: "en", viewport: { width: 1280, height: 800 } });
    try {
      const second = await other.newPage();
      await signUp(second, "second", "Second Learner");
      await second.goto("/en/profile/edit");
      const field = second.getByLabel(edit.fields.username, { exact: true });
      await field.fill(username);
      await second.getByRole("button", { name: edit.save, exact: true }).click();

      await expect(second.getByText(edit.errors.taken)).toBeVisible();
      await expect(field).toHaveAttribute("aria-invalid", "true");
      await expect(field).toBeFocused();
      await expect(second).toHaveURL(/\/en\/profile\/edit$/); // the save was refused, not navigated away
    } finally {
      await other.close();
    }
  });

  test("an uploaded photo is served from a signed private URL and can be removed", async ({ page }) => {
    await signUp(page, "avatar");
    await page.goto("/en/profile/edit");

    await page.locator('input[type="file"]').setInputFiles({ name: "me.png", mimeType: "image/png", buffer: makePng() });
    await page.getByRole("button", { name: edit.save, exact: true }).click();
    await expect(page).toHaveURL(/\/en\/profile$/, { timeout: 15000 });

    const photo = page.locator("img[alt*='photo']");
    await expect(photo).toHaveCount(1);
    await expect(photo).toHaveAttribute("src", /\/storage\/v1\/object\/sign\/avatars\/.+\.webp\?token=/);
    // The signed URL really serves the re-encoded image, not just a well-formed string.
    const src = (await photo.getAttribute("src"))!;
    const served = await page.request.get(src);
    expect(served.status()).toBe(200);
    expect(served.headers()["content-type"]).toContain("image/webp");

    await page.goto("/en/profile/edit");
    await page.getByRole("button", { name: edit.avatar.remove, exact: true }).click();
    await page.getByRole("button", { name: edit.save, exact: true }).click();
    await expect(page).toHaveURL(/\/en\/profile$/, { timeout: 15000 });
    await page.reload();

    await expect(page.locator("img[alt*='photo']")).toHaveCount(0);
    await expect(page.locator("section span[aria-hidden='true']", { hasText: /^E$/ })).toBeVisible(); // initials are back
    await page.goto("/en/profile/edit");
    await expect(page.getByRole("button", { name: edit.avatar.remove, exact: true })).toHaveCount(0);
  });

  test("unsaved changes hold the page until the learner chooses", async ({ page }) => {
    await signUp(page, "dirty");
    await page.goto("/en/profile/edit");

    const bio = page.getByLabel(edit.fields.bio, { exact: true });
    await bio.fill("Typed but not saved");
    await page.getByRole("link", { name: "Dashboard", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: edit.dirty.title });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: edit.dirty.stay, exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/en\/profile\/edit$/);
    await expect(bio).toHaveValue("Typed but not saved");

    await page.getByRole("link", { name: "Dashboard", exact: true }).click();
    await page.getByRole("dialog", { name: edit.dirty.title }).getByRole("button", { name: edit.dirty.leave, exact: true }).click();
    await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15000 });
  });

  test("Show Korume off removes the companion from the profile and disables its chat", async ({ page }) => {
    await signUp(page, "korume");
    await page.goto("/en/profile");
    await expect(page.getByRole("heading", { level: 2, name: profile.korume.title })).toBeVisible(); // control: it is on first

    await page.goto("/en/profile/edit");
    await page.getByRole("switch", { name: edit.fields.showKorume, exact: true }).click();
    await page.getByRole("button", { name: edit.save, exact: true }).click();
    await expect(page).toHaveURL(/\/en\/profile$/, { timeout: 15000 });
    await page.reload();

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: profile.korume.title })).toHaveCount(0);
    await expect(page.getByText(profile.korume.fresh)).toHaveCount(0);

    await page.goto("/en/korume/chat");
    await expect(page.getByText(companion.ask.chat.disabledTitle)).toBeVisible();
    // The way back, inside the disabled panel (the sidebar and header carry Settings links too).
    const panel = page.locator("section").filter({ hasText: companion.ask.chat.disabledTitle });
    await expect(panel.getByRole("link", { name: companion.ask.chat.settings, exact: true })).toHaveAttribute("href", "/en/settings");
  });

  test("choosing Tiếng Việt lands on the Vietnamese profile", async ({ page }) => {
    await signUp(page, "locale");
    await page.goto("/en/profile/edit");
    await choose(page, edit.fields.interfaceLanguage, "Tiếng Việt");
    await page.getByRole("button", { name: edit.save, exact: true }).click();
    await expect(page).toHaveURL(/\/vi\/profile$/, { timeout: 15000 });
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  });
});
