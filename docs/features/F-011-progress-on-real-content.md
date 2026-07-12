# Progress on Real Content | ID: F-011

## Overview
Dashboard shows comprehension percentages for specific series or content genres (e.g., "Spy x Family: 32%", "NHK Easy: 81%"). Makes learning tangible.

## Why should we build this?
Learners often measure progress by what they can understand in the real world. Seeing a series become more comprehensible is a powerful motivator.

## User Story
As a learner, I want to see that I now understand 81% of NHK Easy News, so that I feel confident I can consume it without assistance.

## Workflow
1. Videos can be tagged with series or source (admin-defined or user-created tags).
2. System calculates average comprehension % for all videos with a given tag that the user has interacted with.
3. Dashboard widget "Your Library" displays tags sorted by highest comprehension.
4. Clicking a tag shows list of videos and comprehension per video.

## UI / UX
- Cards with tag name, percentage, and a mini progress bar.
- Can be part of Immersion Dashboard (F-015).

## Technical Design
- Add `video_tags` table and `video_tag_mapping`.
- Compute comprehension using same method as F-004.
- Aggregate per tag.

## Database Impact
- **New tables:** `video_tags`, `video_tag_mapping`.
- Migration risk: Low.

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/user/content-progress` | List of tags with comprehension % |

## AI Opportunities
- AI could auto-tag videos based on title/description.

## Integration Points
- **Depends on:** F-002, F-004, video tagging.
- **Required by:** Immersion Dashboard.

## Edge Cases
- User has not watched any video of a tag — don't show.
- Multiple tags same video — comprehension counted once.

## Future Extensions
- Public "shelves" of content with community comprehension stats.

## Priority
Medium

## Effort Estimate
S/M (2-3 days)