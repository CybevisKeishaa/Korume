import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./fixtures/auth";

/**
 * The Ep.729 live gate (spec §8, plan Task 11): the REAL YouTube iframe on the owner's lesson, seeded with
 * `scripts/seed-real-lesson.ts`. It first proves the subject exists — the iframe is YouTube's and the video
 * is 1396 s long — so it cannot pass while measuring nothing. The 300 ms boundary threshold is the owner's
 * and is never raised: when it fails, the attached deltas are the evidence.
 *
 * Run: `EP729_VIDEO_ID=<lesson uuid> npm run test:e2e:live` against a worktree server on :3000.
 */
const YOUTUBE_ID = "Fwj3tH4Uls8";
const BOUNDARY_LIMIT_MS = 300;
const BOUNDARIES = 8;

test.use({ viewport: { width: 1280, height: 529 } });

loadEnvConfig(process.cwd());
const videoId = process.env.EP729_VIDEO_ID;
let admin: SupabaseClient;

interface Line { start: number; end: number | null; translation: string | null }
let lines: Line[] = [];

test.beforeAll(async () => {
  const missing = new Error("fixture missing: run scripts/seed-real-lesson.ts and set EP729_VIDEO_ID");
  if (!videoId) throw missing;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("the live gate needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const video = await admin.from("videos").select("id, youtube_video_id").eq("id", videoId).maybeSingle();
  if (video.error || !video.data || video.data.youtube_video_id !== YOUTUBE_ID) throw missing;
  const transcript = await admin.from("transcripts").select("id").eq("video_id", videoId).single();
  if (transcript.error) throw missing;
  const rows = await admin.from("transcript_lines").select("start_time, end_time, text_translation, id")
    .eq("transcript_id", transcript.data.id).order("start_time").order("id");
  if (rows.error || rows.data.length < 100) throw missing;
  lines = rows.data.map((row) => ({ start: Number(row.start_time), end: row.end_time === null ? null : Number(row.end_time), translation: row.text_translation }));
});

/** The page's real `YT.Player`, captured as the app constructs it — no app code exists for this. */
async function captureRealPlayer(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { YT: { Player: new (...args: unknown[]) => unknown }; __players: unknown[]; onYouTubeIframeAPIReady?: () => void };
    w.__players = [];
    // The app's loader chains a callback that was already set, and calls it first (load-youtube-api.ts).
    w.onYouTubeIframeAPIReady = () => {
      const Real = w.YT.Player;
      w.YT.Player = function Player(...args: unknown[]) { const player = new Real(...args); w.__players.push(player); return player; } as unknown as typeof Real;
    };
  });
}

type Yt = { getDuration(): number; getCurrentTime(): number; getPlayerState(): number; getPlaybackRate(): number };
const player = <T,>(page: Page, read: (yt: Yt) => T) =>
  page.evaluate((source) => {
    const players = (window as unknown as { __players: Yt[] }).__players;
    // eslint-disable-next-line no-new-func
    return new Function("yt", `return (${source})(yt)`)(players[players.length - 1]) as T;
  }, read.toString());

async function openLesson(page: Page): Promise<void> {
  await page.goto(`/en/shadowing/${videoId}`);
  await expect(page.locator(`iframe[src*="youtube.com/embed/${YOUTUBE_ID}"]`)).toBeAttached({ timeout: 30_000 });
  await expect.poll(() => player(page, (yt) => typeof yt?.getDuration === "function" && yt.getDuration()), { timeout: 30_000 }).toBeGreaterThan(0);
}

/** The control bar hides while playing until the pointer moves over the video: move it there (a corner, clear of
 *  the centre play button) before using a bar control. */
async function revealBar(page: Page): Promise<void> {
  const box = await page.locator("[data-workspace-player-video]").boundingBox();
  if (!box) throw new Error("player video has no box");
  await page.mouse.move(box.x + 8, box.y + 8);
}
/** The bar's own Play/Pause (a bare `name: "Play"` would also match every row's "Replay"). */
async function clickControl(page: Page, name: "Play" | "Pause"): Promise<void> {
  await revealBar(page);
  await page.getByRole("region", { name: "Player" }).getByRole("button", { name, exact: true }).last().click();
}
const currentIndex = (page: Page) => page.locator("li[data-state='current']").getAttribute("data-index").then(Number);
const seek = (page: Page, seconds: number) => page.getByRole("slider", { name: "Seek" }).fill(String(seconds));
const lineAt = (time: number) => lines.reduce((found, line, index) => (line.start <= time ? index : found), -1);

async function learner(page: Page): Promise<string> {
  await captureRealPlayer(page);
  const email = uniqueEmail("e2e_ws_live");
  await page.goto("/en/register");
  await registerViaUi(page, { name: "E2E Ep729", email, password: "password123" });
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 20_000 });
  return email;
}

