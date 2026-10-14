import { AppNav } from "@/components/layout/app-nav";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getNavSummary } from "@/lib/data/nav-summary";
import { NAV_GROUPS } from "@/lib/product/nav-groups";

/**
 * Chrome contract: nav mounted as the icon rail. This is what separates
 * (focus) from (immersive) — the learner in a workspace can still reach the
 * rest of the product, it just recedes while they work
 * (screen-shadowing-practice.md § Sidebar). The rail starts collapsed on every
 * visit and never reads or writes the `korume_nav` cookie (spec 3.2), so a
 * study session cannot change the learner's (app) preference.
 *
 * Same server-side `NAV_GROUPS` read as `(app)/layout.tsx` — see the note
 * there and `lib/product/nav-groups.ts`.
 */
export default async function FocusChromeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, summary] = await Promise.all([getCurrentUser(), getNavSummary()]);

  return (
    <div className="flex min-h-screen flex-col text-body md:flex-row">
      <AppNav groups={NAV_GROUPS} userEmail={user?.email ?? ""} initialSummary={summary} mode="focus" initialCollapsed />
      <main className="flex-1">{children}</main>
    </div>
  );
}
