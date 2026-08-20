import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { listJobs, resetJobs } from "./registry";
import { resetSchedulerForTests, startScheduler } from "./start";

// Doesn't need a real Supabase client — only the env gate and the guard are
// under test here, not the job's own logic (covered by
// lib/scheduler/jobs/account-deletion.test.ts).
vi.mock("./jobs/account-deletion", () => ({
  accountDeletionJob: { name: "account-deletion", run: async () => 0 },
}));

const ORIGINAL_ENV = process.env.SCHEDULER_ENABLED;

beforeEach(() => {
  resetJobs();
  resetSchedulerForTests();
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

  it("does not throw when called before startScheduler ever ran (nothing to clear)", () => {
    expect(() => resetSchedulerForTests()).not.toThrow();
  });
});
