import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

const SIGNED_URL_SECONDS = 3600;

/**
 * The learner's own surfaces only (spec §9, plan P5): a signed link to the private upload, else the OAuth picture.
 * A signing failure never blanks the page — it falls back to `avatarUrl`.
 */
export async function resolveAvatarUrl(input: { avatarPath: string | null; avatarUrl: string | null }): Promise<string | null> {
  if (input.avatarPath) {
    try {
      const { data, error } = await createServiceClient().storage.from("avatars").createSignedUrl(input.avatarPath, SIGNED_URL_SECONDS);
      if (!error && data?.signedUrl) return data.signedUrl;
    } catch {
      // fall through to the OAuth picture
    }
  }
  return input.avatarUrl;
}
