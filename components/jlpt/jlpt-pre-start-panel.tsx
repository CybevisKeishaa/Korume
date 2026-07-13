import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SECTION_LABELS, type JlptLevel, type JlptSection } from "@/lib/jlpt-ui";

export interface JlptPreStartPanelProps {
  title: string;
  level: JlptLevel;
  mode: "full" | "section";
  section?: JlptSection;
  questionCount: number;
  durationMinutes: number;
  onStart: () => void;
}

/** Test-info screen shown before the timer starts (spec §5.7). */
export function JlptPreStartPanel({
  title,
  level,
  mode,
  section,
  questionCount,
  durationMinutes,
  onStart,
}: JlptPreStartPanelProps) {
  return (
    <div className="mx-auto max-w-xl space-y-6 py-8">
      <div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {level}
        </span>
        <h1 className="font-jp mt-2 text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "full" ? "Full mock test — all sections." : `Section practice — ${section ? SECTION_LABELS[section] : ""}.`}
        </p>
      </div>

      <Card className="p-5">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Questions</dt>
            <dd className="text-lg font-semibold">{questionCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Time limit</dt>
            <dd className="text-lg font-semibold">{durationMinutes} min</dd>
          </div>
        </dl>
      </Card>

      <p className="text-sm text-muted-foreground">
        The timer starts as soon as you click Start and submits automatically when it runs out.
        You can move between questions freely and change your answers until you submit.
      </p>

      <Button type="button" size="lg" onClick={onStart} autoFocus>
        Start
      </Button>
    </div>
  );
}
