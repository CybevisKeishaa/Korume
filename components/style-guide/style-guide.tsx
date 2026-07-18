"use client";

import { Link } from "@/lib/i18n/navigation";
import { ReduceMotionToggle } from "@/components/ui/reduce-motion-toggle";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { routing } from "@/lib/i18n/routing";
import {
  ColorSection,
  ElevationSection,
  MotionSection,
  SpacingSection,
  TypographySection,
  ZIndexSection,
} from "./token-sections";
import { PrimitiveSections } from "./primitive-sections";

/**
 * D9: the design-system laboratory. Not documentation ABOUT the system — it
 * renders the real tokens and the real primitives through the real providers,
 * so it cannot drift. Verify theme × locale × reduced-motion × responsive here.
 *
 * The explicit per-locale links are the locale axis of the lab. Passing
 * `locale` to Link is the one surface where choosing a locale IS the feature —
 * the exception that proves P2, same as lib/i18n's own internals.
 */
export function StyleGuide() {
  return (
    <div className="space-y-2xl">
      <header className="flex flex-wrap items-center justify-between gap-md">
        <div>
          <h1 className="text-title font-semibold">Style guide</h1>
          <p className="text-body text-muted-foreground">
            Executable spec — tokens and primitives rendered from the live implementation.
          </p>
        </div>
        <div className="flex items-center gap-md">
          <nav aria-label="Style guide locale">
            <ul className="flex items-center gap-xs">
              {routing.locales.map((locale) => (
                <li key={locale}>
                  <Link
                    href="/admin/style-guide"
                    locale={locale}
                    className="rounded-md border border-border px-xs py-2xs text-caption uppercase hover:bg-muted"
                  >
                    {locale}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <ThemeToggle />
          <ReduceMotionToggle />
        </div>
      </header>
      <ColorSection />
      <TypographySection />
      <SpacingSection />
      <ElevationSection />
      <MotionSection />
      <ZIndexSection />
      <PrimitiveSections />
    </div>
  );
}
