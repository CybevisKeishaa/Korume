/**
 * On-demand liveness. Startup validates credential STRUCTURE offline; only this
 * endpoint proves a credential actually works — catching revoked keys, wrong
 * regions and spent quota. It is deliberately NOT wired into startup: boot must
 * never depend on a third party's uptime (Spec D2).
 *
 * `detail` carries the error KIND only. Upstream messages can embed credentials,
 * and this response is rendered in an admin UI.
 */
import type { EnvSource } from "@/lib/env/validate";
import { AiError } from "@/lib/ai/errors";
import { getProvider, isAiEnabled } from "@/lib/ai/registry";
import { isSpeechConfigured } from "@/lib/speech-scoring";

export interface SubsystemHealth {
  status: "ok" | "disabled" | "error";
  /** Error kind only — never an upstream message. */
  detail?: string;
}

export async function checkAiHealth(env: EnvSource = process.env): Promise<SubsystemHealth> {
  if (!isAiEnabled(env)) return { status: "disabled" };

  try {
    await getProvider(env).generateText({
      tier: "fast",
      reasoning: false,
      maxTokens: 1,
      system: [{ text: "health check", cacheable: false }],
      messages: [{ role: "user", content: "ping" }],
    });
    return { status: "ok" };
  } catch (err) {
    return {
      status: "error",
      detail: err instanceof AiError ? err.kind : "unknown",
    };
  }
}

export async function checkSpeechHealth(): Promise<SubsystemHealth> {
  if (!isSpeechConfigured()) return { status: "disabled" };

  const { speechCredentials } = await import("@/lib/speech-scoring/config");
  try {
    const { key, region } = speechCredentials();
    const response = await fetch(
      `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      { method: "POST", headers: { "Ocp-Apim-Subscription-Key": key } },
    );
    return response.ok ? { status: "ok" } : { status: "error", detail: `http_${response.status}` };
  } catch {
    return { status: "error", detail: "request" };
  }
}

export async function checkHealth(): Promise<{ ai: SubsystemHealth; speech: SubsystemHealth }> {
  // allSettled: one subsystem's failure must not mask the other's report.
  const [ai, speech] = await Promise.allSettled([checkAiHealth(), checkSpeechHealth()]);
  const unwrap = (r: PromiseSettledResult<SubsystemHealth>): SubsystemHealth =>
    r.status === "fulfilled" ? r.value : { status: "error", detail: "unknown" };
  return { ai: unwrap(ai), speech: unwrap(speech) };
}
