export class QueueFullError extends Error {}

/** Spec W §6.3 step 4: one task at a time; `maxPending` counts the running task plus the waiting ones. */
export function createQueue(maxPending: number) {
  let tail: Promise<unknown> = Promise.resolve();
  let pending = 0;
  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      if (pending >= maxPending) return Promise.reject(new QueueFullError("print PDF queue is full"));
      pending += 1;
      const result = tail.then(task);
      tail = result.catch(() => undefined);
      return result.finally(() => { pending -= 1; });
    },
  };
}
