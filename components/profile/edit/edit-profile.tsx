"use client";

import { useCallback, useEffect, useReducer, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "@/lib/i18n";
import { useRouter } from "@/lib/i18n/navigation";
import { routing, type Locale } from "@/lib/i18n/routing";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { MascotPose } from "@/components/mascot/mascot-pose";
import { Dialog } from "@/components/ui/dialog";
import { profileFieldsSchema } from "@/lib/profile/schema";
import { normalizeUsername, validateUsername } from "@/lib/profile/username";
import type { ProfileView } from "@/lib/profile/view";
import { canonicalTimeZone } from "@/lib/time/study-day";
import { CARD, CARD_WARM, EYEBROW } from "../card-styles";
import { IdentityCard } from "../identity-card";
import { wholeMonths } from "../korumeship-card";
import { AvatarPicker } from "./avatar-picker";
import { BasicSection } from "./basic-section";
import { draftReducer, initialDraft, pickPreferences, toPayload, type Draft } from "./draft";
import { fieldId } from "./field";
import { KorumeSection } from "./korume-section";
import { PreferencesSection } from "./preferences-section";
import { useDirtyGuard } from "./use-dirty-guard";
import { useUsernameAvailability } from "./use-username-availability";

type Avatar = { action: "keep" | "replace" | "remove"; file: File | null; url: string | null };
type Exit = { kind: "saved"; locale: Locale | null } | { kind: "push"; href: string } | { kind: "back" };

/** Codes the catalog has a sentence for; anything else is the generic "check this field". */
const KNOWN_ERRORS = ["format", "reserved", "taken", "too_long", "country", "time_zone", "required"] as const;
type KnownError = (typeof KNOWN_ERRORS)[number];
const isKnown = (code: string): code is KnownError => (KNOWN_ERRORS as readonly string[]).includes(code);
/** Where focus goes first, in reading order; the value is the control's `fieldId` name. */
const FOCUS_ORDER: [field: string, id: string][] = [
  ["displayName", "displayName"], ["username", "username"], ["bio", "bio"], ["country", "country"],
  ["timeZone", "timeZone"], ["nativeLanguage", "nativeLanguage"], ["targetJlptLevel", "targetJlpt"],
  ["dailyMinutes", "dailyGoal"], ["learningGoal", "learningGoal"],
];

export function EditProfile({ view }: { view: ProfileView }) {
  const t = useTranslations("profile");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { setLocal } = usePreferences();

  const [initial] = useState(() => initialDraft(view.identity, locale));
  const [draft, dispatch] = useReducer(draftReducer, initial);
  const [avatar, setAvatar] = useState<Avatar>({ action: "keep", file: null, url: null });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exit, setExit] = useState<Exit | null>(null);
  const [focusName, setFocusName] = useState<string | null>(null);

  const dirty = exit === null && (avatar.action !== "keep" || JSON.stringify(draft) !== JSON.stringify(initial));
  const { pendingHref, setPendingHref } = useDirtyGuard(dirty);
  const usernameStatus = useUsernameAvailability(draft.username, initial.username || null);
  const stayRef = useRef<HTMLButtonElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Object URLs: revoke the previous on replace and the current on unmount.
  const urlRef = useRef<string | null>(null);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);
  const replaceUrl = (next: string | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = next;
  };
  const pickPhoto = (file: File) => {
    const url = URL.createObjectURL(file);
    replaceUrl(url);
    setAvatar({ action: "replace", file, url });
  };
  const removePhoto = () => {
    replaceUrl(null);
    setAvatar({ action: "remove", file: null, url: null });
  };

  const set = useCallback((patch: Partial<Draft>) => {
    dispatch(patch);
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  }, []);

  useEffect(() => {
    if (!focusName) return;
    document.getElementById(fieldId(focusName))?.focus();
    setFocusName(null);
  }, [focusName]);

  // Leaving happens in an effect, after the render that cleared `dirty` has removed the guard's listeners.
  const performed = useRef<Exit | null>(null);
  useEffect(() => {
    if (!exit || performed.current === exit) return;
    performed.current = exit;
    if (exit.kind === "saved") {
      if (exit.locale) router.replace("/profile", { locale: exit.locale });
      else router.push("/profile");
    } else if (exit.kind === "back") window.history.go(-2); // past the guard's sentinel entry
    else {
      // The guard hands over a real URL, locale prefix included; the locale-aware router wants it split.
      const [, prefix, rest] = exit.href.match(/^\/([^/?#]+)(.*)$/) ?? [];
      const target = routing.locales.find((l) => l === prefix);
      if (target) router.push(rest?.startsWith("/") ? rest : `/${rest ?? ""}`, { locale: target });
      else window.location.assign(exit.href);
    }
  }, [exit, router]);

  const message = (field: string, code: string) =>
    isKnown(code) ? t(`edit.errors.${code}`) : field === "displayName" ? t("edit.errors.required") : t("edit.errors.invalid");

  const failWith = (fields: Record<string, string>) => {
    setErrors(fields);
    const first = FOCUS_ORDER.find(([field]) => field in fields);
    if (first) setFocusName(first[1]);
    else setFormError(t("edit.saveFailed"));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const payload = toPayload(draft, avatar.action);
    const parsed = profileFieldsSchema.safeParse(payload.fields);
    if (!parsed.success) {
      const local: Record<string, string> = {};
      for (const issue of parsed.error.issues) local[String(issue.path[0])] ??= issue.message;
      return failWith(local);
    }
    setSaving(true);
    setFormError(null);
    try {
      const body = new FormData();
      body.set("profile", JSON.stringify(payload));
      if (avatar.action === "replace" && avatar.file) body.set("avatar", avatar.file);
      const response = await fetch("/api/profile", { method: "PATCH", body });
      if (response.ok) {
        setLocal(pickPreferences(draft));
        setExit({ kind: "saved", locale: draft.locale !== locale ? draft.locale : null });
        return;
      }
      if (response.status === 400 || response.status === 409) {
        const answer = (await response.json().catch(() => null)) as { fields?: Record<string, string> } | null;
        return failWith(answer?.fields ?? {});
      }
      setFormError(
        response.status === 413 ? t("edit.avatar.errors.size")
        : response.status === 415 ? t("edit.avatar.errors.type")
        : response.status === 422 ? t("edit.avatar.errors.corrupt")
        : response.status === 429 ? t("edit.rateLimited")
        : t("edit.saveFailed"),
      );
    } catch {
      setFormError(t("edit.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  // Field messages: server/local codes in `errors`, plus what the live checks already know.
  const shown: Record<string, string | undefined> = {};
  for (const [field, code] of Object.entries(errors)) shown[field] = message(field, code);
  if (!shown.username) {
    const local = draft.username.trim() === "" ? null : validateUsername(draft.username);
    if (local && !local.ok) shown.username = message("username", local.reason);
    else if (usernameStatus === "taken") shown.username = message("username", "taken");
  }

  const identity = {
    displayName: draft.displayName.trim() || view.identity.displayName,
    username: normalizeUsername(draft.username) || null,
    bio: draft.bio.trim() || null,
    country: draft.country || null,
    nativeLanguage: draft.nativeLanguage || null,
    targetJlptLevel: draft.targetJlptLevel || null,
    timeZone: canonicalTimeZone(draft.timeZone) ?? view.identity.timeZone,
    avatarUrl: avatar.action === "replace" ? avatar.url : avatar.action === "remove" ? null : view.identity.avatarUrl,
    firstKnownLearningAt: view.identity.firstKnownLearningAt,
    subtitle: { translation: draft.readingTranslation, furigana: draft.readingFurigana },
  };
  const since = view.korumeship?.since ?? null;
  const goal = draft.learningGoal.trim();

  return (
    <Container className="py-xl">
      <div className="profile-edit-wrap">
        <header className="mb-lg flex flex-wrap items-end justify-between gap-sm">
          <div>
            <p className={EYEBROW}>{t("edit.eyebrow")}</p>
            <h1 className="text-3xl font-bold">{t("edit.title")}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t("edit.hint")}</p>
        </header>
        <div className="profile-edit">
          <aside className="profile-edit-preview" aria-label={t("edit.previewEyebrow")}>
            <p className={`${EYEBROW} mb-xs`}>{t("edit.previewEyebrow")}</p>
            <IdentityCard identity={identity} variant="preview" interfaceLocale={draft.locale} onChangePhoto={() => fileInput.current?.click()} />
            <div className="profile-edit-extra grid gap-md">
              {draft.companionEnabled && (
                <section className={CARD_WARM} aria-labelledby="profile-edit-current-korume">
                  <h2 id="profile-edit-current-korume" className={EYEBROW}>{t("edit.currentKorume.eyebrow")}</h2>
                  <p className="mt-xs text-xl font-semibold">{t("edit.currentKorume.title")}</p>
                  <p className="mt-2xs text-sm text-muted-foreground">{t("edit.currentKorume.body")}</p>
                </section>
              )}
              {goal && (
                <section className={CARD} aria-labelledby="profile-edit-goal-preview">
                  <h2 id="profile-edit-goal-preview" className={EYEBROW}>{t("goal.eyebrow")}</h2>
                  <blockquote className="mt-sm text-lg leading-relaxed [overflow-wrap:anywhere]">“{goal}”</blockquote>
                </section>
              )}
              {draft.companionEnabled && (
                <section className={`${CARD} flex items-center justify-between gap-sm`} aria-labelledby="profile-edit-relationship">
                  <div>
                    <h2 id="profile-edit-relationship" className={EYEBROW}>{t("edit.relationship.eyebrow")}</h2>
                    <p className="mt-xs text-lg font-semibold">{t("edit.relationship.title")}</p>
                    <p className="mt-2xs text-sm text-muted-foreground">
                      {since ? t("korume.together", { months: wholeMonths(since, identity.timeZone) }) : t("korume.fresh")}
                    </p>
                  </div>
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-icon-md shrink-0 text-primary" fill="currentColor">
                    <path d="M12 20.6 4.6 13.3a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9a4.6 4.6 0 0 1 6.5 6.5L12 20.6Z" />
                  </svg>
                </section>
              )}
            </div>
          </aside>
          <form className={`${CARD} grid gap-md`} aria-labelledby="profile-edit-form-title" noValidate onSubmit={submit}>
            <div>
              <p className={EYEBROW}>{t("edit.formEyebrow")}</p>
              <h2 id="profile-edit-form-title" className="text-2xl font-bold">{t("edit.formTitle")}</h2>
            </div>
            <BasicSection
              draft={draft}
              set={set}
              errors={shown}
              usernameStatus={usernameStatus}
              onTimeZoneBlur={() => {
                if (canonicalTimeZone(draft.timeZone) === null) setErrors((prev) => ({ ...prev, timeZone: "time_zone" }));
              }}
              photo={
                <AvatarPicker input={fileInput} canRemove={view.identity.hasUploadedAvatar && avatar.action !== "remove"} onPick={pickPhoto} onRemove={removePhoto} />
              }
            />
            <PreferencesSection draft={draft} set={set} />
            <KorumeSection draft={draft} set={set} />
            <div className="profile-edit-actions grid gap-xs border-t border-border bg-card py-sm">
              {draft.companionEnabled && (
                <div className="flex items-center gap-sm">
                  <MascotPose pose="edit-footer" size="sm" />
                  <p className="text-caption text-muted-foreground">{t("edit.korumeFooter")}</p>
                </div>
              )}
              {formError && <p role="alert" className="text-caption text-danger-strong">{formError}</p>}
              <p role="status" className="sr-only">{saving ? t("edit.saving") : ""}</p>
              <div className="flex flex-wrap justify-end gap-xs">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => (dirty ? setPendingHref(`/${locale}/profile`) : router.push("/profile"))}
                >
                  {t("edit.cancel")}
                </Button>
                <Button type="submit" disabled={saving} aria-busy={saving}>
                  {saving ? t("edit.saving") : t("edit.save")}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
      <Dialog
        open={pendingHref !== null}
        onClose={() => setPendingHref(null)}
        title={t("edit.dirty.title")}
        description={t("edit.dirty.body")}
        closeLabel={t("edit.dirty.close")}
        initialFocusRef={stayRef}
      >
        <div className="flex flex-wrap justify-end gap-xs">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const href = pendingHref;
              setPendingHref(null);
              if (href) setExit(href === "__back__" ? { kind: "back" } : { kind: "push", href });
            }}
          >
            {t("edit.dirty.leave")}
          </Button>
          <Button type="button" ref={stayRef} onClick={() => setPendingHref(null)}>
            {t("edit.dirty.stay")}
          </Button>
        </div>
      </Dialog>
    </Container>
  );
}
