"use client";

// eslint-disable-next-line no-restricted-imports -- This leaf must read Next's raw pathname.
import { usePathname } from "next/navigation";

export function RequestedPath({ label }: { label: string }) {
  const pathname = usePathname();

  return (
    <p className="text-body text-muted-foreground">
      {label} <code className="text-foreground">{pathname}</code>
    </p>
  );
}
