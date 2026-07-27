# Tổng hợp ý tưởng sản phẩm Nihongo Cinema / AI Language OS

> Bản tổng hợp ý tưởng sản phẩm + đánh giá khả thi + đề xuất wow-feature, viết lại sau vòng trao đổi
> ngày 2026-07-26. Giữ nguyên toàn bộ ý tưởng gốc (không bỏ sót brainstorm), thêm các đoạn **> 🔍 Đánh giá**
> là nhận xét/khuyến nghị mới dựa trên trạng thái thực tế của repo và bối cảnh cạnh tranh (Corodomo).

---

## 1) Tầm nhìn sản phẩm

Sản phẩm không còn được nhìn như một app học tiếng Nhật đơn lẻ, mà đang tiến tới một **AI Language
Operating System**: một nền tảng nơi người dùng có thể mang bất kỳ nội dung tiếng Nhật nào vào, và
hệ thống sẽ biến nó thành trải nghiệm học phù hợp.

Điểm cốt lõi:
- Người dùng không phải tự đi tìm bài học.
- Người dùng chỉ cần mang nội dung họ thích đến.
- Hệ thống tự biến nội dung đó thành học liệu.
- Dữ liệu học tập tích lũy sẽ làm AI hiểu người dùng hơn theo thời gian.

Trục tư duy: **Nguồn vào → AI phân tích → học liệu → theo dõi tiến bộ → Learning Genome → cá nhân hóa sâu hơn**

> 🔍 **Đánh giá — bối cảnh cạnh tranh (mới, quan trọng nhất):** Corodomo đã đi trước với đúng lõi cơ bản —
> import video YouTube, tạo transcript, phân tích ngữ pháp, ngắt câu, luyện phát âm theo từng câu — và đã
> có người dùng thật. Nghĩa là **"học từ YouTube + transcript + ngữ pháp + luyện câu" không còn là điểm
> khác biệt**, nó là table-stakes. Tầm nhìn "AI Language OS" ở trên vẫn đúng về hướng dài hạn, nhưng câu hỏi
> thực dụng nhất bây giờ không phải "xây thêm gì" mà là "cái gì khiến người dùng đang quen Corodomo phải
> đổi app" — xem mục 5 (Đề xuất Wow Feature) để có câu trả lời cụ thể.

---

## 2) Các lớp chức năng lớn đã bàn

### 2.1. Capture / Import Layer
Nguồn đã bàn: YouTube, Manga, PDF, Website, Ảnh chụp, Camera, Telegram, Clipboard, EPUB, Podcast,
Anime, Netflix (cân nhắc nhưng vướng DRM/bản quyền, không ưu tiên), Record cuộc họp rồi tóm tắt.

Mục tiêu: giảm tối đa ma sát — không copy tay ảnh/subtitle, không đổi thói quen đọc/xem, chỉ "dán",
"kéo-thả", "chụp", hoặc "share".

> 🔍 **Đánh giá — không mở rộng nguồn capture trước khi có billing/quota.** Mỗi nguồn mới (manga, PDF,
> camera OCR, Telegram, podcast, EPUB) là một pipeline AI riêng = một mặt trận chi phí AI mới. L8
> (PayOS + per-user quota + kill-switch tự động) hiện **chưa build** và đang bị hoãn tới cuối roadmap.
> Mở nhiều nguồn trước khi có quota là rủi ro burn tiền không kiểm soát được — nên L8 (ít nhất phần
> quota/kill-switch) cần đi trước, không phải sau, việc mở rộng capture layer.
>
> **Bản quyền: áp dụng đúng tiêu chuẩn cho manga/anime/podcast như đã áp cho Netflix.** File gốc chỉ
> cảnh báo Netflix vì DRM, nhưng CLAUDE.md §3 yêu cầu mọi học liệu phải original hoặc licensed+attributed.
> OCR một trang manga có bản quyền rồi AI sinh "bài học" để phục vụ user về bản chất pháp lý không khác
> case Netflix đã tự loại — nên xếp cùng mức thận trọng, không chỉ riêng Netflix.
>
> **Ghi âm cuộc họp rồi tóm tắt — cần một quyết định rõ ràng, không nên "làm sau" mặc định.** Đây là ghi
> âm **người khác**, không chỉ giọng chính chủ (khác voice recording cho shadowing, đã được §2 CLAUDE.md
> cover). Nhiều nơi yêu cầu **all-party consent** để ghi âm hội thoại có người thứ ba. Ngoài ra đây là một
> use-case khác hẳn (business/functional Japanese cho người đi làm) so với positioning "học từ nội dung
> yêu thích" của sản phẩm — nếu làm, nên tách thành nhánh riêng (có thể B2B) chứ không phải tính năng lõi.
>
> **Telegram — hữu ích như kênh capture phụ, không phải wow anchor.** Không có tính "hiện diện" như
> extension (user phải nhớ mới dùng), và sản phẩm launch VN-first trong khi Telegram không phổ biến ở
> VN (Zalo/Messenger áp đảo) — kênh này match tốt hơn với user quốc tế, không phải nhóm launch đầu tiên.
> Xếp ưu tiên thấp, làm sau khi đã có nhiều nguồn capture khác ổn định.
>
> **Browser Extension — ứng viên tốt nhất cho "wow anchor" thuộc nhóm capture** (xem thêm mục 5).
> Lý do: nó *hiện diện liên tục* — user đang đọc tin tức/blog/Twitter tiếng Nhật bất kỳ, không cần mở
> app, engine vẫn "chiếu" ra ngoài. Đánh đổi: chi phí kỹ thuật cao nhất trong các ý tưởng capture
> (Manifest V3, build/maintain riêng, store review, rủi ro bảo mật content-script trên site tuỳ ý) —
> nên xứng đáng một spec/layer riêng, không lồng vào layer hiện tại.

