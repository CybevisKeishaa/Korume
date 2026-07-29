# Korume 3D Mascot — Base Model & Rig Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a riggable base 3D model of Korume (Nihongo Cinema's Companion mascot) in Blender — body, head, eyes, ears, tail, 6 facial-expression shape keys, and a pose armature — so future work can render stills/animations at different expressions and camera angles.

**Architecture:** All geometry is built with the Blender MCP tools (`execute_blender_code` running `bpy`/`bmesh` scripts, `get_viewport_screenshot` / `get_scene_info` for verification). This is an art asset, not application code — there is no automated test suite. **The "run test" step in every task below is a visual check**: capture a viewport screenshot and compare it against the matching panel of `public/mascot/Emotion.png`, per the spec's Testing/acceptance section. Numeric coordinates given in each step are starting values the implementer nudges (via a follow-up `execute_blender_code` call) until the screenshot check passes — the same way a UI task iterates on exact pixel values. Do not skip the screenshot check to save time.

**Tech Stack:** Blender (via `mcp__blender__*` tools), Python/PIL for the one-off reference-image crop (Task 1).

## Global Constraints

- No video download/re-hosting/proxying, no user-recording handling, no AI/security endpoints are touched by this work — the CLAUDE.md §2 non-negotiables don't apply to this asset (confirmed in the design spec).
- Output is rendered media (PNG/MP4/GIF); this work must NOT add a three.js/react-three-fiber/WebGL runtime dependency to the app (design spec, Purpose section).
- Source file lives at `assets/blender/korume.blend` (outside `public/`); test renders go to `public/mascot/renders/`.
- In scope: body, head, eyes, ears, tail, 6 expression shape keys (neutral, happy, curious, surprised, sleepy, thinking), pose armature. Out of scope (do not build): scroll prop, glowing text ring, memory orb, necklace, detailed fur texture/particle system.
- Palette: cream, light jade, amber (Principled BSDF only — no fur texturing this pass).
- Every task ends by saving the `.blend` file and committing it (`git add assets/blender/korume.blend public/mascot/renders/...`) — small, frequent commits, one per task.

---

### Task 1: Reference Crops + Scene Setup

**Files:**
- Create: `assets/blender/references/turnaround_front.png`
- Create: `assets/blender/references/turnaround_side.png`
- Create: `assets/blender/references/turnaround_back.png`
- Create: `assets/blender/korume.blend`
- Create: `public/mascot/renders/.gitkeep`

**Interfaces:**
- Produces: three background-image Empties in the Blender scene named `REF_Front` (on the -Y/front view), `REF_Side` (on the -X/side view), `REF_Back` (on the +Y/back view), all scaled so the character's total height ≈ 3.0 Blender units. Every later task positions geometry against these.
- Produces: `assets/blender/korume.blend` — the file every subsequent task opens/saves.

- [ ] **Step 1: Crop the three turnaround panels out of `Emotion.png`**

`Emotion.png` is 1254×1254px. The TURNAROUND row occupies roughly the top third, four equal columns (front/side/back/3-4 view). Crop the first three:

```python
from PIL import Image
import os

src = r"C:\Users\tplon\Documents\GitHub\JPWeb\japan-web\public\mascot\Emotion.png"
out_dir = r"C:\Users\tplon\Documents\GitHub\JPWeb\japan-web\assets\blender\references"
os.makedirs(out_dir, exist_ok=True)

im = Image.open(src)
boxes = {
    "turnaround_front.png": (0, 0, 313, 445),
    "turnaround_side.png": (313, 0, 627, 445),
    "turnaround_back.png": (627, 0, 940, 445),
}
for name, box in boxes.items():
    im.crop(box).save(os.path.join(out_dir, name))
print("cropped:", list(boxes.keys()))
```

Run with the Bash tool (Pillow is already available — confirmed in Task 1 prep). Adjust the four numbers per box if the saved crop clips the character or includes a neighboring panel (open the PNG to check).

- [ ] **Step 2: Verify crops visually**

Read each of the three cropped PNGs (Read tool). Confirm: each shows exactly one full character pose (front, side, back respectively), no neighboring panel bleeding in, minimal empty margin.

