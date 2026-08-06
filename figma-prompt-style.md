1. Korume Design DNA
Core definition
Korume is not an admin dashboard.
It is a quiet learning world for people building a relationship with Japanese over time.
Every screen should feel like entering a room with a purpose, a mood, and a little space to breathe.

Korume should feel:

Dark cinematic
Quiet
Warm
Premium
Deliberate
Tactile
Japanese in sensibility, not in stereotype
Lightly game-inspired in atmosphere, never gamified
Personal, but never intrusive
Korume should not feel:

Corporate
Analytical
Productivity-obsessed
Dense
Over-rewarding
Social-feed-like
Neon gaming
Generic SaaS
Mental model
Pages are rooms, not dashboards.
Cards are spaces with a reason to exist, not widget containers.
Empty space is intentional. It gives learning room to settle.
Navigation is quiet infrastructure, never the visual subject.
Metrics are secondary. Reflection, direction, and next steps come first.
The Companion belongs to the world. It is never a chatbot widget, FAB, notification engine, or mascot-shaped button.
Progress is shown as a path, not as pressure.
A learner does not “complete tasks”; they continue a journey.
A lesson is a scene, a memory, or a small place to return to.
Hard visual rules
No glassmorphism.
No gradients.
No neon.
No blue-led visual language.
No floating action button.
No excessive pills.
No dense KPI dashboard.
No charts unless learning data genuinely requires them.
No decorative motion that exists only to attract attention.
No celebratory confetti, bouncing mascot, progress explosions, or arcade reward loops.
Never make the Companion dominate the screen.
2. Grid System
Desktop canvas
Korume is desktop-first, designed around large cinematic reading and study surfaces.

Viewport	Layout intent
1600px+	Full cinematic workspace; generous gutters and persistent right information column where needed
1440px	Primary desktop reference size
1280px	Compact desktop; preserve hierarchy, reduce gutters before reducing card quality
< 1024px	Collapse secondary columns; sidebar becomes compact or hidden behind a trigger
< 768px	Single-column reading and learning flow
App shell
Sidebar:             224px
Collapsed sidebar:    62px
Top toolbar:          72px
Desktop page gutter:  40px
Large page gutter:    48px
Content max width:   1500px
Right companion/info column: 280px
Primary column gap:   32px
Standard desktop layout
┌──────────────┬───────────────────────────────┬──────────────┐
│ Sidebar      │ Main content                  │ Right column │
│ 224px        │ minmax(0, 1fr)               │ 280px        │
│              │                               │              │
└──────────────┴───────────────────────────────┴──────────────┘

Column gap: 32px
Page gutters: 40px
Spacing scale
Use this scale consistently. Do not invent one-off spacing without a strong reason.

4px   micro alignment only
8px   icon/text relationships
12px  compact control spacing
16px  component internal spacing
24px  card padding / local section gap
32px  grid gap / content grouping
40px  major block separation
48px  standard section separation
64px  page-level breathing room
80px  cinematic break between major worlds
Layout rhythm
Toolbar to page content:     40px
Hero title to supporting text: 12–16px
Hero to first section:       40–48px
Section title to content:    16–20px
Shelf / card grid gap:       16px
Major sections:              48–64px
Footer interior padding:     64–80px
3. Component Rules
Card system
Cards are subdued surfaces, not floating widgets.

Default card background: #171A20
Elevated surface:        #20242C
Border:                  rgba(255,255,255,0.06)
Standard radius:         22px
Compact radius:          16px
Small radius:            12px
Large radius:            24px
Card behavior
Cards should only exist when they create a meaningful boundary.
Avoid card-inside-card-inside-card compositions.
A card may lift subtly on hover:
translateY(-2px) to translateY(-4px)
warmer border
soft shadow
Do not scale cards dramatically.
Do not use heavy outlines by default.
Do not use strong tinted backgrounds across an entire card unless it represents a special state.
Buttons
Button type	Use	Style
Primary	Main action only	Warm orange fill, dark text
Secondary	Supporting action	Elevated dark surface, subtle border
Quiet/text	Navigation, “View all”, contextual actions	No filled background by default
Icon button	Toolbar, utility	Square 32–40px, subtle hover surface
Default button radius: 12px
Large button radius:   16px
Button height:         36–44px
Primary action usage:  one main action per local section
Button rules
Orange means action, progression, or active direction.
Never use orange for every button.
“View All”, “Open Lesson”, “Explore”, and breadcrumb actions should usually be quiet/text buttons.
Avoid all-caps CTA labels unless they are compact section labels.
Typography hierarchy
Font roles
UI / body:              Plus Jakarta Sans
Emotional display / CTA: Be Vietnam Pro
Diary / long prose:     Noto Serif
Metadata / labels:      IBM Plex Mono
Japanese learning text: Noto Sans JP
Type scale
Page title:             36–48px
Editorial hero:         48–64px
Section heading:        20–28px
Card title:             12–15px
Body text:              12–14px
Supporting text:        10–12px
Eyebrow / metadata:     9–10px
Type rules
Large headings use normal to slightly negative tracking only.
Metadata uses positive tracking sparingly.
Long-form text uses generous line height.
Do not use serif type for system labels, JLPT indicators, dashboard numbers, or navigation.
Use mono only for compact metadata: dates, statuses, labels, small system indicators.
Section structure
Every content section should usually have:

