# 03 — Load catalog assets through the existing geometry session

**What to build:** Add a deep catalog source that parses the catalog, resolves typed selections, fetches exactly one asset, and hands it to the same candidate preparation and activation flow used by local files.

**Blocked by:** 01 — runtime package; 02 — stable key/display persistence.

Status: ready-for-agent

- [ ] Add typed catalog parsing with schema/version validation and explicit availability.
- [ ] Expose hierarchy queries and `resolve(selection)` without leaking filename construction to views.
- [ ] Fetch only the selected asset and pass the current geometry intent's `AbortSignal` through fetch and activation.
- [ ] Refactor local upload and catalog fetch to converge before inspection, preparation and activation.
- [ ] Keep the previous active map on catalog load, validation, persistence or activation failure.
- [ ] Treat abort/stale completion as silent cancellation rather than a visible failure.
- [ ] Keep local upload usable when the catalog manifest is unavailable or invalid.
- [ ] Use the existing authoring session to clear old focus, drafts and visualization on successful geometry replacement.
- [ ] Persist selected geometry text so refresh does not refetch the catalog asset.
- [ ] Prove success, 404, malformed manifest, malformed asset, empty asset, abort and stale ordering with behavior tests.

## Comments

Do not add a second active-map source, a second geometry store, or view-owned URL conventions. The catalog is an input provider, not a new rendering path.
