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

## Review Fix

### Files

- Modified `src/components/map/mapGeometry.test.ts` with a real SVG fixture that calls `parseSvgRegions` under the `happy-dom` Vitest environment.
- Modified `package.json` and `package-lock.json` with the exact compatible development dependency `happy-dom@20.10.6` (Node 22.22.0 satisfies its Node >=20 engine requirement).

### Coverage

The fixture contains named regions `A` and `B`; `A` has an outer ring and a nested hole, while `B` reverses the shared outer edge. The test asserts the parsed names, one outer for `A`, exact hole ownership, then runs `classifyBoundarySegments` on the parsed regions and asserts one inner edge and ten outer edges.

### Command and exact result

```bash
npm test -- src/components/map/mapGeometry.test.ts
```

```text
✓ src/components/map/mapGeometry.test.ts (5 tests)
Test Files  1 passed (1)
Tests  5 passed (5)
```

Full regression after the review fix:

```text
npm test: 2 test files passed, 9 tests passed
npm run typecheck: exit 0
npm run build: exit 0 (built in 11.29s)
```

### TDD applicability

The test was added before any production-code change. Its first run failed because the required per-file `happy-dom` environment was not installed (`ERR_MODULE_NOT_FOUND` for `happy-dom`). After adding the explicitly permitted test-only dependency, it passed against the existing `parseSvgRegions` implementation. No production code was needed or changed; manufacturing a RED result by breaking working geometry logic would not have been applicable to this coverage-only review fix.

## Review Fix 2

### Compatibility correction

Replaced the test-only dependency `happy-dom@20.10.6` with exact `happy-dom@15.11.7`; no project-level `engines` declaration was added.

### Engine evidence

```bash
node --input-type=module -e 'import installed from "./node_modules/happy-dom/package.json" with { type: "json" }; import lock from "./package-lock.json" with { type: "json" }; console.log(JSON.stringify({installed:{version:installed.version,engines:installed.engines},lock:lock.packages["node_modules/happy-dom"]?.engines,projectEngines:lock.packages[""]?.engines ?? null}))'
npm ls happy-dom --depth=0
```

```text
{"installed":{"version":"15.11.7","engines":{"node":">=18.0.0"}},"lock":{"node":">=18.0.0"},"projectEngines":null}
└── happy-dom@15.11.7
```

This confirms both installed package metadata and the lockfile accept Node 18, with no project Node >=20 contract.

### Verification results

```text
npm test -- src/components/map/mapGeometry.test.ts: 5/5 passed
npm test: 2 files, 9/9 passed
npm run typecheck: exit 0
npm run build: exit 0 (built in 3.30s)
```
