# Landing Page Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder `/` — today a single centred hero — with the full landing page frame `347:6277` specifies, built to the visual bar of reference `346:6275`, in both locales, with the five missing photographs held behind one explicit asset boundary.

**Architecture:** `app/[locale]/(marketing)/page.tsx` becomes an ordered composition of **11 marketing pieces** — nine body sections plus two chrome pieces (nav, footer) owned by the marketing layout. Two shared primitives carry the cross-cutting concerns: `section.tsx` owns vertical rhythm (gap G4), `asset-slot.tsx` owns the pending-photograph boundary (gap G1). The pitch visualizer (gap G3) is made to match the real product renderer by *sharing its code*: the plotting mathematics moves out of `components/video-player/pitch-contour.tsx` into `lib/pitch/plot.ts`, which both the canvas renderer and the new marketing SVG consume.

**Tech Stack:** Next.js 14 App Router (React Server Components by default), TypeScript strict, Tailwind with semantic design tokens, next-intl (`vi`/`en`), Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-27-landing-page-port-design.md` — read it before Task 1. Its §11 lists eleven rulings that must not be re-litigated.

**Branch:** `landing-page-port` (already created; the spec is committed at `81a20c9`).

---

## Global Constraints

Every task's requirements implicitly include all of these.

- **Semantic tokens are the API (Rule #0).** No arbitrary Tailwind value carrying an absolute `px`/`rem` literal — no `text-[12px]`, `p-[10px]`, `gap-[6px]`, `rounded-[22px]`, `leading-[18px]`. Arbitrary values that express a *relationship* are fine: CSS custom properties, viewport units, `calc()`, percentages, aspect ratios. Any exception needs an inline comment saying why no token can express it.
- **Spacing tokens only:** `2xs xs sm md md-lg lg xl 2xl 3xl` (e.g. `p-lg`, `gap-md`, `space-y-xs`). Never `p-6`, `gap-2`, `space-y-1.5`. `pt-0` is legal — zero needs no token.
- **Type tokens only:** `text-caption body body-lg heading title display hero`. Never `text-sm`, `text-lg`, `text-2xl`.
- **Font tokens:** `font-sans` `font-display` `font-serif` `font-mono` `font-jp`. Japanese text uses `font-jp`.
- **Logical properties only** in `components/**`: `ps-`/`pe-`/`ms-`/`me-`/`start-`/`end-`, never `pl-`/`pr-`/`ml-`/`mr-`/`left-`/`right-`.
- **TypeScript strict.** No `any` without a comment justifying it. Explicit types on every exported function signature.
- **Files stay under ~300 lines.** A section that outgrows it splits its card/chip sub-component into its own file.
- **No string is hardcoded in a component.** Every user-visible string comes from `messages/{en,vi}/marketing.json` via `useTranslations("marketing")` (client) or `getTranslations("marketing")` (server). `lib/i18n/catalog.test.ts` enforces identical key sets across locales, so `en` and `vi` are always added in the same commit.
- **Never import `next-intl` directly** in feature code. Import from `@/lib/i18n` (hooks) or `@/lib/i18n/navigation` / `@/lib/i18n/server`. Internal links use `Link` from `@/lib/i18n/navigation`, never `next/link`.
- **Connectors are decorative.** Every connective SVG is `aria-hidden="true"`, is not focusable, carries no data, and any animation on it is gated behind `prefers-reduced-motion`.
- **Reduced motion never removes content.** Under `prefers-reduced-motion` animated elements render in their final state, statically.
- **Collection assertions state their size and non-emptiness.** `expect(items).toHaveLength(6)` — never a bare `forEach` over a query that could match zero nodes (`CLAUDE.md` §7, `docs/lessons.md` L-004).
- **Commands:** `npm test` (Vitest, single run) · `npm run typecheck` · `npm run lint` · `npm run test:e2e` (Playwright).
- **Commit after every task.** Do not squash tasks together.

### Copy already extracted

English copy for short strings was read from `347:6277`'s metadata on 2026-08-27 and is quoted verbatim in the tasks below. **Long strings are truncated at 50 characters in metadata** — those are marked `<<TRUNCATED>>` in their task and must be fetched with:

```
mcp__figma-desktop__get_design_context  fileKey=IwFHZDZdHW7qsSFiNbWrkd  nodeId=<the section node>
```

Never take copy from the reference image `346:6275` — it is a flattened PNG whose small type is unreliable. The two exceptions where the reference *is* the source (§2's sub-labels, §6's captions) are already resolved in the spec §8.2 and quoted below; do not re-derive them.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `components/marketing/section.tsx` | Body-section wrapper: vertical rhythm, eyebrow, heading. Owns G4. |
| `components/marketing/section.test.tsx` | Its tests. |
| `components/marketing/asset-slot.tsx` | Pending-photograph boundary. Owns G1. |
| `components/marketing/asset-slot.test.tsx` | Its tests. |
| `components/marketing/site-footer.tsx` | §10 footer (frame's, wins outright). |
| `components/marketing/site-footer.test.tsx` | Its tests. |
| `components/marketing/hero.tsx` + `.test.tsx` | §1 |
| `components/marketing/problem.tsx` + `.test.tsx` | §2 (chips + constellation) |
| `components/marketing/journey.tsx` + `.test.tsx` | §3 (five steps + four arrows) |
| `components/marketing/pitch-showcase.tsx` + `.test.tsx` | §4 (dual contour) |
| `components/marketing/recommendation.tsx` + `.test.tsx` | §5 |
| `components/marketing/capability-chain.tsx` + `.test.tsx` | §6 (threaded chain) |
| `components/marketing/trust.tsx` + `.test.tsx` | §7 |
| `components/marketing/cta.tsx` + `.test.tsx` | §8 |
| `components/marketing/signoff.tsx` + `.test.tsx` | §9 |
| `lib/pitch/plot.ts` + `plot.test.ts` | Plotting mathematics shared by the canvas renderer and the marketing SVG. |
| `lib/marketing/pitch-demo.ts` + `.test.ts` | The two illustrative contours for §4. |
| `tests/e2e/landing-page.spec.ts` | The one Playwright spec. |

**Modified**

| File | Change |
|---|---|
| `messages/en/marketing.json`, `messages/vi/marketing.json` | All landing-page copy, both locales. |
| `components/layout/site-header.tsx` | Grows into §0's six-link marketing nav. |
| `app/[locale]/(marketing)/layout.tsx` | Inline footer replaced by `<SiteFooter />`. |
| `app/[locale]/(marketing)/page.tsx` | Becomes the nine-section composition. |
| `components/video-player/pitch-contour.tsx` | Consumes `lib/pitch/plot.ts` instead of its own private copy. |
| `lib/pitch/index.ts` | Re-exports the new plot module. |
| `components/ui/token-scale.test.ts` | Rule #0 scan extended to `components/marketing/**`. |

---

## Task 1: Copy catalog for the whole page

Everything downstream reads these keys, so they land first, in both locales, in one commit.

**Files:**
- Modify: `messages/en/marketing.json`
- Modify: `messages/vi/marketing.json`

**Interfaces:**
- Consumes: nothing.
- Produces: the `marketing` namespace used by every later task. Key groups: `nav.*`, `hero.*`, `problem.*`, `journey.*`, `pitch.*`, `recommend.*`, `chain.*`, `trust.*`, `cta.*`, `signoff.*`, `footer.*`. The three keys that already exist — `hero.heading`, `hero.subtitle`, `hero.cta` — are **replaced** with the frame's copy, and `header.*` is absorbed into `nav.*`.

- [ ] **Step 1: Fetch the twelve truncated strings from Figma**

Metadata truncates at 50 characters. Run `get_design_context` on each section node and copy the full string:

| Node | Section | Key it becomes |
|---|---|---|
| `347:6313` | §1 | `hero.heading`, `hero.subtitle`, `hero.note`, `hero.sentence.romaji`, `hero.sentence.en`, `hero.companion.body` |
| `347:6424` | §2 | `problem.heading`, `problem.body` |
| `347:6535` | §3 | `journey.body` |
| `347:6648` | §4 | `pitch.body`, `pitch.companion` |
| `347:6758` | §5 | `recommend.heading`, `recommend.body` |
| `347:6970` | §7 | `trust.cards.data.body`, `trust.cards.ai.body` |
| `347:7026` | §8/§9/§10 | `cta.body`, `signoff.body`, `footer.app.body` |

Record each full string before writing the file. Do not paraphrase, do not fix the typography (the frame uses a curly apostrophe in `We don’t use your data…` — keep it).

- [ ] **Step 2: Write the English catalog**

Replace `messages/en/marketing.json` entirely.

⚠️ **`«from Step 1»` is a fetched value, never a value you write.** Each one is a string over 50 characters that metadata truncated; Step 1's table names the exact Figma node it comes from and the exact key it becomes. Paste the fetched string verbatim. **Do not invent marketing copy, do not paraphrase, and do not transcribe it off the reference image** — `346:6275` is a flattened PNG and spec §8.1 rules it out as a copy source. If a fetch comes back empty or ambiguous, stop and ask; a plausible-sounding sentence you wrote is a product claim nobody approved.

```json
{
  "nav": {
    "ariaLabel": "Primary",
    "wordmark": "Korume",
    "explore": "Explore",
    "shadowing": "Shadowing",
    "kanji": "Kanji",
    "grammar": "Grammar",
    "practice": "Practice",
    "companion": "Companion",
    "signIn": "Log in",
    "cta": "Get Started"
  },
  "hero": {
    "eyebrow": "Japanese, in context",
    "heading": "«from Step 1»",
    "subtitle": "«from Step 1»",
    "cta": "Start Learning",
    "ctaSecondary": "Explore Korume",
    "note": "«from Step 1»",
    "video": {
      "title": "Travel to Japan: Kyoto in Autumn",
      "level": "N3",
      "duration": "13 min",
      "stillAlt": "A quiet Kyoto street at dusk, lanterns lit."
    },
    "tabs": {
      "transcript": "Transcript",
      "japanese": "Japanese",
      "english": "English",
      "notes": "Notes"
    },
    "transcript": {
      "lineOne": "この通りは、いつ来ても落ち着きます。",
      "lineTwo": "紅葉の季節には更に美しいです。"
    },
    "sentence": {
      "label": "Sentence",
      "position": "1 / 29",
      "jp": "この通りは、いつ来ても 静かで落ち着きます。",
      "romaji": "«from Step 1»",
      "en": "«from Step 1»"
    },
    "keyWords": {
      "heading": "Key words",
      "street": { "jp": "通り（とおり）", "en": "street" },
      "quiet": { "jp": "静か（しずか）", "en": "quiet" }
    },
    "companion": { "name": "Companion", "body": "«from Step 1»" }
  },
  "problem": {
    "eyebrow": "Japanese isn't a textbook",
    "heading": "«from Step 1»",
    "body": "«from Step 1»",
    "example": {
      "jp": "この店、思ったより安いね。",
      "en": "This place is cheaper than I thought."
    },
    "chips": {
      "vocabulary": { "name": "Vocabulary", "detail": "安い・思う・店" },
      "grammar": { "name": "Grammar", "detail": "比較・より" },
      "kanji": { "name": "Kanji", "detail": "店・思・安" },
      "pronunciation": { "name": "Pronunciation", "detail": "Pitch & Rhythm" },
      "listening": { "name": "Listening", "detail": "Real Audio" },
      "srs": { "name": "SRS Review", "detail": "Long-term Memory" }
    },
    "photoAlt": "A learner at a night desk, headphones on, watching a lesson."
  },
  "journey": {
    "eyebrow": "Start with something real",
    "heading": "Don't study Japanese in isolation.",
    "body": "«from Step 1»",
    "cta": "See How It Works",
    "steps": {
      "watch": { "index": "1", "name": "Watch", "detail": "Real Japanese video" },
      "understand": {
        "index": "2",
        "name": "Understand",
        "detail": "この店は、思ったより安い。",
        "gloss": "The place is cheaper than expected."
      },
      "shadow": { "index": "3", "name": "Shadow", "detail": "87" },
      "mine": {
        "index": "4",
        "name": "Mine",
        "detail": "思ったより",
        "level": "N3",
        "tag": "Grammar"
      },
      "remember": { "index": "5", "name": "Remember", "detail": "Review Schedule" }
    },
    "thumbnailAlt": "A still from a Japanese street-scene lesson."
  },
  "pitch": {
    "eyebrow": "Start with Japanese",
    "heading": "Turn listening into something your mouth can do.",
    "body": "«from Step 1»",
    "cta": "Try Shadowing",
    "legend": { "native": "Native", "you": "You" },
    "example": { "jp": "日本の秋はとても美しいですね。" },
    "scores": {
      "overallLabel": "Overall Score",
      "overall": "87",
      "verdict": "Great!",
      "pitch": { "name": "Pitch", "value": "86/100" },
      "rhythm": { "name": "Rhythm", "value": "84/100" },
      "pronunciation": { "name": "Pronunciation", "value": "82/100" },
      "timing": { "name": "Timing", "value": "90/100" }
    },
    "companion": { "name": "Companion", "body": "«from Step 1»" },
    "chartLabel": "Two pitch contours compared: a native speaker's and yours."
  },
  "recommend": {
    "eyebrow": "The next right thing",
    "heading": "«from Step 1»",
    "body": "«from Step 1»",
    "cardHeading": "Recommended for you",
    "video": { "jp": "朝の通勤ラッシュ", "en": "Morning Commute in Tokyo" },
    "stillAlt": "A Tokyo commuter train at rush hour.",
    "familiar": {
      "value": "96",
      "unit": "%",
      "label": "Familiar Words",
      "body": "You mostly know these"
    },
    "cta": "Start Learning",
    "why": {
      "heading": "Why this video?",
      "vocabulary": "You know 96% of the vocabulary",
      "speed": "Natural speed conversation",
      "expressions": "Practical daily expressions",
      "difficulty": "Comfortable for i+1"
    }
  },
  "chain": {
    "eyebrow": "One learning journey",
    "heading": "«from Step 1»",
    "nodes": {
      "video": { "name": "Video & Context", "caption": "Real Japanese from real life." },
      "shadowing": { "name": "Shadowing", "caption": "Speak it. Hear it. Make it yours." },
      "kanji": { "name": "Kanji", "caption": "Understand the characters deeply." },
      "vocabulary": { "name": "Vocabulary", "caption": "Learn in context. Remember longer." },
      "grammar": { "name": "Grammar", "caption": "See patterns. Use naturally." },
      "jlpt": { "name": "JLPT Practice", "caption": "Prepare with focus and confidence." },
      "conversation": { "name": "Conversation", "caption": "Talk with Korume. Improve naturally." },
      "memory": { "name": "Memory & Review", "caption": "Korume remembers. You grow." }
    },
    "mascotAlt": "Korume's companion, seated on a glowing orb."
  },
  "trust": {
    "eyebrow": "Your data belongs to you",
    "heading": "Private. Secure. Built on trust.",
    "cards": {
      "recordings": {
        "name": "Your recordings stay private",
        "body": "Encrypted at rest and never public by default."
      },
      "data": { "name": "Your data is yours", "body": "«from Step 1»" },
      "ai": { "name": "AI with boundaries", "body": "«from Step 1»" }
    },
    "photoAlt": "A warmly lit window at night."
  },
  "cta": {
    "heading": "Start understanding Japanese differently.",
    "body": "«from Step 1»",
    "primary": "Start Learning",
    "secondary": "Explore Lessons",
    "note": "Your journey starts with one sentence.",
    "backgroundAlt": "A lantern-lit bridge at night.",
    "mascotAlt": "Korume's companion, seated on a glowing orb."
  },
  "signoff": {
    "heading": "A quieter way to keep going.",
    "body": "«from Step 1»"
  },
  "footer": {
    "ariaLabel": "Footer",
    "wordmark": "Korume",
    "wordmarkJp": "ことば",
    "tagline": "Your quiet place to grow with Japanese.",
    "copyright": "© {year} Korume",
    "columns": {
      "explore": {
        "heading": "Explore",
        "home": "Home",
        "pricing": "Pricing",
        "faq": "FAQ",
        "blog": "Blog",
        "roadmap": "Roadmap",
        "about": "About",
        "careers": "Careers",
        "contact": "Contact"
      },
      "community": {
        "heading": "Community",
        "discord": "Discord",
        "facebook": "Facebook",
        "tiktok": "TikTok"
      },
      "support": { "heading": "Support" },
      "legal": {
        "heading": "Legal",
        "privacy": "Privacy Policy",
        "terms": "Terms of Service"
      }
    },
    "note": { "heading": "A small note", "body": "We make space for steady, curious learning." },
    "app": {
      "eyebrow": "Continue learning anywhere",
      "heading": "Take your next small step with you.",
      "body": "«from Step 1»",
      "appStore": { "prefix": "Download on the", "name": "App Store" },
      "playStore": { "prefix": "Get it on", "name": "Google Play" }
    }
  }
}
```

⚠️ Three things about this file that are deliberate, and that a reviewer should check:

1. **`header.*` is gone**, absorbed into `nav.*`. `components/layout/site-header.tsx` reads `header.ariaLabel` and `header.cta` today — Task 3 updates it. Between Task 1 and Task 3 the header is broken; that is why they are adjacent.
2. **`footer.cta` is gone.** The layout's current footer uses it; Task 3 replaces that footer wholesale.
3. **The frame's `EXPLORE` / `COMMUNITY` / `SUPPORT` / `LEGAL` headings are all-caps in the design.** They are stored in sentence case and upper-cased with `uppercase` in CSS, because casing is presentation. Do not store shouting.

- [ ] **Step 3: Write the Vietnamese catalog**

`messages/vi/marketing.json` must have the **identical key set**. Translate in the voice already in that file — warm, plain, unhurried; never machine-literal. Two rules:

- **Japanese stays Japanese.** `problem.example.jp`, `problem.chips.*.detail` for the three Japanese ones, `journey.steps.understand.detail`, `journey.steps.mine.detail`, `pitch.example.jp`, `recommend.video.jp`, `footer.wordmarkJp` are **identical in both locales** — they are the content being taught, not UI copy.
- **Numerals and score strings stay identical** (`"87"`, `"86/100"`, `"96"`, `"1 / 29"`, `"N3"`).

Sample of the expected register, for `signoff`:

```json
"signoff": {
  "heading": "Một cách nhẹ nhàng hơn để đi tiếp.",
  "body": "«translate the fetched English, keeping its calm»"
}
```

- [ ] **Step 4: Run the catalog tests**

Run: `npm test -- lib/i18n/catalog.test.ts`
Expected: PASS — in particular "has identical key sets across all locales" and "parses as valid ICU MessageFormat in every locale". A failure here names the exact missing key.

- [ ] **Step 5: Confirm the old keys are gone from the tree**

Run: `npm run typecheck`
Expected: FAIL, naming `components/layout/site-header.tsx` and `app/[locale]/(marketing)/layout.tsx` — they still read `header.*` / `footer.cta`. **This failure is expected and is fixed in Task 3.** Record the output in the task report; do not "fix" it by re-adding the keys.

- [ ] **Step 6: Commit**

```bash
git add messages/en/marketing.json messages/vi/marketing.json
git commit -m "feat(marketing): landing page copy catalog, en + vi"
```

---

## Task 2: The two shared primitives

**Files:**
- Create: `components/marketing/section.tsx`, `components/marketing/section.test.tsx`
- Create: `components/marketing/asset-slot.tsx`, `components/marketing/asset-slot.test.tsx`
- Modify: `components/ui/token-scale.test.ts`

**Interfaces:**
- Consumes: `Container` from `@/components/ui/container`, `cn` from `@/lib/utils`.
- Produces:
  - `Section({ id, eyebrow, heading, headingLevel = 2, children, className }): JSX.Element` — renders `<section id>` with an optional eyebrow `<p>` and a heading at `h{headingLevel}`, then `children`. Owns vertical rhythm.
  - `AssetSlot({ ratio, description, src, className, priority }): JSX.Element` — `ratio` is `"16/9" | "4/3" | "1/1" | "3/4"`; with `src` renders `next/image`, without it renders a labelled pending state.

- [ ] **Step 1: Write the failing tests for `Section`**

Create `components/marketing/section.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Section } from "./section";

describe("Section", () => {
  it("renders the heading at level 2 by default and links it to the section", () => {
    render(
      <Section id="journey" eyebrow="Start with something real" heading="Don't study Japanese in isolation.">
        <p>body</p>
      </Section>,
    );

    const heading = screen.getByRole("heading", { level: 2, name: "Don't study Japanese in isolation." });
    expect(heading).toBeInTheDocument();

    const region = screen.getByRole("region", { name: "Don't study Japanese in isolation." });
    expect(region).toHaveAttribute("id", "journey");
  });

  it("renders the eyebrow as text, not as a heading", () => {
    render(
      <Section id="s" eyebrow="One learning journey" heading="Everything connects.">
        <p>body</p>
      </Section>,
    );

    expect(screen.getByText("One learning journey")).toBeInTheDocument();
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

  it("omits the eyebrow element entirely when none is given", () => {
    const { container } = render(
      <Section id="s" heading="Only a heading">
        <p>body</p>
      </Section>,
    );

    expect(container.querySelectorAll("[data-eyebrow]")).toHaveLength(0);
  });

  it("renders its children", () => {
    render(
      <Section id="s" heading="H">
        <p>the body</p>
      </Section>,
    );

    expect(screen.getByText("the body")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- components/marketing/section.test.tsx`
Expected: FAIL — `Failed to resolve import "./section"`.

- [ ] **Step 3: Implement `Section`**

Create `components/marketing/section.tsx`:

```tsx
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";

export interface SectionProps {
  /** Anchor id; also what the accessible region is keyed to. */
  id: string;
  /** Small label above the heading. Presentational text, never a heading. */
  eyebrow?: string;
  heading: string;
  /** 1 only for the hero; every other section is 2. */
  headingLevel?: 1 | 2;
  children: React.ReactNode;
  className?: string;
}

