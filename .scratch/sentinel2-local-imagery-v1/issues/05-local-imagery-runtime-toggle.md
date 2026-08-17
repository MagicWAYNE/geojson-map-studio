# 05 — Integrate the local imagery manifest and runtime toggle

**What to build:** Add one optional local Sentinel-2 texture layer to the existing Three.js map composition and visual-settings owner without introducing an online basemap or second renderer.

**Blocked by:** Ticket 04 and resolution of overlapping user-owned changes in the current map-composition files.

Status: completed

- [x] Re-record HEAD and dirty state before editing; stop if the overlapping right-sidebar changes cannot be preserved safely.
- [x] Add a deep runtime imagery-manifest parser/resolver with injected fetch for tests.
- [x] Resolve textures from the active region-catalog source/identity; views must not reconstruct asset paths.
- [x] Add one explicit `加载本地 Sentinel-2 影像` control in the existing map-composition settings owner.
- [x] Keep current tech-blue rendering as the default and explain honestly when an entry is unavailable.
- [x] Load exactly one local image per successful activation and make no Copernicus/TianDiTu request.
- [x] Compute shared UVs from the manifest's EPSG:3857 bounds for all district meshes in the target.
- [x] Preserve holes, islands, hover, region keys, metrics, bars, glow, HUD, camera and authoring edits.
- [x] Add generation/abort guards so stale image loads cannot activate after a geometry change or reset.
- [x] Preserve the last valid rendering on 404/decode/schema/hash failure and surface an honest status.
- [x] Dispose replaced textures/material references and prove repeated toggles do not leak resources.
- [x] Follow the current visual-setting lifetime contract at launch; do not introduce a second persistence mechanism.

## Acceptance evidence

- Local static image is the only network request caused by the switch.
- Offline browser reload can load catalog geometry and its local texture.
- One canvas remains live through success, failure, rapid changes, toggles and reset.
- Automated disposal counters and browser resource inspection do not grow after repeated toggles.

Real-browser result (2026-08-16, 1920x1080): Hebei province and Xiamen prefecture aligned to their administrative geometry. After a clean reload, activating Xiamen observed only the same-origin runtime manifest and `images/prefectures/350200.jpg`. Repeated toggles, map changes, the Hainan quality waiver and a temporary missing-JPEG fault all retained exactly one canvas; the fault surfaced `本地影像响应类型不是 JPEG` and preserved the tech-blue rendering. Console inspection found no error, warning or WebGL message.
