# Korume — Capability Map

**Derived 2026-08-12 from `docs/product/screen-inventory.md` Part II (§6–§20), after all 57 Figma
frames were read.** This is the aggregation step between the per-frame inventory and the IA proposal.

**What this document is.** The inventory answered *"what is on each screen?"*. This answers
*"what can Korume do, and which of those things are the same thing seen from different places?"*
It is prose and tables, one-time, and it is **not** the Screen Registry — the registry holds twelve
typed fields about screen identity and nothing here belongs in it.

**Two rules inherited from the inventory and binding here:**
- **The design is authoritative for structure; its content may be wrong** (`screen-inventory.md`
  Part II amendment A). Content conflicts are listed in §20 of that file, not re-argued here.
- **The existing API is not a baseline.** Where a capability has no endpoint, that is the design being
  larger than the current backend. Nothing below is phrased as a divergence from the API.
  **Layer D — `CLAUDE.md` §2 — still binds absolutely.**

---

## 1. The finding that organises everything else

Six capabilities kept reappearing in modules that do not know about each other. **A capability sighted
in three or more independent modules is not a feature of any of them — it is a cross-cutting system.**

| Cross-cutting system | Independent sightings | Where |
|---|---|---|
| **Learning Intelligence** | **6** | shadowing recommendations carry derived reasons · lesson summary writes memory + proposes next with a reason · certification result rewrites the roadmap · Growth Areas diagnoses per skill and names lessons · the Roadmap is the write target and is generated at onboarding · sentence analysis writes back |
| **Companion presence** | **all modules** | rails, drawers, overlays, insights, and an explicit *silence window* during exams |
| **Save & collect (mining family)** | **6** | kanji inspect `Add to Review`/`Favorite` · search facet `Favorites` · lesson preview bookmark · summary vocabulary bookmark · conversation `Save Mistake` · sentence analysis `Add to Vocabulary` |
| **Pitch accent** | **4** | in-lesson pronunciation · its trend report · per-utterance conversation analysis · pronunciation studio (score **and** a whole practice track) |
| **Provenance-attached claims** | **3+** | `INSPIRED BY` · `Observed from` · per-memory source lesson · JLPT `WHY THIS ANSWER` |
| **Progress narrative** | **3** | lesson import pipeline · onboarding generation · loading-state catalogue |

**Consequence for the IA: these six must not be given nav rows.** They are not destinations. They are
systems that surface *inside* destinations. Any IA that puts "Pitch Accent" or "Memory" in the sidebar
has mistaken a cross-cutting system for a place.

---

## 2. The capability map

Twelve capability areas. Each lists what Korume can do, the frames that evidence it, and its status.
**Status vocabulary:** `built` = exists and works · `partial` = exists in a smaller form ·
`designed` = fully designed, nothing built · `implied` = the design depends on it without drawing it.

### 2.1 Lesson acquisition — getting material into the system

| Capability | Evidence | Status |
|---|---|---|
| Import a lesson from a YouTube link | `149:2`, `200:7705` | `built` |
| Import quota per plan, with an upgrade prompt | `149:2` (`2 / 3 imports remaining`), `74:564` (3/month free, unlimited paid) | `partial` (quota enforced server-side) |
| Import job progress as a staged narrative | `149:2` (6 stages, %, ETA) | `designed` |
| Import failure with a stated cause, incl. **quota exhaustion** | `149:2`, `210:14338`, `218:15740` | `designed` |
| Import from platforms beyond YouTube | `200:7705` (a Vimeo card) | ⚑ **question** |
| Creator / channel attribution on imported material | `200:7705` (`YouTube · TokyoWalk`) | `designed` |
| First-party catalogue distinct from user imports | `200:7705` (*"official Korume scenes"* vs *"the material you chose to bring with you"*) | `designed` |

> **Layer D, permanent:** video is never downloaded, re-hosted or proxied — the pipeline fetches
> captions. The staged labels are presentation (§7.0). This constraint holds no matter how the
> capability grows, and `75:1424` already explains it to learners as a product answer.

