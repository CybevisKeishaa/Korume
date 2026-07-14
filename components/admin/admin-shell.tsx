"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/videos", label: "Video queue" },
  { href: "/admin/content", label: "Content" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Admin shell — a separate, minimal nav distinct from the learner `AppNav`
 * (task brief: not the cinematic surface, and not the learner's app-nav
 * component, which this agent must not touch). Plain CSS, no motion.
 */
export function AdminShell({ userEmail, children }: { userEmail: string; children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <nav aria-label="Admin" className="shrink-0 border-b border-border bg-card md:w-56 md:border-b-0 md:border-r">
        <div className="p-4">
          <p className="text-sm font-semibold">Nihongo Cinema</p>
          <p className="text-xs text-muted-foreground">Admin CMS</p>
        </div>
        <ul className="space-y-1 px-2 pb-4">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm font-medium",
                  isActive(pathname, item.href)
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted",
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="border-t border-border p-4 text-xs text-muted-foreground">
          <p className="truncate">{userEmail}</p>
          <Link href="/dashboard" className="mt-1 inline-block underline hover:no-underline">
            Back to app
          </Link>
        </div>
      </nav>
      <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
