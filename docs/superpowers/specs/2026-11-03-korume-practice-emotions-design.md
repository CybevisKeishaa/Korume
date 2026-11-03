# Korume's emotions in practice — design (2026-11-03)

## Intent (owner, 2026-11-03)
Korume is a mischievous best friend from a comedy anime: strong feelings, always cute, even when serious. After a
result the learner should feel happy, laugh, and feel scolded *cutely*, never harshly. The owner supplied 19 poses
(`assets/newpose/`, commit `8c33ae14`) and named two anchors: right on the first try → `chinh-xac`; failing again and
again or getting weaker → the sulking pout (`gian-doi-mat-xi`).

## Scope
Listening (Chép chính tả, word pieces, Điền từ) and Pronunciation. A reaction appears only once a result is on screen
(Check, Show answer, a pronunciation score that lands while the learner is still on that sentence).

## Rules (`lib/practice/korume-mood.ts`, first match wins)
The page visit keeps a log of results (never persisted). "Misses" = the latest run of partial / revealed results on
this sentence; "streak" = the latest run of unhelped perfect results across sentences.

| Outcome | Condition | Mood | Pose |
|---|---|---|---|
| Show answer | no earlier try on this sentence | furious | `tuc-gian` |
| Show answer | after a try | peek | `cuoi-bi-hiem` |
| right with help | — | giggle | `cuoi-che-mieng` |
| perfect | after a miss on this sentence | comeback | `tien-len` |
| perfect | streak ≥ 5 / 3–4 / 2 / 1 | proud / hype / smug / ace | `tu-hao-hanh-dien` / `cuoi-phan-khich` / `tu-hao` / `chinh-xac` |
| partial | score 0 | shock | `shock` |
| partial | 5th miss in a row | cry | `khoc` |
| partial | lower than this sentence's last score | sulk, or tantrum from the 3rd miss | `gian-doi-mat-xi` / `tuc-gian-dap-tay-xuong-dat` |
| partial | three results in a row each lower | sulk | `gian-doi-mat-xi` |
| partial | 3rd–4th miss | dizzy | `choang-vang` |
| partial | higher than this sentence's last score | improved | `nhay-mat` |
| partial | only extra typed characters | laugh | `cuoi-nac-ne` |
| partial | nearly there (Listening ≥ 80, Pronunciation ≥ 60) / otherwise | close / focus | `hmm` / `quyet-tam-cao-do` |

Perfect = Listening's `*_perfect` (never with help), Pronunciation ≥ 80 (the Summary's strong cut).

## Voice
Two quips per mood (`shadowing.workspace.practice.korume.<mood>.a|b`, vi + en), taken in turn. The pose is
decorative; Listening's quip sits outside the P14 live region (facts are announced, flavour is not), Pronunciation's
sits in the take status beside the label and score.

## Calls made by Claude (owner may veto at the Chrome look)
- `xin-chao` and `thich-thu-vao-vi-tri` are shipped but unused: practice shows Korume only after a result.
- Pose files keep the owner's Vietnamese slugs; trimmed at alpha > 8, ≤ 300 px high (`scripts/mascot/poses.json`).
- All quip copy is Claude's draft.