### 2.2 Lesson discovery — finding what to study

| Capability | Evidence | Status |
|---|---|---|
| Browse the whole catalogue | `200:7705` | `designed` (route is a placeholder) |
| Curated shelves banded by JLPT, paginated | `200:7705` (5 shelves × 8 lessons) | `designed` |
| Situation as a **page-level context** that re-filters every shelf | `200:7705` | `designed` |
| Two taxonomy axes kept separate: **situation** and **source** | `200:7705` | `built` (schema + API) |
| A third axis: **series / collection** | `200:7705` (`TOKYO TABLE`, `SCENE NOTES`) | `partial` (`collections` exists) |
| Faceted search over title · topic · grammar · vocabulary · **creator** · JLPT · situation · **tag** | `200:7705`, `212:14753` | `designed` |
| A global **⌘K command palette**, scoped to lessons | `212:14610`, `212:14753` | `designed` |
| Lesson preview before committing | `200:10726`, `180:1129` | `designed` |
| Featured / popular / recently-added / resume surfaces | `149:2`, `200:7705` | `partial` |

> **A boundary the design states and the IA should keep:** *"Search is here only to help you find a
> lesson immediately"* — open-ended questions route to the Companion. **Search finds what you want to
> learn; the Companion answers what you don't know.**

### 2.3 The lesson workspace — four Learning Modes

Settled by `docs/design/screens/screen-shadowing-practice.md` and confirmed by the user: **four modes,
not eight** (§9.0).

| Mode | Capability | Status |
|---|---|---|
| **Shadowing** | continuous playback, transcript-first, per-word furigana, in-lesson transcript search, A–B sentence loop, speed control | `built` (search + adaptive furigana partial) |
| **Pronunciation** | per-sentence exercise, record, score, coaching line, replay a clip cut from transcript timings, sentence navigator | `partial` (engine exists, screen does not) |
| **Listening Practice** | typed dictation (**the mode**) with a word-bank **hint** layer; sub-modes fill-in-the-blank and translation | `partial` (typed dictation built; hints and both sub-modes designed) |
| **Summary** | AI-curated end-of-lesson: worth-keeping vocabulary, native nuance, grammar with `From lesson` + `Try it`, cultural notes, review list | `designed` (endpoint exists, nothing renders it) |

Plus **Analysis** — a per-sentence utility inside a lesson, *and* a standalone destination (§17.1).

### 2.4 Certification practice — three exam families

✅ **Ruled: `Certification Practice` is the module; `JLPT` · `BJT` · `Tokutei Ginou` are exam families.**
The repo implements one.

| Capability | Evidence | Status |
|---|---|---|
| Full-length timed mock exams | `232:2`, `234:618` | `partial` |
| Multi-phase exam flow with a break and phase locking | `234:618`, `234:1639`, `234:1667` | `designed` |
| Mondai-level grouping beneath the section | `237:1690`, `240:12992` | `designed` |
| Per-question flagging + an **OMR-style answer sheet** | `237:1690`, `240:12992` | `designed` |
| Autosave and resume-from-question | `234:618`, `237:1690` | `designed` |
| Exam-accurate listening constraints (no pause, no restart) | `240:12992` | `designed` |
| Passing line, pass/fail, per-section scores | `242:14234` | `partial` (`section_scores` exists) |
| **Answer-revision telemetry** and the insight family built on it | `242:14234` + `screen-inventory.md` §10.9 | `designed` (7 variants + 2 honesty guards) |
| Per-question mistake review: why-this-answer · vocabulary · **generated mini practice** | `243:14899`, `243:15364` | `designed` |
| Result **routes out** into Shadowing / Grammar / Conversation with a reason each | `242:14234` | `designed` |

> **Layer D:** the Companion is **silent between `Begin Phase 1` and submission** — present in lobby,
> pre-flight, result and review. The frames state this three times and are more precise than the doc.

