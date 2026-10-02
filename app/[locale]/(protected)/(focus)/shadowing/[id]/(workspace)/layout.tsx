import { Noto_Serif_JP } from "next/font/google";
import { notFound } from "next/navigation";
import { ShadowingWorkspaceShell } from "@/components/shadowing-workspace/workspace-shell";
import { loadWorkspaceBootstrap } from "@/lib/data/shadowing-workspace";
import { redirect } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";

// Reading Settings › Japanese font › Mincho (spec §6.1): loaded by the workspace only, never preloaded — the
// default is Gothic (the app's Noto Sans JP), so most learners never download it.
const notoSerifJp = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-jp-serif",
  display: "swap",
  preload: false,
});

export default async function ShadowingWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: Locale; id: string };
}) {
  const result = await loadWorkspaceBootstrap(params.id);
  if (!result.ok) {
    if (result.status === 401) redirect({ href: "/login", locale: params.locale });
    notFound();
  }

  // `contents`: the wrapper only scopes the font variable; it adds no box to the workspace's layout.
  return (
    <div className={`${notoSerifJp.variable} contents`}>
      <ShadowingWorkspaceShell bootstrap={result.data}>{children}</ShadowingWorkspaceShell>
    </div>
  );
}
