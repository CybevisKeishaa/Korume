import { describe, expect, it } from "vitest";
import { createQueue, QueueFullError } from "./queue";

describe("PDF queue (spec W §6.3 step 4)", () => {
  it("runs one task at a time, in order", async () => {
    const queue = createQueue(5);
    const log: string[] = [];
    let release!: () => void;
    const first = queue.run(() => new Promise<void>((resolve) => { log.push("start1"); release = () => { log.push("end1"); resolve(); }; }));
    const second = queue.run(async () => { log.push("start2"); });
    await Promise.resolve();
    expect(log).toEqual(["start1"]);
    release();
    await Promise.all([first, second]);
    expect(log).toEqual(["start1", "end1", "start2"]);
  });
  it("rejects beyond one running + four waiting, and a failure does not stall the queue", async () => {
    const queue = createQueue(5);
    const never = () => new Promise<void>(() => undefined);
    for (let i = 0; i < 5; i += 1) void queue.run(never);
    await expect(queue.run(async () => 1)).rejects.toBeInstanceOf(QueueFullError);
    const other = createQueue(5);
    await expect(other.run(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    await expect(other.run(async () => 2)).resolves.toBe(2);
  });
});
