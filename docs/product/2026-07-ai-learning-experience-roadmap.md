# AI Learning Experience Roadmap
Status: Draft
Purpose:
Tập hợp các ý tưởng nâng cấp trải nghiệm học tập bằng AI.
Đây không phải roadmap implementation mà là nơi lưu các ý tưởng đã được chọn để tiếp tục thiết kế.

Nguyên tắc thoại/nhân vật của Companion nằm ở `MASCOT.md`. Tài liệu này chỉ mô tả CÁCH các tính năng
vận hành theo đúng những nguyên tắc đó, không định nghĩa lại chúng.

---

# North Star

Không tạo thêm nhiều tính năng.

Mà tạo ra những trải nghiệm khiến người học cảm thấy:

> "Ứng dụng này thật sự hiểu cách mình học."

AI không thay người học.

AI loại bỏ những điểm gây mệt mỏi trong quá trình học.

---

# Nguyên tắc vận hành xuyên suốt — kim chỉ nam của toàn bộ experience layer

> **AI không xuất hiện nhiều hơn. AI chỉ xuất hiện đúng lúc hơn.**
> **Silence is also a response.**

Nếu một tương tác không làm việc học tốt hơn, hoặc không khiến hành trình có ý nghĩa hơn, hệ thống
nên chọn im lặng.

Đây không phải một tính năng riêng — đây là nguyên tắc chi phối **Detect Confusion, Learning Beats,
Companion, Audio Commute, và Learning Wrapped**:

- Detect Confusion im lặng chờ đúng thời điểm mới nói.
- Learning Beats không tự động bắt Companion xuất hiện ở mọi Beat.
- Companion không cố tìm mọi cơ hội để lên tiếng trước khi người học rời đi (chi tiết: `MASCOT.md`).
- Audio Commute không nhồi lặp một câu nhiều lần trong một lượt nghe.
- Learning Wrapped chỉ để Companion nói một câu duy nhất, ở cuối.

Không phải AI thông minh nhất.

Mà là AI biết khi nào nên im lặng, khi nào nên lên tiếng, và khi nào chỉ cần âm thầm chuẩn bị mọi thứ
cho người học.

---

# 1. Detect Confusion

## Vấn đề

Trong thực tế, khi học từ video, người dùng thường:

- pause rất lâu
- replay nhiều lần
- tua đi tua lại
- giảm tốc độ
- dừng để tra từ

Đây đều là tín hiệu cho thấy:

> "Đoạn này mình chưa hiểu."

Hiện nay gần như mọi ứng dụng đều bỏ qua dữ liệu này.

Trong khi đây là một trong những tín hiệu hành vi giá trị nhất.

---

## Detection Signals

AI âm thầm theo dõi các tín hiệu học tập, hoàn toàn ở background. Không popup. Không interrupt.
Không AI chen vào giữa video.

Ví dụ:

- pause > X giây
- replay liên tục
- tua ngược nhiều lần
- nghe đi nghe lại một timestamp
- tốc độ xem giảm
- dừng hẳn rồi thoát

Những tín hiệu này cộng lại thành một Confusion Score.

Ví dụ:

Replay 4 lần
+
Pause 18s
+
Seek Back 3 lần

↓

Confusion Score = 0.87

---

## Ba khái niệm tách biệt

Ranh giới hiển thị không phải "đang phát hay đang dừng". Đó là ba khái niệm độc lập:

1. **Fullscreen** — một *nơi hiển thị*.
2. **Learning Workspace** — một *nơi hiển thị* khác (video đóng khung nhỏ phía trên, transcript +
   furigana + dịch nghĩa cuộn bên dưới — không phải trải nghiệm rạp chiếu phim, mà đã là một môi
   trường học tập).
3. **Attention Window** — một *trục thời gian*, độc lập với cả hai nơi trên.

### Fullscreen — bất khả xâm phạm

Không Companion. Không bubble. Không toast. Không notification. Không overlay.

Kể cả khi người dùng pause ngay trong fullscreen, AI vẫn im lặng.

### Learning Workspace — ambient feedback được phép tồn tại

Vì đây đã là môi trường học tập (có transcript, từ vựng, điều khiển), ambient feedback không còn
phá immersion như trong fullscreen.

Nhưng AI vẫn không được ngắt quãng việc học đang diễn ra. Khác biệt quan trọng là **sự chú ý**,
không phải trạng thái phát/dừng.

### Attention Window — khi nào được phép nói

