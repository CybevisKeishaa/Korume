import { describe, expect, it } from "vitest";
import enNav from "./en/nav.json";
import enUpcoming from "./en/upcoming.json";
import viNav from "./vi/nav.json";
import viUpcoming from "./vi/upcoming.json";

/**
 * A15's invariant, made self-enforcing: a destination has ONE name, not two.
 *
 * A15 (user ruling, 2026-08-13) is stated as "`/companion`'s own page title
 * matches the nav row, so the destination has one name rather than two". Half
 * of that was pinned by hand and half was not: `messages/en/upcoming.pin.test.ts`
 * pins the EN title, `messages/vi/nav.pin.test.ts` pins the VI nav label, and
 * nothing tied the two together — so reverting `messages/vi/upcoming.json`'s
 * title alone left the suite green while shipping exactly the two-names-for-one-
 * character defect A15 exists to prevent. This asserts the RELATIONSHIP, which
 * neither pin can, and it holds in every locale rather than only in EN.
 *
 * ⚠️ SCOPED ON PURPOSE — do NOT generalise this to every nav row. `/roadmap`
 * is the standing counter-example: A8 moved the "Journey" label onto its nav
 * row while its page keeps the title "Roadmap". The guard at the bottom of this
 * file asserts that divergence, so a future pass that "helpfully" widens the
 * rule turns red instead of silently flattening a locked IA decision.
 */

type Catalog = Record<string, unknown>;

/** Not a cast: JSON imports type `groups` as an object, so the string-ness of
 *  a given key has to be checked rather than assumed. Throwing (instead of
 *  returning undefined) means a renamed key fails loudly here, not as an
 *  `undefined === undefined` pass. */
function navLabel(catalog: Catalog, key: string): string {
  const value = catalog[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`nav.json has no non-empty string at "${key}"`);
  }
  return value;
}

function upcomingTitle(catalog: Catalog, key: string): string {
  const entry = catalog[key];
  if (typeof entry !== "object" || entry === null) {
    throw new Error(`upcoming.json has no object at "${key}"`);
  }
  const title = (entry as { title?: unknown }).title;
  if (typeof title !== "string" || title.length === 0) {
    throw new Error(`upcoming.${key}.title is not a non-empty string`);
  }
  return title;
}

const LOCALES: ReadonlyArray<{
  locale: string;
  nav: Catalog;
  upcoming: Catalog;
}> = [
  { locale: "en", nav: enNav, upcoming: enUpcoming },
  { locale: "vi", nav: viNav, upcoming: viUpcoming },
];

/**
 * Nav row ⇒ placeholder page, for the screens whose two names are bound by a
 * ruling. The keys differ by design: nav keys are `screenId`s (R9), while the
 * `upcoming` namespace is keyed by the page that consumes it.
 */
const ONE_NAME_SCREENS: ReadonlyArray<{
  navKey: string;
  upcomingKey: string;
  ruling: string;
}> = [
  { navKey: "companion-home", upcomingKey: "companion", ruling: "A15" },
  { navKey: "pronunciation-library", upcomingKey: "pronunciation", ruling: "A6" },
];

describe("destination name parity — nav row and page title agree", () => {
  // CLAUDE.md §7: both collections below are iterated, so an empty one would
  // make every assertion vacuously true. Assert their size first.
  it("covers both locales and both bound screens", () => {
    expect(LOCALES).toHaveLength(2);
    expect(LOCALES.map((l) => l.locale)).toEqual(["en", "vi"]);
    expect(ONE_NAME_SCREENS).toHaveLength(2);
  });

  for (const { locale, nav, upcoming } of LOCALES) {
    for (const { navKey, upcomingKey, ruling } of ONE_NAME_SCREENS) {
      it(`${locale}: ${navKey} nav label === ${upcomingKey} page title (${ruling})`, () => {
        expect(upcomingTitle(upcoming, upcomingKey)).toBe(
          navLabel(nav, navKey),
        );
      });
    }
  }

  // The counter-example, asserted so the rule above cannot be widened by
  // accident. A8 deliberately gives /roadmap a nav label ("Journey" / "Hành
  // trình") that differs from its page title ("Roadmap" / "Lộ trình").
  for (const { locale, nav, upcoming } of LOCALES) {
    it(`${locale}: /roadmap deliberately does NOT match (A8)`, () => {
      expect(upcomingTitle(upcoming, "roadmap")).not.toBe(
        navLabel(nav, "roadmap"),
      );
    });
  }
});
