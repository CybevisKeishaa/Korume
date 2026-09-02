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
