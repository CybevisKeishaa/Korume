"use client";

import { useContext, useEffect, useRef } from "react";
import type { ExperienceContext } from "@/lib/companion/presence/contexts";
import { CompanionAnchorContext, useCompanion } from "./use-companion";
import { CompanionSprite, type CompanionPose } from "./companion-sprite";
import { SpeechBubble } from "./speech-bubble";

export interface CompanionAnchorProps {
  /** Stable surface id — used for nothing but debugging today; the contract
   * (spec 1 §5.2) is that the SURFACE declares where the creature stands. */
  surface: string;
  pose: CompanionPose;
  /** Optional experience context announced once on mount — the surface says
   * WHAT HAPPENED, never what to say (spec 1 §5.12). */
  context?: ExperienceContext;
}

/**
 * The slot a surface renders to invite the Companion (spec 1 §5.2). No
 * anchor on a surface = the Companion is dormant there — it never creates
 * its own anchor.
 *
 * Which files may import this module is enforced structurally by
 * `anchor-boundary.test.ts` (§5.4): the Companion cannot appear inside a
 * learning loop.
 */
export function CompanionAnchor({ surface, pose, context }: CompanionAnchorProps) {
  const registration = useContext(CompanionAnchorContext);
  const companion = useCompanion();
  const emittedRef = useRef(false);

  // Depend on the registration FUNCTION, not the whole context value: the
  // value's identity changes on every speech change, which would unregister
  // and re-register this anchor on each address.
  const registerAnchor = registration?.registerAnchor;
  useEffect(() => {
    if (!registerAnchor) return;
    return registerAnchor();
  }, [registerAnchor]);

  useEffect(() => {
    if (context && !emittedRef.current) {
      emittedRef.current = true;
      companion.emitContext(context);
    }
  }, [context, companion]);

  if (!registration) return null;
  const { speechKey, dismiss } = registration.rendered;

  return (
    // No `gap` here: SpeechBubble owns its own inline offset, so the always-
    // mounted-but-silent live region contributes no phantom spacing.
    <div className="flex items-end" data-companion-surface={surface}>
      <CompanionSprite pose={pose} onActivate={companion.openJournal} />
      {/* Rendered unconditionally — see SpeechBubble: the live region has to
          outlive the address for a screen reader to announce it at all. */}
      <SpeechBubble speechKey={speechKey} onDismiss={dismiss} />
    </div>
  );
}