Confusion vẫn được phát hiện liên tục ở nền. Khi Confusion Score vượt ngưỡng, hệ thống **không**
hiển thị ngay — nó chờ tới khi một "cửa sổ chú ý" mở ra.

Ví dụ về attention window:

- vừa replay xong
- idle 1–2 giây
- user cuộn transcript
- user chạm vào một từ vựng
- user tự nhiên chậm lại sau một câu
- vừa hoàn thành một Beat
- user pause
- video kết thúc

Tại các thời điểm này, một bubble nhỏ có thể fade in:

✨
"Có vẻ đoạn này hơi khó."
"Mình đã lưu lại rồi."

Tự biến mất sau vài giây. Không CTA. Không nút bấm. Không yêu cầu tương tác.

Triết lý **không phải** "chỉ hiện khi pause", cũng **không phải** "hiện ngay lập tức". Mà là:

> **Chỉ hiện khi sự chú ý của người học tự nhiên rảnh ra.**

Cửa sổ chú ý đó có thể mở ngay cả khi video vẫn đang phát trong Learning Workspace. Nhưng nó không
bao giờ được cạnh tranh với câu mà người học đang cố hiểu.

---

## Silence is also a response

Nếu suốt cả phiên học không có attention window nào phù hợp, Companion không cần nói.

Companion **không** cố tìm cách chen vào trước khi người dùng rời đi — điều đó sẽ tạo cảm giác hệ
thống đang cố giữ chân hoặc ép tương tác, trái với triết lý sản phẩm.

Dữ liệu không mất đi. Confusion Score, replay, đoạn khó... vẫn được ghi nhận âm thầm vào dữ liệu học
tập hiện có (SRS, lịch sử phát âm, Journal...) — sau này Learning Genome sẽ tổng hợp lại các tín hiệu
này (xem "Ghi chú: Learning Genome hiện tại là gì" phía dưới). Ngay từ bây giờ, dữ liệu đã được dùng
theo những cách không xâm phạm trải nghiệm:

- Hiển thị trong mục "Need Review" trên Dashboard.
- Ảnh hưởng tới thuật toán SRS.
- Được đưa vào Audio Commute để ưu tiên luyện lại.
- Được sử dụng khi tạo Learning Wrapped.
- Giúp AI hiểu người học hơn trong các phiên học sau.

Companion không có nghĩa vụ phải phản hồi mọi sự kiện. Nó chỉ xuất hiện khi sự xuất hiện của nó
thực sự làm trải nghiệm tốt hơn. Nếu không có thời điểm phù hợp thì im lặng cũng là một lựa chọn
đúng — đó là một phần trong tính cách của Companion (chi tiết: `MASCOT.md` § Sự im lặng cũng là
một câu trả lời).

---

## Lợi ích

Người dùng cảm thấy ứng dụng hiểu mình. Không cần bấm Bookmark. Không cần tự nhớ.

---

# 2. Learning Beats

## Vấn đề

Video 15 phút. Người học thật:

- xem 5 phút
- replay liên tục
- tra từ
- đọc subtitle

=> 5 phút mất 30 phút.

Nếu hiển thị "15 phút", não nghĩ: "Còn dài quá." Rất dễ bỏ cuộc.

---

## Giải pháp

AI chia video thành các Beat theo ngữ nghĩa, **không theo thời gian cố định**.

❌ Mỗi 2 phút một Beat — sẽ cắt ngang hội thoại.

✔ Chia theo:

- kết thúc một cuộc hội thoại
- kết thúc một chủ đề
- kết thúc một cảnh
- kết thúc một ý

Mỗi Beat dài khác nhau — có thể chỉ 45 giây, có thể dài 3 phút. Miễn sao người học có cảm giác
"mình vừa hoàn thành một phần trọn vẹn".

*(Cách AI tạo Beat và cách nó liên quan tới Slang & Culture Summary là chi tiết implementation —
xem mục "Implementation Notes / Registry Mapping" ở cuối tài liệu.)*

---

## Beat Complete KHÔNG phải trigger để Companion xuất hiện

Beat chỉ là **một loại Attention Window** — một cơ hội để Companion có thể xuất hiện, không phải
lệnh bắt buộc.

Mặc định, Beat Complete chỉ hiển thị animation hoàn thành rất nhẹ:

Beat 2/5 ✓

Rồi tiếp tục học. Không cần Companion.

Companion chỉ xuất hiện khi thật sự có giá trị, ví dụ:

- Beat vừa có confusion rất cao.
- Beat có một câu rất đáng lưu.
- Beat có một slang hoặc cultural point thú vị.
- User vừa vượt qua một đoạn rất khó.
- User đạt milestone nhỏ đầu tiên sau nhiều lần thất bại.

