# Korume Mobile --- Information Architecture & Screen Map

> **Status:** Product architecture draft for mobile\
> **Purpose:** Source of truth for deciding which Korume web
> capabilities belong on mobile, how they are reorganized, and which
> mobile screens should be designed/implemented first.\
> **Principle:** Mobile Korume is not a reduced desktop app. Preserve
> learning capability and decision hierarchy, not desktop information
> density.

------------------------------------------------------------------------

## 1. Mobile product thesis

Korume mobile is a **Japanese practice companion in your pocket**.

The three highest-value repeated mobile behaviors are:

1.  **Shadowing** --- listen, imitate, record, compare, repeat.
2.  **Review / topic-based flashcards** --- short SRS sessions organized
    around useful contexts and learned material.
3.  **Analyze Japanese** --- paste or encounter a sentence, understand
    its structure, then turn useful parts into learning material.

They connect into one loop:

**Listen → Shadow → Encounter something unclear → Analyze → Mine / Save
→ Review → Remember**

Companion sits across this loop as the long-term memory and
conversational layer, not as a floating chatbot on every screen.

### Product layers

**CORE --- must be exceptional** - Shadowing - Review / Flashcards -
Analyze

**COMPANION --- retention and personalization** - Companion
conversation - Voice conversation - Learning Memory - Reflection -
Growth observations - Personalized recommendations

**EXTENDED --- available without controlling primary navigation** -
Lesson discovery - Kanji - Vocabulary - Grammar - Reading - JLPT /
certification - Roadmap - Profile - Settings - Membership

------------------------------------------------------------------------

## 2. Primary navigation

Persistent five-item bottom navigation:

**Home · Shadowing · Review · Analyze · Companion**

### Home

Answers: **"What should I learn right now?"**

Not a compressed dashboard. Prioritize: - Continue current learning -
Today's review - Quick entry to Shadowing / Review / Analyze - One
strong i+1 recommendation - One restrained Companion observation

Profile, Settings and Membership are reached from the avatar/account
entry.

### Shadowing

Korume's signature destination: - Continue Shadowing - Recommended
lessons - Explore entry - Shadowing lesson workspace - Pronunciation /
pitch comparison - Dictation - Session summary

### Review

The SRS/repeated-practice destination: - Due cards - Topic decks - Kanji
decks - Vocabulary - Recently mined sentences - Material/course decks -
Mistake review - Flashcard practice

Use **Review**, not "Flashcards", so the destination can grow beyond one
card type.

### Analyze

First-class utility: - Type or paste Japanese - Meaning - Sentence
chunks - Grammar - Vocabulary - Kanji - What to notice - Add to Review -
Inspect - Ask Companion

Use the short mobile label **Analyze**, not "Grammar Analysis".

### Companion

Long-term relationship and memory: - Text conversation - Voice
conversation - Learning observations - Reflection - Memory - Diary -
Growth areas - Conversation memories - Personalized suggestions

------------------------------------------------------------------------

## 3. Desktop → mobile transformation rules

  -----------------------------------------------------------------------
  Desktop pattern                     Mobile translation
  ----------------------------------- -----------------------------------
  Persistent left sidebar             Bottom navigation + contextual top
                                      bar

  Contextual right rail               Inline card, bottom sheet, or
                                      destination page

  Two/three-column workspace          One primary task + progressive
                                      disclosure

  Quick Preview drawer                Bottom/full-height sheet

  Large modal                         Bottom sheet or full-screen flow
                                      depending on complexity

  Hover                               Explicit tap; long press optional,
                                      never required

  Dense dashboard                     Priority feed

  Horizontal roadmap                  Vertical journey

  Data table                          Grouped / expandable rows

  Companion right rail                Contextual Companion entry +
                                      Companion tab

  Multi-panel Inspect                 Quick Inspect sheet → full detail

  Search overlay                      Full-screen mobile search

  Side-by-side analysis               Selectable chunks + progressive
                                      sections

  Exam booklet + answer sheet         Question/content viewport + Answer
                                      Navigator
  -----------------------------------------------------------------------

