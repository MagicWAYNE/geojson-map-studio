# 02 — Release every map-effect control

**What to build:** Make the full legacy map-effect surface available under “地图效果”, including normal and Hover borders, outward/inward glow, surface response, mosaic particles, quality, presets, draft/live behavior, runtime diagnostics and normalized configuration copy.

**Blocked by:** 01 — Establish the visual workspace and composition session.

Status: ready-for-human

- [ ] Every control descriptor and action from the fixed-point legacy effect page has an equivalent reachable control; an inventory test prevents silent omissions.
- [ ] Normal boundary, outer core, normal outward glow and normal inward glow expose all existing fields and enable switches.
- [ ] Hover surface, emissive response, outline, lift, timing, outward glow and inward glow expose all existing fields and enable switches.
- [ ] Hover mosaic particles expose all existing color, density, cluster, cell, gap, opacity, flicker, burst, offset and seed controls.
- [ ] Existing B3 glow and blue-purple mosaic presets remain available and produce normalized known-good values.
- [ ] Render scale, maximum composition alpha and every existing pass-count control remain available.
- [ ] Live preview, explicit draft, apply, discard, scoped reset and full effect reset preserve their current semantics.
- [ ] Invalid or partial numeric text never reaches the effective visual configuration.
- [ ] Runtime channel states, degradation and actionable performance warnings are visible in engineering language.
- [ ] The complete normalized effect configuration can be copied with stale-request-safe success/failure feedback.
- [ ] Representative and boundary-value changes hot-apply without replacing renderer, canvas, base geometry, camera, controls or HUD.
- [ ] Existing effect, inward-glow, mosaic, watcher, runtime and Three.js tests stay green through the new visual-settings-session seam.

## Comments

Completeness is measured against the legacy effect control descriptors and actions at `a86da05`, not against a hand-selected “core” subset.
