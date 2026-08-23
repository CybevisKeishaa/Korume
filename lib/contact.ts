/**
 * The one support address the product shows users, on both the Danger Zone
 * dialog footer (`deleteDialog.support`) and the deletion-requested email
 * (`lib/email/templates/account-deletion-requested.ts`). Matches the address
 * already documented as canonical in `docs/product/screen-inventory.md` §19.5
 * (Figma footer `203:13813`) — this file is what lets both call sites derive
 * it instead of each hardcoding its own copy (CLAUDE.md §6, one fact one home).
 */
export const SUPPORT_EMAIL = "admin@almostgone.vn";
