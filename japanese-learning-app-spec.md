# Nihongo Cinema — Product & Technical Specification

> Web học tiếng Nhật qua video (shadowing/dictation), kanji, vocab, grammar, JLPT — với UI cinematic/scroll-driven làm điểm khác biệt. Tài liệu này là spec đầy đủ cho toàn bộ sản phẩm, dùng làm input cho Claude Code.

> **⚠️ Reconciliation note (cập nhật 2026-07-13).** Một số quyết định về **thị trường & monetization** trong
> spec này đã bị **thay thế** bởi `japan-web/docs/product/business-model.md` (nguồn chân lý hiện tại):
> **thị trường Việt Nam only · PayOS (KHÔNG Stripe) · free-first · KHÔNG trial 7 ngày** (thay bằng
> Contextual Discovery). Các mục bị ảnh hưởng: **§1 Payment, §3.12, §6 (Stripe), §8 (i18n/GDPR-EU)** — đọc
> business-model.md khi có xung đột. Ngoài ra, quy tắc **sentence mining KHÔNG lưu media** trong
> `japan-web/CLAUDE.md` §2 chi phối **§10.3**: thẻ mining chỉ lưu text + `{video_id, start, end}`, KHÔNG lưu
> screenshot/audio clip. Deploy: **self-host tại almostgone.vn** (1 Node instance chạy liên tục), không dùng Vercel.

> **⚠️ Implementation note — pre-release (cập nhật 2026-07-16).** Tầng AI đã được làm
> **provider-agnostic**: code ứng dụng nói qua port (`japan-web/lib/ai/port.ts`), adapter của từng
> provider nằm trong `lib/ai/providers/`, và lint chặn mọi import SDK ở nơi khác. Provider được chọn
> **tường minh** qua `AI_PROVIDER`/`SPEECH_PROVIDER`/`APP_ENV`, **không bao giờ suy ra từ việc key nào
> đang có**. Chi tiết: `japan-web/docs/superpowers/specs/2026-07-15-ai-provider-abstraction-design.md`.
>
> **Việc dùng Gemini trong giai đoạn phát triển chỉ nhằm tối ưu chi phí trước khi phát hành. Đây
> KHÔNG phải thay đổi về phạm vi hay định hướng sản phẩm.** Mọi capability định nghĩa trong spec này
> (reasoning, structured output, prompt caching, model tiering, Knowledge Economy, v.v.) **vẫn là mục
> tiêu bắt buộc của production**. Kiến trúc AI phải giữ tính provider-agnostic, và **không được thu
> hẹp API/port hoặc loại bỏ capability chỉ để phù hợp với một provider tạm thời**. Nếu một provider
> chưa hỗ trợ đầy đủ, phần thiếu là **implementation gap của provider đó, không phải thay đổi yêu cầu
> của sản phẩm** — nó được khai báo trung thực và báo cáo, không được im lặng bỏ qua.
>
> Gemini là **dev-only**: free tier của nó cho phép train trên dữ liệu gửi lên, nên dữ liệu người dùng
> thật không bao giờ được chạm tới nó (`japan-web/CLAUDE.md` §2). `APP_ENV=production` + Gemini **fail
> ngay lúc khởi động**, có chủ đích.

---

## 0. Nguyên tắc bắt buộc (đọc trước khi code)

1. **KHÔNG bao giờ tải/host lại video từ YouTube hoặc bất kỳ nền tảng nào khác.** Video luôn phát qua YouTube IFrame Player API chính thức. Server chỉ lưu: video ID, metadata, transcript/phụ đề (do người dùng nhập tay, do AI tự sinh từ audio public, hoặc lấy qua YouTube Captions API nếu kênh cho phép), và dữ liệu học tập của người dùng (điểm số, ghi âm của chính họ).
2. **Ghi âm shadowing của người dùng thuộc về người dùng**, không public mặc định, không dùng để train model nếu chưa có consent rõ ràng.
3. Toàn bộ nội dung học thuật tự biên soạn (kanji, vocab, ngữ pháp, đề JLPT mẫu) phải là **nội dung gốc**, không copy nguyên văn từ site khác.
4. Ưu tiên accessibility và responsive — đây là sản phẩm học tập, không phải landing page trình diễn, nên animation phải phục vụ UX, không cản trở việc học (không autoplay animation nặng trong lúc học, có toggle "reduce motion").

---

