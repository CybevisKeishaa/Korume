/**
 * Email provider selection. Mirrors `lib/ai/env.ts`'s lifecycle exactly
 * (Spec D9): selection is explicit and required; `none` means INTENTIONALLY
 * DISABLED; a value that is neither documented option is a startup failure.
 * Nothing is ever inferred from which keys happen to be present.
 *
 * `console` is the only real adapter today — no production transport (SMTP,
 * Resend, ...) has been chosen yet (`mem:l9b_plan1_gdpr_run_state` § Owed).
 * It is dev/test only, forbidden in production for the same reason
 * `AI_PROVIDER=gemini` is: a notification that appears to send but never
 * reaches a real inbox is worse than being visibly off, and `EMAIL_PROVIDER
 * =none` is the honest, legal production value until a real transport lands.
 */
import { z } from "zod";
import type { EnvSource } from "@/lib/env/validate";

export type AppEnv = "dev" | "staging" | "production";
export type EmailProviderName = "none" | "console";

const providerName = z.enum(["none", "console"]);
const appEnv = z.enum(["dev", "staging", "production"]);

export const emailEnvSchema = z
  .object({
    APP_ENV: appEnv,
    EMAIL_PROVIDER: providerName,
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV === "production" && env.EMAIL_PROVIDER === "console") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "EMAIL_PROVIDER=console must not run in production: it only logs to the " +
          "server console and never reaches a real inbox. Use EMAIL_PROVIDER=none " +
          "until a real transport is chosen, or select one.",
        path: ["EMAIL_PROVIDER"],
      });
    }
  });

export type EmailEnvShape = z.infer<typeof emailEnvSchema>;

export interface EmailEnv {
  APP_ENV: AppEnv;
  EMAIL_PROVIDER: EmailProviderName;
}

/** Reads the validated selection. Throws if unset/invalid — never guesses. */
export function readEmailEnv(env: EnvSource = process.env): EmailEnv {
  const parsed = emailEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      `Email environment is invalid: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return { APP_ENV: parsed.data.APP_ENV, EMAIL_PROVIDER: parsed.data.EMAIL_PROVIDER };
}
