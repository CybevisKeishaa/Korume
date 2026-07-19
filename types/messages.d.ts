import type common from "../messages/en/common.json";
import type nav from "../messages/en/nav.json";
import type auth from "../messages/en/auth.json";
import type { routing } from "../lib/i18n/routing";

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: {
      common: typeof common;
      nav: typeof nav;
      auth: typeof auth;
    };
  }
}
