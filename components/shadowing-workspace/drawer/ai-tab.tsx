"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { KNOWLEDGE_SECTIONS, OPENING_SECTION, PHRASE_SECTION, SECTION_VIEW } from "@/lib/knowledge/types";
import { cn } from "@/lib/utils";
import { useAiKnowledge } from "./ai-knowledge-context";
import { AiSectionBody } from "./ai-section";
import { AiUsage } from "./ai-usage";
import { useDrawer } from "./drawer-context";

const LAZY_SECTIONS = KNOWLEDGE_SECTIONS.filter((section) => section !== OPENING_SECTION);

/**
 * AI (spec §6.4): the usage line, the phrase analysis when the target is a span, the opening section, then the
 * other eight as a lazy accordion. The opening generations were started by the ✨ click that opened this tab
 * (DrawerProvider); here a generation starts only when the learner expands an item or presses a button. A
 * target that changes while following shows a Generate button — playback never spends.
 */
export function AiTab() {
  const t = useTranslations("shadowing");
  const { state, target } = useDrawer();
  const { result, request, usage, loadUsage, completed } = useAiKnowledge();
  const baseId = useId();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(state.aiSection ? [state.aiSection] : []));
  const [shortcut, setShortcut] = useState(state.aiSection);
  if (state.aiSection !== shortcut) {
    // Grammar's "AI Grammar Breakdown →" (or another shortcut) opens its item; the click already requested it.
    setShortcut(state.aiSection);
    if (state.aiSection) setExpanded((current) => new Set(current).add(state.aiSection as string));
  }
  useEffect(loadUsage, [loadUsage]);

  if (!target) return null;
  const sentence = { lineId: target.lineId, span: null };
  const title = (section: keyof typeof SECTION_VIEW) => t(`workspace.ai.sections.${section}`);
  const toggle = (section: string) => {
    const open = !expanded.has(section);
    setExpanded((current) => {
      const next = new Set(current);
      if (open) next.add(section); else next.delete(section);
      return next;
    });
    if (open) request(sentence, section);
  };

  return (
    <div className="space-y-sm">
      <AiUsage usage={usage} />
      <p role="status" className="sr-only">{completed ? t("workspace.ai.ready", { section: title(completed.section as keyof typeof SECTION_VIEW) }) : ""}</p>
      {target.span && (
        <section aria-label={title(PHRASE_SECTION)} className="space-y-2xs rounded-md border border-border p-sm">
          <h3 className="text-body font-semibold text-foreground">{title(PHRASE_SECTION)}</h3>
          <AiSectionBody view={SECTION_VIEW[PHRASE_SECTION]} result={result(target, PHRASE_SECTION)} onRequest={(force) => request(target, PHRASE_SECTION, { force })} />
        </section>
      )}
      <section aria-label={title(OPENING_SECTION)} className="space-y-2xs rounded-md border border-border p-sm">
        <h3 className="text-body font-semibold text-foreground">{title(OPENING_SECTION)}</h3>
        <AiSectionBody view={SECTION_VIEW[OPENING_SECTION]} result={result(sentence, OPENING_SECTION)} onRequest={(force) => request(sentence, OPENING_SECTION, { force })} />
      </section>
      <ul className="divide-y divide-border rounded-md border border-border">
        {LAZY_SECTIONS.map((section) => {
          const open = expanded.has(section);
          const current = result(sentence, section);
          const panelId = `${baseId}-${section}`;
          return (
            <li key={section}>
              <h3>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => toggle(section)}
                  className="flex w-full items-center justify-between gap-xs px-sm py-xs text-left text-body font-medium text-foreground hover:bg-muted"
                >
                  <span>
                    {current?.status === "ready" && current.access === "preview" && <span aria-hidden="true">🔒 </span>}
                    {title(section)}
                  </span>
                  <span aria-hidden="true" className={cn("text-muted-foreground transition-transform", open && "rotate-90")}>›</span>
                </button>
              </h3>
              {open && (
                <div id={panelId} className="px-sm pb-sm">
                  <AiSectionBody view={SECTION_VIEW[section]} result={current} onRequest={(force) => request(sentence, section, { force })} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
