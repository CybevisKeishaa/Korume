import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Inter, Noto_Sans_JP } from "next/font/google";
import { NextIntlClientProvider, hasLocale, type Locale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import {
  ThemeProvider,
  themeInitScript,
} from "@/components/providers/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { routing } from "@/lib/i18n/routing";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const notoJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jp",
});

// `generateMetadata` runs in its own scope, so the locale must be threaded in
// explicitly — a bare `getTranslations("common")` here would rely on ambient
// request state and can silently drop the page out of static rendering
// (spec §7 risk 2). The `"%s · Nihongo Cinema"` template stays a literal: the
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
      template: "%s · Nihongo Cinema",
    },
    description: t("meta.description"),
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1420" },
  ],
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
      <body className={`${inter.variable} ${notoJp.variable} font-sans`}>
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
