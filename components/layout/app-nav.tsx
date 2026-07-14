"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ReduceMotionToggle } from "@/components/ui/reduce-motion-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/kanji", label: "Kanji" },
  { href: "/vocab", label: "Vocab" },
  { href: "/grammar", label: "Grammar" },
  { href: "/videos", label: "Videos" },
  { href: "/mining", label: "Mining" },
  { href: "/reading", label: "Reading" },
  { href: "/conversation", label: "Conversation" },
  { href: "/jlpt", label: "JLPT" },
  { href: "/community", label: "Community" },
  { href: "/playlists", label: "Playlists" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/profile", label: "Profile" },
] as const;

export function AppNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="flex w-full shrink-0 flex-col gap-1 border-b border-border bg-card p-4 md:h-screen md:w-60 md:border-b-0 md:border-r"
    >
      <div className="mb-4 flex items-center justify-between gap-2 px-2">
        <Link href="/dashboard" className="font-jp text-lg font-bold">
          日本語シネマ
        </Link>
        <NotificationBell />
      </div>

      <ul className="flex flex-1 flex-wrap gap-1 md:flex-col md:flex-nowrap">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 space-y-3 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <ThemeToggle />
          <ReduceMotionToggle />
        </div>
        <p className="truncate px-1 text-xs text-muted-foreground" title={userEmail}>
          {userEmail}
        </p>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}
