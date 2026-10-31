import { afterEach, describe, expect, it, vi } from "vitest";

type Call = { kind: string; args: unknown[] };

function fakeAudio() {
  const calls: Call[] = [];
  const param = (name: string) => ({
    setValueAtTime: (...args: unknown[]) => calls.push({ kind: `${name}.set`, args }),
    linearRampToValueAtTime: (...args: unknown[]) => calls.push({ kind: `${name}.linear`, args }),
    exponentialRampToValueAtTime: (...args: unknown[]) => calls.push({ kind: `${name}.exp`, args }),
  });
  class FakeContext {
    state = "running";
    currentTime = 0;
    destination = {};
    resume = vi.fn(async () => undefined);
    createOscillator() {
      return { type: "", frequency: param("freq"), connect: (n: unknown) => n, start: (t: number) => calls.push({ kind: "start", args: [t] }), stop: (t: number) => calls.push({ kind: "stop", args: [t] }) };
    }
    createGain() {
      return { gain: param("gain"), connect: (n: unknown) => n };
    }
  }
  vi.stubGlobal("AudioContext", FakeContext);
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("playResultChime", () => {
  it.each([["strong", 3], ["practiced", 2], ["needs_work", 1]] as const)("plays %s as %i quiet, short notes", async (band, count) => {
    const calls = fakeAudio();
    const { playResultChime } = await import("./result-chime");
    playResultChime(band);
    expect(calls.filter((c) => c.kind === "start")).toHaveLength(count);
    // Small enough never to annoy: every gain target ≤ 0.05, and the last note is silent before half a second.
    for (const c of calls.filter((c) => c.kind.startsWith("gain."))) expect(c.args[0] as number).toBeLessThanOrEqual(0.05);
    expect(Math.max(...calls.filter((c) => c.kind === "stop").map((c) => c.args[0] as number))).toBeLessThan(0.5);
  });

  it("rises for good results and stays low for a weak one", async () => {
    const calls = fakeAudio();
    const { playResultChime, CHIMES } = await import("./result-chime");
    playResultChime("strong");
    const freqs = calls.filter((c) => c.kind === "freq.set").map((c) => c.args[0] as number);
    expect(freqs).toEqual([...freqs].sort((a, b) => a - b));
    expect(Math.max(...CHIMES.needs_work.notes)).toBeLessThan(Math.min(...CHIMES.practiced.notes));
  });

  it("is silent, never throwing, where there is no Web Audio", async () => {
    vi.stubGlobal("AudioContext", undefined);
    const { playResultChime } = await import("./result-chime");
    expect(() => playResultChime("strong")).not.toThrow();
  });
});
