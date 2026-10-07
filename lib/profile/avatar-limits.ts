/** Client-safe: `avatar.ts` is server-only (sharp), but the form checks the same input cap before uploading. */
export const AVATAR_INPUT_MAX_BYTES = 2 * 1024 * 1024;
