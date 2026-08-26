export type ScreenKind =
  | "screen"
  | "state-variant"
  | "deprecated"
  | "repo-only"
  | "spec-only"; // Phase 3: required by Spec/Register; no frame, no implementation
export type ScreenImpl = "built" | "placeholder" | "none";
export type ScreenChrome = "app" | "focus" | "immersive" | "admin" | "auth" | "marketing";
export type RepoOnlyReason = "out-of-design-scope" | "no-frame-at-last-pass";

/**
 * The LOCKED IA's five groups — `decision-register.md` A1, applied in Phase 1b.
 * (Phase 1a shipped today's `learn | study | insights | progress | account`.)
 *
 * Group *order* is deliberately not expressed here: it is IA, not data, and
 * lives in `nav-derivation.ts`'s `GROUP_ORDER`, which carries a compile-time
 * check that every member of this union appears there.
 */
export type NavGroupId =
  | "learn"
  | "practice"
  | "remember"
  | "journey"
  | "account";

export interface ScreenEntry {
  /** Stable product identity (R3). kebab-case. The join key for every other artifact. */
  screenId: string;
  /** The Figma frame name, for humans. Display only — never a key (R3). */
  name: string;
  kind: ScreenKind;
  /** Required when kind === 'state-variant', null otherwise (R11). */
  variantOf: string | null;
  /** Null when kind === 'repo-only' (R6) or kind === 'spec-only' (T3). */
  figmaNodeId: string | null;
  /** Required when kind === 'repo-only', null otherwise (R13). */
  repoOnlyReason: RepoOnlyReason | null;
  /** ISO date of the last human Figma↔registry comparison (R7). */
  figmaCheckedAt: string | null;
  /**
   * Next.js route incl. dynamic segments. Null = no route yet (R5) — either
   * designed but unbuilt, or (kind === 'spec-only') not yet designed at all.
   */
  route: string | null;
  chrome: ScreenChrome | null;
  impl: ScreenImpl;
  navGroup: NavGroupId | null;
  navOrder: number | null;
  /** Required when kind === 'spec-only', null otherwise (T13). A citation to
   *  where the requirement is written (japanese-learning-app-spec.md or
   *  decision-register.md) — never a ruling, never appearance/behaviour. */
  specRef: string | null;
}
