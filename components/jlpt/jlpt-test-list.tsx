import type { JlptTestListItem } from "@/lib/jlpt-ui";
import { JlptTestCard } from "./jlpt-test-card";

export interface JlptTestListProps {
  tests: JlptTestListItem[];
}

/** The `/jlpt` test list, grouped implicitly by the caller's level filter. */
export function JlptTestList({ tests }: JlptTestListProps) {
  if (tests.length === 0) {
    return <p className="text-muted-foreground">No JLPT tests at this level yet.</p>;
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {tests.map((test) => (
        <li key={test.id}>
          <JlptTestCard test={test} />
        </li>
      ))}
    </ul>
  );
}
