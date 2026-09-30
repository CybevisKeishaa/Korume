import { Link } from "@/lib/i18n/navigation";

export function HubContinueStrip({ course, lesson, index, percent, labels }: {
  course: string; lesson: { id: string; title: string }; index: number; percent: number | null;
  labels: { eyebrow: string; lesson: (index: number) => string; percent: (percent: number) => string };
}) {
  return <Link href={`/shadowing/${lesson.id}`} className="block rounded-lg border border-border bg-card px-md-lg py-md-lg text-body text-foreground shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><p className="text-caption font-semibold uppercase tracking-wide text-primary-strong">{labels.eyebrow}</p><p className="mt-2xs font-semibold">{course} · {labels.lesson(index)} · {lesson.title}</p>{percent === null ? null : <p className="mt-2xs text-caption text-muted-foreground">{labels.percent(percent)}</p>}</Link>;
}