test("Ep.729: the real player, boundary latency, follow, replay, loop, speed, readings and translation", async ({ page }, testInfo) => {
  await learner(page);
  await openLesson(page);

  // 1. The subject exists: YouTube's iframe, and the real video's duration.
  const duration = await player(page, (yt) => yt.getDuration());
  expect(duration).toBeGreaterThanOrEqual(1390);
  expect(duration).toBeLessThanOrEqual(1400);

  // 2. Seek to the middle: the current row is the line whose span holds the player's time. Before the first
  //    play the real API reports 0 from getCurrentTime() (measured), so the proof is where playback starts.
  await seek(page, 700);
  await expect.poll(() => currentIndex(page)).toBe(lineAt(700));
  await clickControl(page, "Play");
  await expect.poll(() => player(page, (yt) => yt.getPlayerState()), { timeout: 20_000 }).toBe(1);
  const playedFrom = await player(page, (yt) => yt.getCurrentTime());
  expect(playedFrom).toBeGreaterThanOrEqual(699.5);
  expect(playedFrom).toBeLessThan(705);
  await expect.poll(async () => {
    const [time, index] = await Promise.all([player(page, (yt) => yt.getCurrentTime()), currentIndex(page)]);
    const line = lines[index]!;
    return time >= line.start && time < (lines[index + 1]?.start ?? Infinity);
  }).toBe(true);

  // 3. Boundary latency at 1× (spec §7.4: the row follows the line's TIMESTAMP within 300 ms). The iframe
  //    reports media time through a cache, and the app reads that same cache in rAF — so "first frame the
  //    cache reached start" would be ~0 by construction (T11 review I-2). Instead every frame logs
  //    (performance.now(), getCurrentTime()); the wall-clock instant the media crossed each line start is
  //    extrapolated from the last sample before it (t + (start − ct) / rate), and the row change is measured
  //    against that. The report also carries how often the cached time actually changes.
  const starts = lines.map((line) => line.start);
  const latency = await page.evaluate(async ({ starts, count }) => {
    const players = (window as unknown as { __players: { getCurrentTime(): number; getPlaybackRate(): number }[] }).__players;
    const yt = players[players.length - 1]!;
    const changed = new Map<number, number>();
    const samples: [number, number][] = [];
    const list = document.querySelector("[data-testid='transcript-scroll'] ol")!;
    const observer = new MutationObserver(() => {
      const now = performance.now();
      const li = list.querySelector<HTMLElement>("li[data-state='current']");
      if (li && !changed.has(Number(li.dataset.index))) changed.set(Number(li.dataset.index), now);
    });
    observer.observe(list, { subtree: true, attributes: true, attributeFilter: ["data-state"] });
    const first = starts.findIndex((start) => start > yt.getCurrentTime() + 0.3);
    const wanted = Array.from({ length: count }, (_, i) => first + i);
    await new Promise<void>((resolve) => {
      const poll = () => {
        samples.push([performance.now(), yt.getCurrentTime()]);
        if (wanted.every((index) => changed.has(index)) && samples[samples.length - 1]![1] > starts[wanted[wanted.length - 1]!]! + 0.5) return resolve();
        requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    });
    observer.disconnect();
    const rate = yt.getPlaybackRate();
    const crossings = wanted.map((index) => {
      const start = starts[index]!;
      const before = [...samples].reverse().find(([, time]) => time < start)!;
      return { index, deltaMs: Math.round((changed.get(index)! - (before[0] + ((start - before[1]) / rate) * 1000)) * 10) / 10 };
    });
    const updates = samples.filter((sample, i) => i > 0 && sample[1] !== samples[i - 1]![1]).map((sample, i, all) => (i ? sample[0] - all[i - 1]![0] : 0)).slice(1).sort((a, b) => a - b);
    return { crossings, clockUpdateMedianMs: Math.round(updates[Math.floor(updates.length / 2)] ?? -1), clockUpdateMaxMs: Math.round(updates[updates.length - 1] ?? -1) };
  }, { starts, count: BOUNDARIES });
  const values = latency.crossings.map((crossing) => crossing.deltaMs);
  const sorted = [...values].sort((a, b) => a - b);
  const summary = { ...latency, maxMs: sorted.at(-1), p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1] };
  await testInfo.attach("boundary-latency.json", { body: JSON.stringify(summary, null, 2), contentType: "application/json" });
  console.log("boundary latency", JSON.stringify(summary));
  expect(values.length).toBe(BOUNDARIES);
  for (const delta of values) expect(delta).toBeLessThanOrEqual(BOUNDARY_LIMIT_MS);

  // 4a. Auto-follow: the current row is inside the transcript's scroll box.
  const inView = await page.evaluate(() => {
    const box = document.querySelector("[data-testid='transcript-scroll']")!.getBoundingClientRect();
    const row = document.querySelector("li[data-state='current']")!.getBoundingClientRect();
    return row.top >= box.top - 1 && row.bottom <= box.bottom + 1;
  });
  expect(inView).toBe(true);

  // 4b. Replay: clicking the current row goes back to its start and keeps playing.
  const replayed = await currentIndex(page);
  await expect(page.locator(`li[data-index='${replayed}'] button[aria-current]`)).toHaveCount(1);
  // Part 1b T11: the seek button is 0×0 (sr-only number); a click lands on the row's text, clear of the hover toolbar.
  await page.locator(`li[data-index='${replayed}'] [data-line-id]`).click({ position: { x: 8, y: 8 } });
  await expect.poll(() => player(page, (yt) => yt.getCurrentTime())).toBeLessThan(lines[replayed]!.start + 1);
  await expect.poll(() => player(page, (yt) => yt.getPlayerState())).toBe(1);

  // 4c. Loop 3×: the clock goes back to the sentence start exactly twice, then moves on.
  await revealBar(page);
  await page.getByRole("button", { name: "Sentence loop" }).click();
  await page.getByRole("radiogroup", { name: "Plays per sentence" }).getByRole("radio", { name: "3×" }).click();
  const looped = await currentIndex(page);
  const loopStart = lines[looped]!.start;
  await expect(page.locator(`li[data-index='${looped}'] button[aria-current]`)).toHaveCount(1);
  // Part 1b T11: the seek button is 0×0 (sr-only number); a click lands on the row's text, clear of the hover toolbar.
  await page.locator(`li[data-index='${looped}'] [data-line-id]`).click({ position: { x: 8, y: 8 } });
  const backJumps = await page.evaluate(async ({ next }) => {
    const players = (window as unknown as { __players: { getCurrentTime(): number }[] }).__players;
    const yt = players[players.length - 1]!;
    let last = yt.getCurrentTime();
    let jumps = 0;
    const deadline = performance.now() + 60_000;
    await new Promise<void>((resolve) => {
      const poll = () => {
        const now = yt.getCurrentTime();
        if (now < last - 0.5) jumps += 1;
        last = now;
        if (now >= next + 0.3 || performance.now() > deadline) return resolve();
        requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    });
    return jumps;
  }, { next: lines[looped + 1]!.start });
  expect(backJumps).toBe(2);
  expect(loopStart).toBeLessThan(lines[looped + 1]!.start);
  await revealBar(page);
  await page.getByRole("button", { name: "Sentence loop" }).click();
  await page.getByRole("radiogroup", { name: "Plays per sentence" }).getByRole("radio", { name: "1×" }).click();

  // 4d. Speed 0.75 reaches the real player.
  await revealBar(page);
  await page.getByRole("button", { name: /^Playback speed/ }).click();
  await page.getByRole("radio", { name: "0.75×" }).click();
  await expect.poll(() => player(page, (yt) => yt.getPlaybackRate())).toBe(0.75);

  // 4e. Readings and the Vietnamese translation of the current line.
  const live = page.getByRole("region", { name: "Live sentence" });
  await expect(live.locator("rt").first()).toBeAttached();
  const index = await currentIndex(page);
  const translation = lines[index]!.translation;
  expect(translation).toBeTruthy();
  await expect(live.getByText(translation!, { exact: true })).toBeVisible();
});

test("Ep.729: resume after a client-side leave and return; a corrupt position opens at 0", async ({ page }) => {
  const email = await learner(page);
  await openLesson(page);
  const X = 905;
  await seek(page, X);
  await expect.poll(() => currentIndex(page)).toBe(lineAt(X));
  // A play/pause writes the position to the server as well as the tab's session record.
  await clickControl(page, "Play");
  await expect.poll(() => player(page, (yt) => yt.getPlayerState())).toBe(1);
  await clickControl(page, "Pause");
  await expect.poll(() => player(page, (yt) => yt.getPlayerState())).toBe(2);
  const at = await player(page, (yt) => yt.getCurrentTime());

  await page.getByRole("link", { name: "Back to Shadowing Hub" }).click();
  await expect(page).toHaveURL(/\/en\/shadowing$/);
  await page.goBack();
  await expect.poll(() => player(page, (yt) => typeof yt?.getDuration === "function" && yt.getDuration()), { timeout: 30_000 }).toBeGreaterThan(0);
  const resumedIndex = await currentIndex(page);
  expect(Math.abs(resumedIndex - lineAt(at))).toBeLessThanOrEqual(1);
  const resumedStart = lines[resumedIndex]!.start;
  await expect.poll(async () => Math.abs((await player(page, (yt) => yt.getCurrentTime())) - resumedStart)).toBeLessThan(1);
  expect(await player(page, (yt) => yt.getPlayerState())).not.toBe(1);

  const user = await admin.from("users").select("id").eq("email", email).single();
  if (user.error) throw user.error;
  const corrupt = await admin.from("user_video_progress").upsert({ user_id: user.data.id, video_id: videoId, last_watched_position: 99999, last_watched_at: new Date().toISOString() });
  if (corrupt.error) throw corrupt.error;
  // A new tab session: the corrupt server position is the only record.
  await page.evaluate(() => sessionStorage.clear());
  await openLesson(page);
  await expect.poll(() => player(page, (yt) => yt.getCurrentTime())).toBeLessThan(1);
});
