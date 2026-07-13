# JapanWeb+ — Business Model & Monetization Strategy

> **Status:** Approved brainstorm → feeds **Layer 8 (Monetization & Polish)**.
> **Scope:** Product philosophy, Free/Premium split, AI knowledge economy, cost architecture,
> pricing, and conversion strategy. Named `business-model` (not `monetization`) so it can grow
> to cover referrals, B2B, teacher plans, and marketplace without restructuring.
> **Related:** root `CLAUDE.md` §2 (non-negotiables), main spec §3.12 (Free/Premium — the Stripe
> part is superseded here), `docs/features/` (F-001..F-016), Serena memory `monetization_brainstorm`.

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

3. **Never lock the core loop. Premium *accelerates* learning, it does not *enable* learning.**
   The complete Video → Shadowing → Dictation → SRS → Mining loop is free and unlimited.

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

---

## 2. Free vs Premium

**Rule:** the split is *value-based*, not *feature-based*. We keep whole workflows intact for Free
and monetize depth, personalization, and live AI.

| Capability | Free | JapanWeb+ |
|---|---|---|
| Core loop: Video → Shadowing → Dictation → SRS → Sentence Mining | ✅ unlimited | — |
| Own-voice pitch contour (client-side F0/YIN, $0) | ✅ unlimited | — |
| Kanji / Vocab / Grammar / Adaptive Furigana / Dashboard | ✅ | — |
| JLPT | practice by individual section | **full mock exams** + detailed analysis |
| AI explanations | **Lite** (cached) + **preview** (~15–20% teaser) of deep sections | **full cascade deep** |
| Knowledge Generation (new/cache-miss sentences) | small quota (~2–3/day) | large / priority quota |
| Export data (transcript, notes, flashcards, vocabulary) | ✅ | — |
| AI Sensei (memory, coaching, weekly reports, personalized plan) | — | ✅ |
| Azure pronunciation scoring (accuracy/fluency/completeness + native overlay + per-word) | — | ✅ (generous internal quota) |
| Conversation partner (STT→Claude→TTS) | — | ✅ (generous monthly quota, not unlimited) |
| Advanced & long-term analytics + WOW Study Replay | — | ✅ |

**Never behind the paywall:** the core learning experience, ownership/export of the user's own data,
and the free unlimited own-voice pitch contour.

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
| Cache hit rate | health of the knowledge economy (§4) |
| Knowledge generated / day | growth rate of the shared base + generation-cost driver |
| AI cost per active user | must trend **down** over time |
| Average AI cost per premium subscriber | margin safety on the unbounded-cost features |
| Premium conversion rate | is Contextual Discovery working (§5) |
| Premium renewal rate | is the long-term moat real (§3 tier ③) |
| Weekly active learners | top-of-funnel + free-tier stickiness |
| Average learning streak | habit formation (the free-first bet) |

---

## 8. Open follow-ups (into Layer 8 planning)

- Confirm exact Knowledge Generation quota numbers (free/day, premium/month) once cost data exists.
- Confirm Azure pronunciation + conversation internal monthly quotas (margin-protecting, invisible).
- Decide the `verified` quality-gate workflow for `source='ai_generated'` knowledge (self-serve report →
  admin review; overlaps Layer-7 admin tools).
- PayOS integration specifics (subscription/renewal handling, price-lock enforcement for Founding Members).
- Future business-model extensions this doc is structured to absorb: referrals, B2B, teacher plans, marketplace.

---

## Appendix — one-line summary

> Free users always have a complete learning experience and own their data forever. JapanWeb+ *accelerates*
> learning with a personal AI Sensei built on the learner's own data. AI is treated as an investment into a
> growing shared knowledge base, so the platform becomes smarter and cheaper as the community grows.
