import "server-only";
import { listJobs } from "./registry";

export interface JobResult {
  name: string;
  handled: number;
}

export async function runDueJobs(
  now: Date = new Date(),
  onError: (name: string, error: unknown) => void = (name, error) =>
    console.error(`[scheduler] ${name} failed`, error),
): Promise<JobResult[]> {
  const results: JobResult[] = [];
  // Sequential on purpose: these jobs delete data, and a shared database
  // connection budget is not worth spending to save milliseconds.
  for (const job of listJobs()) {
    try {
      results.push({ name: job.name, handled: await job.run(now) });
    } catch (error) {
      onError(job.name, error);
      results.push({ name: job.name, handled: 0 });
    }
  }
  return results;
}
