"use client";

import { useEffect } from "react";
import { RouteErrorPanel } from "@/components/errors/route-error-panel";

/** Catches descendant segments below this locale layout, never the locale layout itself. */
export default function LocaleRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") console.error(error);
  }, [error]);

  return <RouteErrorPanel mode="standalone" onRetry={reset} />;
}
