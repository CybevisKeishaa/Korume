import type { NavGroupId, ScreenEntry } from "./screen-registry-types";

/** Group order is IA, not data — the registry stores membership and order
 *  within a group, never the order OF groups. Phase 1b edits this array when
 *  the LOCKED IA's five groups replace today's. */
const GROUP_ORDER: readonly NavGroupId[] = [
  "learn",
  "study",
  "insights",
  "progress",
  "account",
];

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
 * destination, which is what lets this land without touching a message
 * catalog.
 *
 * ⚠️ `weeklyReport` is camelCase while every other nav key is a single
 * lowercase word. R9 requires adopting the existing key, so its `screenId`
 * in the registry is `weeklyReport` — not `weekly-report` — even though R3
 * says kebab-case. This is the one deliberate exception; changing it would
 * need a message-catalog edit, which R9 forbids in Phase 1.
 */
export function deriveNavGroups(registry: readonly ScreenEntry[]): NavGroup[] {
  return GROUP_ORDER.map((key) => ({
    key,
    items: registry
      .filter((entry) => entry.navGroup === key && entry.route !== null)
      .sort((a, b) => (a.navOrder as number) - (b.navOrder as number))
      .map((entry) => ({ href: entry.route as string, key: entry.screenId })),
  }));
}