**Context must follow the learner.** Examples:
`Shadowing sentence → Analyze`, `Flashcard → Inspect`,
`Mistake → Companion`.

------------------------------------------------------------------------

## 4. Classification vocabulary

-   **CORE** --- first-class mobile destination/flow.
-   **KEEP** --- preserve capability as a mobile screen.
-   **REDESIGN** --- preserve capability but change composition
    substantially.
-   **MERGE** --- absorb into another stronger screen/flow.
-   **DEEP** --- available deeper in navigation.
-   **DESKTOP-PRIORITY** --- supported if appropriate but intentionally
    not a major mobile workflow.
-   **SYSTEM** --- reusable state rather than destination.
-   **MOBILE-ONLY** --- useful mobile behavior without a direct desktop
    equivalent.

------------------------------------------------------------------------

## 5. Screen Map

### A. Home

  Web capability                Decision       Mobile destination
  ----------------------------- -------------- -------------------------
  Dashboard / Homepage          **REDESIGN**   Mobile Home
  Shadowing Hub continue hero   **MERGE**      Home + Shadowing
  AI Recommendation rail        **MERGE**      One Home recommendation
  Today's Goal                  **MERGE**      Home / Review
  Weekly Progress               **DEEP**       Progress / Memory
  Achievement                   **DEEP**       Profile / Journey
  Recently Added                **MERGE**      Explore
  Recommended For You           **KEEP**       Home + Explore

**Proposed Home hierarchy** 1. Korume + avatar 2. Greeting/current
context 3. **Continue Shadowing** 4. Quick actions: **Shadow · Review ·
Analyze** 5. Review due 6. One i+1 recommendation 7. One **Korume
noticed** observation 8. Optional continuation content below fold

### B. Shadowing & video

  -----------------------------------------------------------------------
  Web capability          Decision                Mobile destination
  ----------------------- ----------------------- -----------------------
  Shadowing Hub           **REDESIGN / CORE**     Shadowing Home

  Explore Lessons         **KEEP**                Explore

  Quick Preview           **REDESIGN**            Lesson Preview Sheet

  Lesson detail           **KEEP**                Lesson Detail

  Shadowing Practice      **REDESIGN / CORE**     Shadowing Practice

  Pronunciation Practice  **MERGE + KEEP**        Shadowing feedback /
                                                  dedicated practice

  Pitch visualization     **KEEP / CORE**         Pronunciation Feedback

  Dictation               **KEEP**                Dictation Practice

  Summary                 **KEEP**                Session Summary

  Generate/Create Lesson  **DEEP**                Create Lesson

  Generate done           **SYSTEM**              Completion state

  Pronunciation Library   **MERGE**               Review / Shadowing
                                                  history

  Pronunciation Detail    **KEEP**                Pronunciation Detail

  Playlist                **DEEP**                Saved Lessons
  -----------------------------------------------------------------------

**Shadowing Practice hierarchy** 1. Compact official video/player 2.
Sentence position 3. Japanese sentence + adaptive furigana 4.
Translation 5. **Listen → Record → Compare** 6. Pronunciation / pitch /
timing / clarity feedback 7. **Try Again / Next Sentence** 8. **Analyze
· Mine · Inspect**

No persistent Companion bubble during repeated practice.

### C. Review / SRS / Flashcards

  Web capability           Decision              Mobile destination
  ------------------------ --------------------- ---------------------------------
  Review Center            **REDESIGN / CORE**   Review Home
  Kanji flashcard          **REDESIGN / CORE**   Flashcard Practice
  Vocabulary SRS           **MERGE**             Review / Deck
  Sentence mining review   **MERGE**             From Shadowing / Recently Mined
  Kanji course/material    **KEEP**              Course / Deck Detail
  Review Mistakes          **KEEP**              Mistake Review
  Mistake detail           **REDESIGN**          Mistake Detail
  Certification mistakes   **MERGE**             Mistake Review
  Daily Review             **CORE**              Review Home

