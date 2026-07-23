"use client";

import { useId, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { JLPT_LEVELS, SCENARIO_IDS, type JlptLevel, type ScenarioId } from "@/lib/conversation-types";

/**
 * Spec §3.6 + §10.5 — the five scenario conversation modes, in display
 * order. Task 15 moved the label/description strings into the
 * `conversation.scenarios.*` catalog — this is now just the id/ordering
 * source (re-exported so `conversation-app.tsx` and `session-history-list.tsx`
 * don't need a second import of `SCENARIO_IDS`).
 */
export const SCENARIOS: readonly ScenarioId[] = SCENARIO_IDS;

export interface ScenarioPickerProps {
  /** `level` is undefined when the user leaves the default (profile) level. */
  onStart: (scenario: ScenarioId, level: JlptLevel | undefined) => void;
  className?: string;
}

/**
 * Resolves a scenario id to its display label — the ONE fallback chain
 * `conversation-app.tsx` (chat header) and `session-history-list.tsx`
 * (history rows) both need, factored here so they don't duplicate it
 * (CONVENTION-#2 hotspot, Task 15 audit): a known id resolves its translated
 * `conversation.scenarios.<id>.label`; an unknown id (a `scenario_type` this
 * build doesn't recognize) renders itself raw; a missing id (null) shows the
 * translated `conversation.scenarios.fallback` ("Conversation"). `t` is
 * passed in rather than called here because a hook can't be called at
 * module scope.
 */
export function scenarioLabel(
  t: ReturnType<typeof useTranslations<"conversation">>,
  scenarioType: string | null,
): string {
  const known = SCENARIOS.find((id) => id === scenarioType);
  if (known) return t(`scenarios.${known}.label`);
  return scenarioType ?? t("scenarios.fallback");
}

/**
 * Scenario + level picker for the voice-conversation feature. Each scenario
 * is its own button (native, so Tab/Enter/Space work for free) rather than a
 * radio + separate submit, since there's nothing else to configure per
 * scenario before starting.
 */
export function ScenarioPicker({ onStart, className }: ScenarioPickerProps) {
  const t = useTranslations("conversation");
  const [level, setLevel] = useState<JlptLevel | "">("");
  const levelId = useId();

  return (
    <div className={cn("space-y-6", className)}>
      <div className="max-w-xs">
        <Label htmlFor={levelId}>{t("picker.levelLabel")}</Label>
        <select
          id={levelId}
          value={level}
          onChange={(e) => setLevel(e.target.value as JlptLevel | "")}
          className="mt-1 flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
        >
          <option value="">{t("picker.useProfileLevel")}</option>
          {JLPT_LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SCENARIOS.map((id) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => onStart(id, level === "" ? undefined : level)}
              className="w-full"
            >
              <Card className="h-full p-4 text-left transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                <p className="font-jp font-semibold">{t(`scenarios.${id}.label`)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(`scenarios.${id}.description`)}
                </p>
              </Card>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
