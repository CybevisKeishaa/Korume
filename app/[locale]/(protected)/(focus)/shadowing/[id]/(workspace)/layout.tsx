import { notFound } from "next/navigation";
import { ShadowingWorkspaceShell } from "@/components/shadowing-workspace/workspace-shell";
import { loadWorkspaceBootstrap } from "@/lib/data/shadowing-workspace";
import { redirect } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";

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

  return <ShadowingWorkspaceShell bootstrap={result.data}>{children}</ShadowingWorkspaceShell>;
}
