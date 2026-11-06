"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, Check, ChevronDown, ChevronLeft, Heart, PenLine, Play, Plus, RotateCcw, Search } from "lucide-react";
import { Link, useFormatter, usePathname, useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { kanjiModalHref } from "@/lib/kanji/href";
import { compositionElements } from "@/lib/kanji/composition";
import { PLACEHOLDER_HREF } from "@/lib/placeholder-href";
import { THIEU_CHUU_SOURCE } from "@/lib/dictionary/thieu-chuu-source";
import type { KanjiExample, KanjiExplore, KanjiInspectPayload, KanjiProgress } from "@/lib/kanji/learner-types";
import { StrokeOrder } from "@/components/motion/stroke-order";
import { TtsButton } from "@/components/speech/tts-button";
import { buttonStyles } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DictionaryAttribution } from "./dictionary-attribution";
import { KanjiInspectExplore } from "./kanji-inspect-explore";

const PAGE = 3;
const pill = "inline-flex h-control-sm shrink-0 items-center gap-2xs rounded-full border border-border bg-background px-sm text-caption font-medium transition-colors hover:bg-muted active:bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:bg-background";
const well = "rounded-md bg-background";
// `h-icon-md` is no theme key (L-053): the arbitrary var is a real height that tailwind-merge swaps for h-control-sm.
const smallTts = "h-[var(--icon-md)]";
// A block whose long content scrolls inside it is a tab stop with a name and a ring (owner K12): keys scroll it too.
const scroller = "overflow-y-auto rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const hanVietLine = (hanViet: string[], english: string | null) =>
  [hanViet.join(", ").toLocaleUpperCase("vi"), english].filter(Boolean).join(" · ");

function Block({ label, h: H, className, children }: { label: string; h: "h2" | "h3"; className?: string; children: React.ReactNode }) {
  return (
    <section aria-label={label} className={cn("flex shrink-0 flex-col gap-2xs rounded-lg border border-border p-sm", className)}>
      <H className="text-caption font-medium text-muted-foreground">{label}</H>
      {children}
    </section>
  );
}

/**
 * The kanji inspect content from Figma `28:2041` (spec §5.2), one component for the `?kanji=` modal and the
 * `/kanji/[literal]` page. One viewport, no scroll (owner 2026-11-06): the frame's blocks sit in four columns —
 * stroke order + my status | meaning + composition | Thiều Chửu + mnemonic | words / examples / lessons in tabs — and long
 * content (Thiều Chửu, a tab list) scrolls inside its own bounded block, never the page or the dialog. The page
 * passes `explore`: on a tall screen a second row under columns 1–3 holds its ways on (`KanjiInspectExplore`).
 */
