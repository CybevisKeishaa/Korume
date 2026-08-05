# JapanWeb+ — Business Model & Monetization Strategy

> **Status:** Approved brainstorm → feeds **Layer 8 (Monetization & Polish)**.
> **Scope:** Long-term product manifesto — mission, North Star, moat, competitive & positioning
> strategy, and decision framework — plus the operational model: Free/Premium split, AI knowledge
> economy, cost architecture, pricing, and conversion. Named `business-model` (not `monetization`)
> so it can grow to cover referrals, B2B, teacher plans, and marketplace without restructuring.
> **Related:** root `CLAUDE.md` §2 (non-negotiables), main spec §3.12 (Free/Premium — the Stripe
> part is superseded here), `docs/features/` (F-001..F-016), Serena memory `monetization_brainstorm`,
> `docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §3 (Monetization
> model — §3.4 rewrites Principle 3 below and adds library-breadth/lesson-creation rows to the §2
> table; §1-§2 define the Lesson domain model and Create Lesson pipeline these edits assume).

---

## Mission — why we exist

> **JapanWeb exists to help Vietnamese learners acquire Japanese naturally through real content —
> and to make every learner's progress improve the platform for everyone who comes after.**

Beyond profit: we turn the act of learning into a shared, compounding resource, so each person's
study makes the next person's easier, richer, and cheaper. *(Mission = why we exist; North Star =
where that takes us.)*

## North Star

> **Become the definitive way Vietnamese learners reach Japanese fluency through real content —
> a platform whose shared knowledge base compounds with every learner, so studying gets richer,
> faster, and cheaper the more the community grows.**

This is the direction for every product decision, beyond monetization: *does it help a Vietnamese
learner reach fluency on real content, and does it make the shared knowledge base compound?* If a
proposal does neither, reconsider it.

## Flywheel

The core engine — why the platform gets **more valuable AND more cost-efficient** as it grows:

```
        ┌──────────────►  Learners  ──────────────┐
        │                                          │
        │                                          ▼
 Better Learning                                 Study
   Experience                                      │
        ▲                                          ▼
        │                                  Generate Knowledge
        │                                   (cache miss →
        │                                    cached forever)
        │                                          │
        └────────  Knowledge Base Grows  ◄─────────┘
