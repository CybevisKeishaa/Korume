import type { ContentVariant, PlanTier, SectionAccess } from "./types";

/**
 * Which variant this learner reads (spec §5.4). `project: true` means the full entry is read on the server
 * and only its deterministic preview projection leaves it — Free never receives a full payload.
 */
export function variantFor(
  tier: PlanTier,
  access: SectionAccess,
  fullCached: boolean,
): { variant: ContentVariant; project: boolean } {
  if (tier === "plus" || access !== "free_preview") return { variant: "full", project: false };
  return fullCached ? { variant: "full", project: true } : { variant: "preview", project: false };
}
