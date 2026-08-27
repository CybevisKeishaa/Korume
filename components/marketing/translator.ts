import type { getTranslations } from "@/lib/i18n/server";

/**
 * The translator type `await getTranslations("namespace")` resolves to.
 *
 * Task 4 fix F5: a server component that needs a nested subcomponent to also
 * call `getTranslations` used to make that subcomponent async and await it
 * explicitly (`const child = await Child()`) so the resolved element — not a
 * bare `<Child />` — reached the tree. That workaround existed only because
 * Vitest's jsdom tests render through plain react-dom, which (unlike
 * Next.js's RSC renderer) cannot resolve a nested async component used as
 * JSX. The real fix is to look up the translator once, at the top, and pass
 * it down as an ordinary prop — server-to-server prop passing crosses no
 * serialization boundary, so this costs nothing, removes the duplicate
 * lookups, and lets every subcomponent stay a plain synchronous function
 * rendered as `<Child t={t} />` under both renderers.
 *
 * This is the standing pattern for every remaining landing-page section
 * (task 4 fix F5) — reuse this type rather than re-deriving it per file.
 */
export type Translator = Awaited<ReturnType<typeof getTranslations>>;