### 2.2. AI Learning Pipeline
**Content → Parser → Normalize → AI Analysis → Knowledge Graph → Lesson Generator → Learning Activities**

Đầu ra đã bàn: Vocabulary, Grammar, Shadowing, Dictation, Speaking, Quiz, Flashcard, Sentence mining,
Reading support, Companion memories, Review queue.

### 2.3. Learning Engine
Vocabulary, Grammar exercises, Shadowing, Dictation, Speaking, JLPT-style quiz, Flashcard SRS,
Sentence mining, Reading support, Lesson generation, Auto review — phần "học thật" người dùng quay
lại mỗi ngày.

### 2.4. Memory / Graph Layer
Memory Graph, Knowledge Graph, Personal Knowledge Vault, Learning Timeline, Learning Journal,
Companion Memory — không chỉ lưu từ, mà lưu mối liên hệ giữa từ, câu, video, chapter, grammar,
cảm xúc, lịch sử học.

> 🔍 **Đánh giá:** Đây là nhóm **khả thi nhất để bắt đầu ngay**, vì nó mở rộng từ dữ liệu đã có sẵn
> (SRS state, Companion memories, pitch/listening scores) thay vì đòi hạ tầng capture mới. Đồng thời
> đây chính là điểm yếu cấu trúc của Corodomo nếu họ xử lý mỗi video độc lập — xem mục 5, ý #3.

### 2.5. Personal AI Layer
Learning Genome, Personal Language Twin, AI Coach, AI Companion, AI Prediction, Plateau detection,
Adaptive learning path, AI Reflection.

### 2.6. Experience / Wow Layer
Dán link YouTube → ra bài học ngay, Upload manga/PDF → ra giáo trình ngay, Chụp ảnh → OCR + giải
thích, Hover translate / learn-this, Replay hành trình học, Time machine / progress animation, AI
coach chủ động, AI biết plateau, Living knowledge.

---

## 3) Những chức năng bạn đã rõ ràng ưng / ưu tiên

### 3.1. Import YouTube là feature đầu tiên
Dễ hiểu, nhu cầu thật, nội dung vô hạn, dễ demo, dễ wow ban đầu, cửa vào đầu tiên của hệ sinh thái.
Pipeline: transcript/subtitle → tách câu → vocabulary/grammar/shadowing/dictation/quiz/flashcard →
knowledge vault → learning profile.

> 🔍 **Đánh giá:** Đã build (đây là core loop hiện tại của app). Corodomo cũng có đúng luồng này —
> không còn là điểm khác biệt, chỉ là nền tảng bắt buộc phải có tốt.

### 3.2. "Học từ mọi thứ" / Universal Learning
Positioning: không học qua khóa học cố định, mà học từ video, manga, PDF, website, ảnh, camera,
Telegram, extension.

### 3.3. Manga import / manga reader → export ra bài học
Import cả file, AI xử lý, hai mode: **Consume mode** (dịch để đọc) và **Learn mode** (biến thành bài học).

