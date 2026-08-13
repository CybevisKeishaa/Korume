# Korume — Product Decision Register

**Every binding product ruling made during Phase 0, in one place.** Built 2026-08-12 because the
rulings had spread across three documents plus memory, and reconstructing them by hand is exactly
how one gets silently dropped.

> ⚠️ **This file is an INDEX, not a source of truth.** Each row states the decision in one line and
> points at where the reasoning, evidence and consequences actually live. **If this file and the
> referenced section ever disagree, the referenced section wins** — and this file is the one to fix.
> Never argue a decision from this page alone; never record a *new* decision only here.

**Status vocabulary:** `LOCKED` = decided, do not re-litigate · `PROPOSED` = written down, awaiting
the user's approval · `OPEN` = not decided.

---

## 1. Product model — `LOCKED`

| # | Decision | Where the reasoning lives |
|---|---|---|
| P1 | **Sensei is a Companion *mode*, not a second entity.** One intelligent presence | `capability-map.md` §3.1 |
| P2 | **Companion's name is `Korume`** — fixed and branded, not learner-chosen. `Storykeeper` is a *screen* name | `screen-inventory.md` §15.5, §20 |
| P3 | **Skill taxonomy is two tiers.** T1 (scoreable, comparable): Listening · Speaking · Reading · Grammar · Vocabulary · Kanji. T2 (diagnostic, **never summed**): Pronunciation · Pitch Accent · Particles… **Conversation is a context, not a skill** | `capability-map.md` §3.2 |
| P4 | **Both kanji surfaces ship** — discovery *and* curriculum | `capability-map.md` §3.4 |
| P5 | **`Certification Practice` is the module; JLPT · BJT · Tokutei Ginou are exam families.** Repo implements one | `screen-inventory.md` §10 |
| P6 | **Lesson workspace has FOUR Learning Modes** — Shadowing · Pronunciation · Listening Practice · Summary. The 8-tab row was a misread | `screen-inventory.md` §9.0 |
| P7 | **Dictation: typing is the mode, the word bank is a hint** | `screen-inventory.md` §9.3 |
| P8 | **Recommendation *reasons* are required** — an output of learning intelligence, not copy | `screen-inventory.md` §7.0 |
| P9 | **Answer revisions are recorded**, and power an insight family (7 variants + 2 honesty guards) | `screen-inventory.md` §10.9 |
| P10 | **Roadmap write-back is real** — results rewrite the plan | `screen-inventory.md` §10.5–10.6 |
| P11 | **`Favorites` is the mining family**, not a new capability | `screen-inventory.md` §7.2 |
| P12 | **Import pipeline + failure state: keep as drawn.** A progress narrative; failure's main cause is quota exhaustion | `screen-inventory.md` §7.0 |
| P13 | **Payment is PayOS.** No Stripe, no Visa, no Apple Pay | `screen-inventory.md` §19.3, §20 |
| P14 | **Auth = email + Google + Apple.** GitHub: no | `capability-map.md` §3.5 |
| P15 | **Native mobile apps are planned** — store badges are a roadmap statement | `capability-map.md` §3.5 |
| P16 | **No landing/gateway page exists yet** — known and accepted, user will design it later | `screen-inventory.md` §19.0 |

## 2. Information architecture — ✅ `LOCKED` (user approval, 2026-08-12)

**The user reviewed A1–A13 and approved the block on 2026-08-12.** A14 and A15 were added the
following day, during Phase 1b, and carry their own individual user rulings (dated in the table) —
the 08-12 approval does not cover them and does not need to. Cite this section, not a letter range. These are now as binding as §1 — do not
re-litigate, and do not let Phase 1, a later Figma frame, or the shape of the existing API reopen
one.

⚠️ **The registry does not get to re-decide any of this.** Phase 1b transcribes these rows; it never
derives them. See §3b.

| # | Decision | Where |
|---|---|---|
| A1 | Five nav groups: `learn · practice · remember · journey · account` | `ia-proposal.md` §2 |
| A2 | **Companion is ONE destination** over six screens (home · diary · sensei · memory · growth) | §3.1 |
| A3 | **Memory is one surface, two types** (`Learning` / `Conversations`) | §3.2 |
| A4 | **Statistics → Dashboard.** **Achievements → summary on Dashboard, gallery on Profile** | §3.3 |
| A5 | **`/challenges` → Roadmap/Mission**, no nav row | §3.4 |
| A6 | **Pronunciation gets its own nav row** despite being a T2 sub-skill | §3.5 |
| A7 | **`/mining` → `Collection`** (label only; the feature needs its own spec) | §3.6 |
| A8 | **`Journey` label moves to `/roadmap`**; `/journal` becomes the Diary under Companion | §3.3 of `capability-map.md` |
| A9 | **`/jlpt` → `/certification`** — carries a migration ⇒ **Phase 2** | §5 |
| A10 | **HIDE (code kept, row removed):** `/vocab` · `/reading` · `/community` · `/leaderboard` | §5 · ruled 2026-08-11 |
| A11 | **`/playlists` stays its own screen** — not folded into Explore | §5 |
| A12 | **Loading + error catalogues go to `/admin/style-guide`**, not the registry | §4 |
| A13 | **No route for:** search palette · create-conversation wizard · lesson preview · reflection · suggestion drawer | §4 |
| A14 | **A group's HEADING is not its id.** `journey` displays **"Growth" / "Tiến trình"** | `ia-proposal.md` §2 · ruled 2026-08-13 |
| A15 | **The companion's Vietnamese name is "Linh thú"** — nav row `companion-home` = **"Linh thú của tôi"** | ruled 2026-08-13 · **propagated 2026-08-13** |

