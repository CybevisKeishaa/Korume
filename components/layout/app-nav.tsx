"use client";

import { useState } from "react";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ReduceMotionToggle } from "@/components/ui/reduce-motion-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";

/**
 * href → nav catalog key, in the 5-group structure from
 * `docs/design/screens/navigation-system.md` § Navigation Inventory. Keys,
 * not labels: the words live in messages/. Group `key` doubles as the
 * heading catalog key (`nav.groups.*`).
 *
 * Only the 14 SHIPPED destinations are wired. The 8 canonical-but-unbuilt
 * rows (review, challenges, korume, roadmap, weeklyReport, statistics,
 * achievements, settings) have no route yet and get no entry — a group
 * gains its rows (and INSIGHTS appears at all) only when a destination
 * ships. NOTE: `lessons` points at `/videos`, the shipped Shadowing Hub
 * route; the doc-canonical `/shadowing` path is a route rename deferred to
 * the Hub UI plan (see app-nav.test.tsx's "route rename deferred" pin).
 */
export const NAV_GROUPS = [
  {
    key: "learn",
    items: [
      { href: "/dashboard", key: "dashboard" },
      { href: "/videos", key: "lessons" },
      { href: "/kanji", key: "kanji" },
      { href: "/vocab", key: "vocab" },
      { href: "/grammar", key: "grammar" },
      { href: "/reading", key: "reading" },
      { href: "/conversation", key: "speaking" },
      { href: "/jlpt", key: "jlpt" },
    ],
  },
  {
    key: "study",
    items: [
      { href: "/mining", key: "mining" },
      { href: "/playlists", key: "playlists" },
      { href: "/community", key: "community" },
      { href: "/leaderboard", key: "leaderboard" },
    ],
  },
  {
    key: "progress",
    items: [{ href: "/journal", key: "journey" }],
  },
  {
    key: "account",
    items: [{ href: "/profile", key: "profile" }],
  },
] as const;

/** Flat view kept for the catalog-parity test; no production consumer today. */
export const NAV_ITEMS = NAV_GROUPS.map((group) => group.items).flat();

export function AppNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  // Visible by default everywhere the (app) shell renders — the toggle is a
  // new optional affordance, not a change to default visibility
  // (navigation-system.md § Navigation Inventory; 2026-08-05 spec §2.2).
  // The Lesson Workspace's hidden-by-default mandate
  // (screen-shadowing-practice.md § Sidebar) applies to the /shadowing/[id]
  // route group, which does not exist yet — wiring that default is the job
  // of the plan that builds it, not this component's. Deliberately not
  // persisted: session-scoped state, survives client-side navigation
  // because AppNav lives in the (app) layout.
  const [visible, setVisible] = useState(true);

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

          <div className="flex-1 md:overflow-y-auto">
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
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          {t(item.key)}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-end">
              <ReduceMotionToggle />
            </div>
            <p className="truncate px-1 text-xs text-muted-foreground" title={userEmail}>
              {userEmail}
            </p>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {tCommon("auth.signOut")}
              </button>
            </form>
          </div>
        </nav>
      ) : null}
      <button
        type="button"
        aria-expanded={visible}
        onClick={() => setVisible((current) => !current)}
        className="flex items-center justify-center border-b border-border bg-card py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:h-screen md:w-6 md:border-b-0 md:border-r md:py-0"
      >
        <span aria-hidden="true">{visible ? "‹" : "›"}</span>
        <span className="sr-only">
          {visible ? t("toggle.hide") : t("toggle.show")}
        </span>
      </button>
    </div>
  );
}
