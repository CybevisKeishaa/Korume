import { redirect } from "@/lib/i18n/navigation";
import { AmbientProvider } from "@/components/companion/ambient-provider";
import { PreferencesProvider } from "@/components/providers/preferences-provider";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPublicSupabaseEnv } from "@/lib/env";
import { getLocale } from "@/lib/i18n/server";
import { getMyPreferences } from "@/lib/data/preferences";
import { appearanceScript } from "@/lib/preferences/appearance-script";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";

export const dynamic = "force-dynamic";

/**
 * The authenticated session's lifetime boundary (spec §5.1). It renders no
 * chrome of its own — that is the point. `(app)`, `(focus)` and `(immersive)`
 * are siblings beneath it, so moving between them swaps the chrome layout
 * while THIS layout instance, and the provider inside it, survive.
 *
 * Principle: provider lifetime > layout lifetime. Any future session-scoped
 * owner (AI conversation, study queue, draft journal, mining selection)
 * belongs here for the same reason.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  // Auth is also enforced in middleware; this is defence in depth.
  if (!hasPublicSupabaseEnv()) redirect({ href: "/login", locale });

  const user = await getCurrentUser();
  if (!user) redirect({ href: "/login", locale });

  // Appearance is settled before paint, here rather than in the root layout
  // because only a signed-in request can read the account preference
  // (settings spec §4.5). `readPreferences` never throws, so a failed read
  // renders the defaults instead of the session.
  const preferences = (await getMyPreferences()) ?? DEFAULT_PREFERENCES;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: appearanceScript(preferences) }} />
      <PreferencesProvider initial={preferences}>
        <AmbientProvider>{children}</AmbientProvider>
      </PreferencesProvider>
    </>
  );
}
