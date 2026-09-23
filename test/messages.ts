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

/**
 * The VI catalogs, loaded the same way.
 *
 * `routing.defaultLocale` is `"vi"` — the catalog this product's primary
 * audience actually reads. Almost every component test asserts English text
 * (spec D6) and should keep doing so; this exists for the narrow case where
 * the behaviour under test is *locale-dependent* and an EN-only render
 * cannot see it at all. `MemoryEraseForm` is the first: the word a user types
 * to confirm is translated while the word sent to the server is not, and
 * under `en` those two strings are identical, so an EN render proves nothing
 * about the distinction.
 */
const viModules = import.meta.glob<{ default: Record<string, unknown> }>(
  "../messages/vi/*.json",
  { eager: true },
);

function declaredOnly(
  loaded: Record<string, { default: Record<string, unknown> }>,
): Record<string, unknown> {
  const byNamespace = Object.fromEntries(
    Object.entries(loaded).map(([path, mod]) => [
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

export function loadEnMessages(): Record<string, unknown> {
  return declaredOnly(modules);
}

export function loadViMessages(): Record<string, unknown> {
  return declaredOnly(viModules);
}
