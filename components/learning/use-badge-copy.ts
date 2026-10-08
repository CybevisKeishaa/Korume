import { useTranslations } from "@/lib/i18n";
import { humanizeBadgeKey, isBadgeKey } from "@/lib/gamification/badge-keys";

/** Display copy for a badge key from the DB; works in server and client components. */
export function useBadgeCopy() {
  const t = useTranslations("common.badges");
  return {
    name: (key: string) => (isBadgeKey(key) ? t(`${key}.name`) : humanizeBadgeKey(key)),
    description: (key: string, fallback: string | null = null) => (isBadgeKey(key) ? t(`${key}.description`) : fallback),
  };
}
