import "server-only";
import { runLessonCreationPass } from "./worker";

const TICK_MS = 5_000;
const LESSON_CREATION_WORKER_STARTED = Symbol.for("korume.lesson-creation-worker.started");

type GlobalWithLessonCreationWorker = typeof globalThis & {
  [LESSON_CREATION_WORKER_STARTED]?: boolean;
};

let intervalHandle: ReturnType<typeof setInterval> | undefined;

export function resetLessonCreationWorkerForTests(): void {
  delete (globalThis as GlobalWithLessonCreationWorker)[LESSON_CREATION_WORKER_STARTED];
  if (intervalHandle !== undefined) {
    clearInterval(intervalHandle);
    intervalHandle = undefined;
  }
}

export function startLessonCreationWorker(): void {
  const g = globalThis as GlobalWithLessonCreationWorker;
  if (g[LESSON_CREATION_WORKER_STARTED]) return;
  if (process.env.LESSON_CREATION_WORKER_ENABLED !== "true") {
    console.info(
      '[lesson-creation-worker] disabled (LESSON_CREATION_WORKER_ENABLED is not "true")',
    );
    return;
  }
  g[LESSON_CREATION_WORKER_STARTED] = true;

  let running = false;
  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const result = await runLessonCreationPass(new Date());
      console.info("[lesson-creation-worker] pass", result);
    } finally {
      running = false;
    }
  };
  const safeTick = (): void => {
    tick().catch((error: unknown) =>
      console.error("[lesson-creation-worker] pass failed", error),
    );
  };

  safeTick();
  intervalHandle = setInterval(safeTick, TICK_MS);
  intervalHandle.unref();
}
