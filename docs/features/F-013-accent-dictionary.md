# Accent Dictionary | ID: F-013

## Overview
Displays pitch accent pattern (L-H, H-L, etc.) for vocabulary entries, with a visual contour and audio example. Helps learners master natural Japanese intonation.

## Why should we build this?
Pitch accent is crucial for natural Japanese but almost no popular app teaches it. It's a strong differentiator and complements shadowing/pitch scoring.

## User Story
As a learner, I want to see the pitch pattern of a word like "橋" (L-H) vs "箸" (H-L) and hear the difference, so that I can pronounce them correctly and be understood.

## Workflow
1. In vocabulary detail, a small accent diagram is shown next to the reading.
2. Diagram is a simple line graph with high/low markers, possibly animated.
3. Play button reads the word with correct pitch (TTS or native recording).
4. If pitch contour data from real speech is available, overlay real contour (from differentiator #1).
5. User can practice pronouncing and get feedback (future).

## UI / UX
- Clean, minimal accent visualization (like a tiny waveform but only pitch levels).
- Integrated into existing vocab view.

## Technical Design
- Add `pitch_pattern` column to `vocab` table (e.g., `L-H`, `H-L`, `L-H-H`). Populate from open datasets (e.g., JAccent) or manual curation.
- Store pitch contour data (optional) as JSON array of F0 values for real recordings.
- Use client-side SVG to draw the pattern based on the string.

## Database Impact
- Modify `vocab`: add `pitch_pattern VARCHAR(20)`, `pitch_contour jsonb` nullable.
- Migration risk: Medium (need data population).

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/vocab/:id/pitch` | Returns pitch pattern and contour if available |

## AI Opportunities
- AI could predict pitch patterns for words missing data using linguistic rules.

## Integration Points
- **Depends on:** Vocab module, pitch data source.
- **Required by:** Shadowing feedback could use this as reference.

## Edge Cases
- Word has multiple accepted pitch patterns — show variations.
- No data available — hide section gracefully.

## Future Extensions
- Pitch pattern quiz.
- User-recorded pitch comparison.

## Priority
Medium

## Effort Estimate
L (1-2 weeks) — mainly data collection and UI design.