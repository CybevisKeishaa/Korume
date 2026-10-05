/** The identity of a saved word or expression (spec §6.1): NFKC + trim. Shared by server and client. */
export function normalizeRef(text: string): string {
  return text.normalize("NFKC").trim();
}
