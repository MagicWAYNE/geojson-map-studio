# Final Review Fix Wave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all actionable whole-branch final-review findings without changing the read-only browser migration fixture.

**Architecture:** Keep the component's single failure gate, but give continuous render and hover-progress calls direct boolean helpers that allocate no callbacks or result objects. Let the pipeline signal hover visibility threshold crossings with a boolean, derive channel status from final near/far opacity, and clamp every direct composite scalar at the shader boundary.

**Tech Stack:** Vue 3, TypeScript, Three.js, Vitest, Vite.

## Global Constraints

- Work only in `/Users/fei/cqbigscreen/.claude/worktrees/map-visual-effects` and preserve unrelated edits plus `.superpowers` reports.
- Use RED/GREEN TDD for behavior changes.
- Preserve one failure gate, detach-before-dispose, one dispose, one warning, and same-frame direct fallback.
- Do not catch errors thrown by the direct main renderer fallback.
- Do not mutate browser localStorage; migration evidence remains policy-substituted.

---

### Task 1: Hot-path status publication

**Files:**
- Modify: `src/components/map/ChongqingMap3D.vue`
- Modify: `src/components/map/ChongqingMap3D.test.ts`
- Modify: `src/components/map/mapOutwardGlowPipeline.ts`
- Modify: `src/components/map/mapOutwardGlowPipeline.test.ts`

**Interfaces:**
- Produces: `MapOutwardGlowPipeline.setRegionProgress(source, easedProgress): boolean`, where `true` means hover visibility crossed `0.001`.
- Produces: allocation-free component helpers for direct pipeline render and region-progress calls.

- [ ] Add component tests asserting repeated stable renders and stable non-crossing hover progress do not call `getStatus` or `updateEffectRuntimeStatus`, while crossings do.
- [ ] Add pipeline tests asserting `setRegionProgress` returns `true` only when aggregate hover visibility changes between ready and active.
- [ ] Run the focused tests and confirm the new assertions fail against unconditional publication and the current `void` return.
- [ ] Replace callback/result-object use in continuous render and progress paths with direct boolean helpers guarded by the existing failure handler.
- [ ] Aggregate forced multi-region configuration sync and publish once after all regions are synchronized.
- [ ] Re-run component and pipeline tests and confirm same-frame degradation, one dispose, one warning, and direct renderer error propagation remain green.

### Task 2: Effective-zero GPU gate

**Files:**
- Modify: `src/components/map/mapOutwardGlowPipeline.ts`
- Modify: `src/components/map/mapOutwardGlowPipeline.test.ts`

**Interfaces:**
- Consumes: derived `nearOpacity` and `farOpacity` from each cached channel profile.
- Produces: `zero` status and no mask/blur/composite work when both final opacities are zero.

- [ ] Add base and hover tests for effective-zero status, skipped GPU work, cached restore without blur, and first-time restore with one near/far blur build.
- [ ] Run those tests and confirm they fail because current status ignores near/far opacity ratios.
- [ ] Gate base and hover state on at least one positive final opacity without adding opacity ratios to blur signatures.
- [ ] Re-run pipeline tests and confirm opacity-ratio changes remain composite-only.

### Task 3: Shader boundary and lifecycle cleanup

**Files:**
- Modify: `src/components/map/mapOutwardGlowShaders.ts`
- Modify: `src/components/map/mapOutwardGlowShaders.test.ts`
- Modify: `src/components/map/mapGlow.ts`

**Interfaces:**
- Produces: direct `nearOpacity` and `farOpacity` uniform values finite-clamped to `0..2`, with non-finite input falling back to `0`.
- Removes: unused exported `disposeGlowBundle`.

- [ ] Add direct composite tests covering NaN, infinities, and under/overflow for both opacity uniforms together with non-finite falloff, softness, and maxAlpha.
- [ ] Run shader tests and confirm the new opacity assertions fail.
- [ ] Apply finite clamping before opacity uniform writes and re-run shader tests.
- [ ] Confirm `rg` finds no source/test caller of `disposeGlowBundle`, then remove only the dead function.

### Task 4: Verification, review, report, and browser evidence

**Files:**
- Create: `.superpowers/sdd/final-review-fix-report.md`

**Interfaces:**
- Produces: committed implementation/tests and a report containing exact command, commit, performance, and concern evidence.

- [ ] Self-review every pipeline operation and the RAF loop for callback, wrapper, snapshot, spread, or payload allocations.
- [ ] Run focused map tests, `npm test`, `npm run typecheck`, `npm run build`, and `git diff --check`.
- [ ] Review the complete diff against every finding and commit the code/test/plan changes.
- [ ] In a fresh in-app browser session, reload the current preview and collect warmed 10-second static and continuous active-hover FPS, normal status, and console errors without reading or mutating localStorage.
- [ ] Write `.superpowers/sdd/final-review-fix-report.md`, preserving existing `.superpowers` artifacts, and commit the requested report separately if it is not ignored.