### 3.4. Browser Extension
Bôi đen câu → popup nghĩa/giải thích/lưu từ/tạo flashcard/tạo lesson/"Learn this page". Ma sát cực
thấp, học ngay nơi đang đọc. *(Xem đánh giá ở 2.1 và đề xuất ở mục 5.)*

### 3.5. Learning Genome
Mô hình mô tả cách học (nghe/đọc, hình ảnh/ngữ cảnh, quên sau bao lâu, sai ở đâu, học lúc nào tốt,
thích chủ đề gì, bỏ cuộc sau bao lâu, tốc độ đọc/nói, pitch accent, listening, grammar stability).
Tài sản lõi, lâu dài, khó sao chép.

### 3.6. Personal Language Twin
"Bản sao ngôn ngữ": vốn từ, grammar, listening, reading, speaking, pitch accent, lỗi hay mắc, sở
thích, thời gian học hiệu quả, nội dung nào khiến xem hết. Tạo cảm giác AI hiểu mình — nền móng cho
cá nhân hóa.

### 3.7. Companion / Journal / Memory
Companion như presence layer, Journal lưu memories, gifted pins, first meeting, memory-created
event, forward-looking copy. Không phải chatbot — người đồng hành có trí nhớ, xuất hiện đúng lúc,
không làm phiền core loop.

> 🔍 **Đánh giá:** Đang build dở đúng lúc (branch `layer-9b-companion-presence`, Task 4/13: producer
> `first_shadow` + `line_mastered` vừa xong, chờ review). Đây là lớp cảm xúc mà Corodomo — một app
> utility thuần túy theo mô tả — không có. Xem mục 5, ý #2.

### 3.8. Memory Graph / Knowledge Graph
Một từ nối với video, video nối với chapter manga, chapter nối với grammar, grammar nối với lỗi hay
mắc, tất cả nối về Learning Genome.

### 3.9. AI Prediction / Plateau detection
Nhận biết chững lại, loop nhiều lần, học nhưng không tiến bộ, sắp bỏ cuộc → đổi lộ trình/giảm tải/
tăng ôn tập/đổi source/đổi dạng bài.

### 3.10. AI World Simulation
Không phải chat mà sống trong thế giới ngôn ngữ. Wow cao nhưng nên đến sau khi hệ thống lõi đã có
dữ liệu tốt.

---

## 4) Những chức năng mình đã gợi ý thêm (vòng trao đổi đầu)

- **4.1 Universal Capture** — tư duy "capture" thay vì chỉ "import".
- **4.2 Hero Feature "Paste anything → lesson"** — cửa vào biểu tượng cho người dùng mới.
- **4.3 Learn-from-anything positioning** — thông điệp marketing: "biến bất kỳ nội dung tiếng Nhật
  nào thành bài học" thay vì "học tiếng Nhật bằng AI".
- **4.4 AI Reader** — manga/light novel/PDF/website/EPUB, hai mode đọc hiểu / học từ đoạn đó.
- **4.5 One-click / Zero-friction UX** — click là học, hover là giải thích, chụp là xử lý, share là import.
- **4.6 Hero Demo trên landing page** — paste link, vài giây sau ra lesson.
- **4.7 Learning Replay / Time Machine** — xem lại hành trình học, tiến bộ theo thời gian.
- **4.8 Living Knowledge** — nhớ đã gặp từ nào, ở đâu, lần thứ mấy, nguồn nào.
- **4.9 AI Coach chủ động** — phát hiện plateau/quá tải, chủ động đề nghị.
- **4.10 Personal Subtitle / Smart subtitle** — furigana, highlight từ mới/grammar, dịch tự nhiên/sát.
- **4.11 AI Time Machine / Forecast** — dự báo 30/60/90 ngày nếu tiếp tục học như hiện tại.

---

## 5) 🔍 Đề xuất Wow Feature (mới — trọng tâm sau khi biết Corodomo đã đi trước)

Đã xác nhận qua code: **pitch accent contour overlay đã tồn tại và đã wire vào
`components/video-player/shadowing-recorder-panel.tsx`** — không phải ý tưởng trên giấy. Nhưng hiện
tại nó chạy **post-hoc**: record → stop → upload → bấm "chấm điểm" → mới thấy đường contour. Đây là
chỗ có thể tạo khác biệt thật mà không cần xây subsystem hoàn toàn mới.

