# Difficulty Timeline | ID: F-004

## Overview
Visual indicator on each video showing predicted comprehension percentage (based on user's vocabulary). Helps learners choose content at the right level.

## Why should we build this?
Directly supports the i+1 recommendation engine by making difficulty transparent. Users can self-select without guesswork.

## User Story
As a learner, I want to see at a glance how hard a video will be for me (e.g., "You will understand ~72%") so that I can pick videos I can learn from without being overwhelmed.

## Workflow
1. On video catalog/list, display a compact bar or badge: "72% comprehension".
2. Color-code: green (>80%), yellow (50-80%), red (<50%).
3. Based on heatmap computation (F-002).
4. Clicking might show the word breakdown (future).

## UI / UX
- Small inline tag next to video thumbnail.
- In playlist, shows average difficulty.
- Interactive: hover to see known/unknown word count.

## Technical Design
- Reuse the same logic as heatmap/comprehension calculation. Pre-compute for videos in catalog and cache.
- Store in `video_difficulty_cache` per user or compute on-the-fly with caching.

## Database Impact
- **New table:** `user_video_difficulty` (user_id, video_id, comprehension_percent, updated_at) for caching.
- Migration risk: Low.

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/videos/:id/difficulty` | Returns comprehension % for current user |
| GET | `/api/videos/difficulty-bulk?ids=` | Batch fetch for list views |

## AI Opportunities
- AI could adjust difficulty based on not just vocab but grammar complexity.

## Integration Points
- **Depends on:** F-002 (Heatmap) for comprehension calculation.
- **Required by:** F-016 (Goal-based paths) to filter videos by difficulty.

## Edge Cases
- New user with no vocabulary data — show "?" or default to N5 level estimate.
- Video with no transcript — use metadata level estimate.

## Future Extensions
- Show difficulty timeline of a whole series.
- Adaptive difficulty badges for grammar and speed.

## Priority
Medium

## Effort Estimate
S (1-2 days)