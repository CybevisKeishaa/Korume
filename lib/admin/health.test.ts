import { beforeEach, describe, expect, it } from "vitest";
import { AiError } from "@/lib/ai";
import { setProviderForTesting } from "@/lib/ai/registry";
import { createFakeProvider } from "@/lib/ai/providers/fake";
import { checkAiHealth, checkHealth, checkSpeechHealth } from "./health";

const enabled = { APP_ENV: "dev", AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "sk-ant-x" };

// An obviously-fake Azure key. Never a real credential shape/value.
const FAKE_AZURE_KEY = "fake0000000000000000000000000000key1";
const enabledSpeech = {
  SPEECH_PROVIDER: "azure",
  AZURE_SPEECH_KEY: FAKE_AZURE_KEY,
  AZURE_SPEECH_REGION: "japaneast",
};

/**
 * Minimal fake `fetch`, in the same spirit as `createFakeProvider`: a FIFO
 * queue of canned outcomes and a record of every request received, so tests
 * assert behavior without touching the real network or a mocked module.
 */
type FakeFetchOutcome = { kind: "response"; status: number } | { kind: "throw"; err: Error };

interface FakeFetchCall {
  url: string;
  headers: Record<string, string>;
}

function createFakeFetch() {
  const queue: FakeFetchOutcome[] = [];
  const calls: FakeFetchCall[] = [];

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key] = value;
    });
    calls.push({ url, headers });

    const next = queue.shift();
    if (!next) throw new Error("createFakeFetch: no response queued for this call.");
    if (next.kind === "throw") throw next.err;
    return new Response(null, { status: next.status });
  };

  return {
    fetchImpl,
    calls,
    queueOk: () => queue.push({ kind: "response", status: 200 }),
    queueStatus: (status: number) => queue.push({ kind: "response", status }),
    queueThrow: (err: Error) => queue.push({ kind: "throw", err }),
  };
}

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

describe("checkSpeechHealth", () => {
  it("reports disabled without touching the network when speech is intentionally off", async () => {
    const fake = createFakeFetch();
    // Nothing queued: if a call were attempted, the fake would throw.
    expect(await checkSpeechHealth({ SPEECH_PROVIDER: "none" }, fake.fetchImpl)).toEqual({
      status: "disabled",
    });
    expect(fake.calls).toHaveLength(0);
  });

  it("reports ok when the token endpoint answers, sending the key only as a header", async () => {
    const fake = createFakeFetch();
    fake.queueOk();
    expect(await checkSpeechHealth(enabledSpeech, fake.fetchImpl)).toEqual({ status: "ok" });
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.headers["ocp-apim-subscription-key"]).toBe(FAKE_AZURE_KEY);
  });

  it("reports the http status kind, never the key, on a non-ok response", async () => {
    const fake = createFakeFetch();
    fake.queueStatus(401);

    const result = await checkSpeechHealth(enabledSpeech, fake.fetchImpl);
    expect(result).toEqual({ status: "error", detail: "http_401" });
    expect(JSON.stringify(result)).not.toContain(FAKE_AZURE_KEY);
  });

  it("maps a thrown network error to error without leaking the key", async () => {
    const fake = createFakeFetch();
    // A realistic failure whose message embeds the credential.
    fake.queueThrow(new Error(`connect ECONNREFUSED for key ${FAKE_AZURE_KEY}`));

    const result = await checkSpeechHealth(enabledSpeech, fake.fetchImpl);
    expect(result).toEqual({ status: "error", detail: "request" });
    expect(JSON.stringify(result)).not.toContain(FAKE_AZURE_KEY);
  });

  it("reports error without a network call when azure is selected but credentials are missing", async () => {
    const fake = createFakeFetch();
    const result = await checkSpeechHealth({ SPEECH_PROVIDER: "azure" }, fake.fetchImpl);
    expect(result).toEqual({ status: "error", detail: "not_configured" });
    expect(fake.calls).toHaveLength(0);
  });
});

describe("checkHealth", () => {
  it("reports both subsystems independently — e.g. AI off, speech ok", async () => {
    const fake = createFakeFetch();
    fake.queueOk();
    const env = { APP_ENV: "dev", AI_PROVIDER: "none", ...enabledSpeech };

    const result = await checkHealth(env, fake.fetchImpl);
    expect(result).toEqual({ ai: { status: "disabled" }, speech: { status: "ok" } });
  });

  it("reports an ai error and a disabled speech subsystem together, without leaking either credential", async () => {
    const fake = createFakeProvider();
    fake.queueError(new AiError("auth", `401 for key ${enabled.ANTHROPIC_API_KEY}`));
    setProviderForTesting(fake.provider);
    const fakeFetch = createFakeFetch();

    const result = await checkHealth({ ...enabled, SPEECH_PROVIDER: "none" }, fakeFetch.fetchImpl);
    expect(result).toEqual({
      ai: { status: "error", detail: "auth" },
      speech: { status: "disabled" },
    });
    expect(JSON.stringify(result)).not.toContain(enabled.ANTHROPIC_API_KEY);
    expect(fakeFetch.calls).toHaveLength(0);
  });
});
