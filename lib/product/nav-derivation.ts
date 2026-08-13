import type { NavGroupId, ScreenEntry } from "./screen-registry-types";

/** Group order is IA, not data — the registry stores membership and order
 *  within a group, never the order OF groups. Phase 1b replaced today's
 *  `learn/study/insights/progress/account` with the LOCKED IA's five
 *  (`ia-proposal.md` §2, `decision-register.md` A1). */
const GROUP_ORDER = [
  "learn",
  "practice",
  "remember",
  "journey",
  "account",
] as const satisfies readonly NavGroupId[];

/**
 * Compile-time exhaustiveness (final review FIX 4). `satisfies` above proves
 * every member of GROUP_ORDER is a real `NavGroupId`; this proves the other
 * direction — that every `NavGroupId` appears in GROUP_ORDER. Without it, a
 * group id added to the union in `screen-registry-types.ts` but forgotten
 * here would silently drop every entry in that group from the sidebar, with
 * no test and no type error. Phase 1b replaces both lists at once, which is
 * exactly when a half-done edit is most likely.
 *
 * A `NavGroupId` missing from GROUP_ORDER makes `Exclude<…>` non-`never`, and
 * the alias below stops satisfying its own constraint — a `tsc` error.
 */
type AssertNever<T extends never> = T;
type GroupOrderCoversEveryNavGroup = AssertNever<
  Exclude<NavGroupId, (typeof GROUP_ORDER)[number]>
>;
export type { GroupOrderCoversEveryNavGroup };

export type NavGroup = {
  key: NavGroupId;
  items: { href: string; key: string }[];
};

/**
 * Registry → the shape `app-nav.tsx` renders (R4). The registry owns nav
 * membership and order; `app-nav.tsx` keeps presentation (label key lookup,
 * icons, active state).
 *
 * `key` is the screenId: R9 makes them the same string for every nav
 * destination. In Phase 1a that meant the refactor landed without touching a
 * message catalog; Phase 1b DOES edit the catalog, because A7 and A8 are label
 * rulings and two new destinations arrived — but the key↔screenId identity is
 * unchanged, and it is what keeps the catalog honest.
 *
 * ⚠️ A screenId is identity, never a label, and it is not renamed to make a
 * catalog key read nicely. Both directions of that have shipped on purpose:
 * `weeklyReport` is camelCase where R3 asks for kebab-case (1a adopted the
 * existing catalog key rather than edit a catalog), and `pronunciation-library`
 * / `companion-home` are screenIds serving as keys behind the labels
 * "Pronunciation" / "Companion" (1b kept the Figma join rather than prettify).
 */
export function deriveNavGroups(registry: readonly ScreenEntry[]): NavGroup[] {
  // Final review FIX 1. This used to be `&& entry.route !== null` inside the
  // filter below, which SILENTLY dropped the row: a sidebar destination
  // disappearing without a word, in a branch whose whole acceptance criterion
  // is zero visual diff. `navGroup` set with `route: null` is not a state to
  // tolerate — it means "put this in the sidebar" and "there is nowhere to go"
  // at once, and Phase 1b adds designed-before-built screens where exactly
  // that mistake is one keystroke away. Fail loudly instead.
  const routeless = registry.filter(
    (entry) => entry.navGroup !== null && entry.route === null,
  );
  if (routeless.length > 0) {
    throw new Error(
      "deriveNavGroups: nav entries have no route to point at: " +
        `${routeless.map((entry) => entry.screenId).join(", ")}. ` +
        "A screen in a nav group must have a route (give it one, or set " +
        "navGroup/navOrder to null until it has one).",
    );
  }

  return GROUP_ORDER.map((key) => ({
    key,
    items: registry
      .filter((entry) => entry.navGroup === key)
      .sort((a, b) => (a.navOrder as number) - (b.navOrder as number))
      .map((entry) => ({ href: entry.route as string, key: entry.screenId })),
  }));
}