## 1. Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Animation**: GSAP + ScrollTrigger, Lenis (smooth scroll), Framer Motion cho micro-interactions
- **Backend**: Next.js API Routes hoặc tách riêng NestJS nếu cần scale (khuyến nghị bắt đầu bằng Next.js API Routes cho đơn giản)
- **Database**: PostgreSQL (Supabase hoặc Neon để có sẵn Auth + Storage)
- **Auth**: NextAuth.js / Supabase Auth (email, Google OAuth)
- **Audio processing**: Web Audio API (client-side, waveform + so sánh nhịp)
- **Speech-to-text / Pronunciation scoring**: Azure Speech Pronunciation Assessment API (hỗ trợ tiếng Nhật) hoặc Google Cloud Speech-to-Text làm fallback
- **AI chấm/gợi ý cá nhân hóa** (sinh câu ví dụ, chatbot luyện hội thoại, tóm tắt video, gợi ý ôn tập): ~~Anthropic API (Claude)~~ → **provider-agnostic qua port** (`lib/ai/port.ts`), provider chọn tường minh bằng `AI_PROVIDER`. Production = provider trả phí (Anthropic); Gemini = dev-only, tối ưu chi phí pre-release. **Capability yêu cầu không đổi theo provider** — xem Implementation note ở đầu file.
- **Video**: YouTube IFrame Player API (KHÔNG dùng youtube-dl hay bất kỳ tool tải video nào)
- **SRS engine**: thuật toán kiểu SM-2 (SuperMemo 2) tự cài, lưu trạng thái theo user+item
- **File storage**: Supabase Storage / S3 (chỉ lưu ghi âm người dùng, ảnh avatar, không lưu video)
- **Deployment**: **self-host tại almostgone.vn** (1 Node instance chạy liên tục, KHÔNG Vercel), Supabase/Neon (DB)
- **Payment** (cho gói Premium): ~~Stripe~~ → **PayOS** (VN-only; Stripe không dùng được ở VN). Xem `docs/product/business-model.md` §0.

---

## 2. Kiến trúc thư mục đề xuất (Next.js App Router)

```
/app
  /(marketing)          -> landing page, pricing, about (cinematic scroll)
  /(auth)                -> login, register, onboarding
  /(app)
    /dashboard
    /kanji
    /vocab
    /grammar
    /videos
      /[videoId]/shadowing
      /[videoId]/dictation
    /reading
    /speaking
    /jlpt-test
    /community
    /profile
  /(admin)
    /content-manager      -> quản lý kanji/vocab/grammar/đề thi
    /video-curator        -> duyệt & gắn transcript cho video mới
/api
  /auth
  /kanji
  /vocab
  /grammar
  /videos
  /shadowing
  /dictation
  /pronunciation
  /jlpt
  /srs
  /community
  /admin
/lib
  /srs-engine
  /youtube
  /speech-scoring
  /ai (Claude API wrapper)
/components
  /motion            -> các component animation dùng chung
  /learning
  /video-player
```

---

## 3. Danh sách tính năng đầy đủ theo module

### 3.1 Auth & Onboarding
- Đăng ký/đăng nhập (email + Google OAuth)
- Onboarding: chọn trình độ hiện tại (placement quiz ngắn 10 câu), mục tiêu học (giao tiếp / JLPT / công việc), thời gian học mỗi ngày
- Hồ sơ cá nhân: avatar, streak, level, thống kê học tập

### 3.2 Kanji Module
- Danh sách kanji theo cấp độ N5–N1, theo bộ thủ (radical), theo tần suất sử dụng
- **Stroke-order animation** cho từng chữ (SVG animate, vẽ đúng thứ tự nét)
- Radical breakdown trực quan (tô màu từng bộ phận cấu thành chữ)
- Mnemonic có minh họa động (hình ảnh liên tưởng chuyển động nhẹ, không phải ảnh tĩnh)
- Bài tập: nhận diện, viết tay (canvas vẽ tay + so khớp nét), ghép nghĩa
- SRS riêng cho kanji (tách khỏi vocab SRS vì tần suất ôn khác nhau)

### 3.3 Vocabulary Module
- Từ vựng gắn theo JLPT level, có audio phát âm (TTS hoặc thu âm người bản ngữ)
- Ví dụ câu theo ngữ cảnh (sinh bằng AI, có review thủ công trước khi publish)
- Flashcard SRS (thuật toán SM-2), có thể tạo bộ từ tùy chỉnh
- Từ vựng tự động thu thập từ video đã học (liên kết với module Video)

