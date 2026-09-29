import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";

/**
 * A registration email no other test can repeat. `Date.now()` alone is NOT
 * unique: Playwright runs files in parallel workers, two of them registered in
 * the same millisecond, and the second signup failed on the auth unique index
 * (`users_email_partial_key`) and surfaced as an empty "{}" alert on
 * /register, which read as a flake for weeks.
 */
export function uniqueEmail(prefix: string): string {
  return `${prefix}_${randomUUID()}@example.com`;
}

export async function registerViaUi(page: Page, user: { name: string; email: string; password: string }) {
  await page.getByLabel("Name", { exact: true }).fill(user.name);
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByLabel("Confirm password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
}

export async function signInViaUi(page: Page, user: { email: string; password: string }) {
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
