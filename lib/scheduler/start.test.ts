import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { listJobs, resetJobs } from "./registry";
import { resetSchedulerForTests, startScheduler } from "./start";

// Doesn't need a real Supabase client — only the env gate and the guard are
// under test here, not the job's own logic (covered by
// lib/scheduler/jobs/account-deletion.test.ts).
const reconcileCalls: number[] = [];
let reconcileRejects = false;

vi.mock("./jobs/account-deletion", () => ({
  accountDeletionJob: { name: "account-deletion", run: async () => 0 },
  reconcileStrandedDeletions: () => {
    reconcileCalls.push(Date.now());
    return reconcileRejects ? Promise.reject(new Error("reconcile blew up")) : Promise.resolve(0);
  },
}));

const ORIGINAL_ENV = process.env.SCHEDULER_ENABLED;

beforeEach(() => {
  resetJobs();
  resetSchedulerForTests();
  reconcileCalls.length = 0;
  reconcileRejects = false;
  vi.useFakeTimers();
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.SCHEDULER_ENABLED;
  else process.env.SCHEDULER_ENABLED = ORIGINAL_ENV;
  vi.useRealTimers();
});

describe("startScheduler — the env gate is the literal string \"true\", nothing else", () => {
  it.each([
    ["unset", undefined],
    ["\"1\"", "1"],
    ["\"TRUE\"", "TRUE"],
    ["\"false\"", "false"],
  ])("stays off when SCHEDULER_ENABLED is %s: no interval, no registered job", (_label, value) => {
    if (value === undefined) delete process.env.SCHEDULER_ENABLED;
    else process.env.SCHEDULER_ENABLED = value;

    const setIntervalSpy = vi.spyOn(global, "setInterval");
    startScheduler();

    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(listJobs()).toHaveLength(0);
    setIntervalSpy.mockRestore();
  });

  it('turns on for the literal string "true": registers the job and creates exactly one interval', () => {
    process.env.SCHEDULER_ENABLED = "true";
    const setIntervalSpy = vi.spyOn(global, "setInterval");

    startScheduler();

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(listJobs().map((job) => job.name)).toEqual(["account-deletion"]);
    setIntervalSpy.mockRestore();
  });
});

describe("startScheduler — once per process", () => {
  it("creates exactly one interval even when called twice", () => {
    process.env.SCHEDULER_ENABLED = "true";
    const setIntervalSpy = vi.spyOn(global, "setInterval");

    startScheduler();
    startScheduler();

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    setIntervalSpy.mockRestore();
  });
});

describe("resetSchedulerForTests — actually cancels the live interval (N7)", () => {
  it("calls clearInterval on the tracked handle, not just the started flag", () => {
    process.env.SCHEDULER_ENABLED = "true";
    const setIntervalSpy = vi.spyOn(global, "setInterval");
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");

    startScheduler();
    const handle = setIntervalSpy.mock.results[0]?.value as unknown;
    expect(handle).toBeDefined();

    resetSchedulerForTests();

    expect(clearIntervalSpy).toHaveBeenCalledWith(handle);

    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  // (Whole-branch review cleanup: a "does not throw when called before
  // startScheduler ever ran" test used to sit here. It could not fail —
  // `clearInterval(undefined)` is a Node no-op, so deleting the
  // `intervalHandle !== undefined` guard it purported to protect leaves it
  // green. L-004: an assertion that cannot go red is not a guard.)
});

/**
 * Whole-branch review, I2. `SCHEDULER_ENABLED` was read raw and registered
 * nowhere, so every near-miss meant "silently never execute anybody's
 * deletion" while the app kept accepting requests and kept telling users a
 * date. `lib/scheduler/env.ts` now fails startup on anything that is not
 * exactly "true"/"false"/unset (`lib/scheduler/env.test.ts`), and the
 * DELIBERATE off is announced here — spec §7: a silent scheduler cannot be
 * distinguished from a dead one.
 */
describe("startScheduler — an intentional \"off\" is observable in the logs", () => {
  it("logs one line naming the variable when the scheduler stays off", () => {
    delete process.env.SCHEDULER_ENABLED;
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    startScheduler();

    expect(info).toHaveBeenCalledTimes(1);
    expect(String(info.mock.calls[0]?.[0])).toContain("SCHEDULER_ENABLED");
    expect(String(info.mock.calls[0]?.[0])).toContain("NOTHING will execute them");
    info.mockRestore();
  });

  it("does not log the disabled line when the scheduler actually starts", () => {
    process.env.SCHEDULER_ENABLED = "true";
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    startScheduler();

    const disabledLines = info.mock.calls.filter((call) =>
      String(call[0]).includes("SCHEDULER_ENABLED"),
    );
    expect(disabledLines).toHaveLength(0);
    info.mockRestore();
  });
});

/**
 * Whole-branch review, I1. A crash between the claim and the catch leaves a
 * row `executed` that the claim (which only takes `pending`) will never pick
 * up again — the erasure silently never completes. Startup is exactly the
 * moment after the crash that stranded it.
 */
describe("startScheduler — the stranded-row reconciliation", () => {
  it("runs the reconciliation once when the scheduler starts", () => {
    process.env.SCHEDULER_ENABLED = "true";

    startScheduler();

    expect(reconcileCalls).toHaveLength(1);
  });

  it("never runs it when the scheduler is disabled", () => {
    delete process.env.SCHEDULER_ENABLED;
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    startScheduler();

    expect(reconcileCalls).toHaveLength(0);
  });

  it("still starts the scheduler when the reconciliation rejects", async () => {
    process.env.SCHEDULER_ENABLED = "true";
    reconcileRejects = true;
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const setIntervalSpy = vi.spyOn(global, "setInterval");

    startScheduler();
    // Let the rejected fire-and-forget promise settle.
    await Promise.resolve();
    await Promise.resolve();

    // One bad row must never keep every other user's deletion from running.
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(listJobs()).toHaveLength(1);
    expect(error).toHaveBeenCalled();
    setIntervalSpy.mockRestore();
    error.mockRestore();
  });
});