Eyebrow / section label
Title
One quiet supporting sentence
Optional contextual action on the right
Content area
Do not add separators merely to make the screen look “organized.”
Use whitespace first; use a faint divider only when it creates real reading structure.

4. Color Tokens
Use actual named roles, not vague descriptions such as “dark” or “orange.”

Core palette
Background / void:      #0B0D11
Muted surface:          #12151B
Card surface:           #171A20
Elevated surface:       #20242C

Foreground:             #F5F4F0
Muted foreground:       #89909F

Primary ember:          #FF8A3D
Primary foreground:     #16100C

Warm sand / soft accent:#E8A05D

Success mint:           #75D5AD
Danger coral:           #E76557

Divider / hairline:     #26292E
Usage rules
Token	Use
#0B0D11	Page canvas, deep backdrop
#12151B	Recessed areas, input interior, quiet secondary zones
#171A20	Standard cards, dialogs, panels
#20242C	Secondary button / elevated surface
#FF8A3D	Primary CTA, focus state, active direction, meaningful progress
#E8A05D	Soft tag, gentle status, supporting warm emphasis
#75D5AD	Success, completed learning, calm positive state
#E76557	Error, failure, destructive action
#89909F	Metadata and supporting copy
Color constraints
Orange is intentional; it is not decoration.
Orange must not fill the whole page.
Warm sand is not a CTA color.
Mint should never become neon green.
Coral should appear only for real warnings/errors.
Never introduce a blue accent for “technology.”
Avoid more than one warm emphasis color in the same small component.
5. Motion Philosophy
Korume is calm because it does not demand attention.

Nothing flashy.
Nothing bouncy.
Nothing overshoots.
Nothing spins just because it can.
Motion rules
Hover transitions: 150–220ms
Drawer / panel transitions: 220–300ms
Section reveal / fade: 250–350ms
Easing: soft ease-out
No spring overshoot.
No bounce.
No elastic effects.
No parallax unless it is nearly imperceptible.
No looping decorative animation.
Allowed motion
Card lifts by 2–4px.
Borders warm slightly on hover.
Drawer slides in naturally from the side.
Accordion opens with a restrained height transition.
Content can fade in on first reveal.
Tiny arrow moves 2–4px on hover.
Companion can blink, shift an ear, or breathe subtly.
Companion motion
The Companion never bounces.
The Companion never celebrates loudly.
The Companion never interrupts.
The Companion should feel alive before it feels interactive.
6. Prompt Style Guide
Always use
Korume design language
Dark cinematic
Quiet premium learning world
Warm restrained lighting
Japanese storybook sensibility
Dark editorial interface
Large breathing space
Tactile card surfaces
Soft hairline borders
Warm orange used with restraint
Subtle game-inspired atmosphere
Not gamified
Emotionally calm
Desktop-first composition
High-quality lesson thumbnails
Clear hierarchy
Never use
Corporate dashboard
Analytics dashboard
CRM interface
Finance dashboard
Startup SaaS
Generic productivity app
Material Design
Glassmorphism
Blue accent
Neon
Cyberpunk
Gradient mesh
Floating action button
Gamification UI
XP explosion
Confetti
Leaderboard-first layout
Dense KPI cards
Excessive badges
Oversized mascot
Important wording adjustment
Không nên prepend cụm “AAA game UI” một cách nguyên xi. Nó dễ khiến model sinh HUD, XP, achievement, neon và hệ thống reward.