Suggested decks: - Due Today - From Shadowing - Restaurant Japanese -
Office Japanese - Travel Japanese - JLPT N3 - Kanji --- \[Material\] -
Recently Mined

**Flashcard Practice** - Deck + progress - Prompt - Reveal - Reading /
meaning - Context sentence - Audio where available -
`Again · Hard · Good · Easy` - Small `Inspect`

Gestures may supplement controls but never replace explicit accessible
controls.

### D. Analyze & Inspect

  -----------------------------------------------------------------------
  Web capability          Decision                Mobile destination
  ----------------------- ----------------------- -----------------------
  Grammar Analysis        **REDESIGN / CORE**     Analyze

  Selected Component      **MERGE**               Analyze result

  What to Notice          **KEEP**                Analyze result

  Kanji Inspect           **REDESIGN**            Quick Inspect → Full
                                                  Inspect

  Vocabulary lookup       **MERGE**               Inspect / Analyze

  Grammar inspect         **MERGE**               Analyze

  Kanji/grammar global    **DO NOT ADD**          Analyze / Companion /
  search                                          Inspect
  -----------------------------------------------------------------------

**Analyze initial state** - "What do you want to understand?" - Japanese
input - Paste - Analyze - Optional recent analyses

**Analyze result** 1. Japanese sentence 2. Selectable chunks 3.
Translation 4. How it works 5. Selected component 6. What to notice 7.
Vocabulary / kanji 8. Add to Review 9. Ask Korume about this sentence

**MOBILE-ONLY / FUTURE:** Share Japanese text from another app/browser
directly into Analyze.

### E. Companion

  Web capability                 Decision             Mobile destination
  ------------------------------ -------------------- ------------------------
  Companion Home / Storykeeper   **REDESIGN**         Companion Home
  Knowledge Assistant            **KEEP**             Companion Conversation
  Companion Welcome              **KEEP**             First Companion Entry
  Today's Reflection             **MERGE**            Companion → Reflection
  Learning Memory                **KEEP**             Memory
  Companion Diary                **KEEP**             Diary
  Growth Areas                   **KEEP**             Growth Areas
  Conversation Memory            **KEEP**             Conversation Memories
  Gentle Suggestion drawer       **REDESIGN**         Suggestion Sheet
  Weekly Journey                 **MERGE**            Memory / Journey
  Today's Small Victory          **MERGE**            Companion Home
  Still Practicing               **MERGE**            Growth Areas
  Voice Conversation             **CORE COMPANION**   Voice Conversation

**Companion Home priority** 1. Storykeeper identity 2. One current
observation 3. Ask Korume / Talk with Korume 4. Today's Reflection 5.
Learning Memory 6. Gentle Suggestion 7. Diary / Growth / Conversation
memories

Do not reproduce the desktop Companion grid.

### F. Discovery & lessons

  Web capability               Decision          Mobile destination
  ---------------------------- ----------------- ---------------------
  Explore Lessons              **KEEP**          Explore
  Lesson search                **KEEP**          Full-screen Search
  Popular Lessons              **KEEP**          Explore
  Featured Collections         **KEEP**          Explore
  Browse by Situation          **KEEP**          Explore
  Browse by Source             **DEEP**          Explore filters
  Trending / Hidden Gems       **MERGE**         Explore collections
  Quick Preview                **REDESIGN**      Preview Sheet
  Saved lessons                **KEEP**          My Lessons
  Create Lesson from YouTube   **KEEP / DEEP**   Create Lesson

Search remains **lesson/video only**.

### G. Kanji / Vocabulary / Grammar / Reading

  Web capability                   Decision           Mobile destination
  -------------------------------- ------------------ --------------------
  Kanji Library                    **KEEP / DEEP**    Learn → Kanji
  Kanji course/material selector   **KEEP**           Kanji Courses
  Kanji lesson                     **KEEP**           Kanji Lesson
  Kanji flashcards                 **MERGE / CORE**   Review
  Kanji Inspect                    **REDESIGN**       Inspect
  Vocabulary Library               **KEEP / DEEP**    Learn → Vocabulary
  Vocabulary practice              **MERGE**          Review
  Grammar Library                  **KEEP / DEEP**    Learn → Grammar
  Grammar lessons                  **KEEP**           Grammar Lesson
  Grammar Analysis                 **MOVE**           Analyze
  Reading Library                  **KEEP / DEEP**    Learn → Reading
  Reading Practice                 **KEEP**           Reading

