import type { Config } from "tailwindcss";

/**
 * Nihongo Cinema design tokens.
 * Colours are driven by CSS variables (see app/globals.css) so the same
 * scale serves light + dark themes and keeps WCAG AA contrast (CLAUDE.md §5).
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
        ring: "hsl(var(--ring) / <alpha-value>)",
        // 朱色 — signature vermilion accent.
        // `strong` = the legible-as-TEXT tone (see globals.css "text tones").
        // Use `text-primary-strong` for words and icons, `bg-primary` for fills.
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          strong: "hsl(var(--primary-strong) / <alpha-value>)",
        },
        // 藍 — indigo secondary
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
          strong: "hsl(var(--danger-strong) / <alpha-value>)",
        },
        // Floating-panel surface (dialog/popover/select/toast) — semantic tier.
        overlay: "hsl(var(--surface-overlay) / <alpha-value>)",
        // Modal backdrop; use with alpha: bg-scrim/50.
        scrim: "hsl(var(--scrim) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        jp: ["var(--font-jp)", "var(--font-sans)", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
