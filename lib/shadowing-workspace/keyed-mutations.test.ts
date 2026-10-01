import { describe, expect, it, vi } from "vitest";
import { createKeyedMutator } from "./keyed-mutations";

describe("keyed mutations", () => {
  it("applies synchronously and leaves success applied", async () => {
    const mutator = createKeyedMutator(); const apply = vi.fn(); const rollback = vi.fn();
    const run = mutator.run("a", { apply, request: async () => undefined, rollback });
    expect(apply).toHaveBeenCalledTimes(1); await run; expect(rollback).not.toHaveBeenCalled();
  });

  it("rolls back a single failure", async () => {
    const rollback = vi.fn(); await createKeyedMutator().run("a", { apply: vi.fn(), request: async () => { throw new Error("no"); }, rollback }); expect(rollback).toHaveBeenCalledTimes(1);
  });

  it("does not roll back stale failures after a newer success", async () => {
    let rejectFirst!: () => void; let resolveSecond!: () => void; const rollback = vi.fn(); const mutator = createKeyedMutator();
    const first = mutator.run("a", { apply: vi.fn(), request: () => new Promise<void>((_, reject) => { rejectFirst = () => reject(new Error("no")); }), rollback });
    const second = mutator.run("a", { apply: vi.fn(), request: () => new Promise<void>((resolve) => { resolveSecond = resolve; }), rollback });
    resolveSecond(); await second; rejectFirst(); await first; expect(rollback).not.toHaveBeenCalled();
  });

  it("rolls back a latest failure after a stale success", async () => {
    let resolveFirst!: () => void; let rejectSecond!: () => void; const rollback = vi.fn(); const mutator = createKeyedMutator();
    const first = mutator.run("a", { apply: vi.fn(), request: () => new Promise<void>((resolve) => { resolveFirst = resolve; }), rollback });
    const second = mutator.run("a", { apply: vi.fn(), request: () => new Promise<void>((_, reject) => { rejectSecond = () => reject(new Error("no")); }), rollback });
    resolveFirst(); await first; rejectSecond(); await second; expect(rollback).toHaveBeenCalledTimes(1);
  });

  it("keeps different keys independent and tracks the latest pending request", async () => {
    let resolveA!: () => void; let resolveB!: () => void; const mutator = createKeyedMutator();
    const a = mutator.run("a", { apply: vi.fn(), request: () => new Promise<void>((resolve) => { resolveA = resolve; }), rollback: vi.fn() });
    const b = mutator.run("b", { apply: vi.fn(), request: () => new Promise<void>((resolve) => { resolveB = resolve; }), rollback: vi.fn() });
    expect(mutator.isPending("a")).toBe(true); expect(mutator.isPending("b")).toBe(true); resolveA(); await a; expect(mutator.isPending("a")).toBe(false); expect(mutator.isPending("b")).toBe(true); resolveB(); await b;
  });

  it("stays pending after a stale run settles while the latest is in flight", async () => {
    const mutator = createKeyedMutator();
    let resolveFirst!: () => void;
    let resolveSecond!: () => void;
    const noop = vi.fn();
    const first = mutator.run("a", { apply: noop, rollback: noop, request: () => new Promise<void>((r) => { resolveFirst = r; }) });
    const second = mutator.run("a", { apply: noop, rollback: noop, request: () => new Promise<void>((r) => { resolveSecond = r; }) });
    resolveFirst();
    await first;
    expect(mutator.isPending("a")).toBe(true);
    resolveSecond();
    await second;
    expect(mutator.isPending("a")).toBe(false);
  });

  it("clears pending and settles even when apply or rollback throws", async () => {
    const mutator = createKeyedMutator();
    const settled: boolean[] = [];
    await mutator.run("a", { apply: () => { throw new Error("apply"); }, rollback: vi.fn(), request: vi.fn().mockResolvedValue(undefined), onSettled: (ok) => settled.push(ok) });
    expect(mutator.isPending("a")).toBe(false);
    await expect(mutator.run("b", { apply: vi.fn(), rollback: () => { throw new Error("rollback"); }, request: async () => { throw new Error("x"); }, onSettled: (ok) => settled.push(ok) })).rejects.toThrow("rollback");
    expect(mutator.isPending("b")).toBe(false);
    expect(settled).toEqual([false, false]);
  });

  it("settles every request including stale ones", async () => {
    let rejectFirst!: () => void; let resolveSecond!: () => void; const settled = vi.fn(); const mutator = createKeyedMutator();
    const first = mutator.run("a", { apply: vi.fn(), request: () => new Promise<void>((_, reject) => { rejectFirst = () => reject(new Error("no")); }), rollback: vi.fn(), onSettled: settled });
    const second = mutator.run("a", { apply: vi.fn(), request: () => new Promise<void>((resolve) => { resolveSecond = resolve; }), rollback: vi.fn(), onSettled: settled });
    resolveSecond(); await second; rejectFirst(); await first; expect(settled).toHaveBeenNthCalledWith(1, true); expect(settled).toHaveBeenNthCalledWith(2, false);
  });
});
