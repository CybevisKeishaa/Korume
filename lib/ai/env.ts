/**
 * AI provider selection, credential structure, and deployment policy.
 *
 * Implements the provider lifecycle (Spec D9): selection is explicit and
 * required; `none` means INTENTIONALLY DISABLED and keeps the 503 path; a named
 * provider with missing or structurally invalid configuration is a startup
 * failure. Nothing here is ever inferred from which keys happen to be present —
 * that inference is what hid a missing ANTHROPIC_API_KEY until the 2026-07-14
 * audit.
 */
import { z } from "zod";
import type { EnvSource } from "@/lib/env/validate";

export type AppEnv = "dev" | "staging" | "production";
export type AiProviderName = "none" | "anthropic" | "gemini";

/**
 * Structural markers, per Spec D2: startup validates STABLE, DOCUMENTED
 * structure — not merely presence, since both 2026-07-14 audit bugs were
 * present-but-wrong. Kept as loose as possible while still catching the known
 * bad shapes, because a wrong rule here blocks boot (Spec §8).
 *
 * ANTHROPIC: unverifiable today — the user has no key, so this marker comes
 * from documentation, NOT from a real key. Most likely rule to false-crash.
 *
 * GEMINI: verified against the live API on 2026-07-15 (spec §7 V3). Google
 * issues BOTH shapes and both are valid, so accept either — the working key in
 * use is the 53-char `AQ.` form, and a rule assuming only `AIza` would reject
 * it and block boot. This is the whole reason Task 1 runs before this file.
 */
const ANTHROPIC_KEY_PREFIX = "sk-ant-";
const GEMINI_KEY_PREFIXES = ["AIza", "AQ."] as const;

const providerName = z.enum(["none", "anthropic", "gemini"]);
const appEnv = z.enum(["dev", "staging", "production"]);

const requiredMsg = (v: string, hint: string) =>
  `${v} is required (${hint}). It is never inferred — see .env.local.example.`;

export const aiEnvSchema = z
  .object({
    APP_ENV: appEnv,
    AI_PROVIDER: providerName,
    ANTHROPIC_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL_FAST: z.string().optional(),
    GEMINI_MODEL_DEEP: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    const fail = (message: string, path: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });

    if (env.AI_PROVIDER === "none") return; // Intentionally disabled: check nothing.

    if (env.APP_ENV === "production" && env.AI_PROVIDER === "gemini") {
      fail(
        "Gemini must not run in production: its free tier permits training on " +
          "submitted data, and real user data must never reach it (CLAUDE.md §2).",
        "AI_PROVIDER",
      );
      return;
    }

    if (env.AI_PROVIDER === "anthropic") {
      if (!env.ANTHROPIC_API_KEY) {
        fail(requiredMsg("ANTHROPIC_API_KEY", "AI_PROVIDER=anthropic"), "ANTHROPIC_API_KEY");
      } else if (!env.ANTHROPIC_API_KEY.startsWith(ANTHROPIC_KEY_PREFIX)) {
        fail(
          `ANTHROPIC_API_KEY does not match the documented key structure ` +
            `(expected it to begin with "${ANTHROPIC_KEY_PREFIX}").`,
          "ANTHROPIC_API_KEY",
        );
      }
    }

    if (env.AI_PROVIDER === "gemini") {
      if (!env.GEMINI_API_KEY) {
        fail(requiredMsg("GEMINI_API_KEY", "AI_PROVIDER=gemini"), "GEMINI_API_KEY");
      } else if (
        // `?.` below is load-bearing, not redundant: TS narrows `env.GEMINI_API_KEY`
        // truthy in this `else if`, but that narrowing does not survive into the
        // `.some()` callback closure, so removing it is a TS18048 typecheck error.
        !GEMINI_KEY_PREFIXES.some((p) => env.GEMINI_API_KEY?.startsWith(p))
      ) {
        fail(
          `GEMINI_API_KEY does not match a documented Google API key structure ` +
            `(expected it to begin with one of: ${GEMINI_KEY_PREFIXES.join(", ")}).`,
          "GEMINI_API_KEY",
        );
      }
      if (!env.GEMINI_MODEL_FAST) {
        fail(requiredMsg("GEMINI_MODEL_FAST", "AI_PROVIDER=gemini"), "GEMINI_MODEL_FAST");
      }
      if (!env.GEMINI_MODEL_DEEP) {
        fail(requiredMsg("GEMINI_MODEL_DEEP", "AI_PROVIDER=gemini"), "GEMINI_MODEL_DEEP");
      }
    }
  });

export type AiEnvShape = z.infer<typeof aiEnvSchema>;

export interface AiEnv {
  APP_ENV: AppEnv;
  AI_PROVIDER: AiProviderName;
}

/** Reads the validated selection. Throws if unset/invalid — never guesses. */
export function readAiEnv(env: EnvSource = process.env): AiEnv {
  const parsed = aiEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      `AI environment is invalid: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return { APP_ENV: parsed.data.APP_ENV, AI_PROVIDER: parsed.data.AI_PROVIDER };
}