Nếu không có tín hiệu nào trong số đó, Beat chỉ hoàn thành rồi tiếp tục — nhất quán với **Silence
is also a response** (§1).

Khi Companion thực sự xuất hiện:

Beat Complete ✓ 1/6

↓

Companion xuất hiện

✨
"Đoạn này khá khó."
"Nhưng bạn làm rất tốt."

Hoặc:

"Mình có lưu một câu rất thú vị."

Sau đó biến mất. Không ở lại. Không làm phiền.

---

## Beat Marker trên Progress Bar

Beat Marker **luôn hiển thị** trên progress bar — nhưng rất tối giản, chỉ là các vạch nhỏ, không
nổi bật.

Lý do: người học luôn biết video còn bao nhiêu Beat, Beat hiện tại là Beat mấy, mỗi Beat chỉ
khoảng 2–3 phút. Một video 15 phút không còn là "15 phút", mà trở thành:

Beat 1/5 · Beat 2/5 · Beat 3/5 · Beat 4/5 · Beat 5/5

Đây là kỹ thuật giảm psychological friction phổ biến trong UX: "Mình chỉ cần hoàn thành thêm một
Beat nữa" thay vì "Mình còn tận 10 phút".

---

## Triết lý của Learning Beats

Learning Beats không tồn tại để gamify.

Learning Beats tồn tại để giảm gánh nặng tâm lý khi học một nội dung dài.

Người học không còn nghĩ "Tôi phải học hết video", mà chỉ nghĩ "Tôi học thêm một Beat nữa". Một
thay đổi rất nhỏ về giao diện, nhưng rất lớn về hành vi.

---

## Slang & Culture Summary — phần mở rộng cuối video

**Gộp vào Learning Beats** (trước đây là mục riêng): dùng chung một lần AI-generate với việc phân
đoạn Beat (xem Implementation note ở trên) — không phải một feature độc lập, mà là sản phẩm phụ
của cùng một pass AI, hiển thị ở một màn hình riêng sau khi video kết thúc.

**Vấn đề:** Anime, Drama, Podcast, YouTube có rất nhiều slang, meme, văn hóa, cách nói tự nhiên mà
người học thường không biết.

**Nội dung**, sau khi hoàn thành video, AI tạo:

- **Interesting Expressions** — ví dụ 「やばい」không chỉ nghĩa "Nguy hiểm" mà còn: đỉnh quá / ghê
  thật / tuyệt thật / chết rồi, tùy ngữ cảnh.
- **Culture Notes** — ví dụ tại sao nhân vật cúi đầu, tại sao dùng お疲れ様 mà không dùng ありがとう,
  ý nghĩa lễ hội, cách người Nhật nói chuyện, ngữ cảnh...

**Quan trọng:** không xuất hiện khi đang xem. Chỉ xuất hiện sau khi hoàn thành — đây là màn hình
riêng, người học đọc thong thả, không phải bubble thoáng qua như Beat checkpoint.

---

# 3. Audio Commute Mode

## Ý tưởng

Đây có thể là một trong những điểm khác biệt lớn nhất của sản phẩm — **nếu làm đúng**.

Không phải chỉ phát audio liên tục. Đây là **"Passive Active Learning"**: người học vẫn đang học
chủ động bằng não, nhưng không cần bất kỳ thao tác nào.

Đây không phải Shadowing. Không có ghi âm. Không chấm điểm. Không xác nhận đã nói theo.

Người dùng chỉ cần:

- Chọn một playlist.
- Đeo tai nghe.
- Bấm Play.
- Cất điện thoại đi.

Mọi thứ còn lại hệ thống tự vận hành.

---

## Flow

JP

↓

(im lặng 2–3 giây)

↓

TTS đọc nghĩa hoặc giải thích rất ngắn (audio only — **không hiển thị text**, nếu cần phân biệt thì
dùng một giọng TTS khác cho phần giải thích, tai người nghe tự phân biệt được đâu là tiếng Nhật,
đâu là phần giải thích)

↓

Lặp lại câu JP một lần nữa

↓

Chuyển sang câu tiếp theo

**Mọi câu đều theo đúng flow này — không có bước nào bị lặp nhiều hơn ngay trong cùng một phiên.**
Không ghi âm. Không chấm điểm. Không popup. Không notification. Không XP popup. Không nút Continue.
Không confirm. Không interaction. Người dùng muốn nói theo thì nói, muốn chỉ nghe cũng được.