Corodomo (theo mô tả): import YouTube + transcript + phân tích ngữ pháp + luyện phát âm theo câu.
Đây là baseline tốt nhưng không có pitch accent contour thật, không có companion/memory, và (nhiều
khả năng) xử lý mỗi video độc lập — không có compounding knowledge giữa các video.

### 5.1. Live pitch mirror — vẽ contour NGAY trong lúc đang nói (khuyến nghị cao nhất)
Thay vì chờ ghi âm xong rồi chấm điểm, vẽ đường pitch của người dùng **real-time trong khi họ đang
nói**, chồng lên đường pitch tham chiếu. Đây là kiểu trải nghiệm "nó đang theo dõi tôi ngay lúc này"
— giống cảm giác tuner app cho guitar hay Yousician cho hát — gây ấn tượng mạnh hơn nhiều so với chờ
kết quả sau. Đòi hỏi F0 tracking độ trễ thấp chạy client-side; là nâng cấp kỹ thuật thật (không chỉ
marketing lại cái cũ), khó để đối thủ copy nhanh.

### 5.2. Companion phản hồi dựa trên chính data giọng của người dùng, không phải lời khen chung chung
Nối trực tiếp pitch-score data → AI generate câu nói cá nhân hoá, cụ thể và đúng: "từ こんにちは bạn
lên xuống tông y hệt người bản xứ" thay vì "Giỏi lắm!". Corodomo là utility thuần túy, không có nhân
vật nào "nhận ra" điều cụ thể về người dùng — đây là chỗ AI + Companion + pitch pipeline cộng lại
thành thứ khó chắp vá nhanh.

### 5.3. Compounding cross-video knowledge — đánh vào điểm yếu cấu trúc "mỗi video một bài học"
Nếu Corodomo xử lý từng video độc lập (theo mô tả), họ không có khái niệm "bạn đã gặp từ này ở video
khác rồi". Memory Graph / i+1 cho phép nói: "từ này bạn đã gặp 3 lần ở 3 video khác, đây là lần thứ
4 — sắp thuộc rồi", hoặc gợi ý video tiếp theo dựa trên từ đã biết. Không phải wow-trong-10-giây, mà
là lý do người dùng lâu năm không muốn rời — càng dùng lâu, sản phẩm càng "hiểu" họ hơn, còn app cũ
chỉ là công cụ tính năng ngang hàng.

### 5.4. (Ý phụ, rủi ro cao hơn) Chọn giọng tham chiếu theo sở thích
So sánh pitch với giọng một nhân vật/idol yêu thích thay vì giọng đọc trung tính — cảm xúc mạnh hơn
nhiều so với SGK. Cẩn thận bản quyền nếu dùng audio có sẵn của nhân vật thật (F0 extract để so sánh,
không lưu/redistribute clip, rủi ro thấp hơn nhưng chưa bằng không). Giữ ở mức ý tưởng, chưa ưu tiên.

**Khuyến nghị:** (5.1) + (5.3) là hai đòn bẩy mạnh nhất — một tạo khoảnh khắc wow tức thời (10 giây
đầu), một tạo lý do giữ chân dài hạn mà mô hình "mỗi video độc lập" của đối thủ khó vá kịp. (5.2) là
lớp cảm xúc nối hai cái trên lại, và trùng đúng với việc Companion Presence đang build dở hiện tại.

> 🔍 **Trạng thái sau review 2026-07-27:** cả ba ý (5.1 Live Pitch Mirror, 5.2 Companion phản hồi
> bằng dữ liệu thật, 5.3 Cross-video Knowledge) đã được đối chiếu với `2026-07-ai-learning-experience-
> roadmap.md` — **không bị loại**, chỉ chưa đủ chín để nằm trong roadmap hiện tại (AI Learning
> Experience layer: Detect Confusion, Learning Beats, Audio Commute, Learning Wrapped). Vẫn giữ ở
> đây như tài sản trí tuệ dài hạn: 5.1 → backlog cho module Speaking/Conversation tương lai; 5.2 →
> thực ra đã là cách Companion nói trong roadmap hiện tại (Beat checkpoint, câu cuối Learning
> Wrapped) — không cần build thêm gì riêng; 5.3 → thuộc tầng Learning Genome (chưa thiết kế), là một
> output ví dụ của tầng đó khi được xây.

---

## 6) Những hướng đã cảnh báo / xếp ưu tiên thấp hơn

