# 04 — Add the region picker below local GeoJSON upload

**What to build:** Present dependent scope, province, prefecture and child-level controls in the existing data workspace, with an explicit load action and existing collapsible status feedback.

**Blocked by:** 03 — catalog source and shared activation.

Status: ready-for-agent

- [ ] Keep the existing boundary file control visible and unchanged.
- [ ] Add `或从区域库选择` directly below the local boundary upload.
- [ ] Support the four catalog selection kinds through dependent controls.
- [ ] Use catalog-provided labels for municipalities and special hierarchy cases.
- [ ] Require an explicit `加载此区域` click; select changes alone never replace the map.
- [ ] Disable the action for incomplete or unavailable selections and label unavailable child maps clearly.
- [ ] Show busy state and selected map label while one request is active.
- [ ] Reuse the existing collapsed-success and expanded-failure Alert behavior.
- [ ] Keep the optional business-data file common to both geometry sources.
- [ ] Hide the arbitrary upload key-field selector for fixed catalog metadata while retaining it for user files.
- [ ] Keep long region tables scrolling inside the sidebar and preserve the 1920×1080 composition.
- [ ] Prove selection dependency, no eager asset fetch, explicit load, disabled empty entry, success and failure behavior in view tests.

## Comments

V1 is a source picker, not navigation. Do not add breadcrumbs, map double-click drilldown, recent maps, search or favorites.