Mode này phải có cảm giác giống nghe podcast hơn là làm bài tập. Một câu bị lặp 3 lần liên tiếp
ngay trong một lượt nghe sẽ ngay lập tức chuyển cảm giác từ "đang nghe podcast" sang "đang luyện
tập" — đi ngược triết lý của mode này.

---

## Độ khó chuyển sang cấp độ Playlist, không phải trong-một-câu

Độ khó không biến mất. Nó chỉ được chuyển từ "câu khó nghe 3 lần" sang **"câu khó sẽ xuất hiện
nhiều hơn trong những playlist tương lai"**.

AI không cố nhồi kiến thức trong một lần nghe. AI chỉ âm thầm điều chỉnh tần suất gặp lại theo thời
gian — đây chính là **SRS ở cấp độ Listening**, nhất quán với Learning Genome. Những câu AI biết
người học còn yếu sẽ tự nhiên xuất hiện lại nhiều hơn trong các phiên sau, gần như người dùng không
nhận ra điều đó — nhưng họ sẽ gặp lại đúng những gì mình cần. Đây là một trải nghiệm rất "calm".

Tín hiệu độ khó dùng để xếp hạng ưu tiên trong Playlist (không phải trong-câu): kết hợp Difficulty
Score + Known Words + Pronunciation History — không chỉ từ vựng, mà cả phát âm.

---

## Nguồn nội dung: Auto Queue

AI tự xây playlist. Người dùng không cần suy nghĩ hôm nay nên nghe gì — đây chính là giá trị của
AI. Ưu tiên theo thứ tự:

1. Những câu từng bị Confusion Flag.
2. Flashcard/SRS đến hạn.
3. Những câu trong video vừa xem gần đây.
4. Một vài câu cũ để duy trì trí nhớ dài hạn.

Playlist có tiêu đề dễ hiểu, ví dụ:

🎧 Hôm nay (15 phút)
🎧 Ôn lại Anime hôm qua
🎧 Những câu bạn từng gặp khó
🎧 JLPT N3 Review

Người dùng không cần biết AI chọn theo thuật toán gì. Họ chỉ cần hiểu: "Hệ thống đã chuẩn bị sẵn
cho mình."

---

## Thời lượng phiên: cố định, không vô hạn

Phiên nghe có thời lượng cố định: 5 / 10 / 15 / 20 phút. Không phải playlist vô hạn.

Kết thúc một phiên tạo cảm giác hoàn thành — giống Learning Beats. Người học nghĩ "Mình vừa hoàn
thành một phiên nghe" thay vì "Mình nghe đến lúc nào cũng được". Cảm giác hoàn thành rất quan
trọng.

---

## Pre-fetch, không stream

Toàn bộ nội dung được tải trước khi bắt đầu, không stream từng câu. Người dùng ở Việt Nam dùng mode
này khi đi xe máy, xe buýt, đi bộ, tập gym, nấu ăn — sóng không phải lúc nào cũng ổn định. Tải
trước cả audio package mang lại trải nghiệm tốt hơn nhiều, và cũng tiết kiệm data.

---

## Không tạo áp lực

Không popup XP, không animation thưởng sau mỗi phiên. Nếu có XP thì chỉ cộng âm thầm — không cần
hiện lên. Mình không muốn biến việc đi làm hay đi học thành một nhiệm vụ phải hoàn thành.

Triết lý của mode này: **Calm. Passive. Always Available.** Nó giống một người bạn luôn ở đó để
cùng bạn học, chứ không phải một bài kiểm tra khác.

---

# 4. Learning Wrapped

## Ý tưởng

Spotify Wrapped, nhưng dành cho việc học — một **khoảnh khắc đáng nhớ**, không phải một báo cáo
thống kê.

---

## Cadence: chỉ hàng tháng

Không có Weekly Wrapped. Không muốn người dùng có cảm giác mỗi tuần lại có một bản KPI. Một tháng
là đủ dài để tạo cảm giác nhìn lại hành trình.

---

## Nội dung

Ví dụ:

Tháng này bạn đã:

✓ Shadow 320 câu
✓ Học 280 từ
✓ Xem 18 video
✓ 14 giờ học
✓ Accent cải thiện 17%
✓ Beat hoàn thành nhiều nhất: Anime

Dữ liệu struggle/confusion **vẫn xuất hiện**, nhưng được kể dưới dạng câu chuyện trưởng thành,
không phải liệt kê lỗi:

❌ "Bạn bị confusion 18 lần."

