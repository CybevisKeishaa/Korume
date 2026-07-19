import type { ReactElement } from "react";
import { render as rtlRender, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { loadEnMessages } from "./messages";

/**
 * `@testing-library/react`'s `render`, wrapped in `NextIntlClientProvider`.
 *
 * `@/lib/i18n/navigation`'s `Link`, `usePathname` and `useRouter` all call
 * `useLocale()` internally (next-intl), which throws "No intl context found"
 * outside a provider — so any component test that renders one of these
 * (directly or through a child) needs this wrapper, not the bare
 * `@testing-library/react` `render`.
 *
 * Locale is pinned to `en` (spec D6): the regression suite asserts on English
 * user-visible text, and the EN catalog is extracted verbatim, so those
 * assertions survive extraction unchanged. The real EN catalogs are supplied
 * (see ./messages) — a component under test that calls t() must render the
 * same text it rendered when the string was hardcoded.
 *
 * This file imports `next-intl` directly, which is otherwise forbidden for
 * feature code (spec P1) — it is exempted because it IS the test-side half
 * of the localization foundation's public surface, alongside
 * `lib/i18n/**` and `app/[locale]/layout.tsx`.
 */
const messages = loadEnMessages();

function customRender(ui: ReactElement, options?: RenderOptions) {
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale="en" messages={messages}>
        {children}
      </NextIntlClientProvider>
    ),
    ...options,
  });
}

export * from "@testing-library/react";
export { customRender as render };
