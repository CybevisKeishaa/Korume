"use client";

import { useTranslations } from "@/lib/i18n";
import { Link } from "@/lib/i18n/navigation";

export interface DangerZoneProps {
  onCloseAccount: () => void;
  onEraseAll: () => void;
  memoryHref: string;
  /**
   * True while a deletion request (either tier) is already live. The
   * `account_deletion_requests` table allows only one pending request per
   * user (a partial unique index) — re-opening either dialog under a second
   * request can only produce the 409 the API already refuses. Disabled here
   * so the user is never invited into an action that cannot succeed;
   * `DeletionPendingBanner`, rendered above this section by `PrivacyScreen`
   * whenever this is true, is what explains why (Task 11). The memory row
   * is untouched — it has no confirmation flow in this branch and nothing
   * to do with the deletion-request lifecycle.
   */
  pendingRequest: boolean;
}

/**
 * `337:3323`'s Danger Zone, built as drawn: three rows, none greyed out, none
 * dropped (spec §13). The memory row's behaviour is not built yet, so its
 * action points at an honest "not built" destination — appearing functional
 * and pointing somewhere honest are different things.
 *
 * Text on the destructive fill is `text-danger-foreground`, which aliases
 * `--ink-950` (app/globals.css). There is no bare `ink-950` Tailwind utility
 * in this repo's token set (tailwind.config.ts only exposes semantic groups),
 * so `text-ink-950` would resolve to nothing and silently fall back to the
 * default foreground colour — the exact AA failure this rule exists to
 * prevent (`--paper-50` on `--danger` measures 2.98:1).
 * `bg-danger` / `text-danger-foreground` is the pairing
 * `lib/design-tokens.contrast.test.ts` already asserts passes AA.
 */
export function DangerZone({ onCloseAccount, onEraseAll, memoryHref, pendingRequest }: DangerZoneProps) {
  const t = useTranslations("settings");

  return (
    <section className="mt-xl rounded-lg border border-danger/40 bg-danger/5 p-lg">
      <p className="text-caption font-semibold uppercase tracking-wide text-danger-strong">
        {t("dangerZone.eyebrow")}
      </p>
      <h2 className="mt-xs text-heading font-bold">{t("dangerZone.title")}</h2>

      <div className="mt-lg divide-y divide-border">
        <Row title={t("dangerZone.memory.title")} body={t("dangerZone.memory.body")}>
          <Link href={memoryHref} className="text-caption text-muted-foreground hover:text-foreground">
            {t("dangerZone.memory.action")}
          </Link>
        </Row>

        <Row title={t("dangerZone.closeAccount.title")} body={t("dangerZone.closeAccount.body")}>
          <button
            type="button"
            onClick={onCloseAccount}
            disabled={pendingRequest}
            className="text-caption text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            {t("dangerZone.closeAccount.action")}
          </button>
        </Row>

        <Row title={t("dangerZone.eraseAll.title")} body={t("dangerZone.eraseAll.body")}>
          <button
            type="button"
            onClick={onEraseAll}
            disabled={pendingRequest}
            className="rounded-full border border-danger px-md py-xs text-caption font-semibold text-danger-strong hover:bg-danger hover:text-danger-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            {t("dangerZone.eraseAll.action")}
          </button>
        </Row>
      </div>
    </section>
  );
}

function Row({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-lg py-md">
      <div>
        <p className="text-body font-semibold">{title}</p>
        <p className="mt-2xs text-caption text-muted-foreground">{body}</p>
      </div>
      {children}
    </div>
  );
}