export function KanjiInspect({ payload, variant, explore }: { payload: KanjiInspectPayload; variant: "modal" | "page"; explore?: KanjiExplore }) {
  const t = useTranslations("kanji");
  const format = useFormatter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const { data } = payload;
  const literal = data.literal;
  const H = variant === "page" ? "h2" : "h3";
  const Glyph = variant === "page" ? "h1" : "h2";
  const listen = (reading: string) => t("quickInspect.listen", { reading });
  const unavailable = t("quickInspect.ttsUnavailable");

  const [favorite, setFavorite] = useState(payload.learner.favorite);
  const [progress, setProgress] = useState<KanjiProgress | null>(payload.learner.progress);
  const [notice, setNotice] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  // The control the learner just turned on answers with one `kanji-pop` (never on mount: a saved kanji opens still).
  const [popped, setPopped] = useState<"favorite" | "review" | null>(null);
  const pending = useRef(false);
  const [replayKey, setReplayKey] = useState(0);
  const [tcOpen, setTcOpen] = useState(false);
  const [pages, setPages] = useState<KanjiExample[][]>([payload.examples]);
  const [page, setPage] = useState(0);
  const [examplesEnd, setExamplesEnd] = useState(payload.examples.length < PAGE);

  function failed(response: Response | null, fallback: string) {
    const seconds = response?.status === 429 ? response.headers.get("Retry-After") : null;
    setNotice(seconds ? t("inspect.rateLimited", { seconds }) : fallback);
  }

  /** Optimistic: `apply` now, `undo` on any non-2xx or network failure. One request at a time. */
  async function act(url: string, method: "PUT" | "DELETE", apply: () => void, undo: () => void, done: string) {
    if (pending.current) return;
    pending.current = true;
    apply();
    setNotice(null);
    setAnnounce("");
    try {
      const response = await fetch(url, { method });
      if (response.ok) return setAnnounce(done);
      undo();
      failed(response, t("inspect.actionFailed"));
    } catch {
      undo();
      failed(null, t("inspect.actionFailed"));
    } finally {
      pending.current = false;
    }
  }

  const encoded = encodeURIComponent(literal);
  const toggleFavorite = () => {
    const next = !favorite;
    void act(`/api/kanji/favorites/${encoded}`, next ? "PUT" : "DELETE", () => { setFavorite(next); setPopped("favorite"); }, () => setFavorite(!next), t(next ? "inspect.favorited" : "inspect.unfavorited"));
  };
  const addToReview = () =>
    void act(
      `/api/kanji/progress/${encoded}`,
      "PUT",
      () => { setProgress({ stage: 0, reviews: 0, lapses: 0, nextReviewAt: new Date().toISOString() }); setPopped("review"); },
      () => setProgress(null),
      t("inspect.addedToReview"),
    );

  async function moreExamples() {
    if (pages[page + 1]) return setPage(page + 1);
    try {
      const response = await fetch(`/api/kanji/examples/${encoded}?offset=${(page + 1) * PAGE}`);
      if (!response.ok) return failed(response, t("inspect.examplesFailed"));
      const next = ((await response.json()) as { data: KanjiExample[] }).data;
      if (next.length === 0) return setExamplesEnd(true);
      setPages([...pages, next]);
      setPage(page + 1);
      if (next.length < PAGE) setExamplesEnd(true);
    } catch {
      await failed(null, t("inspect.examplesFailed"));
    }
  }

  const readings = [...data.onReadings, ...data.kunReadings].join(" • ");
  const elements = compositionElements(data.components);
  const ratio = progress && progress.reviews > 0 ? Math.round(((progress.reviews - progress.lapses) / progress.reviews) * 100) : null;
  const nextReview = progress?.nextReviewAt
    ? new Date(progress.nextReviewAt) <= new Date()
      ? t("inspect.dueNow")
      : format.dateTime(new Date(progress.nextReviewAt), { day: "numeric", month: "short" })
    : "—";
  const examples = pages[page] ?? [];
  // The tall page: each of columns 1–3 ends in a card that reaches the explore row, so the row reads as one band.
  const column = cn("flex min-h-0 flex-col gap-sm", explore && "[@media(min-height:800px)]:[&>section:last-child]:grow");
  const tabs = [
    data.commonWords.length > 0 && "words",
    payload.examples.length > 0 && "examples",
    payload.lessons.length > 0 && "lessons",
  ].filter((tab): tab is string => Boolean(tab));
  const ctas = [
    { href: `/kanji/review?focus=${encoded}`, icon: BookOpen, tone: "text-primary-strong", label: t("inspect.study"), hint: t("inspect.studyHint") },
    { href: PLACEHOLDER_HREF, icon: PenLine, tone: "text-accent-strong", label: t("inspect.vocab"), hint: t("inspect.vocabHint") },
    { href: PLACEHOLDER_HREF, icon: PenLine, tone: "text-accent-strong", label: t("inspect.writing"), hint: t("inspect.writingHint") },
    { href: PLACEHOLDER_HREF, icon: Search, tone: "text-success-strong", label: t("inspect.similar"), hint: t("inspect.similarHint") },
  ];

  return (
    <article aria-label={t("quickInspect.label", { literal })} className="flex min-h-0 flex-1 flex-col text-foreground">
      <header
        className={cn(
          "flex shrink-0 items-center gap-md border-b border-border py-sm pe-lg ps-lg",
          // The modal lays its ‹ › and its page link + ✕ over this row (they must survive a literal change).
          variant === "modal" && "pe-[calc(var(--space-lg)+2*var(--control-sm)+var(--space-2xs))] ps-[calc(var(--space-lg)+2*var(--control-sm)+var(--space-2xs))]",
        )}
      >
        {variant === "page" && (
          <Link href="/kanji" aria-label={t("backToList")} className="inline-flex size-icon-lg shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronLeft aria-hidden="true" className="size-icon-sm" />
          </Link>
        )}
        <Glyph data-type-exempt="kanji-inspect-glyph" lang="ja" className="shrink-0 font-jp text-[length:var(--kanji-inspect-glyph)] font-bold leading-[1.4]">{literal}</Glyph>
        <TtsButton text={literal} label={listen(literal)} unavailableLabel={unavailable} className="shrink-0 rounded-full bg-muted/60" />
        <div className="min-w-0">
          <p lang="ja" title={readings} className="truncate font-jp text-caption text-muted-foreground">{readings}</p>
          <p className="truncate text-body font-semibold">{hanVietLine(data.hanViet, data.meaningsEn.join(", "))}</p>
        </div>
        <div className="ms-auto flex min-w-0 items-center gap-xs">
          {notice && <p role="alert" className="min-w-0 truncate text-caption text-danger-strong">{notice}</p>}
          <p aria-live="polite" className="sr-only">{announce}</p>
          <button type="button" aria-pressed={favorite} onClick={toggleFavorite} className={cn(pill, favorite ? "text-primary-strong" : "text-muted-foreground hover:text-foreground")}>
            <Heart aria-hidden="true" className={cn("size-icon-sm", favorite && "fill-current", favorite && popped === "favorite" && "kanji-pop")} />
            {t("inspect.favorite")}
          </button>
          <button type="button" disabled={progress !== null} onClick={addToReview} className={cn(pill, "font-semibold", progress ? "text-success-strong" : "text-foreground")}>
            {progress ? <Check aria-hidden="true" className={cn("size-icon-xs", popped === "review" && "kanji-pop")} /> : <Plus aria-hidden="true" className="size-icon-xs" />}
            {progress ? t("inspect.inReview") : t("inspect.addToReview")}
          </button>
        </div>
      </header>

      <div className={cn("grid min-h-0 flex-1 grid-cols-[minmax(0,0.8fr)_minmax(0,1.15fr)_minmax(0,0.95fr)_minmax(0,1.1fr)] grid-rows-[minmax(0,1fr)] gap-sm p-md", explore && "[@media(min-height:800px)]:grid-rows-[minmax(0,auto)_minmax(0,1fr)]")}>
        <div className={column}>
          {data.strokePaths.length > 0 && (
            <Block label={t("inspect.strokeOrder")} h={H}>
              <div className="relative mx-auto w-full max-w-[calc(104*var(--density-unit))]">
                <StrokeOrder character={literal} paths={data.strokePaths} replayKey={replayKey} />
                <span className="absolute end-2xs top-2xs font-mono text-caption text-primary-strong">{t("strokeCount", { count: data.strokeCount })}</span>
              </div>
              <button type="button" onClick={() => setReplayKey((key) => key + 1)} className={cn(pill, "w-full justify-center text-foreground")}>
                <RotateCcw aria-hidden="true" className="size-icon-xs" />
                {t("quickInspect.replay")}
              </button>
            </Block>
          )}
          {progress ? (
            <Block label={t("inspect.status")} h={H}>
              <div className="flex items-center gap-sm">
                {ratio !== null && (
                  <svg role="img" aria-label={t("inspect.recalled", { percent: ratio })} viewBox="0 0 36 36" className="size-[calc(56*var(--density-unit))] shrink-0 -rotate-90">
                    <circle cx="18" cy="18" r="15" fill="none" strokeWidth="4" className="stroke-muted" />
                    <circle cx="18" cy="18" r="15" fill="none" strokeWidth="4" pathLength={100} strokeDasharray={`${ratio} 100`} strokeLinecap="round" className="stroke-primary" />
                    <text x="18" y="18" dominantBaseline="central" textAnchor="middle" transform="rotate(90 18 18)" className="fill-foreground text-caption font-bold">{`${ratio}%`}</text>
                  </svg>
                )}
                <dl className="grid flex-1 grid-cols-[minmax(0,1fr)_auto] gap-y-2xs text-caption">
                  <dt className="text-muted-foreground">{t("inspect.stage")}</dt>
                  <dd className="font-semibold">{progress.stage}</dd>
                  <dt className="text-muted-foreground">{t("inspect.reviews")}</dt>
                  <dd className="font-semibold">{progress.reviews}</dd>
                  <dt className="text-muted-foreground">{t("inspect.nextReview")}</dt>
                  <dd className="font-semibold text-primary-strong">{nextReview}</dd>
                </dl>
              </div>
              <Link href="/kanji/review" className={buttonStyles({ size: "sm", className: "mt-auto w-full rounded-full font-semibold" })}>
                {t("inspect.reviewNow")}
              </Link>
            </Block>
          ) : (
            <Block label={t("inspect.status")} h={H}>
              <p className="text-body text-muted-foreground">{t("inspect.notInReview")}</p>
              <button type="button" onClick={addToReview} className={buttonStyles({ size: "sm", className: "mt-auto w-full rounded-full font-semibold" })}>
                <Plus aria-hidden="true" className="size-icon-xs" />
                {t("inspect.addToReview")}
              </button>
            </Block>
          )}
        </div>

        <div className={column}>
          <Block label={t("inspect.meaning")} h={H}>
            <p className="text-body font-semibold">{data.meaningsEn.join(", ")}</p>
            {data.meaningVi && <p className="text-body">{data.meaningVi}</p>}
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-sm gap-y-2xs text-body">
              {[[t("onReading"), data.onReadings], [t("kunReading"), data.kunReadings]].map(([label, list]) =>
                (list as string[]).length > 0 ? (
                  <div key={label as string} className="contents">
                    <dt className="text-caption text-muted-foreground">{label as string}</dt>
                    <dd className="flex min-w-0 items-center gap-2xs">
                      <span lang="ja" title={(list as string[]).join("、")} className="line-clamp-2 font-jp font-semibold">{(list as string[]).join("、")}</span>
                      <TtsButton text={(list as string[]).map((r) => r.replace(/[.\-]/g, "")).join("、")} label={listen((list as string[]).join("、"))} unavailableLabel={unavailable} className={smallTts} />
                    </dd>
                  </div>
                ) : null,
              )}
              {data.hanViet.length > 0 && (
                <>
                  <dt className="text-caption text-muted-foreground">{t("inspect.hanViet")}</dt>
                  <dd className="font-semibold">{data.hanViet.join(", ")}</dd>
                </>
              )}
            </dl>
            <div className="flex flex-wrap items-center gap-x-sm gap-y-2xs text-caption text-muted-foreground">
              <span>{t("strokeCount", { count: data.strokeCount })}</span>
              {data.frequency !== null && <span>{t("frequency", { rank: data.frequency })}</span>}
              {data.grade !== null && <span>{t("grade", { grade: data.grade })}</span>}
              <span className="flex gap-2xs">
                {data.jlpt && <span className="rounded-sm bg-primary/10 px-2xs font-semibold text-primary-strong">{data.jlpt}</span>}
                {data.grade !== null && data.grade <= 8 && <span lang="ja" className="rounded-sm bg-success/10 px-2xs font-semibold text-success-strong">常用</span>}
                {data.oldJlpt !== null && <span lang="ja" className="rounded-sm bg-accent/10 px-2xs font-semibold text-accent-strong">{`${data.oldJlpt}級`}</span>}
              </span>
            </div>
          </Block>
          {elements.length > 0 && (
            <Block label={t("inspect.composition")} h={H} className="min-h-0 shrink">
              <ol tabIndex={0} aria-label={t("inspect.composition")} className={cn("flex min-h-0 flex-wrap items-center gap-2xs", scroller)}>
                {elements.map((element, index) => {
                  const gloss = data.componentGlosses[element];
                  const chip = (
                    <>
                      <span lang="ja" className="font-jp text-body-lg font-bold">{element}</span>
                      {gloss && <span className="max-w-full truncate text-center text-caption text-muted-foreground group-focus-visible:whitespace-normal">{hanVietLine(gloss.hanViet, gloss.meaningEn)}</span>}
                    </>
                  );
                  return (
                    <li key={element} className="flex min-w-0 items-center gap-2xs">
                      {index > 0 && <span aria-hidden="true" className="text-caption font-bold text-muted-foreground">+</span>}
                      {gloss ? (
                        <Link href={kanjiModalHref(pathname, search, element)} scroll={false} title={hanVietLine(gloss.hanViet, gloss.meaningEn)} className={cn(well, "group flex min-w-0 max-w-[calc(72*var(--density-unit))] flex-col items-center px-xs py-2xs hover:bg-muted active:bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>{chip}</Link>
                      ) : (
                        <span className={cn(well, "flex flex-col items-center px-xs py-2xs")}>{chip}</span>
                      )}
                    </li>
                  );
                })}
                <li className="flex items-center gap-2xs">
                  <span aria-hidden="true" className="text-caption font-bold text-muted-foreground">→</span>
                  <span lang="ja" className="flex flex-col items-center rounded-md bg-primary/10 px-xs py-2xs font-jp text-body-lg font-bold text-primary-strong">{literal}</span>
                </li>
              </ol>
            </Block>
          )}
        </div>

        <div className={column}>
          {data.tcLines.length > 0 && (
            <Block label={t("inspect.thieuChuu")} h={H} className="min-h-0 shrink">
              <ul tabIndex={0} aria-label={t("inspect.thieuChuu")} className={cn("min-h-0 space-y-2xs text-body", scroller)}>
                {(tcOpen ? data.tcLines : data.tcLines.slice(0, 2)).map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
              {data.tcLines.length > 2 && (
                <button type="button" onClick={() => setTcOpen(!tcOpen)} className="self-start text-caption font-medium text-primary-strong underline-offset-2 hover:underline">
                  {tcOpen ? t("inspect.showLess") : t("inspect.showAll", { count: data.tcLines.length })}
                </button>
              )}
              <p className="text-caption text-muted-foreground">{THIEU_CHUU_SOURCE.credit}</p>
            </Block>
          )}
          {data.mnemonic && (
            <Block label={t("mnemonic")} h={H} className="min-h-0 shrink">
              <p tabIndex={0} role="group" aria-label={t("mnemonic")} className={cn("min-h-0 text-body text-muted-foreground", scroller)}>{data.mnemonic}</p>
            </Block>
          )}
        </div>

        <section aria-label={t("inspect.usage")} className={cn("flex min-h-0 flex-col rounded-lg border border-border p-sm", explore && "[@media(min-height:800px)]:row-span-2")}>
          {tabs.length > 0 && (
            <Tabs defaultValue={tabs[0]} className="flex min-h-0 flex-1 flex-col">
              <TabsList className="self-start">
                {tabs.map((tab) => (
                  <TabsTrigger key={tab} value={tab} className="text-caption">{t(`inspect.${tab}` as "inspect.words")}</TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="words" className={cn("mt-xs min-h-0 flex-1 data-[state=inactive]:hidden", scroller)}>
                <ul className="space-y-2xs">
                  {data.commonWords.slice(0, 5).map((word) => (
                    <li key={word.entSeq} className={cn(well, "flex items-center gap-xs px-sm py-2xs")}>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-baseline gap-xs">
                          <span lang="ja" className="font-jp text-body font-bold">{word.headword}</span>
                          <span lang="ja" title={word.reading} className="truncate font-jp text-caption text-primary-strong">{word.reading}</span>
                        </p>
                        <p title={word.glossEn} className="truncate text-caption text-muted-foreground">{word.glossEn}</p>
                      </div>
                      <TtsButton text={word.reading || word.headword} label={listen(word.headword)} unavailableLabel={unavailable} className={smallTts} />
                    </li>
                  ))}
                </ul>
              </TabsContent>
              <TabsContent value="examples" className="mt-xs flex min-h-0 flex-1 flex-col gap-xs rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=inactive]:hidden">
                <ul tabIndex={0} aria-label={t("inspect.examples")} className={cn("min-h-0 flex-1 space-y-2xs", scroller)}>
                  {examples.map((example) => (
                    <li key={example.lineId}>
                      <Link href={`/shadowing/${example.videoId}?line=${example.lineId}`} className={cn(well, "block px-sm py-2xs hover:bg-muted active:bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>
                        <span lang="ja" title={example.textJp} className="line-clamp-2 font-jp text-body font-semibold">{example.textJp}</span>
                        {example.translation && <span className="line-clamp-1 text-caption text-muted-foreground">{example.translation}</span>}
                        <span className="block truncate text-caption text-muted-foreground">{t("inspect.fromLesson", { title: example.lessonTitle })}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="flex shrink-0 items-center justify-center gap-sm">
                  {page > 0 && (
                    <button type="button" onClick={() => setPage(page - 1)} className="inline-flex items-center gap-2xs text-caption font-medium text-muted-foreground hover:text-foreground">
                      <ChevronLeft aria-hidden="true" className="size-icon-xs" />
                      {t("inspect.previousExamples")}
                    </button>
                  )}
                  <button type="button" disabled={examplesEnd && !pages[page + 1]} onClick={() => void moreExamples()} className="inline-flex items-center gap-2xs text-caption font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:hover:text-muted-foreground">
                    {examplesEnd && !pages[page + 1] ? t("inspect.noMoreExamples") : t("inspect.moreExamples")}
                    <ChevronDown aria-hidden="true" className="size-icon-xs" />
                  </button>
                </div>
              </TabsContent>
              <TabsContent value="lessons" className={cn("mt-xs min-h-0 flex-1 data-[state=inactive]:hidden", scroller)}>
                <ul className="space-y-2xs">
                  {payload.lessons.map((lesson) => (
                    <li key={lesson.videoId}>
                      <Link href={`/shadowing/${lesson.videoId}`} className={cn(well, "flex items-center gap-sm px-sm py-2xs hover:bg-muted active:bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>
                        <span aria-hidden="true" className="flex size-icon-lg shrink-0 items-center justify-center rounded-full bg-muted">
                          <Play className="size-icon-xs fill-current" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-body font-semibold">{lesson.title}</span>
                          <span className="block text-caption text-muted-foreground">{t("inspect.times", { count: lesson.count })}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </TabsContent>
            </Tabs>
          )}
          {payload.examples.length === 0 && payload.lessons.length === 0 && (
            <p className="mt-xs text-body text-muted-foreground">{t("inspect.noLessons")}</p>
          )}
        </section>
        {explore && <KanjiInspectExplore literal={literal} hanViet={data.hanViet} favorite={favorite} onFavorite={toggleFavorite} explore={explore} h={H} />}
      </div>

      <footer className="shrink-0 space-y-2xs border-t border-border px-lg py-sm">
        <nav className="grid grid-cols-4 gap-sm">
          {ctas.map(({ href, icon: Icon, tone, label, hint }) => (
            <Link key={label} href={href} className="flex min-w-0 items-center justify-center gap-xs rounded-full border border-border bg-background px-sm py-2xs hover:bg-muted active:bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Icon aria-hidden="true" className={cn("size-icon-sm shrink-0", tone)} />
              <span className="min-w-0">
                <span className="block truncate text-body font-semibold">{label}</span>
                <span className="block truncate text-caption text-muted-foreground">{hint}</span>
              </span>
            </Link>
          ))}
        </nav>
        <DictionaryAttribution label={t("dictionarySources")} attribution={data.attribution} compact />
      </footer>
    </article>
  );
}
