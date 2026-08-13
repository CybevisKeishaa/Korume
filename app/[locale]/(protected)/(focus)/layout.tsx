import { AppNav } from "@/components/layout/app-nav";
import { getCurrentUser } from "@/lib/auth/current-user";
import { NAV_GROUPS } from "@/lib/product/nav-groups";

/**
 * Chrome contract: nav mounted, hidden by default. This is what separates
 * (focus) from (immersive) — the learner in a workspace can still reach the
 * rest of the product, they just are not shown it while working
 * (screen-shadowing-practice.md § Sidebar).
 *
 * "Hidden" is not "Collapsed / Icon rail" (navigation-system.md § Navigation
 * States) — that state remains planned and unbuilt. Do not conflate them.
 *
 * Same server-side `NAV_GROUPS` read as `(app)/layout.tsx` — see the note
 * there and `lib/product/nav-groups.ts`.
 */
export default async function FocusChromeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AppNav
        userEmail={user?.email ?? ""}
        groups={NAV_GROUPS}
        defaultVisible={false}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
