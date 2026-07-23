"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { Link } from "@/lib/i18n/navigation";
import type { ReadingPassageDetail } from "@/lib/reading-types";
import { ReadingBody } from "./reading-body";
import { TranslationDisclosure } from "./translation-disclosure";
import { ReadingQuiz } from "./reading-quiz";

export interface ReadingDetailProps {
  passageId: string;
}

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error"; message: string }
  | { status: "loaded"; passage: ReadingPassageDetail };

/**
 * Reader experience for one passage (Layer 5, spec §3.7): header, furigana
 * toggle + tap-to-lookup body, collapsed translation, and the comprehension
 * quiz below. Entirely client-rendered against `GET /api/reading/[id]` — see
 * `components/reading/reading-list.tsx` for why (no `lib/data` import).
 */
export function ReadingDetail({ passageId }: ReadingDetailProps) {
  const t = useTranslations("reading");
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    fetch(`/api/reading/${passageId}`)
      .then(async (res) => {
        if (res.status === 404) {
          if (!cancelled) setState({ status: "not-found" });
          return;
        }
        if (!res.ok) throw new Error("request failed");
        const json = (await res.json()) as { data: ReadingPassageDetail };
        if (!cancelled) setState({ status: "loaded", passage: json.data });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "error", message: t("detail.errorLoad") });
        }
      });

    return () => {
      cancelled = true;
    };
    // `t` intentionally omitted below: it is stable for the component's
    // lifetime (locale never changes mid-render) and adding it would
    // re-trigger this fetch effect whenever `t`'s identity happens to change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passageId]);

  if (state.status === "loading") {
    return <p className="text-sm text-muted-foreground">{t("detail.loading")}</p>;
  }

  if (state.status === "not-found") {
    return (
      <p role="alert" className="text-sm text-danger-strong">
        {t("detail.notFound")}
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <p role="alert" className="text-sm text-danger-strong">
        {state.message}
      </p>
    );
  }

  const { passage } = state;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/reading" className="text-sm text-muted-foreground hover:text-foreground">
          {t("detail.back")}
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{passage.title}</h1>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {passage.jlpt_level}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {passage.word_count != null
            ? t("wordCount", { count: passage.word_count })
            : t("wordCountUnknown")}
        </p>
      </div>

      <ReadingBody bodyJp={passage.body_jp} furiganaJson={passage.furigana_json} />

      <TranslationDisclosure translation={passage.body_translation} />

      <div>
        <h2 className="mb-4 text-lg font-semibold">{t("detail.quizHeading")}</h2>
        <ReadingQuiz passageId={passage.id} questions={passage.questions} />
      </div>
    </div>
  );
}
