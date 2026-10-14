import { AppNav } from "@/components/layout/app-nav";
import { getCurrentUser } from "@/lib/auth/current-user";
import { NAV_GROUPS } from "@/lib/product/nav-groups";

/**
 * Chrome contract: nav visible. The auth gate lives in `(protected)`;
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
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-row text-body">
      <AppNav userEmail={user?.email ?? ""} groups={NAV_GROUPS} />
      {/* `id` + `tabIndex={-1}`: the app footer's back-to-top button moves focus here (app-footer spec F3), so it
          works on a page with no h1. Programmatic focus only — never in the tab order. */}
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">{children}</main>
    </div>
  );
}