✔ "Tháng này bạn đã chinh phục 18 đoạn hội thoại từng khiến bạn phải xem lại."

Companion không nhìn vào lỗi. Companion nhìn vào hành trình.

---

## Riêng tư khi chia sẻ

Khi chia sẻ ra mạng xã hội, dữ liệu mang tính cá nhân (số lần confusion, số lần replay, số lỗi phát
âm) **mặc định KHÔNG xuất hiện**. Người dùng phải chủ động bật nếu muốn đưa vào bản chia sẻ. Quyền
riêng tư là mặc định.

---

## Companion chỉ nói MỘT câu, ở cuối

Companion không đứng cạnh từng con số. Companion không bình luận vào từng số liệu.

Companion chỉ xuất hiện ở cuối, sau tất cả số liệu, để nói **một câu duy nhất**, được tạo từ chính
dữ liệu thật của người học. Ví dụ:

"Cảm ơn vì đã không bỏ cuộc sau những đoạn hội thoại khó nhất."

Hoặc:

"Tháng này chúng ta đã cùng nhau đi được xa hơn tháng trước."

Hoặc:

"Có những ngày bạn chỉ học vài phút. Nhưng bạn vẫn quay trở lại. Mình nghĩ điều đó rất đáng tự
hào."

Companion không nhìn vào từng con số. Companion nhìn toàn bộ hành trình. Đó là nơi nó nên xuất
hiện.

---

## Có thể chia sẻ

Instagram · Facebook · Threads · TikTok.

**MVP: ảnh tĩnh.** Dễ build, dễ share, đủ để tạo hiệu ứng lan truyền. Video animated kiểu Spotify
Wrapped thật là giai đoạn sau — không mở rộng scope quá sớm.

---

## Lợi ích

Marketing tự nhiên. Không spam. Không dark pattern.

---

# Ba ý tưởng từ giai đoạn brainstorm gốc — đã merge, không phải feature riêng

Ba ý này xuất hiện sớm trong quá trình brainstorm (`nhat_ky_y_tuong_san_pham.md` §5), nhưng không
tồn tại như mục riêng trong roadmap — vì mỗi ý đều thuộc về một tầng khác, không phải tầng feature:

- **Live Pitch Mirror** (vẽ pitch contour real-time trong lúc đang nói) — không có chỗ trong roadmap
  này vì nó thuộc về module Shadowing/Speaking, không phải AI Learning Experience layer. Ghi lại như
  backlog: nếu sau này có module Speaking/Conversation nâng cấp, đây là một enhancement khả thi của
  module đó — không cần roadmap riêng.
- **Companion phản hồi dựa trên dữ liệu thật của người học** — đây không phải feature, mà là
  **implementation detail** của Companion Presence đã áp dụng sẵn trong roadmap này: dòng thoại ở
  Beat checkpoint ("Đoạn này khá khó, nhưng bạn làm rất tốt", §2) và câu duy nhất ở cuối Learning
  Wrapped (§4) đều CHÍNH LÀ ý tưởng này — Companion nói dựa trên data thật (confusion, struggle),
  không phải lời khen chung chung. Không cần mục riêng vì nó đã là cách Companion nói xuyên suốt cả
  tài liệu, không phải một tính năng bổ sung.
- **Cross-video Knowledge** ("bạn đã gặp từ này lần thứ 4 rồi") — thuộc về tầng **Learning Genome**
  (xem mục "Ghi chú: Learning Genome hiện tại là gì" phía dưới), không phải một feature độc lập. Khi
  Learning Genome được thiết kế, đây là một trong những output ví dụ của nó (Recommendation/SRS
  Prioritization), không phải mục riêng trong roadmap này.

---

# Những ý tưởng đã loại bỏ

## Talk to this Video

Ban đầu: AI trò chuyện dựa trên video vừa xem.

Sau khi thảo luận: không phù hợp. Người học thường rất mệt sau khi xem xong — video 15 phút có thể
mất tới 30–60 phút vì replay/tập đọc. Sau đó rất ít người muốn tiếp tục chat. Tính năng có nguy cơ
usage thấp.

=> Bỏ.

## Companion trong lúc xem video

Ban đầu: Companion xuất hiện trong video, đưa lời khuyên, giải thích...

Sau khi thảo luận: không phù hợp. Làm gián đoạn immersion. Mâu thuẫn triết lý Companion.

=> Thay bằng: Companion xuất hiện ở checkpoint (Learning Beats, §2), hoặc sau video (Slang & Culture
Summary trong §2, hoặc Learning Wrapped, §4).

