import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerJob, resetJobs } from "./registry";
import { runDueJobs } from "./runner";

beforeEach(() => resetJobs());

describe("runDueJobs", () => {
  it("runs every registered job and reports what each handled", async () => {
    registerJob({ name: "a", run: async () => 2 });
    registerJob({ name: "b", run: async () => 0 });
    const result = await runDueJobs(new Date("2026-08-27T10:00:00.000Z"));
    expect(result).toEqual([{ name: "a", handled: 2 }, { name: "b", handled: 0 }]);
  });

  it("reports a pass that handled nothing rather than staying silent", async () => {
    registerJob({ name: "quiet", run: async () => 0 });
    const result = await runDueJobs(new Date());
    expect(result).toEqual([{ name: "quiet", handled: 0 }]);
  });

  it("keeps running later jobs when one throws, and surfaces the failure", async () => {
    const failed = vi.fn();
    registerJob({ name: "boom", run: async () => { throw new Error("nope"); } });
    registerJob({ name: "after", run: async () => 1 });
    const result = await runDueJobs(new Date(), failed);
    expect(result).toEqual([{ name: "boom", handled: 0 }, { name: "after", handled: 1 }]);
    expect(failed).toHaveBeenCalledWith("boom", expect.any(Error));
  });
});
