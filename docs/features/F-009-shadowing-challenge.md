# Shadowing Challenge | ID: F-009

## Overview
Gamified shadowing minigame with levels based on sentence length and speed. Encourages daily practice and friendly competition.

## Why should we build this?
Shadowing can become monotonous. Challenges add fun, measurable goals and a sense of achievement, increasing daily active usage.

## User Story
As a learner, I want to challenge myself to shadow a 10-second anime clip at native speed and earn a badge, so that I'm motivated to practice speaking every day.

## Workflow
1. User enters "Challenge Mode" from a lesson's Shadowing mode, or Dashboard.
2. System presents a random line from a video appropriate to their level (based on heatmap/difficulty).
3. Difficulty tiers: Easy (short, slow), Normal, Hard (long, native speed), Expert (long, fast, complex).
4. User records shadowing, gets score.
5. Consecutive successes build streak; leaderboard available.
6. Badges and XP awarded.

## UI / UX
- Full-screen immersive design with countdown.
- Large waveform and scoring animation.
- Post-attempt celebration or encouragement.

## Technical Design
- Reuse shadowing recording and scoring infrastructure.
- Challenge sessions stored with tier and score.
- Leaderboard queries `shadowing_sessions` filtered by challenge type.

## Database Impact
- Modify `shadowing_sessions` add `challenge_tier` and `challenge_mode` flag.
- Migration risk: Low.

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/challenge/today` | Fetch today's challenge line(s) |
| POST | `/api/challenge/submit` | Submit recording for scoring |
| GET | `/api/challenge/leaderboard` | Weekly leaderboard |

## AI Opportunities
- AI dynamically adjusts difficulty based on user's recent performance.

## Integration Points
- **Depends on:** Shadowing engine, gamification.
- **Required by:** Immersion Dashboard (F-015) to show challenge stats.

## Edge Cases
- No microphone permission.
- Poor audio quality leading to inaccurate scores.

## Future Extensions
- Themed challenges (anime week, JLPT sprint).
- Friends challenge.

## Priority
Medium

## Effort Estimate
M (3-5 days)