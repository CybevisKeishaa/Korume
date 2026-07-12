/**
 * Returns `value` only if it is a safe same-site relative path, else null.
 * Rejects absolute URLs, protocol-relative ("//host") and backslash variants
 * ("/\host", "\\host") — browsers normalise "\" to "/", so those would become
 * open redirects. Guards post-login / OAuth-callback redirect targets.
 */
export function safeRedirectPath(value: unknown): string | null {
  if (
    typeof value === "string" &&
    /^\/(?![/\\])/.test(value) &&
    !value.includes("\\")
  ) {
    return value;
  }
  return null;
}
