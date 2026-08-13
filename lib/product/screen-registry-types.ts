export type ScreenKind = "screen" | "state-variant" | "deprecated" | "repo-only";
export type ScreenImpl = "built" | "placeholder" | "none";
export type ScreenChrome = "app" | "focus" | "immersive" | "admin" | "auth" | "marketing";
export type RepoOnlyReason = "out-of-design-scope" | "legacy-unreviewed";

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
  /** Null only when kind === 'repo-only' (R6). */
  figmaNodeId: string | null;
  /** Required when kind === 'repo-only', null otherwise (R13). */
  repoOnlyReason: RepoOnlyReason | null;
  /** ISO date of the last human Figma↔registry comparison (R7). */
  figmaCheckedAt: string | null;
  /** Next.js route incl. dynamic segments. Null = designed, no route yet (R5). */
  route: string | null;
  chrome: ScreenChrome | null;
  impl: ScreenImpl;
  navGroup: NavGroupId | null;
  navOrder: number | null;
}