```

More learners → more study → more Serve/Generate-Knowledge → the shared base grows → cache-hit rate ↑,
marginal AI cost ↓, answers richer & faster → better experience → more learners. Every turn lowers cost
and raises value **at the same time** (mechanics in §4; measured by the Knowledge Reuse Ratio in §7).

## Non-goals

What JapanWeb explicitly does **not** try to become — a guardrail against scope creep:

- **Not a general-purpose AI chatbot.** AI always serves Japanese learning tied to the knowledge base,
  never open-ended Q&A (reinforces design principle 6: Serve/Generate-Knowledge only).
- **Not a social network.** No feed / follower / social-graph core loop. Any community feature stays in
  service of learning, never becomes the product.
- **Not a YouTube replacement or video host.** We never store, re-host, or proxy video (`CLAUDE.md` §2);
  YouTube stays the player, we add the learning layer on top.
- **Not an international product — yet.** Vietnam-first; no international GTM until traction justifies it.

## Product moat — why this gets hard to copy

**The moat is not the AI.** Models are a commodity any competitor can buy. The moat is the
compounding *combination* of four things that only exist after time in the market:

- **Personal learning history** accumulated over months per learner (weaknesses, progress, mistakes) —
  cannot be back-filled.
- **A continuously growing shared knowledge base** — every cache-miss generation enriches it permanently
  (§4); years of it can't be re-created on day one.
- **AI that understands both the learner AND the platform's accumulated knowledge** — the *intersection*,
  not the model.
- **Cost efficiency that compounds** — a late competitor pays full generation cost from zero while we
  serve mostly from cache.

Competitors can copy features in a week. They cannot copy years of accumulated learner history and shared
knowledge. **The moat widens with time, not with spend.**

## Competitive strategy — how we compete

JapanWeb does **not** compete on: more AI models · more API requests · more tokens.

It competes on: **personalization · knowledge accumulation · learning from real content · long-term
learner memory.** Any rival can call the same APIs; none can instantly replicate a system that has been
learning *with its users* for years. **The advantage is the learning system, not the AI model.**

## Positioning — JapanWeb+ is a learning system, not "an AI"

Users are not paying for AI. They are paying for an **Intelligent Learning System**, of which AI Sensei
is only one component:

> AI Sensei · Deep Breakdown · Personalized Roadmap · Weekly Coach · Pronunciation Analysis ·
> Long-term Memory · Study Replay · Weakness Tracking.

This positioning keeps the product **independent of whichever model powers it** (Claude, GPT, Gemini…)
and builds equity in the **JapanWeb brand**, not the model vendor. The Free/Premium split in §2 is the
boundary of this *system*, not a menu of AI features.

## Product decision framework — the scope-creep guardrail

Before building ANY new feature, ask:

1. Does it improve learning?
2. Does it increase the value of the shared knowledge base?
3. Can it become cheaper as the community grows?
4. Does it strengthen the personal learning experience?

If most answers are **"No,"** the feature probably doesn't belong in JapanWeb. (This is the operational
form of design principle 6 and the Non-goals guardrail.)

---

## 0. Locked context (decided before this doc)

- **Market:** Vietnam learners only (no international GTM yet).
- **Payment:** **PayOS**. Stripe is ruled out — not officially usable in VN to receive from VN payers.
- **Go-to-market:** **free-first** — launch fully free, gather users + feedback, attach premium
  after traction ("mạnh dần đều").
- **Direct competitor:** corodomo.com gives shadowing/dictation/pronunciation free in Vietnamese.
  → the **core loop is table stakes**; we cannot charge for it. Premium must be the *depth* layer
  a free-only app can't sustain.

---

## 1. Product philosophy — six design principles

These are the decision filter for every future feature and every pricing change.

1. **Don't sell API requests — sell a personal learning experience.**
   Users unlock *a personal Sensei that knows them*, never "more AI" or "more tokens." Internal
   quotas (Azure, conversation) are implementation details to protect margin, never the pitch.

2. **Users own their learning data forever. Premium unlocks *intelligence over* the data — not the data itself.**
   Notes, transcripts, flashcards, vocabulary, recordings → always exportable, free. We lock the
   *value the system creates from* the data, never the data. (Reinforces `CLAUDE.md` §2 + the GDPR
   "delete-all-my-data" obligation → a legal duty becomes a trust-selling point.)

3. **Never lock the core learning experience. Once a learner has access to a lesson, the complete
   learning loop (Reading → Shadowing → Pronunciation → Dictation → Mining → Review) is always
   available without feature restrictions. Premium expands the library and the ability to create
   new lessons, rather than fragmenting the learning experience.**

   **What is/isn't the core loop** (`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §3.4 — read this precisely, "never lock the core loop" is easy to misread as
   "the entire library is free," which is the opposite of what it means):

   ```
   Core loop (free & unlimited, once a lesson is open):
     Create Lesson → Open Lesson → Shadowing → Pronunciation → Dictation → Mining → Review

   NOT the core loop (this is what Plus expands):
     Entire Library (breadth of which lessons can be opened)
     Unlimited Create Lesson (Free is capped at 3/month)
     AI Transcript Generation
   ```

4. **Premium should be discovered, not advertised.**
   The best upgrade prompt is not a pricing page — it's the moment a learner genuinely wants to
   understand something more deeply and sees the answer already waiting inside JapanWeb+. Contextual,
   at peak intent, show-don't-tell.

5. **AI generates knowledge once, then serves it many times.**
   The platform should get *smarter and cheaper* as the community grows, not more expensive. AI spend
   is an **investment into a growing knowledge base**, not a recurring operating cost.

