"use client";

import { useState } from "react";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ReduceMotionToggle } from "@/components/ui/reduce-motion-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";
import { deriveNavGroups } from "@/lib/product/nav-derivation";
import { SCREEN_REGISTRY } from "@/lib/product/screen-registry";

/**
 * Derived from the screen registry (R4) — no longer a literal. The registry
 * owns nav membership and order; this file owns presentation.
 *
 * Phase 1a proved this derivation reproduces the previous literal byte-for-byte
 * (T6 vs lib/product/nav-baseline.fixture.ts). Changing navigation means
 * editing the registry, not this file.
 */
export const NAV_GROUPS = deriveNavGroups(SCREEN_REGISTRY);

/** Flat view kept for the catalog-parity test; no production consumer today. */
export const NAV_ITEMS = NAV_GROUPS.map((group) => group.items).flat();

export function AppNav({
  userEmail,
  defaultVisible = true,
}: {
  userEmail: string;
  defaultVisible?: boolean;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  // Not persisted: session-scoped state. It survives client-side navigation
  // WITHIN a chrome group, because AppNav lives in that group's layout —
  // crossing into another group is a chrome change, and resetting to the new
  // group's default is the intended behaviour, not a bug.
  const [visible, setVisible] = useState(defaultVisible);

  return (
    <div className="flex w-full shrink-0 flex-col md:w-auto md:flex-row">
      {visible ? (
        <nav
          aria-label={t("ariaLabel")}
          className="flex w-full flex-col gap-1 border-b border-border bg-card p-4 md:h-screen md:w-60 md:border-b-0 md:border-r"
        >
          <div className="mb-4 flex items-center justify-between gap-2 px-2">
            <Link href="/dashboard" className="font-jp text-lg font-bold">
              {tCommon("appNameJp")}
            </Link>
            <NotificationBell />
          </div>

          <div data-nav-scroll className="flex-1 overflow-y-auto">
            {NAV_GROUPS.map((group) => (
              <div key={group.key} className="mb-2">
                <p
                  id={`app-nav-group-${group.key}`}
                  className="hidden px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:block"
                >
                  {t(`groups.${group.key}`)}
                </p>
                <ul
                  aria-labelledby={`app-nav-group-${group.key}`}
                  className="flex flex-wrap gap-1 md:flex-col md:flex-nowrap"
                >
                  {group.items.map((item) => {
                    const active =
                      pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                            active
                              ? "bg-primary/10 text-primary-strong"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                          )}
                        >
                          {/* item.key was a 22-literal union while NAV_GROUPS
                              was a `const` literal; deriving it from the
                              registry widens the type to `string` (R4). Same
                              cast precedent as journal-view.tsx. Catalog-key
                              coverage is enforced at runtime by
                              app-nav.test.tsx's "pinned label for every nav
                              destination" and "catalog's destination key set"
                              tests. */}
                          {t(item.key as Parameters<typeof t>[0])}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <p className="truncate px-1 text-xs text-muted-foreground" title={userEmail}>
              {userEmail}
            </p>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {tCommon("auth.signOut")}
              </button>
            </form>
          </div>
        </nav>
      ) : null}
      {/*
        Deliberately OUTSIDE the `visible` conditional above (final
        whole-branch review F1, 2026-08-07): this is the only edge-chrome
        rail (button + reduce-motion control) `(focus)` routes render when
        `defaultVisible={false}`, and CLAUDE.md §2 rule 4 requires the
        reduce-motion control to be globally reachable — including on
        Shadowing/Dictation, the app's heaviest repeated study loops. A plain
        <div>, not a second <nav>: `route-group-provider-identity.spec.ts`
        asserts `getByRole("navigation")` stays at 0 on chrome-less surfaces,
        and this rail must not become a second landmark on `(app)` either.

        `md:w-6` is restored here (NB-1, 2026-08-07, final whole-branch
        review round 2): `(focus)` exists precisely so navigation recedes to
        a narrow strip during focused study, and the first F1 pass widened
        this rail to ~130px by rendering `ReduceMotionToggle`'s caption
        on-screen. `compact` keeps the control mounted and reachable (still
        the point of F1) without re-widening the rail — see
        `reduce-motion-toggle.tsx`.
      */}
      <div className="flex flex-col items-center gap-2 border-b border-border bg-card py-2 md:h-screen md:w-6 md:border-b-0 md:border-r md:py-3">
        <button
          type="button"
          aria-expanded={visible}
          onClick={() => setVisible((current) => !current)}
          className="flex items-center justify-center rounded py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <span aria-hidden="true">{visible ? "‹" : "›"}</span>
          <span className="sr-only">
            {visible ? t("toggle.hide") : t("toggle.show")}
          </span>
        </button>
        <div className="border-t border-border pt-2 text-muted-foreground">
          <ReduceMotionToggle compact />
        </div>
      </div>
    </div>
  );
}
