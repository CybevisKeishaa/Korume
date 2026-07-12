# Immersion Dashboard | ID: F-015

## Overview
A comprehensive dashboard that focuses on time spent in the language rather than gamification points. Shows total videos watched, hours of listening, shadowing time, and words encountered.

## Why should we build this?
Language learning is about immersion hours. This dashboard reflects real effort and progress, aligning with serious learners' goals. Complements but de-emphasizes XP.

## User Story
As a learner, I want to see that I've watched 84 videos, listened for 32 hours, and encountered 18,000 unique words, so that I can feel proud of my immersion effort.

## Workflow
1. Aggregated stats computed daily (or on demand) from user activity tables.
2. Dashboard layout:
   - Immersion stats (videos, hours listened, hours shadowed, words encountered).
   - Comprehension progress chart (average across all content).
   - Weekly activity heatmap (like GitHub).
   - Current streak and level (kept but smaller).
   - Personalized weaknesses (F-007).
   - Content progress (F-011).
3. All data is filterable by time period.

## UI / UX
- Clean, modern dashboard with animated counters.
- Tailwind-styled cards, responsive.
- Inspirational quotes about immersion.

## Technical Design
- Create a materialized view or summary table `user_immersion_stats` refreshed nightly.
- Time listened: sum of video durations * (user progress percentage). Shadowing time: sum of recording durations.
- Words encountered: count distinct words from transcripts of videos watched.

## Database Impact
- **New table:** `user_immersion_stats` (user_id, stat_type, value, recorded_date).
- Migration risk: Low.

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/user/immersion-stats` | Get current aggregated stats |

## AI Opportunities
- Claude generates a weekly "immersion report" with encouraging insights.

## Integration Points
- **Depends on:** Video progress, shadowing data, vocabulary data, F-007, F-011.
- **Required by:** Main dashboard.

## Edge Cases
- New user with zero stats — show onboarding inspiration.
- Data inconsistency (deleted videos) — handle missing.

## Future Extensions
- Compare immersion stats with friends.
- Set immersion goals (e.g., 100 hours this month).

## Priority
High

## Effort Estimate
M (4-6 days) — data aggregation and UI.