/**
 * This tab's last CONFIRMED newsletter save (footer or Settings), layered over a server prop that can be older.
 * `router.refresh()` purges Next 14's client router cache only once it completes, and a client navigation
 * started before then discards it (`action-queue.js`): the next visit within `staleTimes.dynamic` mounts from
 * the payload taken before the save (measured: footer subscribe → "Manage" at once → "Lessons" = form again).
 * Never forgotten when a server prop agrees — another page's cached payload can still be the old one.
 * Confirmed saves only, and a failed one forgets, so a lost write fails closed like `getNewsletterState`.
 * Keyed by the account email: the session can change in another tab.
 * ponytail: tab-scoped like notes-context's tabNoteWrites; another device's change is masked until a reload.
 */
let tabWrite: { email: string; optedIn: boolean } | null = null;

export function recordNewsletterWrite(email: string, optedIn: boolean): void {
  tabWrite = { email, optedIn };
}

export function forgetNewsletterWrite(): void {
  tabWrite = null;
}

export function newsletterOptIn(email: string, serverOptedIn: boolean): boolean {
  return tabWrite?.email === email ? tabWrite.optedIn : serverOptedIn;
}