Dùng cụm này thay thế:

Premium Japanese story-game atmosphere,
with Nintendo-inspired attention to detail,
but without HUD, arcade UI, gamification, or reward-heavy mechanics.
7. Korume Design Constitution
Đây là block có thể prepend vào mọi prompt.

KORUME DESIGN CONSTITUTION

Korume is not an app interface.
It is a quiet place to return to while learning Japanese.

Every screen is a room.
Every room has a purpose, a mood, and space to breathe.

The learner is not completing tasks.
They are continuing a journey.

Cards are moments and places.
They are never generic dashboard widgets.

Empty space is intentional.
Do not fill every area with controls, data, or decoration.

Korume is dark, warm, cinematic, tactile, and calm.
It is premium without being luxurious for its own sake.
It is game-inspired in atmosphere, never gamified in behavior.

Progress should feel like a path.
Never like pressure.

The Companion belongs to the world.
It is never a floating assistant, chatbot widget, FAB, or notification machine.
It may observe, remember, rest, and quietly encourage.

Use warm orange only for meaningful direction, action, and active progress.
Use muted surfaces for everything else.

Avoid enterprise patterns.
Avoid dense KPI grids.
Avoid CRM, analytics, fintech, and startup SaaS language.

Never use glassmorphism, gradients, neon, blue accents, overshoot motion, or decorative bounce.

Typography carries emotion.
Spacing carries calm.
Cards create places.
Motion should be slow, subtle, and nearly invisible.

Every screen should leave the learner feeling:
“I know where I am.”
“I know what I can do next.”
“I have time.”
8. Prompt Engine Template
Dùng template này thay vì viết prompt từ đầu.

[GLOBAL DNA]
Paste the Korume Design Constitution.

[SCREEN TYPE]
Screen name:
Route / entry point:
Screen type:
- App page
- Immersive page
- Workspace
- Detail page
- Modal / drawer
- Marketing page
- Footer / ending state

Navigation:
- Existing App Nav
- Compact Nav Column
- No navigation
- Focus mode

[USER INTENT]
What is the learner trying to do here?
What emotional state should they leave with?

[INFORMATION ARCHITECTURE]
List the sections in visual order.
For each section:
- purpose
- primary content
- optional action
- whether it is persistent, collapsible, or contextual

[VISUAL HIERARCHY]
Page title:
Supporting copy:
Primary action:
Secondary action:
Most important visual object:
What must remain visually quiet:

[LAYOUT]
Desktop canvas:
Sidebar:
Toolbar:
Main column:
Right column:
Max content width:
Gutters:
Section spacing:
Grid / shelf card count:

[COMPONENT CONSTRAINTS]
Card radius:
Button styles:
Use or avoid cards:
Drawer / modal rules:
Empty states:
Loading states:
Hover behavior:

[COLOR TOKENS]
Background:
Muted:
Card:
Elevated:
Foreground:
Muted foreground:
Primary:
Soft accent:
Success:
Danger:
Divider:

[TYPOGRAPHY]
UI/body:
Display:
Serif/prose:
Mono metadata:
Japanese content:
Title size:
Section title size:
Body size:
Metadata size:

[COMPANION PRESENCE]
Does the Companion appear?
Where?
What does it do?
What must it not do?

[MOTION]
Allowed transitions:
Duration:
What never animates:
No bounce / no overshoot / no flashy effects.

[NEGATIVE PROMPT]
No enterprise dashboard.
No analytics-first layout.
No glassmorphism.
No gradients.
No blue.
No neon.
No FAB.
No dense KPI blocks.
No generic SaaS cards.
No unnecessary charts.
No gamification UI.
9. Ví dụ ngắn: Prompt Engine cho một screen
Screen: Companion Journal Detail
Type: Immersive page
Navigation: none

User intent:
The learner is reading one personal memory written by Korume.

Emotional goal:
They slow down, feel seen, and remember their progress without being shown metrics.

Layout:
Centered reading column, max 720px.
Large empty margins.
No sidebar.
No right rail.
One small back action at top.
One quiet Companion presence near the final paragraph.

Components:
No dashboard cards.
No analytics.
One subtle bookmark action.
Long prose uses Noto Serif.
Metadata uses IBM Plex Mono.

Motion:
Soft fade on entry.
Bookmark warms on hover.
Companion ear shifts once on hover.
No other animation.