A secondary Learn/Library entry can live under Home/Explore/More without
taking a bottom tab.

### H. JLPT / certification

  Web capability             Decision               Mobile destination
  -------------------------- ---------------------- ---------------------
  JLPT/BJT/Tokutei library   **KEEP / DEEP**        Certification
  Practice sets              **KEEP**               Practice Sets
  Ready screen               **KEEP**               Exam Ready
  Countdown                  **SYSTEM**             Exam transition
  Full Phase 1 exam          **DESKTOP-PRIORITY**   Mobile Exam Mode
  Phase break                **KEEP**               Break
  Continuous Listening       **REDESIGN**           Listening Exam Mode
  Result                     **KEEP**               Result
  Review Mistakes            **KEEP**               Mistake Review

Mobile exam rules: - readable single question/content viewport -
persistent timer - explicit answers - **Answer Navigator** sheet for all
questions - answers editable until submit - listening audio follows
continuous/non-replay exam rules - long-form exams remain
desktop-priority, not artificially blocked

### I. Roadmap / Memory / Progress

  Web capability       Decision               Mobile destination
  -------------------- ---------------------- ---------------------------
  Roadmap              **REDESIGN**           Vertical Learning Journey
  Roadmap Detail       **KEEP**               Journey Detail
  Learning Memory      **KEEP**               Companion / Profile
  Weekly Journey       **MERGE**              Learning Journey
  Growth Areas         **KEEP**               Companion
  Progress Dashboard   **REDESIGN / DEEP**    Progress
  Achievements         **DEEP**               Profile / Journey
  Streak               **KEEP, restrained**   Home / Profile

### J. Profile / Settings / Membership

  Web capability         Decision       Mobile destination
  ---------------------- -------------- --------------------
  Profile                **KEEP**       Profile
  Edit Profile           **REDESIGN**   Edit Profile
  Settings               **REDESIGN**   Settings
  Membership             **REDESIGN**   Membership
  Payment provider       **KEEP**       Membership
  Transaction History    **MERGE**      Membership
  Payment Failed         **SYSTEM**     Membership inline
  Expiring Soon          **SYSTEM**     Membership inline
  Cancellation           **SYSTEM**     Confirmation sheet
  Delete Korume Memory   **KEEP**       Privacy
  Delete all my data     **KEEP**       Privacy flow
  Delete account         **KEEP**       Privacy

Membership remains one personal screen, not a SaaS billing area.

### K. Auth & onboarding

  Web capability      Decision       Mobile destination
  ------------------- -------------- ----------------------
  Login               **REDESIGN**   Login
  Register            **REDESIGN**   Register
  Email OTP           **REDESIGN**   Verify Email
  Reset Password      **REDESIGN**   Reset Password
  QuickStart          **REDESIGN**   QuickStart
  Companion Welcome   **KEEP**       Companion onboarding

Desktop split-screen auth becomes single-column cinematic mobile auth.

### L. System states

  Capability               Decision
  ------------------------ ----------------------------
  Global loading           **SYSTEM**
  AI generation            **SYSTEM**
  Lesson loading           **SYSTEM**
  Companion thinking       **SYSTEM**
  Payment processing       **SYSTEM**
  Empty states             **SYSTEM**
  Connection error         **SYSTEM**
  Video error              **SYSTEM**
  Route error              **SYSTEM**
  Deep-link/404 fallback   **SYSTEM**
  Offline/connectivity     **MOBILE-PRIORITY SYSTEM**

------------------------------------------------------------------------

## 6. Do not promote these to primary mobile destinations

Keep these as sections, sheets, states, or deep screens:

