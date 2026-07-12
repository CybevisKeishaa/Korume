# Personalized Weakness | ID: F-007

## Overview
Analyzes user errors across listening, dictation, grammar exercises, and JLPT mock tests to identify weak points (e.g., passive form, causative, keigo). Dashboard suggests focused practice.

## Why should we build this?
Generic XP systems ignore what actually needs improvement. Targeted practice is far more effective and shows the app truly understands the learner.

## User Story
As a learner, I want the app to tell me "You often mistake passive and causative forms" and provide exercises for that, instead of just showing a generic score.

## Workflow
1. System tracks errors tagged with linguistic categories (grammar point, vocabulary type, kanji radical, etc.).
2. A background job or on-demand analysis computes weakness scores per category.
3. Dashboard displays top 3 weaknesses with progress bars and "Practice" buttons.
4. Clicking leads to targeted mini-drills (filtered flashcards, grammar exercises).

## UI / UX
- Dashboard section "Your Focus Areas" with cards.
- Each card: weakness name, description, strength %, link to practice.
- Clean, encouraging tone ("Here's what to work on next").

## Technical Design
- Create `user_weakness` table. Categories derived from item metadata:
   - Grammar: from `grammar_points` tags.
   - Vocab: part of speech, JLPT level.
   - Kanji: radical, stroke count.
- Error tracking: listening attempts (F-001), dictation, test answers, SRS quality scores < 3.
- Compute weakness score = weighted error frequency, decay over time if user improves.
- Update weekly or on-demand.

## Database Impact
- **New table:** `user_weaknesses` (user_id, category, category_type, error_count, last_error_at, strength_score)
- **New table:** `error_log` (user_id, item_type, item_id, category, context, created_at) for granular tracking.
- Migration risk: Medium (needs backfill strategy).

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/user/weaknesses` | Get current top weaknesses |
| POST | `/api/errors/log` | Log an error (called internally) |
| GET | `/api/practice/weakness/:category` | Get practice set for a weakness |

## AI Opportunities
- Claude analyzes free-text errors to detect misused grammar patterns.

## Integration Points
- **Depends on:** F-001, dictation, test modules, grammar exercises.
- **Required by:** Immersion Dashboard (F-015) could show weakness trends.

## Edge Cases
- New user with no errors — show placement test suggestion.
- Very broad category (e.g., "particles") — sub-categorize.
- False positives (typos vs. real errors) — challenging.

## Future Extensions
- Adaptive lesson plan based on weaknesses.
- Compare weakness profile with friends.

## Priority
High

## Effort Estimate
M (4-6 days) — needs error taxonomy, logging, UI.