### 3.4 Grammar Module
- Bài học ngữ pháp theo cấp độ, có animation minh họa cấu trúc câu (particle đổi màu, mũi tên vai trò)
- So sánh các mẫu ngữ pháp dễ nhầm (side-by-side)
- Bài tập: điền từ, sắp xếp câu, trắc nghiệm, tự luận ngắn (AI chấm)

### 3.5 Video Learning & Shadowing (module lõi)
- **Import video**: user paste YouTube URL → hệ thống lấy metadata (title, duration, thumbnail) qua YouTube Data API
- **Transcript**: 
  - Nếu kênh có captions tiếng Nhật → lấy qua YouTube Captions API (chỉ khi được phép)
  - Nếu không có → cho phép user tự nhập/dán transcript, hoặc dùng Speech-to-Text để tự sinh (có cảnh báo "AI-generated, có thể sai")
- **Player tương tác**: transcript hiện song song video (đồng bộ theo timestamp), click câu để nhảy tới đoạn đó
- **Chế độ Shadowing**: lặp đoạn A-B, chỉnh tốc độ phát (0.5x–1.25x), ghi âm giọng đọc của user, hiển thị waveform so sánh với audio gốc, chấm điểm nhịp điệu bằng Pronunciation Assessment API
- **Chế độ Dictation**: nghe và gõ lại, so khớp text, chỉ ra chỗ sai
- **Furigana toggle**, **dịch nghĩa toggle** theo câu
- **Tra từ nhanh**: tap vào từ trong transcript → hiện nghĩa, thêm vào flashcard ngay
- **Playlist cá nhân**: lưu video theo chủ đề/mục tiêu
- **AI tóm tắt video**: tóm tắt nội dung + liệt kê từ vựng/ngữ pháp trọng tâm xuất hiện trong video

### 3.6 Speaking & Conversation Practice
- Chatbot hội thoại tiếng Nhật (dùng Claude API), có thể chọn tình huống (nhà hàng, phỏng vấn, mua sắm...)
- Chấm phát âm cho từng câu nói qua Pronunciation Assessment API
- Lưu lịch sử hội thoại, gợi ý sửa lỗi ngữ pháp sau mỗi phiên

### 3.7 Reading Module
- Bài đọc theo cấp độ, furigana toggle, tra từ tap-to-lookup
- Nội dung: tự biên soạn hoặc dùng nguồn public/open license (vd NHK Easy — cần kiểm tra điều khoản trước khi nhúng/link)
- Câu hỏi đọc hiểu sau mỗi bài, chấm tự động

### 3.8 JLPT Mock Test
- Đề thi thử N5–N1 theo đúng format (Vocab/Grammar/Reading, Listening)
- Chấm điểm tự động, quy đổi thang điểm gần đúng JLPT thật
- Thống kê điểm yếu theo dạng câu, gợi ý bài ôn tập tương ứng

### 3.9 Gamification
- XP, level, streak (giữ chuỗi ngày học liên tục)
- Leaderboard theo bạn bè / theo tuần
- Badge/achievement theo cột mốc (100 kanji, 30 ngày streak, hoàn thành N4 mock test...)
- Nhắc học đúng giờ dựa trên lịch SRS đến hạn (push notification / email)

### 3.10 Community (giai đoạn sau, không bắt buộc launch đầu tiên nhưng đưa vào schema từ đầu)
- Forum hỏi đáp theo chủ đề
- Ghép cặp luyện shadowing (peer review giọng đọc)
- Chia sẻ playlist video công khai

### 3.11 Admin / Content Management
- CMS quản lý kanji, vocab, grammar, đề JLPT (CRUD, import CSV hàng loạt)
- Duyệt video mới được cộng đồng đề xuất, gắn transcript chuẩn
- Dashboard thống kê user, retention, revenue

### 3.12 Monetization
> **⚠️ SUPERSEDED bởi `docs/product/business-model.md`.** Mô hình dưới đây (Stripe + trial 7 ngày +
> "giới hạn video/ngày") KHÔNG còn đúng. Chốt hiện tại: **free-first, core loop free & unlimited**; premium
> (JapanWeb+) mở khóa *intelligence AI-authored trên data của bạn*, KHÔNG khóa core loop; **PayOS**;
> **không trial** (conversion = Contextual Discovery); giá 49k/490k/39k founding. Chi tiết ở business-model.md §2/§5/§6.

