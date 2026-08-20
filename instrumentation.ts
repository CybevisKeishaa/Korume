/**
 * Startup configuration validation, and the scheduler's only call site.
 *
 * MECHANISM ONLY. The requirement is that validation runs exactly once before
 * the app serves its first request (Spec §5.1); this hook is today's way of
 * meeting it. `validateEnv()` imports nothing from Next and is memoized, so
 * this file can be replaced without touching the architecture.
 */
import { registerEnvSpec, validateEnv } from "@/lib/env/validate";

export async function register() {
  // The hook also runs on the edge runtime, where these server-only modules
  // must not load.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { aiEnvSpec } = await import("@/lib/ai/registry");
  const { speechEnvSpec } = await import("@/lib/speech-scoring/env");

  registerEnvSpec(aiEnvSpec);
  registerEnvSpec(speechEnvSpec);
  validateEnv();

  // No task in the plan wired this up before now — without it, account
  // deletion was scheduled but never executed. startScheduler() itself stays
  // inert unless SCHEDULER_ENABLED=true is set explicitly, so calling it here
  // changes nothing for any deployment that has not opted in.
  const { startScheduler } = await import("@/lib/scheduler/start");
  startScheduler();
}
