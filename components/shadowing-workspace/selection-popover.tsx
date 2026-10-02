"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from "react";
import { useTranslations } from "@/lib/i18n";
import { snapSpanToTokens } from "@/lib/analysis/spans";
import type { Utf16Span } from "@/lib/analysis/types";
import { caretToOffset, selectionToSpan } from "@/lib/shadowing-workspace/selection-offsets";
import { cn } from "@/lib/utils";
import { AnchoredPopover } from "@/components/ui/popover";
import { useDrawer } from "./drawer/drawer-context";
import { PhraseCard } from "./drawer/phrase-card";
import { WordCard } from "./drawer/word-card";
import { BookmarkGlyph, PlayGlyph } from "./player-glyphs";
import { useLineAnalysis } from "./use-line-analysis";
import { useLesson, useMarks, usePlaybackController } from "./workspace-context";

/** The existing mining API's limit (`lib/validation/mining.ts` targetWord max). */
const MINING_MAX = 50;
const ACTION = "inline-flex h-control-sm items-center gap-2xs rounded-md border border-border px-sm text-caption font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 aria-pressed:text-primary-strong";

interface Opened {
  lineId: string;
  /** A selection's span, or — for a Live Sentence click — the caret offset of the word to show. */
  at: { span: Utf16Span } | { offset: number };
  anchor: DOMRect;
  /** Where focus returns on close: the text the learner selected in. */
  returnFocus: HTMLElement | null;
}

/**
 * The selection popover's host (spec §6.3). It listens to the workspace: a selection inside one sentence
 * opens it; a plain click on a Live Sentence word opens that word. Everything shown is fixed when it opens,
 * so a popover on Live Sentence keeps its content after the sentence advances.
 */
export function SelectionPopoverHost({ workspaceRef }: { workspaceRef: RefObject<HTMLElement> }) {
  const [opened, setOpened] = useState<Opened | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    // Live Sentence and its transcript row share a line id: focus returns to the one the learner used.
    const lineElementOf = (node: Node) => (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>("[data-line-id]") ?? null;
    const fromSelection = (event: Event) => {
      if (event.target instanceof Node && contentRef.current?.contains(event.target)) return;
      const selection = document.getSelection();
      const picked = selectionToSpan(selection, workspace);
      if (!picked || !selection) return;
      const range = selection.getRangeAt(0);
      const line = lineElementOf(range.startContainer);
      setOpened({
        lineId: picked.lineId,
        at: { span: picked.span },
        // Ranges without layout (jsdom) fall back to the line's box.
        anchor: typeof range.getBoundingClientRect === "function" ? range.getBoundingClientRect() : line?.getBoundingClientRect() ?? new DOMRect(),
        returnFocus: line,
      });
    };
    const fromWordClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest("[data-word-click]")) return;
      const selection = document.getSelection();
      const caret = caretToOffset(selection, workspace);
      if (!caret || !selection) return;
      const target = event.target;
      setOpened({ lineId: caret.lineId, at: { offset: caret.offset }, anchor: target.getBoundingClientRect(), returnFocus: lineElementOf(target) });
    };
    document.addEventListener("mouseup", fromSelection);
    document.addEventListener("keyup", fromSelection);
    document.addEventListener("click", fromWordClick);
    return () => {
      document.removeEventListener("mouseup", fromSelection);
      document.removeEventListener("keyup", fromSelection);
      document.removeEventListener("click", fromWordClick);
    };
  }, [workspaceRef]);

  if (!opened) return null;
  return <SelectionPopover key={`${opened.lineId}:${JSON.stringify(opened.at)}`} opened={opened} contentRef={contentRef} onClose={() => setOpened(null)} />;
}