- ~~Free tier: giới hạn số video/ngày, số lần chấm phát âm AI/ngày~~ → core loop free & unlimited; chỉ metered việc *tạo* knowledge mới (quota Knowledge Generation). **Cập nhật 2026-07-31:** "free & unlimited" chỉ đúng cho *core loop bên trong một Lesson đã mở* (Reading → Shadowing → Pronunciation → Dictation → Mining → Review) — độ rộng thư viện (Free chỉ mở lessons `FREE`-tier) và số Lesson tự tạo mỗi tháng (Free giới hạn 3/tháng) KHÔNG nằm trong "unlimited" này. Xem `docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §3.4.
- Premium (JapanWeb+): full cascade deep, AI Sensei memory/coaching, Azure pronunciation, conversation, full JLPT mock
- ~~Stripe subscription, trial 7 ngày~~ → **PayOS**, không trial

---

## 4. Database Schema (các bảng chính)

```sql
-- Users
users (id, email, password_hash, name, avatar_url, level, target_goal, daily_minutes, created_at)
user_stats (user_id, xp, streak_current, streak_longest, last_active_date)

-- Kanji
kanji (id, character, jlpt_level, stroke_count, radical_id, meaning_en, meaning_vi, stroke_order_svg, mnemonic_text, mnemonic_image_url)
kanji_readings (id, kanji_id, reading, reading_type[on/kun])
user_kanji_progress (user_id, kanji_id, srs_stage, next_review_at, ease_factor, last_reviewed_at)

-- Vocabulary
vocab (id, word, reading, meaning_en, meaning_vi, jlpt_level, audio_url, part_of_speech)
vocab_examples (id, vocab_id, sentence_jp, sentence_translation, source_video_id nullable)
user_vocab_progress (user_id, vocab_id, srs_stage, next_review_at, ease_factor)

-- Grammar
grammar_points (id, title, jlpt_level, explanation, structure_pattern, example_sentences jsonb)
user_grammar_progress (user_id, grammar_id, mastery_score, last_practiced_at)

-- Videos
videos (id, youtube_video_id, title, duration_seconds, thumbnail_url, jlpt_level_estimate, added_by_user_id, status[pending/approved])
transcripts (id, video_id, source[youtube_caption/user_submitted/ai_generated], language)
transcript_lines (id, transcript_id, start_time, end_time, text_jp, text_translation, furigana_json)
user_video_progress (user_id, video_id, last_watched_position, completed_at)
user_playlists (id, user_id, name)
user_playlist_items (playlist_id, video_id, order_index)

-- Shadowing & Dictation
shadowing_sessions (id, user_id, video_id, transcript_line_id, recording_url, pronunciation_score, rhythm_score, created_at)
dictation_attempts (id, user_id, video_id, transcript_line_id, user_input, accuracy_score, created_at)

-- Speaking practice
conversation_sessions (id, user_id, scenario_type, started_at, ended_at)
conversation_messages (id, session_id, role[user/ai], content, pronunciation_score nullable, created_at)

-- JLPT
jlpt_tests (id, level, title, section_config jsonb)
jlpt_questions (id, test_id, section[vocab/grammar/reading/listening], question_data jsonb, correct_answer)
user_test_attempts (id, user_id, test_id, score, section_scores jsonb, completed_at)

-- Gamification
badges (id, name, description, icon_url, criteria jsonb)
user_badges (user_id, badge_id, earned_at)

-- Community
forum_posts (id, user_id, title, content, created_at)
forum_comments (id, post_id, user_id, content, created_at)

-- Billing (PayOS — Stripe superseded, xem docs/product/business-model.md §0)
-- PayOS KHÔNG có khái niệm "customer" thường trực như Stripe: mỗi lần thu tiền là một
-- payment link mang `orderCode` riêng. Vì vậy không có cột `stripe_customer_id` tương đương.
-- Cách liên kết giao dịch PayOS ↔ subscription (và renewal + price-lock cho Founding Member)
-- là open follow-up, chốt khi lập kế hoạch Layer 8 — business-model.md §8.
subscriptions (id, user_id, plan, status, current_period_end)
```

---

## 5. API Endpoints chính (REST)

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/kanji?level=N5
GET    /api/kanji/:id
POST   /api/srs/review          { itemType, itemId, quality }  -> cập nhật SM-2
GET    /api/vocab?level=N4
GET    /api/grammar?level=N3
POST   /api/videos/import        { youtubeUrl }  -> lấy metadata + trigger transcript pipeline
GET    /api/videos/:id/transcript
POST   /api/shadowing/session     { videoId, lineId, recordingBlob }
POST   /api/dictation/attempt     { videoId, lineId, userInput }
POST   /api/pronunciation/score   { audioBlob, referenceText }
POST   /api/conversation/message  { sessionId, message }  -> gọi Claude API
GET    /api/jlpt/tests?level=N3
POST   /api/jlpt/tests/:id/submit
GET    /api/user/stats
GET    /api/admin/videos/pending
POST   /api/admin/videos/:id/approve
```

