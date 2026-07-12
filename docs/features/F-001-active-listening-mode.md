# Active Listening Mode | ID: F-001

## Overview
A dictation-based listening challenge where users hear a line from a video, type what they hear, and then see the correct transcript with errors highlighted. It gamifies listening comprehension.

## Why should we build this?
Existing dictation mode is passive typing; this mode forces active recall and immediate error feedback. It’s a core differentiator missing from Duolingo/WaniKani. Improves listening skill, especially for Japanese pitch and reduced forms.

## User Story
As a learner, I want to test my listening by typing out what I hear from a video clip so that I can see exactly which words I misheard and improve my ear for Japanese.

## Workflow
1. User opens a video and switches to "Listening Mode".
2. System hides transcript, plays a selected line (or a random line) from the transcript.
3. User types what they hear and submits.
4. System shows the original transcript line with:
   - Exact matches in green.
   - Partially correct matches in yellow (e.g., wrong kanji but correct reading).
   - Wrong/missing words in red.
5. Optionally, playback the original audio again, highlighting the erroneous parts.
6. Score based on word-level accuracy; data feeds into Personalized Weakness (F-007) and SRS.
7. User can move to next line or replay the same.

## UI / UX
- "Listening Challenge" button next to Dictation/Shadowing tabs.
- Minimal UI: waveform of audio, input field, submit button.
- After submission, a side-by-side comparison with color-coded transcript.
- Gamified elements: streak, accuracy %, XP.
- Responsive and accessible (keyboard submit, clear labels).

## Technical Design
- Use transcript line timestamps from `transcript_lines` table to extract audio segment via YouTube IFrame Player API (seek to start, mute, play until end — audio captured via Web Audio API or just rely on player for playback; user listens through device audio, no audio extraction needed). Actually, to get precise audio chunk for playback, we can use the YouTube player to seek to start, but for repetition we just control player. So the challenge flow: player seeks to line start, plays, then pauses. User types. No need for audio file extraction.
- Comparison algorithm: 
  - Tokenize both reference and user input (using MeCab on backend or simple tokenization).
  - Align sequences using dynamic programming (Levenshtein distance) to identify correct/partial/incorrect words.
  - Return mapping for highlighting.
- Store result in `listening_attempts` table.

## Database Impact
- **New table:** `listening_attempts`
  - `id`, `user_id`, `video_id`, `transcript_line_id`, `user_input`, `accuracy_score`, `word_level_results jsonb`, `created_at`
- Migration risk: Low (new table only).

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/listening/submit` | Submit user input for a line, get scored result |
| GET  | `/api/listening/stats?video_id=` | Retrieve user stats for a video |

## AI Opportunities
- Use Claude to analyze frequent error patterns and suggest specific listening drills.
- Pronunciation assessment integration to score accent if user reads aloud (future).

## Integration Points
- **Depends on:** F-002 (Unknown Word Heatmap for error visualization), transcript data (Layer 3)
- **Required by:** F-007 (Personalized Weakness) uses listening errors to identify grammar/vocab weaknesses.

## Edge Cases
- Line with no Japanese text (e.g., music, silence) — skip or prompt to choose another.
- User input partially in romaji — normalize to kana/kanji using IME or backend conversion before comparison.
- Very long lines — break into clauses or allow partial submission.
- No transcript available — mode disabled.

## Future Extensions
- Adaptive difficulty: lines chosen based on user's known vocabulary (i+1).
- Real-time speech input instead of typing (voice dictation).
- Multiplayer listening battle.

## Priority
High

## Effort Estimate
M (3-5 days) — includes alignment algorithm, UI, API.