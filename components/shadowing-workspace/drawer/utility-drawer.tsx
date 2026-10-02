"use client";

import type { RefObject } from "react";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { RubySentence } from "../ruby-sentence";
import { useLesson, usePreferences } from "../workspace-context";
import { AiTab } from "./ai-tab";
import { useDrawer } from "./drawer-context";
import { DRAWER_PANEL_ID, DrawerHeader, drawerTabId } from "./drawer-header";
import { DrawerSeparator } from "./drawer-separator";
import { GrammarTab } from "./grammar-tab";
import { MiningTab } from "./mining-tab";
import { NotesTab } from "./notes-tab";
import { VocabularyTab } from "./vocabulary-tab";

/**
 * The Utility Drawer (spec §6.1): a band under both columns. The shell sizes its grid row; this renders the
 * resize handle, the header and — unless collapsed — the selected tab about the drawer's target.
 */
export function UtilityDrawer({ workspaceRef, headerRef }: {
  workspaceRef: RefObject<HTMLElement>;
  headerRef: RefObject<HTMLElement>;
}) {
  const t = useTranslations("shadowing");
  const { state, dispatch, target } = useDrawer();
  const { lines } = useLesson();
  const { preferences } = usePreferences();
  const line = target ? lines.find((candidate) => candidate.id === target.lineId) ?? null : null;
  const open = state.level !== "collapsed";

  return (
    <section
      role="region"
      aria-label={t("workspace.drawer.region")}
      data-drawer-level={state.level}
      className={cn("reading-surface flex min-h-0 flex-col border-t border-border", !preferences.reduceMotion && "transition-[height]")}
    >
      <DrawerSeparator
        level={state.level}
        dispatch={dispatch}
        workspaceRef={workspaceRef}
        headerRef={headerRef}
        label={t("workspace.drawer.separator")}
        valueText={t(`workspace.drawer.levels.${state.level}`)}
        controls={DRAWER_PANEL_ID}
      />
      <DrawerHeader />
      {open && (
        <div
          role="tabpanel"
          id={DRAWER_PANEL_ID}
          aria-labelledby={drawerTabId(state.tab)}
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto px-md pb-md pt-xs"
        >
          {line && (
            // A span shows exactly the selected characters: the line's ruby segments do not cut at a span.
            <RubySentence
              segments={target?.span ? null : line.furigana}
              text={target?.span ? line.textJp.slice(target.span.start, target.span.end) : line.textJp}
              mode={preferences.readingFurigana}
              override={undefined}
              className="reading-jp-body-lg reading-foreground"
            />
          )}
          <div className="mt-sm">
            {state.tab === "vocabulary" && <VocabularyTab />}
            {state.tab === "grammar" && <GrammarTab />}
            {state.tab === "mining" && <MiningTab />}
            {state.tab === "notes" && <NotesTab />}
            {state.tab === "ai" && <AiTab />}
          </div>
        </div>
      )}
    </section>
  );
}