### 2.5 Speaking & pronunciation

| Capability | Evidence | Status |
|---|---|---|
| Voice-first conversation with chat as an explicit fallback | `44:7289` | `partial` |
| Role assignment (learner role + AI role) and a per-session goal | `44:7289`, `46:2` | `designed` |
| Turn budgeting | `44:7289`, `180:1129` | `designed` |
| Per-utterance analysis: pronunciation · fluency · **pitch accent** · naturalness, with a `Try:` rewrite | `44:7289` | `designed` |
| `Listen Native` / `Listen Yours` comparison | `44:7289`, `36:4117` | `designed` |
| **AI-generated scenarios from a free-text description** | `170:9364`, `46:2` | `designed` |
| An 8-dimension scenario generator + a 6-dial traits model | `46:2`, `180:1129` | `designed` |
| Pre-session briefing: characters · useful expressions · sample exchange | `180:1129` | `designed` |
| **User-generated scenarios shared with attribution** | `170:9364` | `designed` |
| Pronunciation courses / learning paths / practice by situation / practice by skill goal | `37:4955` | `designed` |
| Per-sentence practice with reference-vs-user waveforms | `36:4117` | `designed` |
| **Word-level scoring** and **expected-vs-actual pitch contours** | `36:4117` | `designed` |

> **Layer D:** the reference voice is **TTS of the sentence text**, never audio extracted from source
> media.

### 2.6 Kanji · vocabulary · grammar

| Capability | Evidence | Status |
|---|---|---|
| Kanji **discovery** surface: featured collection, curated paths, browse by JLPT, **browse by radical**, recently viewed | `29:2890` | `designed` ⚑ (both-surfaces question open) |
| Kanji **curriculum** surface: level → path → study material → ordered lessons | `280:3` | `designed` |
| Kanji SRS review with a deck | `280:1314` | `built` |
| Kanji deep-inspect: strokes · composition · mnemonic · common words · example sentences with sources · **appears-in-lessons index** | `28:2041` | `partial` |
| Explicit **save / add-to-review** on a kanji | `28:2041` | `designed` |
| **Sentence analysis**: role-labelled structure, token POS, key grammar with its form, key vocabulary, *what to notice* | `284:1464` | `designed` |
| Grammar point catalogue | repo `/grammar` | `built` |
| Companion-owned **vocabulary shelf with a Confidence model** distinct from SRS | `156:1310` | `designed` |

> **New domain nouns the design introduces:** *learning path · course · kanji lesson · study material*
> (kanji), and *curated kanji collection*. These need naming decisions before anything is built.

### 2.7 ⭐ Learning Intelligence — the system, not a feature

The single most-evidenced capability in the inventory. Six modules feed it and it writes to two places.

```
lesson results · SRS state · mistakes · answer revisions · recordings · conversation turns · analysis
        ↓
                        LEARNING INTELLIGENCE
        ↓                                        ↓
  "what next" + a derived REASON          learner model (strengths · weaknesses · confidence)
        ↓                                        ↓
  recommendations, everywhere              Roadmap adjustment  →  Companion explanation
```

| Capability | Evidence | Status |
|---|---|---|
| Every recommendation carries a **derived reason**, not a template | `149:2`, `200:7705`, `242:14234`, `181:3525`, `64:2061` | `designed` |
| A **reason taxonomy** made visible | `181:3525` (`Recently struggled` · `Matches your pace` · `From Companion memory` · `Getting better`) | `designed` |
| Per-skill proficiency model | `187:6556`, `64:2061`, `111:515` | ⚑ **three conflicting taxonomies** |
| Weakness → a **next gentle step** naming specific lessons | `187:6556`, `180:2` | `designed` |
| Behavioural insight from **how** the learner works, not just results | §10.9 revision insights; `242:14234` | `designed` |
| Roadmap write-back after a result | `243:14899` (`UPCOMING ADJUSTMENTS`), `243:15364` | `designed` |
| Longitudinal trends (pitch accent, accuracy, confidence) | `120:2027`, `37:4955`, `36:4117` | `designed` |
| **Two honesty guards** — minimum sample; never infer psychology | §10.9, `screen-inventory.md` §12.0 | **rule** |