### 6.1. Netflix
DRM/bản quyền/ràng buộc sử dụng. Nếu làm: chỉ theo hướng user chủ động cung cấp dữ liệu họ có quyền
dùng (subtitle/transcript/file riêng). Không ưu tiên hơn YouTube/PDF/website/manga.

### 6.2. AI World Simulation
Wow lớn nhưng nên đến sau khi data đã dày, learning genome đủ mạnh, người dùng đã có thói quen học.

### 6.3. Prediction
Không biến thành "bói toán số đẹp" — dựa trên dữ liệu học thật, trình bày minh bạch.

### 6.4. 🔍 Ghi âm cuộc họp rồi tóm tắt (mới)
Xem đánh giá đầy đủ ở mục 2.1 — rủi ro consent (ghi âm người thứ ba) + lệch positioning sản phẩm.
Cần quyết định rõ ràng trước khi đưa vào roadmap, không nên mặc định "làm sau" như Netflix.

### 6.5. 🔍 Telegram capture channel (mới)
Xem đánh giá đầy đủ ở mục 2.1 — không phải wow anchor, lệch với launch VN-first. Ưu tiên thấp.

---

## 7) Cách nhìn về giá trị sản phẩm

### 7.1. Lõi vô hình (moat dài hạn)
Engine, learning genome, memory graph, AI abstraction, context bus, companion state machine,
recommendation logic.

### 7.2. Lớp hữu hình / wow (kéo và giữ người dùng)
YouTube import, manga import, camera mode, hover translate, learn-this, replay, AI coach,
before-after, time machine — nay bổ sung: **live pitch mirror, companion phản hồi cá nhân hoá,
compounding cross-video knowledge** (mục 5).

---

## 8) Roadmap gợi ý đã điều chỉnh

### Giai đoạn 1 — Thu hút
- Hoàn thiện core loop YouTube (đang có) + **live pitch mirror** (5.1) làm demo không cần đăng ký
  trên landing page — đây là "hero demo" thật sự khác Corodomo, không chỉ "dán link ra bài học".

### Giai đoạn 2 — Giữ chân qua cảm xúc
- Hoàn thành Companion Presence (đang build dở) + phản hồi cá nhân hoá dựa trên pitch data (5.2).

### Giai đoạn 3 — Compounding & cá nhân hóa sâu
- Learning Genome, Personal Language Twin, Memory Graph, cross-video recall (5.3).

### Giai đoạn 4 — Mở rộng nguồn vào (SAU khi có quota/kill-switch L8)
- Extension (ưu tiên cao nhất trong nhóm capture) → PDF → Manga → Website → Camera → Telegram
  (ưu tiên thấp nhất, thị trường quốc tế).

### Giai đoạn 5 — Intelligence
- Plateau detection, prediction, AI coach chủ động, adaptive curriculum.

### Giai đoạn 6 — Moat lớn
- Living knowledge, replay timeline, world simulation, hệ sinh thái ngôn ngữ hoàn chỉnh.

> 🔍 Khác biệt so với bản gốc: **L8 (quota/kill-switch) được đẩy lên trước Giai đoạn "mở rộng nguồn
> vào"**, không phải sau — mở nhiều nguồn AI trước khi có phòng thủ chi phí là rủi ro lớn nhất bị bỏ
> sót trong roadmap gốc. Live pitch mirror + Companion cá nhân hoá được đẩy lên đầu vì đó là câu trả
> lời trực tiếp cho vấn đề "Corodomo đã đi trước, đã có người dùng thật".

---

## 9) Kết luận

> **Xây một hệ sinh thái AI biến mọi nội dung tiếng Nhật người dùng thích thành bài học cá nhân hóa,
> trong đó YouTube là điểm vào đầu tiên, còn Learning Genome + Companion + Memory Graph là lợi thế
> dài hạn.**

Pitch ngắn:
> **Learn Japanese from anything.**
> **AI turns your content into your curriculum.**
> **The system remembers how you learn.**

🔍 Bổ sung sau khi biết về Corodomo — câu trả lời cho "vì sao đổi app dù họ đã có người dùng":
> **Corodomo cho bạn luyện câu. Chúng tôi cho bạn thấy giọng mình đang thay đổi ngay lúc bạn nói,
> nhớ chính xác bạn đã tiến bộ ở đâu, và không bao giờ bắt bạn học lại từ đầu ở mỗi video.**
