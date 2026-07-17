"use client";

import { Link } from "@/lib/i18n/navigation";
import { usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/community", label: "Forum" },
  { href: "/community/peer-review", label: "Peer review" },
] as const;

/** Section-level tab strip inside the community area (Forum vs. Peer review). */
export function CommunityTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Community sections" className="flex gap-2 border-b border-border">
      {TABS.map((tab) => {
        const active = tab.href === "/community" ? pathname === "/community" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
