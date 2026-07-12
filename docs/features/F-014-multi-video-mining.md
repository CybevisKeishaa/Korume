# Multi-video Mining | ID: F-014

## Overview
When viewing a word, shows all videos in the library where that word appears, with frequency and sentence context. Demonstrates real-world usage.

## Why should we build this?
Understanding that a word appears often across different content reinforces its importance and provides diverse contexts for learning.

## User Story
As a learner, I want to see that "頑張る" appears 5 times in Naruto and 18 times across NHK videos, so that I realize it's a high-frequency word worth mastering.

## Workflow
1. In vocabulary detail, a "Appears in videos" section lists videos with that word.
2. Each entry shows video title, frequency count, and example sentence from transcript.
3. Clicking opens that video at the exact line.

## UI / UX
- Compact list with video thumbnail, title, frequency badge.
- Expandable to show sentences.

## Technical Design
- Build an inverted index of words to `transcript_lines`. Could be a materialized view or a table `word_index` (word, transcript_line_id, video_id).
- Populated on transcript import (or via background job). Tokenize transcript line, for each word add entry.
- Query: `SELECT video_id, COUNT(*) as freq FROM word_index WHERE word = ? GROUP BY video_id`.

## Database Impact
- **New table:** `word_index` (id, word, transcript_line_id, video_id) with indexes.
- Migration risk: Medium (needs backfill for existing transcripts).

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/vocab/:id/videos` | Returns list of videos containing this word |

## AI Opportunities
- AI suggests the best video to learn a word based on context clarity.

## Integration Points
- **Depends on:** Transcript data, vocab module.
- **Required by:** F-008 (Vocabulary Network) could link from here.

## Edge Cases
- Word not in any video — show "No occurrences yet".
- Word is a substring of other words (e.g., 行く vs 行きたい) — tokenization must handle.

## Future Extensions
- User can see which videos friends learned the word from.

## Priority
Medium

## Effort Estimate
M (3-4 days)