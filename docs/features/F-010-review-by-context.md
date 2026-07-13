# Review by Context | ID: F-010

> **⚠️ No-media rule (`CLAUDE.md` §2, business-model.md §2.1).** Thẻ mining lưu **text + `{video_id, start, end}`**,
> KHÔNG lưu screenshot/audio. "Screenshot" dưới đây = **URL thumbnail YouTube** (`img.youtube.com/...`), một
> tham chiếu — không lưu ảnh vào DB/Storage. Audio = seek YouTube IFrame player, không cắt/lưu clip. Cột
> `screenshot_url` (nếu thêm) chỉ chứa URL tham chiếu, không phải blob.

## Overview
Instead of isolated flashcards, SRS review shows the exact sentence and video clip where the word appeared, reinforcing memory through context.

## Why should we build this?
The "context effect" vastly improves recall. Most SRS systems (Anki) lack rich context, leading to shallow memorization. This ties learning directly to real content.

## User Story
As a learner, when I review a vocabulary word, I want to see the original video sentence and hear that part again, so that I remember the word in the situation I encountered it.

## Workflow
1. User opens SRS review (vocab or sentence cards).
2. For a word that has linked `vocab_examples` with `source_video_id` and `transcript_line_id`, the review card displays:
   - The full sentence from the video.
   - A screenshot (thumbnail) of the video at that timestamp.
   - Play button to hear the audio segment (by seeking in YouTube player or audio snippet).
3. User rates recall as usual; SRS updated.
4. If word has multiple contexts, show the most recent or let user rotate.

## UI / UX
- Card with image background, sentence overlay, prominent audio replay.
- Minimalist but atmospheric, evoking the original video.
- Option to "View in video" to jump to that moment.

## Technical Design
- Extend `vocab_examples` table with `transcript_line_id`, `screenshot_url` (auto-generated thumbnail).
- Audio playback: generate short audio snippets (fair use) from video via server-side extraction? Risk of copyright. Instead, use YouTube IFrame player to seek to line start and play. For SRS review, embed a hidden player or use the YouTube API to control a global player. Simpler: store only the timestamp, and when reviewing, open a mini player that seeks. So no audio files saved.
- Screenshot: YouTube provides thumbnail at various points via `https://img.youtube.com/vi/<video_id>/<timestamp>.jpg` (unofficial but used by many). Or capture canvas from player (client-side).

## Database Impact
- Modify `vocab_examples` add `transcript_line_id` nullable, `screenshot_url`.
- Migration risk: Low.

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/srs/review-context?item_id=` | Returns enhanced card data with context |

## AI Opportunities
- Claude generates a short narrative connecting multiple learned words from the same video.

## Integration Points
- **Depends on:** Sentence mining (differentiator #3), SRS engine.
- **Required by:** F-003 Learning Journey could show which contexts were reviewed.

## Edge Cases
- Video removed or made private → context unavailable, fallback to normal card.
- User hasn't mined any sentences yet — standard SRS.

## Future Extensions
- Automatically mine all occurrences of a word across videos for rich context.
- Spaced context review (different contexts at different intervals).

## Priority
High

## Effort Estimate
L (1-2 weeks) — integration of video playback in SRS, screenshot generation.