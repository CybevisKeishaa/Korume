"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Token catalogues. Kept as plain data so the page IS the documentation —
 * a token added to globals.css without being listed here shows up in review. */
const PRIMITIVE_COLORS = [
  "--washi-50", "--washi-100", "--white", "--sumi-900",
  "--neutral-100", "--neutral-300", "--neutral-400", "--neutral-600",
  "--ink-700", "--ink-800", "--ink-900", "--ink-950",
  "--vermilion-400", "--vermilion-500", "--indigo-300", "--indigo-600",
  "--green-400", "--green-600", "--red-400", "--red-600",
];

const SEMANTIC_COLORS = [
  "--background", "--foreground", "--card", "--muted", "--muted-foreground",
  "--border", "--primary", "--accent", "--success", "--danger",
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
  return (
    <section aria-labelledby="sg-colour">
      <h2 id="sg-colour" className="text-heading font-semibold">Colour</h2>
      <h3 className="mt-md text-body-lg font-medium">Primitive tier</h3>
      <div className="mt-xs grid grid-cols-2 gap-xs sm:grid-cols-3 lg:grid-cols-4">
        {PRIMITIVE_COLORS.map((token) => (
          <Swatch key={token} token={token} />
        ))}
      </div>
      <h3 className="mt-md text-body-lg font-medium">Semantic tier</h3>
      <p className="text-body text-muted-foreground">
        Features consume ONLY this tier. Dark theme remaps it; L9b restyles by editing the
        mapping, not the features.
      </p>
      <div className="mt-xs grid grid-cols-2 gap-xs sm:grid-cols-3 lg:grid-cols-4">
        {SEMANTIC_COLORS.map((token) => (
          <Swatch key={token} token={token} />
        ))}
      </div>
    </section>
  );
}

export function TypographySection() {
  return (
    <section aria-labelledby="sg-typography">
      <h2 id="sg-typography" className="text-heading font-semibold">Typography</h2>
      <div className="mt-md space-y-sm">
        {TYPE_SCALE.map(({ cls, name }) => (
          <div key={name}>
            <code className="text-caption text-muted-foreground">{name}</code>
            <p className={cls}>Học tiếng Nhật qua phim — ắ ặ ễ ỡ ườ</p>
          </div>
        ))}
        <div>
          <code className="text-caption text-muted-foreground">font-jp + leading-jp</code>
          <p lang="ja" className="font-jp text-body-lg leading-jp">
            映画で日本語を学ぶ — 振り仮名のための行間。
          </p>
        </div>
        <p className="text-body text-muted-foreground">
          Body line-heights are sized for stacked Vietnamese diacritics; Japanese text takes
          leading-jp (spec §4.5 touchpoint 1).
        </p>
      </div>
    </section>
  );
}

export function SpacingSection() {
  return (
    <section aria-labelledby="sg-spacing">
      <h2 id="sg-spacing" className="text-heading font-semibold">Spacing</h2>
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
  return (
    <section aria-labelledby="sg-elevation">
      <h2 id="sg-elevation" className="text-heading font-semibold">Elevation</h2>
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
  return (
    <section aria-labelledby="sg-motion">
      <h2 id="sg-motion" className="text-heading font-semibold">Motion</h2>
      <ul className="mt-md space-y-2xs">
        {MOTION_TOKENS.map((token) => (
          <li key={token}>
            <code className="text-caption">{token}</code>
          </li>
        ))}
      </ul>
      <p className="mt-xs animate-fade-in text-body text-muted-foreground">
        This line uses animate-fade-in (duration-base × ease-standard). With reduce motion
        on — toggle above — it must appear instantly.
      </p>
    </section>
  );
}

export function ZIndexSection() {
  return (
    <section aria-labelledby="sg-zindex">
      <h2 id="sg-zindex" className="text-heading font-semibold">Z-index</h2>
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
