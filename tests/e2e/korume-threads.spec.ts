import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./fixtures/auth";
import { seedWorkspaceData, type WorkspaceData } from "./fixtures/workspace-data";

/**
 * Ask Korume thread creation over real HTTP (spec §4.1, §7.5): the client's draft id makes a double-sent first
 * POST idempotent, and a thread is invisible to every other learner. No AI is involved.
 */
let data: WorkspaceData;
test.beforeAll(async () => { data = await seedWorkspaceData(); });
test.afterAll(async () => { await data?.cleanup(); });

async function registerLearner(page: Page, prefix: string): Promise<void> {
  await page.goto("/en/register");
  await registerViaUi(page, { name: "E2E Korume", email: uniqueEmail(prefix), password: "password123" });
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15_000 });
}

test("two parallel first POSTs with one draft id create one thread", async ({ page, browser }) => {
  await registerLearner(page, "e2e_korume_a");
  const threadId = randomUUID();
  const body = { threadId, videoId: data.videoId, lineId: data.lineIds[3] };

  const [a, b] = await Promise.all([
    page.request.post("/api/korume/threads", { data: body }),
    page.request.post("/api/korume/threads", { data: body }),
  ]);
  expect([a.status(), b.status()].sort()).toEqual([200, 201]);
  for (const response of [a, b]) {
    const json = await response.json() as { thread: { id: string; originRoute: string; anchor: { lineId: string } } };
    expect(json.thread.id).toBe(threadId);
    expect(json.thread.originRoute).toBe(`/shadowing/${data.videoId}?line=${data.lineIds[3]}`);
    expect(json.thread.anchor.lineId).toBe(data.lineIds[3]);
  }
  const { count, error } = await data.admin.from("conversation_sessions")
    .select("id", { count: "exact", head: true }).eq("id", threadId);
  expect(error).toBeNull();
  expect(count).toBe(1);

  // The same id with a different anchor is a conflict, not a second row.
  const moved = await page.request.post("/api/korume/threads", { data: { ...body, lineId: data.lineIds[4] } });
  expect(moved.status()).toBe(409);
  // A client-built route is refused outright.
  expect((await page.request.post("/api/korume/threads", { data: { threadId: randomUUID(), originRoute: "/x" } })).status()).toBe(400);

  // Another learner sees nothing: GET and a replayed POST are the same generic 404.
  const context = await browser.newContext();
  const other = await context.newPage();
  await registerLearner(other, "e2e_korume_b");
  const read = await other.request.get(`/api/korume/threads/${threadId}`);
  expect(read.status()).toBe(404);
  await expect(read.json()).resolves.toEqual({ error: "not_found" });
  const steal = await other.request.post("/api/korume/threads", { data: body });
  expect(steal.status()).toBe(404);
  await context.close();

  // The owner reads it back with no messages and nothing pending.
  const own = await page.request.get(`/api/korume/threads/${threadId}`);
  expect(own.status()).toBe(200);
  await expect(own.json()).resolves.toMatchObject({ thread: { id: threadId }, messages: [], pendingTurns: [] });

  await data.admin.from("conversation_sessions").delete().eq("id", threadId);
});