## Interview Simulation

Không còn là tính năng độc lập. Sẽ trở thành một scenario của Conversation Module, không phải
feature riêng.

---

# Design Principles

Mọi tính năng mới phải tuân theo:

✓ Không làm phiền khi học.

✓ Không popup giữa video.

✓ Không ép người dùng tương tác.

✓ AI quan sát trước.

✓ Chỉ xuất hiện khi thật sự cần.

✓ Companion xuất hiện vì có ý nghĩa, không phải vì cần hiện diện.

✓ **Silence is also a response** — nếu không có thời điểm phù hợp, im lặng là lựa chọn đúng, không
cần cố tìm cơ hội cuối để lên tiếng trước khi người học rời đi (chi tiết: `MASCOT.md`).

---

# Triết lý cuối cùng

AI không phải nhân vật chính. Video cũng không phải. Companion cũng không phải.

Người học mới là nhân vật chính.

Mọi AI trong hệ thống chỉ tồn tại để: giảm mệt mỏi, giảm ma sát, hiểu người học hơn, giúp họ đi
được lâu hơn.

Nếu một tính năng khiến người học cảm thấy bị làm phiền, thì dù công nghệ có tốt đến đâu, nó cũng
không đạt mục tiêu của sản phẩm.

> **AI không xuất hiện nhiều hơn. AI chỉ xuất hiện đúng lúc hơn.**
> **Silence is also a response.**

---

# Ghi chú: "Learning Genome" hiện tại là gì

"Learning Genome" trong tài liệu này là một **khái niệm định hướng**, chưa phải một module đã tồn
tại trong code. Layer này **chưa được thiết kế hay implement** — roadmap hiện đang tập trung hoàn
thiện Companion Presence (L9b). Khi kiến trúc Presence ổn định, đây sẽ là một trong những nền tảng
lớn tiếp theo của sản phẩm.

Phần dưới đây mô tả **Model Design** (triết lý của layer này), không phải implementation. Khi sau
này tạo `experience-architecture.md`, đây sẽ là hạt giống để tách thành một chương riêng.

## Định nghĩa

> **Learning Genome không phải nơi lưu mọi dữ liệu học tập. Nó là mô hình đang dần hình thành về
> cách mỗi người học ngôn ngữ. Các sự kiện (replay, pause, pronunciation, SRS, Journal...) chỉ là
> tín hiệu đầu vào. Genome chỉ lưu những đặc điểm tương đối ổn định của người học, cập nhật chậm
> theo thời gian, và được các tính năng AI sử dụng để cá nhân hóa trải nghiệm.**

## Là một Model, không phải một Database

Sản phẩm đã có nhiều nguồn dữ liệu học tập độc lập — đây vẫn là nơi lưu dữ liệu gốc, Learning Genome
**không thay thế** chúng:

- `lib/srs` — trạng thái ôn tập theo từng user/item.
- `lib/difficulty` — độ khó và i+1 scorer.
- `pronunciation_score` / `lib/pitch` — lịch sử phát âm.
- `companion_memories` — Journal và các ký ức của Companion.
- `xp_events` — lịch sử hoạt động học tập.

Learning Genome chỉ đứng phía trên chúng như một **Learning Model**:

Signals (Replay · Pause · Pronunciation · Known Words · SRS · Journal...)

↓

**Learning Genome**

↓

Predictions (Listening Confidence · Grammar Stability · Preferred Context · Persistence ·
Curiosity...)

↓

Experiences (Detect Confusion · Audio Commute · Companion · Learning Wrapped · Recommendation ·
Learning Path...)

Các tính năng AI chỉ **đọc và cập nhật** Learning Genome, thay vì mỗi tính năng tự lưu và tự suy
luận riêng.

## Chỉ lưu đặc điểm ổn định, không lưu event

Replay hôm nay, pause hôm nay, pronunciation của một câu... đều là **events**. Genome không lưu
event — nó chỉ lưu kết quả mà các event dần hình thành theo thời gian.

❌ Không lưu: `Replay = 4`

✔ Thay vào đó: `Listening Confidence = 0.74`

Events liên tục cập nhật Genome, nhưng Genome chỉ phản ánh trạng thái hiện tại của người học.

## Traits mô tả hành vi quan sát được, không phải "kiểu học"

Thay vì chỉ lưu Replay Rate / Vocabulary Count / Pitch Score, Genome nên dần hình thành những đặc
điểm như: Context Learner, Conversation Driven, Example Driven, Grammar Explorer, Slow but Stable,
Curious Explorer, Strong Long-term Retention, Needs More Listening Exposure, Learns Best From Real
Dialogue...

