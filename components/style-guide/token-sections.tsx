"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

/** Token catalogues. Kept as plain data so the page IS the documentation —
 * a token added to globals.css without being listed here shows up in review. */
const PRIMITIVE_COLORS = [
  "--void-950", "--void-900", "--void-850", "--void-800",
  "--slate-800", "--slate-400",
  "--paper-50", "--ink-950",
  "--ember-500", "--sand-400",
  "--mint-400", "--coral-400", "--coral-300",
];

const SEMANTIC_COLORS = [
  "--background", "--foreground", "--card", "--card-foreground",
  "--muted", "--muted-foreground", "--input-background",
  "--border", "--input", "--ring",
  "--primary", "--primary-foreground", "--secondary", "--secondary-foreground",
  "--accent", "--accent-foreground",
  "--success", "--danger",
  // Text tones: the same hue tuned for legibility as TEXT rather than as a
  // fill (see globals.css). Features use these for words and icons.
  "--primary-strong", "--accent-strong", "--success-strong", "--danger-strong",
  "--surface-overlay", "--scrim",
];

const SPACING = ["2xs", "xs", "sm", "md", "lg", "xl", "2xl", "3xl"];

const TYPE_SCALE = [
  { cls: "text-display", name: "display" },
  { cls: "text-title", name: "title" },
  { cls: "text-heading", name: "heading" },
  { cls: "text-body-lg", name: "body-lg" },
  { cls: "text-body", name: "body" },
  { cls: "text-caption", name: "caption" },
] as const;

const MOTION_TOKENS = [
  "--duration-fast", "--duration-base", "--duration-slow",
  "--ease-standard", "--ease-out-expo",
];

const Z_TOKENS = ["--z-nav", "--z-overlay", "--z-popover", "--z-toast"];

function Swatch({ token }: { token: string }) {
  return (
    <div className="flex items-center gap-xs">
      <span
        aria-hidden="true"
        className="h-8 w-8 shrink-0 rounded-md border border-border"
        style={{ backgroundColor: `hsl(var(${token}))` }}
      />
      <code className="text-caption">{token}</code>
    </div>
  );
}

export function ColorSection() {
  const t = useTranslations("admin");
  return (
    <section aria-labelledby="sg-colour">
      <h2 id="sg-colour" className="text-heading font-semibold">{t("styleGuide.sections.colour.heading")}</h2>
      <h3 className="mt-md text-body-lg font-medium">{t("styleGuide.sections.colour.primitiveTier")}</h3>
      <div className="mt-xs grid grid-cols-2 gap-xs sm:grid-cols-3 lg:grid-cols-4">
        {PRIMITIVE_COLORS.map((token) => (
          <Swatch key={token} token={token} />
        ))}
      </div>
      <h3 className="mt-md text-body-lg font-medium">{t("styleGuide.sections.colour.semanticTier")}</h3>
      <p className="text-body text-muted-foreground">{t("styleGuide.sections.colour.semanticNote")}</p>
      <div className="mt-xs grid grid-cols-2 gap-xs sm:grid-cols-3 lg:grid-cols-4">
        {SEMANTIC_COLORS.map((token) => (
          <Swatch key={token} token={token} />
        ))}
      </div>
    </section>
  );
}

export function TypographySection() {
  const t = useTranslations("admin");
  return (
    <section aria-labelledby="sg-typography">
      <h2 id="sg-typography" className="text-heading font-semibold">{t("styleGuide.sections.typography.heading")}</h2>
      <div className="mt-md space-y-sm">
        {TYPE_SCALE.map(({ cls, name }) => (
          <div key={name}>
            <code className="text-caption text-muted-foreground">{name}</code>
            {/* Locale-stress demo line — always the same Vietnamese sample
                regardless of UI locale (D8: content, not chrome — the whole
                point is showing how real VN diacritics render at every type
                scale step). Never run through t(). */}
            <p className={cls}>Học tiếng Nhật qua phim — ắ ặ ễ ỡ ườ</p>
          </div>
        ))}
        <div>
          <code className="text-caption text-muted-foreground">font-jp + leading-jp</code>
          {/* Same D8 exemption as above, for Japanese. */}
          <p lang="ja" className="font-jp text-body-lg leading-jp">
            映画で日本語を学ぶ — 振り仮名のための行間。
          </p>
        </div>
        <p className="text-body text-muted-foreground">{t("styleGuide.sections.typography.note")}</p>
      </div>
    </section>
  );
}

export function SpacingSection() {
  const t = useTranslations("admin");
  return (
    <section aria-labelledby="sg-spacing">
      <h2 id="sg-spacing" className="text-heading font-semibold">{t("styleGuide.sections.spacing.heading")}</h2>
      <div className="mt-md space-y-xs">
        {SPACING.map((step) => (
          <div key={step} className="flex items-center gap-sm">
            <code className="w-12 text-caption">{step}</code>
            <span
              aria-hidden="true"
              className="h-4 rounded-sm bg-primary"
              style={{ width: `var(--space-${step})` }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Literal map, not a template string: Tailwind's static extraction never
 * emits a class name assembled at runtime (`shadow-${step}` produces no
 * `shadow-raised` in the built CSS — final review, Task 12, item 2).
 */
const ELEVATION_CLASSES = {
  raised: "shadow-raised",
  overlay: "shadow-overlay",
  floating: "shadow-floating",
} as const;

export function ElevationSection() {
  const t = useTranslations("admin");
  return (
    <section aria-labelledby="sg-elevation">
      <h2 id="sg-elevation" className="text-heading font-semibold">{t("styleGuide.sections.elevation.heading")}</h2>
      <div className="mt-md flex flex-wrap gap-lg">
        {(["raised", "overlay", "floating"] as const).map((step) => (
          <Card key={step} className={cn(ELEVATION_CLASSES[step], "p-md")}>
            <code className="text-caption">shadow-{step}</code>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function MotionSection() {
  const t = useTranslations("admin");
  return (
    <section aria-labelledby="sg-motion">
      <h2 id="sg-motion" className="text-heading font-semibold">{t("styleGuide.sections.motion.heading")}</h2>
      <ul className="mt-md space-y-2xs">
        {MOTION_TOKENS.map((token) => (
          <li key={token}>
            <code className="text-caption">{token}</code>
          </li>
        ))}
      </ul>
      <p className="mt-xs animate-fade-in text-body text-muted-foreground">
        {t("styleGuide.sections.motion.note")}
      </p>
    </section>
  );
}

export function ZIndexSection() {
  const t = useTranslations("admin");
  return (
    <section aria-labelledby="sg-zindex">
      <h2 id="sg-zindex" className="text-heading font-semibold">{t("styleGuide.sections.zIndex.heading")}</h2>
      <ul className="mt-md space-y-2xs">
        {Z_TOKENS.map((token) => (
          <li key={token}>
            <code className="text-caption">{token}</code>
          </li>
        ))}
      </ul>
    </section>
  );
}
