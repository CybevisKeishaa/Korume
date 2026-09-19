"use client";

import { useEffect, useRef, useState } from "react";
import {
  isTerminalJobState,
  type LessonCreationJobEvent,
  type LessonCreationJobProjection,
} from "@/lib/lesson-creation/types";

/**
 * Polls one lesson-creation job for as long as it can still change.
 *
 * The worker ticks every 5s; this asks more often so a durable transition
 * reaches the learner without feeling stalled, and stops the moment there is
 * nothing left to learn — a terminal state, an unreadable job, a replaced job
 * id, or unmount. It reports the job's own durable event history untouched:
 * the presentation layer decides what may be shown as complete, and may only
 * use events to decide it.
 */
const POLL_MS = 2_000;

interface PolledJob {
  job: LessonCreationJobProjection | null;
  events: LessonCreationJobEvent[];
  /** The job could not be read at all (signed out, or not this requester's). */
  unreadable: boolean;
}

export interface LessonCreationJobPollingState extends PolledJob {
  /**
   * Poll the same job id again. A retry re-queues the job it was given, so the
   * id does not change and cannot restart a loop that stopped on a terminal
   * state — the consumer that knows a new attempt exists says so.
   */
  restart(): void;
}

const IDLE: PolledJob = { job: null, events: [], unreadable: false };

export function useLessonCreationJob(
  jobId: string | null,
  options: { onSucceeded(job: LessonCreationJobProjection): void },
): LessonCreationJobPollingState {
  const [state, setState] = useState<PolledJob>(IDLE);
  const [attempt, setAttempt] = useState(0);

  // Held in a ref so a caller passing a fresh closure each render cannot
  // restart the poll loop; only the job id may do that.
  const onSucceeded = useRef(options.onSucceeded);
  useEffect(() => {
    onSucceeded.current = options.onSucceeded;
  }, [options.onSucceeded]);

  useEffect(() => {
    setState(IDLE);
    if (jobId === null) return;

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    function stop(): void {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
    }

    async function poll(): Promise<void> {
      if (stopped) return;
      try {
        const response = await fetch(`/api/lesson-creation-jobs/${jobId}`, { signal: controller.signal });
        if (stopped) return;
        if (!response.ok) {
          // 401 and 404 are both final for a reader: nothing further to poll.
          setState((current) => ({ ...current, unreadable: true }));
          stop();
          return;
        }
        const body = (await response.json()) as {
          data?: { job?: LessonCreationJobProjection; events?: LessonCreationJobEvent[] };
        };
        if (stopped) return;
        const projection = body?.data?.job;
        // A truncated or unexpected body is treated as a missed tick, not as a
        // job: a consumer must never be handed a half-shaped projection.
        if (projection !== undefined && projection !== null) {
          setState({ job: projection, events: body?.data?.events ?? [], unreadable: false });
          if (isTerminalJobState(projection.state)) {
            stop();
            if (projection.state === "succeeded") onSucceeded.current(projection);
            return;
          }
        }
      } catch {
        // A dropped connection is transient; the next tick tries again. An
        // abort is already covered by `stopped`.
        if (stopped) return;
      }
      timer = setTimeout(() => void poll(), POLL_MS);
    }

    void poll();
    return () => {
      stop();
      controller.abort();
    };
  }, [jobId, attempt]);

  return { ...state, restart: () => setAttempt((current) => current + 1) };
}
