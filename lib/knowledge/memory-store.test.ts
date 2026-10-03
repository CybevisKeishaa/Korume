import { expect, it } from "vitest";
import { createMemoryKnowledgeStore } from "./memory-store";
import type { ReserveInput } from "./types";

const limits = {
  globalUsdPerDay: 100, freeSentencesPerDay: 3, plusMaxSectionsPerDay: 200, plusCreditsPerMonth: 10,
  askKorumeFreeTurnsPerDay: 2, askKorumePlusTurnsPerDay: 2, systemGenerationsPerUserPerDay: 2,
};
const input = (overrides: Partial<ReserveInput> = {}): ReserveInput => ({
  requestedBy: "learner", billingScope: "learner", entitlementKind: "korume_free_turn", fingerprint: "same",
  reservedCredits: 0, reservedUsd: 0.01, limits, ttlSeconds: 120, ...overrides,
});

it("refuses a second active reservation for one turn and permits a retry after release", async () => {
  const memory = createMemoryKnowledgeStore(new Date("2026-10-03T09:00:00Z"));
  const first = await memory.store.reserve(input({ turnId: "turn-1" }));
  expect(first.outcome).toBe("reserved");
  expect((await memory.store.reserve(input({ turnId: "turn-1" }))).outcome).toBe("turn_exists");
  expect(memory.budgetFor(memory.now()).reservedUsd).toBe(0.01);
  await memory.store.release(first.reservationId ?? "", 0);
  expect((await memory.store.reserve(input({ turnId: "turn-1" }))).outcome).toBe("reserved");
});

it("counts Free Korume turns by turn, and reclaims expired holds before the quota check", async () => {
  const memory = createMemoryKnowledgeStore(new Date("2026-10-03T09:00:00Z"));
  expect((await memory.store.reserve(input({ turnId: "a", ttlSeconds: 1 }))).outcome).toBe("reserved");
  expect((await memory.store.reserve(input({ turnId: "b" }))).outcome).toBe("reserved");
  expect((await memory.store.reserve(input({ turnId: "c" }))).outcome).toBe("quota_exhausted");
  memory.advance(2000);
  expect((await memory.store.reserve(input({ turnId: "c" }))).outcome).toBe("reserved");
});

it("caps active system reservations per requesting user without limiting other or null users", async () => {
  const memory = createMemoryKnowledgeStore(new Date("2026-10-03T09:00:00Z"));
  const system = (fingerprint: string, requestedBy: string | null = "system-user") => input({
    billingScope: "system", entitlementKind: null, requestedBy, fingerprint,
  });
  const first = await memory.store.reserve(system("one"));
  expect(first.outcome).toBe("reserved");
  expect((await memory.store.reserve(system("two"))).outcome).toBe("reserved");
  expect((await memory.store.reserve(system("three"))).outcome).toBe("quota_exhausted");
  expect((await memory.store.reserve(system("other", "other-user"))).outcome).toBe("reserved");
  expect((await memory.store.reserve(system("null", null))).outcome).toBe("reserved");
  await memory.store.release(first.reservationId ?? "", 0);
  expect((await memory.store.reserve(system("after-release"))).outcome).toBe("reserved");
});

it("shares settled Plus credits both ways and keeps the Korume turn fuse separate", async () => {
  const memory = createMemoryKnowledgeStore(new Date("2026-10-03T09:00:00Z"));
  const section = await memory.store.reserve(input({ entitlementKind: "plus_section", reservedCredits: 6 }));
  expect(section.outcome).toBe("reserved");
  await memory.store.settle(section.reservationId ?? "", "g1", 6, 0.01);
  expect((await memory.store.reserve(input({ entitlementKind: "korume_plus_turn", turnId: "a", reservedCredits: 5 }))).outcome)
    .toBe("credits_exhausted");
  const other = createMemoryKnowledgeStore(new Date("2026-10-03T09:00:00Z"));
  const turn = await other.store.reserve(input({ entitlementKind: "korume_plus_turn", turnId: "a", reservedCredits: 6 }));
  expect(turn.outcome).toBe("reserved");
  await other.store.settle(turn.reservationId ?? "", "g2", 6, 0.01);
  expect((await other.store.reserve(input({ entitlementKind: "plus_section", reservedCredits: 5 }))).outcome)
    .toBe("credits_exhausted");
  expect(other.charges[0]?.credits).toBe(6);
  const fuse = createMemoryKnowledgeStore(new Date("2026-10-03T09:00:00Z"));
  expect((await fuse.store.reserve(input({ entitlementKind: "plus_section", reservedCredits: 1 }))).outcome).toBe("reserved");
  expect((await fuse.store.reserve(input({ entitlementKind: "korume_plus_turn", turnId: "x", reservedCredits: 1 }))).outcome).toBe("reserved");
  expect((await fuse.store.reserve(input({ entitlementKind: "korume_plus_turn", turnId: "y", reservedCredits: 1 }))).outcome).toBe("reserved");
  expect((await fuse.store.reserve(input({ entitlementKind: "korume_plus_turn", turnId: "z", reservedCredits: 1 }))).outcome).toBe("fuse_tripped");
});
