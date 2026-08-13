# 01 — Separate stable region identity from display names

**What to build:** Let custom-map metrics carry an editable display name while all geometry matching, bar ownership and carousel behavior continue to use the original GeoJSON region identity. Hover titles show the display name, and built-in map behavior remains unchanged.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] A custom region can have a display name different from its original identity without losing its bar, hover state or geometry binding.
- [ ] Display names default to original names, are plain text, non-empty, unique and no longer than 40 Unicode characters.
- [ ] Invalid display names produce structured validation errors without changing the active map.
- [ ] The built-in map renders the same names, values, texture, effects and drilldown behavior as before.
- [ ] Focused normalized-document, bar/overlay and scene-integration tests pass.

## Comments

This is the prefactor that makes editable naming safe before storage and UI semantics change.
