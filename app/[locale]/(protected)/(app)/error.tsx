"use client";

import { useEffect } from "react";
import { RouteErrorPanel } from "@/components/errors/route-error-panel";

/** Client boundary adapter: no layout or density, so the live app shell stays. */
export default function AppRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") console.error(error);
  }, [error]);

  return <RouteErrorPanel mode="in-shell" onRetry={reset} />;
}
