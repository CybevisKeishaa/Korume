/**
 * Explicit provider selection. No inference, no fallback — mirrors
 * `lib/ai/registry.ts`.
 */
import "server-only";
import type { EnvSource, EnvSpec } from "@/lib/env/validate";
import { emailEnvSchema, readEmailEnv, type EmailEnvShape } from "./env";
import { EmailNotConfiguredError } from "./errors";
import type { EmailProvider } from "./types";
import { createConsoleProvider } from "./providers/console";

let testProvider: EmailProvider | null = null;

/** Test-only injection point. */
export function setProviderForTesting(provider: EmailProvider | null): void {
  testProvider = provider;
}

export function isEmailEnabled(env: EnvSource = process.env): boolean {
  return readEmailEnv(env).EMAIL_PROVIDER !== "none";
}

export function getProvider(env: EnvSource = process.env): EmailProvider {
  if (testProvider) return testProvider;

  const parsed = emailEnvSchema.safeParse(env);
  if (!parsed.success) {
    // Startup validation should have caught this; reaching here means a
    // caller ran before validation, so fail loudly rather than degrade.
    throw new Error(
      `Email provider is misconfigured: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }

  switch (parsed.data.EMAIL_PROVIDER) {
    case "none":
      throw new EmailNotConfiguredError();
    case "console":
      return createConsoleProvider();
  }
}

/** Registered at startup by `instrumentation.ts`, alongside the AI/speech/scheduler specs. */
export const emailEnvSpec: EnvSpec<EmailEnvShape> = {
  name: "email",
  schema: emailEnvSchema,
};