---

## 6. Tích hợp bên thứ ba cần đăng ký key trước khi code

| Dịch vụ | Mục đích | Ghi chú |
|---|---|---|
| YouTube Data API v3 | Lấy metadata video | Free quota giới hạn/ngày |
| YouTube IFrame Player API | Nhúng player | Không cần key |
| Azure Cognitive Services Speech | Pronunciation Assessment tiếng Nhật | Có free tier |
| AI provider (qua port, chọn bằng `AI_PROVIDER`) | Chatbot hội thoại, tóm tắt video, sinh câu ví dụ | ~~Đã có sẵn qua tài khoản hiện tại~~ — **KHÔNG đúng: hiện chưa có `ANTHROPIC_API_KEY`** (audit 2026-07-14). Vì vậy almostgone.vn launch với `AI_PROVIDER=none` (production deploy được, toàn bộ AI tắt có chủ đích) cho tới khi mua key. Gemini free = dev-only, không chạm dữ liệu người dùng thật |
| ~~Stripe~~ **PayOS** | Thanh toán subscription (VN-only) | Stripe không dùng được ở VN — dùng PayOS. Xem business-model.md §0 |
| Supabase / Neon | DB + Auth + Storage | Free tier đủ cho giai đoạn đầu |

---

## 7. Thứ tự triển khai đề xuất (để Claude Code build ổn định, KHÔNG phải cắt tính năng)

Vì scope là "sản phẩm hoàn chỉnh", cách hiệu quả nhất khi làm việc với Claude Code là **build đúng toàn bộ kiến trúc trên nhưng theo từng lớp**, để mỗi lớp có thể test được trước khi lớp sau phụ thuộc vào nó. Đây không phải MVP cắt giảm — mọi module ở trên đều nằm trong scope cuối cùng.

**Lớp 1 — Nền tảng**: DB schema đầy đủ (toàn bộ bảng ở mục 4) + Auth + layout chính + design system (màu, typography, component motion dùng chung).

**Lớp 2 — Nội dung tĩnh**: Kanji module + Vocab module + Grammar module + SRS engine (đây là phần không phụ thuộc video, làm trước để có thể test SRS logic độc lập).

**Lớp 3 — Video/Shadowing (module lõi, phức tạp nhất)**: YouTube import → transcript pipeline → player đồng bộ → shadowing recording + waveform → dictation.

**Lớp 4 — AI features**: Pronunciation scoring integration, Conversation chatbot, AI tóm tắt video, AI sinh ví dụ câu.

**Lớp 5 — JLPT test engine + Reading module**.

**Lớp 6 — Gamification + Notification**.

**Lớp 7 — Community + Admin CMS**.

**Lớp 8 — Billing/Subscription + polish animation toàn site + performance audit**.

Khi đưa cho Claude Code, nên feed từng Lớp trong 1 phiên làm việc riêng (không paste toàn bộ 8 lớp vào 1 lần chạy), vì agent code chất lượng tốt hơn khi có phạm vi rõ ràng để tự test trước khi qua lớp tiếp theo — nhưng toàn bộ 8 lớp cộng lại chính là sản phẩm hoàn chỉnh trong tài liệu này, không thiếu tính năng nào.

---

## 8. Non-functional requirements

