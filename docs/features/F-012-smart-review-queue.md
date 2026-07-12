# Smart Review Queue | ID: F-012

## Overview
SRS queue prioritizes words that will appear in videos the user plans to watch soon, making review immediately relevant.

## Why should we build this?
Traditional SRS is disconnected from real usage. This bridges the gap, increasing motivation and retention. It's a unique feature that directly supports the "Learn Before Watching" workflow.

## User Story
As a learner, when I add a video to my "Watch Tonight" playlist, I want the app to automatically move the words from that video to the top of my review queue, so that I'm prepared to understand the video better.

## Workflow
1. User adds videos to a playlist with a "Priority" flag (or marks as "Watching Tonight").
2. System fetches transcripts, identifies words not yet mastered.
3. These words receive a temporary boost in the SRS queue order without altering their underlying SM-2 intervals.
4. When user opens flashcards, these words appear first.
5. After review (or after the video is watched), the boost expires.

## UI / UX
- In flashcard deck, a subtle indicator "From tonight's video" on boosted cards.
- Dashboard shows "Up next: 15 words for Your Name".

## Technical Design
- Add a `context_boost` table or field to `user_vocab_progress` (boost_expiry, boost_priority).
- SRS fetch query modified: `ORDER BY (CASE WHEN boost_expiry > now() THEN 0 ELSE 1 END), next_review_at`.
- Boost applied when playlist marked as active.

## Database Impact
- Modify `user_vocab_progress` add `boost_expiry` timestamp, `boost_priority` integer.
- Migration risk: Low.

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/srs/boost` | Apply boost for a playlist/video |
| DELETE | `/api/srs/boost` | Clear boost |

## AI Opportunities
- AI recommends optimal boost timing based on user's daily schedule.

## Integration Points
- **Depends on:** SRS engine, playlists.
- **Required by:** F-005 (could trigger boost automatically after preview).

## Edge Cases
- User doesn't watch the video — boost expires naturally.
- Too many boosted words overwhelm queue — cap at 30.

## Future Extensions
- Adaptive boost strength based on video difficulty.

## Priority
High

## Effort Estimate
M (3-4 days)