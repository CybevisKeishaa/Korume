"use client";

import { useId } from "react";
import { useTranslations } from "@/lib/i18n";
import type { NoteSaveStatus } from "@/lib/shadowing-workspace/note-autosave";
import { useLesson, usePlaybackController } from "../workspace-context";
import { useDrawer } from "./drawer-context";
import { lessonNoteKey, sentenceNoteKey, useNotes } from "./notes-context";

const SENTENCE_NOTE_MAX = 4000;
const LESSON_NOTE_MAX = 20000;
const FIELD = "block w-full resize-y rounded-md border border-border bg-background px-sm py-xs text-body text-foreground placeholder:text-muted-foreground";

function SaveStatus({ status, onRetry }: { status: NoteSaveStatus; onRetry(): void }) {
  const t = useTranslations("shadowing");
  if (status === "idle") return null;
  return (
    <p role="status" className="text-caption text-muted-foreground">
      {t(`workspace.notes.status.${status}`)}
      {status === "failed" && (
        <>
          {" "}
          <button type="button" onClick={onRetry} className="font-medium text-primary-strong underline-offset-2 hover:underline">{t("workspace.notes.retry")}</button>
        </>
      )}
    </p>
  );
}

function NoteEditor({ noteKey, label, max, onStart }: { noteKey: string; label: string; max: number; onStart?(): void }) {
  const t = useTranslations("shadowing");
  const id = useId();
  const notes = useNotes();
  return (
    <div className="space-y-2xs">
      <label htmlFor={id} className="text-caption font-medium text-muted-foreground">{label}</label>
      <textarea
        id={id}
        value={notes.body(noteKey)}
        maxLength={max}
        rows={3}
        placeholder={t("workspace.notes.placeholder")}
        onFocus={onStart}
        onChange={(event) => notes.change(noteKey, event.target.value)}
        onBlur={() => void notes.flush(noteKey)}
        className={FIELD}
      />
      <SaveStatus status={notes.status(noteKey)} onRetry={() => void notes.flush(noteKey)} />
    </div>
  );
}

/**
 * Notes (spec §6.4): the target's note, the lesson note, then every note in the lesson (a note seeks). The
 * sentence note always saves to the drawer's target — writing while following pins that sentence first, so
 * playback moving on can never move the note to another line (Review Focus 2).
 */
export function NotesTab() {
  const t = useTranslations("shadowing");
  const { state, dispatch, target } = useDrawer();
  const { video, lines } = useLesson();
  const controller = usePlaybackController();
  const notes = useNotes();
  const index = target ? lines.findIndex((line) => line.id === target.lineId) : -1;
  const all = [...notes.sentenceNotes()]
    .map(([lineId, body]) => ({ lineId, body, index: lines.findIndex((line) => line.id === lineId) }))
    .filter((note) => note.index >= 0)
    .sort((a, b) => a.index - b.index);

  return (
    <div className="space-y-md">
      {target && index >= 0 && (
        <NoteEditor
          // A new key remounts the editor: a note typed for one line never carries over to the next.
          key={target.lineId}
          noteKey={sentenceNoteKey(target.lineId)}
          label={t("workspace.notes.sentence", { number: index + 1 })}
          max={SENTENCE_NOTE_MAX}
          onStart={() => { if (state.tracking === "follow") dispatch({ type: "open", tab: "notes", target: { lineId: target.lineId, span: null } }); }}
        />
      )}
      <NoteEditor noteKey={lessonNoteKey(video.id)} label={t("workspace.notes.lesson")} max={LESSON_NOTE_MAX} />
      <section aria-label={t("workspace.notes.all")} className="space-y-2xs">
        <p className="text-caption font-medium text-muted-foreground">{t("workspace.notes.all")}</p>
        {all.length === 0 ? (
          <p className="text-body text-muted-foreground">{t("workspace.notes.none")}</p>
        ) : (
          <ul className="space-y-2xs">
            {all.map((note) => (
              <li key={note.lineId}>
                <button
                  type="button"
                  onClick={() => controller.seekToSentence(note.index)}
                  className="flex w-full flex-col items-start gap-2xs rounded-md px-xs py-2xs text-left hover:bg-muted"
                >
                  <span className="text-caption text-muted-foreground">
                    {t("workspace.transcript.lineNumber", { number: note.index + 1 })} · <span lang="ja" className="font-jp">{lines[note.index]?.textJp}</span>
                  </span>
                  <span className="line-clamp-2 whitespace-pre-wrap text-body text-foreground">{note.body}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
