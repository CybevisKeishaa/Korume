import { AppNav } from "@/components/layout/app-nav";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Chrome contract: nav visible. The auth gate lives in `(protected)`;
 * `getCurrentUser` is cached, so reading the user again here is free.
 */
export default async function AppChromeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AppNav userEmail={user?.email ?? ""} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
