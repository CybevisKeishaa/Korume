export type ScreenKind = "screen" | "state-variant" | "deprecated" | "repo-only";
export type ScreenImpl = "built" | "placeholder" | "none";
export type ScreenChrome = "app" | "focus" | "immersive" | "admin" | "auth" | "marketing";
export type RepoOnlyReason = "out-of-design-scope" | "legacy-unreviewed";

/** Today's five groups. Phase 1b replaces this union with the LOCKED IA's. */
export type NavGroupId = "learn" | "study" | "insights" | "progress" | "account";

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
