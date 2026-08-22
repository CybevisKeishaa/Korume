import "server-only";
import { registerJob } from "./registry";
import { runDueJobs } from "./runner";
import { accountDeletionJob, reconcileStrandedDeletions } from "./jobs/account-deletion";

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

/** The live interval handle, so a test reset can actually stop it (review
 *  N7) — clearing only the `started` flag left a real 60s timer running for
 *  any caller that did not also hold fake timers. */
let intervalHandle: ReturnType<typeof setInterval> | undefined;

/** Test-only. Clears the globalThis-keyed started flag AND cancels the live
 *  interval, so each test gets a genuinely clean slate rather than a flag
 *  reset with a timer still ticking in the background. Never called by
 *  application code. */
export function resetSchedulerForTests(): void {
  delete (globalThis as GlobalWithScheduler)[SCHEDULER_STARTED];
  if (intervalHandle !== undefined) {
    clearInterval(intervalHandle);
    intervalHandle = undefined;
  }
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
  if (process.env.SCHEDULER_ENABLED !== "true") {
    // Whole-branch review, I2: "off" used to be indistinguishable from "the
    // scheduler is running and nothing is due" — and from "someone typed
    // SCHEDULER_ENABLED=1". `lib/scheduler/env.ts` now fails startup on a
    // value that is neither "true" nor "false", so reaching here is a
    // DELIBERATE off; this line is what makes that deliberate off visible in
    // the logs of a machine nobody is watching. Spec §7's own principle: a
    // silent scheduler cannot be distinguished from a dead one.
    console.info(
      "[scheduler] disabled (SCHEDULER_ENABLED is not \"true\") — deletion requests " +
        "will be recorded and their grace periods will elapse, but NOTHING will execute them",
    );
    return;
  }
  g[SCHEDULER_STARTED] = true;

  registerJob(accountDeletionJob);

  // I1: a crash, SIGTERM or deploy restart between the claim and the catch
  // leaves a row `executed` with the work half-done, and the claim only ever
  // takes `pending` rows — so nothing would ever retry it. Runs once here, at
  // startup, because that is exactly the moment after the crash that stranded
  // it. Fire-and-forget with its own catch: a reconciliation failure must not
  // stop the scheduler from starting, or one bad row would keep every OTHER
  // user's deletion from ever running.
  reconcileStrandedDeletions().catch((error: unknown) =>
    console.error("[scheduler] startup reconciliation failed", error),
  );

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
  intervalHandle = setInterval(safeTick, TICK_MS);
  intervalHandle.unref();
}
