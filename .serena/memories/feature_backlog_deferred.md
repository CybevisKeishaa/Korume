# Feature Backlog — mọi chức năng đã brainstorm nhưng CHƯA ship (đọc trước khi lên plan layer mới)

User mandate (2026-07-14): "không bỏ sót bất kì chức năng nào đã brainstorm". Mỗi khi plan một
layer mới (đặc biệt L8) PHẢI rà danh sách này và nói rõ item nào vào layer đó, item nào tiếp tục
hoãn + lý do. Khi ship xong một item → đánh dấu DONE tại đây kèm commit.

Phân biệt với `mem:project_status` "Deferred follow-ups": bên đó là engineering debt/nits
(a11y, hardening, cache...); bên này là CHỨC NĂNG người dùng nhìn thấy. Không trùng lặp —
tech nits vẫn đọc ở project_status.

## Nguồn: spec §3.9 (Gamification) — lược ở L6
1. **Friends leaderboard** (spec: "Leaderboard theo bạn bè"). Weekly-global-opt-in đã ship L7
   (`01ae59d`); bản THEO BẠN BÈ hoãn vô thời hạn cho tới khi có social graph thật — quyết định
   sản phẩm của user, đã ghi business-model.md §1.1 G2 (follow system kéo theo profiles/privacy/
   moderation/notifications = quyết định riêng, không phải feature leaderboard). Trigger xem lại:
   sau launch, khi community có traction.
