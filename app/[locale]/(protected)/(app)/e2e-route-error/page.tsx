import { notFound } from "next/navigation";

// Never prerendered: a build with E2E_ROUTE_ERROR=1 set must not throw.
export const dynamic = "force-dynamic";

/** Inert outside e2e; the route exists solely to exercise the app error boundary. */
export default function E2eRouteErrorPage() {
  if (process.env.E2E_ROUTE_ERROR === "1") throw new Error("E2E route error");
  notFound();
}
