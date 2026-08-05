# Korume

Web học tiếng Nhật qua video — shadowing/dictation, kanji, vocab, grammar, JLPT — với UI
cinematic/scroll-driven làm điểm khác biệt. Vietnam-first.

**Stack:** Next.js 14 (App Router) · TypeScript strict · Tailwind · Supabase (Postgres/Auth/Storage) ·
GSAP + Lenis + Framer Motion · Vitest + Playwright.

## Tài liệu — đọc trước khi code

| File | Nội dung |
|---|---|
| `CLAUDE.md` | Luật gốc của repo: non-negotiables (§2), stack, conventions, Definition of Done |
| `japanese-learning-app-spec.md` | Spec sản phẩm đầy đủ: modules, DB schema, API endpoints |
| `docs/product/business-model.md` | **Nguồn chân lý** cho thị trường & monetization (supersede spec §3.12) |
| `.claude/docs/workflow.md` | Agent roster, routing, 8 lớp build, branching policy |
| `docs/features/` | F-001..F-016 — feature briefs |

Khi spec và `business-model.md` xung đột: **business-model.md thắng**.

## Bắt đầu

```bash
npm install
cp .env.local.example .env.local   # rồi điền key — xem chú thích trong file
npm run dev                        # http://localhost:3000
```

`.env.local` **không bao giờ** được commit. `APP_ENV`, `AI_PROVIDER`, `SPEECH_PROVIDER` là bắt buộc và
được validate một lần lúc khởi động (`lib/env/validate.ts` qua `instrumentation.ts`) — cấu hình sai thì
app fail ngay lúc boot, không phải 503 lẻ tẻ lúc chạy. Provider luôn được chọn **tường minh**, không
bao giờ suy ra từ việc key nào đang có; `none` = tắt có chủ đích.

## Scripts

| Lệnh | Việc |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Build + chạy production (self-host, 1 Node instance) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (có rule cấm import SDK provider ngoài `lib/ai/providers/`) |
| `npm test` | Vitest (unit/integration) |
| `npm run test:e2e` | Playwright |

TDD là mặc định: test viết trước, và không claim "chạy được" nếu chưa chạy lệnh và thấy nó pass
(`CLAUDE.md` §7, §9).

## Ranh giới không được vượt (tóm tắt `CLAUDE.md` §2)

- **Không bao giờ tải/host/proxy video.** Video luôn phát qua YouTube IFrame Player API. Server chỉ lưu
  video ID, metadata, transcript và dữ liệu học tập.
- **Ghi âm thuộc về người dùng** — mã hóa khi lưu, không public mặc định, không train model nếu chưa có
  consent, có "xóa toàn bộ dữ liệu của tôi".
- **Nội dung học tập là nguyên gốc.**
- **Gemini là dev-only** — free tier của nó cho phép train trên dữ liệu gửi lên, nên dữ liệu người dùng
  thật không bao giờ được chạm tới. `APP_ENV=production` + Gemini fail ngay lúc khởi động, có chủ đích.
- Accessibility (WCAG AA, keyboard, reduced-motion) là yêu cầu, không phải nice-to-have.

## Trạng thái

Layer 1–7 đã merged: auth, kanji/vocab/grammar + SRS (SM-2), video/shadowing + pitch accent + sentence
mining + adaptive furigana, AI features (provider-agnostic qua `lib/ai/port.ts`), JLPT + reading,
gamification + notifications, community + admin CMS.

Còn lại **Layer 8** — billing (PayOS, không trial), polish animation toàn site, performance audit.

Deploy: self-host tại **almostgone.vn** (1 Node instance chạy liên tục, KHÔNG Vercel) + Supabase (DB).
