# Desktop Hub and Copy Contract Design

> **Status:** Approved for planning, 2026-09-09.
> **Scope:** Re-open `shadowing-hub-plan-c2` for its desktop layout and
> no-data experience. The shared application navbar/footer follow in the next
> scoped branch; they are deliberately not folded into this repair.

## Goal

Make Korume a desktop-web experience for now: a mobile visitor receives a
clear app-store handoff, while every supported desktop width presents a fluid
two-column Shadowing Hub whose regions remain present even before the learner
has any data.

## Authorities

- `AGENTS.md`, especially reduced motion, accessibility, and one-fact-one-home.
- Figma file `IwFHZDZdHW7qsSFiNbWrkd`, Hub node `149:2`, for the populated
  Hub's hierarchy and visual language.
- `docs/design/patterns/empty-states.md` for a no-data state. The separately
  named Figma node `216:15648` is a Companion Diary state, not a Hub state,
  and must not be cited as the Hub reference.
- `docs/superpowers/specs/2026-08-07-shadowing-hub-plan-c-design.md` §4,
  except where this design explicitly supersedes its responsive/omission
  behaviour.

## 1. Viewport contract

### 1.1 Mobile is an app handoff, not a responsive web surface

At viewport widths below **1024 CSS pixels**, Korume renders only a
`MobileAppHandoff` screen. It explains that learning on a phone happens in the
mobile app and exposes two labelled external links:

- App Store \u2192 `APP_STORE_URL`
- Google Play \u2192 `PLAY_STORE_URL`

Those constants in `lib/app-stores.ts` remain the only home for the temporary
store-front-page destinations. The page must not present disabled controls,
`#` links, or an imitation mobile website.

The handoff applies at the locale root, so it covers marketing, auth,
protected, admin, and learning routes consistently. The underlying web tree
is `display: none` below the breakpoint; it is not merely visually clipped or
left in the accessibility tree. At 1024px and above the handoff is hidden and
the ordinary web route is the only exposed experience.

### 1.2 Desktop is fluid from 1024px upward

The desktop application chrome remains horizontal at every supported desktop
width. `AppNav` consumes its expanded or collapsed width; the sibling main
area uses `min-width: 0` and grows automatically when navigation closes.

`TwoColumnShell` always retains two desktop columns:

```
main: minmax(0, 1fr) | 300px continuity rail
```

The rail is never hidden, stacked, or made the only home of required learning
actions. Its 300px width is a deliberately smaller adaptation of the 340px
Figma rail. The main column and its cards reflow within the remaining width;
they must not cause document-level horizontal overflow. Content consumes the
remaining main area with tokenized gutters rather than leaving a permanently
narrow, centred column after the navigation is collapsed.

Figma node `149:2` at 1536px remains the visual calibration state. Wider and
narrower desktop viewports adapt its geometry; they are not separate designs.

## 2. Hub no-data contract

The Hub's authored order is permanent: Header, Featured, Import, My Lessons,
Search and filters, Popular, Continue Learning, Recently Added, Recommended,
and the four-card continuity rail.

No data may remove a region. It changes a region's interior to an intentional
empty state:

- **Featured:** a neutral editorial empty panel; no sample lesson or invented
  CTA.
- **My Lessons:** an empty panel that points to the already-real import
  interaction.
- **Popular, Continue, Recently Added:** neutral sections that describe what
  will appear once the corresponding recorded or editorial source exists.
- **Recommended:** an empty panel that does not claim a weakness, lesson, or
  recommendation reason.
- **Rail:** all four cards remain. A missing preparation, goal, weekly
  Shadowing record, or suggestion has quiet explanatory copy and no sample
  percentage, streak, ETA, chart, or future prediction.

The empty states follow the product's approved pattern: calm atmosphere,
explanation, a real next action when one exists, and a future-facing promise.
They do not congratulate an empty learner, pressure them, or fabricate
progress. The populated Figma Hub supplies presentation, never invented user
facts.

Existing conditional omission (`return null` for an empty library and skipped
shelf construction for empty arrays) is therefore invalid and must be
replaced. C4 remains the owner of durable import steps, percentage, and ETA;
C3 Explore and its preview drawer remain out of scope.

## 3. Copy contract

Hub and mobile-handoff copy lives in `messages/en/shadowing.json` and
`messages/vi/shadowing.json`, grouped by semantic use:

```
hub.sections.*
hub.empty.*
hub.rail.*
mobileHandoff.*
```

Components receive translated strings or translate through their namespace;
they contain no English or Vietnamese copy literals. A maintainer may change
a message value without changing component code.

A deterministic catalog-contract test makes that safe by asserting:

1. English and Vietnamese expose the same Hub/handoff leaf-key paths.
2. Every interpolated placeholder has the same name in both languages.
3. Every no-data Hub state renders in both locales without a missing-message
   error, and named actions retain their accessible names.

Changing wording is therefore safe. Renaming/removing a key or changing a
placeholder contract fails before merge with the exact offending path.

## 4. Accessibility and motion

- At 1023px the handoff exposes its title and both store links through keyboard
  navigation; desktop page landmarks are absent from the accessibility tree.
- At 1024px the desktop page exposes its normal main/nav/rail landmarks and
  has no horizontal overflow with navigation both expanded and collapsed.
- The rail remains a complementary landmark, never required for import,
  lesson opening, or search.
- Reduced motion does not hide handoff, empty-state content, rail cards, or
  controls.
- Empty-state actions use visible focus treatment and genuine destinations.

## 5. Verification

TDD defines the replacement contract before source changes:

- RTL proves each no-data section and all four no-data rail cards render in
  authored order, while populated data still uses real cards and reasons.
- Catalog tests prove key and placeholder parity across EN/VI.
- Playwright proves the mobile handoff at 1023px, desktop fluid fit at 1024px
  and Figma-calibration width, rail presence at all desktop probes, both nav
  visibility states, keyboard access, and no horizontal overflow.
- The former 390px Hub browser assertion is intentionally replaced: at that
  width the handoff, not the Hub, is the product contract.
- The final visual pass compares the populated 1536px Hub with `149:2` and
  reviews a new-learner desktop state for calm, complete empty regions.

## Explicit exclusions and sequence

- No mobile web screen or mobile learning-flow responsiveness.
- No invented App Store/Google Play product listing; both links use the store
  home pages until a listing exists.
- No C3 Explore, C4 durable import job, or fabricated learner analytics.
- Once this Hub repair passes review, the next work is a separate shared
  application-chrome task: reusable desktop navbar and Figma footer for
  future screen ports. It must read its dedicated Figma nodes before design.