**A14 was added during Phase 1b**, when the gap surfaced in implementation: A1 locks group *ids* and
§2 locks *row* labels, but nothing said what a group heading reads. Capitalising the id would have
rendered a heading "Journey" directly above a row "Journey" — the very label A8 had just moved onto
`/roadmap`. The id stays `journey` (it is identity, and `NavGroupId` is a compile-time union); only
the catalog value differs. ⚠️ Known and accepted: "Growth" also names a Companion sub-surface
(`Growth Areas`, `187:6556`) that lives inside this group.

**A14's Vietnamese heading was revised the same day**, from "Trưởng thành" to **"Tiến trình"** —
the first leaned *maturity/adulthood* rather than plain progression. `/roadmap` keeps **"Hành trình"**,
so the heading and the row inside it no longer collide in either locale.

**A15 — the companion's Vietnamese name is "Linh thú".** The nav row reads **"Linh thú của tôi"**,
and `/companion`'s own page title matches it, so the destination has one name rather than two. This
replaced "Đồng hành", which named a *quality* rather than the creature.

**A15 was propagated on 2026-08-13** (user ruling: propagate, don't scope down), and propagating it
required a distinction the ruling did not state — recorded here because it governs every future edit:

> **"Linh thú" replaces "người bạn đồng hành" only where that phrase functioned as a NAME.**
> Where it describes the *relationship* — `MASCOT.md`'s "Companion là một người bạn đồng hành",
> `companion-patterns.md`'s "sự khác biệt giữa một AI Assistant và một người bạn đồng hành" — it is
> a common noun phrase, still true, and deliberately kept. Blanket-replacing produced nonsense on
> inspection (`MASCOT.md`'s "yêu cảm giác được đồng hành cùng một sinh vật nhỏ bé" is a *verb*).
>
> ⚠️ **Correction to this register's own earlier claim, which was measured false.** It said the
> companion's "first-person voice throughout the diary and speech catalogs" still said "Người bạn
> đồng hành". It never did: `messages/vi/companion.json`'s `speech`, `journal` and `memoryTitle`
> catalogs speak as **"mình"** and **never name the creature at all**. The phrase occurred in
> **exactly one shipped VN string**, `a11y.sprite` — a third-person label addressed to the learner.
> The propagation was therefore one string, not a voice rewrite. (`L-002`: never carry a scope
> figure you did not measure.)
>
> `MASCOT.md` § Danh tính now carries A15, and states what the ruling implies but does not say:
> **"Linh thú" is the Vietnamese noun for the creature, not its proper name.** The proper name is
> **`Korume`** and was already settled by **P2** above — A15, ruled one day later, deliberately puts
> a common noun on the nav row rather than the proper name, exactly as "my cat" does not displace
> the cat's name. The two rulings compose; neither overrides the other.
>
> ⚠️ **`MASCOT.md` contradicted P2 and was reconciled to it, not the reverse.** Its § Danh tính
> still read "Tên của Companion sẽ được xác định trong Character Identity Spec" with six open
> candidates — text that **predates P2's LOCK (2026-08-12)** and had simply never been swept.
> `screen-inventory.md:436-438` records that the user closed it by *unifying* the name with the
> product's, not by declaring it a placeholder, so this was applying a ruling the user had already
> given, not choosing between two live answers. The candidate list is kept as marked-historical.

**The English `journey` heading stays "Growth" — user ruling 2026-08-13.** EN and VI are therefore
deliberately not literal equivalents: VI reads "Tiến trình" (≈ *Progress*). The user considered
moving EN to "Progress" and declined, so this is a settled divergence, not drift.
⚠️ **The `Growth Areas` collision noted above therefore stands, knowingly.** A future pass that
"discovers" it must not reopen it on that basis alone — it was seen, priced, and accepted.

## 3. Method rules — `LOCKED`, and they bind future passes

These cost real effort to learn. Breaking one repeats a mistake already paid for.

| # | Rule | Where |
|---|---|---|
| M1 | **Four layers, never collapsed:** A product intent (user) · B UX representation (the frame) · C implementation (measured code) · D constraint (`CLAUDE.md` §2) | `screen-inventory.md` § Governing Method |
| M2 | **B splits: B-design is authoritative; B-content may be wrong** | § Amendment A |
| M3 | ⭐ **B-content splits again: identity content → report it; sample content (numbers, names, dates, `&apos;`) → never report it.** The signal is the label, never the value | § Refinement A-bis |
| M4 | ⭐ **The slot is design; the contents of the slot are content.** Never delete a region because its sample contents are wrong (Checkout) | § Refinement A-bis · §20 |
| M5 | **Layer C is NOT a baseline.** A capability with no endpoint means the design is larger, not wrong. Never phrase a finding as "conflicts with the API" | § Amendment B |
| M6 | **Layer D binds absolutely** — `CLAUDE.md` §2 is not something the design outgrows | § Amendment B |
| M7 | **Never infer a frame's identity from its name, id, or canvas size.** Look at it | § Method rule (cost: a wrong "duplicate" call) |
| M8 | **Read `docs/design/screens/<module>.md` before treating any Figma detail as product intent** — a frame is a layer-B snapshot and can lag a ruling by months | § Method rule 3 |
| M9 | ⭐ **`Capability ≠ screen ≠ destination ≠ nav item.`** Do not create a destination because Figma has a frame; do not keep one because the repo has a route | `ia-proposal.md` §1, §3.4 |
| M10 | ⭐ **`Taxonomy ≠ Navigation.`** Position in the data model does not determine position in the navbar — in either direction | `ia-proposal.md` §1 |
| M11 | **A user's "I fixed it" is a claim about intent, not file state.** Read it back when cheap | `L-003` · `screen-inventory.md` §20 |
| M12 | **`public/demo/**` is not a design source.** Only a live Figma screenshot is authoritative | `mem:phase0_figma_inventory_run_state` |

## 3b. Sequencing — ✅ `LOCKED` (user, 2026-08-12): Phase 1 splits into **1a / 1b**

Phase 1's approved spec (`2026-08-08-screen-registry-design.md` R8/T6, §5) requires the derived
`NAV_GROUPS` to be **byte-for-byte identical to today's literal** and puts *"changing any navigation
label, order, or grouping"* out of scope — it was written before this IA existed. Rather than weaken
R8, the phase splits:

| Step | Changes | Proven by | Rule |
|---|---|---|---|
| **1a — the engine** | nothing visible | **R8/T6 exactly as specified** — derived `NAV_GROUPS` byte-identical to today | no IA change, no visual change, no screen ported |
| **1b — the data** | registry rows → the `LOCKED` IA | T6's snapshot re-frozen to `ia-proposal.md` §2 | **a data migration of navigation only.** The registry must never *infer* or invent structure |

> ⭐ **The reason the split exists, in the user's words:** *"1a chứng minh engine đúng; 1b thay đổi
> product decision. Hai loại diff không nên nằm chung commit."* A red test in a combined step could
> mean *the derivation is broken* **or** *the IA moved it* — two failure modes in one signal, in the
> one step whose entire purpose is mechanical correctness.

**Consequence for Phase 2 — ✅ its job is redefined.** The spec's Phase 2 was *"adjudicate the
Figma↔repo gap; find which side is right."* **Phase 0 already did that.** Phase 2 is now:

> **Decision Register + `LOCKED` IA → reconcile the implementation with the settled product model.**

Only genuinely new divergences need a fresh ruling; the rest is migration and schema/domain work.
**It must not re-open the investigation.**

Full reasoning: `ia-proposal.md` §5.

---

## 4. Still `OPEN`

**Structure — must be answered before or during the IA review:** none. All four IA blockers and all
three round-2 gaps are ruled.

**Scope — answerable after the IA is locked** (`capability-map.md` §3.5): Vimeo / multi-platform
import · `JLPT Speaking` as a Certification↔Conversation edge · `AI Coach` = flag or paid tier ·
theme & accent vs the dark-only token system · camera permission · the social graph behind
`Friends` visibility · the **L1 (native language)** field the Companion's *"without thinking in
Vietnamese"* depends on.

**Model / schema, deferred to their own specs:** conversation scenario model (8 wizard dimensions +
6 trait dials vs one text column) · save-everywhere → one collection surface (F-010/F-014) · curated
kanji collections (no schema) · the four new kanji domain nouns (learning path · course · kanji
lesson · study material).

---

## 5. Where each document's authority begins and ends

| Document | Holds | Does **not** hold |
|---|---|---|
| `CLAUDE.md` §2 | **law** — breaking it is a defect | experience, product decisions |
| `docs/lessons.md` | **process experience** under stable `L-NNN` ids | product decisions |
| `docs/design/screens/*.md` | **layer-A** written product authority per module | anything Figma-current |
| `docs/product/screen-inventory.md` | per-frame observation + the method rules | design; it records, it does not design |
| `docs/product/capability-map.md` | what Korume can do, and the §3 rulings | screen identity |
| `docs/product/ia-proposal.md` | destinations and grouping, and the **reasoning** behind §2's LOCKED rulings (the name says "proposal"; it stopped being one on 2026-08-12) | implementation detail — the rows that actually ship are `lib/product/screen-registry.ts` |
| **this file** | an index of decisions | **the reasoning behind any of them** |
