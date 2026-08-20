import { beforeEach, describe, expect, it } from "vitest";
import { listJobs, registerJob, resetJobs } from "./registry";

beforeEach(() => resetJobs());

describe("registerJob — de-dupe", () => {
  it("keeps only the first registration when the same name is registered twice", async () => {
    const calls: string[] = [];
    registerJob({
      name: "dup",
      run: async () => {
        calls.push("first");
        return 1;
      },
    });
    registerJob({
      name: "dup",
      run: async () => {
        calls.push("second");
        return 2;
      },
    });

    expect(listJobs()).toHaveLength(1);
    expect(listJobs().map((job) => job.name)).toEqual(["dup"]);

    // The kept registration is the FIRST one, not a silently-replaced second.
    const handled = await listJobs()[0]?.run(new Date());
    expect(handled).toBe(1);
    expect(calls).toEqual(["first"]);
  });

  it("registers two jobs with different names independently", () => {
    registerJob({ name: "a", run: async () => 0 });
    registerJob({ name: "b", run: async () => 0 });
    expect(listJobs().map((job) => job.name)).toEqual(["a", "b"]);
  });
});
