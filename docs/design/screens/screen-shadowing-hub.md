# Shadowing Hub

## The learner's home for shadowing

> **Status:** Desktop Hub repair in progress. Presentation reference is Figma
> frame `149:2` in file `IwFHZDZdHW7qsSFiNbWrkd`; the historical authority
> is `docs/superpowers/specs/2026-08-07-shadowing-hub-plan-c-design.md` §4.
> This replaces the older collection-grid description. Explore is a separate
> C3 screen, not a Hub section.
>
> The responsive, no-data, and Hub-copy contract is
> `docs/superpowers/specs/2026-09-09-desktop-hub-empty-states-design.md`.

The Shadowing Hub is the personalised starting point for choosing, creating,
resuming, and discovering Lessons. A Lesson is the canonical learning object;
each region below is a projection of existing Lesson, library, progress, or
recommendation data. The Hub never copies a second lesson store.

It is not a media browser, a generic dashboard, or an imitation of YouTube.
It should feel quiet and editorial while remaining honest about a learner's
actual study state.

## Desktop layout

Korume is desktop web from 1024px upward. The application sidebar is provided
by app chrome. Inside it, the Hub uses a fluid main column beside a permanent
300px continuity rail. `TwoColumnShell` owns the main-column minimum, gutters,
and gap so navigation collapse gives released width back to the content.
Below 1024px, the Hub is not a responsive web screen: the locale root exposes
only the app-download handoff.

The main column appears in this fixed authored order:

1. **Header** — eyebrow, `Shadowing Hub` H1, and short orientation copy.
2. **Featured lesson** — the first Lesson in the editorial `featured`
   collection, when one exists; its real thumbnail, title, JLPT estimate,
   duration, and Start/Continue action are shown.
3. **Inline import and quota** — a YouTube URL form backed by the validated
   import endpoint, plus the learner's real monthly allowance.
4. **My Lessons** — the learner's ready or unavailable private imports.
5. **Search and filters** — title search and Situation/Source taxonomy chips.
6. **Popular lessons** — the ranking-port projection, not a copied formula.
7. **Continue learning** — only unfinished real progress rows.
8. **Recently added** — current access-visible Lessons ordered by creation.
9. **Recommended for you** — recommendations only when their reason is a
   measured learner-data fact.

No data removes no authored region. Featured, My Lessons, Popular, Continue
learning, Recently added, and Recommended keep quiet empty interiors rather
than sample cards, fabricated learner facts, or invented actions. My Lessons
alone links to the real inline import control.

## Data and interaction contract

### Import and My Lessons

The inline form uses `/api/videos/import`; video playback remains the official
YouTube IFrame Player API and no media is downloaded, proxied, or stored.

Quota is read from `user_lesson_library`. Free learners see their current
monthly use; Plus has an explicit unlimited allowance. A private import with
no available transcript remains visible as **unavailable** and can retry its
caption fetch. It is not silently discarded and it does not invent a pipeline
percentage, ETA, or completed job.

The current creation pipeline is synchronous. During a client request the UI
may identify that an import is in progress, but durable job steps,
percentages, estimates, and resumable jobs belong to C4.

### Search and taxonomy

Search is a server-rendered GET on the locale-preserving Hub route. It filters
Lesson title with `ILIKE`; a selected taxonomy chip applies the real
`situation_id` or `source_id`. Situation and Source are independent axes.
Their labels live in the `shadowing.situations.*` and `shadowing.sources.*`
i18n catalogs, never in database display columns or an application map.

### Editorial shelves

The Hub's order is editorial, not a collection loop. `Popular` uses the
ranking strategy port; `Continue` uses recorded unfinished position; `Recent`
uses creation order; `Recommended` consumes the recommendation contract. A
reason line is shown only for a non-null structured reason, currently a
measured known-word fit.

## Continuity rail

At every desktop width from 1024px upward, the permanent 300px complementary
rail keeps these four labelled cards:

- Lesson preparation
- Today's goal
- Weekly progress
- Suggested next lesson

The rail is supplementary: no required learning action exists only there. It
is not a Companion anchor. The non-empty Hub has no approved mascot/Companion
presence.

Only recorded Shadowing-scoped facts belong in the weekly card. Until durable
preparation, daily-goal, and weekly-activity sources exist, those cards render
their explicit empty states. Global SRS due counts and generic streak values
must not be relabelled as weekly Shadowing progress. A suggestion may appear
only with a structured, measured recommendation reason.

## Visual and accessibility requirements

- Cards use stored thumbnails or an accessible thumbnail fallback; no
  hardcoded/sample images.
- Every Lesson action is a locale-aware link with a visible focus treatment.
- The Hub has one page `main` landmark; shelves and rail cards have named
  regions/headings; import failures use an alert.
- At 1023px the desktop Hub landmarks are absent and the accessible app-store
  handoff is the only rendered experience. At 1024px and above, the main and
  rail remain side by side without document-level horizontal overflow.
- Reduced motion must not hide content or prevent import, search, filter, or
  Lesson actions.
- All new copy has EN and VI catalog entries. Metadata labels and duration
  formatting are localized; components do not carry English literals.

## Explicit exclusions

- Explore Lessons and its preview drawer are C3.
- Job percentages, ETA, and durable import lifecycle are C4.
- A mascot/Companion anchor on the populated Hub is not approved.
- The Hub does not derive popularity or recommendation reasons in the view.

## Verification contract

Focused data and RTL tests cover the Hub read model, empty states, shelf order,
locale-preserving discovery, taxonomy labels, and no-fabrication rules.
Production browser coverage verifies the main landmark, keyboard import path,
responsive rail behaviour, no horizontal overflow, reduced motion, and no
fabricated progress. The canonical execution record is
`docs/superpowers/run-state/shadowing-hub-plan-c2.md`.
