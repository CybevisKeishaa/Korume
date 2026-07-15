/**
 * Shared startup validation for environment configuration.
 *
 * Framework-agnostic by design: this module imports nothing from Next and is
 * idempotent, so the startup mechanism (today `instrumentation.ts`) can be
 * replaced without touching the architecture. See the Spec §5.1 — "validate
 * exactly once before serving the first request" is the requirement; the hook
 * is only the current implementation.
 *
 * Failures are AGGREGATED and reported once: the 2026-07-14 audit found two
 * misconfigured credentials simultaneously, and fail-at-first-error would have
 * meant fix / restart / discover the next one / restart.
 *
 * Error text NEVER contains a credential value (CLAUDE.md §6) — crash logs go
 * to the host console.
 */
import type { z } from "zod";

/** A source of environment variables: the real process env, or a test literal. */
export type EnvSource = NodeJS.ProcessEnv | Record<string, string>;

export interface EnvCheckResult {
  errors?: string[];
  warnings?: string[];
}

export interface EnvSpec<T> {
  /** Subsystem name, used to group messages in the report. */
  name: string;
  schema: z.ZodType<T>;
  /**
   * Cross-field rules a zod shape cannot express (deployment policy, provider
   * capability gaps). Errors abort startup; warnings are reported and allowed.
   */
  check?: (value: T) => EnvCheckResult;
}

export class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvValidationError";
  }
}

// `unknown` is the only sound element type for a heterogeneous spec list; each
// spec's own schema re-establishes its type at validation time.
const specs: EnvSpec<unknown>[] = [];
let validated = false;

export function registerEnvSpec<T>(spec: EnvSpec<T>): void {
  specs.push(spec as EnvSpec<unknown>);
}

/** Test-only: clears registrations and the memo. */
export function resetEnvValidationForTesting(): void {
  specs.length = 0;
  validated = false;
}

export function validateEnv(env?: EnvSource): void {
  if (validated) return;
  const envToValidate = env ?? process.env;

  const errors: string[] = [];
  const warnings: string[] = [];

  for (const spec of specs) {
    const parsed = spec.schema.safeParse(envToValidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const variable = issue.path.join(".") || "(root)";
        errors.push(`[${spec.name}] ${variable}: ${issue.message}`);
      }
      continue; // check() needs a parsed value; skip it when the shape failed.
    }
    const result = spec.check?.(parsed.data) ?? {};
    for (const e of result.errors ?? []) errors.push(`[${spec.name}] ${e}`);
    for (const w of result.warnings ?? []) warnings.push(`[${spec.name}] ${w}`);
  }

  for (const warning of warnings) {
    console.warn(`Environment warning: ${warning}`);
  }

  if (errors.length > 0) {
    throw new EnvValidationError(
      `Invalid environment configuration (${errors.length} problem(s)):\n` +
        errors.map((e) => `  - ${e}`).join("\n") +
        `\nSee .env.local.example.`,
    );
  }

  validated = true;
}
