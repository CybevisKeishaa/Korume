/**
 * TEST SUPPORT ONLY — imported by `*.test.ts` and nothing else (orchestrator.test.ts asserts it).
 *
 * The KnowledgeStore contract of migration 038 in memory, with its own clock, so orchestration can be
 * tested for single flight, stale leaders and money without a database. Every rule mirrors the SQL
 * function it stands in for; the SQL itself is proven by `verify:db:knowledge`.
 */
import { randomUUID } from "node:crypto";
import { cacheKeyJson } from "./cache-key";
import { nextUtcMidnight, nextUtcMonth, utcDay, utcMonth } from "./periods";
import type { GenerationRow, KnowledgeKey, KnowledgeStore, ReserveInput } from "./types";

interface MemoryEntry {
  id: string;
  key: KnowledgeKey;
  status: "pending" | "ready" | "failed";
  leaseUntil: Date | null;
  leaseToken: string | null;
  content: unknown;
  model: string | null;
  provider: string | null;
  errorCode: string | null;
  retryAfter: Date | null;
  attempts: number;
}

interface MemoryReservation {
  id: string;
  requestedBy: string | null;
  billingScope: "learner" | "system";
  entitlementKind: "free_sentence" | "plus_section" | null;
  fingerprint: string;
  reservedCredits: number;
  reservedUsd: number;
  status: "held" | "settled" | "released";
  expiresAt: Date;
  day: string;
  month: string;
}

interface MemoryCharge {
  userId: string;
  entitlementKind: "free_sentence" | "plus_section";
  fingerprint: string;
  credits: number;
  generationId: string;
  reservationId: string;
  day: string;
  month: string;
}

export interface MemoryKnowledgeStore {
  store: KnowledgeStore;
  entries: Map<string, MemoryEntry>;
  reservations: MemoryReservation[];
  charges: MemoryCharge[];
  generations: (GenerationRow & { id: string })[];
  now(): Date;
  advance(ms: number): void;
  budgetFor(date: Date): { reservedUsd: number; spentUsd: number };
}

const day = utcDay;
const month = utcMonth;
const nextDay = (date: Date) => nextUtcMidnight(date).toISOString();
const nextMonth = (date: Date) => nextUtcMonth(date).toISOString();