-   Weekly Journey
-   Achievements
-   Pronunciation Library
-   Recently Added
-   Popular Lessons
-   Recommended For You
-   Growth widgets
-   Today widgets
-   Transaction History
-   Payment Failed
-   Expiring Soon
-   Cancellation Scheduled
-   Quick Preview
-   Gentle Suggestion
-   Selected Grammar Component

------------------------------------------------------------------------

## 7. Mobile-only opportunities

These are opportunities, not initial requirements.

### Share to Analyze

Share selected Japanese text from another app/browser → Analyze opens
prefilled.

### Clipboard action

Inside Analyze, offer explicit **Paste from clipboard**. Do not silently
read clipboard contents.

### Quick Review

Optional deep link/home-screen entry into due Review cards.

### Context handoff

Mined sentences preserve source lesson/video timestamps so Review can
return to official video context without re-hosting media.

------------------------------------------------------------------------

## 8. Mobile visual constitution

Mobile must remain unmistakably Korume.

-   Background `#0B0D11`
-   Deep surfaces `#11141A` / `#121419`
-   Cards `#171A20`
-   Elevated `#1B1E25`--`#20242C`
-   Warm selected `#2A1B17`
-   Orange `#FF8A3D`
-   Success `#68D59D`
-   Near-white primary text
-   Muted gray secondary text
-   Low-opacity borders
-   Major radius roughly 18--24px
-   No glassmorphism
-   No blue accent
-   No neon
-   No bright surfaces
-   No generic SaaS dashboard

### Identity rule

**Photography = content / Japanese world**\
**Orange = action / progress / focus**\
**Companion = relationship / reflection / being remembered**

Do not use the mascot as decoration everywhere.

### Typography

-   Inter --- primary UI/body
-   Plus Jakarta Sans --- navigation/secondary UI
-   Outfit --- restrained brand/section labels
-   DM Mono --- metadata/timers
-   Noto Sans JP --- Japanese

### Motion

-   soft fades
-   tiny lifts
-   smooth sheets
-   recording feedback
-   purposeful transitions
-   reduced-motion support
-   no flashy effects during repeated learning loops

------------------------------------------------------------------------

## 9. Interaction principles

1.  One primary task per viewport.
2.  Primary controls should be reachable one-handed where practical.
3.  Never require hover.
4.  Never make a gesture the only interaction.
5.  Preserve keyboard accessibility where supported.
6.  Use bottom sheets for contextual detail, not every transition.
7.  Repeated learning loops must be fast.
8.  Japanese text is the visual focus during learning.
9.  Do not interrupt Shadowing/Review with unrelated Companion prompts.
10. Context follows the learner automatically.
11. Adaptive furigana is knowledge-aware, not merely a hard global
    toggle.
12. User recordings remain private by default.

------------------------------------------------------------------------

## 10. Core cross-feature flows

### Flow A --- Shadow → Analyze → Mine → Review

`Home` → `Continue Shadowing` → `Shadowing Practice` → unfamiliar
Japanese → `Analyze` → `Analyze Result` → `Add to Review` → return to
Shadowing → later `Review` → `From Shadowing` → `Flashcard Practice`

This is the strongest candidate for Korume Mobile's signature loop.

### Flow B --- Topic Review

`Home` → `Review` → `Restaurant Japanese` → `Flashcard Practice` →
`Inspect` → `Quick Inspect` → continue Review

Inspect must not destroy the active review session.

### Flow C --- Analyze → Companion

`Analyze` → paste/type Japanese → `Analyze Result` → select chunk →
`Ask Korume about this sentence` → `Companion Conversation`

Sentence and selected component are attached automatically as context.

### Flow D --- Discover → Shadow

`Shadowing` → `Explore` → lesson → `Lesson Preview` → `Start Lesson` →
`Shadowing Practice`

### Flow E --- Mistake → personalized learning

`Review Mistakes` → `Mistake Detail` → explanation → optional related
practice

Companion memory updates automatically where supported. Never add "Save
to Companion Memory".

------------------------------------------------------------------------

## 11. First reference screens to design

Do not design the whole app at once.

