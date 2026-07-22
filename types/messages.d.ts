import type common from "../messages/en/common.json";
import type nav from "../messages/en/nav.json";
import type auth from "../messages/en/auth.json";
import type marketing from "../messages/en/marketing.json";
import type dashboard from "../messages/en/dashboard.json";
import type kanji from "../messages/en/kanji.json";
import type vocab from "../messages/en/vocab.json";
import type grammar from "../messages/en/grammar.json";
import type videos from "../messages/en/videos.json";
import type dictation from "../messages/en/dictation.json";
import type shadowing from "../messages/en/shadowing.json";
import type mining from "../messages/en/mining.json";
import type jlpt from "../messages/en/jlpt.json";
import type reading from "../messages/en/reading.json";
import type { routing } from "../lib/i18n/routing";

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: {
      common: typeof common;
      nav: typeof nav;
      auth: typeof auth;
      marketing: typeof marketing;
      dashboard: typeof dashboard;
      kanji: typeof kanji;
      vocab: typeof vocab;
      grammar: typeof grammar;
      videos: typeof videos;
      dictation: typeof dictation;
      shadowing: typeof shadowing;
      mining: typeof mining;
      jlpt: typeof jlpt;
      reading: typeof reading;
    };
  }
}
