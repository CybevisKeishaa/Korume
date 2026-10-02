import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNoteAutosave } from "./note-autosave";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createNoteAutosave", () => {
  it("sends once, 800 ms after the last change of a 3 s burst", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const autosave = createNoteAutosave(send);
    for (let ms = 0; ms <= 3_000; ms += 200) {
      autosave.change("sentence:42", `draft ${ms}`);
      await vi.advanceTimersByTimeAsync(200);
    }
    expect(send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(800);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("sentence:42", "draft 3000");
    expect(autosave.status("sentence:42")).toBe("saved");
  });

  it("flushes at once on blur", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const autosave = createNoteAutosave(send);
    autosave.change("lesson:v", "memo");
    expect(autosave.status("lesson:v")).toBe("saving");
    await autosave.flush("lesson:v");
    expect(send).toHaveBeenCalledWith("lesson:v", "memo");
    await vi.advanceTimersByTimeAsync(2_000);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("never has two requests in flight for a key: later changes become ONE follow-up with the latest body", async () => {
    const first = deferred();
    const send = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const autosave = createNoteAutosave(send);
    autosave.change("sentence:42", "one");
    await vi.advanceTimersByTimeAsync(800);
    expect(send).toHaveBeenCalledTimes(1);

    autosave.change("sentence:42", "two");
    await vi.advanceTimersByTimeAsync(800);
    autosave.change("sentence:42", "three");
    await vi.advanceTimersByTimeAsync(800);
    expect(send).toHaveBeenCalledTimes(1); // the first is still in flight

    first.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith("sentence:42", "three");
    await vi.advanceTimersByTimeAsync(0);
    expect(autosave.status("sentence:42")).toBe("saved");
  });

  it("keeps keys independent", async () => {
    const pending = deferred();
    const send = vi.fn().mockImplementation((key: string) => (key === "sentence:1" ? pending.promise : Promise.resolve()));
    const autosave = createNoteAutosave(send);
    autosave.change("sentence:1", "a");
    autosave.change("sentence:2", "b");
    await vi.advanceTimersByTimeAsync(800);
    expect(send.mock.calls.map(([key]) => key).sort()).toEqual(["sentence:1", "sentence:2"]);
    expect(autosave.status("sentence:2")).toBe("saved");
    expect(autosave.status("sentence:1")).toBe("saving");
    pending.resolve();
  });

  it("shows failed, and retry resends the latest body", async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const autosave = createNoteAutosave(send);
    const listener = vi.fn();
    autosave.subscribe(listener);
    autosave.change("sentence:42", "first");
    await vi.advanceTimersByTimeAsync(800);
    expect(autosave.status("sentence:42")).toBe("failed");
    expect(listener).toHaveBeenCalled();
    autosave.change("sentence:42", "edited after the failure");
    await autosave.flush("sentence:42");
    expect(send).toHaveBeenLastCalledWith("sentence:42", "edited after the failure");
    expect(autosave.status("sentence:42")).toBe("saved");
    expect(autosave.status("never-touched")).toBe("idle");
  });
});
