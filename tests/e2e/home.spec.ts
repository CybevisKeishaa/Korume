import { test, expect } from "@playwright/test";

test("landing page renders the hero and auth links", async ({ page }) => {
  await page.goto("/en");
  await expect(
    page.getByRole("heading", {
      name: "Learn Japanese the way it’s actually spoken.",
    }),
  ).toBeVisible();

  // Scope to the hero <main> — "Sign in" also appears in the header and footer.
  const hero = page.getByRole("main");
  await expect(hero.getByText("日本語シネマ")).toBeVisible();
  await expect(
    hero.getByText(
      "Shadow real video, master kanji and grammar, and track it all with a spaced-repetition engine built for retention.",
    ),
  ).toBeVisible();

  // "Start free trial" implied a time-limited trial the product does not
  // have (spec §9.1; docs/product/business-model.md — single tier, no
  // trial, conversion is Contextual Discovery). Pin the corrected copy and
  // prove the false claim is gone.
  await expect(
    hero.getByRole("link", { name: "Get started free" }),
  ).toBeVisible();
  await expect(hero.getByRole("link", { name: /start free trial/i })).toHaveCount(
    0,
  );
  await expect(hero.getByRole("link", { name: /sign in/i })).toBeVisible();
});

// SiteHeader is a server component (it awaits getTranslations), so RTL cannot
// render it — these are its string pins. The CTA used to read "Start free",
// the same false-trial claim as the hero (spec §9.1).
test("marketing header renders the brand, nav landmark and auth links", async ({
  page,
}) => {
  await page.goto("/en");
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "日本語シネマ" })).toHaveAttribute(
    "href",
    "/en",
  );
  await expect(
    header.getByRole("navigation", { name: "Primary" }),
  ).toBeVisible();
  await expect(header.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/en/login",
  );
  await expect(header.getByRole("link", { name: "Get started" })).toHaveAttribute(
    "href",
    "/en/register",
  );
  await expect(header.getByRole("link", { name: /start free/i })).toHaveCount(0);
});

test("marketing footer renders the copyright and auth links", async ({
  page,
}) => {
  await page.goto("/en");
  const footer = page.getByRole("contentinfo");
  const year = new Date().getFullYear();
  await expect(footer.getByText(`© ${year} Nihongo Cinema`)).toBeVisible();
  await expect(footer.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(
    footer.getByRole("link", { name: "Get started" }),
  ).toBeVisible();
});