Expected: PASS — three clean single-character crops. If a crop is off, redo Step 1 with adjusted box coordinates before continuing.

- [ ] **Step 3: Clear the default scene and set up reference empties in Blender**

```python
import bpy

# Remove default cube/camera/light — we'll add our own camera/light in Task 6.
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)

def add_ref_empty(name, image_path, location, rotation_euler):
    bpy.ops.object.empty_add(type='IMAGE', location=location)
    empty = bpy.context.active_object
    empty.name = name
    img = bpy.data.images.load(image_path)
    empty.data = img
    empty.empty_display_size = 3.0  # character height ~3.0 units
    empty.rotation_euler = rotation_euler
    empty.show_in_front = False
    return empty

ref_dir = r"C:\Users\tplon\Documents\GitHub\JPWeb\japan-web\assets\blender\references"
import math
add_ref_empty("REF_Front", ref_dir + r"\turnaround_front.png", (0, 0, 1.5), (math.radians(90), 0, 0))
add_ref_empty("REF_Side", ref_dir + r"\turnaround_side.png", (0, 0, 1.5), (math.radians(90), 0, math.radians(90)))
add_ref_empty("REF_Back", ref_dir + r"\turnaround_back.png", (0, 0, 1.5), (math.radians(90), 0, math.radians(180)))
print("reference empties added")
```

- [ ] **Step 4: Visual check — screenshot front orthographic view**

Call `get_viewport_screenshot`. Expected: PASS — the front-view reference image is visible, roughly centered, standing upright, filling most of the vertical frame. If it's sideways, offset, or tiny, adjust `empty_display_size`/`location`/`rotation_euler` in a follow-up `execute_blender_code` call and re-screenshot until it matches.

- [ ] **Step 5: Save the .blend file**

```python
import bpy
bpy.ops.wm.save_as_mainfile(filepath=r"C:\Users\tplon\Documents\GitHub\JPWeb\japan-web\assets\blender\korume.blend")
```

- [ ] **Step 6: Commit**

```bash
mkdir -p public/mascot/renders && touch public/mascot/renders/.gitkeep
git add assets/blender/references assets/blender/korume.blend public/mascot/renders/.gitkeep
git commit -m "chore(mascot): set up Blender scene with Korume turnaround references"
```

---

### Task 2: Body & Head Blockout

**Files:**
- Modify: `assets/blender/korume.blend`

**Interfaces:**
- Consumes: `REF_Front`/`REF_Side` empties from Task 1.
- Produces: mesh objects `Body_Head` and `Body_Torso`, each with a `Mirror` modifier (axis X) and a `Subdivision Surface` modifier (levels=2), origin at world origin. Later tasks parent/position geometry relative to these.

- [ ] **Step 1: Block out head and torso**

```python
import bpy

bpy.ops.mesh.primitive_uv_sphere_add(radius=0.8, location=(0, 0, 2.0), segments=24, ring_count=16)
head = bpy.context.active_object
head.name = "Body_Head"
head.scale = (1.0, 0.95, 1.0)

bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(0, 0, 0.75), segments=20, ring_count=14)
torso = bpy.context.active_object
torso.name = "Body_Torso"
torso.scale = (1.0, 0.85, 1.3)

for obj in (head, torso):
    m = obj.modifiers.new(name="Mirror", type='MIRROR')
    m.use_axis[0] = True
    s = obj.modifiers.new(name="Subsurf", type='SUBSURF')
    s.levels = 2
    s.render_levels = 2

bpy.ops.object.select_all(action='DESELECT')
print("head/torso blockout done")
```

- [ ] **Step 2: Visual check — front & side silhouette**

