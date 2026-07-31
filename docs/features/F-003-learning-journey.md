# Learning Journey | ID: F-003

## Overview
Shows the user's comprehension percentage of a specific video over time. Rewatching a video reveals progress, giving a strong sense of improvement.

## Why should we build this?
No app does this well. It provides tangible proof of learning, extremely motivating. Encourages rewatching — which is a powerful learning technique.

## User Story
As a learner, I want to revisit a video I struggled with months ago and see that my understanding has increased from 18% to 67%, so that I feel motivated and can measure real progress.

## Workflow
1. Each time a user finishes watching a video (or at significant intervals), the system calculates comprehension % = (number of unique words in transcript that are "known" / total unique words).
2. Snapshot `(user_id, video_id, timestamp, comprehension_percent)` is saved.
3. This comprehension-over-time timeline belongs in the lesson's **Summary Learning Mode**
   (`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §6.2) — a read-only
   aggregation of the lesson's own data — or the Dashboard; the standalone Video Detail page this
   originally targeted is deprecated with no replacement
   (`docs/superpowers/specs/2026-07-29-shadowing-hub-consolidation-design.md` §0).
4. Optionally display milestones (e.g., "First time: 18%", "Today: 67%").

## UI / UX
- Small line chart inside the lesson's Summary Learning Mode.
- Dashboard widget: "Re-watch Progress" with several lessons.
- Could show for the most recently rewatched lesson.

## Technical Design
- Use `user_video_progress` table with a new column `comprehension_snapshots` (jsonb) or a separate table `video_comprehension_snapshots`.
- Computation: tokenize transcript unique words, lookup SRS status, calculate percentage.
- Trigger snapshot on video completion event.

## Database Impact
- **New table:** `video_comprehension_snapshots` (id, user_id, video_id, known_percent, total_words, known_words, created_at)
- Or add jsonb column to `user_video_progress` for simplicity.
- Migration risk: Low.

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/videos/:id/journey` | Get comprehension snapshots for this video |
| POST | `/api/videos/:id/comprehension` | Trigger snapshot calculation (or auto on video end) |

## AI Opportunities
- Claude could generate a congratulatory message summarizing progress.

## Integration Points
- **Depends on:** SRS data, video progress.
- **Required by:** Immersion Dashboard (F-015) to show overall growth.

## Edge Cases
- User hasn't rewatched a video — graph shows single point.
- Video transcript changed after snapshot — mark snapshots stale.
- Words not in vocab DB.

## Future Extensions
- Compare comprehension across different genres.
- Suggest videos for rewatching based on expected improvement.

## Priority
High

## Effort Estimate
S (1-2 days) — computation logic + simple chart.