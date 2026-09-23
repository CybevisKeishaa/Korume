import type { ComponentType, ReactElement, ReactNode } from "react";
import {
  render as rtlRender,
  renderHook as rtlRenderHook,
  type RenderOptions,
  type RenderHookOptions,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { loadEnMessages, loadViMessages } from "./messages";

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
const CATALOGS = { en: messages, vi: loadViMessages() } as const;

/**
 * `locale` opts a single test out of the `en` default above.
 *
 * Reach for it ONLY when the behaviour under test is locale-dependent and an
 * `en` render cannot observe it — not to spot-check translations, which
 * `catalog.test.ts` (structure) and the `*.pin.test.ts` files (copy) already
 * own, and not for assertions on user-visible text, which stay English by
 * spec D6. The motivating case is `MemoryEraseForm`: it asks the user to type
 * a TRANSLATED confirmation word and sends an UNTRANSLATED literal, and those
 * two strings are the same string under `en`, so only a non-`en` render can
 * tell a correct implementation from one that posts whatever was typed.
 */
function customRender(
  ui: ReactElement,
  options?: RenderOptions & { locale?: keyof typeof CATALOGS },
) {
  const { locale = "en", ...rest } = options ?? {};
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale={locale} messages={CATALOGS[locale]}>
        {children}
      </NextIntlClientProvider>
    ),
    ...rest,
  });
}

/**
 * `renderHook`, wrapped the same way `render` above is. Any hook that calls
 * `useTranslations` (e.g. `useRecorder`, Task 11d) throws "No intl context
 * found" under the bare `@testing-library/react` `renderHook`, for the same
 * reason components do — this supplies the same `en` provider.
 */
function customRenderHook<Result, Props>(
  callback: (props: Props) => Result,
  options?: Omit<RenderHookOptions<Props>, "wrapper"> & {
    /**
     * Extra providers the hook needs, nested INSIDE the intl provider so both
     * apply. Without this a caller has to hand-roll a wrapper and import
     * `next-intl` itself, which spec P1 forbids outside `lib/i18n/` — this
     * file is the one exemption, so the seam belongs here.
     */
    wrapper?: ComponentType<{ children: ReactNode }>;
  },
) {
  const { wrapper: Inner, ...rest } = options ?? {};
  return rtlRenderHook(callback, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale="en" messages={messages}>
        {Inner ? <Inner>{children}</Inner> : children}
      </NextIntlClientProvider>
    ),
    ...rest,
  });
}

export * from "@testing-library/react";
export { customRender as render, customRenderHook as renderHook };