/**
 * The landing page's body-section wrapper (spec §2, §6).
 *
 * This component owns the page's vertical rhythm. G4 — the reference is ~2698px
 * tall for content the frame spends 4028px on — is fixed here and nowhere else,
 * so that tightening the page is one edit rather than nine. Sections must not
 * add their own top/bottom padding.
 */
export function Section({
  id,
  eyebrow,
  heading,
  headingLevel = 2,
  children,
  className,
}: SectionProps) {
  const headingId = `${id}-heading`;
  const Heading = headingLevel === 1 ? "h1" : "h2";

  return (
    <section id={id} aria-labelledby={headingId} className={cn("py-2xl", className)}>
      <Container>
        {eyebrow ? (
          <p
            data-eyebrow
            className="mb-2xs font-display text-caption uppercase tracking-widest text-primary-strong"
          >
            {eyebrow}
          </p>
        ) : null}
        <Heading
          id={headingId}
          className={cn(
            "max-w-3xl text-balance font-display font-bold",
            headingLevel === 1 ? "text-hero" : "text-display",
          )}
        >
          {heading}
        </Heading>
        <div className="mt-lg">{children}</div>
      </Container>
    </section>
  );
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npm test -- components/marketing/section.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the failing tests for `AssetSlot`**

Create `components/marketing/asset-slot.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { AssetSlot } from "./asset-slot";

describe("AssetSlot", () => {
  it("renders a labelled pending state when no src is given", () => {
    render(<AssetSlot ratio="16/9" description="A quiet Kyoto street at dusk." />);

    const pending = screen.getByRole("img", { name: /A quiet Kyoto street at dusk\./ });
    expect(pending).toHaveAttribute("data-asset-pending", "true");
  });

  it("says, in the accessible name, that the image is not yet available", () => {
    render(<AssetSlot ratio="16/9" description="A quiet Kyoto street at dusk." />);

    expect(
      screen.getByRole("img", { name: /image pending/i }),
    ).toBeInTheDocument();
  });

  it("renders a real image once a src is given, and drops the pending marker", () => {
    render(
      <AssetSlot ratio="16/9" description="A quiet Kyoto street at dusk." src="/marketing/hero.jpg" />,
    );

    const image = screen.getByRole("img", { name: "A quiet Kyoto street at dusk." });
    expect(image).not.toHaveAttribute("data-asset-pending");
  });

  it("applies the requested aspect ratio as a relationship, not a pixel size", () => {
    const { container } = render(<AssetSlot ratio="4/3" description="d" />);

    const slot = container.querySelector("[data-asset-slot]");
    expect(slot).toHaveClass("aspect-[4/3]");
  });
});
```

- [ ] **Step 6: Run to verify they fail**

Run: `npm test -- components/marketing/asset-slot.test.tsx`
Expected: FAIL — `Failed to resolve import "./asset-slot"`.

- [ ] **Step 7: Implement `AssetSlot`**

Create `components/marketing/asset-slot.tsx`:

```tsx
import Image from "next/image";
import { cn } from "@/lib/utils";

type Ratio = "16/9" | "4/3" | "1/1" | "3/4";

const ratioClass: Record<Ratio, string> = {
  // Aspect ratios express a relationship, not a copied pixel, so they are a
  // legitimate arbitrary value under Rule #0 (spec §2 of the screen-port
  // workflow design).
  "16/9": "aspect-[16/9]",
  "4/3": "aspect-[4/3]",
  "1/1": "aspect-[1/1]",
  "3/4": "aspect-[3/4]",
};

export interface AssetSlotProps {
  ratio: Ratio;
  /** What the photograph shows. Becomes the alt text once a real file exists. */
  description: string;
  /** Omit while the photograph does not exist yet. */
  src?: string;
  className?: string;
  priority?: boolean;
}

/**
 * The landing page's pending-photograph boundary (spec §5).
 *
 * Five photographs the reference carries do not exist in the repo. This is the
 * one component that stands in for all five, so that filling a slot later is
 * one prop at one call site with no layout change.
 *
 * The pending state is deliberately, visibly a placeholder — never a decorative
 * gradient that could be mistaken for finished art, and never filled by slicing
 * the flat reference PNG (spec §5.2). A slot may only be filled from a source
 * whose origin is known and recorded.
 */
export function AssetSlot({ ratio, description, src, className, priority }: AssetSlotProps) {
  if (src) {
    return (
      <div data-asset-slot className={cn("relative overflow-hidden rounded-lg", ratioClass[ratio], className)}>
        <Image src={src} alt={description} fill priority={priority} className="object-cover" />
      </div>
    );
  }

  return (
    <div
      data-asset-slot
      data-asset-pending="true"
      role="img"
      aria-label={`${description} (image pending)`}
      className={cn(
        "flex items-center justify-center rounded-lg border border-dashed border-border bg-muted",
        ratioClass[ratio],
        className,
      )}
    >
      <span className="px-md text-center text-caption text-muted-foreground">{description}</span>
    </div>
  );
}
```

- [ ] **Step 8: Run to verify they pass**

Run: `npm test -- components/marketing/asset-slot.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 9: Extend the Rule #0 scan to the new directory**

`components/ui/token-scale.test.ts` currently scans `components/ui/**`. The landing page is the largest body of new presentational code in the repo and must be held to the same rule. Open the file, find the directory it scans, and add `components/marketing`.

- [ ] **Step 10: Mutation-check the extended scan**

The extension is written over code that already exists, so it cannot fail first (`CLAUDE.md` §7). Prove it works:

```bash
# Break it deliberately
printf '\nexport const BROKEN = "text-[13px] p-[7px]";\n' >> components/marketing/section.tsx
npm test -- components/ui/token-scale.test.ts    # EXPECT: FAIL, naming section.tsx
git checkout components/marketing/section.tsx
npm test -- components/ui/token-scale.test.ts    # EXPECT: PASS
```

Paste **both** outputs into the task report. A green-only report does not demonstrate the guard.

- [ ] **Step 11: Commit**

```bash
git add components/marketing/section.tsx components/marketing/section.test.tsx \
        components/marketing/asset-slot.tsx components/marketing/asset-slot.test.tsx \
        components/ui/token-scale.test.ts
git commit -m "feat(marketing): Section and AssetSlot primitives, Rule #0 scan extended"
```

---

## Task 3: §0 nav and §10 footer

The two chrome pieces, together, because Task 1 removed the keys the current chrome reads and the tree does not typecheck until both are done.

**Files:**
- Modify: `components/layout/site-header.tsx`
- Create: `components/marketing/site-footer.tsx`, `components/marketing/site-footer.test.tsx`
- Modify: `app/[locale]/(marketing)/layout.tsx`
- Create: `components/layout/site-header.test.tsx`

**Interfaces:**
- Consumes: `nav.*` and `footer.*` from Task 1; `SUPPORT_EMAIL` from `@/lib/contact`.
- Produces: `SiteFooter()` — an async server component rendering §10.

- [ ] **Step 1: Write the failing test for the nav**

Create `components/layout/site-header.test.tsx`. `SiteHeader` is an async server component, so render its resolved element:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { SiteHeader } from "./site-header";

/** The six marketing nav destinations, ruled by the user 2026-08-27 (spec §2.2). */
const EXPECTED_LINKS: ReadonlyArray<readonly [string, string]> = [
  ["Explore", "/en/shadowing/explore"],
  ["Shadowing", "/en/shadowing"],
  ["Kanji", "/en/kanji"],
  ["Grammar", "/en/grammar"],
  ["Practice", "/en/review"],
  ["Companion", "/en/companion"],
];

describe("SiteHeader", () => {
  it("renders exactly the six ruled marketing nav destinations", async () => {
    render(await SiteHeader());

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const links = Array.from(nav.querySelectorAll("a[data-nav-item]"));

    expect(links).toHaveLength(EXPECTED_LINKS.length);
    expect(EXPECTED_LINKS).toHaveLength(6);
    expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual(
      EXPECTED_LINKS.map(([label, href]) => [label, href]),
    );
  });

  it("offers sign-in and get-started, and never GitHub (P14)", async () => {
    render(await SiteHeader());

    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/en/login");
    expect(screen.getByRole("link", { name: "Get Started" })).toHaveAttribute("href", "/en/register");
    expect(screen.queryByText(/github/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- components/layout/site-header.test.tsx`
Expected: FAIL — zero `a[data-nav-item]` elements, and `t('nav.ariaLabel')` missing because the component still reads `header.ariaLabel`.

- [ ] **Step 3: Rewrite `SiteHeader`**

Replace `components/layout/site-header.tsx`:

```tsx
import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

/**
 * §0 of the landing page (spec §2.1, §2.2).
 *
 * ⚠️ This is a MARKETING nav. It is not `NAV_GROUPS` and must not be derived
 * from the screen registry's nav fields — the registry describes the
 * authenticated IA, this describes a sales page.
 *
 * All six destinations are protected routes. A signed-out visitor is sent
 * through login and returned by the existing middleware; no new redirect
 * behaviour is introduced here.
 */
const NAV_ITEMS = [
  { key: "explore", href: "/shadowing/explore" },
  { key: "shadowing", href: "/shadowing" },
  { key: "kanji", href: "/kanji" },
  { key: "grammar", href: "/grammar" },
  { key: "practice", href: "/review" },
  { key: "companion", href: "/companion" },
] as const;

export async function SiteHeader() {
  const t = await getTranslations("marketing");

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-md">
        <Link href="/" className="font-display text-heading font-bold">
          {t("nav.wordmark")}
        </Link>
        <nav aria-label={t("nav.ariaLabel")} className="hidden items-center gap-lg md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              data-nav-item
              href={item.href}
              className="text-body text-muted-foreground transition-colors hover:text-foreground"
            >
              {t(`nav.${item.key}`)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-xs">
          <Link href="/login" className={buttonStyles({ variant: "ghost", size: "sm" })}>
            {t("nav.signIn")}
          </Link>
          <Link href="/register" className={buttonStyles({ size: "sm" })}>
            {t("nav.cta")}
          </Link>
        </div>
      </Container>
    </header>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- components/layout/site-header.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Write the failing test for the footer**

The footer's defining rule is the user's 2026-08-27 ruling: **every label stays; only labels with a real destination become links** (spec §2.3). That is what the test pins.

Create `components/marketing/site-footer.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { SiteFooter } from "./site-footer";
import { SUPPORT_EMAIL } from "@/lib/contact";

/** Spec §2.3 — the only three footer labels that have a real destination today. */
const LINKED: ReadonlyArray<readonly [string, string]> = [
  ["Home", "/en"],
  ["Roadmap", "/en/roadmap"],
  ["Contact", `mailto:${SUPPORT_EMAIL}`],
];

/** Spec §2.3 — present as text, deliberately not links, until a page exists. */
const UNLINKED = [
  "Pricing",
  "FAQ",
  "Blog",
  "About",
  "Careers",
  "Privacy Policy",
  "Terms of Service",
  "Discord",
  "Facebook",
  "TikTok",
] as const;

describe("SiteFooter", () => {
  it("links exactly the labels whose destination exists", async () => {
    render(await SiteFooter());

    expect(LINKED).toHaveLength(3);
    for (const [label, href] of LINKED) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
  });

  it("keeps every other label as text, so nothing is dropped and nothing 404s", async () => {
    render(await SiteFooter());

    expect(UNLINKED).toHaveLength(10);
    for (const label of UNLINKED) {
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: label })).toBeNull();
    }
  });

  it("derives the support address from lib/contact rather than re-typing it", async () => {
    render(await SiteFooter());

    expect(screen.getByText(SUPPORT_EMAIL)).toBeInTheDocument();
  });

  it("keeps the frame's own column set, not the reference's", async () => {
    render(await SiteFooter());

    for (const heading of ["Explore", "Community", "Support", "Legal"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    // The reference's columns, which ruling 3 rejects.
    expect(screen.queryByRole("heading", { name: "Product" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Learn" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Company" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Resources" })).toBeNull();
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npm test -- components/marketing/site-footer.test.tsx`
Expected: FAIL — `Failed to resolve import "./site-footer"`.

- [ ] **Step 7: Implement `SiteFooter`**

Create `components/marketing/site-footer.tsx`. The shape below is the contract the tests pin; take the exact visual arrangement (column widths, the app block's placement, the wordmark treatment) from `get_design_context` on `347:7026`'s footer subtree.

```tsx
import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { Container } from "@/components/ui/container";
import { SUPPORT_EMAIL } from "@/lib/contact";

/**
 * §10 (spec §2.3, ruling 3).
 *
 * ⚠️ This is the FRAME's footer and it wins outright over the reference's. Do
 * not substitute the reference's Product/Learn/Company/Resources/Legal columns.
 *
 * ⚠️ Every label stays; only a label with a real destination is a link. A label
 * whose page does not exist yet renders as text — no `#`, no placeholder route,
 * no 404. Adding the page later is one `href`.
 */

/** Labels that have a destination today. Everything else is text. */
const LINKS = {
  home: "/",
  roadmap: "/roadmap",
} as const;

function FooterItem({ children, href }: { children: React.ReactNode; href?: string }) {
  if (!href) {
    return <li className="text-body text-muted-foreground">{children}</li>;
  }
  return (
    <li>
      <Link href={href} className="text-body text-muted-foreground transition-colors hover:text-foreground">
        {children}
      </Link>
    </li>
  );
}

export async function SiteFooter() {
  const t = await getTranslations("marketing");

  return (
    <footer aria-label={t("footer.ariaLabel")} className="border-t border-border py-xl">
      <Container className="grid gap-xl md:grid-cols-5">
        <div className="md:col-span-2">
          <p className="font-display text-heading font-bold">{t("footer.wordmark")}</p>
          <p className="mt-2xs font-jp text-caption text-muted-foreground">{t("footer.wordmarkJp")}</p>
          <p className="mt-xs text-body text-muted-foreground">{t("footer.tagline")}</p>
        </div>

        <nav>
          <h2 className="text-caption uppercase tracking-widest text-foreground">
            {t("footer.columns.explore.heading")}
          </h2>
          <ul className="mt-sm space-y-2xs">
            <FooterItem href={LINKS.home}>{t("footer.columns.explore.home")}</FooterItem>
            <FooterItem>{t("footer.columns.explore.pricing")}</FooterItem>
            <FooterItem>{t("footer.columns.explore.faq")}</FooterItem>
            <FooterItem>{t("footer.columns.explore.blog")}</FooterItem>
            <FooterItem href={LINKS.roadmap}>{t("footer.columns.explore.roadmap")}</FooterItem>
            <FooterItem>{t("footer.columns.explore.about")}</FooterItem>
            <FooterItem>{t("footer.columns.explore.careers")}</FooterItem>
            <li>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-body text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("footer.columns.explore.contact")}
              </a>
            </li>
          </ul>
        </nav>

        <nav>
          <h2 className="text-caption uppercase tracking-widest text-foreground">
            {t("footer.columns.community.heading")}
          </h2>
          <ul className="mt-sm space-y-2xs">
            {/* No real URLs exist for these yet — text, per spec §2.3. */}
            <FooterItem>{t("footer.columns.community.discord")}</FooterItem>
            <FooterItem>{t("footer.columns.community.facebook")}</FooterItem>
            <FooterItem>{t("footer.columns.community.tiktok")}</FooterItem>
          </ul>
        </nav>

        <div>
          <h2 className="text-caption uppercase tracking-widest text-foreground">
            {t("footer.columns.support.heading")}
          </h2>
          <p className="mt-sm text-body text-muted-foreground">{SUPPORT_EMAIL}</p>

          <h2 className="mt-lg text-caption uppercase tracking-widest text-foreground">
            {t("footer.columns.legal.heading")}
          </h2>
          <ul className="mt-sm space-y-2xs">
            <FooterItem>{t("footer.columns.legal.privacy")}</FooterItem>
            <FooterItem>{t("footer.columns.legal.terms")}</FooterItem>
          </ul>
        </div>
      </Container>

      <Container className="mt-xl border-t border-border pt-lg">
        <p className="text-caption uppercase tracking-widest text-primary-strong">
          {t("footer.app.eyebrow")}
        </p>
        <h2 className="mt-2xs font-display text-heading font-bold">{t("footer.app.heading")}</h2>
        <p className="mt-xs max-w-xl text-body text-muted-foreground">{t("footer.app.body")}</p>
        {/* No app exists on either store yet — text, per spec §2.3. */}
        <div className="mt-md flex flex-wrap gap-sm">
          <span className="rounded-md border border-border px-md py-sm text-caption text-muted-foreground">
            {t("footer.app.appStore.prefix")} {t("footer.app.appStore.name")}
          </span>
          <span className="rounded-md border border-border px-md py-sm text-caption text-muted-foreground">
            {t("footer.app.playStore.prefix")} {t("footer.app.playStore.name")}
          </span>
        </div>
        <p className="mt-lg text-caption text-muted-foreground">
          {t("footer.copyright", { year: new Date().getFullYear() })}
        </p>
      </Container>
    </footer>
  );
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `npm test -- components/marketing/site-footer.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 9: Wire the footer into the layout**

In `app/[locale]/(marketing)/layout.tsx`, delete the entire inline `<footer>…</footer>` block and the now-unused `Link`, `Container`, `getTranslations` and `tCommon` bindings, then render `<SiteFooter />` in its place:

```tsx
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SmoothScroll } from "@/components/motion/smooth-scroll";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <SmoothScroll>
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </div>
    </SmoothScroll>
  );
}
```

- [ ] **Step 10: Verify the tree typechecks again**

Run: `npm run typecheck`
Expected: PASS — this closes the failure Task 1 Step 5 recorded.

Run: `npm test`
Expected: PASS, whole suite.

- [ ] **Step 11: Commit**

```bash
git add components/layout/site-header.tsx components/layout/site-header.test.tsx \
        components/marketing/site-footer.tsx components/marketing/site-footer.test.tsx \
        "app/[locale]/(marketing)/layout.tsx"
git commit -m "feat(marketing): §0 nav and §10 footer"
```

---

## Task 4: §1 Hero

**Files:**
- Create: `components/marketing/hero.tsx`, `components/marketing/hero.test.tsx`
- Modify: `app/[locale]/(marketing)/page.tsx`

**Interfaces:**
- Consumes: `Section`, `AssetSlot` (Task 2); `hero.*` (Task 1).
- Produces: `Hero()` — async server component. First piece rendered by `page.tsx`.

- [ ] **Step 1: Read the design**

Run `get_design_context` on `347:6313`. The composition to build is the **reference's**, not the frame's: copy and two CTAs on the left; on the right a video card (title, level, duration) with player chrome over the still, then Transcript / Japanese / English / Notes tabs over three transcript lines, a Companion card, and a right rail carrying "Sentence 1 / 29", the Japanese line, romaji, English, Key Words and "Save Sentence".

⚠️ This is the page's single most important image and it does not exist. The still is an `AssetSlot` with `ratio="16/9"`; **do not** substitute a gradient, and do not slice it out of `346:6275`.

- [ ] **Step 2: Write the failing test**

Create `components/marketing/hero.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Hero } from "./hero";

describe("Hero", () => {
  it("renders the page's only h1", async () => {
    render(await Hero());

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
  });

  it("offers both hero CTAs, pointing at register and the explore surface", async () => {
    render(await Hero());

    expect(screen.getByRole("link", { name: "Start Learning" })).toHaveAttribute("href", "/en/register");
    expect(screen.getByRole("link", { name: "Explore Korume" })).toHaveAttribute(
      "href",
      "/en/shadowing/explore",
    );
  });

  it("holds the hero still as a pending asset slot, not as invented art", async () => {
    const { container } = render(await Hero());

    const pending = container.querySelectorAll('[data-asset-pending="true"]');
    expect(pending).toHaveLength(1);
  });

  it("shows the video card's metadata", async () => {
    render(await Hero());

    expect(screen.getByText("Travel to Japan: Kyoto in Autumn")).toBeInTheDocument();
    expect(screen.getByText("N3")).toBeInTheDocument();
    expect(screen.getByText("13 min")).toBeInTheDocument();
    expect(screen.getByText("1 / 29")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- components/marketing/hero.test.tsx`
Expected: FAIL — `Failed to resolve import "./hero"`.

- [ ] **Step 4: Implement `Hero`**

Create `components/marketing/hero.tsx`. Skeleton — fill the right-hand card's internals from Step 1's design context:

```tsx
import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { buttonStyles } from "@/components/ui/button";
import { Section } from "./section";
import { AssetSlot } from "./asset-slot";

/** §1 (spec §2). Built to the reference's composition, per the reconciliation doc's §4. */
export async function Hero() {
  const t = await getTranslations("marketing");

  return (
    <Section id="hero" eyebrow={t("hero.eyebrow")} heading={t("hero.heading")} headingLevel={1}>
      <div className="grid gap-xl lg:grid-cols-2">
        <div>
          <p className="max-w-xl text-body-lg text-muted-foreground">{t("hero.subtitle")}</p>
          <div className="mt-lg flex flex-wrap gap-sm">
            <Link href="/register" className={buttonStyles({ size: "lg" })}>
              {t("hero.cta")}
            </Link>
            <Link href="/shadowing/explore" className={buttonStyles({ size: "lg", variant: "outline" })}>
              {t("hero.ctaSecondary")}
            </Link>
          </div>
          <p className="mt-md text-caption text-muted-foreground">{t("hero.note")}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-md">
          <div className="flex items-center gap-xs text-caption text-muted-foreground">
            <span className="text-foreground">{t("hero.video.title")}</span>
            <span>{t("hero.video.level")}</span>
            <span>{t("hero.video.duration")}</span>
          </div>
          <AssetSlot
            ratio="16/9"
            description={t("hero.video.stillAlt")}
            className="mt-sm"
            priority
          />
          {/* Player chrome, transcript tabs, Companion card and the sentence rail
              go here — take their exact arrangement from 347:6313. */}
          <p className="mt-sm text-caption text-muted-foreground">
            {t("hero.sentence.label")} {t("hero.sentence.position")}
          </p>
        </div>
      </div>
    </Section>
  );
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- components/marketing/hero.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 6: Replace the placeholder page**

Rewrite `app/[locale]/(marketing)/page.tsx`:

```tsx
import { Hero } from "@/components/marketing/hero";

export default function LandingPage() {
  return (
    <main>
      <Hero />
    </main>
  );
}
```

Tasks 5–12 each append their section to this list, in order.

- [ ] **Step 7: Verify the page builds**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add components/marketing/hero.tsx components/marketing/hero.test.tsx "app/[locale]/(marketing)/page.tsx"
git commit -m "feat(marketing): §1 hero"
```

---

## Task 5: §2 Problem — six chips and the constellation

**Files:**
- Create: `components/marketing/problem.tsx`, `components/marketing/problem.test.tsx`
- Modify: `app/[locale]/(marketing)/page.tsx`

**Interfaces:**
- Consumes: `Section`, `AssetSlot`; `problem.*`.
- Produces: `Problem()`.

- [ ] **Step 1: Write the failing test**

Two of these four are the placeholder guards from spec §9. Create `components/marketing/problem.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Problem } from "./problem";

const CHIP_NAMES = [
  "Vocabulary",
  "Grammar",
  "Kanji",
  "Pronunciation",
  "Listening",
  "SRS Review",
] as const;

describe("Problem", () => {
  it("renders all six capability chips", async () => {
    const { container } = render(await Problem());

    const chips = container.querySelectorAll("[data-chip]");
    expect(chips).toHaveLength(6);
    expect(CHIP_NAMES).toHaveLength(6);
    for (const name of CHIP_NAMES) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it("gives every chip a DISTINCT sub-label — the frame repeats one placeholder six times", async () => {
    const { container } = render(await Problem());

    const details = Array.from(container.querySelectorAll("[data-chip-detail]")).map(
      (el) => el.textContent,
    );
    expect(details).toHaveLength(6);
    expect(new Set(details).size).toBe(6);
  });

  it("never renders the frame's placeholder sub-label", async () => {
    const { container } = render(await Problem());

    expect(container.textContent).not.toContain("Learn in context");
  });

  it("centres the example sentence the six chips are about", async () => {
    render(await Problem());

    expect(screen.getByText("この店、思ったより安いね。")).toBeInTheDocument();
    expect(screen.getByText("This place is cheaper than I thought.")).toBeInTheDocument();
  });

  it("marks the constellation connectors decorative and hides them from assistive tech", async () => {
    const { container } = render(await Problem());

    const connectors = container.querySelectorAll("[data-connector]");
    expect(connectors).toHaveLength(1);
    expect(connectors[0]).toHaveAttribute("aria-hidden", "true");
  });

  it("holds the learner photograph as a pending asset slot", async () => {
    const { container } = render(await Problem());

    expect(container.querySelectorAll('[data-asset-pending="true"]')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- components/marketing/problem.test.tsx`
Expected: FAIL — `Failed to resolve import "./problem"`.

- [ ] **Step 3: Implement `Problem`**

Create `components/marketing/problem.tsx`:

```tsx
import { getTranslations } from "@/lib/i18n/server";
import { Section } from "./section";
import { AssetSlot } from "./asset-slot";

/**
 * §2 (spec §4, §8.2.1).
 *
 * The reference arranges the six chips AROUND the centred example sentence and
 * connects them to it with dotted lines through a glowing centre node; the frame
 * squeezes them into two flat rows with nothing between them. The reference's
 * arrangement wins (gap G2).
 *
 * ⚠️ The connectors express a DECORATIVE relationship. They are not derived from
 * user state, SRS data or the difficulty engine, nothing in them is clickable,
 * and removing the SVG loses decoration and nothing else — every chip's meaning
 * is in its own text. Do not wire them to anything.
 */
const CHIPS = [
  "vocabulary",
  "grammar",
  "kanji",
  "pronunciation",
  "listening",
  "srs",
] as const;

export async function Problem() {
  const t = await getTranslations("marketing");

  return (
    <Section id="problem" eyebrow={t("problem.eyebrow")} heading={t("problem.heading")}>
      <div className="grid gap-xl lg:grid-cols-[2fr_1fr]">
        <div>
          <p className="max-w-xl text-body-lg text-muted-foreground">{t("problem.body")}</p>

          <div className="relative mt-xl">
            {/* Decorative only — see the component doc comment. */}
            <svg
              data-connector
              aria-hidden="true"
              focusable="false"
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {/* Dotted rays from the centre node out to each chip. Take the exact
                  geometry from 347:6424; keep stroke-dasharray relative. */}
            </svg>

            <div className="relative grid gap-md sm:grid-cols-3">
              {CHIPS.map((chip) => (
                <div key={chip} data-chip className="rounded-lg border border-border bg-card p-md text-center">
                  <p className="text-body font-medium">{t(`problem.chips.${chip}.name`)}</p>
                  <p data-chip-detail className="mt-2xs font-jp text-caption text-muted-foreground">
                    {t(`problem.chips.${chip}.detail`)}
                  </p>
                </div>
              ))}
            </div>

            <div className="relative mt-lg text-center">
              <p className="font-jp text-title">{t("problem.example.jp")}</p>
              <p className="mt-2xs text-body text-muted-foreground">{t("problem.example.en")}</p>
            </div>
          </div>
        </div>

        <AssetSlot ratio="3/4" description={t("problem.photoAlt")} />
      </div>
    </Section>
  );
}
```

⚠️ The grid above places all six chips in one block for the test to pass. The **reference's** arrangement puts three above the sentence and three below, with the sentence between them. Restructure to that while keeping `data-chip` on all six — the test counts, it does not care about the wrapper.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- components/marketing/problem.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Mutation-check the two placeholder guards**

They were written over copy that already exists in the catalog, so they cannot fail first:

```bash
# Point two chips at the same detail string
#   messages/en/marketing.json: set problem.chips.grammar.detail to "Learn in context"
npm test -- components/marketing/problem.test.tsx   # EXPECT: FAIL on BOTH the distinctness
                                                    # test and the placeholder test
git checkout messages/en/marketing.json
npm test -- components/marketing/problem.test.tsx   # EXPECT: PASS
```

Paste both outputs into the task report.

- [ ] **Step 6: Append to the page and commit**

Add `<Problem />` after `<Hero />` in `app/[locale]/(marketing)/page.tsx`, then:

```bash
npm run typecheck && npm test
git add components/marketing/problem.tsx components/marketing/problem.test.tsx "app/[locale]/(marketing)/page.tsx"
git commit -m "feat(marketing): §2 problem, six chips and the constellation"
```

---

## Task 6: §3 Journey — five steps, four arrows

This is the one section where the frame is **structurally** wrong, not merely unpolished.

**Files:**
- Create: `components/marketing/journey.tsx`, `components/marketing/journey.test.tsx`
- Modify: `app/[locale]/(marketing)/page.tsx`

**Interfaces:**
- Consumes: `Section`, `AssetSlot`; `journey.*`.
- Produces: `Journey()`.

- [ ] **Step 1: Write the failing test**

Create `components/marketing/journey.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Journey } from "./journey";

const STEPS = ["Watch", "Understand", "Shadow", "Mine", "Remember"] as const;

describe("Journey", () => {
  it("renders the five steps as ONE row — the frame breaks it into a column plus a row", async () => {
    const { container } = render(await Journey());

    const cards = container.querySelectorAll("[data-step]");
    expect(cards).toHaveLength(5);
    expect(STEPS).toHaveLength(5);
    expect(Array.from(cards).map((c) => c.getAttribute("data-step"))).toEqual([
      "watch",
      "understand",
      "shadow",
      "mine",
      "remember",
    ]);
    for (const name of STEPS) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it("puts an arrow between each adjacent pair — four, not one", async () => {
    const { container } = render(await Journey());

    const arrows = container.querySelectorAll("[data-step-arrow]");
    expect(arrows).toHaveLength(4);
    for (const arrow of Array.from(arrows)) {
      expect(arrow).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("numbers the steps 1 to 5", async () => {
    render(await Journey());

    for (const index of ["1", "2", "3", "4", "5"]) {
      expect(screen.getByText(index)).toBeInTheDocument();
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- components/marketing/journey.test.tsx`
Expected: FAIL — `Failed to resolve import "./journey"`.

- [ ] **Step 3: Implement `Journey`**

Create `components/marketing/journey.tsx`:

```tsx
import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { buttonStyles } from "@/components/ui/button";
import { Section } from "./section";
import { AssetSlot } from "./asset-slot";

/**
 * §3 (spec §4).
 *
 * ⚠️ The frame renders this section STRUCTURALLY wrong: cards 1 and 5 stacked in
 * a left column, 2/3/4 in a right row, one arrow for the whole section, unequal
 * card heights. The reference is a single horizontal row of five equal cards with
 * an arrow between each adjacent pair. The reference wins.
 *
 * The arrows are decorative (gap G2) — they carry no data and are hidden from
 * assistive technology; the ordering they express is already in the "1".."5"
 * indices and the reading order.
 */
const STEPS = ["watch", "understand", "shadow", "mine", "remember"] as const;

export async function Journey() {
  const t = await getTranslations("marketing");

  return (
    <Section id="journey" eyebrow={t("journey.eyebrow")} heading={t("journey.heading")}>
      <div className="grid gap-xl lg:grid-cols-[1fr_2fr]">
        <div>
          <p className="max-w-md text-body-lg text-muted-foreground">{t("journey.body")}</p>
          <Link href="/shadowing/explore" className={buttonStyles({ variant: "outline", className: "mt-lg" })}>
            {t("journey.cta")}
          </Link>
        </div>

        <ol className="flex items-stretch gap-2xs overflow-x-auto">
          {STEPS.map((step, i) => (
            <li key={step} className="flex min-w-0 flex-1 items-center gap-2xs">
              <div
                data-step={step}
                className="flex h-full min-w-0 flex-1 flex-col rounded-lg border border-border bg-card p-sm"
              >
                <p className="text-caption text-muted-foreground">
                  <span>{t(`journey.steps.${step}.index`)}</span>{" "}
                  <span className="text-foreground">{t(`journey.steps.${step}.name`)}</span>
                </p>
                {step === "watch" ? (
                  <AssetSlot ratio="16/9" description={t("journey.thumbnailAlt")} className="mt-xs" />
                ) : null}
                <p className="mt-xs font-jp text-caption text-muted-foreground">
                  {t(`journey.steps.${step}.detail`)}
                </p>
              </div>
              {i < STEPS.length - 1 ? (
                <span data-step-arrow aria-hidden="true" className="shrink-0 text-primary-strong">
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
```

⚠️ Step 3's card carries a **waveform** in the reference, not the crude bar cluster the frame draws — same defect as G3 at smaller scale. Leave it as the plain detail line for now; Task 7 builds the contour primitive, and Task 7's Step 9 comes back to fill this card.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- components/marketing/journey.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Append to the page and commit**

Add `<Journey />` after `<Problem />`, then:

```bash
npm run typecheck && npm test
git add components/marketing/journey.tsx components/marketing/journey.test.tsx "app/[locale]/(marketing)/page.tsx"
git commit -m "feat(marketing): §3 journey, five steps in one row with four arrows"
```

---

## Task 7: `lib/pitch/plot.ts`, then §4 Pitch

The substantive task. Gap G3 is closed by making the landing page and the real player share code, not by drawing something that resembles the real thing.

**Files:**
- Create: `lib/pitch/plot.ts`, `lib/pitch/plot.test.ts`
- Modify: `lib/pitch/index.ts`
- Modify: `components/video-player/pitch-contour.tsx`
- Create: `lib/marketing/pitch-demo.ts`, `lib/marketing/pitch-demo.test.ts`
- Create: `components/marketing/pitch-showcase.tsx`, `components/marketing/pitch-showcase.test.tsx`
- Modify: `app/[locale]/(marketing)/page.tsx`

**Interfaces:**
- Consumes: `PitchContour`, `F0Frame`, `hzToSemitones`, `medianVoicedHz` from `@/lib/pitch`.
- Produces:
  - `lib/pitch/plot.ts`: `interface PlotPoint { x: number; y: number }` and
    `toPlotPoints(contour: PitchContour, refHz: number, width: number, height: number): { points: (PlotPoint | null)[]; baselineY: number }`, plus the constants `MIN_SEMITONE_SPAN = 4` and `RANGE_PADDING_SEMITONES = 1`.
  - `lib/marketing/pitch-demo.ts`: `NATIVE_DEMO_CONTOUR: PitchContour`, `USER_DEMO_CONTOUR: PitchContour`, `DEMO_REF_HZ: number`.
  - `PitchShowcase()`.

- [ ] **Step 1: Write the failing test for `plot.ts`**

Create `lib/pitch/plot.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toPlotPoints, MIN_SEMITONE_SPAN, RANGE_PADDING_SEMITONES } from "./plot";
import type { PitchContour } from "./types";

const contour = (hz: (number | null)[]): PitchContour => ({
  frames: hz.map((v, i) => ({ time: i * 0.01, hz: v })),
  sampleRate: 16000,
});

describe("toPlotPoints", () => {
  it("maps the first and last frame to the horizontal extremes", () => {
    const { points } = toPlotPoints(contour([200, 220, 240]), 220, 300, 100);

    expect(points).toHaveLength(3);
    expect(points[0]?.x).toBe(0);
    expect(points[2]?.x).toBe(300);
  });

  it("emits null for unvoiced frames so the renderer can break the line", () => {
    const { points } = toPlotPoints(contour([200, null, 240]), 220, 300, 100);

    expect(points).toHaveLength(3);
    expect(points[1]).toBeNull();
  });

  it("puts a higher pitch higher on the canvas (y grows downward)", () => {
    const { points } = toPlotPoints(contour([200, 300]), 220, 300, 100);

    expect(points[0]).not.toBeNull();
    expect(points[1]).not.toBeNull();
    expect(points[1]!.y).toBeLessThan(points[0]!.y);
  });

  it("widens a nearly-flat take to the minimum span rather than amplifying noise", () => {
    // Two frames a hair apart: without a floor these would fill the full height.
    const { points } = toPlotPoints(contour([220, 221]), 220, 300, 100);

    expect(MIN_SEMITONE_SPAN).toBe(4);
    const drop = Math.abs(points[1]!.y - points[0]!.y);
    expect(drop).toBeLessThan(10);
  });

  it("places the reference baseline inside the plot", () => {
    const { baselineY } = toPlotPoints(contour([200, 240]), 220, 300, 100);

    expect(baselineY).toBeGreaterThan(0);
    expect(baselineY).toBeLessThan(100);
    expect(RANGE_PADDING_SEMITONES).toBe(1);
  });

  it("returns a point per frame even when nothing is voiced", () => {
    const { points } = toPlotPoints(contour([null, null]), 220, 300, 100);

    expect(points).toHaveLength(2);
    expect(points.every((p) => p === null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- lib/pitch/plot.test.ts`
Expected: FAIL — `Failed to resolve import "./plot"`.

- [ ] **Step 3: Move the code**

Cut `PlotPoint`, `toPlotPoints`, `MIN_SEMITONE_SPAN` and `RANGE_PADDING_SEMITONES` out of `components/video-player/pitch-contour.tsx` and into a new `lib/pitch/plot.ts`, exporting all four. Keep the bodies **byte-identical** — this is a move, not a rewrite. Header:

```ts
/**
 * Plotting mathematics for the pitch contour, shared by every renderer.
 *
 * Rendering-agnostic in the same sense as `contour.ts`: plain numbers out, no
 * DOM, canvas or SVG. It lives here rather than inside the canvas component
 * because the landing page's §4 showcase must be the SAME SHAPE as the real
 * scorer (spec §7) — and the way to guarantee that is shared code, not a second
 * implementation that looks similar.
 *
 * Consumers: `components/video-player/pitch-contour.tsx` (canvas, real audio)
 * and `components/marketing/pitch-showcase.tsx` (SVG, illustrative fixtures).
 */
```

Add to `lib/pitch/index.ts`:

```ts
export { toPlotPoints, MIN_SEMITONE_SPAN, RANGE_PADDING_SEMITONES } from "./plot";
export type { PlotPoint } from "./plot";
```

Then in `components/video-player/pitch-contour.tsx` delete the moved code and import it:

```ts
import { contourFromSamples, hzToSemitones, medianVoicedHz, toPlotPoints } from "@/lib/pitch";
import type { PitchContour as PitchContourData, PlotPoint } from "@/lib/pitch";
```

- [ ] **Step 4: Run both suites**

Run: `npm test -- lib/pitch/plot.test.ts components/video-player/pitch-contour.test.tsx`
Expected: PASS both. The player's existing tests going green unchanged is the proof this was a move and not a behaviour change — say so explicitly in the task report.

- [ ] **Step 5: Write the failing test for the demo fixtures**

Create `lib/marketing/pitch-demo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { NATIVE_DEMO_CONTOUR, USER_DEMO_CONTOUR, DEMO_REF_HZ } from "./pitch-demo";

describe("pitch demo fixtures", () => {
  it("gives both contours the same number of frames so they overlay frame-for-frame", () => {
    expect(NATIVE_DEMO_CONTOUR.frames.length).toBeGreaterThan(20);
    expect(USER_DEMO_CONTOUR.frames.length).toBe(NATIVE_DEMO_CONTOUR.frames.length);
  });

  it("keeps both inside a plausible speaking range", () => {
    const voiced = [...NATIVE_DEMO_CONTOUR.frames, ...USER_DEMO_CONTOUR.frames]
      .map((f) => f.hz)
      .filter((hz): hz is number => hz !== null);

    expect(voiced.length).toBeGreaterThan(0);
    for (const hz of voiced) {
      expect(hz).toBeGreaterThan(70);
      expect(hz).toBeLessThan(400);
    }
  });

  it("makes the two contours differ — an overlay of identical curves shows nothing", () => {
    const native = NATIVE_DEMO_CONTOUR.frames.map((f) => f.hz);
    const user = USER_DEMO_CONTOUR.frames.map((f) => f.hz);

    expect(native).not.toEqual(user);
  });

  it("is deterministic — no randomness, no clock", () => {
    const a = NATIVE_DEMO_CONTOUR.frames.map((f) => f.hz);
    const b = NATIVE_DEMO_CONTOUR.frames.map((f) => f.hz);

    expect(a).toEqual(b);
    expect(DEMO_REF_HZ).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npm test -- lib/marketing/pitch-demo.test.ts`
Expected: FAIL — `Failed to resolve import "./pitch-demo"`.

- [ ] **Step 7: Write the fixtures**

Create `lib/marketing/pitch-demo.ts`:

```ts
import type { PitchContour } from "@/lib/pitch";

/**
 * The two contours drawn by the landing page's §4 showcase.
 *
 * ⚠️ THESE NUMBERS ARE ILLUSTRATIVE DESIGN MOCK DATA, NOT MEASUREMENT. So are
 * §4's four sub-scores (Pitch 86 · Rhythm 84 · Pronunciation 82 · Timing 90) and
 * its Overall Score of 87, which live in the copy catalog. They illustrate what
 * the feature shows a user. They are NOT a claim about scoring accuracy, NOT a
 * benchmark, and NOT a target. Nothing may derive a threshold from them.
 *
 * They are shaped like 日本の秋はとても美しいですね。 — a gentle rise across
 * 日本の秋, a peak on とても, and a fall through 美しいですね, with an unvoiced
 * gap at the phrase break. The "You" track follows the same phrase but flattens
 * the peak, which is exactly the error the real scorer is built to surface.
 */
const FRAME_INTERVAL_SECONDS = 0.01;

function toContour(hz: readonly (number | null)[]): PitchContour {
  return {
    frames: hz.map((value, i) => ({ time: i * FRAME_INTERVAL_SECONDS, hz: value })),
    sampleRate: 16000,
  };
}

/** A speaker-relative baseline, the same quantity `medianVoicedHz` would return. */
export const DEMO_REF_HZ = 180;

const NATIVE_HZ = [
  168, 170, 173, 177, 181, 186, 190, 194, 197, 199,
  201, 204, 208, 213, 219, 224, 228, 230, 231, 230,
  null, null,
  226, 221, 215, 209, 203, 197, 192, 187, 183, 179,
  176, 173, 171, 169, 167, 166, 165, 164,
] as const;

const USER_HZ = [
  171, 172, 174, 176, 179, 182, 184, 186, 188, 189,
  190, 191, 193, 195, 197, 199, 200, 201, 201, 200,
  null, null,
  199, 197, 195, 192, 190, 187, 185, 183, 181, 179,
  178, 177, 176, 175, 175, 174, 174, 173,
] as const;

export const NATIVE_DEMO_CONTOUR: PitchContour = toContour(NATIVE_HZ);
export const USER_DEMO_CONTOUR: PitchContour = toContour(USER_HZ);
```

- [ ] **Step 8: Run to verify it passes**

Run: `npm test -- lib/marketing/pitch-demo.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 9: Write the failing test for the showcase**

Create `components/marketing/pitch-showcase.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { PitchShowcase } from "./pitch-showcase";

describe("PitchShowcase", () => {
  it("draws TWO contours — the frame draws bars, which misrepresents a continuous quantity", async () => {
    const { container } = render(await PitchShowcase());

    const paths = container.querySelectorAll("[data-contour]");
    expect(paths).toHaveLength(2);
    expect(Array.from(paths).map((p) => p.getAttribute("data-contour"))).toEqual([
      "native",
      "you",
    ]);
  });

  it("labels which curve is which", async () => {
    render(await PitchShowcase());

    expect(screen.getByText("Native")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("gives the chart an accessible name and hides its internals from assistive tech", async () => {
    const { container } = render(await PitchShowcase());

    const chart = container.querySelector("svg[role='img']");
    expect(chart).toHaveAccessibleName(
      "Two pitch contours compared: a native speaker's and yours.",
    );
  });

  it("shows all four sub-scores and the overall score", async () => {
    render(await PitchShowcase());

    const scores = ["86/100", "84/100", "82/100", "90/100"];
    expect(scores).toHaveLength(4);
    for (const score of scores) {
      expect(screen.getByText(score)).toBeInTheDocument();
    }
    expect(screen.getByText("87")).toBeInTheDocument();
    expect(screen.getByText("Great!")).toBeInTheDocument();
  });

  it("renders the mascot from the approved source, not a Blender render", async () => {
    const { container } = render(await PitchShowcase());

    const mascot = container.querySelector("[data-mascot]");
    expect(mascot?.getAttribute("src")).toContain("/mascot/Korume.png");
    expect(mascot?.getAttribute("src")).not.toContain("/renders/");
  });
});
```

- [ ] **Step 10: Run to verify it fails**

Run: `npm test -- components/marketing/pitch-showcase.test.tsx`
Expected: FAIL — `Failed to resolve import "./pitch-showcase"`.

- [ ] **Step 11: Implement `PitchShowcase`**

Create `components/marketing/pitch-showcase.tsx`:

```tsx
import Image from "next/image";
import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { buttonStyles } from "@/components/ui/button";
import { toPlotPoints } from "@/lib/pitch";
import type { PitchContour, PlotPoint } from "@/lib/pitch";
import { NATIVE_DEMO_CONTOUR, USER_DEMO_CONTOUR, DEMO_REF_HZ } from "@/lib/marketing/pitch-demo";
import { Section } from "./section";

/**
 * §4 (spec §7).
 *
 * ⚠️ The frame draws a BAR CHART here. Pitch is a continuous quantity, so bars do
 * not merely look worse — they misrepresent the product's headline differentiator
 * (CLAUDE.md §5 #1). The reference draws two overlaid contours, and it is right.
 *
 * "Same shape as the real one" is enforced by SHARED CODE: the points below come
 * from `toPlotPoints`, the identical function `components/video-player/
 * pitch-contour.tsx` uses on real recorded audio. If the real renderer's plotting
 * changes, this changes with it. Do not reimplement the mapping here.
 */
const VIEWBOX_WIDTH = 600;
const VIEWBOX_HEIGHT = 160;

/** Points → an SVG path, starting a new subpath after every unvoiced gap. */
function toPath(points: readonly (PlotPoint | null)[]): string {
  let path = "";
  let penDown = false;
  for (const point of points) {
    if (!point) {
      penDown = false;
      continue;
    }
    path += `${penDown ? "L" : "M"}${point.x.toFixed(2)} ${point.y.toFixed(2)} `;
    penDown = true;
  }
  return path.trim();
}

function contourPath(contour: PitchContour): string {
  const { points } = toPlotPoints(contour, DEMO_REF_HZ, VIEWBOX_WIDTH, VIEWBOX_HEIGHT);
  return toPath(points);
}

const SUB_SCORES = ["pitch", "rhythm", "pronunciation", "timing"] as const;

export async function PitchShowcase() {
  const t = await getTranslations("marketing");
  const nativePath = contourPath(NATIVE_DEMO_CONTOUR);
  const userPath = contourPath(USER_DEMO_CONTOUR);

  return (
    <Section id="pitch" eyebrow={t("pitch.eyebrow")} heading={t("pitch.heading")}>
      <div className="grid gap-xl lg:grid-cols-[1fr_2fr]">
        <div>
          <p className="max-w-md text-body-lg text-muted-foreground">{t("pitch.body")}</p>
          <Link href="/shadowing" className={buttonStyles({ variant: "outline", className: "mt-lg" })}>
            {t("pitch.cta")}
          </Link>
        </div>

        <div className="rounded-lg border border-border bg-card p-lg">
          <div className="flex items-center gap-md text-caption">
            <span className="text-primary-strong">{t("pitch.legend.native")}</span>
            <span className="text-muted-foreground">{t("pitch.legend.you")}</span>
          </div>

          <svg
            role="img"
            aria-label={t("pitch.chartLabel")}
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            className="mt-sm w-full"
            preserveAspectRatio="none"
          >
            <path
              data-contour="native"
              d={nativePath}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              data-contour="you"
              d={userPath}
              fill="none"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <p className="mt-sm font-jp text-body-lg">{t("pitch.example.jp")}</p>

          <dl className="mt-lg grid grid-cols-2 gap-md sm:grid-cols-4">
            {SUB_SCORES.map((score) => (
              <div key={score}>
                <dt className="text-caption text-muted-foreground">{t(`pitch.scores.${score}.name`)}</dt>
                <dd className="text-heading font-semibold">{t(`pitch.scores.${score}.value`)}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-lg flex items-end justify-between gap-md">
            <div>
              <p className="text-caption text-muted-foreground">{t("pitch.scores.overallLabel")}</p>
              <p className="text-display font-bold">{t("pitch.scores.overall")}</p>
              <p className="text-body text-primary-strong">{t("pitch.scores.verdict")}</p>
            </div>
            <div className="flex items-center gap-sm rounded-lg border border-border bg-muted p-sm">
              <Image
                data-mascot
                src="/mascot/Korume.png"
                alt=""
                width={96}
                height={77}
                aria-hidden="true"
                /* The source is a light character cut out on pure black, so
                   `screen` maps its background exactly onto --void-950 and keeps
                   the tails' glow falloff — no matting, no halo (spec §5.3). */
                className="mix-blend-screen"
              />
              <div>
                <p className="text-caption text-primary-strong">{t("pitch.companion.name")}</p>
                <p className="text-caption text-muted-foreground">{t("pitch.companion.body")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
```

- [ ] **Step 12: Run to verify it passes**

Run: `npm test -- components/marketing/pitch-showcase.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 13: Fix §3's step-3 card with the same primitive**

Journey's "3 Shadow" card carries a crude bar cluster in the frame where the reference shows a waveform — G3 at smaller scale. In `components/marketing/journey.tsx`, replace that card's detail line with a compact SVG built from `USER_DEMO_CONTOUR` through `toPlotPoints`, exactly as above. Add to `components/marketing/journey.test.tsx`:

```tsx
it("draws step 3's waveform as a contour, not as bars", async () => {
  const { container } = render(await Journey());

  const shadow = container.querySelector('[data-step="shadow"]');
  expect(shadow?.querySelectorAll("[data-contour]")).toHaveLength(1);
});
```

Run: `npm test -- components/marketing/journey.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 14: Append to the page and commit**

Add `<PitchShowcase />` after `<Journey />`, then:

```bash
npm run typecheck && npm test
git add lib/pitch/plot.ts lib/pitch/plot.test.ts lib/pitch/index.ts \
        components/video-player/pitch-contour.tsx \
        lib/marketing/pitch-demo.ts lib/marketing/pitch-demo.test.ts \
        components/marketing/pitch-showcase.tsx components/marketing/pitch-showcase.test.tsx \
        components/marketing/journey.tsx components/marketing/journey.test.tsx \
        "app/[locale]/(marketing)/page.tsx"
git commit -m "feat(marketing): §4 pitch showcase on the shared plot primitive"
```

---

## Task 8: §5 Recommendation

**Files:**
- Create: `components/marketing/recommendation.tsx`, `components/marketing/recommendation.test.tsx`
- Modify: `app/[locale]/(marketing)/page.tsx`

**Interfaces:**
- Consumes: `Section`, `AssetSlot`; `recommend.*`.
- Produces: `Recommendation()`.

- [ ] **Step 1: Write the failing test**

The frame drops the topic chips and the "New Words" line, and sets the donut as a bare `96` without the percent treatment. Create `components/marketing/recommendation.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Recommendation } from "./recommendation";

describe("Recommendation", () => {
  it("renders the three cards the reference has", async () => {
    const { container } = render(await Recommendation());

    const cards = container.querySelectorAll("[data-recommend-card]");
    expect(cards).toHaveLength(3);
  });

  it("gives the familiar-words figure its percent treatment, not a bare number", async () => {
    render(await Recommendation());

    expect(screen.getByText("96")).toBeInTheDocument();
    expect(screen.getByText("%")).toBeInTheDocument();
    expect(screen.getByText("Familiar Words")).toBeInTheDocument();
  });

  it("lists all four reasons", async () => {
    const { container } = render(await Recommendation());

    const reasons = container.querySelectorAll("[data-reason]");
    expect(reasons).toHaveLength(4);
    expect(screen.getByText("Why this video?")).toBeInTheDocument();
  });

  it("holds the commute still as a pending asset slot, not the frame's neon placeholder", async () => {
    const { container } = render(await Recommendation());

    expect(container.querySelectorAll('[data-asset-pending="true"]')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- components/marketing/recommendation.test.tsx`
Expected: FAIL — `Failed to resolve import "./recommendation"`.

- [ ] **Step 3: Implement `Recommendation`**

Create `components/marketing/recommendation.tsx`. Take the donut's exact arc rendering from `get_design_context` on `347:6758`; the contract the tests pin is below.

```tsx
import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { buttonStyles } from "@/components/ui/button";
import { Section } from "./section";
import { AssetSlot } from "./asset-slot";

/**
 * §5 (spec §2).
 *
 * The i+1 claim itself is spec-backed (CLAUDE.md §5 #2) — do not soften it and do
 * not embellish it. The frame drops the topic chips and the "New Words" line and
 * renders the donut as a bare "96"; the reference has all three, and wins.
 */
const REASONS = ["vocabulary", "speed", "expressions", "difficulty"] as const;

export async function Recommendation() {
  const t = await getTranslations("marketing");

  return (
    <Section id="recommend" eyebrow={t("recommend.eyebrow")} heading={t("recommend.heading")}>
      <p className="max-w-2xl text-body-lg text-muted-foreground">{t("recommend.body")}</p>

      <div className="mt-lg grid gap-md lg:grid-cols-3">
        <div data-recommend-card className="rounded-lg border border-border bg-card p-md">
          <p className="text-caption text-muted-foreground">{t("recommend.cardHeading")}</p>
          <AssetSlot ratio="16/9" description={t("recommend.stillAlt")} className="mt-sm" />
          <p className="mt-sm font-jp text-body-lg">{t("recommend.video.jp")}</p>
          <p className="text-caption text-muted-foreground">{t("recommend.video.en")}</p>
        </div>

        <div data-recommend-card className="rounded-lg border border-border bg-card p-md">
          <p>
            <span className="text-display font-bold">{t("recommend.familiar.value")}</span>
            <span className="text-heading text-muted-foreground">{t("recommend.familiar.unit")}</span>
          </p>
          <p className="mt-2xs text-body font-medium">{t("recommend.familiar.label")}</p>
          <p className="text-caption text-muted-foreground">{t("recommend.familiar.body")}</p>
          <Link href="/register" className={buttonStyles({ className: "mt-md w-full" })}>
            {t("recommend.cta")}
          </Link>
        </div>

        <div data-recommend-card className="rounded-lg border border-border bg-card p-md">
          <h3 className="text-body font-medium">{t("recommend.why.heading")}</h3>
          <ul className="mt-sm space-y-xs">
            {REASONS.map((reason) => (
              <li key={reason} data-reason className="text-body text-muted-foreground">
                {t(`recommend.why.${reason}`)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
```

⚠️ The reference also carries an "i+1 Perfect Next Step" badge over the still and topic chips (Daily Life, Commuting) in the middle card. Both are present in the reference but **absent from the frame's text layers**, so they are content the frame does not carry — leave them out and raise them with the user rather than inventing the strings.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- components/marketing/recommendation.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Append to the page and commit**

Add `<Recommendation />` after `<PitchShowcase />`, then:

```bash
npm run typecheck && npm test
git add components/marketing/recommendation.tsx components/marketing/recommendation.test.tsx "app/[locale]/(marketing)/page.tsx"
git commit -m "feat(marketing): §5 i+1 recommendation"
```

---

## Task 9: §6 Capability chain

**Files:**
- Create: `components/marketing/capability-chain.tsx`, `components/marketing/capability-chain.test.tsx`
- Modify: `app/[locale]/(marketing)/page.tsx`

**Interfaces:**
- Consumes: `Section`; `chain.*`.
- Produces: `CapabilityChain()`.

- [ ] **Step 1: Write the failing test**

Create `components/marketing/capability-chain.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { CapabilityChain } from "./capability-chain";

const NODE_NAMES = [
  "Video & Context",
  "Shadowing",
  "Kanji",
  "Vocabulary",
  "Grammar",
  "JLPT Practice",
  "Conversation",
  "Memory & Review",
] as const;

describe("CapabilityChain", () => {
  it("renders all eight capability nodes", async () => {
    const { container } = render(await CapabilityChain());

    const nodes = container.querySelectorAll("[data-chain-node]");
    expect(nodes).toHaveLength(8);
    expect(NODE_NAMES).toHaveLength(8);
    for (const name of NODE_NAMES) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it("gives every node a DISTINCT caption — the frame repeats one placeholder eight times", async () => {
    const { container } = render(await CapabilityChain());

    const captions = Array.from(container.querySelectorAll("[data-chain-caption]")).map(
      (el) => el.textContent,
    );
    expect(captions).toHaveLength(8);
    expect(new Set(captions).size).toBe(8);
  });

  it("never renders the frame's placeholder caption", async () => {
    const { container } = render(await CapabilityChain());

    expect(container.textContent).not.toContain("Learn naturally, one layer at a time.");
  });

  it("threads the nodes with a decorative connector hidden from assistive tech", async () => {
    const { container } = render(await CapabilityChain());

    const thread = container.querySelectorAll("[data-connector]");
    expect(thread).toHaveLength(1);
    expect(thread[0]).toHaveAttribute("aria-hidden", "true");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- components/marketing/capability-chain.test.tsx`
Expected: FAIL — `Failed to resolve import "./capability-chain"`.

- [ ] **Step 3: Implement `CapabilityChain`**

Create `components/marketing/capability-chain.tsx`:

```tsx
import Image from "next/image";
import { getTranslations } from "@/lib/i18n/server";
import { Section } from "./section";

/**
 * §6 (spec §4, §8.2.2).
 *
 * ⚠️ The frame renders eight plain boxes with NO thread and gives all eight the
 * same placeholder caption, "Learn naturally, one layer at a time." The captions
 * below come from the reference and are content, not styling — do not rewrite
 * them, and do not let the placeholder back in (there is a test for it).
 *
 * ⚠️ The thread is decorative. It carries no data and is hidden from assistive
 * technology; the order it expresses is already the reading order.
 */
const NODES = [
  "video",
  "shadowing",
  "kanji",
  "vocabulary",
  "grammar",
  "jlpt",
  "conversation",
  "memory",
] as const;

export async function CapabilityChain() {
  const t = await getTranslations("marketing");

  return (
    <Section id="chain" eyebrow={t("chain.eyebrow")} heading={t("chain.heading")}>
      <div className="relative">
        <svg
          data-connector
          aria-hidden="true"
          focusable="false"
          className="pointer-events-none absolute inset-x-0 top-1/2 h-px w-full"
          viewBox="0 0 100 1"
          preserveAspectRatio="none"
        >
          <line
            x1="0"
            y1="0.5"
            x2="100"
            y2="0.5"
            stroke="hsl(var(--primary))"
            strokeWidth="0.5"
            strokeDasharray="1 2"
            opacity="0.6"
          />
        </svg>

        <ul className="relative grid grid-cols-2 gap-md sm:grid-cols-4 lg:grid-cols-8">
          {NODES.map((node) => (
            <li key={node} data-chain-node className="text-center">
              <span
                aria-hidden="true"
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card"
              />
              <p className="mt-xs text-body font-medium">{t(`chain.nodes.${node}.name`)}</p>
              <p data-chain-caption className="mt-2xs text-caption text-muted-foreground">
                {t(`chain.nodes.${node}.caption`)}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-lg flex justify-end">
        <Image
          src="/mascot/Korume.png"
          alt={t("chain.mascotAlt")}
          width={200}
          height={160}
          /* Cut out on pure black — `screen` maps that onto --void-950 exactly.
             See spec §5.3; do NOT use the Blender renders (deleted 2026-09-02), which the user
             rejected on 2026-08-27. */
          className="mix-blend-screen"
        />
      </div>
    </Section>
  );
}
```

⚠️ Each node carries an **icon** in both the frame and the reference. Take the eight icons from `get_design_context` on `347:6835`; the empty circle above is a placeholder for the icon, not for an asset.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- components/marketing/capability-chain.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Mutation-check the two placeholder guards**

```bash
#   messages/en/marketing.json: set chain.nodes.kanji.caption to
#   "Learn naturally, one layer at a time."
npm test -- components/marketing/capability-chain.test.tsx   # EXPECT: FAIL on both guards
git checkout messages/en/marketing.json
npm test -- components/marketing/capability-chain.test.tsx   # EXPECT: PASS
```

Paste both outputs into the task report.

- [ ] **Step 6: Append to the page and commit**

Add `<CapabilityChain />` after `<Recommendation />`, then:

```bash
npm run typecheck && npm test
git add components/marketing/capability-chain.tsx components/marketing/capability-chain.test.tsx "app/[locale]/(marketing)/page.tsx"
git commit -m "feat(marketing): §6 threaded capability chain"
```

---

## Task 10: §7 Trust

**Files:**
- Create: `components/marketing/trust.tsx`, `components/marketing/trust.test.tsx`
- Modify: `app/[locale]/(marketing)/page.tsx`

**Interfaces:**
- Consumes: `Section`, `AssetSlot`; `trust.*`.
- Produces: `Trust()`.

- [ ] **Step 1: Write the failing test**

These three claims are promises that match the `CLAUDE.md` §2 non-negotiables, so the test pins them **verbatim**. Create `components/marketing/trust.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Trust } from "./trust";

/** Verbatim — these are promises matching CLAUDE.md §2, not ordinary copy (spec §11 ruling 11). */
const CLAIMS: ReadonlyArray<readonly [string, string]> = [
  ["Your recordings stay private", "Encrypted at rest and never public by default."],
  ["Your data is yours", ""],
  ["AI with boundaries", ""],
];

describe("Trust", () => {
  it("renders exactly three trust cards", async () => {
    const { container } = render(await Trust());

    const cards = container.querySelectorAll("[data-trust-card]");
    expect(cards).toHaveLength(3);
    expect(CLAIMS).toHaveLength(3);
  });

  it("keeps the recordings claim verbatim", async () => {
    render(await Trust());

    expect(screen.getByText("Your recordings stay private")).toBeInTheDocument();
    expect(
      screen.getByText("Encrypted at rest and never public by default."),
    ).toBeInTheDocument();
  });

  it("names the other two claims", async () => {
    render(await Trust());

    expect(screen.getByText("Your data is yours")).toBeInTheDocument();
    expect(screen.getByText("AI with boundaries")).toBeInTheDocument();
  });

  it("holds the warm photograph as a pending asset slot", async () => {
    const { container } = render(await Trust());

    expect(container.querySelectorAll('[data-asset-pending="true"]')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- components/marketing/trust.test.tsx`
Expected: FAIL — `Failed to resolve import "./trust"`.

- [ ] **Step 3: Implement `Trust`**

```tsx
import { getTranslations } from "@/lib/i18n/server";
import { Section } from "./section";
import { AssetSlot } from "./asset-slot";

/**
 * §7 (spec §11 ruling 11).
 *
 * ⚠️ These three claims match the CLAUDE.md §2 non-negotiables exactly and ship
 * VERBATIM. They are promises about encryption at rest, data export/deletion and
 * AI training consent — not marketing copy to be improved. Changing one of them
 * means the product changed, and that is a different conversation.
 */
const CARDS = ["recordings", "data", "ai"] as const;

export async function Trust() {
  const t = await getTranslations("marketing");

  return (
    <Section id="trust" eyebrow={t("trust.eyebrow")} heading={t("trust.heading")}>
      <div className="grid gap-xl lg:grid-cols-[2fr_1fr]">
        <ul className="grid gap-md sm:grid-cols-3">
          {CARDS.map((card) => (
            <li key={card} data-trust-card className="rounded-lg border border-border bg-card p-md">
              <h3 className="text-body font-medium">{t(`trust.cards.${card}.name`)}</h3>
              <p className="mt-2xs text-caption text-muted-foreground">
                {t(`trust.cards.${card}.body`)}
              </p>
            </li>
          ))}
        </ul>
        <AssetSlot ratio="3/4" description={t("trust.photoAlt")} />
      </div>
    </Section>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- components/marketing/trust.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Append to the page and commit**

```bash
npm run typecheck && npm test
git add components/marketing/trust.tsx components/marketing/trust.test.tsx "app/[locale]/(marketing)/page.tsx"
git commit -m "feat(marketing): §7 trust"
```

---

## Task 11: §8 CTA and §9 Sign-off

Two small pieces, one commit — §9 is a four-line sign-off and would not carry its own review gate.

**Files:**
- Create: `components/marketing/cta.tsx`, `components/marketing/cta.test.tsx`
- Create: `components/marketing/signoff.tsx`, `components/marketing/signoff.test.tsx`
- Modify: `app/[locale]/(marketing)/page.tsx`

**Interfaces:**
- Consumes: `Section`, `AssetSlot`; `cta.*`, `signoff.*`.
- Produces: `Cta()`, `Signoff()`.

- [ ] **Step 1: Write both failing tests**

`components/marketing/cta.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Cta } from "./cta";

describe("Cta", () => {
  it("offers both calls to action", async () => {
    render(await Cta());

    expect(screen.getByRole("link", { name: "Start Learning" })).toHaveAttribute("href", "/en/register");
    expect(screen.getByRole("link", { name: "Explore Lessons" })).toHaveAttribute(
      "href",
      "/en/shadowing/explore",
    );
  });

  it("holds the night background as a pending asset slot", async () => {
    const { container } = render(await Cta());

    expect(container.querySelectorAll('[data-asset-pending="true"]')).toHaveLength(1);
  });

  it("renders the mascot from the approved source, not a Blender render", async () => {
    const { container } = render(await Cta());

    const mascot = container.querySelector("[data-mascot]");
    expect(mascot?.getAttribute("src")).toContain("/mascot/Korume.png");
    expect(mascot?.getAttribute("src")).not.toContain("/renders/");
  });
});
```

`components/marketing/signoff.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Signoff } from "./signoff";

describe("Signoff", () => {
  it("renders the frame-only sign-off the user ruled authoritative", async () => {
    render(await Signoff());

    expect(
      screen.getByRole("heading", { name: "A quieter way to keep going." }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- components/marketing/cta.test.tsx components/marketing/signoff.test.tsx`
Expected: FAIL both — unresolved imports.

- [ ] **Step 3: Implement both**

`components/marketing/cta.tsx`:

```tsx
import Image from "next/image";
import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { AssetSlot } from "./asset-slot";

/**
 * §8. Full-bleed night photograph, two buttons, a one-line note, mascot at right.
 * The frame HAS the photograph but washed out to near-flat black; it is held as a
 * pending slot until a usable file arrives (spec §5.2) rather than shipped dark.
 *
 * Not a `Section` — it is full-bleed and owns its own rhythm.
 */
export async function Cta() {
  const t = await getTranslations("marketing");

  return (
    <section id="cta" aria-labelledby="cta-heading" className="relative overflow-hidden py-2xl">
      <AssetSlot
        ratio="16/9"
        description={t("cta.backgroundAlt")}
        className="absolute inset-0 h-full w-full"
      />
      <Container className="relative flex flex-col items-center gap-md text-center">
        <h2 id="cta-heading" className="max-w-2xl text-balance font-display text-display font-bold">
          {t("cta.heading")}
        </h2>
        <p className="max-w-xl text-body-lg text-muted-foreground">{t("cta.body")}</p>
        <div className="flex flex-wrap justify-center gap-sm">
          <Link href="/register" className={buttonStyles({ size: "lg" })}>
            {t("cta.primary")}
          </Link>
          <Link href="/shadowing/explore" className={buttonStyles({ size: "lg", variant: "outline" })}>
            {t("cta.secondary")}
          </Link>
        </div>
        <p className="text-caption text-muted-foreground">{t("cta.note")}</p>
        <Image
          data-mascot
          src="/mascot/Korume.png"
          alt={t("cta.mascotAlt")}
          width={280}
          height={224}
          /* See spec §5.3 — cut out on pure black, screened onto --void-950. */
          className="mix-blend-screen"
        />
      </Container>
    </section>
  );
}
```

`components/marketing/signoff.tsx`:

```tsx
import { getTranslations } from "@/lib/i18n/server";
import { Section } from "./section";

/**
 * §9 (spec §11 ruling 4).
 *
 * ⚠️ FRAME ONLY — the reference does not have this section, and the frame wins
 * (user ruling, 2026-08-26). Polish to the reference's bar is allowed; changing
 * the content is not.
 */
export async function Signoff() {
  const t = await getTranslations("marketing");

  return (
    <Section id="signoff" heading={t("signoff.heading")}>
      <p className="max-w-xl text-body-lg text-muted-foreground">{t("signoff.body")}</p>
    </Section>
  );
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npm test -- components/marketing/cta.test.tsx components/marketing/signoff.test.tsx`
Expected: PASS, 4 tests total.

- [ ] **Step 5: Append both and commit**

Add `<Cta />` then `<Signoff />` after `<Trust />`, then:

```bash
npm run typecheck && npm test
git add components/marketing/cta.tsx components/marketing/cta.test.tsx \
        components/marketing/signoff.tsx components/marketing/signoff.test.tsx \
        "app/[locale]/(marketing)/page.tsx"
git commit -m "feat(marketing): §8 CTA and §9 sign-off"
```

---

## Task 12: The page composition and its e2e spec

**Files:**
- Modify: `app/[locale]/(marketing)/page.tsx`
- Create: `tests/e2e/landing-page.spec.ts`

**Interfaces:**
- Consumes: all nine section components.
- Produces: the finished `/`.

- [ ] **Step 1: Finalise the page**

```tsx
import { Hero } from "@/components/marketing/hero";
import { Problem } from "@/components/marketing/problem";
import { Journey } from "@/components/marketing/journey";
import { PitchShowcase } from "@/components/marketing/pitch-showcase";
import { Recommendation } from "@/components/marketing/recommendation";
import { CapabilityChain } from "@/components/marketing/capability-chain";
import { Trust } from "@/components/marketing/trust";
import { Cta } from "@/components/marketing/cta";
import { Signoff } from "@/components/marketing/signoff";

/**
 * `/` — the landing page (spec `2026-08-27-landing-page-port-design.md`).
 *
 * The order is frame 347:6277's and is not a preference: §11 ruling 1 makes that
 * frame the design for this route. Nav and footer are chrome and live in
 * `(marketing)/layout.tsx`.
 */
export default function LandingPage() {
  return (
    <main>
      <Hero />
      <Problem />
      <Journey />
      <PitchShowcase />
      <Recommendation />
      <CapabilityChain />
      <Trust />
      <Cta />
      <Signoff />
    </main>
  );
}
```

- [ ] **Step 2: Write the failing e2e spec**

Create `tests/e2e/landing-page.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

/** Frame 347:6277's order (spec §2). Nav and footer are chrome, asserted separately. */
const SECTION_IDS = [
  "hero",
  "problem",
  "journey",
  "pitch",
  "recommend",
  "chain",
  "trust",
  "cta",
  "signoff",
] as const;

test.describe("landing page", () => {
  test("renders all nine sections in the frame's order", async ({ page }) => {
    await page.goto("/en");

    const ids = await page.locator("main section[id]").evaluateAll((nodes) =>
      nodes.map((n) => n.id),
    );

    expect(SECTION_IDS).toHaveLength(9);
    expect(ids).toEqual([...SECTION_IDS]);
  });

  test("renders the nav and the footer as chrome outside main", async ({ page }) => {
    await page.goto("/en");

    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });

  test("has exactly one h1", async ({ page }) => {
    await page.goto("/en");

    await expect(page.locator("h1")).toHaveCount(1);
  });

  test("is reachable by keyboard from the top", async ({ page }) => {
    await page.goto("/en");
    await page.keyboard.press("Tab");

    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBe("A");
  });

  test("renders in Vietnamese too", async ({ page }) => {
    await page.goto("/vi");

    const ids = await page.locator("main section[id]").evaluateAll((nodes) =>
      nodes.map((n) => n.id),
    );
    expect(ids).toEqual([...SECTION_IDS]);
  });
});
```

- [ ] **Step 3: Run it**

Run: `npm run test:e2e -- landing-page`
Expected: PASS, 5 tests. If the section-order test fails, the composition order is wrong — fix `page.tsx`, not the test.

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/(marketing)/page.tsx" tests/e2e/landing-page.spec.ts
git commit -m "feat(marketing): compose the landing page and pin its section order"
```

---

## Task V: Visual fidelity against `346:6275`

Every other task on this branch asks "is this section correct?". This one asks the question the
owner has actually raised, repeatedly: **does the page LOOK right next to the reference?** It owns
composition, proportion and the small optical faults no unit test can see. Until 2026-09-02 it
existed only as one line in a gitignored ledger.

⚠️ **ORDERING. Run Task V BEFORE Task 13.** Task 13 changes page-wide rhythm (`py-2xl` in
`section.tsx`) and is explicitly forbidden from touching individual sections; if it runs first,
every measurement below moves and has to be retaken. Task A-MOTION may run either side — it adds a
layer, it does not move geometry.

⚠️ **MEASURE THE PAGE, NOT THE WINDOW.** This machine renders `/en` at `innerWidth` **1280** with a
15px classic scrollbar, so the *page* is **1265** and every percentage below is against 1265. Three
separate numbers on this branch were recorded wrong because a fact about the measuring window was
written down as a fact about the page. When you record a percentage-of-page or a distance-to-an-edge,
write the page width beside it or the number is worthless to the next reader.

⚠️ **Do not file a visual defect off a downscaled screenshot** — Task 10 nearly filed §7's photograph
as missing that way. Measure the element in the DOM first, then zoom to look.

**Files:**
- Modify: `components/marketing/journey-art.tsx` — the waveform's bar count and floor
- Modify: `components/marketing/journey.tsx` — where the card row's flex basis lives
- Modify: `components/marketing/journey.test.tsx` — the bar counts it pins, plus a range guard
- Modify: `components/marketing/capability-chain.tsx` — the companion's cross-axis alignment
- Create: `scripts/mascot/trim.js` — trims a pose to its opaque bounding box
- Modify: `public/mascot/poses/reading-on-the-orb.png`, `public/mascot/poses/hugging-an-orb.png`
- Modify: `scripts/mascot/poses.json` — the trimmed dimensions
- Modify: `scripts/mascot/poses.test.ts` — a new guard: a pose that SHIPS must be trimmed
- Modify: `tests/e2e/landing-page.spec.ts` — the two geometric facts jsdom structurally cannot see

**Interfaces:**
- Consumes: `MarketingContainer` and `--layout-marketing-max: 1256px` (Task 12) — content measures
  1192px at a 1265px page. `Section`'s `layout="split" | "stacked" | "centred"` (Task 11).
- Produces: nothing new for later tasks. `MASCOT_POSE` and `MASCOT_SIZES` keep their signatures;
  only the shape of the files they point at changes.

---

### V1 — §3's Shadow waveform renders as a smear, and the cause is scale, not data

**Measured on the live page** (page 1265, `#journey [data-shadow-waveform]`):

    rendered strip   103.84 x 33.74 CSS px
    bars             56, so the pitch is 103.84 / 56 = 1.854 CSS px
    bar width        1.02 CSS px    (WAVE_BAR_DUTY 0.55)
    gap              0.83 CSS px
    bar heights      min 6.07   max 28.43   -> a dynamic range of only 4.7 : 1

`journey-art.tsx`'s own docblock says the envelope was shaped because it "reads as speech at 130px
wide". **It ships at 103.84px.** At a 1.02px bar with a 0.51px corner radius every bar is a blurred
capsule, and the row reads as one orange smear.

The reference disagrees on range, not on width. A bar-column scan of the §3 card-3 zoom
(`ref/zoom-c3.png`) gives lit-column heights of **min 4, max 132 — a 33 : 1 range** — and puts the
waveform at **456 / 632 = 72.2%** of its card against our 103.84 / 146.51 = **70.9%**. So the strip
is the right width. There are too many bars in it, and the `Math.max(0.18, ...)` floor has flattened
the valleys that the two-tone split exists to show.

⚠️ **Do NOT "fix" this by returning to the pitch contour.** Ruled out 2026-08-29: §4 owns pitch, the
reference's card-3 graphic is symmetric about a centre line (amplitude, a different quantity), and
`journey.test.tsx` asserts `[data-contour]` has length 0 inside `[data-step="shadow"]`.

- [ ] **Step 1: Change the two tests that pin the bar counts, and add the guard that was missing**

In `components/marketing/journey.test.tsx`, the two existing expectations become:

```ts
    const bars = shadow?.querySelectorAll("[data-wave-bar]") ?? [];
    expect(bars).toHaveLength(32);
```

```ts
    // Explicit sizes, not just "non-empty" (CLAUDE.md §7): a single-tone
    // waveform would leave one of these at 0 and still satisfy a
    // greater-than-zero check on the other. 32 bars split at ~62%.
    expect(recorded).toHaveLength(20);
    expect(rest).toHaveLength(12);
```

Then add a third test in the same `describe`, pinning the property the smear violated:

```ts
  it("keeps the waveform's dynamic range wide enough to read as speech", async () => {
    const { container } = render(await Journey());

    const shadow = container.querySelector('[data-step="shadow"]');
    const bars = [...(shadow?.querySelectorAll("[data-wave-bar]") ?? [])];
    // L-004: a pattern-gathered collection asserts its own size, or an empty
    // match makes every expectation below unconditionally green.
    expect(bars).toHaveLength(32);

    const heights = bars.map((bar) => Number(bar.getAttribute("height")));
    expect(heights.every((h) => Number.isFinite(h) && h > 0)).toBe(true);

    // The defect this guards: Math.max(0.18, ...) floored the valleys so hard
    // that the tallest bar was 4.7x the shortest and the row read as one
    // block. The reference's own bar columns measure ~33:1 (ref/zoom-c3.png,
    // min 4 / max 132). 8:1 is well under what this envelope produces and
    // well over anything a re-flattened one could reach.
    expect(Math.max(...heights) / Math.min(...heights)).toBeGreaterThan(8);
  });
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run components/marketing/journey.test.tsx`
Expected: **FAIL** — 56 is not 32, 35/21 are not 20/12, and 4.7 is not greater than 8. Three
failures, from the three tests you touched. Anything else failing is not yours; stop and read it.

- [ ] **Step 3: Change the two constants**

In `components/marketing/journey-art.tsx`:

```ts
/**
 * 32, not the 56 this shipped with. The bar count is a function of the width
 * the strip ACTUALLY renders at, and that is 103.84 CSS px on a 1265px page —
 * not the 130px the envelope below was shaped for. 56 bars there is a 1.854px
 * pitch and a 1.02px bar, which at a 0.51px corner radius is a blurred
 * capsule; 32 gives a 3.245px pitch and a 1.78px bar, which survives
 * rasterisation at DPR 1. Re-derive it if the card's width ever changes:
 * floor(strip width / 3), the pitch below which a duty-0.55 bar falls under
 * ~1.7 CSS px.
 */
const WAVE_BARS = 32;
```

and, in `waveAmplitude`, the floor:

```ts
  // 0.05, not 0.18. The floor exists so the unrecorded tail still draws a line
  // instead of vanishing — but 0.18 of the half-height is 6.07 CSS px against
  // a 28.43px peak, a range of 4.7:1, and speech does not look like that. The
  // reference's bar columns run ~33:1 (ref/zoom-c3.png). 0.05 keeps a 1.69px
  // line in the valleys and takes the range to ~17:1.
  return Math.max(0.05, hull * syllables * grain);
```

- [ ] **Step 4: Run the tests again**

Run: `npx vitest run components/marketing/journey.test.tsx`
Expected: **PASS**, every test in the file.

- [ ] **Step 5: Look at it, at the size it actually ships**

```bash
npm run build && npm run start
```

Open `http://localhost:3000/en`, scroll `#journey` into view, and measure BEFORE you zoom:

```js
const w = document.querySelector('[data-shadow-waveform]');
const bars = [...w.querySelectorAll('[data-wave-bar]')].map((b) => b.getBoundingClientRect());
({ strip: w.getBoundingClientRect().width, bar: bars[0].width,
   minH: Math.min(...bars.map((b) => b.height)), maxH: Math.max(...bars.map((b) => b.height)) })
```

Expected: strip ~103.8, bar ~1.78, max/min near 17. Then zoom the card and confirm the bars are
separable and the valleys read as valleys.

---

### V2 — §3's fifth card is 16px wider than the other four

**Measured on the live page:** cards 1–4 are **146.51** CSS px; card 5 (`remember`) is **162.51**.

The cause is structural, not a stray class. Each `<li>` carries `CARD_BASIS` and holds a `StepCard`
plus a `StepArrow`, and the arrow renders only for `i < STEPS.length - 1`. For the first four the
basis is shared between a card, a `gap-2xs` and the arrow; the fifth hands its card the whole basis.
**16px is exactly the arrow plus its gap.**

⚠️ **This is the same construct as the 320/390 page overflow assigned to Task 13** (`shrink-0` +
`basis-[clamp(...)]`; the `LI` measured at right = 408 against a 320 viewport). Fix it once here,
then re-measure the overflow and report what actually happened — do not assume either way.

- [ ] **Step 1: Write the failing browser assertion**

jsdom loads no CSS in this suite (`capability-chain.test.tsx` records the same limit), so a width
assertion belongs in Playwright. In `tests/e2e/landing-page.spec.ts`:

```ts
test("§3's five step cards are all the same width", async ({ page }) => {
  await page.goto("/en");
  const cards = page.locator("#journey [data-step]");
  await expect(cards).toHaveCount(5);

  const widths = await cards.evaluateAll((els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().width)),
  );
  // The defect: the last card had no StepArrow sibling to share its flex
  // basis with, so it kept the arrow's 16px for itself.
  expect(new Set(widths).size, `widths were ${widths.join(", ")}`).toBe(1);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm run build && npm run start          # in one shell — see the webServer note
npx playwright test landing-page -g "same width"
```

Expected: **FAIL**, reporting widths like `147, 147, 147, 147, 163` (rounded; the exact values move
with the page width, which is why the assertion is "all equal" and not a literal).

⚠️ `playwright.config.ts` gives `webServer` 120,000 ms for `npm run build && npm run start`, and a
cold build measures ~135 s on this machine — so a cold `npx playwright test` dies before the first
test runs, and the tail of its output is webpack cache noise that looks like the real problem. Build
and start the server yourself first; `reuseExistingServer` is true locally.

- [ ] **Step 3: Move the basis from the list item to the card**

In `components/marketing/journey.tsx`:

```tsx
        {STEPS.map((step, i) => (
          // The basis lives on the CARD, not on this `li`. While it was here,
          // the `li` split it between the card, the gap and the arrow — and
          // the fifth `li`, which renders no arrow, handed its card the whole
          // basis and came out 16px wider than the other four.
          <li key={step} className="flex min-w-0 shrink-0 items-center gap-2xs">
            <StepCard step={step} t={t} />
            {i < STEPS.length - 1 ? <StepArrow /> : null}
          </li>
        ))}
```

and `StepCard` takes it, replacing `flex-1`:

```tsx
    <div
      data-step={step}
      className={cn(
        "flex h-full min-w-0 shrink-0 flex-col rounded-lg border border-border bg-card p-sm",
        CARD_BASIS,
      )}
    >
```

`cn()` and not a template literal, for the reason `StepPanel`'s docblock already gives.

- [ ] **Step 4: Run both suites**

```bash
npx vitest run components/marketing/journey.test.tsx    # EXPECT: green
npx playwright test landing-page -g "same width"        # EXPECT: 1 passed
```

- [ ] **Step 5: Re-measure the narrow-width overflow and report it honestly**

At 320, 390 and 768 in a fixed-width same-origin iframe — `resize_window` below 1280 reports success
while doing nothing on this machine, and four agents have now hit that — compare
`documentElement.scrollWidth` against `clientWidth`.

Task 13's recorded numbers are `320 -> 407 (+87)`, `390 -> 407 (+17)`, `768 -> 779 (+11)`. Record
what you actually get. If they closed, say so and strike them from Task 13. If they did not, leave
them assigned to Task 13 — the 768px one has never been attributed to an element and is a separate
defect from this one.

---

### V3 — §6's companion is too small and sits too low, and one cause is an untrimmed PNG

**Measured on the live page** (page 1265, content 1192):

    wrap       1192 wide, `xl:flex xl:items-end xl:gap-md` (gap 16)
    node grid  1016 wide (`xl:flex-1`), 186.67 tall, 8 cells of 127
    companion  160 x 160 box (`xl:shrink-0`), bottom-aligned
    icon-tile row centre  y 2805.01        companion centre  y 2879.68
    => the companion's centre sits 74.67 CSS px BELOW the tile row's centre

Three causes, and the first is the one nobody had looked for:

1. ⚠️ **`reading-on-the-orb.png` was never trimmed, and three of the five poses that ship were.**
   Alpha bounding boxes, measured with `scripts/mascot/png.js`:

        greeting.png            200x272   fill 100.0% x  99.3%                       (§1)
        noting.png              340x304   fill 100.0% x  99.0%                       (§4)
        resting.png             420x266   fill 100.0% x  99.2%                    (footer)
        reading-on-the-orb.png  499x500   fill  82.6% x  90.8%   pad L26 R61 T30 B16  (§6)
        hugging-an-orb.png      484x516   fill  83.1% x  82.2%   pad L66 R16 T54 B38  (§8)

   In a 160px box §6's creature therefore draws **132.1 x 145.3** CSS px and sits **5.6 CSS px left**
   of the box centre, because the right margin is 61px against the left's 26. **Trimming is this
   library's own convention** — this is not a change of taste, it is the two files that missed it.
2. **`MASCOT_WIDTH = 160` predates Task 12.** Its docblock derives 160 from the reference's 120
   export px against the OLD 1088px content; content is 1192 now and nobody re-derived it. Once
   trimmed the creature fills the 160 box — **12.6% of the 1265px page**, against a reference
   companion whose bright core measures 79 / 864 = **9.1%** and whose full body reads nearer 13%.
   160 is defensible after the trim. **Re-measure before changing it further.**
3. **`xl:items-end` is what puts it low.** It bottom-aligns a 160-tall box to a 186.67-tall grid.
   The reference draws the companion spanning the whole node block — top level with the icon tiles,
   body past the text — not hanging from the block's bottom.
   ⚠️ **NOT a cause: resolution.** `sizes="160px"` is correct and Next serves a 320px variant at
   DPR 2. Do not "fix" that.

▶ **The route this takes, and the one it deliberately does not.** Growing the box means taking width
from the grid: the `<ul>` is `xl:flex-1` and the companion `xl:shrink-0`, so every pixel the
companion gains, the 8 cells lose. Trimming buys a 21% larger creature for **zero** grid pixels, and
it leaves `capability-chain.tsx`'s "NOTHING OVERLAPS HERE" claim true. That is why this task trims
first and only then asks whether a width change is still wanted.

- [ ] **Step 1: Write the guard that would have caught it**

In `scripts/mascot/poses.test.ts`:

```ts
import png from "./png.js";

const { decode } = png as unknown as {
  decode: (path: string) => { w: number; h: number; ch: number; data: Uint8Array };
};

/** The opaque bounding box of a PNG that has an alpha channel. */
function opaqueBox(path: string) {
  const { w, h, ch, data } = decode(path);
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (ch === 4 && data[(y * w + x) * ch + 3] <= 8) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return { w, h, boxW: x1 - x0 + 1, boxH: y1 - y0 + 1 };
}

it("ships no pose with transparent margin — a placed pose is trimmed", () => {
  const placed = manifest.supplied.filter((pose) => pose.slot !== undefined);
  // L-004: an empty filter would make the loop below vacuously green, and this
  // is exactly the kind of guard that gets written over already-working code.
  expect(placed.length).toBeGreaterThanOrEqual(2);

  for (const pose of placed) {
    const { w, h, boxW, boxH } = opaqueBox(join(POSES_DIR, pose.out));
    // A placement sizes the FILE — `sizes="160px"` paints the box, not the
    // creature — so transparent margin is drawn size the creature never gets,
    // and asymmetric margin also pushes it off the box's centre.
    // reading-on-the-orb.png shipped at 82.6% x 90.8% and drew 132 x 145 CSS
    // px inside a 160px box, 5.6px left of centre.
    expect(boxW / w, `${pose.out} horizontal fill`).toBeGreaterThan(0.98);
    expect(boxH / h, `${pose.out} vertical fill`).toBeGreaterThan(0.98);
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run scripts/mascot/poses.test.ts`
Expected: **FAIL** — `reading-on-the-orb.png horizontal fill: expected 0.8256... to be greater than
0.98`. It must name the file. If it fails on `placed.length` instead, the manifest filter is wrong,
not the assets — fix that before going on.

- [ ] **Step 3: Write the trimmer**

`scripts/mascot/trim.js`, beside `extract.js` and on the same `png.js`:

```js
// Trims a supplied pose to its opaque bounding box. Lossless for the creature:
// only fully-transparent margin is removed, so every pixel the artwork draws
// survives byte-identical. `--check` re-derives the box and reports without
// writing, the contract `extract.js --check` already has.
const { decode, encode } = require("./png.js");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const ALPHA_FLOOR = 8;

function box({ w, h, ch, data }) {
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (ch === 4 && data[(y * w + x) * ch + 3] <= ALPHA_FLOOR) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function trim(rel, { write }) {
  const abs = path.join(ROOT, rel);
  const img = decode(abs);
  const b = box(img);
  const already = b.x0 === 0 && b.y0 === 0 && b.w === img.w && b.h === img.h;
  console.log(
    `${rel}: ${img.w}x${img.h} -> ${b.w}x${b.h} (offset ${b.x0},${b.y0})` +
      (already ? "  already trimmed" : ""),
  );
  if (already || !write) return b;
  const out = new Uint8Array(b.w * b.h * img.ch);
  for (let y = 0; y < b.h; y++) {
    const src = ((y + b.y0) * img.w + b.x0) * img.ch;
    out.set(img.data.subarray(src, src + b.w * img.ch), y * b.w * img.ch);
  }
  fs.writeFileSync(abs, encode({ w: b.w, h: b.h, ch: img.ch, data: out }));
  return b;
}

const write = !process.argv.includes("--check");
for (const f of process.argv.slice(2).filter((a) => !a.startsWith("--"))) trim(f, { write });
```

- [ ] **Step 4: Trim the two files, and confirm the other three are already tight**

```bash
node scripts/mascot/trim.js --check public/mascot/poses/greeting.png \
  public/mascot/poses/noting.png public/mascot/poses/resting.png
```
Expected: all three print `already trimmed`. If any does not, **stop** — the convention this task
argues from is not what you think it is.

```bash
node scripts/mascot/trim.js public/mascot/poses/reading-on-the-orb.png \
  public/mascot/poses/hugging-an-orb.png
```
Expected: `499x500 -> 412x454 (offset 26,30)` and `484x516 -> 402x424 (offset 66,54)`.

- [ ] **Step 5: Correct the manifest, which records the old dimensions**

In `scripts/mascot/poses.json`, `reading-on-the-orb` becomes `"width": 412, "height": 454` and
`hugging-an-orb` becomes `"width": 402, "height": 424`. Append to each entry's `origin`:
`Trimmed to its opaque bounding box on 2026-09-02 (scripts/mascot/trim.js) — no creature pixel changed.`

- [ ] **Step 6: Run the guard again**

Run: `npx vitest run scripts/mascot/poses.test.ts`
Expected: **PASS**, including the manifest/disk consistency tests that were already there.

- [ ] **Step 7: ⚠️ DO NOT touch `xl:items-end` — this step used to say "centre the companion"**

**That instruction was wrong, and it was caught by reading the component before applying it.**
`capability-chain.tsx`'s `Companion` docblock already says what the class is for:

> `xl:items-end` on the parent is what puts the orb on the rail: the grid and this column share a
> bottom edge, and the grid's bottom edge IS the rail.

§6's rail is layer B of the connector — a dashed line under the captions carrying an amber dot below
each node — and `ref/s6-band.png` draws the companion with its orb sitting on that line. Centring
the companion lifts the orb off the rail and breaks a composition that was correct.

▶ **What made it look wrong was never the alignment.** It was the untrimmed file: 16px of
transparent margin along the bottom meant `items-end` was pinning the MARGIN to the rail and the
creature floated 5.1 CSS px above it. That is also the §6 minor already on file as "the orb floats
above the rail" — the same defect, filed twice. Steps 3–6 close it, and the alignment needs nothing.

▶ **The lesson worth keeping:** a plan step written from a measurement ("its centre is 74.67px below
the tile row") can still name the wrong cause. The measurement was right; the tile row was simply
not the thing the companion is aligned to. **Read the class's own docblock before changing a class
that has one.**

- [ ] **Step 8: Pin what `items-end` actually promises**

In `tests/e2e/landing-page.spec.ts`, assert the companion's box bottom meets the node grid's,
because that contact is the whole point of the class and a refactor to `items-center` looks harmless:

```ts
test("keeps §6's companion standing on the rail", async ({ page }) => {
  await page.goto("/en");

  const mascot = await page.locator("#chain [data-chain-mascot]").boundingBox();
  const node = await page.locator("#chain [data-chain-node]").last().boundingBox();
  if (!mascot || !node) throw new Error("§6's companion or its node grid did not render");

  expect(Math.abs(mascot.y + mascot.height - (node.y + node.height))).toBeLessThan(1);
});
```

⚠️ **Note in the test what it CANNOT see**: this measures the image BOX. Whether the creature
reaches the box's bottom edge is a property of the FILE, and that is Step 1's guard — the untrimmed
pose floated the orb while this assertion stayed green.

⚠️ **Do NOT write this against `[data-chain-node]`'s CENTRE.** That was tried: the node is the whole
186.67px grid cell, so `items-end` puts the companion's centre 13.19px from it and a "centred"
assertion with a 12px bound passes or fails on rounding. The 74.67px figure is the distance to the
ICON-TILE ROW's centre, which is a different element.

- [ ] **Step 9: Mutation-check the guards that were written over working code**

CLAUDE.md §7: a guard written after the fact cannot fail first. Step 1's pose guard genuinely failed
first (it named `hugging-an-orb.png` at 0.8305785123966942), so it needs nothing more. Step 8's does
not — it was green the moment it was written — so it must be broken deliberately:

```bash
# flip xl:items-end -> xl:items-center in capability-chain.tsx
npm run build && npm run start
npx playwright test landing-page -g "standing on the rail"   # EXPECT: red
# restore, rebuild, re-run                                    # EXPECT: green
```

**Print both outputs in the task report.** A mutation check you did not print is a claim, not
evidence. Restore with `git checkout --` or a copy, then confirm `git diff --stat` shows only your
intended change.

- [ ] **Step 10: Look at it beside the reference**

Render `/en`, scroll `#chain` into view, compare against `ref/s6-band.png`. What you are looking
for: the companion's orb ON the rail, its top reaching up into the icon-tile row, and its optical
centre in its own column instead of pulled left.


---

### V4 — the two items earlier tasks parked for this one

Both are Task A1 minors. Neither has been measured since. Measure before deciding.

- [ ] **Step 1: §1's video still and the reference's fuller transport bar**

A1 wired `hero-still.png`'s `src` and never reconciled the crop or the transport chrome against the
reference. Open `ref/s1-hero-card.png` and `ref/s1-transport.png` beside the live `#hero` and either
close it — recording what matched — or write down exactly what differs. **Do not invent transport
controls the reference does not draw**: §1's chrome is decoration, `aria-hidden`, and inventing an
affordance implies a feature that does not exist.

- [ ] **Step 2: §2's photograph at the narrow end of `lg`**

At 1024 the photograph is fully opaque for its last ~16px behind the SRS chip. A1 verified with
`elementFromPoint` that the chip is opaque and on top, so nothing is unreadable — the composition is
simply tighter than at 1280. Re-measure in a fixed-width iframe at 1024 and either extend the
left-edge fade or record it closed.

⚠️ Whatever changes here, **A1's three load-bearing mechanisms stay**: the left-edge fade,
`relative z-10` on the constellation, and `pointer-events-none` on the photograph. They are
mutation-guarded and commented as load-bearing; a composition tweak must not quietly retire one.

---

### V5 — the dot-grid guard pins counts, not arrangement

§3's dot grid shipped as a uniform 5x3 because a brief's prose said so, where the binding reference
draws 6x3 and sparse. The arrangement was fixed; the test still asserts totals — so **a scrambled
`DOT_MASK` with the same number of filled dots stays green forever**, which is the very failure mode
that let the wrong count ship.

- [ ] **Step 1: Add the arrangement assertion**

In `components/marketing/journey.test.tsx`, beside the existing dot-grid test, assert the per-row
fill profile rather than the total. Read the expected profile off `DOT_MASK` in `journey-art.tsx`
and write the literals in, with a comment saying they come from the reference.

⚠️ Read `journey-art.tsx` first: if the dots carry no row-identifying attribute, adding one is part
of this step. An arrangement assertion that infers rows from DOM order is a guard on the renderer's
loop order, not on the arrangement.

- [ ] **Step 2: Mutation-check it**

Scramble `DOT_MASK` keeping the same total, run the test, watch it go red, restore, run it green.
Print both outputs.

---

### V6 — the gate, and the commits

- [ ] **Step 1: Full gate**

```bash
npm run typecheck    # EXPECT: exit 0
npm run lint         # EXPECT: 0 errors
npx vitest run       # EXPECT: all green — record files/tests from THIS command's output
npm run build        # EXPECT: exit 0
npx playwright test  # EXPECT: all green (build and start the server yourself first)
```

⚠️ **L-002, which has now fired three times on this branch: never put a measured number and the
command that produces it in the same shell invocation.** Both of Task 12's commit messages state a
suite total that was written before the run existed. Run the suite, read the output, then write the
message.

- [ ] **Step 2: Commit, one concern at a time**

```bash
git add components/marketing/journey-art.tsx components/marketing/journey.test.tsx
git commit -m "fix(marketing): give the shadow waveform bars you can see"

git add components/marketing/journey.tsx tests/e2e/landing-page.spec.ts
git commit -m "fix(marketing): make all five journey cards one width"

git add scripts/mascot/trim.js scripts/mascot/poses.json scripts/mascot/poses.test.ts \
        public/mascot/poses/reading-on-the-orb.png public/mascot/poses/hugging-an-orb.png \
        components/marketing/capability-chain.tsx
git commit -m "fix(marketing): trim the two untrimmed poses and centre the companion"
```

---

---

### What Task V actually did — executed 2026-09-02

V1, V2, V3 and V5 are **DONE and committed**. V4 is **measured and reported, not closed** — both
of its remaining gaps need something that is the owner's to give.

    92b8214  fix(marketing)  V1  the waveform
    d720eb7  fix(marketing)  V2  the card row
    7afc664  fix(mascot)     V3  the two untrimmed poses
    4af5646  test(marketing) V5  the dot-grid arrangement guard

Measured after, on the live page, page width **1265** (window 1280 less a 15px scrollbar):

    §3 waveform   32 bars · bar 1.78 CSS px · min 1.69 · max 28.36 · range 16.78 : 1
                  (was 56 · 1.02 · 6.07 · 28.43 · 4.7 : 1)
    §3 cards      146.51 x5      (was 146.51 x4 + 162.51)
    §6 companion  160 x 176 · bottom flush with the node block (delta 0.00)
                  node grid unchanged at 1016 — the creature grew 21% for zero grid pixels

Gate: `npm run typecheck` exit 0 · `npm run lint` 0 errors · `npx vitest run` **2563 tests over 280
files, 0 failed** · `npx playwright test` **23 passed** (21 before; V2 and V3 added one each).

⚠️ One e2e went red on the first full run and it was NOT the diff: `auth-locale-round-trip.spec.ts`,
with `PGRST303 / JWT issued at future` and digest `1612785857` in the server log — the same digest
already on file. `date -u` on the host read 12:49:34 against the Supabase container's 12:49:35. It
passed on re-run and in the full run after. The container clock skew is still unfixed, so this can
recur; read the digest first.

#### V4 Step 1 — §1's still and transport bar: MEASURED, NOT CLOSED

Rendered `/en` beside `ref/s1-hero-card.png`. Most of the card already matches: the transport bar
with its play glyph and progress line, the Transcript/Japanese/Translation/Notes tabs, the
transcript lines, the right rail's Sentence 1/29 with Japanese, romaji and English, and the
Companion line. Two things differ, and **neither is mine to decide**:

1. The reference's transport bar carries a **timestamp on the left and four control glyphs on the
   right**. Adding them means choosing which four affordances to depict — the plan's own step warns
   against inventing chrome, and depicting a control implies the feature.
2. The reference's Key Words list has **three** entries (通り, 静か, 落ち着く); ours has two. A third
   needs a new catalog key, and the catalog is the owner's — the same ruling A2 made when it
   declined to invent §3 card 2's romaji and chip.

▶ Put both to the owner. Do not close this by building either.

#### V4 Step 2 — §2's photograph at the narrow end of `lg`: RE-MEASURED, CLOSED

In a fixed-width same-origin iframe at a **layout width of 1024** (the iframe had to be 1039 CSS px
wide — it carries its own 15px scrollbar, and a 1024px iframe lays out at 1009 and drops below the
`lg` branch entirely):

    photograph  599.04 .. 1024  (424.96 wide)
    fade length 20% of 424.96 = 84.99
    chips end   700.32     ->  overlap 101.28,  opaque overrun 16.29 px

A1 recorded 99.8 / 83.7 → ~16px. It re-derives, and Task 12's widening did not move it: at 1024 the
container is viewport-bound, not capped. Mechanism (2) still holds — every chip is an opaque
`bg-card` panel lifted by `relative z-10`, so nothing behind one reaches its text.

▶ **Closed as verified-harmless, not fixed.** Lengthening the fade to clear the overlap at 1024
(24%) would over-fade the photograph at 1280, which is the reference's own width and the one that
matters. The three load-bearing mechanisms stay exactly as A1 left them.

#### Still open after Task V

- **V4 Step 1's two questions, above.** Owner's call.
- **§3's card 1 order**, ruled correct and closed below — reversible in one line if the owner still
  wants the row uniform.
- **The narrow-width overflow (V2 Step 5) was not re-measured.** V2 changed the last item's padding,
  not the `shrink-0` + `basis-[clamp(...)]` construct the 320/390 overflow comes from, so Task 13's
  numbers are assumed to stand — **assumed, not verified**. Measure them in Task 13 rather than
  trusting this line.
- **`MASCOT_WIDTH` was not re-derived** against Task 12's wider content. After the trim the creature
  fills its 160px box at 12.6% of a 1265px page, which reads correctly beside the reference, so it
  was left alone deliberately.

### Ruled and closed by Task V — do not re-open

- **§3's card 1 leading with the still, its label below, is CORRECT.** The owner raised it on
  2026-09-02 as an inconsistency — "1 Watch" reads as a caption where "2 Understand" reads as a
  heading. It was checked against the reference rather than argued: `ref/zoom-c1.png` draws the
  still first with "1 Watch / Real Japanese video" beneath it, and the proportion matches ours —
  the still is **70%** of the card's height in both. `WatchBody`'s docblock already says why.
  What made the row read wrong is V1 and V2, which sit in the same eyeline.
  ▶ If the owner still wants the row uniform after V1–V3 land, it is a one-line change (lead
  `WatchBody` with `StepHeading`) and a deliberate departure from the reference — worth recording
  as one, not worth doing silently.

---

## Task 13: Density, reduced motion, and the accessibility sweep

The last task is the one that makes the page read as a product rather than nine correct sections.

**Files:**
- Modify: `components/marketing/section.tsx` (rhythm)
- Modify: any section whose spacing fights the rhythm
- Modify: `app/globals.css` if a reduced-motion rule is needed

- [ ] **Step 1: Measure the page as built**

```bash
npm run build && npm start
```

Open `http://localhost:3000/en` at a 1280px viewport. Record `document.body.scrollHeight` from the console.

Reference: **~2698px** at this width. Frame: **4028px**.

⚠️ `2698` is a **visual review target, not a threshold**. Do not add an assertion for it anywhere — responsive typography, font loading, viewport and wrapping all move it legitimately (spec §6). You are asking "does this read as dense as the reference", not "is this number correct".

- [ ] **Step 2: Tighten the rhythm in one place**

If the page is markedly looser than the reference, change `py-2xl` in `components/marketing/section.tsx` and the `mt-lg` between heading and body — **not** the individual sections. That is why the rhythm lives in one component. Re-measure after each change.

- [ ] **Step 3: Verify reduced motion loses no content**

```bash
# In the browser devtools: Rendering → Emulate CSS prefers-reduced-motion: reduce
```

Walk the page and confirm: every connector still visible in its final state, every mascot still present, no section collapsed or blank. Reduced motion disables movement, never content (spec §4.1).

- [ ] **Step 4: Keyboard sweep**

Tab from the top of `/en` to the bottom. Confirm: focus is always visible; the order is the reading order; no connector, mascot or asset slot ever takes focus; every link's accessible name is its visible label.

- [ ] **Step 5: Verify no connector reaches assistive technology**

```bash
npm test -- components/marketing
```

Then in the browser, run in the console:

```js
document.querySelectorAll('[data-connector], [data-step-arrow]').length
document.querySelectorAll('[data-connector][aria-hidden="true"], [data-step-arrow][aria-hidden="true"]').length
```

Expected: the two numbers are equal, and greater than zero. A zero first number means the selector is wrong, not that the page is clean — check before concluding.

- [ ] **Step 6: Full gate**

```bash
npm run typecheck    # EXPECT: exit 0
npm run lint         # EXPECT: 0 errors
npm test             # EXPECT: all green; record files/tests
npm run build        # EXPECT: exit 0
npm run test:e2e     # EXPECT: all green
```

Record every command's output in the task report — not a summary of it (`CLAUDE.md` §7: never claim something works without showing the output).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(marketing): density pass, reduced-motion and a11y sweep"
```

---

## After Task 13

1. **Whole-branch review** (`CLAUDE.md` §9, `docs/lessons.md` L-011) — required even though every task was reviewed on its own. Then a **review of the fix wave** (L-012): on this project the second pass has repeatedly caught defects the first wave created.
2. **Write lessons** to `docs/lessons.md` per its four entry rules — merged into an existing entry where one applies, not appended as a new one.
3. **Update `mem:landing_page_port_run_state`** and `mem:project_status` § NEXT ACTION.
4. **Open items to put to the user**, none of which block the merge:
   - the five photographs, still the reason `AssetSlot` exists;
   - §5's "i+1 Perfect Next Step" badge and topic chips — in the reference, absent from the frame (Task 8 Step 3);
   - Discord / Facebook / TikTok URLs, and whether either app store block should ever become a link;
   - ✅ ANSWERED 2026-09-02: the owner ruled delete. `public/mascot/renders/` and `assets/blender/references/` are gone (recoverable from git history). `assets/blender/korume.blend` was NOT part of the ruling and stays.