Call `get_viewport_screenshot` from the front ortho view, then reposition the 3D cursor/viewport to side ortho and screenshot again (use `execute_blender_code` with `bpy.ops.view3d.view_axis` or set `bpy.context.scene.camera` — simplest is to set the active 3D viewport's `region_3d.view_rotation` via `bpy.ops.view3d.viewpoint... `; if scripting the viewport is awkward, instead temporarily add a camera pointed from front/side, render, and delete the camera afterward).

Expected: PASS — the head is clearly larger than the torso (matches the Character Bible's "tỷ lệ đầu lớn, thân nhỏ") and the combined silhouette roughly overlaps `REF_Front`. If the head/torso ratio or position is off, adjust the `radius`/`location`/`scale` values in Step 1 and rerun.

- [ ] **Step 3: Save and commit**

```python
import bpy
bpy.ops.wm.save_mainfile()
```

```bash
git add assets/blender/korume.blend
git commit -m "feat(mascot): block out Korume head and torso"
```

---

### Task 3: Eyes & Facial Base

**Files:**
- Modify: `assets/blender/korume.blend`

**Interfaces:**
- Consumes: `Body_Head` from Task 2.
- Produces: mesh objects `Eye_R`, `Eye_Iris_R`, `Eyelid_R` — each modeled once on the +X side with its own Mirror modifier (same pattern Task 4 uses for `Ear_R`), so the left-side counterpart renders automatically without a separate object. `Eyelid_R` carries a vertex group named `"Eyelid"` that Task 7's shape keys target. Produces materials `Mat_Skin`, `Mat_Eye_Iris`, `Mat_Eye_White`.

- [ ] **Step 1: Model one eye + eyelid (right side; head's mirror modifier handles the left)**

```python
import bpy

bpy.ops.mesh.primitive_uv_sphere_add(radius=0.22, location=(0.38, -0.62, 2.05), segments=16, ring_count=12)
eye = bpy.context.active_object
eye.name = "Eye_R"
eye.scale = (1.0, 0.6, 1.0)  # flattened toward the face

bpy.ops.mesh.primitive_uv_sphere_add(radius=0.10, location=(0.38, -0.80, 2.05), segments=12, ring_count=8)
iris = bpy.context.active_object
iris.name = "Eye_Iris_R"

# Eyelid: a thin curved cap over the top of the eye, its own object so it can be a shape-key target later
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.23, location=(0.38, -0.62, 2.05), segments=16, ring_count=12)
eyelid = bpy.context.active_object
eyelid.name = "Eyelid_R"
eyelid.scale = (1.0, 0.62, 1.0)
vg = eyelid.vertex_groups.new(name="Eyelid")
vg.add(range(len(eyelid.data.vertices)), 1.0, 'REPLACE')

# Each is modeled once on the +X side and mirrored, same pattern Task 4 uses for Ear_R —
# this is what makes the left-eye/eyelid counterpart exist without a separate _L object.
for obj in (eye, iris, eyelid):
    mm = obj.modifiers.new(name="Mirror", type='MIRROR')
    mm.use_axis[0] = True

print("eye/eyelid built")
```

- [ ] **Step 2: Materials**

```python
import bpy

def make_mat(name, rgba):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = 0.35
    return mat

mat_skin = make_mat("Mat_Skin", (0.97, 0.93, 0.82, 1.0))       # cream
mat_iris = make_mat("Mat_Eye_Iris", (0.55, 0.78, 0.68, 1.0))    # light jade
mat_white = make_mat("Mat_Eye_White", (0.99, 0.98, 0.95, 1.0))  # near-white

bpy.data.objects["Body_Head"].data.materials.append(mat_skin)
bpy.data.objects["Body_Torso"].data.materials.append(mat_skin)
bpy.data.objects["Eye_R"].data.materials.append(mat_white)
bpy.data.objects["Eye_Iris_R"].data.materials.append(mat_iris)
bpy.data.objects["Eyelid_R"].data.materials.append(mat_skin)
print("materials assigned")
```

- [ ] **Step 3: Visual check — close-up face screenshot**

Call `get_viewport_screenshot` framed on the head. Expected: PASS — eyes read as oversized relative to the face (roughly a third of face width, matching `Emotion.png`'s EXPRESSIONS row NEUTRAL panel), positioned symmetrically. If too small/misplaced, adjust `radius`/`location` in Step 1 and rerun.

- [ ] **Step 4: Save and commit**

```python
import bpy
bpy.ops.wm.save_mainfile()
```

```bash
git add assets/blender/korume.blend
git commit -m "feat(mascot): add Korume eyes, eyelid vertex group, and base materials"
```

---

### Task 4: Ears (leaf/wing shape)

**Files:**
- Modify: `assets/blender/korume.blend`

**Interfaces:**
- Consumes: `Body_Head` from Task 2, `Mat_Skin` from Task 3.
- Produces: mesh object `Ear_R` (mirrored via the head's convention — modeled on +X, its own Mirror modifier) with material `Mat_Ear_Jade`. Later tasks (Task 8 armature) add an `ear.R`/`ear.L` bone parented to it.

- [ ] **Step 1: Model one ear as a tapered, curved leaf blade**

```python
import bpy
import bmesh
from mathutils import Vector

mesh = bpy.data.meshes.new("Ear_R")
obj = bpy.data.objects.new("Ear_R", mesh)
bpy.context.collection.objects.link(obj)

bm = bmesh.new()
# Leaf profile: base -> mid -> tip, built as a ribbon of quads narrowing to a point.
profile = [
    (0.00, 0.00, 0.00, 0.16),  # base: (x_offset, y_offset, z_offset, half_width)
    (0.05, -0.05, 0.35, 0.14),
    (0.10, -0.08, 0.70, 0.09),
    (0.14, -0.10, 1.00, 0.02),
]
rings = []
for x, y, z, hw in profile:
    v1 = bm.verts.new((x - hw, y, z))
    v2 = bm.verts.new((x + hw, y, z))
    rings.append((v1, v2))
for i in range(len(rings) - 1):
    a1, a2 = rings[i]
    b1, b2 = rings[i + 1]
    bm.faces.new((a1, a2, b2, b1))

bm.to_mesh(mesh)
bm.free()

obj.location = (0.45, 0.05, 2.75)
obj.rotation_euler = (0.0, -0.35, 0.25)  # tilt outward/back like the reference
m = obj.modifiers.new(name="Mirror", type='MIRROR')
# Ear is its own object (not parented to head's mirror), so give it its own solidify + mirror
m.use_axis[0] = True
solid = obj.modifiers.new(name="Solidify", type='SOLIDIFY')
solid.thickness = 0.03

mat_ear = bpy.data.materials.new("Mat_Ear_Jade")
mat_ear.use_nodes = True
mat_ear.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.62, 0.82, 0.72, 1.0)
obj.data.materials.append(mat_ear)

print("ear built")
```

- [ ] **Step 2: Visual check — front and 3/4 view screenshots**

Call `get_viewport_screenshot`. Expected: PASS — ears read as leaf/wing shapes rising from the top of the head, roughly matching the silhouette in `REF_Front`. Adjust the `profile` list's offsets/widths and `obj.location`/`rotation_euler` if the shape or angle is off, then rerun.

- [ ] **Step 3: Save and commit**

```python
import bpy
bpy.ops.wm.save_mainfile()
```

```bash
git add assets/blender/korume.blend
git commit -m "feat(mascot): add Korume leaf/wing ears"
```

---

### Task 5: Limbs & Tail

**Files:**
- Modify: `assets/blender/korume.blend`

**Interfaces:**
- Consumes: `Body_Torso` from Task 2, `Mat_Skin` from Task 3.
- Produces: mesh objects `Arm_R`, `Leg_R` (mirrored the same way as the ears) and `Tail` (mesh, converted from a Bezier curve so it keeps a clean deform-friendly edge loop for Task 8's bone chain).

- [ ] **Step 1: Short arms and legs**

```python
import bpy

bpy.ops.mesh.primitive_round_cube_add(size=(0.16, 0.16, 0.45), location=(0.45, -0.1, 0.65), arc_div=4) \
    if hasattr(bpy.ops.mesh, "primitive_round_cube_add") else \
    bpy.ops.mesh.primitive_cylinder_add(radius=0.12, depth=0.45, location=(0.45, -0.1, 0.65))
arm = bpy.context.active_object
arm.name = "Arm_R"
arm.rotation_euler = (0.3, 0, 0.2)
m = arm.modifiers.new("Mirror", 'MIRROR'); m.use_axis[0] = True
arm.modifiers.new("Subsurf", 'SUBSURF').levels = 2

bpy.ops.mesh.primitive_cylinder_add(radius=0.14, depth=0.4, location=(0.28, 0.0, 0.15))
leg = bpy.context.active_object
leg.name = "Leg_R"
m = leg.modifiers.new("Mirror", 'MIRROR'); m.use_axis[0] = True
leg.modifiers.new("Subsurf", 'SUBSURF').levels = 2

mat_skin = bpy.data.materials["Mat_Skin"]
arm.data.materials.append(mat_skin)
leg.data.materials.append(mat_skin)
print("arms/legs built")
```

- [ ] **Step 2: Tail as a curve converted to mesh**

```python
import bpy

curve_data = bpy.data.curves.new("TailCurve", type='CURVE')
curve_data.dimensions = '3D'
spline = curve_data.splines.new('BEZIER')
points = [(0, 0.4, 0.6), (0, 0.9, 1.1), (0.1, 1.3, 1.7), (0.3, 1.4, 2.3)]
spline.bezier_points.add(len(points) - 1)
for i, co in enumerate(points):
    bp = spline.bezier_points[i]
    bp.co = co
    bp.handle_left_type = bp.handle_right_type = 'AUTO'

curve_data.bevel_depth = 0.12
curve_data.bevel_resolution = 4
curve_data.taper_object = None  # tapering handled by per-point radius below
for i, bp in enumerate(spline.bezier_points):
    bp.radius = 1.0 - (i / (len(points) - 1)) * 0.7  # taper toward the tip

tail_obj = bpy.data.objects.new("Tail", curve_data)
bpy.context.collection.objects.link(tail_obj)

# Convert to mesh so it can be weight-painted/skinned by the armature in Task 8
bpy.context.view_layer.objects.active = tail_obj
tail_obj.select_set(True)
bpy.ops.object.convert(target='MESH')
tail_obj.name = "Tail"

mat_tail = bpy.data.materials.new("Mat_Tail_Amber")
mat_tail.use_nodes = True
bsdf = mat_tail.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.92, 0.80, 0.55, 1.0)
bsdf.inputs["Alpha"].default_value = 0.85
mat_tail.blend_method = 'BLEND'
tail_obj.data.materials.append(mat_tail)

print("tail built")
```

- [ ] **Step 3: Visual check — full-body silhouette, front and side**

Call `get_viewport_screenshot`. Expected: PASS — short limbs read as small paws near the body (per the Character Bible's "tay chân ngắn"), tail sweeps up and back roughly matching `REF_Side`'s tail curve. Adjust `points`/`bevel_depth`/limb `location`/`rotation_euler` and rerun if the proportions or sweep are off.

- [ ] **Step 4: Save and commit**

```python
import bpy
bpy.ops.wm.save_mainfile()
```

```bash
git add assets/blender/korume.blend
git commit -m "feat(mascot): add Korume limbs and curve-based tail"
```

---

### Task 6: Shading Pass + Test Camera/Lighting

**Files:**
- Modify: `assets/blender/korume.blend`
- Create: `public/mascot/renders/blockout_front.png`

**Interfaces:**
- Consumes: all mesh objects from Tasks 2–5.
- Produces: a `Camera` object named `Cam_Front` and three-point lighting (`Light_Key`, `Light_Fill`, `Light_Rim`) reused by every later render-verification step; a rendered PNG proving the palette reads correctly.

- [ ] **Step 1: Confirm/complete palette materials on any object still using default material**

```python
import bpy

mat_skin = bpy.data.materials["Mat_Skin"]
for name in ("Arm_R", "Leg_R"):
    obj = bpy.data.objects[name]
    if not obj.data.materials:
        obj.data.materials.append(mat_skin)
print("materials confirmed")
```

- [ ] **Step 2: Add camera + three-point lighting**

```python
import bpy
import math

cam_data = bpy.data.cameras.new("Cam_Front")
cam = bpy.data.objects.new("Cam_Front", cam_data)
bpy.context.collection.objects.link(cam)
cam.location = (0, -6, 1.8)
cam.rotation_euler = (math.radians(85), 0, 0)
bpy.context.scene.camera = cam

def add_light(name, kind, location, energy):
    ld = bpy.data.lights.new(name, type=kind)
    ld.energy = energy
    lo = bpy.data.objects.new(name, ld)
    lo.location = location
    bpy.context.collection.objects.link(lo)
    return lo

add_light("Light_Key", 'AREA', (3, -4, 4), 800)
add_light("Light_Fill", 'AREA', (-4, -3, 2), 300)
add_light("Light_Rim", 'AREA', (0, 4, 3), 400)
print("camera + lights added")
```

- [ ] **Step 3: Render and save a verification PNG**

```python
import bpy

scene = bpy.context.scene
scene.render.resolution_x = 800
scene.render.resolution_y = 800
scene.render.filepath = r"C:\Users\tplon\Documents\GitHub\JPWeb\japan-web\public\mascot\renders\blockout_front.png"
bpy.ops.render.render(write_still=True)
print("render saved")
```

- [ ] **Step 4: Visual check**

Read `public/mascot/renders/blockout_front.png` (Read tool). Expected: PASS — cream/jade/amber palette is visible and roughly matches `Korume.png`'s coloring; the figure isn't in silhouette/underlit or blown out. Adjust light `energy`/`location` and rerun Steps 2–3 if the render is too dark/bright.

- [ ] **Step 5: Save and commit**

```python
import bpy
bpy.ops.wm.save_mainfile()
```

```bash
git add assets/blender/korume.blend public/mascot/renders/blockout_front.png
git commit -m "feat(mascot): add Korume shading pass, test camera, and three-point lighting"
```

---

### Task 7: Facial Shape Keys (6 expressions)

**Files:**
- Modify: `assets/blender/korume.blend`
- Create: `public/mascot/renders/expr_neutral.png`, `expr_happy.png`, `expr_curious.png`, `expr_surprised.png`, `expr_sleepy.png`, `expr_thinking.png`

**Interfaces:**
- Consumes: `Body_Head` and `Eyelid_R` (via its `Eyelid` vertex group and Mirror modifier, which also produces the left side) from Task 3; `Cam_Front`/lighting from Task 6.
- Produces: shape keys on `Body_Head` named exactly `Basis`, `Happy`, `Curious`, `Surprised`, `Sleepy`, `Thinking` — Task 9's final render pass and any future animation work reference these exact names.

- [ ] **Step 1: Add the Basis key and one target key per expression**

```python
import bpy

head = bpy.data.objects["Body_Head"]
if head.data.shape_keys is None:
    head.shape_key_add(name="Basis")

for name in ("Happy", "Curious", "Surprised", "Sleepy", "Thinking"):
    head.shape_key_add(name=name, from_mix=False)

print([k.name for k in head.data.shape_keys.key_blocks])
```

- [ ] **Step 2: Sculpt each key by nudging the eyelid/mouth region vertices**

Eyelid vertices come from the `Eyelid` vertex group defined on `Eyelid_R` in Task 3 (its Mirror modifier renders the left side automatically, so only the right-side object needs shape keys). Because the eyelid is a separate object from `Body_Head`, drive its per-expression pose with its own shape keys, added the same way as Step 1:

```python
import bpy

def add_expr_key(obj, name, vert_offsets):
    """vert_offsets: dict[vertex_index] = (dx, dy, dz) delta from Basis."""
    if obj.data.shape_keys is None:
        obj.shape_key_add(name="Basis")
    key = obj.shape_key_add(name=name, from_mix=False)
    for idx, (dx, dy, dz) in vert_offsets.items():
        key.data[idx].co.x += dx
        key.data[idx].co.y += dy
        key.data[idx].co.z += dz

eyelid_r = bpy.data.objects["Eyelid_R"]
# Close the eyelid downward for Happy (squint) and Sleepy (mostly closed):
top_verts = {v.index: (0, 0, -0.10) for v in eyelid_r.data.vertices if v.co.z > eyelid_r.location.z}
add_expr_key(eyelid_r, "Happy", top_verts)
sleepy_verts = {v.index: (0, 0, -0.18) for v in eyelid_r.data.vertices if v.co.z > eyelid_r.location.z}
add_expr_key(eyelid_r, "Sleepy", sleepy_verts)
# Widen for Surprised (pull up/out slightly):
wide_verts = {v.index: (0, -0.03, 0.05) for v in eyelid_r.data.vertices if v.co.z > eyelid_r.location.z}
add_expr_key(eyelid_r, "Surprised", wide_verts)

print("eyelid expression keys added")
```

- [ ] **Step 3: Set each key's value to 1.0 in turn and screenshot**

```python
import bpy

head = bpy.data.objects["Body_Head"]
kb = head.data.shape_keys.key_blocks
for k in kb:
    k.value = 0.0

def preview(name):
    for k in kb:
        k.value = 1.0 if k.name == name else 0.0

preview("Happy")
print("Happy previewed — take screenshot now")
```

Call `get_viewport_screenshot` after each `preview(...)` call (one per expression: Happy, Curious, Surprised, Sleepy, Thinking, and Basis/neutral with all at 0.0).

Expected: PASS — each expression is visually distinct from neutral and roughly reads as its name (e.g. Happy = squinted/upturned eyes) when compared to the matching thumbnail in `Emotion.png`'s EXPRESSIONS row. Where a key doesn't read clearly, go back to Step 2, adjust the `vert_offsets` deltas for that key, and re-run.

- [ ] **Step 4: Render one PNG per expression**

```python
import bpy

head = bpy.data.objects["Body_Head"]
kb = head.data.shape_keys.key_blocks
scene = bpy.context.scene
scene.render.resolution_x = 800
scene.render.resolution_y = 800

names = ["Basis", "Happy", "Curious", "Surprised", "Sleepy", "Thinking"]
files = ["neutral", "happy", "curious", "surprised", "sleepy", "thinking"]
for name, fname in zip(names, files):
    for k in kb:
        k.value = 1.0 if k.name == name else 0.0
    scene.render.filepath = rf"C:\Users\tplon\Documents\GitHub\JPWeb\japan-web\public\mascot\renders\expr_{fname}.png"
    bpy.ops.render.render(write_still=True)

for k in kb:
    k.value = 0.0
print("expression renders saved")
```

- [ ] **Step 5: Save and commit**

```python
import bpy
bpy.ops.wm.save_mainfile()
```

```bash
git add assets/blender/korume.blend public/mascot/renders/expr_*.png
git commit -m "feat(mascot): add 6 facial expression shape keys for Korume"
```

---

### Task 8: Armature Rig

**Files:**
- Modify: `assets/blender/korume.blend`

**Interfaces:**
- Consumes: all mesh objects from Tasks 2–5.
- Produces: an `Armature` object named `Korume_Rig` with bones `root`, `spine`, `head`, `ear.L`, `ear.R`, `tail.01`…`tail.04`, `arm.L`, `arm.R`, `leg.L`, `leg.R`, parented over every mesh via Armature modifiers. Any future pose/camera-angle work poses this rig rather than editing mesh directly.

- [ ] **Step 1: Build the armature**

```python
import bpy

bpy.ops.object.armature_add(location=(0, 0, 0))
rig = bpy.context.active_object
rig.name = "Korume_Rig"
bpy.ops.object.mode_set(mode='EDIT')
eb = rig.data.edit_bones
eb[0].name = "root"
eb[0].head = (0, 0, 0)
eb[0].tail = (0, 0, 0.5)

def add_bone(name, parent, head, tail):
    b = eb.new(name)
    b.head = head
    b.tail = tail
    b.parent = eb[parent]
    return b

add_bone("spine", "root", (0, 0, 0.5), (0, 0, 1.2))
add_bone("head", "spine", (0, 0, 1.2), (0, 0, 2.4))
add_bone("ear.R", "head", (0.45, 0.05, 2.75), (0.55, -0.02, 3.5))
add_bone("ear.L", "head", (-0.45, 0.05, 2.75), (-0.55, -0.02, 3.5))
add_bone("arm.R", "spine", (0.45, -0.1, 0.85), (0.45, -0.1, 0.45))
add_bone("arm.L", "spine", (-0.45, -0.1, 0.85), (-0.45, -0.1, 0.45))
add_bone("leg.R", "root", (0.28, 0.0, 0.35), (0.28, 0.0, 0.0))
add_bone("leg.L", "root", (-0.28, 0.0, 0.35), (-0.28, 0.0, 0.0))
add_bone("tail.01", "root", (0, 0.4, 0.6), (0, 0.7, 0.85))
add_bone("tail.02", "tail.01", (0, 0.7, 0.85), (0, 1.05, 1.35))
add_bone("tail.03", "tail.02", (0, 1.05, 1.35), (0.15, 1.35, 1.9))
add_bone("tail.04", "tail.03", (0.15, 1.35, 1.9), (0.3, 1.4, 2.3))

bpy.ops.object.mode_set(mode='OBJECT')
print("armature built:", [b.name for b in rig.data.bones])
```

- [ ] **Step 2: Parent meshes to the armature with automatic weights**

```python
import bpy

mesh_names = ["Body_Head", "Body_Torso", "Eye_R", "Eye_Iris_R", "Eyelid_R", "Ear_R", "Arm_R", "Leg_R", "Tail"]
rig = bpy.data.objects["Korume_Rig"]

bpy.ops.object.select_all(action='DESELECT')
for name in mesh_names:
    bpy.data.objects[name].select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
print("meshes parented to armature")
```

- [ ] **Step 3: Pose-test — rotate the head and tail, screenshot**

```python
import bpy
import math

rig = bpy.data.objects["Korume_Rig"]
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE')
rig.pose.bones["head"].rotation_euler = (0, 0, math.radians(20))
rig.pose.bones["tail.03"].rotation_euler = (math.radians(15), 0, 0)
bpy.ops.object.mode_set(mode='OBJECT')
print("pose test applied")
```

Call `get_viewport_screenshot`. Expected: PASS — the head turns and the tail curls without the mesh tearing, pinching badly at joints, or leaving parts of the body behind. If a joint deforms badly, go back to Step 2 and either adjust bone `head`/`tail` positions in Step 1 or manually fix that vertex group's weights, then rerun.

- [ ] **Step 4: Reset pose to rest, save, and commit**

```python
import bpy

rig = bpy.data.objects["Korume_Rig"]
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE')
bpy.ops.pose.select_all(action='SELECT')
bpy.ops.pose.transforms_clear()
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.wm.save_mainfile()
```

```bash
git add assets/blender/korume.blend
git commit -m "feat(mascot): rig Korume with a pose armature (head, ears, limbs, tail chain)"
```

---

### Task 9: Final Verification Pass

**Files:**
- Modify: `assets/blender/korume.blend`
- Create: `public/mascot/renders/final_front.png`, `final_side.png`, `final_3q.png`

**Interfaces:**
- Consumes: everything from Tasks 1–8.
- Produces: three final reference renders proving the model + rig satisfy the design spec's acceptance criteria.

- [ ] **Step 1: Render front, side, and 3/4 views at rest pose**

```python
import bpy
import math

scene = bpy.context.scene
cam = bpy.data.objects["Cam_Front"]
scene.render.resolution_x = 1000
scene.render.resolution_y = 1000

views = {
    "final_front.png": ((0, -6, 1.8), (math.radians(85), 0, 0)),
    "final_side.png": ((6, 0, 1.8), (math.radians(85), 0, math.radians(90))),
    "final_3q.png": ((4.2, -4.2, 2.2), (math.radians(80), 0, math.radians(45))),
}
for fname, (loc, rot) in views.items():
    cam.location = loc
    cam.rotation_euler = rot
    scene.render.filepath = rf"C:\Users\tplon\Documents\GitHub\JPWeb\japan-web\public\mascot\renders\{fname}"
    bpy.ops.render.render(write_still=True)

print("final renders saved")
```

- [ ] **Step 2: Visual acceptance check**

Read all three renders plus, for comparison, `public/mascot/Emotion.png`. Expected: PASS — front-view silhouette and proportions are recognizably Korume (big head, small body, leaf ears, sweeping tail) against the TURNAROUND row; no shape key breaks the mesh at 0.0/1.0 (re-check by repeating Task 7 Step 3's `preview()` loop with screenshots if any expression wasn't re-verified after the rig was added in Task 8). If something regressed after rigging, fix the armature weights (Task 8 Step 2/3) and re-render.

- [ ] **Step 3: Save and commit**

```python
import bpy
bpy.ops.wm.save_mainfile()
```

```bash
git add assets/blender/korume.blend public/mascot/renders/final_front.png public/mascot/renders/final_side.png public/mascot/renders/final_3q.png
git commit -m "feat(mascot): final verification renders for Korume base model + rig"
```
