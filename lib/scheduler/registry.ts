import "server-only";

/** A unit of due work. `run` returns how many items it handled, so a pass that
 *  did nothing is still reportable — a silent scheduler cannot be told from a
 *  dead one. */
export interface ScheduledJob {
  name: string;
  run(now: Date): Promise<number>;
}

const jobs: ScheduledJob[] = [];

export function registerJob(job: ScheduledJob): void {
  if (jobs.some((existing) => existing.name === job.name)) return;
  jobs.push(job);
}

export function listJobs(): ScheduledJob[] {
  return [...jobs];
}

/** Test-only. Never called by application code. */
export function resetJobs(): void {
  jobs.length = 0;
}
