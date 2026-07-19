/// <reference types="vite/client" />
import { NAMESPACES } from "@/lib/i18n/namespaces";

/**
 * The EN catalogs, merged exactly as `getMessages()` merges them at runtime.
 *
 * `import.meta.glob` is a Vite feature (Vitest runs on Vite), so a namespace
 * added under `messages/en/` is picked up with zero churn here — which is what
 * keeps "adding a feature requires no foundation change" true (spec 5.1 #4)
 * on the test side too.
 *
 * Why real messages rather than `{}`: the regression suite asserts on English
 * user-visible text (spec D6). Serving the real EN catalog is what makes an
 * extracted component render byte-identically to the hardcoded one it
 * replaced, so those assertions keep passing through the refactor.
 */
const modules = import.meta.glob<{ default: Record<string, unknown> }>(
  "../messages/en/*.json",
  { eager: true },
);

export function loadEnMessages(): Record<string, unknown> {
  const byNamespace = Object.fromEntries(
    Object.entries(modules).map(([path, mod]) => [
      path.replace(/^.*\/(.+)\.json$/, "$1"),
      mod.default,
    ]),
  );
  // Return only DECLARED namespaces so an orphaned JSON file on disk cannot
  // silently start serving messages (catalog.test.ts owns that invariant).
  return Object.fromEntries(
    NAMESPACES.map((namespace) => [namespace, byNamespace[namespace]]),
  );
}