### 2.8 The Roadmap — a mission system, and the write target

| Capability | Evidence | Status |
|---|---|---|
| **Generated at onboarding** from the learner's answers | `111:1556`, `111:1877` | `designed` |
| Spatial **journey map** with named destinations, `YOU ARE HERE`, locking | `64:2061` | `designed` |
| Chapters → missions | `64:2061`, `180:2` | `designed` |
| Missions with **measurable completion gates** | `180:2` (`Reach 80 pronunciation score 68/80`) | `designed` |
| **Unlocks**: lessons · content packs · roadmap levels · next mission | `180:2` | `designed` |
| Skills a mission builds | `180:2` | `designed` |
| Companion-authored **rationale per mission** | `180:2` | `designed` |
| List view vs map view of the same plan | `64:2061` | `designed` |
| **Continuously rewritten** by §2.7 | `243:14899` | `designed` |

### 2.9 The Companion — one system, four manifestations

**Never a section of the app; a layer above it.** `Application → Companion → Current Screen`.

| Manifestation | Meaning | Frames |
|---|---|---|
| **Screen** | a destination where the Companion is the subject | home · diary · knowledge assistant · learning memory · conversation memories · growth areas |
| **Panel** | a region inside another screen | every rail card across shadowing, JLPT, explore, roadmap, profile |
| **Interaction** | a transient presence event | reflection overlay · gentle-suggestion drawer |
| **Generated content** | a persisting artifact with its own retrieval | diary letters · memories · suggestions · insights · reflections |

| Capability | Evidence | Status |
|---|---|---|
| Presence levels `Hidden · Ambient · Observe · Listening · Address · Silent` | `companion-patterns.md`; `156:1310` renders one **as copy** | `built` (`lib/companion/presence/**`) |
| Companion identity: name, tenure, voice | `156:1310`, `180:1129` | ⚑ **three names; nothing persisted** |
| **Declinable** introduction (`Skip`, `Maybe later`) ⇒ every surface needs a companion-less fallback | `220:16766` | **rule** |
| Dated learning memories, searchable / filterable / **pinnable**, linked to source lessons | `180:1770` | `partial` |
| **Diary letters** with mood, favourites, search, time navigation | `190:7376` | `partial` |
| Conversation memories: **replayable, re-practisable, counted**, with a growth timeline | `184:3974` | `designed` |
| Knowledge assistant grounded in the learner's own lessons, with **per-entity exposure counts** and a **correction mode** | `215:15164` | `partial` |
| **L1-aware** reflection (*"without thinking in Vietnamese"*) | `184:3974` | ⚑ **no L1 field exists** |
| Companion **silence window** inside active acquisition loops | `234:618`, `242:14234` | **rule** |

### 2.10 Identity, settings and data rights

| Capability | Evidence | Status |
|---|---|---|
| Sign-in (Google confirmed; **Apple + GitHub are a scope question**) | `65:2` | `partial` |
| Learner profile: country · timezone · **native language** · target JLPT · study time · daily goal · **written personal goal** | `66:166`, `67:595` | `partial` |
| Learning-journey milestone timeline | `66:166` | `designed` |
| Live-preview profile editing | `67:595` | `designed` |
| **Profile & journal visibility with a `Friends` tier** | `67:595` | ⚑ **implies a social graph that does not exist** |
| Learning settings: schedule · review frequency · difficulty preference | `220:16032` | `designed` |
| Appearance: theme · accent · display scale · **reduced motion** | `220:16032` | ⚑ (theme/accent conflict with the dark-only token system) |
| Permissions: microphone · **camera** | `220:16032` | ⚑ (camera has no known use) |
| **AI-training consent**, off by default | `220:16032` | `designed` — **layer D** |
| **Data export** and learning-history download | `220:16032`, `74:564` (free tier) | `designed` |
| **Two-tier deletion**: erase companion memory *(progress remains)* vs delete account | `220:16032` | `designed` — **layer D** |

