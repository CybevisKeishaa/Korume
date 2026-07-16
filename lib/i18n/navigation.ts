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
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
