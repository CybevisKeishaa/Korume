import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import { preferencesPatchSchema } from "@/lib/validation/preferences";
import { profileFieldsSchema } from "@/lib/profile/schema";
import { validateUsername } from "@/lib/profile/username";
import { processAvatar } from "@/lib/profile/avatar";
import { resolveAvatarUrl } from "@/lib/profile/avatar-url";

const SAVE_LIMIT = { limit: 10, windowMs: 60_000 };
const USERNAME_LIMIT = { limit: 30, windowMs: 60_000 };
const BUCKET = "avatars";
/** The four reused preference controls Edit Profile owns (spec §8.4); each is validated as `/settings` does (R5). */
const PREFERENCE_KEYS = ["dailyMinutes", "readingTranslation", "readingFurigana", "companionEnabled"] as const;

export type SaveProfileInput = {
  fields: unknown;
  preferences: unknown;
  avatar: { action: "keep" } | { action: "remove" } | { action: "replace"; bytes: Uint8Array; type: string };
};

export type SaveProfileResult =
  | { ok: true; data: { avatarUrl: string | null } }
  | { ok: false; status: 413 | 415 | 422 }
  | { ok: false; status: 400; fields: Record<string, string> }
  | { ok: false; status: 409; fields: { username: "taken" } };

const AVATAR_STATUS = { too_large: 413, type: 415, pixels: 422, corrupt: 422 } as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function logCleanup(context: string, error: unknown): void {
  // eslint-disable-next-line no-console -- server-side only; a failed best-effort cleanup is not the caller's problem.
  console.error(`[profile-write] ${context}:`, error);
}

export type AuthorizeProfileSaveResult =
  | { ok: true; user: { id: string } }
  | { ok: false; status: 401 }
  | { ok: false; status: 429; retryAfter: number };

/**
 * Step one of Edit Profile, run BEFORE the request body is read: the session user, then the rate limit. The returned
 * user is the only identity `saveProfile` accepts; nothing from the request can name one.
 */
export async function authorizeProfileSave(): Promise<AuthorizeProfileSaveResult> {
  const user = await requireUser(createClient());
  if (!user) return { ok: false, status: 401 };
  const limited = rateLimit(`profile-save:${user.id}`, SAVE_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };
  return { ok: true, user: { id: user.id } };
}

/** A PostgREST/Postgres SQLSTATE is five characters; anything else (network, PGRST...) does not prove a rollback. */
const isSqlState = (code: unknown): boolean => typeof code === "string" && /^[0-9A-Z]{5}$/.test(code);
const violatesUsernameKey = (error: { message?: string; details?: string | null }): boolean =>
  `${error.message ?? ""} ${error.details ?? ""}`.includes("users_username_key");

/**
 * The one write path of Edit Profile (spec §8.4, §9). `user` comes from `authorizeProfileSave` (auth and rate limit
 * already done). Order: validate everything → process the avatar → upload → `save_profile` (one transaction) → cleanup.
 * Nothing is written to any table except through the RPC.
 */
export async function saveProfile(input: SaveProfileInput, user: { id: string }): Promise<SaveProfileResult> {
  const errors: Record<string, string> = {};
  const parsedFields = profileFieldsSchema.safeParse(input.fields);
  if (!parsedFields.success) {
    for (const issue of parsedFields.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
  }
  const prefs: Record<string, unknown> = {};
  const rawPrefs = isRecord(input.preferences) ? input.preferences : {};
  for (const key of PREFERENCE_KEYS) {
    const parsed = preferencesPatchSchema.safeParse({ [key]: rawPrefs[key] });
    if (parsed.success) prefs[key] = (parsed.data as Record<string, unknown>)[key];
    else errors[key] = "invalid";
  }
  if (!parsedFields.success || Object.keys(errors).length > 0) return { ok: false, status: 400, fields: errors };

  let webp: Buffer | null = null;
  if (input.avatar.action === "replace") {
    const processed = await processAvatar(input.avatar.bytes, input.avatar.type);
    if (!processed.ok) return { ok: false, status: AVATAR_STATUS[processed.reason] };
    webp = processed.webp;
  }

  const service = createServiceClient();
  const bucket = service.storage.from(BUCKET);
  const newPath = webp ? `${user.id}/profile/${crypto.randomUUID()}.webp` : null;
  if (webp && newPath) {
    // The object exists before any row can point at it: a failed upload leaves the database untouched.
    const { error } = await bucket.upload(newPath, webp, { contentType: "image/webp", upsert: false });
    if (error) throw error;
  }

  const { data: previous, error } = await service.rpc("save_profile", {
    p_user: user.id,
    p_fields: parsedFields.data,
    p_prefs: prefs,
    p_avatar_action: input.avatar.action,
    p_avatar_path: newPath,
  });
  if (error) {
    if (newPath) {
      // Only a SQLSTATE proves the transaction rolled back. Otherwise the commit may have happened, and removing the
      // object would leave a row pointing at nothing: keep the orphan (harmless, private) and say so.
      if (isSqlState(error.code)) {
        const removed = await bucket.remove([newPath]).catch((cause: unknown) => ({ error: cause }));
        if (removed.error) logCleanup("could not remove the orphaned upload", removed.error);
      } else {
        logCleanup("save_profile outcome unknown; orphan kept", { path: newPath, error });
      }
    }
    if (error.code === "23505" && violatesUsernameKey(error)) return { ok: false, status: 409, fields: { username: "taken" } };
    throw error;
  }

  // Committed. The old object is removed only now, best-effort: a leftover private file is harmless, a dangling row is not.
  if (typeof previous === "string" && previous !== newPath && input.avatar.action !== "keep") {
    const removed = await bucket.remove([previous]).catch((cause: unknown) => ({ error: cause }));
    if (removed.error) logCleanup("could not remove the previous avatar", removed.error);
  }

  // The path the database now holds is known without a read: the new one, none, or (keep) the one the RPC returned.
  // `null` means "no uploaded photo": the page falls back to the OAuth picture on its next load.
  const storedPath = input.avatar.action === "replace" ? newPath : input.avatar.action === "remove" ? null : typeof previous === "string" ? previous : null;
  return { ok: true, data: { avatarUrl: await resolveAvatarUrl({ avatarPath: storedPath, avatarUrl: null }) } };
}

export type CheckUsernameResult =
  | { ok: true; data: { available: true } | { available: false; reason: "format" | "reserved" | "taken" } }
  | { ok: false; status: 401 }
  | { ok: false; status: 429; retryAfter: number };

/** Availability hint only; the unique index stays the authority. Returns a flag — never another learner's id or column. */
export async function checkUsername(raw: string): Promise<CheckUsernameResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`username-check:${user.id}`, USERNAME_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const checked = validateUsername(raw);
  if (!checked.ok) return { ok: true, data: { available: false, reason: checked.reason } };

  // users_select_own hides every other row from the session client, so the lookup needs the service role.
  const { data, error } = await createServiceClient()
    .from("users").select("id").eq("username", checked.value).neq("id", user.id).limit(1);
  if (error) throw error;
  return { ok: true, data: (data?.length ?? 0) > 0 ? { available: false, reason: "taken" } : { available: true } };
}
