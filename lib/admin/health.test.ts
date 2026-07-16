import { beforeEach, describe, expect, it } from "vitest";
import { AiError } from "@/lib/ai";
import { setProviderForTesting } from "@/lib/ai/registry";
import { createFakeProvider } from "@/lib/ai/providers/fake";
import { checkAiHealth } from "./health";

const enabled = { APP_ENV: "dev", AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "sk-ant-x" };

beforeEach(() => setProviderForTesting(null));

describe("checkAiHealth", () => {
  it("reports disabled without touching the network when AI is intentionally off", async () => {
    const fake = createFakeProvider();
    setProviderForTesting(fake.provider);
    // Nothing queued: if a call were attempted, the fake would throw.
    expect(await checkAiHealth({ APP_ENV: "dev", AI_PROVIDER: "none" })).toEqual({
      status: "disabled",
    });
    expect(fake.requests).toHaveLength(0);
  });

  it("reports ok when the provider answers", async () => {
    const fake = createFakeProvider();
    fake.queueText("pong");
    setProviderForTesting(fake.provider);
    expect(await checkAiHealth(enabled)).toEqual({ status: "ok" });
  });

  it("reports the error kind, not the message", async () => {
    const fake = createFakeProvider();
    // A realistic upstream error whose message embeds the credential.
    fake.queueError(new AiError("auth", "401 unauthorized for key sk-ant-SECRET123"));
    setProviderForTesting(fake.provider);

    const result = await checkAiHealth(enabled);
    expect(result).toEqual({ status: "error", detail: "auth" });
    expect(JSON.stringify(result)).not.toContain("sk-ant-SECRET123");
  });

  it("maps an unexpected throw to error without leaking it", async () => {
    const fake = createFakeProvider();
    fake.queueError(new Error("connect ECONNREFUSED 10.0.0.1:443"));
    setProviderForTesting(fake.provider);

    const result = await checkAiHealth(enabled);
    expect(result.status).toBe("error");
    expect(JSON.stringify(result)).not.toContain("10.0.0.1");
  });
});
