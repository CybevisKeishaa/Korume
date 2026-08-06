import type { Config } from "tailwindcss";

/**
 * Korume design tokens.
 * Colours are driven by CSS variables (see app/globals.css). Korume ships
 * dark-only; the data-theme mechanism is retained so light mode can return
 * without restructuring. WCAG AA contrast is enforced by
 * lib/design-tokens.contrast.test.ts (CLAUDE.md §2 rule 5).
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        // Field-interior fill, distinct from `input` (the border colour). Was
        // declared in globals.css but never wired to a Tailwind utility, so
        // Input.tsx fell back to bg-card, the wrong colour per the design.
        inputBackground: "hsl(var(--input-background) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        // The single Korume accent — warm ember. `strong` = the legible-as-TEXT
        // tone. Use `text-primary-strong` for words and icons, `bg-primary` for
        // fills. `accent` is warm sand for tags/status and is NOT a CTA colour.
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          strong: "hsl(var(--primary-strong) / <alpha-value>)",
        },
        // Secondary CTA surface — a quiet dark plane, not a second accent.
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
          strong: "hsl(var(--accent-strong) / <alpha-value>)",
        },
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          strong: "hsl(var(--success-strong) / <alpha-value>)",
        },
        danger: {
          DEFAULT: "hsl(var(--danger) / <alpha-value>)",
          foreground: "hsl(var(--danger-foreground) / <alpha-value>)",
          strong: "hsl(var(--danger-strong) / <alpha-value>)",
        },
        // Floating-panel surface (dialog/popover/select/toast) — semantic tier.
        overlay: "hsl(var(--surface-overlay) / <alpha-value>)",
        // Modal backdrop; use with alpha: bg-scrim/50.
        scrim: "hsl(var(--scrim) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        jp: ["var(--font-jp)", "var(--font-sans)", "sans-serif"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      spacing: {
        "2xs": "var(--space-2xs)",
        xs: "var(--space-xs)",
        sm: "var(--space-sm)",
        md: "var(--space-md)",
        lg: "var(--space-lg)",
        xl: "var(--space-xl)",
        "2xl": "var(--space-2xl)",
        "3xl": "var(--space-3xl)",
      },
      fontSize: {
        caption: ["var(--text-caption)", "var(--leading-caption)"],
        body: ["var(--text-body)", "var(--leading-body)"],
        "body-lg": ["var(--text-body-lg)", "var(--leading-body-lg)"],
        heading: ["var(--text-heading)", "var(--leading-heading)"],
        title: ["var(--text-title)", "var(--leading-title)"],
        display: ["var(--text-display)", "var(--leading-display)"],
      },
      lineHeight: {
        jp: "var(--leading-jp)",
      },
      fontWeight: {
        regular: "var(--font-weight-regular)",
        medium: "var(--font-weight-medium)",
        semibold: "var(--font-weight-semibold)",
        bold: "var(--font-weight-bold)",
      },
      letterSpacing: {
        tight: "var(--tracking-tight)",
        wide: "var(--tracking-wide)",
      },
      boxShadow: {
        raised: "var(--elevation-raised)",
        overlay: "var(--elevation-overlay)",
        floating: "var(--elevation-floating)",
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        base: "var(--duration-base)",
        slow: "var(--duration-slow)",
      },
      transitionTimingFunction: {
        standard: "var(--ease-standard)",
        "out-expo": "var(--ease-out-expo)",
      },
      zIndex: {
        nav: "var(--z-nav)",
        overlay: "var(--z-overlay)",
        popover: "var(--z-popover)",
        toast: "var(--z-toast)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in var(--duration-base) var(--ease-standard) both",
      },
    },
  },
  plugins: [],
};

export default config;
