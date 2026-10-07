/** One validator for the availability check and for Save (spec §2.1, R8). The DB unique index is the authority. */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  "admin", "api", "app", "auth", "dashboard", "edit", "help", "korume", "login", "logout", "me", "new", "null",
  "profile", "register", "root", "settings", "support", "system", "undefined", "user", "users",
]);

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): { ok: true; value: string } | { ok: false; reason: "format" | "reserved" } {
  const value = normalizeUsername(raw);
  if (!USERNAME_PATTERN.test(value)) return { ok: false, reason: "format" };
  if (RESERVED_USERNAMES.has(value)) return { ok: false, reason: "reserved" };
  return { ok: true, value };
}
