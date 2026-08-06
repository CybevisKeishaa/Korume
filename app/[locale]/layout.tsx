import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import {
  Plus_Jakarta_Sans,
  Be_Vietnam_Pro,
  Noto_Serif,
  IBM_Plex_Mono,
  Noto_Sans_JP,
} from "next/font/google";
import { NextIntlClientProvider, hasLocale, type Locale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import {
  ThemeProvider,
  themeInitScript,
} from "@/components/providers/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { routing } from "@/lib/i18n/routing";
import "../globals.css";

/**
 * Five typeface roles (adoption spec §4). The design names no font, so these
 * are chosen — and three of the bundle's faces (Outfit, Noto Serif JP, DM Mono)
 * are substituted because they have NO Vietnamese subset and Korume is VN-first.
 *
 * Only sans and jp are preloaded: they carry the shell and the learning content.
 * The other three are role fonts that appear below the fold on most screens, so
 * they swap in rather than block paint.
 */
const sans = Plus_Jakarta_Sans({
  subsets: ["latin", "vietnamese"],
  variable: "--font-sans",
  display: "swap",
});
const display = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
  preload: false,
});
const serif = Noto_Serif({
  subsets: ["latin", "vietnamese"],
  variable: "--font-serif",
  display: "swap",
  preload: false,
});
const mono = IBM_Plex_Mono({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
  preload: false,
});
// Carries furigana, which renders very small above the kanji — mincho serifs
// break first at that size, so the Japanese role stays sans.
const notoJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jp",
  display: "swap",
});

// `generateMetadata` runs in its own scope, so the locale must be threaded in
// explicitly — a bare `getTranslations("common")` here would rely on ambient
// request state and can silently drop the page out of static rendering
// (spec §7 risk 2). The `"%s · Korume"` template stays a literal: the
// separator and brand are not translated.
export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "common" });
  return {
    title: {
      default: t("meta.defaultTitle"),
      template: "%s · Korume",
    },
    description: t("meta.description"),
  };
}

/** Korume ships dark-only, so the browser chrome does not vary by preference. */
export const viewport: Viewport = {
  themeColor: "#0b0d11",
};

/** Enables static rendering for every locale (spec §7 risk 2). */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const { locale } = params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Without this, every page below falls out of static rendering silently —
  // no error, just slower (spec §7 risk 2).
  setRequestLocale(locale);

  // Foundation wiring for the ui/toast primitive's dismissLabel prop (P4):
  // the primitive itself must not call useTranslations (design-system vs.
  // localization independence, spec §4.5), so the translated label is
  // resolved here, server-side, and passed down.
  const t = await getTranslations("common");

  // Ships the whole catalog to the client. Deliberate for now: 65 client
  // components make per-namespace splitting a real design question, and
  // optimising before measuring would complicate the architecture. Filed as a
  // specific item for the L9c perf audit (spec §7 risk 3).
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${sans.variable} ${display.variable} ${serif.variable} ${mono.variable} ${notoJp.variable} font-sans`}
      >
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <ToastProvider dismissLabel={t("a11y.dismissNotification")}>
              {children}
            </ToastProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
