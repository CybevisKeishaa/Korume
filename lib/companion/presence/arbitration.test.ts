import { describe, expect, it } from "vitest";
import { comparePending, prunePending, resolve, type PendingContext } from "./arbitration";
import { CONTEXT_TTL_MS, COOLDOWN_WINDOW_MS } from "./config";
import { CONTEXT_PRIORITY, type ExperienceContext } from "./contexts";

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

  it("the cooldown boundary is inclusive: at exactly COOLDOWN_WINDOW_MS it still suppresses", () => {
    const cooldown = { lastAddressAt: 1_000 };
    const pending = [at("finished_shadowing", 1_500)];
    expect(resolve(pending, cooldown, 1_000 + COOLDOWN_WINDOW_MS)).toEqual({ kind: "silence" });
  });

  it("stale contexts are discarded by prunePending", () => {
    const pending = [at("empty_library", 0), at("memory_created", 10_000)];
    expect(prunePending(pending, CONTEXT_TTL_MS + 1)).toEqual([at("memory_created", 10_000)]);
  });

  it("the TTL boundary is inclusive: a context aged exactly CONTEXT_TTL_MS is kept", () => {
    const pending = [at("empty_library", 0)];
    expect(prunePending(pending, CONTEXT_TTL_MS)).toEqual(pending);
    expect(resolve(pending, noCooldown, CONTEXT_TTL_MS)).toEqual({ kind: "address", context: "empty_library" });
  });

  it("when every pending context is stale, prunePending empties and resolve is silent", () => {
    const pending = [at("finished_shadowing", 0), at("memory_created", 1_000)];
    const now = CONTEXT_TTL_MS + 1_001;
    expect(prunePending(pending, now)).toEqual([]);
    expect(resolve(pending, noCooldown, now)).toEqual({ kind: "silence" });
  });
});

/**
 * Levels 2 and 3 of the ordering are unobservable through `resolve`:
 * CONTEXT_PRIORITY is injective, so equal priority implies the same context,
 * and `Resolution` carries only the context — never `emittedAt`. Pinning them
 * therefore requires asserting on the comparator directly.
 */
describe("comparePending (the total order behind resolve)", () => {
  const sign = (n: number): number => Math.sign(n);

  /**
   * Level 3 is defensive: while CONTEXT_PRIORITY is injective no two distinct
   * contexts can reach it. Temporarily flattening b's priority onto a's is the
   * only way to exercise it; the table is restored in `finally`, so the
   * mutation never escapes this call and the suite stays order-independent.
   */
  function withEqualPriority<T>(a: ExperienceContext, b: ExperienceContext, run: () => T): T {
    const savedA = CONTEXT_PRIORITY[a];
    const savedB = CONTEXT_PRIORITY[b];
    CONTEXT_PRIORITY[b] = savedA;
    try {
      return run();
    } finally {
      CONTEXT_PRIORITY[a] = savedA;
      CONTEXT_PRIORITY[b] = savedB;
    }
  }

  it("level 1: the lower priority wins, regardless of emittedAt", () => {
    // finished_shadowing (50) outranks empty_mining_deck (53) even when later.
    const stronger = at("finished_shadowing", 9_000);
    const weaker = at("empty_mining_deck", 1);
    expect(comparePending(stronger, weaker)).toBeLessThan(0);
    expect(sign(comparePending(weaker, stronger))).toBe(-sign(comparePending(stronger, weaker)));
  });

  it("level 2: on equal priority the earlier emittedAt wins", () => {
    const earlier = at("memory_created", 100);
    const later = at("memory_created", 500);
    expect(comparePending(earlier, later)).toBeLessThan(0);
    expect(sign(comparePending(later, earlier))).toBe(-sign(comparePending(earlier, later)));
  });

  it("level 3: on equal priority AND equal emittedAt the smaller context name wins", () => {
    withEqualPriority("empty_library", "empty_mining_deck", () => {
      const first = at("empty_library", 100);
      const second = at("empty_mining_deck", 100);
      expect(CONTEXT_PRIORITY[first.context]).toBe(CONTEXT_PRIORITY[second.context]);
      expect(comparePending(first, second)).toBeLessThan(0);
      expect(sign(comparePending(second, first))).toBe(-sign(comparePending(first, second)));
    });
    // the override is undone — the real table is injective again
    expect(CONTEXT_PRIORITY.empty_library).not.toBe(CONTEXT_PRIORITY.empty_mining_deck);
  });

  it("is 0 for two entries identical on all three levels (and so keeps the incumbent)", () => {
    expect(comparePending(at("memory_created", 100), at("memory_created", 100))).toBe(0);
  });
});
