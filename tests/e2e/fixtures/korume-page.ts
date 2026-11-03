import { expect, type Page, type Route } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./auth";
import { advance, installFakeYouTube, fakeYt } from "./fake-youtube";
import { lineStart, VIDEO_DURATION, type WorkspaceData } from "./workspace-data";

/** Shared by the Ask Korume specs: learner setup, lesson opening, and the sheet/mascot locators. */
export interface Learner { userId: string; korumeRequests: string[] }

export async function registerLearner(data: WorkspaceData, page: Page, prefix: string): Promise<Learner> {
  const korumeRequests: string[] = [];
  await page.route(/youtube\.com|youtube-nocookie\.com|googlevideo\.com/, (route) => void route.abort());
  await installFakeYouTube(page, { duration: VIDEO_DURATION });
  page.on("request", (request) => { if (request.url().includes("/api/korume/")) korumeRequests.push(`${request.method()} ${new URL(request.url()).pathname}`); });
  const email = uniqueEmail(prefix);
  await page.goto("/en/register");
  await registerViaUi(page, { name: "E2E Korume", email, password: "password123" });
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15_000 });
  return { userId: await data.userIdByEmail(email), korumeRequests };
}

export async function openLessonAt(data: WorkspaceData, page: Page, index: number): Promise<void> {
  await page.goto(`/en/shadowing/${data.videoId}`);
  await expect(page.getByTestId("fake-yt")).toHaveCount(1);
  await expect.poll(async () => (await fakeYt(page)).seeks.length).toBeGreaterThan(0);
  await setTime(page, lineStart(index) + 0.3);
}

export async function setTime(page: Page, seconds: number): Promise<void> {
  await page.evaluate((s) => (window as unknown as { __fakeYt: { setTime(s: number): void } }).__fakeYt.setTime(s), seconds);
  await advance(page, 0.05);
}

/** The mascot breathes (`companion-breathe`) for as long as it is shown, so it is never "stable" to Playwright. */
export const openMascot = (page: Page) => page.getByRole("button", { name: "Ask Korume" }).click({ force: true });
export const sheet = (page: Page) => page.getByRole("dialog", { name: "Korume" });
export const composer = (scope: Page | ReturnType<Page["locator"]>) => scope.getByRole("textbox", { name: "Message Korume" });
export const answerOf = (turnId: string, text: string) => ({
  message: {
    id: `ai-${turnId}`, turnId, role: "assistant", text,
    answer: { blocks: [{ type: "paragraph", runs: [{ text }] }] }, grounding: [], createdAt: "2026-10-03T08:00:00.000Z",
  },
});

/** Stubs `POST /turns` and records every body; `respond` picks the reply per call. */
export async function stubTurns(page: Page, respond: (body: { turnId: string; text: string }, call: number) => { status: number; body: unknown; headers?: Record<string, string> }) {
  const bodies: { url: string; turnId: string; text: string }[] = [];
  await page.route("**/api/korume/threads/*/turns", async (route: Route) => {
    const body = route.request().postDataJSON() as { turnId: string; text: string };
    bodies.push({ url: route.request().url(), ...body });
    const reply = respond(body, bodies.length);
    await route.fulfill({ status: reply.status, contentType: "application/json", headers: reply.headers, body: JSON.stringify(reply.body) });
  });
  return bodies;
}

