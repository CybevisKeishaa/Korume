import { createTranslator } from "use-intl/core";
import { loadEnMessages } from "@/test/messages";

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
 */
const messages = loadEnMessages();

type GetTranslationsOpts = { locale?: string; namespace?: string };

export async function getTranslations(
  namespaceOrOpts?: string | GetTranslationsOpts,
) {
  const namespace =
    typeof namespaceOrOpts === "string"
      ? namespaceOrOpts
      : namespaceOrOpts?.namespace;

  return createTranslator({ locale: "en", messages, namespace });
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

export async function getFormatter() {
  const { createFormatter } = await import("use-intl/core");
  return createFormatter({ locale: "en" });
}
