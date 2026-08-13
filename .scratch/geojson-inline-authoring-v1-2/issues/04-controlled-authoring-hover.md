# 04 — Coordinate editor focus with map hover

**What to build:** Highlight the map region represented by the active editor row and keep that region focused while its atomic update is inspected, without allowing automatic carousel hover to fight the editor or breaking direct map-pointer exploration.

**Blocked by:** 03 — Commit editor data through atomic update actions.

**Status:** ready-for-agent

- [ ] Focusing the checkbox, display-name input, either numeric input or row update action immediately highlights that row's stable region key.
- [ ] A region with no committed values still receives surface lift, emissive, glow and mosaic hover, but no fabricated badge or data panel.
- [ ] After a successful row update, the same region stays highlighted and its panel shows the just-committed display name, labels, values and units.
- [ ] Invalid updates retain the focused region while keeping the panel on the last committed complete values, if any.
- [ ] A map pointer directly over a region takes precedence over editor focus; leaving the map restores the active editor focus.
- [ ] Editor focus takes precedence over automatic carousel hover and pauses carousel advancement.
- [ ] Clearing editor focus resumes carousel behavior using the existing resume-delay contract rather than jumping immediately.
- [ ] Switching between editor rows transitions hover through the existing configured animation instead of snapping or activating two regions.
- [ ] Changing geometry or resetting to built-in clears stale authoring focus and cannot focus a region from the previous map.
- [ ] Hover coordination remains based on stable region keys; edited display names never become renderer identity.

## Comments

The controlled hover seam should arbitrate pointer, authoring and carousel intent in one place. Avoid parallel callers independently invoking visual state changes.