2. **Push notification + Email reminders** (spec: "Nhắc học đúng giờ dựa trên lịch SRS đến hạn
   (push notification / email)"). L6 chỉ ship in-app. Kiến trúc sẵn: emit/deliver split trong
   `lib/notifications` — thêm push/email = viết deliverer mới, zero thay đổi business logic.
   Đi kèm bắt buộc với item 3. Target đề xuất: L8 hoặc ngay sau (cần cron/scheduler trên
   almostgone.vn; nhớ G3 — không FOMO copy).
3. **`srs_due` notification producer** — schema có type này từ migration 13 nhưng chưa có gì
   sinh ra nó (UI tự tính due count lúc render). Cần scheduler quét lịch SRS. Làm cùng item 2.
4. **Badge icons** — `badges.icon_url` toàn null, UI đang SVG fallback. Việc content/design,
   không phải code. Có thể làm bất kỳ lúc nào.

## Nguồn: CLAUDE.md §2 — nợ từ L1 (ƯU TIÊN CAO NHẤT trong list này)
5. **GDPR "delete all my data"** — là NON-NEGOTIABLE §2, hoãn từ Layer 1 tới giờ. PHẢI ship
   trước khi mở cho user thật (khớp tự nhiên với L8 khi làm billing/account). Bao gồm: xoá
   recordings trong storage, mọi bảng user-owned, xp_events, notifications, peer shares/reviews
   (cascade đã có), forum content (user_id set null đã có sẵn trong schema).

## Nguồn: L4 (AI features)
6. **Persist voice-mode pronunciation score** — cột `conversation_messages.pronunciation_score`
   tồn tại nhưng cố ý chưa nối (hiện chỉ best-effort client-side). Việc nhỏ.
7. **Human-review/publish gate cho content `source='ai_generated'`** — đã được HẤP THỤ vào
   Knowledge Economy quality gate của L8 (business-model: verified flag + report-error + AI
   label visible; một lần cache sai = phục vụ sai cho tất cả). Không làm riêng — làm trong L8.

## Nguồn: L5 (JLPT + Reading)
8. **"Add to flashcard" từ reading passages** — đang DISABLED vì `/api/mining` đòi `lineId` FK
   vào transcript_lines (video-only). Cần generalize schema mining: nullable lineId + source
   discriminator. Khớp F-010/F-014 trong docs/features. Nhớ §2: mining không lưu media.
9. **Listening drill module riêng** — weakness links của JLPT hiện route tạm về
   `/videos?level=`. Spec không bắt buộc module riêng nhưng đã bàn là gap.
10. **VN-localize English shell (i18n site-wide)** — ✅✅ **DONE + MERGED vào master `--no-ff` `d7b158c`
    (2026-07-24).** Cả 3 Plan L9a xong: Plan 1 (kiến trúc next-intl, đã merge `69f22e6`) · Plan 2 (design
    system, đã merge `fcd35af`) · Plan 3 (trích 21 namespace + bản dịch VN đầy đủ + metadata per-page,
    Tasks 1–19, merge `d7b158c`). Toàn shell giờ chạy VN dưới `/vi` và EN dưới `/en`.
    Baseline khi đóng Plan 3: tsc 0 · vitest **1731/1731 / 202 files** · lint exit 0 · build OK (25 trang
    SSG per-locale) · e2e 5/5 (sau khi `npx supabase db reset` migrate+seed DB local).
    Launch VN-first (spec §8). Chưa push lên origin (never push unasked). **Mục này đã đóng hoàn toàn.**

## Nguồn: L7 (Community + Admin)
11. **`rejected` video status + persist lý do reject** — hiện reject = HARD DELETE, reason chỉ
    log không lưu. Cần migration (enum value + cột reason) nếu muốn moderation tử tế. Cùng lúc:
    `transcript_source` thêm giá trị `'admin'` (hiện admin-attach lưu là 'user_submitted').
    **✅ RESOLVED DIFFERENTLY** — Shadowing Hub Lesson Workspace Plan B: PRIVATE lessons block no one, so there is no more approval gate to reject FROM. `rejectVideo` (hard-delete) is kept as an admin housekeeping action on unpublished lessons, not a moderation gate.
12. **CSV import cho nested children** (kanji readings, jlpt/reading questions) — hiện chỉ
    import flat rows, children phải qua JSON create/update. Nâng cấp khi admin nhập liệu nhiều.

## Nguồn: business-model.md §8 (đã track sẵn trong `mem:monetization_brainstorm` — nhắc lại để đủ bộ)
13. L8 core: PayOS subscription/renewal + Founding price-lock, per-user Knowledge-Gen quota
    (số cụ thể chưa chốt), global kill-switch TỰ ĐỘNG (hiện chỉ có spend-cap thủ công), Knowledge
    Economy cache (sentence-fingerprint per-section), model tiering Haiku/Opus, Contextual
    Discovery UI (🔒 vs ⏳), sample weekly report, Study Replay. Extensions sau: referrals, B2B,
    teacher plans, marketplace.

## Nguồn: Product Readiness Audit 2026-07-14 (`mem:product_readiness_audit_2026-07-14`) — LỌT SỔ từ L3/spec
14. **User transcript ingestion UI** — CRITICAL. Backend hoàn chỉnh từ L3 (`POST
    /api/videos/[id]/transcript`, owner RLS) nhưng UI cho user CHƯA TỒN TẠI (shadowing panel
    ghi "Transcript submission is coming soon"). User import video xong là đường cụt; chỉ
    admin attach được. Chặn toàn bộ core loop cho user thật. Deferred ở L3 mà không vào
    backlog = đúng loại lỗi mandate này sinh ra để chặn. Fix TRƯỚC L8.
    **✅ DONE** — superseded by the Create Lesson pipeline (Shadowing Hub Lesson Workspace Plan B, merged with final backend commits). Caption auto-fetch (YouTube timedtext) replaces the old "coming soon" ingestion panel; manual paste (admin SRT attach) still exists unchanged.
15. **Dictionary meanings khi tap-to-lookup** — reading popover chỉ hiện word+reading (không
    có nghĩa); mine popover không hiện nghĩa. Chưa có nguồn dictionary (JMdict/own vocab
    join). Khớp F-010/adaptive furigana. Spec §5 "tap từ để tra" ngầm định có nghĩa.
16. **Sentence-level grammar analysis / particle highlighting** — spec motion-engineer
    differentiator ("Highlight particles with color + role arrows") chưa build ở đâu;
    /grammar chỉ là thư viện tĩnh.

## Nguồn: shadowing-practice-figma-reconciliation-design (2026-08-01) — final whole-branch review
17. **`docs/product/domain-model.md` cần rewrite Learning Mode / View Mode** — file này đứng cao hơn
    screen spec trong Authority Order (`design-reconciliation.md`) nhưng vẫn định nghĩa Learning Mode
    = Shadowing/Pronunciation/Dictation/Summary và mô tả View Mode như đang tồn tại — cả hai đều đã
    bị retire/rename bởi `docs/superpowers/specs/2026-08-01-shadowing-practice-figma-reconciliation-design.md`
    §1/§2. Đã gắn marker "⚠ Superseded" inline tại 2 dòng đó để không còn mâu thuẫn ngầm, nhưng file
    cần một lần rewrite đầy đủ (không chỉ patch dòng) để khớp lại với mô hình Learning Mode /
    Reading Settings / Analysis hiện tại — chưa làm ở fix wave này, chỉ đánh dấu.
18. **`docs/design/patterns/reading-patterns.md` § Reading Modes cần restructure** — Guided /
    Shadowing / Immersion / Analysis Reading vẫn mô tả trục display-style đã bị retire (cùng đợt với
    View Mode). Khác với 11 chỗ "Dictation" → "Listening Practice" (chỉ đổi tên cơ học), chỗ này cần
    restructure thật sự nên nằm ngoài phạm vi fix wave 2026-08-01 — cố tình không đụng vào
    `reading-patterns.md:5` hay § Reading Modes trong lần fix này.

## Đã trả nợ (để đối chiếu, không cần làm lại)
- Weekly leaderboard (L6→L7, ship `01ae59d`, opt-in + own-week-first).
- Leaderboard đặt ở L7 thay vì L6 = đúng kế hoạch G2, không phải bỏ sót.
- Flaky test L6 = pitch-contour waitFor, đã fix trong L7.
