# AI Provider Abstraction (Spec A) — **DONE, MERGED `201a9b4` (2026-07-16)**

**STATUS: HOÀN TẤT.** 15/15 task, 26 commit, 1098 → 1166 tests. Nhánh `spec-a-ai-provider-abstraction`
đã merge `--no-ff` vào master và xoá. Trạng thái sản phẩm: xem `[[project_status]]`.

Đây giờ là **hồ sơ lịch sử + bài học**, không phải kế hoạch thi công. Đừng thi công lại theo nó.

- Spec: `docs/superpowers/specs/2026-07-15-ai-provider-abstraction-design.md`
- Plan: `docs/superpowers/plans/2026-07-15-ai-provider-abstraction.md` (15 task TDD)
- Ledger thi công (từng task, từng finding): `.superpowers/sdd/progress.md` — **⚠️ KHÔNG BỀN.
  `.superpowers/` bị gitignore (`*`), nên file này CHỈ tồn tại trên máy này và `git clean -fdx` xoá
  sạch. Nó là scratch của skill subagent-driven-development, không phải bản ghi chính thức.**
  → **Bản ghi BỀN của Spec A = memory này + `[[project_status]]` + `git log`.** Mọi thứ đáng giữ đã
  được chép vào đây rồi; đừng coi ledger là nguồn chân lý, và đừng hoảng nếu nó biến mất.

## Bài học lớn nhất — nguyên tắc này cứu 6 lần

> **Nếu thực tế không khớp điều được bảo → CHỈ DẪN SAI, không phải thực tế sai. Báo, đừng ép.**

Sáu lần văn bản của chính plan/spec/review sai, và mỗi lần chỉ lộ ra vì có người *kiểm tra thay vì tin*:

1. **V3** — assistant đoán `GEMINI_API_KEY` phải là `AIza`. Key thật là **53 ký tự prefix `AQ.`**, và
   **hợp lệ** (API trả 200). Rule viết theo trí nhớ sẽ **chặn boot bằng một key đang chạy tốt**.
2. **V6** — assistant đoán `AZURE_SPEECH_KEY` là 32-hex. Key thật **84 ký tự alphanumeric**. Lại suýt
   false-crash. (Cú bắt sắc: GUID của audit bỏ gạch nối ra ĐÚNG 32 alphanumeric — nên thứ loại nó là
   **dấu gạch nối**, không phải độ dài.)
3. **V4** — spec khẳng định `next start` validate lúc boot. **Sai cả hai vế** (xem "Giới hạn" bên dưới).
4. Plan gọi `isSpeechConfigured` cho thứ Task 12 đẻ ra tên `isSpeechEnabled`.
5. Plan mẫu route đọc `admin.error` — `RequireAdminResult` không có field đó.
6. **Hai** review đòi xoá construct "thừa" mà thực ra load-bearing: `EnvSource` union, và `?.` trong
   `lib/ai/env.ts` (TS vứt narrowing trong closure → bỏ là vỡ typecheck TS18048). **Đừng dọn lần 3.**

Hệ quả rút ra: **viết rule SAU khi đo, không trước.** Cả 6 đều vô hại vì quy trình bắt buộc verify.

## Giới hạn đã biết, user CHẤP NHẬN (ghi trong spec §3) — đừng mở lại như bug

**`next start` KHÔNG exit khi config sai.** Nó mở port, in "Ready", rồi trả **HTTP 500 vĩnh viễn** mỗi
request mà không bao giờ thoát. `next dev` thì ngược lại: crash trước khi port mở. Nghĩa là supervisor
kiểu restart-on-crash **không bao giờ thấy lỗi** ở production; chỉ HTTP health check bắt được.
→ User hoãn sang **scope D (deploy)**: `process.exit(1)` là quyết định *policy*, hình dạng đúng phụ
thuộc supervisor almostgone.vn thực sự chạy. Quyết khi dựng supervisor.

## Việc còn nợ (không chặn merge, đã ghi nhận)

- **`gemini.test.ts` mock cả SDK** → `toContents` (kể cả phép dịch `role: "ai"→"model"`) **không có
  assertion nào**. Emit sai role thì test vẫn xanh còn live API 400. V1 đã verify `@google/genai` đi
  qua global `fetch` → làm `test/gemini-mock.ts` kiểu `test/claude-mock.ts` là **khả thi**. Gemini
  chỉ chạy dev nên rủi ro thấp, nhưng có thật.
- PayOS env (`CLIENT_ID`/`API_KEY`/`CHECKSUM_KEY` → nên `PAYOS_*`) vẫn **uncommitted** trong
  `.env.local.example`. Ngoài scope A, thuộc L8. Đừng để nó đi ké commit nào.

## Quyết định kiến trúc còn hiệu lực (D1–D9, chi tiết trong spec §4)

D1 tách "cố ý tắt" (`none` → giữ 503) khỏi "cấu hình sai" (→ crash boot) · D2 structural validation
lúc boot, liveness chỉ qua admin health on-demand (boot KHÔNG phụ thuộc uptime bên thứ ba) ·
D3 module env chung, consumer tự đăng ký · D4 port nhận tier `fast|deep`, không nhận model id ·
D5 Gemini dùng `@google/genai` · D6 fake provider cho feature test, adapter test riêng ·
D7 `APP_ENV` cưỡng chế dev/prod · D8 không streaming · D9 một provider lifecycle chung.

**D9 có một ngoại lệ CỐ Ý** (đừng "sửa"): `readSpeechEnv` hẹp hơn `readAiEnv` — nó dừng ở *selection*,
không đòi credential — để `checkSpeechHealth` báo `not_configured` chính xác thay vì throw (D2 cấm
health path throw). Cổng credential đầy đủ vẫn nằm ở `speechEnvSpec` lúc startup. Hai thứ chỉ "bất
đồng" ở trạng thái mà startup đã cấm. Docblock trong `lib/speech-scoring/env.ts` nói rõ: **selection
lifecycle thì kế thừa, credential strictness thì per-subsystem.**

## Constraint user phát biểu (spec §2) — vẫn ràng buộc L8

> Abstraction KHÔNG được thu hẹp sản phẩm. Hoãn implement / tắt khi `none` thì được; **thu hẹp hay
> thiết kế lại AI API quanh Gemini Free thì KHÔNG.**

Final review đã kiểm chứng đối kháng và **xác nhận đạt**: `REQUIRED_CAPABILITIES` đòi
`promptCaching`+`reasoning` = true trong khi provider DUY NHẤT chạy được (Gemini) khai cả hai = false.
Port đòi thứ provider hiện tại không có → đúng là ngược với "uốn theo Gemini". Gemini khai `false` là
**trung thực, không phải lỗ hổng cần vá**.

Nguyên tắc user chốt, vẫn áp cho L8: **"Explicit configuration. Fail fast. Never infer. Never silently
fall back."**

Liên quan: [[project_status]] · [[monetization_brainstorm]] · [[product_readiness_audit_2026-07-14]]
· [[feature_backlog_deferred]]
