import { expect, test, type Page } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./fixtures/auth";
import { lineStart, seedWorkspaceData, type WorkspaceData } from "./fixtures/workspace-data";

/**
 * Ask Korume live smoke (ask-korume plan Task 11 step 4): the REAL provider behind `POST /turns`, never a stub.
 * Data is the synthetic workspace fixture only — Gemini's free tier trains on its input (AGENTS.md §3), so no real
 * learner data may reach it. Each turn must leave exactly one successful plan and one successful answer generation,
 * one settled reservation and one charge; the rail's "Seen N" must equal an oracle computed here with SQL, not with
 * `countExposure`; and two concurrent POSTs of one new turnId must produce one answer and one reservation.
 *
 * Run against a worktree server started with `AI_PROVIDER=gemini` on :3000:
 *   npx playwright test --config=playwright.live.config.ts korume.live
 */
test.use({ viewport: { width: 1280, height: 529 } });
test.setTimeout(300_000);

/** The learner's progress stops here: every line starting at or before it counts as seen (spec §5.3). */
const WATCHED_UP_TO = lineStart(9);

let data: WorkspaceData;
test.beforeAll(async () => { data = await seedWorkspaceData(); });
test.afterAll(async () => { await data?.cleanup(); });

const composer = (page: Page) => page.getByRole("textbox", { name: "Message Korume" });

async function ledgerFor(turnId: string) {
  const [generations, reservations] = await Promise.all([
    data.admin.from("ai_generations").select("section, outcome").eq("turn_id", turnId),
    data.admin.from("ai_reservations").select("id, status").eq("turn_id", turnId),
  ]);
  if (generations.error) throw generations.error;
  if (reservations.error) throw reservations.error;
  const ids = reservations.data.map((r) => r.id as string);
  const charges = ids.length === 0 ? { data: [], error: null } : await data.admin.from("ai_usage_charges").select("id").in("reservation_id", ids);
  if (charges.error) throw charges.error;
  return { generations: generations.data, reservations: reservations.data, charges: charges.data };
}

async function turnIdsOf(threadId: string): Promise<string[]> {
  const { data: rows, error } = await data.admin.from("conversation_messages").select("turn_id, created_at")
    .eq("session_id", threadId).eq("role", "ai").order("created_at");
  if (error) throw error;
  return rows.map((row) => row.turn_id as string);
}

test("live Gemini: two grounded turns, an exact ledger per turn, Seen N equals the oracle, and a double POST answers once", async ({ page }) => {
  // Prove the subject exists first: a real provider is configured on the server under test.
  const email = uniqueEmail("e2e_korume_live");
  await page.goto("/en/register");
  await registerViaUi(page, { name: "E2E Korume Live", email, password: "password123" });
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15_000 });
  const userId = await data.userIdByEmail(email);

  const progress = await data.admin.from("user_video_progress").upsert({
    user_id: userId, video_id: data.videoId, last_watched_position: WATCHED_UP_TO, last_watched_at: new Date().toISOString(),
  });
  if (progress.error) throw progress.error;
  // The oracle, independent of the app: seen lines of the fixture video that contain は (each fixture line has one).
  const transcript = await data.admin.from("transcripts").select("id").eq("video_id", data.videoId).single();
  if (transcript.error) throw transcript.error;
  const seen = await data.admin.from("transcript_lines").select("text_jp")
    .eq("transcript_id", transcript.data.id).lte("start_time", WATCHED_UP_TO);
  if (seen.error) throw seen.error;
  const oracle = seen.data.filter((row) => (row.text_jp as string).split("は").length === 2).length;
  expect(oracle).toBeGreaterThanOrEqual(10);

  await page.goto("/en/korume/chat");
  const questions = ["How many times have I seen the particle は in my Shadowing lessons?", "What does は do in 今日は?"];
  for (const [index, question] of questions.entries()) {
    await composer(page).fill(question);
    await composer(page).press("Enter");
    // Done when the server has persisted the answer — the DB, not a DOM guess, is the signal.
    await expect.poll(async () => {
      const threadId = new URL(page.url()).searchParams.get("thread");
      return threadId ? (await turnIdsOf(threadId)).length : 0;
    }, { timeout: 180_000, intervals: [2_000] }).toBe(index + 1);
  }
  const threadId = new URL(page.url()).searchParams.get("thread");
  expect(threadId).toMatch(/^[0-9a-f-]{36}$/);
  const turns = await turnIdsOf(threadId!);
  expect(turns).toHaveLength(2);
  for (const turnId of turns) {
    const ledger = await ledgerFor(turnId);
    expect(ledger.generations.map((g) => `${g.section}:${g.outcome}`).sort()).toEqual(["korume_answer:success", "korume_plan:success"]);
    expect(ledger.reservations.map((r) => r.status)).toEqual(["settled"]);
    expect(ledger.charges).toHaveLength(1);
  }

  // The first question asked for exposure: the rail's count is the oracle, not a number the model made up.
  await page.reload();
  const rail = page.getByRole("complementary", { name: "Learning context" });
  await expect(rail.getByText(`Seen ${oracle} times`, { exact: true }).first()).toBeVisible();

  // Two concurrent POSTs of one NEW turnId: one assistant message, one reservation, one plan + one answer.
  const turnId = crypto.randomUUID();
  const body = { turnId, text: "Give me one more example sentence with は.", locale: "en" };
  const [a, b] = await Promise.all([
    page.request.post(`/api/korume/threads/${threadId}/turns`, { data: body, timeout: 180_000 }),
    page.request.post(`/api/korume/threads/${threadId}/turns`, { data: body, timeout: 180_000 }),
  ]);
  expect([a.status(), b.status()].every((status) => [200, 202, 409].includes(status))).toBe(true);
  await expect.poll(async () => (await turnIdsOf(threadId!)).filter((id) => id === turnId).length,
    { timeout: 180_000, intervals: [2_000] }).toBe(1);
  const ledger = await ledgerFor(turnId);
  expect(ledger.reservations).toHaveLength(1);
  expect(ledger.generations.map((g) => `${g.section}:${g.outcome}`).sort()).toEqual(["korume_answer:success", "korume_plan:success"]);
});
