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
import { CARD, EYEBROW } from "../card-styles";
import { EditPreview } from "./edit-preview";
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
  const [usernameTouched, setUsernameTouched] = useState(false);

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

  const undoPhoto = () => {
    replaceUrl(null);
    setAvatar({ action: "keep", file: null, url: null });
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
      // Next's client cache would otherwise serve the old /profile (name, avatar) for its dynamic stale window.
      router.refresh();
    } else if (exit.kind === "back") {
      // Past the guard's sentinel entry; a fresh tab has nothing below this page, so go to /profile instead.
      if (window.history.length > 2) window.history.go(-2);
      else router.push("/profile");
    } else {
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
    let leaving = false;
    try {
      const body = new FormData();
      body.set("profile", JSON.stringify(payload));
      if (avatar.action === "replace" && avatar.file) body.set("avatar", avatar.file);
      const response = await fetch("/api/profile", { method: "PATCH", body });
      if (response.ok) {
        setLocal(pickPreferences(draft));
        leaving = true; // Save stays busy until the page is gone: no second PATCH during navigation
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
        : response.status === 401 ? t("edit.signedOut")
        : t("edit.saveFailed"),
      );
    } catch {
      setFormError(t("edit.saveFailed"));
    } finally {
      if (!leaving) setSaving(false);
    }
  };

  // Field messages: server/local codes in `errors`, plus what the live checks already know.
  const shown: Record<string, string | undefined> = {};
  for (const [field, code] of Object.entries(errors)) shown[field] = message(field, code);
  if (!shown.username) {
    const local = !usernameTouched || draft.username.trim() === "" ? null : validateUsername(draft.username);
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
          <EditPreview
            identity={identity}
            interfaceLocale={draft.locale}
            companionEnabled={draft.companionEnabled}
            goal={goal}
            since={since}
            onChangePhoto={() => fileInput.current?.click()}
          />
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
              onUsernameBlur={() => setUsernameTouched(true)}
              onTimeZoneBlur={() => {
                if (canonicalTimeZone(draft.timeZone) === null) setErrors((prev) => ({ ...prev, timeZone: "time_zone" }));
              }}
              photo={
                <AvatarPicker input={fileInput} canRemove={view.identity.hasUploadedAvatar && avatar.action !== "remove"} canUndo={avatar.action !== "keep"} onUndo={undoPhoto} onPick={pickPhoto} onRemove={removePhoto} />
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
