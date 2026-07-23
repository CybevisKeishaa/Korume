"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "./confirm-dialog";
import { ContentForm } from "./content-form";
import { Textarea } from "./textarea";
import {
  CONTENT_LIST_COLUMNS,
  CONTENT_PRIMARY_FIELD,
  columnLabel,
  contentSearchLabel,
  contentTypeLabel,
} from "./content-fields";
import type { ApiErrorBody, ContentListPage, ContentRow, ContentType, CsvImportResponse } from "@/lib/admin-ui-types";
import { useTranslations } from "@/lib/i18n";

type LoadState = { status: "idle" | "loading" } | { status: "error"; message: string };
type FormState = { mode: "create" } | { mode: "edit"; item: ContentRow } | null;

const PAGE_SIZE = 20;

/** `res`'s body may carry a server-authored `error` string — an admin-tooling
 * CSV/content-validation diagnostic, deliberately surfaced to the CMS
 * operator (not a learner-facing surface, and this file's own CSV-import
 * panel already shows raw per-row `f.errors` for the same reason: an admin
 * fixing a bad row needs the real message, not a generic fallback). So —
 * unlike the learner-facing `friendlyErrorFrom` pattern elsewhere in this
 * plan — `body.error` intentionally passes through here; only the fallback
 * string is translated. */
async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

function primaryLabel(type: ContentType, item: ContentRow): string {
  const value = item[CONTENT_PRIMARY_FIELD[type]];
  return typeof value === "string" && value.length > 0 ? value : String(item.id);
}

/**
 * One content type's CRUD table (`/admin/content/[type]`): search + paginated
 * list, create/edit via `ContentForm`, delete with a confirm dialog, and a
 * CSV bulk-import panel. Talks to the generic `backend-engineer`-owned
 * `/api/admin/content/[type]` routes (`lib/data/admin-content.ts`).
 */
