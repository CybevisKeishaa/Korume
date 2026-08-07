import { AppNav } from "@/components/layout/app-nav";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Chrome contract: nav mounted, hidden by default. This is what separates
 * (focus) from (immersive) — the learner in a workspace can still reach the
 * rest of the product, they just are not shown it while working
 * (screen-shadowing-practice.md § Sidebar).
 *
 * "Hidden" is not "Collapsed / Icon rail" (navigation-system.md § Navigation
 * States) — that state remains planned and unbuilt. Do not conflate them.
 */
export default async function FocusChromeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AppNav userEmail={user?.email ?? ""} defaultVisible={false} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
