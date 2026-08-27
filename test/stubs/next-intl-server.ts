import { createFormatter, createTranslator } from "use-intl/core";
import { loadEnMessages } from "@/test/messages";
import { VN_TIME_ZONE } from "@/lib/time/vn-timezone";

/**
 * Test-only stand-in for `next-intl/server` (real module: `lib/i18n/server.ts`).
 *
 * `next-intl/server`'s package.json gates its real implementation behind the
 * `react-server` module-resolution condition (its "server.react-server.js"
 * build vs "server.react-client.js"). Vitest's jsdom environment never sets that
 * condition, so without this stub every import of `next-intl/server` resolves
 * to the react-client build, whose `getTranslations` is typed `() => never`
 * and throws "`getTranslations` is not supported in Client Components" on
 * every call — before any component code runs.
 *
 * Forcing the `react-server` condition globally was rejected: it would also
 * repoint the *client* entry points (`next-intl`, `next-intl/navigation`)
 * that the other ~60 component tests rely on via `NextIntlClientProvider`,
 * and `react`/`react-dom` themselves gate `cache()` and DOM rendering behind
 * the same condition — a change with much larger, harder-to-audit blast
 * radius than aliasing this one subpath.
 *
 * Instead this stub reimplements the handful of `next-intl/server` exports
 * that server components in this repo call, using `use-intl/core`'s
 * `createTranslator` directly against the real EN message catalogs (the same
 * `loadEnMessages()` `test/render.tsx` uses) — so an async Server Component
 * under test resolves the same English strings it renders in production.
 * Wired in via `resolve.alias` in `vitest.config.ts`, mirroring the existing
 * `server-only` stub there.
 *
 * DELIBERATE LIMIT: only locale "en" is served. `test/render.tsx` pins every
 * component test to `en` (spec D6) and `loadEnMessages()` only loads the EN
 * catalogs, so there is nothing to render a "vi" request against. Roughly 40
 * call sites across `app/**` (every `generateMetadata`) call
 * `getTranslations({ locale, namespace })` with a real locale value — if this
 * stub silently substituted "en" for any other locale, a future test that
 * renders with `locale: "vi"` and asserts Vietnamese copy would silently pass
 * against English strings instead. `assertEnLocale` below makes that loud
 * (a thrown, self-explaining error) instead of silent. Extending this stub to
 * really load "vi" messages is deliberately NOT done here — nothing in this
 * plan needs it yet (YAGNI); do it deliberately, in its own change, when a
 * test actually needs "vi" server-side translations.
 */
const messages = loadEnMessages();

type GetTranslationsOpts = { locale?: string; namespace?: string };

function assertEnLocale(locale: string | undefined): void {
  if (locale !== undefined && locale !== "en") {
    throw new Error(
      `next-intl-server stub: only locale "en" is available (requested "${locale}"). ` +
        `Extend test/messages.ts (and this stub) to load "vi" deliberately before asserting on it.`,
    );
  }
}

export async function getTranslations(
  namespaceOrOpts?: string | GetTranslationsOpts,
) {
  const opts =
    typeof namespaceOrOpts === "string"
      ? { namespace: namespaceOrOpts }
      : namespaceOrOpts;

  assertEnLocale(opts?.locale);

  return createTranslator({ locale: "en", messages, namespace: opts?.namespace });
}

export async function getMessages(): Promise<Record<string, unknown>> {
  return messages;
}

export async function getLocale(): Promise<string> {
  return "en";
}

export function setRequestLocale(): void {
  // No-op: no request context exists under Vitest.
}

export async function getFormatter(opts?: { locale?: string }) {
  assertEnLocale(opts?.locale);
  // Pinned to VN_TIME_ZONE (this product's one canonical timezone — see that
  // module's doc comment: `lib/i18n/request.ts` sets no global `timeZone` of
  // its own, so without an explicit zone here a date-rendering test would
  // format in the test runner's local zone instead — green locally, wrong in
  // CI, and wrong again the moment CI's zone changes).
  return createFormatter({ locale: "en", timeZone: VN_TIME_ZONE });
}

/**
 * `lib/i18n/request.ts` imports the real `getRequestConfig` to register the
 * app's request config for production. No test imports that module today
 * (this stub's alias only ever needed the exports above), but if one starts
 * to, it must not resolve to a version that behaves as if a real Next.js
 * request context exists — throwing here turns that into a clear, named
 * failure at the import site instead of a confusing "not a function" or,
 * worse, a config that appears to work but returns nothing meaningful.
 */
export function getRequestConfig(..._args: unknown[]): never {
  throw new Error(
    "next-intl-server stub: getRequestConfig is not implemented — it registers the production " +
      "request config (lib/i18n/request.ts) and has no meaning under Vitest, which has no request " +
      "context. If a test now needs to import lib/i18n/request.ts, extend this stub deliberately " +
      "instead of relying on it silently working.",
  );
}
