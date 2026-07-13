"use client";

import { useId, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { JLPT_LEVELS, type JlptLevel, type ScenarioId } from "@/lib/conversation-types";

export interface ScenarioDefinition {
  id: ScenarioId;
  label: string;
  description: string;
}

/** Spec §3.6 + §10.5 — the five scenario conversation modes. */
export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: "restaurant",
    label: "Restaurant (レストラン)",
    description: "Order food, ask about the menu, and pay the bill.",
  },
  {
    id: "interview",
    label: "Job interview (面接)",
    description: "Answer common interview questions in polite Japanese.",
  },
  {
    id: "shopping",
    label: "Shopping (買い物)",
    description: "Ask about sizes, prices, and try things on at a store.",
  },
  {
    id: "directions",
    label: "Asking directions (道案内)",
    description: "Ask how to get somewhere and understand the reply.",
  },
  {
    id: "free-talk",
    label: "Free talk (フリートーク)",
    description: "An open-ended chat about anything you like.",
  },
];

export interface ScenarioPickerProps {
  /** `level` is undefined when the user leaves the default (profile) level. */
  onStart: (scenario: ScenarioId, level: JlptLevel | undefined) => void;
  className?: string;
}

/**
 * Scenario + level picker for the voice-conversation feature. Each scenario
 * is its own button (native, so Tab/Enter/Space work for free) rather than a
 * radio + separate submit, since there's nothing else to configure per
 * scenario before starting.
 */
export function ScenarioPicker({ onStart, className }: ScenarioPickerProps) {
  const [level, setLevel] = useState<JlptLevel | "">("");
  const levelId = useId();

  return (
    <div className={cn("space-y-6", className)}>
      <div className="max-w-xs">
        <Label htmlFor={levelId}>Level (optional — defaults to your profile)</Label>
        <select
          id={levelId}
          value={level}
          onChange={(e) => setLevel(e.target.value as JlptLevel | "")}
          className="mt-1 flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
        >
          <option value="">Use my profile level</option>
          {JLPT_LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SCENARIOS.map((scenario) => (
          <li key={scenario.id}>
            <button
              type="button"
              onClick={() => onStart(scenario.id, level === "" ? undefined : level)}
              className="w-full"
            >
              <Card className="h-full p-4 text-left transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                <p className="font-jp font-semibold">{scenario.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{scenario.description}</p>
              </Card>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
