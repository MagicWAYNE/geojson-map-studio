# 01 — Separate stable region identity from display names

**What to build:** Let custom-map metrics carry an editable display name while all geometry matching, bar ownership and carousel behavior continue to use the original GeoJSON region identity. Hover titles show the display name, and built-in map behavior remains unchanged.

**Blocked by:** None — can start immediately.

**Status:** ready-for-human

- [x] A custom region can have a display name different from its original identity without losing its bar, hover state or geometry binding.
- [x] Display names default to original names, are plain text, non-empty, unique and no longer than 40 Unicode characters.
- [x] Invalid display names produce structured validation errors without changing the active map.
- [x] The built-in map renders the same names, values, texture, effects and drilldown behavior as before.
- [x] Focused normalized-document, bar/overlay and scene-integration tests pass.

## Comments

This is the prefactor that makes editable naming safe before storage and UI semantics change.

Implementation evidence: 5 focused files / 99 tests passed; `npm run typecheck` and `git diff --check` passed.
