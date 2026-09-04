# Korume 3D Mascot — Base Model & Rig (Design)

> Status: Approved by user (Trần Nguyễn Phi Long / Keishaa) on 2026-07-30.
> Source references: `MASCOT.md` (Companion Character Bible), `assets/mascot/source/Korume.png`
> (hero illustration), `assets/mascot/source/Emotion.png` (turnaround, 6 expressions, poses, wireframe).

## Purpose

Build a riggable 3D base model of Korume (the Nihongo Cinema Companion) in Blender so that
expressions and camera angles/poses can be adjusted repeatedly for future still renders and
short animations. Output is rendered media (PNG/MP4/GIF) embedded in the web app — **not** a
realtime WebGL asset. No three.js/react-three-fiber dependency is introduced by this work.

## Scope

**In scope (this pass):**
- Body, head, eyes, ears (leaf/wing shape), tail — base geometry only.
- Rig: Shape Keys on the head for the 6 reference expressions (neutral, happy, curious,
  surprised, sleepy, thinking) + a simple Armature (head, ears x2, spine/body, tail bone chain,
  limbs) for pose/camera-angle changes.
- Palette-only shading (cream / light jade / amber) via Principled BSDF — no detailed fur
  texturing yet.

**Out of scope (separate follow-up pass):** scroll prop, glowing text ring, memory orb
(Tinh Cầu Ký Ức), necklace/pendant, detailed fur texture/particle system.

## Pipeline

1. **Reference setup** — load the front/side/back turnaround panels from `Emotion.png` as
   Blender reference/background images on the corresponding axes, scaled to a consistent
   character height.
2. **Blockout** — primitives (head sphere, body capsule) + Mirror modifier (L/R symmetry) +
   Subdivision Surface modifier for the soft chibi silhouette.
3. **Head detail** — oversized eyes (eyelid geometry separated out so it can be a shape key
   target), leaf/wing ears, forehead/cheek color patches.
4. **Body + tail** — small torso, short limbs matched to reference proportions; tail built on
   a curve + bevel so it can be posed/uốn later without remodeling.
5. **Shading** — Principled BSDF materials per palette color, no fur detail yet.
6. **Rig**:
   - Shape Keys on the head mesh, one per reference expression (6 total).
   - Armature: head, ears (x2), spine/body, tail (multi-bone chain for curling), limbs —
     enough to change pose/viewing angle without breaking the silhouette.
7. **Verification** — after each major stage, capture a viewport screenshot
   (`get_viewport_screenshot`) and compare against the reference sheet before continuing.

## File organization

- Source file: `assets/blender/korume.blend` (new directory, outside `public/` — this is an
  editable source file, not a served web asset).
- Test renders during iteration: `public/mascot/renders/*.png`.

## Testing / acceptance

- Visual check only (this is an art asset, not application code): each pipeline stage is
  verified via viewport screenshot against `Emotion.png` before moving to the next stage.
- Final acceptance: a render from the front matches the reference silhouette/proportions, and
  each of the 6 shape keys produces a recognizable, distinct expression without mesh breakage
  at extremes (0.0 and 1.0 influence).
- No automated test suite applies to this work (non-negotiables in `CLAUDE.md` §7 govern app
  code, not Blender art assets).

## Non-negotiables check (CLAUDE.md §2)

Not applicable — this task does not touch video playback, user recordings, study content
licensing, or AI/security-sensitive endpoints. It is a standalone art asset.
