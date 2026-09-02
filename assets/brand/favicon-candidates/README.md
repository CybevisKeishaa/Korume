# Favicon candidates

Five marks the owner generated on 2026-09-01/02 while choosing Korume's icon. **None of them ships.**
The mark actually in use is `public/korume.png`, declared in `app/[locale]/layout.tsx`'s `icons`.

They live here, and not under `public/`, for one reason: **everything under `public/` is served to
every visitor**, referenced or not. Five unused 1 MB PNGs on a public path are 5.3 MB of bandwidth
and a set of unfinished brand explorations anyone can enumerate. Nothing outside `public/` is served.

They are committed rather than deleted because they were untracked when this decision was taken, so
deleting them would have destroyed the only copy of the owner's work. Deleting them later is one
command; recovering them would not have been.

⚠️ Do not move these back under `public/`, and do not reference them from application code. If one
of them becomes the mark, downscale it into a real icon file and delete the rest.
