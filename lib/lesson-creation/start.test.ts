import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LessonCreationPassResult } from "./worker";
import { resetLessonCreationWorkerForTests, startLessonCreationWorker } from "./start";

const workerMock = vi.hoisted(() => ({
  runLessonCreationPass: vi.fn(),
}));

vi.mock("./worker", () => ({
  runLessonCreationPass: workerMock.runLessonCreationPass,
}));

const ORIGINAL_ENV = process.env.LESSON_CREATION_WORKER_ENABLED;
const PASS_RESULT: LessonCreationPassResult = {
  claimed: 0,
  succeeded: 0,
  requeued: 0,
  failed: 0,
  recovered: 0,
  staleFailed: 0,
};

type IntervalCallback = () => void;

beforeEach(() => {
  resetLessonCreationWorkerForTests();
  workerMock.runLessonCreationPass.mockResolvedValue(PASS_RESULT);
});

afterEach(() => {
  resetLessonCreationWorkerForTests();
  workerMock.runLessonCreationPass.mockReset();
  vi.restoreAllMocks();
  if (ORIGINAL_ENV === undefined) delete process.env.LESSON_CREATION_WORKER_ENABLED;
  else process.env.LESSON_CREATION_WORKER_ENABLED = ORIGINAL_ENV;
});

describe("startLessonCreationWorker - explicit env gate", () => {
  it.each([
    ["unset", undefined],
    ['"false"', "false"],
  ])("stays off when LESSON_CREATION_WORKER_ENABLED is %s", (_label, value) => {
    if (value === undefined) delete process.env.LESSON_CREATION_WORKER_ENABLED;
    else process.env.LESSON_CREATION_WORKER_ENABLED = value;
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const setIntervalSpy = vi.spyOn(global, "setInterval");

    startLessonCreationWorker();

    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(workerMock.runLessonCreationPass).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledTimes(1);
    expect(String(info.mock.calls[0]?.[0])).toContain("LESSON_CREATION_WORKER_ENABLED");
  });
});

describe("startLessonCreationWorker - process lifecycle", () => {
  it("starts an immediate pass and one unref'd interval when explicitly enabled", () => {
    process.env.LESSON_CREATION_WORKER_ENABLED = "true";
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const unref = vi.fn();
    const intervalHandle = { unref };
    const setIntervalSpy = vi
      .spyOn(global, "setInterval")
      .mockReturnValue(intervalHandle as unknown as ReturnType<typeof setInterval>);

    startLessonCreationWorker();

    expect(workerMock.runLessonCreationPass).toHaveBeenCalledTimes(1);
    expect(workerMock.runLessonCreationPass.mock.calls[0]?.[0]).toBeInstanceOf(Date);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(unref).toHaveBeenCalledTimes(1);
  });

  it("creates only one interval when called repeatedly in the same process", () => {
    process.env.LESSON_CREATION_WORKER_ENABLED = "true";
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const setIntervalSpy = vi.spyOn(global, "setInterval").mockReturnValue({
      unref: vi.fn(),
    } as unknown as ReturnType<typeof setInterval>);

    startLessonCreationWorker();
    startLessonCreationWorker();

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(workerMock.runLessonCreationPass).toHaveBeenCalledTimes(1);
  });

  it("skips an overlapping interval tick while the immediate pass is still running", () => {
    process.env.LESSON_CREATION_WORKER_ENABLED = "true";
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    let intervalCallback: IntervalCallback | undefined;
    let releaseFirstPass: ((value: LessonCreationPassResult) => void) | undefined;
    workerMock.runLessonCreationPass.mockImplementationOnce(
      () =>
        new Promise<LessonCreationPassResult>((resolve) => {
          releaseFirstPass = resolve;
        }),
    );
    vi.spyOn(global, "setInterval").mockImplementation((callback: TimerHandler) => {
      intervalCallback = callback as IntervalCallback;
      return { unref: vi.fn() } as unknown as ReturnType<typeof setInterval>;
    });

    startLessonCreationWorker();
    intervalCallback?.();

    expect(workerMock.runLessonCreationPass).toHaveBeenCalledTimes(1);
    releaseFirstPass?.(PASS_RESULT);
  });

  it("logs a top-level pass failure and allows a later interval tick to run", async () => {
    process.env.LESSON_CREATION_WORKER_ENABLED = "true";
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let intervalCallback: IntervalCallback | undefined;
    workerMock.runLessonCreationPass
      .mockRejectedValueOnce(new Error("worker pass failed"))
      .mockResolvedValue(PASS_RESULT);
    vi.spyOn(global, "setInterval").mockImplementation((callback: TimerHandler) => {
      intervalCallback = callback as IntervalCallback;
      return { unref: vi.fn() } as unknown as ReturnType<typeof setInterval>;
    });

    startLessonCreationWorker();
    await Promise.resolve();
    await Promise.resolve();
    intervalCallback?.();

    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]?.[0])).toContain("[lesson-creation-worker] pass failed");
    expect(workerMock.runLessonCreationPass).toHaveBeenCalledTimes(2);
  });
});
