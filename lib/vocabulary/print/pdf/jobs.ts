import "server-only";
import { randomBytes } from "node:crypto";
import type { RenderPayload } from "./request";

export interface RenderJob { userId: string; lessonId: string; payload: RenderPayload; expiresAt: number }

const TTL_MS = 60_000;
// globalThis, not a module variable: the route handler and the page bundle may hold separate module instances.
// ponytail: process-local — valid for the single long-running Node instance (AGENTS.md); a multi-instance deploy needs a shared store.
const store: Map<string, RenderJob> = ((globalThis as { __korumePrintJobs?: Map<string, RenderJob> }).__korumePrintJobs ??= new Map());

/** Spec W §6.3 step 3: a 256-bit single-use capability, valid for 60 seconds. */
export function createRenderJob(job: Omit<RenderJob, "expiresAt">, now = Date.now()): string {
  for (const [token, entry] of store) if (entry.expiresAt <= now) store.delete(token);
  const token = randomBytes(32).toString("base64url");
  store.set(token, { ...job, expiresAt: now + TTL_MS });
  return token;
}

/** Consumed on first read; unknown, used or expired → null. */
export function takeRenderJob(token: string, now = Date.now()): RenderJob | null {
  const job = store.get(token);
  store.delete(token);
  return job && job.expiresAt > now ? job : null;
}