### 2.11 Business model

| Capability | Evidence | Status |
|---|---|---|
| Free tier that is genuinely usable, incl. **adaptive furigana** and data export | `74:564` | — |
| Paid tier = **intelligence**, not content ownership (*"We don't sell AI"*, *"Premium unlocks intelligence, not ownership"*) | `74:564`, `75:1424` | — |
| Three billing shapes: monthly · annual · **Founding Member with a permanent price lock** | `74:564`, `209:14032` | `designed` |
| **No free trial** | `74:564`, `209:14032` | ✅ matches the decision |
| **PayOS** as the payment method | ✅ user ruling 2026-08-12 | `designed` (frame content to be corrected) |
| Quota-driven failure as a **visible product state** | `149:2`, `218:15740` (`05 / ACCESS`) | `designed` |
| **Knowledge Economy** — generated explanations become reusable knowledge | `75:1424` | `designed` |

### 2.12 System-wide surfaces

| Capability | Evidence | Status |
|---|---|---|
| **Loading state vocabulary** — 8 patterns + a copy rule (*never technical, never urgent, always companion-led*) | `210:14338` | style-guide, **not a screen** |
| **Error state vocabulary** — 8 patterns + a copy rule (*never blaming, never alarming*) | `218:15740` | style-guide, **not a screen** |
| Honest AI-unavailable degrade | `218:15740` `02 / COMPANION` | `built` (503 paths) |
| Paywall as a gentle state | `218:15740` `05 / ACCESS` | `designed` |
| Footer, marketing pages (Blog · About · Careers · Contact), newsletter | `203:13813` | `designed` / **no frames** |
| **Landing / gateway page** | — | ✅ **known gap, user will design it later** |

---

## 3. What blocks the IA step

Four questions must be answered before an information architecture can be honest. They are not
build-order questions; each one changes what the *nouns* of the product are.

| # | Question | Why it blocks IA |
|---|---|---|
| **1** | **Is `AI Sensei` the Companion, or a second entity?** | decides whether the IA has one intelligent presence or two, and whether `/sensei` is a Companion mode or its own destination |
| **2** | **One canonical skill taxonomy** — three different sets exist across `64:2061`, `187:6556`, `111:515` | six surfaces claim to measure "how good are you at X"; without one list they cannot agree, and `Practice by Goal` cannot be named |
| **3** | **`Journey` names two things** — nav maps it to the Diary, the design means the Roadmap | a nav label cannot point at the wrong concept |
| **4** | **Does Korume ship both kanji surfaces** — discovery *and* curriculum? | decides whether Kanji is one destination or two |

**Everything else is scope, not structure**, and can be answered after the IA: Vimeo import ·
`JLPT Speaking` as a cross-module edge · `AI Coach` flag vs tier · Apple/GitHub sign-in · native mobile
apps · theme & accent · camera permission · the social graph · the L1 field.

---

## 4. What the IA proposal will be built from

Recorded here so the next step is reproducible rather than improvised:

1. **Destinations** come only from frames classified `screen` — never from a cross-cutting system (§1)
   and never from a style-guide catalogue (§2.12).
2. **Panels, interactions and generated content never earn a nav row.**
3. **Overlays are presentation** — a modal or drawer becomes a component, and gets a route only where
   the URL must be shareable or state-recoverable, justified in writing per screen.
4. **Grouping follows capability areas (§2), not the current sidebar.** Both existing navbars are demos
   and neither is evidence.
5. **The four §3 questions are answered first**, or the affected areas are proposed with their
   alternatives shown rather than silently resolved.

> **Checkpoint, required by the user:** the IA is *proposed*, then **stops for human review**, and is
> only locked afterwards. Screen Registry Phase 1 begins after the lock — not before.
