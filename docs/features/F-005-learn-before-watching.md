# Learn Before Watching | ID: F-005

## Overview
Before watching a video, the user can study the new words that will appear in it, boosting comprehension from the start.

## Why should we build this?
This turns passive watching into an active learning session. It's a "preview" that increases the effectiveness of immersion.

## User Story
As a learner, I want to review the 18 unfamiliar words in a video before I watch it, so that I can understand more of the content without stopping.

## Workflow
1. User selects a video and sees the option "Learn 18 new words first (5 min)".
2. On click, a flashcard-style preview session begins with only those words (using SRS preview mode).
3. After completing (or skipping), user proceeds to watch the video.
4. The previewed words are marked as "learning" in SRS with initial ease factor, and the video's heatmap updates accordingly.

## UI / UX
- A prominent button on video detail page.
- A quick onboarding card showing word count and estimated time.
- Preview interface: minimal, swipeable, with audio and context sentence if available.
- Progress indicator (x/18).

## Technical Design
- Extract unique words from transcript that are unknown to user (using F-002 logic).
- Create a temporary SRS queue for these words. User reviews them; each review calls normal SRS update.
- Store a flag `video_preview_completed` in `user_video_progress`.

## Database Impact
- Modify `user_video_progress` add column `preview_completed BOOLEAN DEFAULT false`.
- No other changes; SRS tables handle word progress.
- Migration risk: Low.

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/videos/:id/preview-words` | Returns list of unknown words for this video |
| POST | `/api/videos/:id/preview-complete` | Marks preview as done |

## AI Opportunities
- Claude could generate a quick story using those new words to aid memorization.

## Integration Points
- **Depends on:** F-002 (Heatmap), SRS engine.
- **Required by:** F-012 (Smart Review Queue) could prioritize these words further.

## Edge Cases
- Video has no unknown words — show "You know all words, enjoy!".
- Very long word list (>50) — allow user to cap at 20 most frequent.
- User interrupts preview — resume later.

## Future Extensions
- Spaced preview: review some words before, some after watching.
- Grammar point preview.

## Priority
High

## Effort Estimate
M (3-4 days) — preview UI, SRS integration.