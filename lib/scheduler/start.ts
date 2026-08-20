import "server-only";
import { registerJob } from "./registry";
import { runDueJobs } from "./runner";
import { accountDeletionJob } from "./jobs/account-deletion";

const TICK_MS = 60_000;
let started = false;

/**
 * Started once per process, never per request. Legitimate here because
 * almostgone.vn is a single long-running Node instance, not serverless — the
 * same fact that makes `lib/rate-limit.ts` a real limiter.
 *
 * Off unless `SCHEDULER_ENABLED=true` is set explicitly. Never inferred from
 * NODE_ENV: a build step or a test run must not delete anybody's account.
 */
export function startScheduler(): void {
  if (started) return;
  if (process.env.SCHEDULER_ENABLED !== "true") return;
  started = true;

  registerJob(accountDeletionJob);

  const tick = async () => {
    const results = await runDueJobs();
    console.info("[scheduler] pass", results);
  };
  void tick();
  setInterval(() => void tick(), TICK_MS).unref();
}
