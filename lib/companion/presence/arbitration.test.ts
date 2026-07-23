import { describe, expect, it } from "vitest";
import { prunePending, resolve, type PendingContext } from "./arbitration";
import { CONTEXT_TTL_MS, COOLDOWN_WINDOW_MS } from "./config";

const at = (context: PendingContext["context"], emittedAt: number): PendingContext => ({ context, emittedAt });
const noCooldown = { lastAddressAt: null };

describe("resolve (spec 1 §5.10 — at most one address, deterministic)", () => {
  it("is silent with nothing pending", () => {
    expect(resolve([], noCooldown, 1_000)).toEqual({ kind: "silence" });
  });

  it("a burst of contexts yields exactly ONE address — the highest priority", () => {
    const pending = [at("empty_library", 10), at("finished_shadowing", 20), at("memory_created", 30)];
    expect(resolve(pending, noCooldown, 1_000)).toEqual({ kind: "address", context: "finished_shadowing" });
  });

  it("equal priority ties break by earliest emittedAt — same inputs, same choice", () => {
    const pending = [at("memory_created", 500), at("memory_created", 100)];
    expect(resolve(pending, noCooldown, 1_000)).toEqual({ kind: "address", context: "memory_created" });
    // determinism: repeated call, identical result (§12.2)
    expect(resolve(pending, noCooldown, 1_000)).toEqual(resolve(pending, noCooldown, 1_000));
  });

  it("ambient contexts inside an active cooldown are suppressed, not queued", () => {
    const cooldown = { lastAddressAt: 1_000 };
    const pending = [at("finished_shadowing", 1_500)];
    expect(resolve(pending, cooldown, 1_000 + COOLDOWN_WINDOW_MS - 1)).toEqual({ kind: "silence" });
    expect(resolve(pending, cooldown, 1_000 + COOLDOWN_WINDOW_MS + 1)).toEqual({
      kind: "address",
      context: "finished_shadowing",
    });
  });

  it("stale contexts are discarded by prunePending", () => {
    const pending = [at("empty_library", 0), at("memory_created", 10_000)];
    expect(prunePending(pending, CONTEXT_TTL_MS + 1)).toEqual([at("memory_created", 10_000)]);
  });

  it("when every pending context is stale, prunePending empties and resolve is silent", () => {
    const pending = [at("finished_shadowing", 0), at("memory_created", 1_000)];
    const now = CONTEXT_TTL_MS + 1_001;
    expect(prunePending(pending, now)).toEqual([]);
    expect(resolve(pending, noCooldown, now)).toEqual({ kind: "silence" });
  });
});
