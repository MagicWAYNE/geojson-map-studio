# 05 — Prove region catalog behavior and preserve existing map authoring

**What to build:** Complete V1 with automated, 1920×1080 browser, persistence, resource and scope evidence across local upload and all catalog selection families.

**Blocked by:** 01, 02, 03 and 04.

Status: ready-for-agent

- [ ] Re-run and record the fixed 411-file data inventory and runtime package determinism.
- [ ] Prove country, province-child, province-county and prefecture-county loads in a real browser.
- [ ] Prove duplicate visible names retain distinct stable keys and controlled hover targets.
- [ ] Prove unavailable entries make no asset request.
- [ ] Prove rapid loads, reset and local upload cancel stale catalog work.
- [ ] Prove load failures retain the previous map and expand the existing Alert.
- [ ] Prove refresh restores geometry and Chinese defaults while business and visual settings reset.
- [ ] Prove repeated geometry replacements retain one canvas and do not duplicate renderer, HUD, glow, mosaic or chart resources.
- [ ] Prove existing region editing, metric updates, optional business JSON, visual controls, background controls and built-in reset remain intact.
- [ ] Run the full source suite, typecheck, production build, fixed-point diff check and worktree diff check.
- [ ] Review against `.scratch/region-catalog-v1/spec.md`, `CONTEXT.md`, ADR 0001 and current repository conventions; resolve every actionable finding.
- [ ] Record final evidence in `.scratch/region-catalog-v1/acceptance.md` and create scoped local commits.
- [ ] Preserve all pre-existing user-owned uncommitted files and report their final status separately.

## Comments

Do not equate a successful HTTP response or listening port with browser acceptance. Do not stage `.env`, `.claude/worktrees/`, `AGENT.md`, raw source responses or the temporary acquisition script.
