"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { relationshipPhaseForXp, type RelationshipPhase } from "@/lib/companion";
import { transition, type CompanionState } from "@/lib/companion/presence/state-machine";
import {
  prunePending,
  resolve,
  type CooldownState,
  type PendingContext,
} from "@/lib/companion/presence/arbitration";
import { speechKeyFor, type CompanionSpeechKey } from "@/lib/companion/presence/speech";
import { SPEECH_AUTO_FADE_MS } from "@/lib/companion/presence/config";
import type { ExperienceContext } from "@/lib/companion/presence/contexts";
import {
  CompanionAnchorContext,
  CompanionContext,
  type CompanionAnchorRegistration,
  type CompanionApi,
} from "./use-companion";

/**
 * The Ambient Layer (spec 1 §5.1): owns the creature's existence and state;
 * surfaces only declare where it stands (CompanionAnchor). Mounted once in
 * the (protected) layout, above the chrome groups, so state — pending
 * contexts, cooldown, machine — persists across client-side navigation and
 * across a chrome boundary (§5.11). Dialogue is ephemeral by
 * design: a full reload clears pending contexts; only recorded memories are
 * canon (§6.2).
 *
 * Every decision about WHETHER and WHAT to speak lives in the pure core
 * (`lib/companion/presence/*`). This file is wiring: it holds the mutable
 * edges (pending list, cooldown clock, timers, the phase read) and feeds them
 * to `resolve` / `transition` / `speechKeyFor`. Nothing here is random.
 */
export function AmbientProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [machine, setMachine] = useState<CompanionState>("idle");
  const [phase, setPhase] = useState<RelationshipPhase | null>(null);
  const [speechKey, setSpeechKey] = useState<CompanionSpeechKey | null>(null);
  const [anchorCount, setAnchorCount] = useState(0);
  const pendingRef = useRef<PendingContext[]>([]);
  const cooldownRef = useRef<CooldownState>({ lastAddressAt: null });
  const phaseRequestedRef = useRef(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    setSpeechKey(null);
    setMachine((s) => transition(transition(s, { type: "speech_dismissed" }), { type: "settled" }));
  }, []);

  const runArbitration = useCallback(() => {
    // No anchor = the Companion is not present on this surface at all, so
    // there is nothing to arbitrate and no state to move (§5.4). An address
    // already on screen holds the floor until it is dismissed.
    if (anchorCount === 0 || speechKey !== null) return;

    const now = Date.now();
    const live = prunePending(pendingRef.current, now);
    pendingRef.current = live;
    if (live.length === 0) return;

    const resolution = resolve(live, cooldownRef.current, now);
    if (resolution.kind === "address") {
      const key = speechKeyFor(resolution.context, phase ?? 1);
      pendingRef.current = live.filter((p) => p.context !== resolution.context);
      cooldownRef.current = { lastAddressAt: now };
      setSpeechKey(key);
      // `context_arrived` is replayed here rather than assumed: a context
      // emitted while the surface was dormant never moved the machine (see
      // `emitContext`), so `idle` — not `observing` — is the state an
      // anchor-arrival arbitration starts from. On the emit-with-anchor path
      // the machine is already `observing` and this transition is a no-op.
      setMachine((s) =>
        transition(transition(s, { type: "context_arrived" }), {
          type: "address_granted",
          speechKey: key,
        }),
      );
      fadeTimerRef.current = setTimeout(dismiss, SPEECH_AUTO_FADE_MS);
    } else {
      setMachine((s) =>
        transition(
          transition(transition(s, { type: "context_arrived" }), { type: "address_denied" }),
          { type: "settled" },
        ),
      );
    }
  }, [anchorCount, speechKey, phase, dismiss]);

  const emitContext = useCallback(
    (context: ExperienceContext) => {
      // Always remembered: a dormant surface's context is not lost, it simply
      // has no one to deliver it — a later anchor arbitrates it if it is still
      // inside CONTEXT_TTL_MS.
      pendingRef.current = [...pendingRef.current, { context, emittedAt: Date.now() }];
      // But the MACHINE only moves when the creature is actually present.
      // Dispatching `context_arrived` with zero anchors would park it in
      // `observing` permanently: arbitration — the only thing that moves it
      // back out — early-returns while `anchorCount === 0`.
      if (anchorCount > 0) {
        setMachine((s) => transition(s, { type: "context_arrived" }));
        runArbitration();
      }
    },
    [anchorCount, runArbitration],
  );

  // Anchors register on mount; the first one triggers the one-time phase read.
  const registerAnchor = useCallback(() => {
    setAnchorCount((n) => n + 1);
    return () => setAnchorCount((n) => n - 1);
  }, []);

  useEffect(() => {
    if (anchorCount === 0 || phaseRequestedRef.current) return;
    phaseRequestedRef.current = true;
    void fetch("/api/user/stats")
      .then(async (res) => (res.ok ? ((await res.json()) as { data?: { xp?: number } }) : null))
      .then((body) => {
        if (body?.data?.xp != null) setPhase(relationshipPhaseForXp(body.data.xp));
      })
      .catch((err: unknown) => {
        // Presence needs no data — the Companion is simply quieter (§6.5).
        // No error UI, ever: a stats outage must not make the creature vanish.
        console.error("[companion] phase fetch failed:", err);
      });
  }, [anchorCount]);

  // A surface with an anchor may have pending contexts waiting from a
  // dormant surface — arbitrate when an anchor arrives.
  useEffect(() => {
    runArbitration();
  }, [runArbitration]);

  // A provider unmount mid-address must not leave a timer pointing at a
  // dead setState.
  useEffect(
    () => () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    },
    [],
  );

  const api = useMemo<CompanionApi>(
    () => ({
      getCurrentState: () => ({ state: machine, phase }),
      emitContext,
      openJournal: () => router.push("/journal"),
      requestReflection: async () => ({ available: false }),
    }),
    [machine, phase, emitContext, router],
  );

  const anchorValue = useMemo<CompanionAnchorRegistration>(
    () => ({ registerAnchor, rendered: { speechKey, phase, dismiss } }),
    [registerAnchor, speechKey, phase, dismiss],
  );

  return (
    <CompanionContext.Provider value={api}>
      <CompanionAnchorContext.Provider value={anchorValue}>{children}</CompanionAnchorContext.Provider>
    </CompanionContext.Provider>
  );
}
