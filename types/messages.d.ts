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
import type conversation from "../messages/en/conversation.json";
import type community from "../messages/en/community.json";
import type playlists from "../messages/en/playlists.json";
import type leaderboard from "../messages/en/leaderboard.json";
import type profile from "../messages/en/profile.json";
import type admin from "../messages/en/admin.json";
import type companion from "../messages/en/companion.json";
import type upcoming from "../messages/en/upcoming.json";
import type settings from "../messages/en/settings.json";
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
      conversation: typeof conversation;
      community: typeof community;
      playlists: typeof playlists;
      leaderboard: typeof leaderboard;
      profile: typeof profile;
      admin: typeof admin;
      companion: typeof companion;
      upcoming: typeof upcoming;
      settings: typeof settings;
    };
  }
}
