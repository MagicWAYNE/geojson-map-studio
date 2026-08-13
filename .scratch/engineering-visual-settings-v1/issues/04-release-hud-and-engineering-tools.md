# 04 — Release every HUD control and engineering diagnostic

**What to build:** Make the full HUD control surface and consolidated engineering information available in the visual workspace, including runtime states, FPS, camera/config copy and carousel control needed during open-source preparation.

**Blocked by:** 01 — Establish the visual workspace and composition session.

Status: ready-for-agent

- [ ] Every legacy HUD anchor, static-disc and rotating-disc field and action has an equivalent reachable control; an inventory test prevents silent omissions.
- [ ] HUD live preview, explicit draft, apply, discard, reset and normalized JSON copy preserve current behavior.
- [ ] Partial or invalid HUD numeric text never reaches effective configuration.
- [ ] Engineering information presents FPS, render target dimensions, render scale, normal/Hover outward and inward glow states, mosaic state, bar count/range and degradation.
- [ ] Automatic region carousel can be enabled or disabled without changing editor-focus pause semantics.
- [ ] Current camera position/target, normalized complete effect config, bar/overlay config and HUD config remain inspectable or copyable from an obvious engineering location.
- [ ] Opening, closing and switching engineering pages does not reset visual state or data-authoring state.
- [ ] HUD changes apply in place without recreating its textures unnecessarily, and never recreate renderer, canvas, geometry, camera or controls.
- [ ] The obsolete standalone debug drawer and header debug toggle have no active user-facing entry once parity is complete.
- [ ] Existing HUD, carousel, debug-status and Three.js lifecycle tests remain green through the new session seam.

## Comments

Engineering terminology and normalized JSON are intentionally retained in V1. Product pruning is explicitly outside this feature.
