# Goal-based Learning Paths | ID: F-016

## Overview
During onboarding, users select a primary goal (Anime, JLPT, Business, Travel). The system tailors video suggestions, SRS, and lessons to that goal.

## Why should we build this?
Personalization increases engagement and retention. A learner aiming to understand anime has different needs than one preparing for JLPT N2. This feature makes the app adaptive.

## User Story
As a new user, I want to tell the app I'm learning Japanese to watch anime without subtitles, so that it recommends casual speech videos, common anime vocabulary, and skips keigo lessons for now.

## Workflow
1. Onboarding includes goal selection step (can be changed later in settings).
2. Based on goal, a set of tags is associated (e.g., Anime: casual, slang, common words; JLPT: N5-N1 grammar, formal vocab; Business: keigo, email phrases; Travel: survival phrases, directions).
3. Video catalog filters by relevant tags and difficulty.
4. SRS and lesson recommendations prioritize content tagged for that goal.
5. Dashboard shows progress within that path (e.g., "Anime Comprehension: 40%").

## UI / UX
- Onboarding: visual cards for each goal with illustration.
- Settings: option to switch goal.
- Path progress bar on dashboard.

## Technical Design
- Add `user_goal` to user profile.
- Content tagging: videos, vocab, grammar points get tags (e.g., `anime`, `business`, `travel`, `jlpt`). Admin can set or AI auto-tag.
- Recommendation engine queries with tag filter and difficulty (F-004).
- SRS queue can incorporate goal tags (not exclude others but prioritize).

## Database Impact
- Modify `users` add `primary_goal` text.
- New tables: `goal_tags` (goal, tag) and tagging for content.
- Migration risk: Medium.

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| PUT | `/api/user/goal` | Update user goal |
| GET | `/api/recommendations` | Get personalized videos/lessons based on goal |

## AI Opportunities
- Claude auto-suggests tags for new content based on transcript analysis.
- AI generates custom study plans.
- **Free vs Premium** (`docs/product/business-model.md` §2.1): goal selection + tag-filtered
  recommendations are rule-based → **free**; the AI-authored adaptive study plan / weekly re-planning is
  the premium **Personalized Roadmap** component. AI never gates *having* a path — only its personalization
  depth (principle 3: accelerate, don't enable).

## Integration Points
- **Depends on:** Onboarding, tagging system, recommendation engine.
- **Required by:** Personalization of almost all modules.

## Edge Cases
- User changes goal — how to handle existing progress? Show both paths or migrate.
- User wants multiple goals — allow secondary goals.
- New content without tags — use general pool.

## Future Extensions
- AI-curated learning paths that adapt weekly.
- Community-created paths.

## Priority
Medium

## Effort Estimate
L (1-2 weeks) due to tagging, filtering, and UI changes.