6. **Every AI request must increase the long-term value of the platform.**
   Every AI call falls into exactly one of two categories — there is no valid third:
   - **Serve Knowledge** — deliver existing (cached) knowledge to the user.
   - **Generate Knowledge** — create reusable knowledge that becomes part of the shared base.

   No AI request may consume tokens without creating lasting value. This is a **feature-review gate**:
   if a proposed feature neither helps the current learner nor enriches the platform, question why it exists.

> **Korume does not sell lesson quality. It sells library breadth and the ability to
> create new lessons.** (`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md`
> §0.3) Once a learner can open a lesson, Free and Plus get the identical learning experience inside
> it — full transcript, every Learning Mode, every Reading Setting. The difference is how many
> lessons a learner can open, and whether they can mint new ones from their own YouTube links.

### 1.1 Gamification & notification principles (G1–G3)

Adopted at Layer 6 (2026-07-13). Same status as the six principles above: a decision filter,
not a guideline. Any gamification or notification feature that fails these does not ship.

- **G1 — Gamification reinforces learning; it never replaces it.**
  Every XP point, badge, streak, or level must correspond to meaningful learning progress —
  never to engagement tricks or repetitive UI actions. Concretely: **XP is awarded for
  completed learning outcomes, not app activity.** A graded SRS review, a scored dictation,
  a saved shadowing session, a submitted JLPT test or reading quiz earn XP; opening the app,
  clicking around, or re-grinding the same item the same day do not.

- **G2 — Self-improvement before social comparison.**
  The product helps learners compare themselves with their *past selves* first (XP, streaks,
  analytics, study replay). Social comparison (leaderboards, friend rankings) only appears once
  a genuine social layer exists — this is why leaderboards live in Layer 7 (Community), as a
  product decision, not a scheduling one.
  *As shipped in Layer 7 (2026-07-14):* the leaderboard is weekly, global, and **opt-in**, and
  the `/leaderboard` page leads with the user's own week before the community ranking. The
  **friends leaderboard is intentionally deferred until a real social graph exists** — a follow
  system drags in profiles, privacy, moderation, and notifications, which is a product decision
  in its own right, not a leaderboard feature.

- **G3 — Notifications support learning, not attention.**
  A notification exists to help the learner continue meaningful progress (SRS due, badge
  earned, weekly report ready, new Sensei insight) — never to manufacture FOMO or farm
  engagement. If a notification's primary job is to make someone open the app rather than
  learn something, it does not ship.

---

## 2. Free vs Premium

**Rule:** the split is *value-based*, not *feature-based*. We keep whole workflows intact for Free
and monetize depth, personalization, and live AI.

