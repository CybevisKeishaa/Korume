# Figma second capture batch (2026-08-23) — run state

> Read this before touching billing/payment UI, auth screens, error-state UI, or the marketing
> homepage. Full per-frame detail lives in `docs/product/figma-frame-map.md` § "Second capture batch
> (2026-08-23)" — this memory summarizes and gives the reasoning; that file is the record.

## What happened

The user added new frames to the Figma file (`IwFHZDZdHW7qsSFiNbWrkd`) and asked for a review. Diffing
the current page (70 top-level nodes) against the 2026-08-20 snapshot (69) found only one structural
change — a hidden decorative `rounded-rectangle` named "Homepage" (`346:6275`), not a real screen. The
actual "new screens" were the **12 frames the 2026-08-20 note had already flagged as missing from
`figma-frame-map.md`** (never screenshotted before) plus `218:15740 Error state` (in the map since
2026-08-11, but also never screenshotted). The user selected all 15 in the Figma desktop Layers panel;
`get_metadata` with no `nodeId` read the selection back to confirm ids, then each was screenshotted and
visually reviewed. This is a **capture/analysis pass, not an implementation pass** — nothing was built,
no registry or navigation was touched, per the standing CLAUDE.md instruction not to settle
navbar/routes/registry without user review.

## What was found, by cluster

- **Auth flow** (`332:3` Register, `65:2` Login, `333:210` Reset password, `335:306` Email OTP) — one
  coherent 4-step flow, consistent split layout (brand copy + mascot art left, dark form card right).
  None of it is built yet.
- **Billing / Layer 8** (`340:3795` Membership, `340:4586` Unsubcribe membership, `340:5402` Choose
  method) — a full `/settings/membership` page (active plan, What's-included list, payment method,
  transaction history) plus cancellation and payment-method-choice dialogs.
- **Error-state system** (`218:15740` + near-duplicate `335:1588`, `335:1976` Error404, `337:2055`
  Error boundary) — `218:15740`/`335:1588` are a design-system reference sheet ("Error states, gently
  handled" — 8 card variants + tone guidelines: "Never blaming. Never alarming. Always Korume-led."),
  not real screens; `335:1976` and `337:2055` are real pages.
- **Data privacy/deletion** (`337:3323`, `339:3612`) — NOT new information. These are the two frames
  L9b Plan 1 (merged `4b1fef7`) already built `/settings/privacy` against; this pass just confirms the
  shipped implementation matches them.
- **New marketing homepage** (`347:6277`, 1280×4028) — a full public landing page, distinct from the
  existing onboarding-cluster `Homepage` (`111:515`). ⚠️ **Correction (2026-08-25):** "onboarding
  cluster" is wrong for `111:515` — it is the **authenticated Dashboard**, ruled 2026-08-12 in
  `screen-inventory.md` §19.0/§19.1 and registered as `dashboard`. The frame was grouped by canvas
  proximity rather than by being looked at (`M7`). Everything else in this bullet stands.
  Three frames now share the name "Homepage"
  (`111:515`, `347:6277`, and the noise rectangle `346:6275`) — same collision pattern as the earlier
  `29:2890`/`280:3` Kanji pair; a rename pass is optional cleanup, not urgent (node ids disambiguate).

## ⭐ Payment-provider conflict — RULED 2026-08-23

**`340:5402` "Choose method" shows three payment providers — PayOS (pre-selected), SePay, MoMo —
which reads as conflicting with `CLAUDE.md` §3: "Payments: PayOS subscriptions, no trial."** Surfaced
to the user in-chat per the CLAUDE.md §2 spirit. **Ruling (user, 2026-08-23): `CLAUDE.md` §3 stands
unchanged — PayOS only, for now.** The user's own reasoning: domestic gateways (SePay, MB Bank-style
methods, etc.) are on the roadmap, and they expect Layer 8 will eventually need a provider-selection
layer much like this Figma screen shows — **but SePay/MoMo need their own complex merchant
registration**, which is deliberately deferred. So: **when Layer 8 is built, ship only a PayOS
adapter, but shape the payment code as a provider-agnostic port from day one** (mirroring
`lib/ai/*` and `lib/email/*` — port + registry + one real adapter + `AI_PROVIDER`/`EMAIL_PROVIDER`-style
explicit selection, never inferred from which keys exist — see `mem:korume-shared-infra-preference`
in the auto-memory index). This is a forward-compat architecture note for whoever builds Layer 8, not
an immediate task — do not build a payment-provider port or the "Choose method" UI's multi-provider
list until Layer 8 is actually scoped.

## Also flagged, not investigated further

`337:2055`'s visible sidebar (LEARN: Dashboard/Lessons/Kanji/Vocabulary/Grammar/Reading/Speaking/JLPT;
STUDY: Review/Mining) doesn't obviously match `components/layout/app-nav.tsx`'s current `NAV_GROUPS`
(LEARN 8/STUDY 4/PROGRESS 1/ACCOUNT 1) counts. Worth diffing next time nav is touched — not chased
here, same standing-instruction reason as above.

## Not done in this pass, deliberately

No screen-inventory.md/capability-map.md cluster analysis (the Phase-0-style deep read) was run on
these 13 frames — this was a capture + first-look review, not a full inventory pass. If the user wants
these folded into the IA/registry properly, that's the next scoping conversation, likely alongside the
still-unscoped Screen Registry Phase 3 (`mem:screen_registry_phase_2b_run_state`).

## Related

`docs/product/figma-frame-map.md` § "Second capture batch (2026-08-23)" (full per-frame detail) ·
`mem:project_status` (candidate-action list this closes one item of) · `CLAUDE.md` §3 (the payments
line now in question) · `mem:l9b_plan1_gdpr_run_state` (confirms `337:3323`/`339:3612` match what
shipped).
