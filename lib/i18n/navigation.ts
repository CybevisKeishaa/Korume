import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation (spec P2: every navigation preserves the current
 * locale; a feature never decides what locale goes in a URL).
 *
 * These are drop-in replacements for `next/link` and the locale-sensitive
 * half of `next/navigation`. `useSearchParams`, `useParams` and `notFound`
 * have nothing to do with locale — keep importing those from `next/navigation`
 * directly. The boundary covers what carries a locale, not the whole module
 * (spec §2.9).
 */
const nav = createNavigation(routing);

export const { Link, usePathname, useRouter, getPathname } = nav;

/**
 * Re-declared (not just re-exported) so its `never` return type is visible
 * to TypeScript's unreachable-code analysis. `nav.redirect`'s type is derived
 * from `createNavigation`'s generic, conditional-type return value, and TS
 * does not unwrap that far when deciding whether a call "never returns" —
 * every `if (cond) redirect(...)` call site in feature code relies on the
 * following code being narrowed as unreachable, so this is required, not
 * cosmetic (verified against next-intl 4.13.2 / TypeScript 5.9.3: the same
 * call through `nav.redirect` directly fails to narrow; through this
 * explicitly-typed wrapper it does).
 */
export function redirect(
  args: Parameters<typeof nav.redirect>[0],
  type?: Parameters<typeof nav.redirect>[1],
): never {
  return nav.redirect(args, type);
}