export function createMemoryKnowledgeStore(start: Date): MemoryKnowledgeStore {
  let clock = new Date(start);
  const entries = new Map<string, MemoryEntry>();
  const reservations: MemoryReservation[] = [];
  const charges: MemoryCharge[] = [];
  const generations: (GenerationRow & { id: string })[] = [];
  const budget = new Map<string, { reservedUsd: number; spentUsd: number }>();

  const budgetRow = (period: string) => {
    let row = budget.get(period);
    if (!row) budget.set(period, (row = { reservedUsd: 0, spentUsd: 0 }));
    return row;
  };
  const keyString = (key: KnowledgeKey) => JSON.stringify(cacheKeyJson(key));
  const close = (id: string, to: "settled" | "released") => {
    const reservation = reservations.find((r) => r.id === id && r.status === "held");
    if (!reservation) return null;
    reservation.status = to;
    return reservation;
  };
  const used = (r: MemoryReservation) => r.status === "held" || r.status === "settled";

  const store: KnowledgeStore = {
    async claimLease(key, leaseSeconds) {
      const lease = new Date(clock.getTime() + leaseSeconds * 1000);
      const existing = entries.get(keyString(key));
      if (!existing) {
        const entry: MemoryEntry = {
          id: randomUUID(), key, status: "pending", leaseUntil: lease, leaseToken: randomUUID(),
          content: null, model: null, provider: null, errorCode: null, retryAfter: null, attempts: 1,
        };
        entries.set(keyString(key), entry);
        return { outcome: "leader", entryId: entry.id, leaseToken: entry.leaseToken ?? "", attempts: 1 };
      }
      if (existing.status === "ready") {
        return { outcome: "ready", entryId: existing.id, content: existing.content, model: existing.model };
      }
      if (existing.status === "failed" && existing.retryAfter && existing.retryAfter > clock) {
        return { outcome: "backoff", entryId: existing.id, retryAfter: existing.retryAfter.toISOString() };
      }
      if (existing.status === "failed" || (existing.leaseUntil && existing.leaseUntil < clock)) {
        Object.assign(existing, { status: "pending", leaseUntil: lease, leaseToken: randomUUID(), attempts: existing.attempts + 1 });
        return { outcome: "leader", entryId: existing.id, leaseToken: existing.leaseToken ?? "", attempts: existing.attempts };
      }
      return { outcome: "follower", entryId: existing.id };
    },

    async readReady(key) {
      const entry = entries.get(keyString(key));
      return entry?.status === "ready" ? { content: entry.content, model: entry.model } : null;
    },

    async complete(entryId, leaseToken, content, model, provider) {
      const entry = [...entries.values()].find((e) => e.id === entryId && e.leaseToken === leaseToken && e.status === "pending");
      if (!entry) return false;
      Object.assign(entry, { status: "ready", content, model, provider, leaseUntil: null, errorCode: null, retryAfter: null });
      return true;
    },

    async fail(entryId, leaseToken, errorCode, retryAfter) {
      const entry = [...entries.values()].find((e) => e.id === entryId && e.leaseToken === leaseToken && e.status === "pending");
      if (!entry) return false;
      Object.assign(entry, { status: "failed", errorCode, retryAfter, leaseUntil: null });
      return true;
    },

    async reserve(input: ReserveInput) {
      if (input.billingScope === "learner" && (!input.requestedBy || !input.entitlementKind)) {
        throw new Error("learner reservations need a user and an entitlement kind");
      }
      for (const expired of reservations.filter((r) => r.status === "held" && r.expiresAt < clock)) {
        expired.status = "released";
        const row = budgetRow(expired.day);
        row.reservedUsd = Math.max(row.reservedUsd - expired.reservedUsd, 0);
      }
      const today = day(clock);
      const thisMonth = month(clock);
      const row = budgetRow(today);
      if (row.reservedUsd + row.spentUsd + input.reservedUsd > input.limits.globalUsdPerDay) {
        return { outcome: "budget_exhausted" as const, reservationId: null, resetsAt: nextDay(clock) };
      }
      let outcome: "reserved" | "already_charged" = "reserved";
      const mine = reservations.filter((r) => r.requestedBy === input.requestedBy && used(r));
      if (input.billingScope === "learner" && input.entitlementKind === "free_sentence") {
        const freeToday = mine.filter((r) => r.day === today && r.entitlementKind === "free_sentence");
        if (freeToday.some((r) => r.fingerprint === input.fingerprint)) outcome = "already_charged";
        else if (new Set(freeToday.map((r) => r.fingerprint)).size >= input.limits.freeSentencesPerDay) {
          return { outcome: "quota_exhausted" as const, reservationId: null, resetsAt: nextDay(clock) };
        }
      } else if (input.billingScope === "learner" && input.entitlementKind === "plus_section") {
        const plus = mine.filter((r) => r.entitlementKind === "plus_section");
        if (plus.filter((r) => r.day === today).length >= input.limits.plusMaxSectionsPerDay) {
          return { outcome: "fuse_tripped" as const, reservationId: null, resetsAt: nextDay(clock) };
        }
        const credits =
          charges.filter((c) => c.userId === input.requestedBy && c.month === thisMonth && c.entitlementKind === "plus_section")
            .reduce((sum, c) => sum + c.credits, 0) +
          plus.filter((r) => r.month === thisMonth && r.status === "held").reduce((sum, r) => sum + r.reservedCredits, 0);
        if (credits + input.reservedCredits > input.limits.plusCreditsPerMonth) {
          return { outcome: "credits_exhausted" as const, reservationId: null, resetsAt: nextMonth(clock) };
        }
      }
      const reservation: MemoryReservation = {
        id: randomUUID(), requestedBy: input.requestedBy, billingScope: input.billingScope,
        entitlementKind: input.entitlementKind, fingerprint: input.fingerprint,
        reservedCredits: input.entitlementKind === "plus_section" ? input.reservedCredits : 0,
        reservedUsd: input.reservedUsd, status: "held",
        expiresAt: new Date(clock.getTime() + input.ttlSeconds * 1000), day: today, month: thisMonth,
      };
      reservations.push(reservation);
      row.reservedUsd += input.reservedUsd;
      return { outcome, reservationId: reservation.id, resetsAt: null };
    },

    async recordGeneration(row) {
      const id = randomUUID();
      generations.push({ ...row, id });
      return id;
    },

    async settle(reservationId, generationId, actualCredits, actualUsd) {
      const reservation = close(reservationId, "settled");
      if (!reservation) return false;
      const row = budgetRow(reservation.day);
      row.reservedUsd = Math.max(row.reservedUsd - reservation.reservedUsd, 0);
      row.spentUsd += actualUsd;
      if (reservation.billingScope === "learner" && reservation.requestedBy && reservation.entitlementKind) {
        // The partial unique index: one Free charge per user, day and sentence.
        const duplicate = reservation.entitlementKind === "free_sentence" && charges.some((c) =>
          c.userId === reservation.requestedBy && c.day === reservation.day && c.entitlementKind === "free_sentence" &&
          c.fingerprint === reservation.fingerprint);
        if (!duplicate) {
          charges.push({
            userId: reservation.requestedBy, entitlementKind: reservation.entitlementKind, fingerprint: reservation.fingerprint,
            credits: reservation.entitlementKind === "plus_section" ? Math.max(actualCredits, 0) : 0,
            generationId, reservationId, day: reservation.day, month: reservation.month,
          });
        }
      }
      return true;
    },

    async release(reservationId, spentUsd) {
      const reservation = close(reservationId, "released");
      if (!reservation) return false;
      const row = budgetRow(reservation.day);
      row.reservedUsd = Math.max(row.reservedUsd - reservation.reservedUsd, 0);
      row.spentUsd += spentUsd;
      return true;
    },
  };

  return {
    store,
    entries,
    reservations,
    charges,
    generations,
    now: () => new Date(clock),
    advance: (ms) => { clock = new Date(clock.getTime() + ms); },
    budgetFor: (date) => ({ ...budgetRow(day(date)) }),
  };
}