1.  **Shadowing Practice** --- defines video, Japanese text, recording,
    pitch, feedback and contextual actions.
2.  **Review Home / Topic Decks** --- defines learning-library hierarchy
    and due states.
3.  **Flashcard Practice** --- defines repeated card interaction, SRS
    grading and Inspect.
4.  **Analyze** --- defines Japanese input, chunk selection, progressive
    disclosure and transitions.
5.  **Home** --- designed after the three core behaviors have a visual
    language.
6.  **Companion Home** --- defines the second emotional mode after core
    learning stabilizes.

------------------------------------------------------------------------

## 12. Suggested build/design sequence

### M1 --- Mobile foundation

Bottom nav, top bars, safe areas, typography, buttons, cards, sheets,
inputs/keyboard, states, accessibility, reduced motion.

### M2 --- Core loop

Shadowing Home, Shadowing Practice, Pronunciation Feedback, Dictation,
Summary, Review Home, Flashcard Practice, Analyze, Quick Inspect.

### M3 --- Companion

Companion Home, Conversation, Voice Conversation, Reflection, Memory,
Diary, Growth Areas.

### M4 --- Discovery & knowledge

Explore, Search, Lesson Preview, Lesson Detail,
Kanji/Vocab/Grammar/Reading libraries and material details.

### M5 --- Certification

Certification Library, Practice Set, Ready, Exam, Listening, Result,
Mistake Review.

### M6 --- Account & commercial

Profile, Edit Profile, Settings, Privacy, Membership, payment flow,
Auth, QuickStart.

### M7 --- Polish

Deep links, Share to Analyze, offline/connectivity, performance,
accessibility audit, reduced-motion audit, cross-flow context
preservation.

------------------------------------------------------------------------

## 13. Locked decisions

1.  Mobile is not compressed desktop.
2.  Shadowing is the signature mobile feature.
3.  Review/Flashcards and Analyze are first-class repeated behaviors.
4.  Bottom navigation: **Home · Shadowing · Review · Analyze ·
    Companion**.
5.  Profile/Settings/Membership live behind account navigation.
6.  Global Search is lesson/video-focused, not kanji/grammar search.
7.  Analyze is the fast structured sentence-understanding tool.
8.  Companion is conversational, personalized and memory-aware.
9.  Inspect is a universal contextual reference layer.
10. Companion memory is automatic where supported; no manual
    save-to-memory action.
11. Desktop right rails do not survive as permanent mobile rails.
12. Long-form certification exams are supported but desktop-priority.
13. Mobile prioritizes repeated learning speed over cinematic spectacle.
14. Photography = content/world; orange = action/progress; Companion =
    relationship/reflection.

------------------------------------------------------------------------

## 14. Open product questions

Validate these with prototypes/usage rather than guessing:

1.  Should Shadowing be visually emphasized as the center tab?
2.  Does Review need separate `Today` and `Decks` subviews?
3.  Should Analyze show recent analysis history on its initial state?
4.  At what complexity should Quick Inspect offer `Open full details`?
5.  Should Explore primarily live under Shadowing, or also have a
    prominent Home entry?
6.  How much Companion Memory can Home surface before becoming
    dashboard-like?
7.  Should phones promote full JLPT exams or emphasize section
    practice/review?
8.  Which deep links/mobile shortcuts deserve implementation after usage
    data exists?

------------------------------------------------------------------------

## 15. Screen admission test

Before adding any mobile screen, ask:

1.  What mobile job does it solve?
2.  Is it frequent enough to deserve a screen rather than a
    section/sheet?
3.  Which primary destination owns it?
4.  Are we preserving capability or merely copying desktop structure?
5.  Can the primary action be completed with one clear hierarchy?
6.  Does it connect naturally to the learning loop?
7.  Does it still feel unmistakably Korume?

If the answers are weak, **merge, demote, or remove it**.

------------------------------------------------------------------------

## 16. Product model

> **Korume Mobile is where learners practice real Japanese in short,
> connected loops: shadow it, understand it, remember it --- while
> Korume quietly learns alongside them.**
