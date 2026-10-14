import { cookies } from "next/headers";
import { AppNav } from "@/components/layout/app-nav";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getNavSummary } from "@/lib/data/nav-summary";
import { NAV_COOKIE, parseNavCookie } from "@/lib/nav/nav-state";
import { NAV_GROUPS } from "@/lib/product/nav-groups";

/**
 * Chrome contract: the nav is mounted, expanded or collapsed to the rail per the learner's `korume_nav` cookie
 * (spec docs/superpowers/specs/2026-10-14-app-chrome-refresh-design.md 3.2). The auth gate lives in `(protected)`;
 * `getCurrentUser` is cached, so reading the user again here is free.
 *
 * `NAV_GROUPS` is read HERE, on the server, and handed to `AppNav` as a prop:
 * `app-nav.tsx` is a client module, so importing the screen registry inside it
 * shipped the whole registry to the browser (final whole-branch review FIX 3 —
 * see `lib/product/nav-groups.ts`).
 */
export default async function AppChromeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, summary] = await Promise.all([getCurrentUser(), getNavSummary()]);
  const collapsed = parseNavCookie(cookies().get(NAV_COOKIE)?.value) ?? false;

  return (
    <div className="flex min-h-screen flex-row text-body">
      <AppNav groups={NAV_GROUPS} userEmail={user?.email ?? ""} initialSummary={summary} mode="app" initialCollapsed={collapsed} />
      {/* `id` + `tabIndex={-1}`: the app footer's back-to-top button moves focus here (app-footer spec F3), so it
          works on a page with no h1. Programmatic focus only — never in the tab order. */}
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">{children}</main>
    </div>
  );
}