- **Performance**: Lighthouse score > 90 cho trang marketing; video player load lazy, không block main thread khi chạy GSAP animation
- **Accessibility**: toggle "reduce motion", contrast đạt WCAG AA, keyboard navigation cho toàn bộ flow học tập
- **i18n**: **Việt Nam-first** — UI tiếng Việt là ưu tiên duy nhất cho launch (business-model.md: no international GTM yet). Tiếng Anh để sau khi có traction. (Spec gốc: "VN + EN, target cả quốc tế" — đã điều chỉnh.)
- **Security**: rate limit API chấm điểm AI (tránh lạm dụng quota), validate input transcript để tránh XSS khi hiển thị nội dung user submit. **Phòng thủ chi phí AI 3 lớp** (business-model.md §4.2): global daily kill-switch → per-user Knowledge-Gen quota → free tier trên $0-marginal features.
- **Privacy**: ghi âm giọng nói user mã hóa khi lưu trữ, có chức năng xóa toàn bộ dữ liệu cá nhân (GDPR-friendly). *Lưu ý:* target là **VN-only**, không phải EU (spec gốc ghi "target EU" — không còn đúng); giữ delete-my-data như cam kết quyền sở hữu dữ liệu (business-model.md nguyên tắc 2), không vì lý do EU.

---

## 9. Ghi chú UX/Motion (thế mạnh của founder, cần tận dụng)

- Trang landing/marketing: dùng scroll-scrubbed storytelling để demo trực tiếp tính năng shadowing ngay trên landing page (video minh họa tự chạy theo scroll).
- Trong app học tập: animation phải nhẹ, nhanh, có mục đích (feedback khi đúng/sai, transition giữa card ôn tập) — không dùng animation nặng kiểu cinematic ở đây vì sẽ làm chậm luồng học tập lặp lại nhiều lần trong ngày.
- Stroke-order kanji và grammar particle highlight là 2 chỗ nên đầu tư animation kỹ nhất vì đây là differentiator chính so với Duolingo/WaniKani/Corodomo.

---

## 10. Tính năng khác biệt bổ sung (đã chốt — đánh vào nỗi đau người dùng)

Những tính năng dưới đây được bổ sung sau khi rà soát khoảng trống của Duolingo/WaniKani/Anki/Bunpro.
Chúng là **first-class**, không phải add-on, và được tham chiếu trong `CLAUDE.md` §5.

1. **Pitch accent visualization (差別化 #1)** — trích đường F0 (pitch contour) từ audio gốc và giọng
   ghi âm của user, vẽ chồng lên nhau và chấm ngữ điệu. Nằm trong luồng shadowing. Owner: `ai-engineer`
   (F0/scoring, `/lib/pitch`) + `motion-engineer` (render contour). Bảng: thêm `pitch_score` vào
   `shadowing_sessions`.
2. **Gợi ý i+1 (comprehensible input)** — máy giữ chân người dùng. Chấm mỗi video theo % từ user đã
   biết (từ data SRS) và tiến cử nội dung đúng độ khó. Owner: `backend-engineer` (`/lib/difficulty`).
3. **Sentence mining từ video** — tap 1 câu transcript → tạo thẻ SRS gồm câu + từ trọng tâm +
   con trỏ `{video_id, start, end}`. **KHÔNG lưu media** (không screenshot, không audio clip — trái
   `CLAUDE.md` §2). Khi review: seek YouTube IFrame player tới `start` để phát lại; "screenshot" nếu cần
   chỉ là URL thumbnail YouTube (tham chiếu, không lưu ảnh). Owner: `frontend-engineer` + `backend-engineer`.
   *(Spec gốc ghi "lưu audio clip đã cắt" — đã sửa cho khớp trạng thái đã build ở Layer 3.)*
4. **Furigana thích ứng** — chỉ hiện furigana cho từ user CHƯA master, mờ dần khi đã thuộc (không phải
   toggle bật/tắt cứng). Owner: `frontend-engineer`, dựa trên `user_vocab_progress`.
5. **Voice conversation mode** — STT (user nói) → Claude phản hồi → TTS đọc lại, chấm phát âm realtime.
   Mở rộng chatbot text ở §3.6. Owner: `ai-engineer`.
6. **Micro-module đời thường/keigo/counters/onomatopoeia** — bổ sung vào Grammar module: tiếng nói rút
   gọn (〜ちゃう, 〜んだ, じゃん), kính ngữ (敬語), trợ số từ (助数詞), giả thanh từ (オノマトペ).
   Owner: `backend-engineer` + nội dung.

Ràng buộc chung: mọi endpoint AI phải rate-limit; nội dung AI phải gắn nhãn "AI-generated"; ghi âm user
mã hóa khi lưu và không dùng train model nếu chưa có consent (xem `CLAUDE.md` §2).
