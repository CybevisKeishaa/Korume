import "server-only";
import { registerJob } from "./registry";
import { runDueJobs } from "./runner";
import { accountDeletionJob } from "./jobs/account-deletion";

const TICK_MS = 60_000;

/**
 * Keyed off `globalThis`, not a plain module-level `let` (review I4): this
 * module can be re-evaluated more than once within the same Node process —
 * Next.js bundles route handlers and the instrumentation hook as separate
 * module graphs, and each gets its own copy of module-level state on import.
 * A `let started = false` at module scope would reset on every such
 * re-evaluation, defeating the "once per process" guarantee this guard
 * exists to provide. `Symbol.for` is a single, process-wide registry entry,
 * so every re-evaluation of this module sees the same flag.
 */
const SCHEDULER_STARTED = Symbol.for("korume.scheduler.started");
type GlobalWithScheduler = typeof globalThis & { [SCHEDULER_STARTED]?: boolean };

/** Test-only. Clears the globalThis-keyed started flag so each test gets a
 *  clean process-wide slate. Never called by application code. */
export function resetSchedulerForTests(): void {
  delete (globalThis as GlobalWithScheduler)[SCHEDULER_STARTED];
}

/**
 * Started once per process, never per request. Legitimate here because
 * almostgone.vn is a single long-running Node instance, not serverless — the
 * same fact that makes `lib/rate-limit.ts` a real limiter.
 *
 * Off unless `SCHEDULER_ENABLED=true` is set explicitly. Never inferred from
 * NODE_ENV: a build step or a test run must not delete anybody's account.
 */
export function startScheduler(): void {
  const g = globalThis as GlobalWithScheduler;
  if (g[SCHEDULER_STARTED]) return;
  if (process.env.SCHEDULER_ENABLED !== "true") return;
  g[SCHEDULER_STARTED] = true;

  registerJob(accountDeletionJob);

  // Guards against overlapping ticks (review I4): a pass doing recursive
  // paginated Storage work can outlast TICK_MS. `setInterval` would otherwise
  // start a second `runDueJobs()` on top of one still running.
  let running = false;
  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const results = await runDueJobs();
      console.info("[scheduler] pass", results);
    } finally {
      running = false;
    }
  };
  // A rejection here must never crash the process (review m9) — `runDueJobs`
  // already catches every individual job's throw, so this is a last-resort
  // net, not the primary error path.
  const safeTick = (): void => {
    tick().catch((error: unknown) => console.error("[scheduler] tick failed", error));
  };

  safeTick();
  setInterval(safeTick, TICK_MS).unref();
}
