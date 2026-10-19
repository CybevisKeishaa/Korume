"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRecorder } from "@/components/video-player/recorder";
import { blobToWav16kMono } from "@/lib/audio/blob-to-wav";
import { comparePitchToReference } from "@/components/video-player/pitch-comparison";
import type { PitchAccentScore } from "@/lib/pitch";
import { takeLimitSeconds } from "@/lib/pronunciation/take-limit";
import { useLesson, usePlaybackController } from "../workspace-context";
import { usePronunciationAttempts } from "./pronunciation-attempts-context";

interface Operation { lineId: string; text: string; limit: number; cancelled: boolean; processing: boolean }

/** Capture owns only pre-201 work; scoring is addressed by the resulting session. */
export function usePronunciationCapture(onSaved: (sessionId: string, lineId: string) => void) {
  const recorder = useRecorder();
  const { video, lines } = useLesson();
  const controller = usePlaybackController();
  const { attempts, dispatch } = usePronunciationAttempts();
  const latest = useRef({ attempts, recorder, onSaved });
  latest.current = { attempts, recorder, onSaved };
  const mounted = useRef(true);
  const operation = useRef<Operation | null>(null);
  const autoStop = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [supported, setSupported] = useState(true);
  useEffect(() => { setSupported(typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia); }, []);

  const clearAutoStop = useCallback(() => {
    if (autoStop.current !== null) clearTimeout(autoStop.current);
    autoStop.current = null;
  }, []);
  const valid = useCallback((op: Operation) => mounted.current && operation.current === op && !op.cancelled, []);
  // A save outlives this body: the store is the shell's, and dropping a 201 would make "Save again" a second row.
  const current = useCallback((op: Operation) => operation.current === op && !op.cancelled, []);
  const save = useCallback(async (op: Operation, wav: Blob, pitch: PitchAccentScore | null) => {
    if (!valid(op)) return;
    dispatch({ type: "saving", lineId: op.lineId });
    const form = new FormData();
    form.append("videoId", video.id); form.append("lineId", op.lineId); form.append("audio", wav, "take.wav");
    if (pitch) form.append("pitchScore", String(Math.round(pitch.score)));
    try {
      const response = await fetch("/api/shadowing/session", { method: "POST", body: form });
      if (!current(op)) return;
      if (response.status !== 201) throw new Error("save failed");
      const { data } = await response.json() as { data: { id: string; signedUrl: string } };
      if (!current(op)) return;
      dispatch({ type: "saved", lineId: op.lineId, sessionId: data.id, signedUrl: data.signedUrl });
      op.cancelled = true;
      latest.current.onSaved(data.id, op.lineId);
    } catch {
      if (current(op)) dispatch({ type: "save-failed", lineId: op.lineId });
    }
  }, [current, dispatch, valid, video.id]);

  const convert = useCallback(async (op: Operation, original: Blob) => {
    if (!valid(op)) return;
    op.processing = true;
    dispatch({ type: "recorded", lineId: op.lineId, original });
    let wav: Blob;
    try { wav = await blobToWav16kMono(original, { maxSeconds: op.limit }); }
    catch { if (valid(op)) dispatch({ type: "convert-failed", lineId: op.lineId }); return; }
    if (!valid(op)) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const pitch = await Promise.race([
      Promise.resolve().then(() => comparePitchToReference(original, op.text)).catch(() => null),
      new Promise<null>((resolve) => { timeout = setTimeout(() => resolve(null), 3000); }),
    ]);
    clearTimeout(timeout);
    if (!valid(op)) return;
    dispatch({ type: "converted", lineId: op.lineId, wav, pitch });
    // Dispatch is asynchronous: pass this take's WAV directly, never reread the old render.
    await save(op, wav, pitch);
  }, [dispatch, save, valid]);

  const makeOperation = useCallback((index: number): Operation | null => {
    const line = lines[index];
    if (!line) return null;
    if (operation.current) operation.current.cancelled = true;
    const op = { lineId: line.id, text: line.textJp, limit: takeLimitSeconds(lines, index, video.durationSeconds), cancelled: false, processing: false };
    operation.current = op;
    return op;
  }, [lines, video.durationSeconds]);

  const start = useCallback(async (index: number) => {
    const op = makeOperation(index);
    if (!op) return;
    clearAutoStop();
    controller.pause();
    recorder.reset();
    dispatch({ type: "start", lineId: op.lineId });
    try { await recorder.start(); }
    catch { if (valid(op)) { op.cancelled = true; dispatch({ type: "discard", lineId: op.lineId }); } }
  }, [clearAutoStop, controller, dispatch, makeOperation, recorder, valid]);

  const stop = useCallback(() => { clearAutoStop(); latest.current.recorder.stop(); }, [clearAutoStop]);
  useEffect(() => {
    const op = operation.current;
    if (!op || op.cancelled) return;
    if (recorder.state === "recording") {
      autoStop.current = setTimeout(stop, op.limit * 1000);
      return clearAutoStop;
    }
    if (recorder.state === "recorded" && recorder.blob && !op.processing) void convert(op, recorder.blob);
    if (recorder.state === "error" || recorder.state === "disabled-in-settings") {
      op.cancelled = true;
      dispatch({ type: "discard", lineId: op.lineId });
    }
  }, [clearAutoStop, convert, dispatch, recorder.state, recorder.blob, stop]);
  useEffect(() => {
    const op = operation.current;
    if (!op || op.cancelled || attempts[op.lineId]) return;
    op.cancelled = true;
    clearAutoStop();
    const { recorder: live } = latest.current;
    if (live.state === "recording" || live.state === "requesting-permission") live.reset();
  }, [attempts, clearAutoStop]);
  useEffect(() => {
    if (recorder.state !== "recording") return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); stop(); } };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [recorder.state, stop]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearAutoStop();
      const op = operation.current;
      if (!op) return;
      if (!op.cancelled && latest.current.attempts[op.lineId]?.phase === "saving") return;
      const wasPending = !op.cancelled;
      op.cancelled = true;
      latest.current.recorder.stop();
      if (!wasPending) return;
      const attempt = latest.current.attempts[op.lineId];
      if (attempt?.phase === "recording") dispatch({ type: "discard", lineId: op.lineId });
      if (attempt?.phase === "converting") dispatch({ type: "convert-failed", lineId: op.lineId });
    };
  }, [clearAutoStop, dispatch]);

  const retry = (index: number) => {
    const line = lines[index];
    const attempt = line ? attempts[line.id] : undefined;
    const op = makeOperation(index);
    if (!op || !attempt) return;
    if (attempt.wav) void save(op, attempt.wav, attempt.pitch);
    else if (attempt.original) void convert(op, attempt.original);
  };
  return { recorder, supported, start, stop, retry };
}
