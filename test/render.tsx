import type { ReactElement } from "react";
import { render as rtlRender, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

/**
 * `@testing-library/react`'s `render`, wrapped in `NextIntlClientProvider`.
 *
 * `@/lib/i18n/navigation`'s `Link`, `usePathname` and `useRouter` all call
 * `useLocale()` internally (next-intl), which throws "No intl context found"
 * outside a provider — so any component test that renders one of these
 * (directly or through a child) needs this wrapper, not the bare
 * `@testing-library/react` `render`.
 *
 * Locale is pinned to `en` (matches the e2e suite's D6 pin — Task 5). No
 * messages are supplied: Plan 3 (string extraction) hasn't landed yet, so
 * nothing under test calls `useTranslations()`.
 *
 * This file imports `next-intl` directly, which is otherwise forbidden for
 * feature code (spec P1) — it is exempted because it IS the test-side half
 * of the localization foundation's public surface, alongside
 * `lib/i18n/**` and `app/[locale]/layout.tsx`.
 */
function customRender(ui: ReactElement, options?: RenderOptions) {
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale="en" messages={{}}>
        {children}
      </NextIntlClientProvider>
    ),
    ...options,
  });
}

export * from "@testing-library/react";
export { customRender as render };
