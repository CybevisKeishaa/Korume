# Vocabulary Network | ID: F-008

## Overview
When viewing a word, displays related words sharing the same kanji, root, or semantic field (e.g., 食べる → 食事, 食堂). Promotes deeper vocabulary acquisition.

## Why should we build this?
Creating mental connections between words improves retention. It's a proven vocabulary-building technique missing from most flashcard apps.

## User Story
As a learner, I want to see words related to "食べる" when I look it up, so that I can learn multiple words at once and understand their relationships.

## Workflow
1. User taps on a word in vocab list or transcript.
2. Detail panel shows the word, readings, meaning, and a "Related Words" section.
3. Related words are fetched from pre-built relations in DB.
4. User can tap to explore any related word.
5. Option to add them as a batch to SRS.

## UI / UX
- Visual network graph (optional) or simple list with icons.
- Grouped by relationship type: "Same Kanji", "Synonyms", "Compounds".
- Each item shows word, reading, meaning, and status (known/unknown).

## Technical Design
- Database table `vocab_relations` with `vocab_id_1`, `vocab_id_2`, `relation_type` (same_kanji, synonym, antonym, compound, etc.).
- Populate initially with algorithmic matching (shared kanji) and manual curation. AI can suggest relations.
- API returns related words with user's SRS status.

## Database Impact
- **New table:** `vocab_relations`
- **Modified:** `vocab` maybe add `root_form` to help grouping.
- Migration risk: Medium (needs data seeding).

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/vocab/:id/related` | Get related words |

## AI Opportunities
- Claude generates example sentences that use multiple related words.
- AI suggests relation types based on meaning similarity.

## Integration Points
- **Depends on:** Vocab module (Layer 2)
- **Required by:** Can enhance F-010 (Review by Context).

## Edge Cases
- Word has no related words — hide section.
- Circular relations — handle gracefully.

## Future Extensions
- Interactive graph visualization.
- User-contributed relations.

## Priority
Medium

## Effort Estimate
M (3-4 days) plus data seeding effort.