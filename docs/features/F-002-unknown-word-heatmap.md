# Unknown Word Heatmap | ID: F-002

## Overview
Colors each word in the transcript based on the user's mastery level (known, learning, unknown). Provides instant insight into why understanding is low.

## Why should we build this?
Transparency and motivation. Learners often wonder "why can't I understand this video?" This visual breakdown answers immediately. It also feeds into Learn Before Watching and i+1 difficulty estimation.

## User Story
As a learner, I want to see which words in the transcript are new to me so that I can focus my study on those words and understand my comprehension gaps.

## Workflow
1. When viewing a video transcript, the system checks each word against the user's `user_vocab_progress` (and `user_kanji_progress` for kanji).
2. Assign a color:
   - 🟢 Known (mastered, SRS stage ≥ certain threshold)
   - 🟡 Learning (seen but not mastered, SRS interval short)
   - 🔴 Unknown (no entry in progress)
3. Display the transcript with words highlighted according to their status.
4. Tapping a red/yellow word opens quick lookup and option to add to SRS.
5. Toggle on/off via a button.

## UI / UX
- Seamlessly integrated into existing transcript view.
- Soft background colors, not harsh.
- Legend togglable.
- Works with furigana adaptive rendering (F-004-like).

## Technical Design
- Pre-compute heatmap data when transcript loads. Query all words in the line against the database of user vocabulary progress. Cache per user/video to avoid repeated queries.
- Words are tokenized using a Japanese tokenizer (backend) to match dictionary forms. Fuzzy matching for conjugations.
- Store computed status per word in memory or in a dedicated column (optional caching).

## Database Impact
- No new tables required. Could add a cache table `user_video_heatmap` (user_id, video_id, line_index, word, status) to speed up, but not essential.
- Migration risk: None.

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/videos/:id/heatmap` | Returns array of words with status per line |

## AI Opportunities
- AI could predict unknown words based on similar users (collaborative filtering) to pre-warn learners.

## Integration Points
- **Depends on:** SRS data (Layer 2)
- **Required by:** F-001 (Active Listening Mode highlights errors with same colors), F-004 (Difficulty Timeline), F-005 (Learn Before Watching), F-010 (Review by Context can prioritize unknown words).

## Edge Cases
- Words not in our vocabulary DB (e.g., slang, proper nouns) — treat as unknown but allow user to ignore.
- Compound verbs/nouns splitting — tokenizer must handle correctly.
- User has no progress data yet (new user) — all words unknown, maybe prompt onboarding.

## Future Extensions
- Heatmap for entire playlist difficulty.
- Show % comprehension at the top of transcript.

## Priority
High

## Effort Estimate
S/M (1-3 days) — depends on tokenizer integration and UI.