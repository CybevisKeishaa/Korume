import { redirect } from "@/lib/i18n/navigation";
import { AppNav } from "@/components/layout/app-nav";
import { AmbientProvider } from "@/components/companion/ambient-provider";
import { hasPublicSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  // Auth is also enforced in middleware; this is defence in depth.
  if (!hasPublicSupabaseEnv()) redirect({ href: "/login", locale });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect({ href: "/login", locale });

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AppNav userEmail={user.email ?? ""} />
      {/* Mounted ONCE, above every (app) surface, so the Companion's state —
          pending contexts, cooldown, machine — survives client-side
          navigation (spec 1 §5.11). It renders nothing on its own: a surface
          without a CompanionAnchor is dormant, and the provider makes no
          network call until an anchor mounts. */}
      <AmbientProvider>
        <main className="flex-1">{children}</main>
      </AmbientProvider>
    </div>
  );
}