**Không dùng nhãn kiểu "learning styles"** (ví dụ Visual Learner / Audio Learner) — mô hình VAK
(Visual-Auditory-Kinesthetic) đã bị nghiên cứu giáo dục phản biện khá nhiều. Mọi trait phải truy
ngược được về bằng chứng hành vi/kết quả học tập thực tế, không phải một mô hình "kiểu học" cố định.

Đây không phải badge hay achievement. Đây là cách AI hiểu người học. Companion có thể nói:

> "Mình nhận ra bạn nhớ từ rất lâu khi chúng xuất hiện trong hội thoại."

thay vì:

> "Replay Rate của bạn là 63%."

## Mọi trait đều có Confidence

Genome không nên kết luận chắc chắn quá sớm — mỗi trait đi kèm một Confidence (ví dụ `Context
Learner: 0.28` những tháng đầu, dần lên `0.91` sau nhiều tháng quan sát). Chỉ khi Confidence đủ cao,
AI mới cá nhân hóa mạnh. Điều này giúp tránh overfitting từ vài phiên học đầu.

## Thay đổi chậm — "tính cách học tập", không phải "mood học tập"

Một phiên học tệ không nên khiến toàn bộ mô hình người học thay đổi. Replay có thể thay đổi từng
phút; Genome chỉ thay đổi dần theo thời gian.

## Không có tốt hay xấu

Không nên tồn tại "Good Listener" / "Bad Listener", hay "người học giỏi" / "người học kém". Genome
chỉ mô tả cách mỗi người học hiệu quả nhất — thích nghe trước, thích đọc trước, học tốt qua hội
thoại, nhớ lâu nhờ ngữ cảnh, thích ví dụ hơn quy tắc... Không có đúng hay sai, chỉ có sự khác biệt
giữa các người học.

## Không trở thành Dashboard KPI

Không nên có một màn hình liệt kê "Listening: 82 · Grammar: 74 · Persistence: 91" — điều đó biến
Genome thành một bảng điểm khác. Genome nên hoạt động phía sau; đôi khi Companion mới tiết lộ một
mẩu rất nhỏ ("Mình nhận ra bạn học rất tốt khi mọi thứ được đặt trong ngữ cảnh"), để người dùng cảm
thấy AI thật sự hiểu mình, thay vì nhìn thấy thêm một dashboard.

## Explainable, và có thể bị phản đối (contestable)

Nếu Genome ảnh hưởng tới Recommendation hoặc Audio Commute, hệ thống nên giải thích ngắn gọn được vì
sao (ví dụ: "Playlist này ưu tiên những câu bạn từng phải nghe lại nhiều lần"). Không nên là một
"black box" mà ngay cả người học cũng không hiểu vì sao AI lại đưa ra quyết định.

Đi thêm nửa bước so với explainability: người dùng có quyền **không đồng ý**. Nếu Companion nói
"Mình nhận thấy bạn học tốt qua hội thoại" mà người dùng thấy không đúng, tương lai có thể có cơ chế
phản hồi kiểu "Không hẳn" / "Đừng ưu tiên kiểu này nữa". Không nhất thiết phải build UI ngay, nhưng
về triết lý: Genome không phải một mô hình "AI luôn đúng" — nó chỉ đang hình thành một **giả thuyết**
về người học, và giả thuyết đó luôn có thể được điều chỉnh bởi dữ liệu mới hoặc bởi chính người học.
Điều này nhất quán trực tiếp với nguyên tắc Confidence ở trên.

## Nằm trong boundary quyền riêng tư của người dùng

CLAUDE.md §2 khoá nguyên tắc: user phải có quyền xóa toàn bộ dữ liệu (GDPR-friendly). Genome không
phải dữ liệu người dùng nhập vào, nhưng nó là dữ liệu **suy luận từ** dữ liệu người dùng — nên thuộc
cùng phạm vi đó:

- Delete All Data phải xóa cả Genome.
- Reset Learning phải reset cả Genome.
- Genome không được tồn tại ngoài boundary dữ liệu của người dùng.

Nhất quán với triết lý hiện tại: Companion, Journal và Learning Genome đều chỉ tồn tại vì người dùng
đã tạo ra hành trình học đó.

---

Mọi cụm "ghi vào Learning Genome" trong các mục 1–4 phía trên nên được đọc là **đích đến của kiến
trúc**, không phải mô tả hành vi hiện tại của code.

