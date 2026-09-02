import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Stock tailwind-merge (v2) has no knowledge of this repo's custom design
 * tokens (tailwind.config.ts): it doesn't recognize `text-caption`/`text-body`
 * etc. as font-size utilities, so it falls back to classifying them as text
 * COLOR utilities and silently drops them whenever a real color class
 * follows in the same cn() call (final review, Task 12, item 1 — verified
 * victims: components/ui/badge.tsx, select.tsx, tabs.tsx). Registering the
 * custom scales below keeps them in their real group so they merge (or
 * conflict) correctly instead of colliding with unrelated groups.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: ["2xs", "xs", "sm", "md", "md-lg", "lg", "xl", "2xl", "3xl"],
    },
    classGroups: {
      "font-size": [{ text: ["caption", "body", "body-lg", "heading", "heading-lg", "title", "display", "hero"] }],
      shadow: [{ shadow: ["raised", "overlay", "floating"] }],
      leading: [{ leading: ["jp"] }],
      "font-weight": [{ font: ["regular"] }],
      "font-family": [{ font: ["sans", "display", "serif", "mono", "jp"] }],
      duration: [{ duration: ["fast", "base", "slow"] }],
      ease: [{ ease: ["standard", "out-expo"] }],
      z: [{ z: ["nav", "overlay", "popover", "toast"] }],
      "max-w": [{ "max-w": ["content"] }],
      w: [{ w: ["sidebar", "sidebar-collapsed", "companion"] }],
      h: [{ h: ["header"] }],
      "scroll-mt": [{ "scroll-mt": ["header"] }],
    },
  },
});

/** Merge conditional class names, de-duplicating Tailwind conflicts. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
