# 04 — Use business JSON as session-only editor prefill

**What to build:** Keep the existing optional business JSON input as a bulk-entry convenience: valid data prefills the same labels, units and matched region rows, unmatched data is summarized, and the user can correct the draft before applying. The uploaded JSON never becomes persisted state.

**Blocked by:** 03 — Edit visualization data for detected regions.

**Status:** ready-for-human

- [x] Valid JSON prefills both metric definitions and enables only exactly matched region rows.
- [x] Matched, missing and extra region names are summarized before Apply.
- [x] Manual edits made after prefill are used by the next Apply operation.
- [x] Selecting a different JSON explicitly replaces the prior prefill draft only after the new file validates.
- [x] Invalid or slow JSON reads disable Apply, preserve the last active map and report the filename and precise error.
- [x] JSON labels, units, display names and values are absent from the persisted geometry record and disappear after reload.
- [x] Existing file-size, row-count, exact-name and numeric validation limits remain enforced.

## Comments

This retains bulk import compatibility without weakening the free non-persistence boundary.