| Capability | Free | JapanWeb+ |
|---|---|---|
| Core loop, once a lesson is open: Reading → Shadowing → Pronunciation → Dictation → Mining → Review | ✅ unlimited | — |
| Own-voice pitch contour (client-side F0/YIN, $0) | ✅ unlimited | — |
| Kanji / Vocab / Grammar / Adaptive Furigana | ✅ | — |
| Progress / immersion dashboards, comprehension & difficulty timelines, weakness **tracking** — all *computed from your own data* | ✅ | — |
| Public library breadth (which lessons can be opened) | subset (`FREE`-tier lessons only) | entire library (`FREE` + `PLUS`) |
| Personal lesson creation (Create Lesson, `docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §2) | 3/month | unlimited |
| AI Transcript Generation (no-caption fallback) | — | ✅ |
| JLPT | practice by individual section | **full mock exams** + detailed analysis |
| AI explanations | **Lite** (cached) + **preview** (~15–20% teaser) of deep sections | **full cascade deep** |
| Knowledge Generation (new/cache-miss sentences) | small quota (~2–3/day) | large / priority quota |
| Export data (transcript, notes, flashcards, vocabulary) | ✅ | — |
| AI Sensei (memory, coaching, weekly reports, personalized plan) | — | ✅ |
| Azure pronunciation scoring (accuracy/fluency/completeness + native overlay + per-word) | — | ✅ (generous internal quota) |
| Conversation partner (STT→Claude→TTS) | — | ✅ (generous monthly quota, not unlimited) |
| AI-**authored** intelligence over your data: weekly report, study plan, weakness explanation/coaching, WOW Study Replay narrative | — | ✅ |

**Never behind the paywall:** the core learning experience, ownership/export of the user's own data,
and the free unlimited own-voice pitch contour.

**The dividing line is not "basic vs advanced."** It is **computed-from-your-data (free — even when
advanced) vs AI-authored-over-your-data (premium)** — the operational form of principle 2. A $0 chart
of the learner's own history is *never* gated.

### 2.1 Where the feature registry (F-001..F-016) lands

`docs/features/` was authored *after* Layers 3–4 shipped, so it is mapped onto this split here (full
rationale = principle 2 above; status accuracy lives in `docs/features/README.md`):

- **Free — computed from the user's own data ($0 or cached):** F-001 Active Listening · F-002
  Unknown-Word Heatmap · F-003 Learning Journey · F-004 Difficulty Timeline · F-005 Learn Before Watching ·
  F-006 Shadowing Replay Timeline · F-009 Shadowing Challenge · F-010 Review by Context · F-011 Progress on
  Real Content · F-012 Smart Review Queue · F-014 Multi-video Mining · F-015 Immersion Dashboard
  *(stats/charts)* · F-007 weakness **tracking**.
- **Premium — AI-authored intelligence layered on top:** the AI narrative inside F-003 / F-015 (weekly
  report) · F-007 weakness **explanation + drills** · F-016 Goal-based Learning Paths (the *Personalized
  Roadmap* component) · deep cascade on any transcript line · Azure scoring inside F-006 / F-013 · conversation.
- **Knowledge-base content (cached → free to read; generation metered, §4):** F-008 Vocabulary Network
  relations · F-013 Accent Dictionary pitch patterns · cascade sections.

Two non-negotiables these features must keep (`CLAUDE.md` §2, already enforced in L3/L4): pitch reference =
TTS-of-text / curated data, **never** extracted YouTube audio (F-006, F-013); sentence mining stores **no
media** — text + `{video_id, start, end}` only (F-010).

---

## 3. Value ladder — three tiers of time

Premium proves itself on three different timelines. Each has a distinct job.

- **① Immediate value (day 1) — acquisition trigger.** The **cascade**: tap a sentence → full Lite
  explanation, then a visible list of deep sections (Grammar Breakdown / Culture Notes / Common
  Mistakes / Alternative Expressions / Native Nuance / More Examples / Quiz / Conversation). Tangible,
  needs no history, cacheable ~$0. *This is what makes someone want to buy.*

- **② Personal value (after days) — conversion trigger.** Once enough data exists, the AI starts
  reflecting the learner back to them ("you keep confusing 〜ように & passive; you're forgetting 18
  words; you mispronounce つ / ん"). Premium stops being a feature and becomes *"the AI understands me."*

- **③ Long-term value (after months) — renewal moat.** **AI Sensei memory** over the whole learning
  history: every weakness, every gain, the full timeline. No newcomer app can replicate accumulated
  personal history. *This is what keeps the subscription.*

### 3.1 The WOW Moment (tier ③)

One low-token, high-emotion feature that makes the platform feel *alive*:

- **AI Study Replay (retrospective)** — computed from stored data, **$0 marginal, always honest**:
  "3 months ago you knew 120 words → today 642 · Listening +38% · Speaking +22% · Grammar +31%."
  A tiny summarization call adds the emotional line ("faster than 84% *compared to your past self*").
- **Trajectory projection (forward)** — "at your current pace you'll reach N4 in ~83 days." **Must be
  framed as an estimate with visible assumptions** ("if you keep ~4 videos/week…"), never a promise.
  Honesty rule (per `CLAUDE.md`): compare to the user's *own* past, never fabricate cross-user cohorts.

---

## 4. The Knowledge Economy — AI cost architecture

**Design principle:** AI generates knowledge once, serves it many times. Cost per user *falls* as the
platform grows. This is the same proven Layer-4 pattern (`video_summaries` / `vocab_examples`: DB-cached,
service-role write, `source='ai_generated'`, SELECT-only for `authenticated`) generalized into a
**sentence-keyed shared knowledge base**.

### 4.1 How it works

- **Cache by normalized sentence fingerprint, not by video ID** — identical sentences across different
  videos reuse the same knowledge.
- **The base is not only sentences.** Sentence-level entries (cascade sections) sit beside word-level
  entries — `vocab_examples`, F-013 pitch patterns, F-008 relations — each keyed by its own fingerprint
  (sentence text, or headword+reading). "Sentence-keyed" is the primary case, not the only one.
- **Cache each section independently** (grammar, culture, examples, quiz, conversation…) rather than one
  large blob — generate only the minimum section needed.
- **Serve Knowledge (cached reads)** = effectively $0, unlimited for everyone including Free (previews).
- **Cache miss** (typically a user-imported video): generate the minimum section, consume one unit of the
  user's daily **Knowledge Generation** quota, then **permanently cache it for everyone**.
- **Premium** removes/greatly expands the Knowledge Generation quota and unlocks the remaining deep
  sections immediately.
- Every cache miss **permanently enriches** the shared base → as usage grows, cache-hit rate rises,
  latency drops, and marginal AI cost per user trends toward zero for common content.

> **Reframe that resolves the "user đốt token" fear:** the quota is on *creating new* knowledge, never on
> *reading* it. Free users get unlimited AI over the (growing) cached base; only the frontier is metered.
> This *is* cost-defense layer #2, reframed so it never feels like a penalty.

### 4.2 Three-layer cost defense

1. **Global daily budget kill-switch** (build FIRST). Cap total AI spend/day; on hit, all AI endpoints
   return the existing graceful 503. Hard ceiling → cannot be bankrupted.
2. **Per-user Knowledge Generation quota** (Free ~2–3 new sentences/day; Premium large/priority).
3. **Free tier built on $0-marginal features** (whole core loop + cached reads + client-side pitch).

### 4.3 Model tiering (deliberate change to the Layer-4 "default = Opus" decision)

- **Haiku** for high-volume cacheable generation: Lite explanations, cascade sections, examples, summaries.
- **Opus** reserved for live **conversation**.
- Revisit as real cost data arrives.

### 4.4 Implementation gotchas (must be honored in Layer 8)

1. **Fingerprint safety is per-section.** Grammar / examples / quiz / alternative-expressions depend on
   the sentence itself → fingerprint-keyed, shareable across videos. **Culture Notes / nuance can be
   context-sensitive** → mark those sections so they are not blindly shared. Normalization must not merge
   sentences that differ only by a meaning-changing particle (は vs が).
2. **Quality gate for shared AI knowledge.** One user's cache-miss generation becomes everyone's permanent
   knowledge → a hallucination propagates permanently. Require a `verified` flag, a user "report error"
   path, and visible AI-content labeling (`source='ai_generated'`, per `CLAUDE.md` §2/§3). This absorbs the
   deferred Layer-7 "human-review/publish gate for AI content."
3. **Distinguish 🔒 premium-locked vs ⏳ not-yet-generated.** For a cache-miss sentence, other sections are
   empty because *no one has generated them*, not because of the paywall. Premium unlock triggers generation.
   UI/loading states must separate the two.

---

## 5. Conversion — Contextual Discovery (replaces the 7-day trial)

The traditional countdown trial is removed. Because Free already delivers a complete learning experience,
there is nothing to "trial" — instead Premium is **discovered naturally at the moment of peak intent**.

Mechanics (show-don't-tell, at max engagement, one tap away):

1. **In-context section list.** Under each sentence: full Lite explanation, then
   `✅ Grammar Breakdown · 🔒 Culture Notes · 🔒 Alternative Expressions · 🔒 Native Nuance · 🔒 More
   Examples · 🔒 Conversation Practice`. The learner sees exactly what they're missing.
2. **Metered preview (~15–20%).** Locked sections are not blank — they show a teaser ("Đây là mẫu 〜てしまう…
   🔒 Unlock 6 more sections"). The learner *tastes the quality*, then converts out of curiosity. (Serve the
   preview from the same cached generation that premium reads in full.)
3. **First-hit-free / small daily taste.** A very small Knowledge Generation quota lets a Free user generate
   *one complete deep breakdown* occasionally — experiencing real Premium quality before deciding.
4. **Loss-aversion on the user's OWN effort** (strongest trigger): "12 câu của bạn đang chờ breakdown sâu 🔒",
   "17 lỗi phát âm chưa được sửa", "8 từ AI muốn bạn ôn lại."
5. **One free sample weekly report** — make AI Sensei's intelligence tangible exactly once.
6. **Free-vs-Premium shown on the SAME real sentence**, never a generic feature-bullet pricing page.

---

## 6. Pricing

Single tier at launch. Simplicity over day-one revenue; do not optimize for hypothetical power users
before real usage data exists. Keep the architecture flexible so a **second tier is introduced only if
data shows Azure/Conversation costs justify it** (those are the only genuinely unbounded-cost features).

| Plan | Price | Notes |
|---|---|---|
| **JapanWeb+ Monthly** | **49.000đ / month** | psychological anchor under 50k |
| **JapanWeb+ Annual** | **490.000đ / year** | ≈ 2 months free; prepay improves cash flow + retention |
| **Founding Member** | **39.000đ / month**, price-locked while the subscription stays active | rewards early adopters; if standard price later rises to 59–69k, founders keep 39k |

**No "lifetime" plan.** The product carries real per-active-user AI cost (Azure, conversation); a one-time
lifetime buyer using those forever = permanently negative margin. Founding Member is a **locked recurring
price**, not a one-time purchase.

**No traditional trial** — replaced by Contextual Discovery (§5).

---

## 7. Success metrics (how we know it's working)

**North-star health metric — Knowledge Reuse Ratio:**

```
Knowledge Reuse Ratio = cached_reads / new_generations
```

As this ratio climbs, the Knowledge Economy is compounding: higher reuse → lower marginal AI cost →
faster responses → more valuable shared knowledge.

Supporting KPIs:

| KPI | What it tells us |
|---|---|
| Knowledge generated / day | growth rate of the shared base + generation-cost driver |
| AI cost per active user | must trend **down** over time |
| Average AI cost per premium subscriber | margin safety on the unbounded-cost features |
| Premium conversion rate | is Contextual Discovery working (§5) |
| Premium renewal rate | is the long-term moat real (§3 tier ③) |
| Weekly active learners | top-of-funnel + free-tier stickiness |
| Average learning streak | habit formation (the free-first bet) |

> **Scope note:** pure AI *operational* metrics — latency, raw cache-hit rate, hallucination rate,
> error/degradation rate — live in a separate **architecture/operations** document, not here. This
> section tracks only business & unit-economics health. The Knowledge Reuse Ratio above is the one
> economy metric kept here because it is the business north-star, not an ops gauge.

---

## 8. Open follow-ups (into Layer 8 planning)

- Confirm exact Knowledge Generation quota numbers (free/day, premium/month) once cost data exists.
- Confirm Azure pronunciation + conversation internal monthly quotas (margin-protecting, invisible).
- Decide the `verified` quality-gate workflow for `source='ai_generated'` knowledge (self-serve report →
  admin review; overlaps Layer-7 admin tools).
- PayOS integration specifics (subscription/renewal handling, price-lock enforcement for Founding Members).
- Write the separate **architecture/operations doc** owning operational metrics (latency, cache-hit
  rate, hallucination rate, degradation rate) referenced in §7.
- Future business-model extensions this doc is structured to absorb: referrals, B2B, teacher plans, marketplace.

---

## Appendix — one-line summary

> Free users always have a complete learning experience and own their data forever. JapanWeb+ *accelerates*
> learning with an **intelligent learning system** (AI Sensei, deep breakdown, coaching, roadmap,
> pronunciation analysis, long-term memory…) built on the learner's own data. AI is treated as an investment
> into a growing shared knowledge base, so the platform becomes smarter and cheaper as the community grows.
