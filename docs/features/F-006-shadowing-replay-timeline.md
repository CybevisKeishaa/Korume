# Shadowing Replay Timeline | ID: F-006

## Overview
Saves and visualizes all past shadowing attempts for the same line, allowing users to replay and compare their recordings over time.

## Why should we build this?
Progress in pronunciation is gradual. Seeing (and hearing) improvement across attempts is highly motivating and helps refine accent.

## User Story
As a learner, I want to listen to my shadowing attempts from last week, yesterday, and today for the same sentence, so that I can notice my improvement in fluency and pitch.

## Workflow
1. User shadows a line (existing flow).
2. Each attempt is saved with recording, scores, timestamp.
3. On the shadowing UI for a specific line, a "History" panel shows a timeline of attempts.
4. User can play any previous recording, see waveform and pitch contour comparison with original.
5. Option to share/compare with friends (future).

## UI / UX
- Mini timeline with play buttons for each attempt.
- Waveform visualization with pitch overlay (differentiator #1).
- Score trend chart (pronunciation, rhythm) over attempts.

## Technical Design
- Existing `shadowing_sessions` table already stores per-line attempts. Ensure recording URL and scores are stored.
- Build a UI component `ShadowingHistory` that fetches all sessions for a given line.
- Audio playback from Supabase Storage.
- Pitch contour generation uses F0 extraction (pre-computed or real-time with Web Audio API). Contour stored as JSON points.

## Database Impact
- No new tables, but ensure `shadowing_sessions` has fields: `pitch_data jsonb`, `recording_duration`.
- Migration risk: Low.

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/shadowing/history?line_id=` | Returns list of attempts for that line |
| GET | `/api/shadowing/attempt/:id` | Get single attempt details with pitch data |

## AI Opportunities
- AI could analyze improvement trends and suggest specific sounds to practice.

## Integration Points
- **Depends on:** Shadowing engine, audio storage.
- **Required by:** F-009 (Shadowing Challenge) can incorporate history.

## Edge Cases
- No recordings yet — empty state.
- Recording file missing — graceful error.
- Very old attempts may have different audio quality.

## Future Extensions
- Overlay multiple attempts' pitch contours for visual comparison.
- Peer review sharing.

## Priority
Medium

## Effort Estimate
M (3-5 days) — mainly UI and pitch integration.