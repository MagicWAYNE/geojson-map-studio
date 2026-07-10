# Task 2: 提取并验证地图几何与边界分类

## Implementation

- Added `src/components/map/mapGeometry.ts` as the pure geometry boundary.
  - `parsePathD` parses the generated `M` / `L` / `Z` paths into rings.
  - `parseSvgRegions` groups outer rings and contained holes for each named SVG path.
  - `projectRegions` preserves the prior longest-side projection, center and SVG-y inversion.
  - `classifyBoundarySegments` normalizes edge direction, returning deduplicated outer/shared segments and original per-region segments.
- Updated `src/components/map/ChongqingMap3D.vue` to use `parseSvgRegions`, `projectRegions`, and `Region` from the geometry module. It retains the existing texture UV equations, `LineLoop` boundary rendering, mesh data, hover/tooltip handlers, click navigation, and `OrbitControls` setup. No glow rendering was added.
- Added `src/components/map/mapGeometry.test.ts` for multi-ring parsing, reverse shared edges, hole edges, and aspect-preserving projection.

## Files

- `src/components/map/mapGeometry.ts` (new)
- `src/components/map/mapGeometry.test.ts` (new)
- `src/components/map/ChongqingMap3D.vue` (modified)
- `.superpowers/sdd/task-2-report.md` (this report)

## TDD evidence

### RED

Command:

```bash
npm test -- src/components/map/mapGeometry.test.ts
```

Before `mapGeometry.ts` existed, Vitest failed to load `./mapGeometry` from `mapGeometry.test.ts`:

```text
Error: Cannot find module './mapGeometry'
Caused by: Error: Failed to load url ./mapGeometry ... Does the file exist?
```

### GREEN

After the minimal geometry implementation:

```text
✓ src/components/map/mapGeometry.test.ts (4 tests)
Test Files  1 passed (1)
Tests  4 passed (4)
```

## Verification

| Check | Result |
| --- | --- |
| Focused test | `npm test -- src/components/map/mapGeometry.test.ts`: 4/4 passed |
| Full test suite | `npm test`: 2 files, 8/8 passed |
| Typecheck | `npm run typecheck`: exit 0 |
| Production build | `npm run build`: exit 0; Vite built in 15.34s |
| Real SVG edges | `{"outer":2895,"inner":4532}` |
| Diff whitespace | `git diff --check`: passed |

The production build emitted Vite's standard warning that some existing output chunks exceed 500 kB after minification; it did not report a type or build failure.

## Self-review

- Compared the old inline projection code with `projectRegions`: both use the all-ring bounding box, `PLANE_MAX / max(width, height)`, the same center, and `(centerY - y)` y inversion.
- Compared texture mapping equations: repeat and offset values are unchanged after the extraction.
- Confirmed mesh creation, top/side material settings, `LineLoop` outline rendering, `userData`, hover/tooltip, pointer click routing, and OrbitControls code remain outside the extraction and unchanged in behavior.
- Confirmed no `Line2`, glow material, postprocessing, or visual-effect configuration was added to the 3D component.

## Concerns

- No architectural deviation from the task brief was required.
- The edge-count command validates the tracked SVG's exact multiplicities. Runtime visual behavior is preserved by the direct projection/texture-equation extraction and by leaving interaction/rendering code unchanged; no browser interaction test was added because this task's required automated acceptance checks are the geometry tests, typecheck, build, and edge-count command.
