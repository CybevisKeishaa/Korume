"use client";

import { useEffect, useRef, useState } from "react";
import {
  isTerminalJobState,
  type LessonCreationJobEvent,
  type LessonCreationJobProjection,
} from "@/lib/lesson-creation/types";

/**
 * Polls one lesson-creation job for as long as it can still change, and says
 * plainly when it has stopped.
 *
 * Every way of stopping is visible in `phase`, because a consumer that cannot
 * tell polling has ended has no way to let the learner out: the importer's
 * submit button stays disabled reading "Importing…" forever, which is what an
 * earlier version of this hook caused when it reported only "unreadable".
 *
 * - `polling`  — a job is being watched and may still change.
 * - `terminal` — it succeeded or failed; nothing more will arrive.
 * - `refused`  — the status read was refused (`refusedStatus` carries the code,
 *   so a consumer can say "session expired" for a 401 rather than "something
 *   went wrong").
 * - `stalled`  — the job was still active after the poll budget ran out. The
 *   worker may be disabled, deploying, or simply busy with other jobs, and
 *   design §7 forbids presenting that as indefinitely pending.
 * - `idle`     — no job.
 */
const POLL_MS = 2_000;

/**
 * How long to watch a job that keeps reporting the same durable step. The
 * budget resets on every durable transition, so a slow-but-progressing job is
 * never abandoned; only one that is not moving.
 */
const STALL_BUDGET_MS = 5 * 60_000;

export type LessonCreationJobPhase = "idle" | "polling" | "terminal" | "refused" | "stalled";

interface PolledJob {
  job: LessonCreationJobProjection | null;
  events: LessonCreationJobEvent[];
  phase: LessonCreationJobPhase;
  /** The HTTP status that refused the read, when `phase` is `refused`. */
  refusedStatus: number | null;
}

export interface LessonCreationJobPollingState extends PolledJob {
  /**
   * Poll the same job id again. A retry re-queues the job it was given, so the
   * id does not change and cannot restart a loop that stopped — the consumer
   * that knows a new attempt exists says so.
   */
  restart(): void;
}

const IDLE: PolledJob = { job: null, events: [], phase: "idle", refusedStatus: null };

export function useLessonCreationJob(
  jobId: string | null,
  options: { onSucceeded(job: LessonCreationJobProjection): void },
): LessonCreationJobPollingState {
  const [state, setState] = useState<PolledJob>(IDLE);
  const [attempt, setAttempt] = useState(0);

  // Held in a ref so a caller passing a fresh closure each render cannot
  // restart the poll loop; only the job id or an explicit restart may.
  const onSucceeded = useRef(options.onSucceeded);
  useEffect(() => {
    onSucceeded.current = options.onSucceeded;
  }, [options.onSucceeded]);

  useEffect(() => {
    if (jobId === null) {
      setState(IDLE);
      return;
    }
    setState({ ...IDLE, phase: "polling" });

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let lastMovedAt = Date.now();
    let lastStep: string | null = null;

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
          setState((current) => ({ ...current, phase: "refused", refusedStatus: response.status }));
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
          setState({
            job: projection,
            events: body?.data?.events ?? [],
            phase: "polling",
            refusedStatus: null,
          });
          if (isTerminalJobState(projection.state)) {
            stop();
            setState((current) => ({ ...current, phase: "terminal" }));
            if (projection.state === "succeeded") onSucceeded.current(projection);
            return;
          }
          // Durable movement, not wall-clock time, is what earns more patience.
          if (projection.step !== lastStep) {
            lastStep = projection.step;
            lastMovedAt = Date.now();
          }
        }
      } catch {
        // A dropped connection is transient; the next tick tries again. An
        // abort is already covered by `stopped`.
        if (stopped) return;
      }
      if (Date.now() - lastMovedAt >= STALL_BUDGET_MS) {
        setState((current) => ({ ...current, phase: "stalled" }));
        stop();
        return;
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
