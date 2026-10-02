"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import { createNoteAutosave, type NoteSaveStatus } from "@/lib/shadowing-workspace/note-autosave";

export const sentenceNoteKey = (lineId: string) => `sentence:${lineId}`;
export const lessonNoteKey = (videoId: string) => `lesson:${videoId}`;

/**
 * This tab's own note edits, kept for the tab's lifetime: the bootstrap sits in Next's client router cache, so
 * a learner who types a note, leaves and comes back (client-side) would otherwise see the note from before.
 * ponytail: tab-scoped like 1a's tabWrites; another device's newer note is masked until a full reload.
 */
const tabNoteWrites = new Map<string, string>();

export function resetNoteWritesForTests(): void {
  tabNoteWrites.clear();
}

async function sendNote(key: string, body: string): Promise<void> {
  const [kind, id] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
  const response = kind === "sentence"
    ? await fetch("/api/sentence-notes", {
      method: body ? "PUT" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ? { transcriptLineId: id, body } : { transcriptLineId: id }),
    })
    : await fetch(`/api/videos/${id}/notes`, body
      ? { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) }
      : { method: "DELETE" });
  if (!response.ok) throw new Error(`note ${response.status}`);
}

interface NotesValue {
  body(key: string): string;
  change(key: string, body: string): void;
  flush(key: string): Promise<void>;
  status(key: string): NoteSaveStatus;
  hasNote(lineId: string): boolean;
  /** Every non-empty sentence note, by line id. */
  sentenceNotes(): Map<string, string>;
}

const NotesContext = createContext<NotesValue | null>(null);

/** Notes for one lesson (spec §5.5): bootstrap bodies, live edits, and the serialised autosave. */
export function NotesProvider({ bootstrap, children }: { bootstrap: WorkspaceBootstrap; children: ReactNode }) {
  const [bodies, setBodies] = useState(() => {
    const initial = new Map<string, string>();
    if (bootstrap.notes.lessonNote) initial.set(lessonNoteKey(bootstrap.video.id), bootstrap.notes.lessonNote.body);
    for (const note of bootstrap.notes.sentenceNotes) if (note.lineId) initial.set(sentenceNoteKey(note.lineId), note.body);
    for (const [key, body] of tabNoteWrites) initial.set(key, body);
    return initial;
  });
  const [autosave] = useState(() => createNoteAutosave(sendNote));
  // A save-status change (saving → saved / failed) re-renders the status lines.
  const [statusTick, setStatusTick] = useState(0);
  useEffect(() => autosave.subscribe(() => setStatusTick((tick) => tick + 1)), [autosave]);

  const value = useMemo((): NotesValue => ({
    body: (key) => bodies.get(key) ?? "",
    change: (key, body) => {
      tabNoteWrites.set(key, body);
      setBodies((previous) => new Map(previous).set(key, body));
      autosave.change(key, body);
    },
    flush: (key) => autosave.flush(key),
    status: (key) => autosave.status(key),
    hasNote: (lineId) => (bodies.get(sentenceNoteKey(lineId)) ?? "") !== "",
    sentenceNotes: () => new Map([...bodies].flatMap(([key, body]) => (key.startsWith("sentence:") && body ? [[key.slice("sentence:".length), body]] : []))),
  // statusTick invalidates the value when only a save status changed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [autosave, bodies, statusTick]);
  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes(): NotesValue {
  const value = useContext(NotesContext);
  if (value === null) throw new Error("useNotes must be used within NotesProvider");
  return value;
}

export function useOptionalNotes(): NotesValue | null {
  return useContext(NotesContext);
}
