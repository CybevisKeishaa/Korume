/**
 * Speech provider selection and credential structure.
 *
 * This is the SAME provider lifecycle as lib/ai/env.ts, not a coincidental
 * resemblance (Spec D9): selection is explicit and required; `none` means
 * INTENTIONALLY DISABLED and preserves the SpeechNotConfiguredError → 503 path;
 * a named provider with missing or structurally invalid configuration is a
 * startup failure. A third subsystem should inherit this shape, not invent one.
 */
import { z } from "zod";
import type { EnvSource, EnvSpec } from "@/lib/env/validate";

export type SpeechProviderName = "none" | "azure";

/**
 * Azure Speech keys are unseparated alphanumeric strings. Azure has issued both
 * the classic 32-hex Key1/Key2 and, as here, longer keys (the live key verified
 * on 2026-07-15 is 84 alphanumeric chars — spec §7 V6), so this rule matches the
 * one stable property rather than a specific length.
 *
 * What it catches: the 2026-07-14 audit found a 36-character GUID here — the
 * resource id, copied instead of the key — which returned 401 and silently
 * killed TTS, STT, pronunciation scoring and the pitch reference for weeks. A
 * GUID is hyphen-separated, so it fails this rule; both real key shapes pass.
 *
 * Deliberately loose on length: an earlier draft of this plan pinned it to 32
 * hex from memory, which would have REJECTED the working 84-char key and blocked
 * boot — the exact failure spec §8 predicts for unverified markers.
 */
const AZURE_KEY_PATTERN = /^[A-Za-z0-9]{32,}$/;

export const speechEnvSchema = z
  .object({
    SPEECH_PROVIDER: z.enum(["none", "azure"]),
    AZURE_SPEECH_KEY: z.string().optional(),
    AZURE_SPEECH_REGION: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.SPEECH_PROVIDER === "none") return; // Intentionally disabled.

    const fail = (message: string, path: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });

    if (!env.AZURE_SPEECH_KEY) {
      fail(
        "AZURE_SPEECH_KEY is required (SPEECH_PROVIDER=azure). It is never " +
          "inferred — see .env.local.example.",
        "AZURE_SPEECH_KEY",
      );
    } else if (!AZURE_KEY_PATTERN.test(env.AZURE_SPEECH_KEY)) {
      fail(
        "AZURE_SPEECH_KEY does not match the documented key structure " +
          "(expected an unseparated alphanumeric string of at least 32 " +
          "characters — Key1/Key2 from the Azure portal, not the resource id).",
        "AZURE_SPEECH_KEY",
      );
    }

    if (!env.AZURE_SPEECH_REGION) {
      fail(
        "AZURE_SPEECH_REGION is required (SPEECH_PROVIDER=azure).",
        "AZURE_SPEECH_REGION",
      );
    }
  });

export type SpeechEnvShape = z.infer<typeof speechEnvSchema>;

const speechProviderName = z.enum(["none", "azure"]);

export interface SpeechEnv {
  SPEECH_PROVIDER: SpeechProviderName;
}

/**
 * Reads just the provider selection — deliberately NOT the full
 * `speechEnvSchema` (which also demands valid AZURE_SPEECH_KEY/REGION
 * whenever azure is selected). Throws if SPEECH_PROVIDER is unset or not one
 * of the documented values: absence is never read as intent (Spec D9),
 * mirroring `readAiEnv`.
 *
 * Kept narrow, unlike `readAiEnv`, because `checkSpeechHealth`
 * (lib/admin/health.ts) intentionally reports a graceful
 * `{status:"error", detail:"not_configured"}` when azure is selected but
 * credentials are incomplete, rather than throwing — that runtime diagnostic
 * path is a preserved D1 contract (lib/admin/health.test.ts), so credential
 * *structure* stays a startup-time concern (`speechEnvSchema`), not this
 * function's.
 */
export function readSpeechEnv(env: EnvSource = process.env): SpeechEnv {
  const parsed = speechProviderName.safeParse(env.SPEECH_PROVIDER);
  if (!parsed.success) {
    throw new Error(
      "SPEECH_PROVIDER is required and must be one of: none, azure. It is " +
        "never inferred — see .env.local.example.",
    );
  }
  return { SPEECH_PROVIDER: parsed.data };
}

/**
 * Whether speech is intentionally enabled. Never inferred from key presence —
 * throws on unset/invalid SPEECH_PROVIDER instead (misconfiguration), same
 * provider lifecycle as `isAiEnabled` (Spec D9).
 */
export function isSpeechEnabled(env: EnvSource = process.env): boolean {
  return readSpeechEnv(env).SPEECH_PROVIDER !== "none";
}

/** Registered at startup by `instrumentation.ts` (Task 13). */
export const speechEnvSpec: EnvSpec<SpeechEnvShape> = {
  name: "speech",
  schema: speechEnvSchema,
};
