// App-validated codes, never a DB enum (R8): adding one is a code change only.
export const NATIVE_LANGUAGES = ["vi", "en", "ja", "zh", "ko", "th", "id", "fil", "fr", "de", "es"] as const;
export type NativeLanguage = (typeof NATIVE_LANGUAGES)[number];