export function ContentManager({ type }: { type: ContentType }) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const [items, setItems] = useState<ContentRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

  const [formState, setFormState] = useState<FormState>(null);

  const [deleteTarget, setDeleteTarget] = useState<ContentRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<CsvImportResponse | null>(null);

  const searchInputId = useId();
  const csvInputId = useId();

  const load = useCallback(async (targetPage: number, search: string) => {
    setLoadState({ status: "loading" });
    try {
      let url = `/api/admin/content/${type}?page=${targetPage}&pageSize=${PAGE_SIZE}`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
      const res = await fetch(url);
      if (!res.ok) {
        setLoadState({ status: "error", message: t("content.manager.error.load") });
        return;
      }
      const body = (await res.json()) as { data: ContentListPage };
      setItems(body.data.items);
      setHasMore(body.data.hasMore);
      setLoadState({ status: "idle" });
    } catch {
      setLoadState({ status: "error", message: t("content.manager.error.load") });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is stable for the lifetime of this component (locale is fixed per route render, per the project's translator idiom).
  }, [type]);

  useEffect(() => {
    void load(page, committedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `load` is stable per `type`; re-running on `type` change is handled by the parent re-mounting this component with a new key.
  }, [page, committedSearch]);

  function runSearch(): void {
    setPage(1);
    setCommittedSearch(searchInput);
  }

  async function handleCreate(payload: Record<string, unknown>): Promise<{ ok: true } | { ok: false; error: string }> {
    const res = await fetch(`/api/admin/content/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false, error: await readErrorMessage(res, t("content.manager.error.create")) };
    setFormState(null);
    await load(page, committedSearch);
    return { ok: true };
  }

  async function handleEdit(id: string, payload: Record<string, unknown>): Promise<{ ok: true } | { ok: false; error: string }> {
    const res = await fetch(`/api/admin/content/${type}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false, error: await readErrorMessage(res, t("content.manager.error.save")) };
    setFormState(null);
    await load(page, committedSearch);
    return { ok: true };
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/content/${type}/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        setDeleteError(await readErrorMessage(res, t("content.manager.error.delete")));
        setDeleteBusy(false);
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      setDeleteTarget(null);
      setDeleteBusy(false);
    } catch {
      setDeleteError(t("content.manager.error.delete"));
      setDeleteBusy(false);
    }
  }

  async function submitImport(): Promise<void> {
    setImportBusy(true);
    setImportError(null);
    setImportResult(null);
    try {
      const res = await fetch(`/api/admin/content/${type}/import`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: importText,
      });
      if (res.status === 429) {
        setImportError(t("content.manager.error.tooManyImports"));
        return;
      }
      if (!res.ok) {
        setImportError(await readErrorMessage(res, t("content.manager.error.import")));
        return;
      }
      const body = (await res.json()) as { data: CsvImportResponse };
      setImportResult(body.data);
    } catch {
      setImportError(t("content.manager.error.import"));
    } finally {
      setImportBusy(false);
    }
  }

  const columns = CONTENT_LIST_COLUMNS[type].filter((c) => c !== "id");
  const typeLabel = contentTypeLabel(t, type);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor={searchInputId}>{contentSearchLabel(t, type)}</Label>
            <Input
              id={searchInputId}
              className="mt-1"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runSearch();
                }
              }}
            />
          </div>
          <Button type="button" variant="outline" onClick={runSearch}>
            {t("content.manager.search")}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setImportOpen((v) => !v)}>
            {t("content.manager.importCsv")}
          </Button>
          <Button type="button" onClick={() => setFormState({ mode: "create" })}>
            {t("content.manager.add", { type: typeLabel })}
          </Button>
        </div>
      </div>

      {importOpen && (
        <div className="mb-4 rounded-lg border border-border bg-card p-4">
          <Label htmlFor={csvInputId}>{t("content.manager.pasteCsvLabel")}</Label>
          <Textarea
            id={csvInputId}
            className="mt-1 min-h-[8rem] font-mono text-xs"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          <div className="mt-2 flex items-center gap-2">
            <Button type="button" onClick={() => void submitImport()} disabled={importBusy || importText.trim().length === 0}>
              {importBusy ? t("content.manager.uploading") : t("content.manager.upload")}
            </Button>
            {importError && (
              <p role="alert" className="text-sm text-danger-strong">
                {importError}
              </p>
            )}
          </div>
          {importResult && (
            <div className="mt-3 text-sm">
              <p className="font-medium text-primary-strong">
                {t("content.manager.importResult.inserted", { count: importResult.inserted })}
              </p>
              {importResult.failed.length > 0 && (
                <ul className="mt-1 space-y-1 text-danger-strong">
                  {importResult.failed.map((f) => (
                    <li key={f.row}>
                      {t("content.manager.importResult.rowError", { row: f.row, errors: f.errors.join(", ") })}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {loadState.status === "error" ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/5 p-4 text-sm text-danger-strong">
          {loadState.message}
        </p>
      ) : loadState.status === "loading" && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tCommon("states.loading")}</p>
      ) : items.length === 0 ? (
        <p className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {t("content.manager.empty", { type: typeLabel.toLowerCase() })}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                {columns.map((c) => (
                  <th key={c} scope="col" className="px-3 py-2 font-medium">
                    {columnLabel(t, type, c)}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("content.columns.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const label = primaryLabel(type, item);
                return (
                  <tr key={item.id} className="border-t border-border">
                    {columns.map((c) => (
                      <td key={c} className="px-3 py-2">
                        {item[c] === null || item[c] === undefined ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          String(item[c])
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          aria-label={t("content.manager.editAria", { label })}
                          onClick={() => setFormState({ mode: "edit", item })}
                        >
                          {t("content.manager.edit")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-danger text-danger-strong hover:bg-danger/10"
                          aria-label={t("content.manager.deleteAria", { label })}
                          onClick={() => setDeleteTarget(item)}
                        >
                          {tCommon("actions.delete")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <Button type="button" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
          {t("content.manager.previous")}
        </Button>
        <span className="text-sm text-muted-foreground">{t("content.manager.pageLabel", { page })}</span>
        <Button type="button" variant="outline" onClick={() => setPage((p) => p + 1)} disabled={!hasMore}>
          {t("content.manager.next")}
        </Button>
      </div>

      {formState && (
        <ContentForm
          type={type}
          mode={formState.mode}
          initialItem={formState.mode === "edit" ? formState.item : undefined}
          knownFields={new Set(CONTENT_LIST_COLUMNS[type])}
          onCancel={() => setFormState(null)}
          onSubmit={(payload) =>
            formState.mode === "create" ? handleCreate(payload) : handleEdit(formState.item.id, payload)
          }
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("content.manager.deleteDialog.title", { type: typeLabel.toLowerCase() })}
        description={
          deleteTarget
            ? t("content.manager.deleteDialog.description", { label: primaryLabel(type, deleteTarget) })
            : ""
        }
        confirmLabel={tCommon("actions.delete")}
        cancelLabel={tCommon("actions.cancel")}
        destructive
        busy={deleteBusy}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
