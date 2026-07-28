# Companion Patterns

> Design Pattern
> Status: Approved
> Version 1.1
> Depends on:
> - docs/design/design-reconciliation.md
> - docs/superpowers/specs/2026-07-16-companion-system-design.md
> - MASCOT.md
> - navigation-system.md
> - learning-surfaces.md

---

# Purpose

Companion Patterns không mô tả Companion là ai.

Companion Patterns mô tả cách mọi screen trong Nihongo Cinema nên tương tác với Companion.

Companion luôn là cùng một thực thể.

Điều thay đổi chỉ là:

- vị trí xuất hiện
- trạng thái
- mức độ hiện diện
- hành vi phù hợp với ngữ cảnh

Không screen nào được tự định nghĩa Companion theo cách riêng.

---

# Core Principle

> Presence is optional.
>
> Meaning is mandatory.

Companion không tồn tại để tăng engagement.

Companion chỉ xuất hiện khi sự hiện diện của nó làm cho hành trình học tập trở nên có ý nghĩa hơn.

Nếu không có lý do để xuất hiện,

Companion nên im lặng.

---

# The Companion Never Belongs To A Screen

Sai:

```
Dashboard
 └── Companion

Library
 └── Companion

Shadowing
 └── Companion
```

Đúng:

```
Application

    Companion

        ↓

Current Screen
```

Companion không thuộc về Dashboard.

Không thuộc Library.

Không thuộc Shadowing.

Mọi screen chỉ "đón" Companion ghé qua.

---

# Presence Levels

Companion có các mức hiện diện sau. Bảng mapping đầy đủ với runtime state machine (`CompanionState`)
nằm tại `docs/design/design-reconciliation.md` §5 — đây là bản tóm tắt.

---

## Level 0 — Hidden

Companion không được render.

Được sử dụng trong:

- Shadowing
- Review
- Dictation
- Speaking
- JLPT
- Typing

Lý do:

Việc học luôn quan trọng hơn Companion.

---

## Level 1 — Ambient

Companion hiện diện.

Không tương tác.

Không nói.

Không chuyển động đáng chú ý.

Ví dụ:

- ngồi bên cửa sổ
- đọc sách
- nhìn mưa
- ngủ
- ngắm Memory Orb

Người học không cần chú ý đến Companion.

Nhưng luôn cảm thấy nó đang ở đó.

---

## Level 2 — Observe

Companion nhận biết một sự kiện vừa xảy ra.

Không nhất thiết phải phản hồi.

Ví dụ:

- learner vừa hoàn thành movie
- learner vừa bookmark
- learner vừa mining

Companion có thể:

- nhìn lên
- nghiêng đầu
- mỉm cười nhẹ

Hoặc...

không làm gì cả.

---

## Level 3 — Address

Đây là mức hiếm nhất.

Companion chủ động gửi một thông điệp.

Ví dụ:

> "I've quietly kept this memory."

> "This sentence appeared many times."

Sau đó,

Companion quay về trạng thái Ambient.

---

## Silent — Quyết định không nói

Khác với Hidden (Dormant — không có anchor, Companion không tồn tại trên surface), Silent là một
trạng thái Active: Companion đã nhận context, đã cân nhắc, và **chủ động chọn** không nói.

Dormant ≠ Silent. Đừng gộp hai khái niệm này (chi tiết: `docs/design/design-reconciliation.md` §5).

---

# Silence Is A Valid Response

Companion không bắt buộc phản hồi.

Ví dụ:

```
Finish Shadowing

↓

emitContext()

↓

Companion

↓

Silent
```

Đây không phải bug.

Đây là chủ đích thiết kế.

---

# Context Driven

Companion không phản ứng với UI.

Companion phản ứng với Context.

Ví dụ:

Sai:

```
Click Button

↓

Companion speaks
```

Đúng:

```
Button

↓

Business Logic

↓

emitContext()

↓

Companion

↓

Decision

↓

Speak
or

Silent
```

Screen không quyết định Companion nói gì.

---

# Screen Responsibilities

Mỗi screen chỉ có ba trách nhiệm.

## Declare Anchor

Ví dụ:

Dashboard

```
Top Right
```

Journal

```
Bottom Left
```

Landing

```
Center
```

Review

```
No Anchor
```

---

## Emit Context

Ví dụ:

```
enter_dashboard

memory_created

movie_completed

empty_library

onboarding_started
```

Screen không xử lý logic.

---

## Respect Decision

Screen phải chấp nhận quyết định của Companion.

Nếu Companion chọn im lặng,

screen không được ép hiển thị.

---

# Address Rules

Companion chỉ được nói khi:

- milestone có ý nghĩa
- memory được lưu
- relationship phase thay đổi
- learner vừa hoàn thành một hành trình
- contextual discovery sau khi học

Không được nói:

- mỗi lần click
- mỗi lần review
- mỗi lần hoàn thành một câu
- mỗi lần mở app

---

# Learning Boundary

Xem **Learning Loop Boundary** đầy đủ tại `docs/design/design-reconciliation.md` §4 — bản dưới đây
là tóm tắt, file đó là canonical.

Trong các active acquisition loop, Companion luôn Hidden (Dormant — không có anchor).

Bao gồm (danh sách minh hoạ, không đầy đủ — xem §4 "conceptual, not route-based"):

- Shadowing practice
- Dictation
- SRS review
- Mining review session
- Pronunciation evaluation
- JLPT practice
- Grammar practice
- Vocabulary review
- Kanji practice
- Conversation drills
- Listening practice (hoạt động học — khác với runtime state "Listening" ở bảng Presence Levels
  bên trên, đừng nhầm hai khái niệm này)

Không avatar.

Không popup.

Không animation.

Không AI.

Không dialogue.

Bất kỳ active acquisition loop nào trong tương lai mặc định Hidden — screen phải giải trình nếu
muốn ngoại lệ, không cần giải trình để giữ Hidden.

---

# Emotional Boundary

Companion không bao giờ nói:

❌

"I know how you feel."

❌

"You seem sad."

❌

"I'm proud of you."

Thay vào đó:

✓

"I'll remember this."

✓

"This line stayed with us."

✓

"You practiced this sentence many times."

Companion chỉ nói về điều nó thực sự biết.

---

# Achievement Pattern

Companion không trao thưởng.

Sai:

> You unlocked!

> Great job!

> Amazing!

Đúng:

> Another page has been added to our journey.

Người học là nhân vật chính.

Companion chỉ chứng kiến.

---

# Ambient Motion

Animation luôn rất nhẹ.

Ví dụ:

- breathing
- blinking
- nhìn xung quanh
- tai khẽ chuyển động
- đuôi phát sáng nhẹ
- Memory Orb bay chậm

Không:

- nhảy
- vẫy tay liên tục
- chạy quanh màn hình
- animation gây mất tập trung

---

# Companion Notes

Companion notes are correct about interaction behavior today; only the visual language changes.

Visual language: Handwritten Notes thay vì chat-assistant bubble chrome (border/shadow/rounded card
kiểu chat).

Ví dụ:

━━━━━━━━━━━━

✨

This sentence seems difficult.

━━━━━━━━━━━━

Interaction behavior giữ nguyên — accessibility-driven, xem
`docs/design/design-reconciliation.md` §10:

- Auto-fade (~8s)
- Dismiss button (click/Esc) — đây không phải "nút OK xác nhận"; learner không cần bấm gì để note
  tự biến mất
- Keyboard accessibility
- Persistent live region cho screen reader

Handwritten Note là visual pattern, không phải interaction pattern thay thế. Visual simplification
không được xoá semantic functionality.

---

# Idle Life

Companion vẫn sống ngay cả khi người học không tương tác.

Ví dụ:

- đọc sách
- ngủ
- ngắm Memory Orb
- nhìn mưa
- ngồi bên cửa sổ

Không có mục tiêu.

Không gameplay.

Chỉ đơn giản là đang tồn tại.

---

# Atmosphere Awareness

Companion hòa vào Study Atmosphere.

Ví dụ:

🌧 Rain

→ nhìn mưa

☕

Coffee

→ ngồi thư giãn

🌙

Evening

→ chuyển động chậm hơn

Companion không thay đổi chủ đề.

Chỉ thay đổi cảm giác hiện diện.

---

# Things Companion Never Does

Companion không:

- nhắc học liên tục
- tạo FOMO
- spam notification
- xin người học quay lại
- quảng bá Premium
- giải thích AI
- nói về server
- nói về quota
- đóng vai chatbot
- chiếm màn hình
- làm gián đoạn việc học

---

# Design Checklist

Một screen chỉ đạt chuẩn Companion khi trả lời "Có" cho tất cả các câu hỏi sau.

□ Companion có thể hoàn toàn không xuất hiện?

□ Screen không phụ thuộc vào Companion để hoạt động?

□ Companion không làm giảm diện tích Learning Surface?

□ Companion không chen ngang việc học?

□ Companion có thể chọn im lặng?

□ Screen chỉ emit Context thay vì điều khiển Companion?

□ Companion chỉ xuất hiện khi tạo thêm ý nghĩa cho hành trình?

Nếu bất kỳ câu trả lời nào là "Không",

screen cần được thiết kế lại.

---

# Philosophy

Companion không được thiết kế để khiến người học ở lại lâu hơn.

Companion được thiết kế để khiến người học cảm thấy hành trình của mình đáng để ghi nhớ.

Đó là sự khác biệt giữa một AI Assistant và một người bạn đồng hành.