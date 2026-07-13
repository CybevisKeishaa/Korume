# Monetization / Business Model — RESOLVED

Status: brainstorm COMPLETE + approved. Written to `docs/product/business-model.md`
(commits `3fb3232`, `4ba6746`, `d9bbb77` on master). This is the Layer 8 reference AND the
long-term product manifesto. Feeds `mem:project_status` Layer 8; supersedes main spec §3.12
(Stripe + 7-day trial).

## Doc = product manifesto (top) + operational model (numbered §0–§8)
Manifesto preamble: **Mission** (why we exist) → **North Star** (VN learners → fluency via real
content; shared knowledge compounds) → **Flywheel** (Learners→Study→Generate Knowledge→Base
Grows→Better Experience→more Learners) → **Non-goals** (NOT general chatbot / social network /
YouTube-replacement / international-yet) → **Product Moat** (moat = compounding personal history +
growing shared knowledge base + AI-that-understands-both + cost efficiency; NOT the AI model —
"widens with time not spend") → **Competitive Strategy** (compete on personalization/knowledge
accumulation/real content/long-term memory, NOT more models/requests/tokens) → **Positioning**
(JapanWeb+ = "Intelligent Learning System", AI Sensei is ONE component among Deep Breakdown /
Roadmap / Weekly Coach / Pronunciation Analysis / Long-term Memory / Study Replay / Weakness
Tracking → model-independent: Claude/GPT/Gemini) → **Product Decision Framework** (4-Q checklist
before any feature: improves learning? grows shared knowledge? cheaper as community grows?
strengthens personal learning? mostly-No → doesn't belong).

## What was decided (all locked)
- **Market VN only (for now — provisional, not permanent) · PayOS (Stripe ruled out) · free-first launch.**
  VN-only reason = user has no foreign-marketing strategy yet (2026-07-13); "Vietnam-first, no international
  GTM *until traction justifies it*" — revisit later, don't treat international as permanently off-limits or
  strip i18n-friendly structure. Competitor corodomo.com
  gives core loop free → core loop = table stakes, never charge for it.
- **6 design principles** (feature-review filter): (1) sell a personal learning experience not API
  requests; (2) users own data forever, premium unlocks intelligence OVER data not the data; (3)
  never lock core loop — ACCELERATE not ENABLE; (4) premium is DISCOVERED not advertised; (5) AI
  generates knowledge once serves many (cheaper as community grows); (6) every AI request =
  Serve-Knowledge or Generate-Knowledge, no third token-burning category.
- **Free/Premium = value-based split.** Free: full core loop + own-voice pitch ($0) + JLPT by
  section + Lite/cached AI + ~15–20% previews + **data export** (never locked; reinforces GDPR/
  CLAUDE §2). Premium (JapanWeb+): full cascade deep + AI Sensei memory/coaching/weekly/plan +
  Azure pronunciation + conversation (generous monthly quota) + full JLPT mock + advanced/long-term
  analytics + priority Knowledge Generation.
- **Value ladder (3 time-tiers):** ① cascade = day-1 acquisition trigger; ② AI-understands-me =
  conversion (needs data); ③ AI Sensei memory + WOW Study Replay = renewal moat. WOW replay:
  retrospective = $0 from stored data (safe); forward projection ("N4 in ~83 days") = MUST be an
  estimate w/ visible assumptions, compare to user's OWN past only (honesty).
- **Knowledge Economy (cost architecture):** generalize L4 cache pattern (video_summaries/
  vocab_examples) into a shared base **keyed by normalized sentence fingerprint, cached
  PER-SECTION**. Serve-Knowledge (cached reads) = $0 unlimited incl. free previews;
  Generate-Knowledge (cache miss) = consume small daily quota, then cache permanently for all.
  Quota is on CREATING not READING → resolves "user đốt token" fear = defense layer #2 reframed.
  **3-layer defense:** global daily kill-switch (build FIRST) → per-user Knowledge-Gen quota
  (free ~2–3/day, premium large) → free tier on $0-marginal features.
  **Model tiering (changes L4 default=Opus):** Haiku for Lite/cascade/cacheable; Opus for
  conversation only. See [[layer-4-ai-features-complete]].
- **3 knowledge-economy gotchas (Layer 8 must honor):** (a) fingerprint safety PER-SECTION —
  grammar/examples/quiz shareable, culture/nuance context-sensitive → mark non-shared; don't merge
  sentences differing only by は/が; (b) quality gate for `source='ai_generated'` (verified flag +
  report-error + visible AI label) since one miss caches permanently for all = absorbs deferred L7
  human-review gate; (c) UI must distinguish 🔒 premium-locked vs ⏳ not-yet-generated.
- **Conversion = Contextual Discovery** (REPLACES spec §3.12 7-day trial): in-context ✅/🔒 section
  list under each sentence + metered ~15–20% preview from same cached blob + first-hit-free deep
  taste + loss-aversion on user's OWN backlog + one free sample weekly report + free-vs-premium on
  the SAME real sentence.
- **Pricing (single tier, launch):** Monthly **49.000đ** · Annual **490.000đ** (~2mo free) ·
  Founding Member **39.000đ/mo price-locked while sub active**. **NO lifetime** (real per-active-
  user AI cost = negative margin). Second tier only if data shows Azure/conversation cost justifies.
- **North-star KPI = Knowledge Reuse Ratio = cached_reads / new_generations.** Plus knowledge/day,
  AI cost per active user, cost per premium sub, conversion, renewal, WAL, streak. Pure OPS metrics
  (latency, raw cache-hit, hallucination rate) belong in a SEPARATE architecture/ops doc (§8 TODO).

## Still open (into Layer 8 planning, doc §8)
Exact quota numbers (free/day, premium/mo); Azure/conversation internal quotas; the `verified`
quality-gate workflow; PayOS subscription/renewal + Founding price-lock enforcement; write the
separate architecture/ops-metrics doc; future extensions the doc is structured to absorb
(referrals, B2B, teacher plans, marketplace).