function SelectionPopover({ opened, contentRef, onClose }: { opened: Opened; contentRef: MutableRefObject<HTMLDivElement | null>; onClose(): void }) {
  const t = useTranslations("shadowing");
  const tMining = useTranslations("mining");
  const { lines } = useLesson();
  const controller = usePlaybackController();
  const marks = useMarks();
  const { dispatch } = useDrawer();
  const index = lines.findIndex((line) => line.id === opened.lineId);
  const line = lines[index];
  const analysis = useLineAnalysis(opened.lineId);

  // The selection as the server will read it: snapped to whole tokens once the analysis is here.
  const resolved = useMemo(() => {
    if (!line || analysis?.status !== "ready") return null;
    const { tokens } = analysis.analysis;
    const touched = "span" in opened.at
      ? (() => {
        const snapped = snapSpanToTokens(line.textJp, tokens, opened.at.span);
        return snapped ? tokens.filter((token) => token.span.start >= snapped.start && token.span.end <= snapped.end && token.surface.trim()) : [];
      })()
      : tokens.filter((token) => "offset" in opened.at && token.span.start <= opened.at.offset && opened.at.offset < token.span.end);
    const first = touched[0];
    const last = touched[touched.length - 1];
    if (!first || !last) return null;
    const span = { start: first.span.start, end: last.span.end };
    return { span, text: line.textJp.slice(span.start, span.end), word: touched.length === 1 ? first : null };
  }, [analysis, line, opened.at]);

  const selectedText = line && "span" in opened.at ? line.textJp.slice(opened.at.span.start, opened.at.span.end) : resolved?.text ?? "";
  const target = { lineId: opened.lineId, span: resolved?.span ?? ("span" in opened.at ? opened.at.span : null) };
  const close = () => onClose();

  const [mining, setMining] = useState<{ status: "idle" | "submitting" | "done" | "error"; message: string }>({ status: "idle", message: "" });
  const tooLong = Array.from(selectedText).length > MINING_MAX;
  const mine = async () => {
    setMining({ status: "submitting", message: "" });
    try {
      const response = await fetch("/api/mining", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineId: opened.lineId, targetWord: selectedText }),
      });
      if (response.status === 201) return setMining({ status: "done", message: tMining("mine.added", { word: selectedText }) });
      const retryAfter = response.headers.get("Retry-After");
      setMining({
        status: "error",
        message: response.status === 429 ? (retryAfter ? tMining("mine.rateLimited", { seconds: retryAfter }) : tMining("mine.rateLimitedGeneric")) : tMining("mine.error"),
      });
    } catch {
      setMining({ status: "error", message: tMining("mine.error") });
    }
  };
  const bookmarked = marks.isMarked(opened.lineId, "bookmark");

  return (
    <AnchoredPopover
      anchor={opened.anchor}
      onClose={close}
      label={t("workspace.drawer.selection", { text: selectedText })}
      contentRef={(node) => { contentRef.current = node; }}
      data-selection-popover=""
      // Opening never moves focus away from the text the learner is selecting in.
      onOpenAutoFocus={(event) => event.preventDefault()}
      onCloseAutoFocus={(event) => { event.preventDefault(); opened.returnFocus?.focus(); }}
      className="w-[min(calc(100vw-var(--space-2xl)),var(--selection-popover-width))] space-y-sm"
    >
      {analysis?.status === "error" && <p className="text-body text-muted-foreground">{t("workspace.selection.failed")}</p>}
      {(!analysis || analysis.status === "loading") && <p role="status" className="text-body text-muted-foreground">{t("workspace.selection.loading")}</p>}
      {resolved?.word && (
        <WordCard
          token={resolved.word}
          onOpenKanji={(literal) => { dispatch({ type: "open-kanji", literal, target }); close(); }}
        />
      )}
      {resolved && !resolved.word && (
        <PhraseCard text={resolved.text} onAnalyze={() => { dispatch({ type: "open", tab: "ai", target }); close(); }} />
      )}
      <div className="flex flex-wrap gap-2xs border-t border-border pt-sm">
        <button type="button" className={ACTION} onClick={() => { if (index >= 0) controller.seekToSentence(index, { play: true }); }}>
          <PlayGlyph className="size-icon-xs" />
          {t("workspace.selection.play")}
        </button>
        <button
          type="button"
          aria-pressed={bookmarked}
          disabled={marks.pending(`mark:${opened.lineId}:bookmark`)}
          className={ACTION}
          onClick={() => marks.toggleMark(opened.lineId, "bookmark")}
        >
          <BookmarkGlyph filled={bookmarked} className="size-icon-xs" />
          {t("workspace.selection.bookmark")}
        </button>
        <button
          type="button"
          disabled={tooLong || selectedText.length === 0 || mining.status === "submitting" || mining.status === "done"}
          aria-describedby={tooLong ? "selection-mining-reason" : undefined}
          className={cn(ACTION)}
          onClick={() => void mine()}
        >
          {t("workspace.selection.mine")}
        </button>
      </div>
      {tooLong && <p id="selection-mining-reason" className="text-caption text-muted-foreground">{t("workspace.selection.mineTooLong", { max: MINING_MAX })}</p>}
      {mining.message && <p role="status" className="text-caption text-muted-foreground">{mining.message}</p>}
    </AnchoredPopover>
  );
}
