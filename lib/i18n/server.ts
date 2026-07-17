import "server-only";

/**
 * The server half of the localization contract, for async Server Components,
 * route handlers and metadata. Kept separate from `index.ts` so a client
 * component importing the barrel can never pull server-only code in with it.
 */
export { getTranslations, getFormatter, getMessages, getLocale, setRequestLocale } from "next-intl/server";