---

# Implementation Notes / Registry Mapping

Mục này gom mọi chi tiết implementation từng nằm rải rác trong phần feature ở trên — roadmap phía
trên chỉ nói về trải nghiệm người dùng, cơ chế kỹ thuật sống ở đây để tránh sinh ra hai
implementation song song. Không tạo feature mới nếu Feature Registry (`docs/features/`) đã có sẵn —
chỉ ghi rõ đây là enhancement/tái dùng cơ chế của feature cũ.

- **Learning Beats + Slang & Culture Summary dùng chung một lần AI-generate.** AI phân đoạn Beat và
  gắn nhãn "notable" cho 1–2 câu mỗi Beat nên là **một pass duy nhất** đọc transcript, không phải
  hai pipeline AI riêng. Dữ liệu "notable" phục vụ cả Beat checkpoint lẫn Slang & Culture Summary
  cuối video — đỡ tốn thêm một mặt trận AI mới.
- **Audio Commute (§3) ↔ F-001 Active Listening Mode** — **không phải cùng một tính năng, triết lý
  ngược nhau**: F-001 là gõ lại câu nghe được, chấm điểm, có streak/XP (gamified); Audio Commute
  không chạm màn hình, không chấm điểm, không gamify (calm). Khi build F-001, cần đặt tên UI phân
  biệt rõ với Audio Commute để không gây nhầm lẫn "hai chế độ nghe khác nhau" thành một.
- **Auto Queue (§3) ↔ F-012 Smart Review Queue** — Auto Queue nên **tái dùng cơ chế
  `boost_priority`/`boost_expiry`** trên `user_vocab_progress` mà F-012 đã thiết kế, thay vì xây một
  hệ thống ưu tiên SRS song song. Auto Queue là một cách kích hoạt boost khác (tự động theo
  Confusion Flag + lịch sử nghe) bên cạnh cách F-012 đã định nghĩa (thêm video vào playlist), không
  phải hai hệ thống riêng.
- **Detect Confusion (§1) — tín hiệu replay ↔ F-006 Shadowing Replay Timeline** — F-006 đã lên kế
  hoạch UI lịch sử replay theo từng dòng (`shadowing_sessions`). Confusion Score nên đọc từ cùng
  nguồn dữ liệu replay này, không tạo bảng/tín hiệu replay riêng.
- **Audio Commute — Difficulty Score ↔ F-004 Difficulty Timeline** — cả hai đều dựa trên
  `lib/difficulty` (i+1 engine) đã build. Không cần tính lại độ khó theo cách khác.
- **"Need Review" trên Dashboard (§1) / badge Wrapped (§4) ↔ F-015 Immersion Dashboard** — đây là
  các UI slot bên trong F-015, không phải một dashboard mới. Khi F-015 được build, "Need Review" và
  badge Wrapped nên là hai widget trong đó.

---

# Định hướng tài liệu tương lai

Khi sản phẩm lớn hơn, nên có một tài liệu riêng — dạng `experience-architecture.md` — làm cầu nối
giữa **Philosophy** và **Implementation**. Tài liệu đó sẽ mô tả cơ chế cụ thể (Attention Window,
Fullscreen/Workspace gate, Confusion Score, Learning Genome model design...) độc lập với từng tính
năng riêng lẻ — nơi các khái niệm này được định nghĩa MỘT lần rồi mọi tính năng (Detect Confusion,
Learning Beats, Audio Commute, Wrapped...) cùng tham chiếu, thay vì lặp lại rải rác như tài liệu ý
tưởng này. Mục "Ghi chú: Learning Genome hiện tại là gì" ở trên là hạt giống đầu tiên cho chương đó.

Chưa tạo file này ngay — ghi chú lại để làm khi cần.

Ranh giới tài liệu hiện tại (giữ nguyên cho tới khi `experience-architecture.md` ra đời):

- `MASCOT.md` → triết lý Companion (Character Bible).
- Spec 1 (Companion System, P0–P12) → nguyên tắc kỹ thuật-hoá của Companion.
- `2026-07-ai-learning-experience-roadmap.md` (tài liệu này) → trải nghiệm đã đủ chín để build.
- Mục "Learning Genome" trong tài liệu này → triết lý của learning model, chưa phải kiến trúc.
- `nhat_ky_y_tuong_san_pham.md` → kho ý tưởng dài hạn, chưa đủ chín để vào roadmap.
- `experience-architecture.md` (tương lai) → kiến trúc chi tiết khi hệ thống đủ lớn.
