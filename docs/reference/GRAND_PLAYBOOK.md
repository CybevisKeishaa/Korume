# GRAND PLAYBOOK — Toàn bộ kỹ năng dựng web động (gộp 9 playbook thành 1)

> ## ⚠️ Reference Only — không phải spec của Nihongo Cinema
>
> This document is a collection of reusable landing-page craftsmanship — storytelling, scroll
> choreography, motion/animation pacing, section rhythm, visual composition, CTA flow, emotional
> progression — distilled from previous projects (a different repo, `lamborghini-demo`).
>
> **It is not a specification for Nihongo Cinema.** Nothing here — domain examples (Lamborghini,
> Jewelry, Real Estate, CloudStudio mascot-chat-widget...), the specific stack claims (Next.js 16,
> React 19, Tailwind v4 `@theme`), or any code snippet — should be taken as this repo's actual
> architecture or product content.
>
> **Cách dùng:** giữ lại các nguyên lý phổ quát (storytelling, scroll choreography, animation
> pacing, section rhythm, motion principles, visual composition, CTA flow, emotional progression);
> bỏ qua mọi domain cũ (Lamborghini/Jewelry/Real Estate/CloudStudio/mascot marketing...) và mọi giả
> định stack không khớp repo hiện tại. Khi có xung đột, luôn ưu tiên tài liệu chính thức của dự án —
> `CLAUDE.md`, các Product Spec, `MASCOT.md`, roadmap — và **stack thật của repo này: Next.js
> 14.2.35, React 18.3.1, Tailwind v3.4 (`tailwind.config.ts`)** — bỏ qua mọi ví dụ project-specific
> trong playbook này khi nó lệch với repo thật.
>
> Cùng một nguyên tắc quản trị được áp dụng cho toàn bộ `docs/design/` — xem
> `docs/design/README.md` ("Documentation follows reality. Reality does not follow
> documentation."): tài liệu này (và mọi tài liệu design khác) truyền cảm hứng cho quyết định,
> không ra lệnh cho nó. Ta tái sử dụng **kinh nghiệm**, không tái sử dụng **sản phẩm**.

---

> File này là bản **hợp nhất đầy đủ** của mọi playbook trong repo — không chỉ trỏ chéo, mà **gộp thẳng** kỹ
> thuật, số liệu đã chốt, code mẫu, và bảng bẫy của cả 9 file vào một chỗ. Đọc file NÀY là đủ để dựng bất kỳ
> style nào trong 7 style đã kiểm chứng, hoặc lai/đẻ style mới. Các file gốc (`*_PLAYBOOK.md`) vẫn giữ lại
> làm tài liệu chi tiết/tham chiếu sâu, xem mục 18.
>
> Nguồn gộp: `META_PLAYBOOK.md`, `CINESCROLL_PLAYBOOK.md`, `EDITORIAL_MAISON_PLAYBOOK.md`,
> `COSMIC_PORTFOLIO_PLAYBOOK.md`, `EMONS_PLAYBOOK.md`, `EMONS_HERO_PLAYBOOK.md`,
> `BRUTALIST_FORGED_PLAYBOOK.md`, `COMMERCIAL_PORTAL_PLAYBOOK.md`, `CLOUDSTUDIO_MASCOT_PLAYBOOK.md`.
>
> **Nguyên tắc vàng của cả bộ:** motion quality > visual > performance, và **verify bằng mắt trong Chrome
> (cuộn THẬT), không tin build pass.**

Mục lục:
0. Bản đồ 7 style con — chọn/lai cái nào
1. Nguyên tắc bất biến (đúng cho MỌI style)
2. Quy trình tổng (meta-process)
3. Nền tảng kỹ thuật tái dùng (copy gần như nguyên xi, kèm code thật)
4. ⭐ Cây quyết định: chọn STYLE + chọn NGUỒN chuyển động (A video / B tự vẽ / C engine tương tác)
5. NGUỒN A — animation từ VIDEO (3 kỹ thuật + ffmpeg đầy đủ)
6. NGUỒN B — TỰ VẼ animation (Canvas 2D / CSS-3D / GSAP, zero asset)
7. NGUỒN C — ENGINE TƯƠNG TÁC TỰ VIẾT (mascot, dust particle, chat script, physics kéo-ném)
8. Thư viện thiết bị chữ ký hợp nhất (mix & match — 40+ món)
9. Sợi chỉ đỏ & nhịp sáng/tối
10. Responsive + reduced-motion (bắt buộc)
11. ⚠️ BẢNG BẪY HỢP NHẤT TOÀN BỘ (gộp từ cả 9 playbook, ~55 dòng)
12. Verify trong Chrome (cuộn thật, dev tươi, dispatch event)
13. BỘ PROMPT MẪU cho từng style (điền để build thẳng)
14. Checklist nghiệm thu chung
15. Cách đẻ một playbook con mới từ dự án vừa xong
16. Chỉ mục 9 file gốc (đọc sâu khi cần)

---

## 0. BẢN ĐỒ 7 STYLE CON — CHỌN/LAI CÁI NÀO

| Style | Cảm giác | Nền | Nguồn chuyển động | Hợp với |
|---|---|---|---|---|
| **CINESCROLL** | Trailer phim, kịch tính | Tối `#080808` | Video **scrub** all-intra | Xe, tốc độ, tech, đồng hồ |
| **EDITORIAL MAISON** | Bảo tàng/nhà mốt, "đắt tiền" | Kem `#f2ecdd` | Ảnh khung vòm + video loop/interstitial | Trang sức, BĐS, mỹ phẩm, nghệ thuật |
| **COSMIC PORTFOLIO** | Vũ trụ điện ảnh công nghệ | Gần đen ánh xanh `#060609` | **Tự vẽ** Canvas 2D + CSS-3D (zero asset) | Portfolio dev/designer, studio, sản phẩm tech |
| **SCENE-CAROUSEL HERO** (Emons) | Hero điều khiển bằng wheel, bay camera giữa cảnh | Tùy brand | Video **cảnh loop + clip transition** cắt khít frame | Logistics, sản phẩm nhiều "mode", storytelling hero |
| **BRUTALIST KINETIC EDITORIAL** (Lambo "FORGED") | Awwwards SOTD: type khổng lồ, số liệu oversized, grid Swiss, motion nhiều, độ dài production | Tối `#080808` + **1 beat đảo màu ngà** | Lai: hero **scrub** (A) + thân editorial thuần CSS/GSAP | Xe/tech "production-length", brand cần nhiều data + đặc sắc từng section |
| **COMMERCIAL PORTAL** (BĐS "Azure Estates") | Cổng thương mại **nhưng luxury**: search, lưới listing, agents, testimonials | Nhịp **tối→sáng bone→tối** | Lai: hero **scrub** (A) + section thương mại thuần CSS/GSAP | BĐS/môi giới, marketplace dịch vụ, brand cần **mật độ thương mại** mà vẫn sang |
| **CLOUDSTUDIO MASCOT** ("Cybevis Keisha" `/me`) | Studio kinetic playful-pro, có **linh vật + trợ lý chat + dust sống** | 3 tông sáng (periwinkle/paper/near-black), lật TỨC THỜI | **Tự viết** engine tương tác (C): mascot mắt-dõi, canvas dust morph, chat script, physics kéo-ném | Studio/agency/portfolio muốn vui, đáng nhớ, khoe animation + "AI concierge" |
| **(style mới của bạn)** | ? | ? | A/B/C hoặc lai | ? |

**Được phép lai.** Ví dụ: hero **scrub** (CINESCROLL) + thân **editorial**; nền **vũ trụ tự vẽ** (COSMIC) + một
act **scrub video**; cổng thương mại (COMMERCIAL) + mascot chat (CLOUDSTUDIO) nếu hợp brand. Cây quyết định ở
mục 4 giúp chọn.

---

## 1. NGUYÊN TẮC BẤT BIẾN

Lặp lại **giống hệt** ở cả 7 dự án — coi như luật:

1. **Chuyển động là SỢI CHỈ ĐỎ, không phải hiệu ứng lẻ.** Người xem "trôi xuyên" một không gian liền mạch
   (starfield chạy suốt / màu accent xuyên suốt / motif line ở mọi act / mascot bay từ section này sang
   section khác), không xem từng box rời.
2. **Một accent duy nhất + palette kỷ luật.** 1 màu nhấn xuyên suốt (+ tối đa 2 màu phụ chỉ cho 1 nhiệm vụ).
   KHÔNG dùng `#000` thuần — luôn near-black có sắc (`#080808`, `#060609`), hoặc nếu nền sáng thì luôn giữ
   tương phản cao ink/off-white (bài học CLOUDSTUDIO).
3. **Kể chuyện theo scroll.** Nội dung = một chuỗi "act/scene" có nhịp; scroll điều khiển timeline chuẩn hóa
   `[0,1]`, mọi overlay gắn theo phần trăm để luôn đồng bộ. (Với style TỨC THỜI như CLOUDSTUDIO thì đổi
   section = lật theme ngay, không animation — nhưng vẫn có 1 through-line xuyên suốt.)
4. **Motion quality > visual > performance.** Khi xung đột, ưu tiên độ mượt/đúng cảm giác trước.
5. **Verify bằng mắt, cuộn THẬT.** Build pass ≠ đúng. Lenis + pin làm scroll tổng hợp không đáng tin →
   phải cuộn thật trong Chrome, đo bằng JS (`currentTime`, `getBoundingClientRect`, `getComputedStyle`).
6. **Không dependency thừa cho hiệu ứng tự chế.** Particle, physics, shape-sampler, chat script — tất cả tự
   viết bằng Canvas 2D/JS thuần khi có thể (bài học CLOUDSTUDIO): nhẹ, độc bản, không lệ thuộc lib ngoài.

---

## 2. QUY TRÌNH TỔNG (meta-process)

Trình tự này khiến **cả 7** dự án về đích. Lặp lại y hệt cho web mới:

1. **Brainstorm chốt hướng** (skill brainstorming): style/lai, palette (tự quyết cho hợp ngành), thiết bị
   chữ ký muốn dùng, nguồn chuyển động A/B/C. Đổi hướng lớn → chốt **khả thi** trước (có ffmpeg? dung lượng?
   clip khít frame? cần chat script hay physics tự viết?).
2. **Viết spec đầy đủ** ở `docs/superpowers/specs/AAAA-MM-DD-<slug>-design.md` (hoặc `*_BUILD.md`). Đây
   chính là "prompt" — càng đầy đủ càng ít phải hỏi lại.
3. **Đọc `node_modules/next/dist/docs/` trước** (nhờ `AGENTS.md`) → tránh API Next lỗi thời. Đây KHÔNG phải
   Next.js trong training data.
4. **Nếu clone trang tham chiếu có thật** (kiểu CLOUDSTUDIO clone cloudstudio.es): mở trang gốc trong Chrome
   MCP, trích `get_page_text` + `getComputedStyle` + chụp từng section đặc trưng **trước khi code**, rồi đổi
   nhân vật/màu/nội dung — KHÔNG chép chữ gốc.
5. **Build TỪNG CỤM**, mỗi cụm: `npx tsc --noEmit` sạch **+ commit** (repo không có test runner → tsc là
   cổng). Việc lớn (>10 task) nên chạy subagent-driven (implementer + reviewer/task).
6. **Verify tận mắt trong Chrome** sau mỗi cụm quan trọng: `npm run dev`, cuộn thật, chụp, đo bằng JS.
7. **Bug → debug có hệ thống** (skill systematic-debugging): tìm root cause trước, một fix một lần.
8. **Thiết kế chủ quan → HỎI chủ trang bằng lựa chọn** (AskUserQuestion), đừng tự quyết (màu nắp, nền câu
   chốt, giá cả trợ lý chat...).

Thứ tự build chuẩn (áp cho mọi style): **theme tokens → engine/động cơ khó nhất làm kỹ trước → các act/section
còn lại → nav → compose page → asset → verify.**

---

## 3. NỀN TẢNG KỸ THUẬT TÁI DÙNG

> ⚠ Mục này mô tả stack/engine của repo GỐC (`lamborghini-demo`: Next 16, Tailwind v4...), KHÔNG phải repo
> Nihongo Cinema. Giữ lại vì các NGUYÊN LÝ (theme cô lập theo route, engine dùng chung, config 1 chỗ, bẫy
> font) vẫn phổ quát — nhưng cú pháp/API cụ thể (`@theme`, `tailwind.config.js` không tồn tại...) phải map
> lại sang cú pháp Next 14 / Tailwind v3 / `tailwind.config.ts` thật của repo này trước khi áp dụng.

Giống hệt ở cả 7 dự án. Copy gần như nguyên xi.

### Stack (bắt buộc đọc docs thật)
```
Next.js 16 (App Router, Turbopack)   ← KHÔNG phải Next 15
React 19 · TypeScript
Tailwind CSS v4  (CSS-first: @theme trong globals.css — KHÔNG có tailwind.config.js)
GSAP 3 + ScrollTrigger   → npm i gsap
Lenis (smooth scroll)    → npm i lenis
```
`AGENTS.md` ở root: `# This is NOT the Next.js you know / Read node_modules/next/dist/docs/ before coding`.
`CLAUDE.md` chỉ cần `@AGENTS.md`. **KHÔNG thêm dependency runtime khác** trừ khi thật sự cần — particle,
physics, chat, shape-sampler đều tự viết (CLOUDSTUDIO đã chứng minh khả thi cho cả 4 thứ đó).

### Theme CÔ LẬP theo route (bí quyết để nhiều style sống chung 1 repo)
Mỗi trang bọc `<div className="<slug>-root">`, override token qua `body:has(.<slug>-root)` trong
`globals.css`:
```css
body:has(.<slug>-root) {
  --bg: #060609; --accent: #7d8cff; --text: #eceeff; --text-dim: #71748f;
  /* ⚠ BẪY FONT #1: @theme map --font-heading → var(--font-bebas).
     Muốn heading SERIF phải override --font-bebas (KHÔNG phải --font-heading). */
  /* --font-bebas: var(--font-cormorant), Georgia, serif;   ← chỉ khi muốn serif */
}
```
⚠ **BẪY FONT #2 (đắt, phát hiện muộn ở COMMERCIAL PORTAL):** nếu font var (`--font-display` từ `next/font`)
chỉ được định nghĩa ở **thẻ con** `.<slug>-root` (không phải ở `body`), thì override `--font-bebas` PHẢI đặt
**trên chính `.<slug>-root`**, KHÔNG trên `body:has()` — nếu không, ở tầng `body` biến `var(--font-display)`
chưa tồn tại → collapse invalid → tụt về font-body sans, và **serif không bao giờ render** dù code "đúng".
Verify bằng `getComputedStyle(h1).fontFamily`, đừng tin mắt qua ảnh nén.

→ nhiều route (`/`, `/jewelry`, `/portfolio`, `/emons`, `/lamborghini`, `/real-estate`, `/me`) mỗi cái một
vũ trụ màu, không đá nhau.

**Style CLOUDSTUDIO khác:** KHÔNG dùng `body:has()` — palette + font scoped hẳn trên `.me-root` qua biến
riêng (`--me-*`) để không đụng biến global của các route khác.

### Engine dùng chung (viết 1 lần, mọi trang xài lại — ĐỪNG viết lại)
```
/lib
  gsap-init.ts        ← registerPlugin(ScrollTrigger) + Lenis<->GSAP sync (idempotent, client-safe)
                        lenis.on("scroll", ScrollTrigger.update); gsap.ticker.add(t=>lenis.raf(t*1000));
                        gsap.ticker.lagSmoothing(0); export getLenis()
  scroll-to-section.ts← nav PIN-AWARE (đọc ScrollTrigger.start của act bị pin, KHÔNG offsetTop)
  useScrubAct.ts      ← ⭐ ĐỘNG CƠ scroll-scrubbing tái dùng (mục 5.1)
/components
  SmoothScroll.tsx    ← "use client", gọi init trong useEffect
  /ui
    CustomCursor.tsx  ← desktop-only, dot bám + ring lerp (qua attr data-cursor-hover)
    MagneticButton.tsx← nút hút theo cursor, tắt <768px
    SectionLabel.tsx  ← dash + label + motif line
```

**`lib/gsap-init.ts` (bắt buộc đúng, nếu sai animation lệch):**
```ts
gsap.registerPlugin(ScrollTrigger);
// idempotent, chỉ chạy client:
lenis = new Lenis({ duration:1.4, easing:(t)=>Math.min(1,1.001-Math.pow(2,-10*t)) });
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time)=> lenis.raf(time*1000));
gsap.ticker.lagSmoothing(0);
```

**Signature motif chung:** một đường ngang `1px` màu accent, `width:0→100%` ở đầu mỗi act. Class
`.section-line`. Xuất hiện ở MỌI style như một chữ ký.

### Config 1 chỗ (luật cứng)
Mọi nội dung ở `lib/<slug>-config.ts` — **KHÔNG hardcode trong component**: brand, copy, PROJECTS/SCENES/…,
contact (`WHATSAPP_URL` dạng `https://wa.me/84...` bỏ số 0 đầu, `MAILTO_URL`, `TEL_URL`). `layout.tsx` lấy
`metadata.title` từ config. Đã dính bẫy khi hardcode (footer Lambo hardcode toạ độ, sửa về config) — luôn
kiểm tra không có copy/số/link rải rác trong component.

---

## 4. ⭐ CÂY QUYẾT ĐỊNH: CHỌN STYLE + CHỌN NGUỒN CHUYỂN ĐỘNG

### 4A. Chọn STYLE (cảm giác)
```
Ngành gì? → tối/kịch tính (xe, tech, đồng hồ)         → CINESCROLL
          → sang/biên tập (trang sức, BĐS, mỹ phẩm)    → EDITORIAL MAISON
          → giới thiệu bản thân/studio tech trầm        → COSMIC PORTFOLIO
          → sản phẩm nhiều "mode"/hành trình             → SCENE-CAROUSEL HERO
          → brand cần "production-length" nhiều data     → BRUTALIST KINETIC EDITORIAL
          → cổng thương mại/marketplace nhưng vẫn sang   → COMMERCIAL PORTAL
          → studio/agency muốn vui, có nhân vật + AI     → CLOUDSTUDIO MASCOT
          → không cái nào khớp                           → đẻ style mới (mục 15) bằng cách MIX mục 8
```

### 4B. Chọn NGUỒN CHUYỂN ĐỘNG (câu hỏi quyết định kiến trúc)
```
Bạn CÓ video đẹp/đúng concept không?
├─ CÓ, một clip dài liền mạch, muốn "phim tua theo scroll"      → NGUỒN A · SCRUB (mục 5.1)
├─ CÓ, nhiều cảnh + clip bay camera cắt khít frame              → NGUỒN A · SCENE-CAROUSEL (mục 5.2)
├─ CÓ, chỉ cần chạy nền ambient / chèn interstitial            → NGUỒN A · LOOP/INTERSTITIAL (mục 5.3)
├─ KHÔNG, muốn nhẹ/độc bản, KHÔNG có "nhân vật sống"            → NGUỒN B · TỰ VẼ (mục 6)
│                                                                  (Canvas 2D vũ trụ, CSS-3D, GSAP reveal)
└─ KHÔNG, muốn có "nhân vật sống" tương tác/trợ lý/kéo-thả       → NGUỒN C · ENGINE TƯƠNG TÁC (mục 7)
                                                                   (mascot, dust particle, chat script, physics)
```
> Quy tắc ngón cái: **portfolio/landing tech trầm → NGUỒN B.** **Sản phẩm có video render đẹp → NGUỒN A.**
> **Studio/agency muốn "cute-pro", đáng nhớ → NGUỒN C.** Hoàn toàn có thể **lai** (nền tự vẽ + 1 act video +
> mascot góc màn hình).

---

## 5. NGUỒN A — ANIMATION TỪ VIDEO MÌNH CÓ

Ba kỹ thuật, chọn theo 4B. Điểm chung: **video `muted playsInline`**, và với web mượt thì cần encode đúng.

### 5.1 SCRUB — `video.currentTime` theo scroll (CINESCROLL / EMONS / hero Lambo & Azure Estates)

Hành trình (để hiểu vì sao chọn cách cuối):
1. ❌ Video autoplay loop thường — nhiều `<video autoPlay>` decode song song → **lag**.
2. ❌ Scrub `currentTime` trên mp4 gốc — keyframe thưa (~1/2–5s) → seek chỉ nhảy tới keyframe gần nhất →
   "chỉ di chuyển vài frame", giật.
3. ✅ **Scrub trên mp4 ALL-INTRA (mỗi frame là keyframe)** — re-encode `keyint=1` → mọi frame seekable →
   tua mượt từng frame, tiến/lùi hoàn hảo. ← **CHỌN CÁCH NÀY, mặc định cho web mới.**
4. (Tham khảo) Image Sequence + canvas — chuẩn Apple, mượt nhất nhưng nặng asset + nhiều code quản lý RAM.
   Chỉ cần khi all-intra không đủ.

Mỗi act là 1 section **được pin**; scroll lái `video.currentTime` trên timeline chuẩn hóa `[0,1]`; overlay
gắn theo %.

**ffmpeg re-encode all-intra 1080p, bỏ audio:**
```bash
ffmpeg -y -i in.mp4 -an -vf "scale=-2:1080" -c:v libx264 -preset medium -crf 20 \
  -x264-params "keyint=1:min-keyint=1:scenecut=0" -pix_fmt yuv420p out-scrub.mp4
```
File to quá → tăng `-crf` (23–26) hoặc hạ `scale=-2:720`. Còn giật khi scroll cực nhanh → tăng `scrub` lên
0.6–0.8 trong code (không phải re-encode).

**Hook tái dùng `lib/useScrubAct.ts` — hợp đồng dùng:**
```ts
useScrubAct(sectionRef, videoRef, {
  end: "+=300%",     // act chiếm bao nhiêu scroll khi pin
  scrub: 0.5,        // smoothing (ease currentTime, đỡ khựng khi scroll nhanh)
  buildOverlay(tl, mode) {
    // tl đã chuẩn hóa [0,1]; KHÔNG đụng currentTime ở đây (hook tự lo)
    gsap.set(".x-hidden", { opacity: 0, y: 40 });                                  // frame 0
    tl.fromTo(".x", {clipPath:"inset(0 100% 0 0)"}, {clipPath:"inset(0 0% 0 0)", duration:.12}, 0.12);
    tl.from(".y", {opacity:0, y:40, duration:.12}, 0.6);
  }
});
```
Bên trong hook: chờ `loadedmetadata` để biết `video.duration`; `gsap.timeline({scrollTrigger:{trigger,
start:"top top", end, pin:true, scrub, anticipatePin:1}})`; `tl.to(video,{currentTime:duration,duration:1,
ease:"none"},0)` span toàn `[0,1]`; fallback nếu `innerWidth<=768` hoặc reduced-motion → KHÔNG pin/scrub,
video `autoplay loop`, overlay chạy 1 lần khi vào màn hình; cleanup `gsap.context().revert()`.

`<video muted loop playsInline preload="auto">` **KHÔNG `autoPlay`** (scrub tự seek).

**⚠ 2 luật sống-còn khi ghép search/overlay lên hero scrub (bài học COMMERCIAL PORTAL):**
```tsx
// 1) Entrance KHÔNG nằm trong scrub timeline (nếu không headline+search opacity 0 lúc đứng yên):
useEffect(()=>{ const ctx=gsap.context(()=>{
  gsap.from(".hero-rise",{opacity:0,y:24,duration:.8,stagger:.08,delay:.15});
}, section); return()=>ctx.revert(); },[]);
// 2) Fade-out CHỈ trong scrub mode (fallback mobile/reduced-motion chạy hết timeline → sẽ giấu mất overlay):
const buildOverlay = useCallback((tl, mode)=>{
  gsap.set(".hero-fade",{opacity:1,y:0});
  if(mode!=="scrub") return;             // early-return TRƯỚC fade khi không phải scrub
  tl.to(".hero-fade",{opacity:0,y:-24},0.55);
},[]);
```

### 5.2 SCENE-CAROUSEL — cảnh loop + clip transition (EMONS_HERO, wheel-driven)

Hero điều khiển bằng **wheel** (1 notch = 1 cảnh, LOCK khi clip đang chạy), pin bằng `lenis.stop()/start()`
— **KHÔNG** ScrollTrigger pin (xem lý do trong bảng bẫy mục 11).

**Kiến trúc:** hai lớp `<video>` chồng trong `position:relative;height:100vh;overflow:hidden`:
- **Scene layer** — N video, mỗi cảnh 1 cái, `muted loop autoPlay playsInline`. Chỉ cái active hiện
  (`opacity:1`) và play; còn lại `opacity:0` + pause.
- **Transition layer** — `2·(N-1)` video: fwd + reversed cho mỗi khoảng giữa 2 cảnh. Play 1 lần (không
  loop), ẩn khi không dùng.

**State machine (refs, mirror sang state chỉ để render):**
| ref/state | ý nghĩa |
|---|---|
| `idxRef` | cảnh đang đứng |
| `targetRef` | cảnh đang bay tới |
| `lockRef` | true khi transition đang chạy → wheel bị bỏ qua |
| `engagedRef` | true khi hero sở hữu scroll (trang bị đóng băng qua Lenis) |
| `progress` (state) | 0..1 liên tục, lái progress bar mượt |

**1 notch wheel (tiến):** `wheel` (capture, preventDefault+stopImmediatePropagation) → nếu `lockRef` thì bỏ
qua. Ngược lại `goTo(idx+1)`: `lockRef=true`, hiện `trans1` (fwd, gap=idx), `play()` từ 0, đồng thời buffer
cảnh đích. `onTimeUpdate` lái `progress` (glide tab bar) và ở `currentTime≥duration-0.08` gọi `arrive(target)`.
`arrive(k)`: `idxRef=k`, play cảnh k từ 0, ẩn transition, `lockRef=false`. Fallback `setTimeout` phòng
`ended`/`timeupdate` không fire.

**Asset make-or-break:** `transK` first frame == frame `sceneK` đang đứng, last frame == `scene{K+1}` first
frame → swap opacity **tức thì (KHÔNG crossfade)**. Reversed transitions luôn tạo:
```bash
ffmpeg -i transK.mp4 -vf reverse -an -c:v libx264 -crf 20 -movflags +faststart transKr.mp4
```
**Tạo seamless loop từ 1 clip fly-through liên tục** (nếu chỉ có video dài, không có clip đã cắt sẵn):
```bash
# S=start, D=loop length, X=crossfade (vd 0.6), TOT=D+X
ffmpeg -y -ss $S -t $TOT -i src.mp4 -an -filter_complex \
 "[0:v]scale=1280:720,split=3[h][t][m];\
  [h]trim=0:$X,setpts=PTS-STARTPTS[head];\
  [t]trim=$D:$TOT,setpts=PTS-STARTPTS[tail];\
  [m]trim=$X:$D,setpts=PTS-STARTPTS[mid];\
  [tail][head]xfade=transition=fade:duration=$X:offset=0[front];\
  [front][mid]concat=n=2:v=1:a=0,format=yuv420p[v]" \
 -map "[v]" -c:v libx264 -crf 23 -movflags +faststart loop.mp4
```
Verify clip pair TRƯỚC khi wire: trích first/last frame (`ffmpeg -frames:v 1`, `-sseof -0.05`) rồi so bằng
mắt. ⚠ **KHÔNG dùng ScrollTrigger pin cho video** (re-parent DOM → video pause). ⚠ **KHÔNG seek video lớn
tới t bất kỳ** (stall) → dùng clip ngắn cắt sẵn, play từ 0.

**Config:** `HERO_SCENES[{key,label,icon,scene}]`, `HERO_TRANSITIONS[{fwd,rev}]` (length = N-1), `HERO_POSTER`.

### 5.3 LOOP AMBIENT + INTERSTITIAL (EDITORIAL MAISON)

Không scrub — video chỉ để không khí.
- **Hero loop**: cắt **đúng 1 chu kỳ** để loop khít (dò period bằng cách so frame đầu với các mốc — trích
  frame đều rồi tìm frame trùng frame gốc). `<video autoPlay muted loop playsInline preload="auto" poster>`.
  ```bash
  ffmpeg -y -ss <t0> -to <t1> -i SRC -an -vf "scale=-2:1000" -c:v libx264 -preset medium -crf 20 \
    -pix_fmt yuv420p hero-loop.mp4
  ```
- **Interstitial full-bleed**: band tối tràn ngang (KHÔNG đen 2 bên: `absolute inset-0 object-cover`), curtain
  `clip-path` slit→full khi cuộn vào / full→slit khi cuộn ra (2 ScrollTrigger scrub non-overlap), caption
  serif đè (overlay radial tối 0.55→0.9 + `text-shadow`) cho đọc rõ. GOP thường (không cần all-intra), 720p
  ~8s:
  ```bash
  ffmpeg -y -ss 0.5 -to 8.5 -i SRC -an -vf "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720" \
    -c:v libx264 -preset medium -crf 22 -pix_fmt yuv420p -movflags +faststart out.mp4
  ```
  **XOÁ raw 4K** sau khi encode.

### Asset video — chung
- ffmpeg **bản build sẵn Windows** (`Gyan.FFmpeg` / essentials zip → `bin/ffmpeg.exe`), KHÔNG source `.tar.xz`.
- Probe trước: `ffprobe -select_streams v:0 -show_entries stream=width,height,r_frame_rate,duration ...`.
- Dung lượng: desktop scrub ~10–15MB/clip, mobile <5MB; transition 1–3MB. File to → tăng `-crf`/hạ `scale`.
- Ảnh stock (khi cần): Pexels `.../photos/ID/pexels-photo-ID.jpeg?...&w=1800`; ghép **contact-sheet** bằng
  `hstack`/`vstack` (⚠ filter `tile` hay lỗi) → Read 1 sheet để chọn nhanh, tránh tốn context. Verify đồng tông.

---

## 6. NGUỒN B — TỰ TẠO ANIMATION (ZERO ASSET)

Không video, không ảnh — vẽ realtime bằng **Canvas 2D + CSS 3D + GSAP**. Nhẹ, không ffmpeg/Pexels, **độc
bản** (COSMIC PORTFOLIO). Ba khối công cụ:

### 6.1 Canvas 2D — "vũ trụ/particle field" làm nền xuyên suốt
- Canvas thuần (**KHÔNG Three.js**). Starfield: sao có `x,y,z` bay về camera `sx = cx + (x/z)*220`;
  `speed = base + p*k` với `p` = progress → warp; `p>0.18` vẽ **streak** thay chấm ("nhảy warp").
- Nebula = vài `radial-gradient` trôi bằng `sin/cos(t)`, `globalCompositeOperation="lighter"`.
- Trail fade: mỗi frame phủ `rgba(bg,.34)` thay vì clear hẳn → có đuôi.
- ⚠ Tối ưu bắt buộc: **cap `dpr` ở 2**, `count = min(700, w*h/2200)`, `prefers-reduced-motion` → vẽ 1 frame
  tĩnh rồi dừng.
- **Chia sẻ 1 `progressRef`** (vd `warpState={current:0}`) giữa nền toàn trang và element khác (màn laptop)
  → không có đường nối giữa "vũ trụ" và "thiết bị".

**`lib/cosmic-field.ts` — ref chia sẻ:**
```ts
export const warpState = { current: 0 };
```

**Chuỗi ScrollTrigger lái warp/opacity theo hành trình (số liệu đã chốt, COSMIC):**
```
1) BUILD  (reveal top bottom → top top): opacity .3→.55 ; warp .05→.14
2) REVEAL (reveal top top, end +=340% — CÙNG pin range với act reveal):
          opacity →1 (tại 0.42) ; warp →1 (tại 0.42)   ← đỉnh warp khi laptop nuốt màn
3) SETTLE (work top bottom → top top): opacity →.18 ; warp →.05
4) CONTACT(contact top center → center): opacity →.3 ; warp →.12
```
> ⚠ Đỉnh warp = 1 sẽ **kéo văng gần hết sao** → nền trống. Luôn có "nền dự phòng" (vd **vầng hành tinh**
> radial-gradient + viền khí quyển) để câu chữ ngồi trên chiều sâu, đừng để đen trống.

### 6.2 CSS 3D — thiết bị "mở/dựng" (laptop, hộp, cánh cửa...)
`perspective` ở cha, `preserve-3d` ở các tầng, `transform-origin` đúng bản lề.

⭐ **BÀI HỌC HÌNH HỌC (đắt nhất cả bộ) — chiều gập quyết định cảm giác:**
1. `rotateX DƯƠNG` = nắp ngả **RA SAU** bản lề → trông như "ngửa sâu rồi kéo lên" ❌.
   `rotateX ÂM (-88→0)` = gập **VỀ TRƯỚC**, về 0 thì **NÂNG LÊN** phía người xem = đúng động tác "mở" ✅.
2. Góc "camera" (rig) lúc đóng phải **NHỎ** (nhìn gần ngang → nắp là dải mỏng thấp = đọc là "đóng"); nhìn
   cúi nhiều sẽ tưởng đã mở. Cân bằng rig **song song** lúc mở (bắt đầu cùng lúc gập nắp), đừng để sau.
3. **BỎ `backface-hidden`** trên tấm gập-trước (nếu không nó ẩn cả tấm khi khuất → "pop" ra ngả sau).
4. Ràng buộc topo: tấm 1 mặt + camera trước KHÔNG thể vừa "mở thấy màn" vừa "đóng giấu màn" → chấp nhận để
   nội dung "chiếu sẵn", tấm bắt đầu thấp/dẹt rồi nâng.
5. (Đã thử & bỏ) Lớp phủ giả "màn tắt" (đen hoặc bạc nhôm) → bạc bị chê chói/lem màu/logo lạ khi mờ dần →
   **gỡ hẳn**; nếu cần "màn bật sáng" chỉ dùng phủ tối mờ dần.

**Số liệu chốt (timeline chuẩn hoá theo pin, COSMIC ActReveal):**
```
Pin: start "top top", end "+=340%", scrub true, pin true, anticipatePin 1, invalidateOnRefresh true
set ban đầu: #lid rotateX -88 ; #rig rotateX 7 ; reveal-line opacity 0 y 28 ; horizon opacity 0
lid   rotateX -88→0   power1.inOut dur .42 @0     ← nắp NÂNG LÊN
rig   rotateX  7→2    power1.inOut dur .36 @0.1   ← cân bằng song song
laptop scale →7.5, y -4%  power2.in dur .34 @0.52 ← phóng to nuốt viewport
laptop opacity →0                     dur .14 @0.72
horizon opacity →1   power2.out dur .22 @0.64     ← hành tinh dâng lên
reveal-line opacity→1 y→0 power3.out dur .16 @0.72
reduced/mobile: lid 0, rig 12, reveal-line & horizon hiện sẵn, không pin
```

### 6.3 GSAP — reveal chữ, per-letter, hover-tương-tác
- Reveal theo dòng: `clip-path inset(0 100% 0 0)→inset(0)`; ⚠ reveal **theo từ** phải `mr-[0.25em]` mỗi
  span, KHÔNG để space text-node trong `overflow-hidden` (dính chữ "NOTJUST").
- Per-letter billow (yoyo so le) + cong/né theo con trỏ (`quickTo` trong bán kính ~150px) → chữ "sống".
- ⚠ `gsap.set(...)` trạng thái ẩn ban đầu ở frame 0 (nếu không chữ hiện full lúc chưa scroll).
- Constellation tương tác: node-network canvas thứ 2, đường nối "với" về con trỏ; canvas **fixed** → dùng
  thẳng `clientX/Y`. Khi `opacity<0.03` bỏ qua phần tính nặng.

---

## 7. NGUỒN C — ENGINE TƯƠNG TÁC TỰ VIẾT (mascot, dust, chat, physics)

> ⚠ "Mascot" ở mục này là một **linh vật/trợ lý chat marketing cho landing page agency** (repo gốc), khác
> hoàn toàn với "Companion" của Nihongo Cinema (bạn đồng hành học tập có Journal/relationship phase —
> xem `MASCOT.md`). Chỉ tái dùng KỸ THUẬT render/tương tác (mắt dõi chuột, canvas particle, physics kéo-thả)
> nếu cần cho một mascot marketing thật sự khác của landing page; KHÔNG áp dụng mục này cho Companion.

Từ CLOUDSTUDIO MASCOT (`/me`, clone tinh thần cloudstudio.es). Style thứ 7: có "nhân vật sống" + "trợ lý AI"
+ vật lý kéo-thả, **tất cả tự viết** (không thêm dependency runtime nào).

### 7.1 Mascot — mắt dõi, nghiêng theo chuột, bấm mở chat
- SVG có `<g data-eye>` (con ngươi riêng) + `[data-lid]` (mí mắt để chớp).
- **Mắt dõi chuột:** `gsap.quickTo` x/y con ngươi theo `pointermove` (offset = hướng × R × min(1,dist/400)).
- **Nghiêng theo con trỏ:** trên cùng `pointermove`, tính tâm mascot (`getBoundingClientRect`); nếu
  dist < ~240px → `gsap.quickTo` cả `<svg>` dịch x/y về phía con trỏ (max ~9px) + rotation nhẹ (~5°), factor
  = `1 - dist/radius`; ra ngoài bán kính → hồi 0. Transform này **độc lập** với transform "travel" trên
  wrapper (tránh xung đột 2 transform trên cùng element).
- **Chớp mắt:** timer 2.6–5.8s ngẫu nhiên, `[data-lid]` `scaleY:20` `origin:top` yoyo.
- **Bấm mở chat:** click nổi bọt lên wrapper (Shell sở hữu state `assistantOpen`). Wrapper
  `pointer-events:none` nhưng phần `.mascot` con `pointer-events:auto` (để không chặn click nội dung khác).
- **Roam anchor:** `MASCOT_ANCHORS[sectionId]={x,y,scale,rot}` (% viewport) — mỗi section 1 chỗ TRỐNG khác
  nhau, đủ hướng trái/phải/trên/dưới, **verify tận mắt từng section** để không đè heading/nút/khu tương tác.
  ScrollTrigger onEnter/onEnterBack tween wrapper (tween rời rạc easing, KHÔNG scrub).

### 7.2 Dust — canvas particle morph qua hình ĐẶC
Đám mây hạt **trang trí độc lập** (không phải thân mascot), mount ở Hero/Statement.
- Canvas fill hộp cha (`ResizeObserver`, DPR-aware). ~800–1500 hạt (mobile ×0.45).
- Mỗi hạt lò xo về điểm đích của hình hiện tại + float sin nhẹ; spread ≈ `min(w,h)×0.86`.
- **Auto-morph mỗi ~4s** đổi hình → hạt nội suy sang hình mới ("đang suy nghĩ").
- Con trỏ: trong bán kính → đẩy ra + xoáy tiếp tuyến (cộng thêm lên lực lò xo); rời chuột → hồi về hình.
- `IntersectionObserver` dừng rAF khi khuất; `prefers-reduced-motion` → tĩnh.
- `lib/*-dust-shapes.ts`: `buildShapeSets(count): Pt[][]` — mỗi hình = N điểm chuẩn hoá `[-0.5,0.5]`.
  `sampleFromDraw(draw, count)` raster hình lên canvas 120px rồi lấy pixel đặc → resample.
- ⚠ **BẮT BUỘC hình ĐẶC/đậm** (nét mảnh vẽ bằng hạt đọc rất tệ): chữ weight 900, logo cách điệu dạng
  silhouette đơn giản, hình học đặc (disc/star/heart/arrow chunky). KHÔNG dùng outline/spiral/wave 1-hạt-dày.

### 7.3 Chat script — "trợ lý" điều hướng trang (không LLM/deps)
Panel mở khi bấm mascot. Script thuần, tái dựng UX "LIVE SESSION":
```ts
interface AssistantPrompt { id; label; answer /* hỗ trợ **bold** */; jump?:SectionId; mailto?:boolean; follow?:string[] }
export const ASSISTANT_INTRO = "…";
export const ASSISTANT_PROMPTS: AssistantPrompt[] = [ /* build, projects, pricing, fast, workforce, book, human */ ];
```
Mỗi prompt: câu trả lời theo ngữ cảnh (keyword **bold**), hành động trang (`jump` tới section liên quan qua
`smoothJumpTo`, và/hoặc `mailto` mở mail client), và chip follow-up. ⚠ Giá cả: nêu **mô hình** (fixed/retainer,
scale theo độ phức tạp) + "báo số sau call", KHÔNG bịa con số cụ thể.

Overlay z cao, **dim NHẸ** để thấy trang điều hướng ngầm phía sau. Bubble bot trái / user (màu accent) phải,
render `**bold**` bằng regex nhỏ. Chọn chip → append user+bot, chips = follow + "← All questions", chạy
`jump`/`mailto`. Auto-scroll đáy. Esc/backdrop đóng.

⚠ **KHÔNG BAO GIỜ nhúng credential thật** (API key, app password) vào chat/static site — dùng `mailto` mở
mail client của khách thay vì gửi mail server-side từ secret lộ trong bundle.

### 7.4 Physics tự viết — kéo & ném
Engine 2D rigid-body **không dependency**: `createWorld({gravity,restitution,friction})` →
`{add,setBounds,grab,dragTo,release,start,stop}`. `Body.x/y` = tâm; ghi
`transform:translate(x-r,y-r) rotate(angle)`. Va chạm tròn-tròn: impulse
`j=-(1+e)(rv·n)/(invA+invB)`, mass ∝ r². Body đang cầm `invMass=0`, **cập nhật `vx/vy` LIVE mỗi `dragTo`**
(không thì thả ra không văng — bẫy đã dính). Release lấy vận tốc từ ring-buffer con trỏ, clamp. `dt` clamp
`[0,1/30]`. UI: pill `position:absolute`, đổi toạ độ client→arena-local, `pointerdown/move/up` + capture,
`ResizeObserver→setBounds`, `IntersectionObserver` start/stop theo viewport.

### 7.5 Lật theme TỨC THỜI thay vì wipe/animation (khi phù hợp)
Nếu style chọn "đổi section ngay, không overlay chuyển cảnh" (CLOUDSTUDIO bỏ hẳn wipe cũ):
- 1 ScrollTrigger / mỗi `[data-bg]`, `start:"top 50%"`, `end:"bottom 50%"`, `onEnter`+`onEnterBack` →
  set thẳng `root.style.background/color` (không animation). Bắt buộc có `end` để cuộn ngược khôi phục.
- `jumpTo` (nav-dot) = **nhảy tức thời**: `lenis.scrollTo(el,{immediate:true})` + set theme thẳng, kèm cờ
  `jumping` chặn `onEnter` section đích lật theme lần 2 (reentrant — xem bẫy mục 11).
- `smoothJumpTo` (chat) = **cuộn mượt**: `lenis.scrollTo(el,{duration:1.2,easing:cubic-out})`, KHÔNG cờ
  jumping → theme lật tự nhiên khi trôi qua từng section.

---

## 8. THƯ VIỆN THIẾT BỊ CHỮ KÝ HỢP NHẤT (mix & match)

Chọn 3–6 món ghép thành một style. Cột "nguồn": A=cần video, B=tự vẽ, C=engine tương tác tự viết, —=thuần
CSS/GSAP.

| Thiết bị | Nguồn | Mô tả ngắn | Từ playbook |
|---|---|---|---|
| Scrub act (pin + currentTime) | A | Video tua theo scroll, overlay theo % | CINESCROLL |
| Scene-carousel hero | A | Wheel bay camera giữa các cảnh loop | EMONS_HERO |
| Interstitial mở/đóng cảnh | A | Band tối full-bleed, curtain clip-path | EDITORIAL |
| Hero loop ambient trong vòm | A | Video macro loop khít trong khung vòm | EDITORIAL |
| Ảnh khung VÒM + mat depth | — | Arch lồng arch, reveal "mọc" từ đáy + Ken Burns | EDITORIAL |
| Gallery card đè serif + float | — | Card trôi/parallax để chữ sau hé ra | EDITORIAL |
| Hotspot tròn đánh số trong ảnh | — | Nút số 1–4 hiện tuần tự, hover bung thẻ | EDITORIAL |
| Pedestal (bục trưng bày) | — | 1 món giữa nền tối + bóng + trôi yoyo | EDITORIAL |
| Starfield vũ trụ toàn trang | B | Canvas 2D sao bay về camera + nebula | COSMIC |
| Constellation bám chuột | B | Node-network nối về con trỏ | COSMIC |
| Thiết bị CSS-3D "mở" (laptop...) | B | Gập-trước nâng lên, màn = canvas chung | COSMIC |
| Câu chốt per-letter | — | Billow yoyo + cong theo cursor | COSMIC |
| Hero aurora + grid | — | Tên khổng lồ + radial glow blur + lưới mask | COSMIC |
| SkewDivider | — | Đường chéo gradient tự vẽ khi scroll | COSMIC |
| Magnetic button | — | Nút hút theo cursor (desktop) | chung |
| Custom cursor dot+ring | — | Dot bám + ring lerp | chung |
| FloatingMotifs parallax | — | Chip/sao lơ lửng parallax theo chuột | EDITORIAL |
| Preloader đếm 000→100 + wipe | — | Màn đen số Bebas đếm tải + hairline bar, wipe lộ hero (lenis.stop/start) | BRUTALIST |
| Kinetic marquee (velocity) | — | Dải chữ chạy vô tận, tốc độ+skew theo vận tốc scroll | BRUTALIST |
| Horizontal-scroll lineup | — | Pin section, dịch track x ngang khi cuộn dọc (3 panel) | BRUTALIST |
| Beat đảo màu (light break) | — | 1 section nền ngà giữa trang tối, scope class cục bộ | BRUTALIST |
| Feature cards + video IO-gated | A | Card editorial so le + video ambient play/pause bằng IntersectionObserver | BRUTALIST |
| Count-up spec table tied-to-scroll | A/— | Numeral khổng lồ đếm theo scrub + bảng spec mono tabular | CINESCROLL/BRUTALIST |
| Accordion grid-rows | — | FAQ mở/đóng bằng `grid-template-rows 0fr→1fr` (KHÔNG `<details>`) | BRUTALIST/CLOUDSTUDIO |
| Hero scrub + search overlay | A | flythrough scrub + thanh search glass đè (resting VISIBLE, entrance ngoài scrub) | COMMERCIAL |
| Shared filter store | — | `useSyncExternalStore` dep-free: hero search & lưới listing cùng đọc/ghi 1 filter | COMMERCIAL |
| Listing grid + filter tabs | — | Lưới card BĐS + tab All/Buy/Rent/New, hero search lái filter (defer rAF) | COMMERCIAL |
| Monogram avatar | — | Initials trên gradient (không cần ảnh người) | COMMERCIAL |
| Per-section accent override | — | `.re-light{--accent:...}` đổi sắc accent theo ngữ cảnh | COMMERCIAL |
| Mascot mắt-dõi + nghiêng chuột | C | SVG nhân vật theo dõi + nghiêng về con trỏ, bay khắp trang | CLOUDSTUDIO |
| Mascot bấm mở chat | C | Click mở panel trợ lý, điều hướng trang theo ngữ cảnh | CLOUDSTUDIO |
| Dust particle morph | C | Canvas hạt tự đổi hình ĐẶC mỗi ~4s, phản ứng con trỏ | CLOUDSTUDIO |
| Chat script điều hướng | C | Prompt gợi ý → trả lời + jump/mailto, không LLM | CLOUDSTUDIO |
| Physics kéo & ném | C | Rigid-body 2D tự viết, va chạm + quán tính | CLOUDSTUDIO |
| Lật theme tức thời (data-bg) | — | Đổi nền/chữ ngay khi qua ngưỡng section, không wipe | CLOUDSTUDIO |
| Dot-nav footprint cố định + marker trượt | — | Chấm cố định, label absolute, marker amber trượt translateY | CLOUDSTUDIO |
| Layout token đồng nhất | — | `--gutter/--section-py/--maxw` chung mọi section | CLOUDSTUDIO |
| section-line motif | — | Đường accent width 0→100% mỗi act | chung |

---

## 9. SỢI CHỈ ĐỎ & NHỊP

- **Chọn 1 through-line** cho cả trang: starfield lái bằng scroll / màu accent / motif line / mascot bay
  khắp trang. Đây là thứ khiến trang thành "một vũ trụ" chứ không phải danh sách section.
- **Nhịp sáng/tối & cường độ**: xen mảng tương phản để nghỉ mắt và tạo kịch tính.
  - Editorial: ngà chủ đạo, 1–2 mảng tối espresso — **2 interstitial là đủ**, 3 thấy lặp.
  - Cosmic: hero nhạt → **đỉnh warp ở act reveal** → dịu ở Work/Skills → nâng nhẹ ở Contact.
  - Brutalist: tối chủ đạo, **1 mảng ngà** ở Numbers cho break, 2 marquee làm divider.
  - Commercial: **tối→sáng bone→tối**, giữ 3 "beat điện ảnh" (hero flythrough, hotspot tour, câu chốt) làm
    điểm nhấn giữa các section thương mại phẳng.
  - Cloudstudio: xoay 3 tông sáng theo `data-bg`, đa số sáng, lật tức thời (không animation chuyển cảnh).
- **Nav non-sticky + floating CTA** hiện sau hero (hoặc nav to+fixed nếu style Cloudstudio); section có `id`
  để anchor; `scroll-to-section`/`jumpTo` **pin-aware** (đọc `ScrollTrigger.start` của act bị pin, đừng
  `offsetTop`).
- **Đóng trang**: câu mời + CTA (WhatsApp/email MagneticButton/Book a call) + socials + footer.

---

## 10. RESPONSIVE + REDUCED-MOTION (bắt buộc)

Không có cái này = chưa xong. Áp cho mọi style:
- `<768px` **và** `prefers-reduced-motion`: **KHÔNG pin/scrub/hijack**. Video → `autoplay loop`; overlay chạy
  1 lần khi vào màn hình (reduced-motion nhảy thẳng tới trạng thái cuối); thiết bị 3D mở/dựng sẵn; carousel
  tabs nhảy trực tiếp; canvas vẽ 1 frame tĩnh; mascot/dust/physics dừng animate liên tục, chat vẫn dùng được.
- `100dvh` (không `100vh`) cho hero để tránh nhảy khi address bar mobile ẩn/hiện.
- Custom cursor / magnetic / parallax-chuột / mascot lean: **desktop-only**, `pointer-events-none`.
- Cleanup: `gsap.context().revert()` / gỡ **mọi** listener+timer+rAF+observer (StrictMode double-mount ở dev).
- Gate mobile dùng `innerWidth < 768` để khớp Tailwind `md:` (min-width 768 = desktop) — lệch gate ở đúng
  768 (iPad dọc) sẽ kẹt panel/dead-zone.

---

## 11. ⚠️ BẢNG BẪY HỢP NHẤT TOÀN BỘ

Gộp bẫy đắt nhất từ cả 9 playbook. Đọc trước khi code.

### Font & theme
| Triệu chứng | Nguyên nhân gốc | Fix |
|---|---|---|
| Heading ra Bebas thay vì serif | `@theme` map `font-heading→--font-bebas` | Override **`--font-bebas`** (không `--font-heading`) |
| **Heading ra sans (như Arial) dù đã override serif** | Override `--font-bebas` đặt ở `body:has()` nhưng font-var (`--font-display`) chỉ định nghĩa ở **thẻ con** `.<slug>-root` → tầng body `var()` collapse invalid | Đặt override **trên chính `.<slug>-root`**, KHÔNG trên ancestor `body:has()`. Verify `getComputedStyle(h1).fontFamily` |
| Heading ra **mono** thay vì Bebas (Tailwind v4) | Class `.lb-tnum`/`.font-mono` viết trong globals.css sau `@import` là **unlayered** → thắng `.font-heading` (Tailwind emit trong `@layer utilities`) khi cùng 1 element | KHÔNG để `font-heading` + `font-mono`/`lb-tnum` trên **cùng element** (tách 2 element). Số cần width ổn định → `tabular-nums` (chỉ variant, không đổi font) |
| Route 404/build cũ/theme sai khi verify | Dev server stale / nhiều server chồng cổng | Restart dev, verify đúng cổng; check `getComputedStyle(body)['--bg']` |
| CSS-only append/đổi token không hiện dù HMR | Turbopack phục vụ `globals.css`/`.next` **stale** | `rm -rf .next` + restart TRƯỚC mỗi lần verify CSS |

### Video / scrub
| Triệu chứng | Nguyên nhân gốc | Fix |
|---|---|---|
| Trang lag dù máy ổn | Nhiều `<video autoPlay>` decode song song | Scrub (video paused, chỉ seek) hoặc IntersectionObserver play/pause |
| Scrub "chỉ nhúc nhích vài frame" | Keyframe thưa trong mp4 | Re-encode all-intra `keyint=1` |
| Video **pause** khi pin | ScrollTrigger `pin` re-parent `<video>` trong DOM | Đừng pin video bằng ST; pin bằng `lenis.stop()/start()` |
| Seek video lớn tới t bất kỳ bị **stall** | File dài, seek ngẫu nhiên | Dùng clip ngắn cắt sẵn, play từ 0 |
| **Black flash** khi đổi cảnh | Crossfade 2 video trên nền tối | Frame khít → swap opacity **tức thì**, KHÔNG `transition-opacity` |
| Muted autoplay không chạy | JS `play()` init bị chặn/lệch timing (StrictMode) | Dùng **attribute `autoPlay`** rồi pause cái không active |
| `ended` fire trễ/không fire | Clip stall vài frame cuối | Kích hoạt "arrive" từ `timeupdate` tại `dur-0.08` + fallback `setTimeout` |
| Interstitial **đen 2 bên** | Stage hẹp hơn màn | Video **full-bleed** `absolute inset-0 object-cover` |
| Caption **chìm** trên video sáng | Overlay quá nhạt | Overlay radial tối 0.55→0.9 + `text-shadow` + eyebrow accent |
| Hero: headline+search **mất lúc đứng yên** | `gsap.from(".hero-rise")` nằm TRONG scrub timeline pin ở đỉnh → progress 0 = trạng thái "from" opacity 0 | Chuyển entrance ra **useEffect mount 1 lần**, ngoài scrub timeline |
| Hero overlay **ẩn trên mobile/reduced-motion** | `buildOverlay` bỏ qua `mode`; fallback chạy timeline tới hết | `buildOverlay(tl, mode)` early-return trước fade khi `mode!=="scrub"` |

### Chữ / layout
| Triệu chứng | Nguyên nhân gốc | Fix |
|---|---|---|
| Tiêu đề lớn bị **cắt cụt** ("FORG") | Nhóm chữ `absolute inset-0` → cha co lại | Cho container chiều rộng rõ ràng `w-[80%]` |
| Chữ reveal theo từ **dính** ("NOTJUST") | Space text-node bị nuốt trong `overflow-hidden` | Bỏ space; `mr-[0.25em]` mỗi span từ |
| Chữ hiện full lúc chưa scroll | `from/fromTo` chưa chạy ở progress 0 | `gsap.set(...)` trạng thái ẩn ban đầu |
| Ảnh trong khung **phẳng** | Ảnh fill sát viền | Arch-trong-arch: khung + mat padding + ảnh bo inset + inset-shadow |
| Hotspot/marker **nhảy ra góc** khi animate | Animate `scale` trên wrapper có `-translate` căn giữa | Opacity ở wrapper; **scale ở dot con** |
| Card che hết chữ sau | Card đứng yên | **Float liên tục** (layer riêng) + parallax → chữ hé |
| Float đụng rotate/parallax (mất xoay) | Nhiều nguồn set `transform` 1 element | Tách layer: rotate(inner)/parallax(outer)/float(giữa, `yPercent`) |

### Canvas / CSS-3D (Nguồn B)
| Triệu chứng | Nguyên nhân gốc | Fix |
|---|---|---|
| Nắp 3D "ngửa sau rồi kéo lên" | `rotateX` dương | Gập **âm** (−88→0): nâng về phía người xem |
| Đóng không thấy nắp, "pop" ngả sau | `backface-hidden` trên tấm gập | **Bỏ** `backface-hidden` khỏi tấm |
| Nắp gập-phẳng trông như đã mở to | `rig` nhìn cúi nhiều | Hạ `rig` lúc đóng ~7° (gần ngang) |
| Nền sau câu chốt **đen trống** | warp=1 kéo văng hết sao | Thêm **vầng hành tinh** làm nền dự phòng |

### Mascot / dust / chat / physics (Nguồn C)
| Triệu chứng | Nguyên nhân gốc | Fix |
|---|---|---|
| Dust nét mảnh đọc tệ | Outline/spiral/wave 1-hạt-dày quá mờ | Dùng hình **ĐẶC** (disc/star/heart/filled icon) + text weight 900 |
| Mascot đè nội dung / luôn nằm 1 phía | Anchor cố định không xét layout từng section | Đặt anchor ở lề TRỐNG đủ hướng, verify tận mắt TỪNG section; né vùng có nút |
| Physics "held" đóng băng vận tốc | Không cập nhật vận tốc khi đang kéo | Cập nhật `held.vx/vy` **live** mỗi `dragTo` |
| DotNav xô lệch khi đổi label | Label đẩy layout chấm | Button = chấm cố định, label `position:absolute`; marker trượt bằng `translateY`+transition |
| Reentrant theme khi nhảy tức thời | `jumpTo` scroll immediate → qua ngưỡng ScrollTrigger → `onEnter` lật theme lần 2 | Cờ `jumping` chặn `onEnter`/`onEnterBack` trong lúc nhảy, clear ở rAF sau |
| Native `scrollTo`/`scrollIntoView` không kích hoạt IO/ScrollTrigger | Không đi qua Lenis | Verify bằng cuộn wheel THẬT hoặc `jumpTo`/`smoothJumpTo` (qua lenis) |
| Nhúng credential thật vào static site | Copy-paste app password vào code | KHÔNG BAO GIỜ; dùng `mailto`; khuyên user thu hồi secret đã lộ |

### Scroll / Lenis / React / verify
| Triệu chứng | Nguyên nhân gốc | Fix |
|---|---|---|
| Verify: scroll JS bị **kéo về** | Lenis ghi đè `scrollTo`; `window.lenis` KHÔNG phải instance | **Cuộn THẬT** (wheel); chụp 2 ảnh cách nhau |
| Chỉnh `!important` live **bị mất** | GSAP scrub ghi đè inline mỗi update | Sửa **code + reload**, đừng chỉnh live |
| Browser tool `scroll` không kích wheel handler | Nó không phát DOM `wheel` event | `dispatchEvent(new WheelEvent('wheel',{deltaY:120,...}))` |
| Search set filter đúng nhưng **KHÔNG cuộn** | `setFilter()` re-render store cùng tick trước `scrollToListings()` → huỷ Lenis scroll | Defer 1 frame: `requestAnimationFrame(()=>scrollToListings())` |
| `resize_window` (MCP) không đổi `innerWidth` | Viewport render tách rời cửa sổ OS | Reload ở đúng width / suy luận bằng code, đừng tin resize |
| Lần load đầu ra fallback dù desktop | Tab automation mở <768px rồi mới giãn → useEffect latch nhánh mobile lúc mount | **Reload ở đúng width** (check `pinSpacers>0`, `video.paused==true`) |
| Horizontal-scroll kẹt panel ở đúng 768px | Gate JS `<=768` lệch Tailwind `md:` (min-width 768) | Dùng gate `< 768` cho khớp `md:` |
| Preloader khoá scroll vĩnh viễn | `lenis.stop()` không `start()` khi unmount sớm | Gọi `lenis.start()` ở **cả** onComplete **và** cleanup effect |
| MCP screenshot trả **frame đen** ngay sau scroll/jump/animation | Artifact capture, không phải bug | Verify bằng `getComputedStyle`/JS; chỉ tin ảnh khi trang đã settle |
| MCP `left_click` trên panel animate bắn nhiều click | Input tool race với animation | Verify logic bằng click **programmatic** (`el.click()`) |
| Chụp ảnh route: `save_to_disk` không ra file | Hạn chế môi trường, không có ImageMagick/ffmpeg cho việc này | Dùng `gif_creator`: ẩn dev overlay → record 1 action → export `.gif` |
| Deps React re-run cả controller mỗi lần | Giá trị "live" (flying/trans) nằm trong effect dependency array | Giữ giá trị live trong **refs**, mirror sang state chỉ để render; deps tối giản |
| StrictMode double-mount để listener/video kẹt | Cleanup thiếu | Gỡ **mọi** listener/timer/interval/observer + pause video trong cleanup |
| Cảnh báo hydration `bis_register`/tooltip dịch tiếng Việt | **Extension trình duyệt**, không phải lỗi code | Vô hại, bỏ qua |

---

## 12. VERIFY TRONG CHROME

1. **Dev server tươi**: kill server cũ, `npm run dev` (`rm -rf .next` nếu nghi ngờ cache CSS stale), hard-
   navigate. Quick tell stale: `getComputedStyle(document.body).getPropertyValue('--bg')` sai giá trị.
2. **Cuộn THẬT** (wheel/scroll thật), đừng `window.scrollTo` (Lenis + pin làm nó không đáng tin).
3. **Kích wheel handler** bằng
   `window.dispatchEvent(new WheelEvent('wheel',{deltaY:120,bubbles:true,cancelable:true}))`
   (browser tool `scroll` KHÔNG phát wheel). Đọc return (false ⇒ `preventDefault` đã chạy).
4. **Đo bằng JS** để chẩn đoán: `video.currentTime`, `getBoundingClientRect()`,
   `getComputedStyle(el).transform` (suy rotateX), `getComputedStyle(h1).fontFamily`. Đừng chỉnh `!important`
   live để nghiệm thu (scrub ghi đè).
5. **Component chạy liên tục** (marquee/canvas/dust/mascot lean) phải đo `getComputedStyle` ở **2 mốc thời
   gian** để biết nó có "chạy" chứ không chỉ "render" — cuộn lướt qua không đủ để kết luận.
6. **Cảm giác/độ nhạy** phải để **con người** phán trên chuột thật.
7. Thiết kế chủ quan → **AskUserQuestion**, đừng tự quyết.

---

## 13. BỘ PROMPT MẪU CHO TỪNG STYLE

> ⚠ Các prompt mẫu dưới đây (đặc biệt dòng `STACK:`) copy nguyên văn từ repo gốc (Next 16/Tailwind v4) —
> nếu dùng làm khung cho một trang trong repo NÀY, đổi dòng STACK sang thật của repo: Next 14 App Router,
> React 18, TS, Tailwind v3 (`tailwind.config.ts`, không `@theme`), GSAP+ScrollTrigger, Lenis — các phần
> còn lại (nguồn chuyển động, thiết bị chữ ký, sợi chỉ đỏ, nhịp, lineup, bắt buộc responsive/reduced-motion)
> vẫn dùng được nguyên xi.

### 13.0 MASTER — build thẳng một trang bất kỳ (điền `<<...>>`)
```
Tạo trang <<STYLE>> "<<TÊN>>" theo GRAND_PLAYBOOK.md (+ playbook con <<tên style>> nếu cần chi tiết sâu).
Đọc node_modules/next/dist/docs/ trước — đây KHÔNG phải Next.js bạn từng biết.

STACK: Next 16 App Router, TS, Tailwind v4 (@theme, không config), GSAP+ScrollTrigger, Lenis. Engine dùng
lại từ repo (gsap-init, SmoothScroll, MagneticButton, CustomCursor, scroll-to-section) — KHÔNG viết lại.

ROUTE app/<<slug>>/ cùng repo, theme cô lập body:has(.<<slug>>-root):
  --bg <<near-black có sắc hoặc sáng>> ; --accent <<1 màu nhấn>> ; --text ; --text-dim.
  <<Serif? → override --font-bebas TRÊN CHÍNH .<<slug>>-root, không trên body:has()>>.
  Config 1 chỗ lib/<<slug>>-config.ts (brand/copy/contact WhatsApp+mailto).

NGUỒN CHUYỂN ĐỘNG: <<A-scrub / A-carousel / A-interstitial / B-tự vẽ / C-engine tương tác>> (xem mục 5/6/7).
THIẾT BỊ CHỮ KÝ (chọn 3–6 từ mục 8): <<...>>.
SỢI CHỈ ĐỎ: <<starfield lái scroll / màu accent / motif line / mascot bay khắp trang>>.
NHỊP: <<sáng-tối/cường độ theo act>>.
LINEUP: Hero → <<act/section...>> → Contact(CTA + socials + footer). Nav non-sticky + floating CTA
  (hoặc nav to+fixed nếu style Cloudstudio), scroll-to-section/jumpTo pin-aware.

BẮT BUỘC: responsive <768px + reduced-motion (không pin/scrub/hijack, fallback tĩnh); tránh MỌI bẫy mục 11.
Build từng cụm (npx tsc --noEmit sạch + commit). VERIFY trong Chrome cuộn THẬT, dev server tươi.
Thiết kế chủ quan thì HỎI bằng lựa chọn, đừng tự quyết. Ưu tiên: motion > visual > performance.
```

### 13.1 CINESCROLL (trailer tối, scrub)
```
ACCENT 1 màu duy nhất, BG #080808. Video re-encode all-intra (keyint=1). useScrubAct pin+currentTime,
overlay theo %. 3 act: mở đầu (label+headline reveal) → số liệu (outline→fill+blur count-up) → chốt
(quote reveal + CTA). <video> không autoPlay.
```

### 13.2 EDITORIAL MAISON (bảo tàng/nhà mốt ngà)
```
Nền KEM (vd #f2ecdd), accent champagne gold, heading serif (Cormorant) — override --font-bebas.
Thiết bị: ảnh khung VÒM (reveal+Ken Burns), ảnh chip có MAT (arch lồng arch), gallery card đè serif +
FLOAT liên tục, hotspot tròn đánh số, pedestal trên nền tối, 2 interstitial video full-bleed (đủ, không
cần 3), FloatingMotifs parallax hero. Lineup: Hero→Collection→[interstitial]→Atelier→[interstitial]→
Object(tối)→Journal→Invitation(CTA+footer).
```

### 13.3 COSMIC PORTFOLIO (vũ trụ điện ảnh, zero asset)
```
BG #060609, accent indigo #7d8cff (+teal/violet nebula). GIỮ Bebas cho heading (không override).
CosmicCanvas (sao+nebula Canvas 2D, cap DPR 2, reduced→1 frame) + warpState chia sẻ giữa nền và màn
laptop. ActReveal "mở laptop" CSS-3D: gập ÂM (-88→0), rig 7→2 song song, bỏ backface-hidden, scale→7.5
nuốt viewport, vầng hành tinh làm nền câu chốt. RevealLine per-letter billow+cong theo cursor. Lineup:
Hero→Reveal(pin)→Work→SkewDivider→Skills→Contact.
```

### 13.4 SCENE-CAROUSEL HERO (Emons, wheel-driven)
```
Hero full-bleed 2 lớp video (scene loop autoPlay + fwd/rev transition), wheel 1 notch=1 cảnh + LOCK khi
transition chạy, pin bằng lenis.stop/start (KHÔNG ScrollTrigger pin), swap opacity tức thì (không
crossfade), progress bar liên tục từ transition timeupdate, tab bar nhảy trực tiếp tới cảnh, dismissable
headline card, reduced-motion fallback (scene tĩnh, tabs nhảy thẳng).
```

### 13.5 BRUTALIST KINETIC EDITORIAL (Lambo FORGED)
```
Giữ theme tối gốc (#080808/#e8540a/Bebas), KHÔNG body:has riêng. 1 beat đảo màu .lb-invert (ngà) cho
section Numbers — scope class cục bộ, không body:has. font-heading và font-mono/lb-tnum PHẢI ở 2 element
riêng (số to dùng tabular-nums). KineticMarquee: clone unit tới row≥2×viewport rồi gsap.to(x:-unitWidth,
repeat:-1). Preloader 000→100+wipe (lenis.stop/start ở cả complete&cleanup). HorizontalLineup pin+dịch x
ngang (gate <768 khớp md:). Lineup dài: Preloader→Hero(scrub)→Marquee→Capabilities→Numbers(ngà)→Feature
cards→Machine→Marquee→Heritage→Gallery→HorizontalLineup(pin)→Philosophy→Reserve→Manifesto→FAQ→Footer.
```

### 13.6 COMMERCIAL PORTAL (BĐS/marketplace luxury)
```
Nhịp tối(hero #0e0e10)→sáng bone(#f6f4ef, .re-light override --accent taupe)→tối(đóng). Nút NEUTRAL solid
(ink-trên-sáng/bone-trên-tối), KHÔNG bg-accent (tô màu = "rẻ"). Hero scrub flythrough + thanh search glass
đè (resting VISIBLE — entrance ngoài scrub timeline, fade-out chỉ trong scrub mode). Shared filter store
(useSyncExternalStore) nối hero search với listing grid (defer rAF khi scroll sau setFilter). Lineup:
Hero(tối,search)→Stats(tối)→Services(sáng)→Featured grid+filter(sáng)→Tour(tối,hotspot)→Agents(sáng,
monogram avatar)→Testimonials(sáng)→Insights(sáng)→Invitation(tối)→Footer(tối).
```

### 13.7 CLOUDSTUDIO MASCOT (studio kinetic, mascot+chat+dust)
```
Palette 3 tông SÁNG (periwinkle/paper/near-black), luôn tương phản ink/off-white cao, lật TỨC THỜI qua
data-bg (KHÔNG wipe). Layout token --gutter/--section-py/--maxw đồng nhất mọi section. 1 mascot SVG (mắt
dõi + nghiêng theo chuột, roam đủ hướng theo MASCOT_ANCHORS, bấm mở chat). DUST canvas ở hero+statement
(800-1500 hạt, morph mỗi ~4s qua hình ĐẶC, phản ứng con trỏ). Chat script (prompt→answer bold+jump/mailto+
follow, không LLM, KHÔNG bịa giá). Physics kéo-ném tự viết cho 1 khu tương tác. Nav to+fixed, dot-nav
footprint cố định+marker trượt, marquee full-bleed, cursor đổi hình khi hover, Selected Work hover ảnh
chụp thật. KHÔNG thêm dependency runtime nào. rm -rf .next trước mỗi lần verify CSS.
```

---

## 14. CHECKLIST NGHIỆM THU CHUNG

- [ ] 1 accent xuyên suốt, không màu ngoài palette, không `#000` thuần (hoặc nếu nền sáng: luôn ink/off-
      white tương phản cao).
- [ ] Sợi chỉ đỏ chạy suốt trang (starfield/accent/motif line/mascot ở mọi act hoặc section).
- [ ] Nguồn chuyển động chạy đúng: scrub tua tới/lui không nhảy frame / carousel không black-flash / tự vẽ
      mượt cap DPR / mascot-dust-chat-physics không đơ, không đè nội dung.
- [ ] Heading đúng font (không dính bẫy Bebas↔serif↔mono; verify `getComputedStyle`, không tin mắt).
- [ ] Chữ không bị cắt/dính; reveal đúng frame 0.
- [ ] Nav (non-sticky+floating CTA, hoặc to+fixed) đúng kiểu style; anchor nhảy đúng dù có act pin.
- [ ] Contact có CTA (WhatsApp/email/Book a call) + socials + footer; config 1 chỗ (không hardcode).
- [ ] `<768px` & reduced-motion vẫn đọc được (fallback tĩnh, không pin/scrub/hijack).
- [ ] Console chỉ còn cảnh báo extension vô hại; `npx tsc --noEmit` sạch; commit từng cụm.
- [ ] **Đã verify tận mắt trong Chrome, cuộn THẬT, trên dev server tươi.**
- [ ] Không nhúng credential/secret thật vào code hay bundle.

---

## 15. ĐẺ MỘT PLAYBOOK CON MỚI

Khi làm xong một style mới đáng tái dùng, "kết tinh" nó thành playbook con (như 8 cái đang có):

1. Chạy + verify tận mắt xong đã (playbook chỉ ghi thứ **đã kiểm chứng**).
2. Viết `<<STYLE>>_PLAYBOOK.md` theo khung: *khi nào dùng (bảng so với style khác) → triết lý → stack &
   theme tokens → thiết bị chữ ký → component tái dùng → lineup & nhịp → asset (nếu nguồn A) → bẫy đã gặp &
   fix → quy trình & verify → prompt mẫu → checklist → skeleton.*
3. Phần giá trị nhất = **bảng bẫy** (chuỗi sai→sửa thực tế) và **số liệu đã chốt** (góc, thời điểm timeline,
   tham số ffmpeg).
4. Cập nhật **mục 0 + mục 8 + mục 11 + mục 13** của file GRAND_PLAYBOOK này (dòng style mới, thiết bị mới,
   bẫy mới, prompt mẫu mới) + mục 0/7 của `META_PLAYBOOK.md` gốc.
5. Ghi 1 dòng vào memory index nếu là cột mốc dự án.

---

## 16. CHỈ MỤC 9 FILE GỐC (đọc sâu khi cần)

> ⚠ 9 file này thuộc repo GỐC (`lamborghini-demo`), **không tồn tại trong repo Nihongo Cinema**. Giữ bảng
> lại chỉ để biết playbook con nào tồn tại ở nơi khác, không phải đường dẫn dùng được ở đây.

| File | Nội dung chi tiết hơn mục nào ở đây |
|---|---|
| `META_PLAYBOOK.md` | Bản gốc của file này (5 style đầu, chưa gộp Brutalist/Commercial/Cloudstudio đầy đủ) |
| `CINESCROLL_PLAYBOOK.md` | Full code `useScrubAct`, `gsap-init.ts`, skeleton act, 3 bộ prompt Lambo/BĐS/trang sức |
| `EDITORIAL_MAISON_PLAYBOOK.md` | Bảng component `components/jewelry/*` đầy đủ, quy trình chọn ảnh Pexels |
| `COSMIC_PORTFOLIO_PLAYBOOK.md` | Toàn bộ code `ActReveal.tsx` mẫu, cấu trúc DOM laptop 3D chi tiết |
| `EMONS_PLAYBOOK.md` | Bản nguyên lý vanilla JS (VideoScrubber/SceneManager/Preloader) cho ai không dùng GSAP |
| `EMONS_HERO_PLAYBOOK.md` | State machine đầy đủ, step-by-step build prompt cho scene-carousel |
| `BRUTALIST_FORGED_PLAYBOOK.md` | Danh sách 16 component 1-file/section, quy trình subagent-driven |
| `COMMERCIAL_PORTAL_PLAYBOOK.md` | Bảng màu quiet-luxury đầy đủ, code `re-search-store.ts` |
| `CLOUDSTUDIO_MASCOT_PLAYBOOK.md` | Cách "đọc" trang tham chiếu trước khi clone, roam anchor từng section, 14 bẫy chi tiết |

---

*File này là bản hợp nhất của toàn bộ 9 playbook trong repo `lamborghini-demo`, tạo ngày 2026-07-28.
Bất biến xuyên suốt cả 7 style: sợi chỉ đỏ chuyển động · 1 accent · motion>visual>performance ·
build-từng-cụm-tsc-commit · verify cuộn THẬT trong Chrome · không hardcode nội dung/secret.*
