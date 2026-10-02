"use client";

import { useRef, type KeyboardEvent } from "react";
import { useTranslations } from "@/lib/i18n";
import { DRAWER_TABS, type DrawerTab } from "@/lib/shadowing-workspace/drawer-state";
import { cn } from "@/lib/utils";
import { useLesson } from "../workspace-context";
import { useDrawer } from "./drawer-context";

const CONTROL = "flex h-control-sm items-center rounded-md px-sm text-caption text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:text-primary-strong";

export const drawerTabId = (tab: DrawerTab) => `workspace-drawer-tab-${tab}`;
export const DRAWER_PANEL_ID = "workspace-drawer-panel";

/** The two tabs, Mining and Notes (a roving-focus tablist), the target label and its Follow / level controls (spec §6.1–6.2). */
export function DrawerHeader() {
  const t = useTranslations("shadowing");
  const { state, dispatch, target } = useDrawer();
  const { lines } = useLesson();
  const tabRefs = useRef(new Map<DrawerTab, HTMLButtonElement>());
  const index = target ? lines.findIndex((line) => line.id === target.lineId) : -1;
  const label = index < 0
    ? t("workspace.drawer.noTarget")
    : t(state.tracking === "pinned" ? "workspace.drawer.pinnedTarget" : "workspace.drawer.following", { number: index + 1, total: lines.length });
  const open = state.level !== "collapsed";

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, tab: DrawerTab) => {
    const at = DRAWER_TABS.indexOf(tab);
    const next = event.key === "ArrowRight" ? DRAWER_TABS[(at + 1) % DRAWER_TABS.length]
      : event.key === "ArrowLeft" ? DRAWER_TABS[(at - 1 + DRAWER_TABS.length) % DRAWER_TABS.length]
        : event.key === "Home" ? DRAWER_TABS[0]
          : event.key === "End" ? DRAWER_TABS[DRAWER_TABS.length - 1]
            : undefined;
    if (!next) return;
    event.preventDefault();
    dispatch({ type: "select-tab", tab: next });
    tabRefs.current.get(next)?.focus();
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-md gap-y-2xs px-md">
      <div role="tablist" aria-label={t("workspace.drawer.tabList")} className="flex items-center gap-2xs">
        {DRAWER_TABS.map((tab) => {
          const selected = state.tab === tab;
          return (
            <button
              key={tab}
              ref={(node) => { if (node) tabRefs.current.set(tab, node); else tabRefs.current.delete(tab); }}
              type="button"
              role="tab"
              id={drawerTabId(tab)}
              aria-selected={selected}
              aria-controls={open ? DRAWER_PANEL_ID : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => dispatch({ type: "select-tab", tab })}
              onKeyDown={(event) => onTabKey(event, tab)}
              className={cn(
                "flex h-control-sm items-center rounded-md px-sm text-caption font-medium transition-colors",
                selected && open ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t(`workspace.drawer.tabs.${tab}`)}
            </button>
          );
        })}
      </div>
      <p className="min-w-0 flex-1 truncate text-caption text-muted-foreground" aria-live="polite">
        {label}
        {state.tracking === "pinned" && <span className="ml-2xs text-primary-strong">· {t("workspace.drawer.pinned")}</span>}
      </p>
      <div className="flex items-center gap-2xs">
        {state.tracking === "pinned" && (
          <button type="button" onClick={() => dispatch({ type: "follow" })} className={CONTROL}>
            {t("workspace.drawer.follow")}
          </button>
        )}
        <button
          type="button"
          aria-pressed={state.level === "maximized"}
          onClick={() => dispatch({ type: "set-level", level: state.level === "maximized" ? "expanded" : "maximized" })}
          className={CONTROL}
        >
          {t("workspace.drawer.fullscreen")}
        </button>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? DRAWER_PANEL_ID : undefined}
          onClick={() => dispatch(open ? { type: "collapse" } : { type: "set-level", level: "peek" })}
          className={CONTROL}
        >
          {t(open ? "workspace.drawer.collapse" : "workspace.drawer.open")}
        </button>
      </div>
    </div>
  );
}
