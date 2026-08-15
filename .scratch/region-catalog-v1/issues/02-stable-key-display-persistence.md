# 02 — Separate stable region keys from default display names

**What to build:** Allow a GeoJSON map to use one non-empty unique property as its stable region key and another non-empty, potentially duplicated property as its default display name, with backward-compatible geometry persistence.

**Blocked by:** None.

Status: ready-for-agent

- [ ] Extend GeoJSON preparation with explicit `regionKeyProperty` and `displayNameProperty` inputs.
- [ ] Require unique stable keys while allowing duplicate valid display names.
- [ ] Use stable keys for geometry, metrics, authoring rows, dirty/errors, hover, bars, badges and reconciliation.
- [ ] Initialize visualization display names from the display property.
- [ ] Keep arbitrary upload behavior unchanged by defaulting both properties to the selected legacy name property.
- [ ] Upgrade the persisted geometry package to store both properties and migrate existing versions by using the legacy property for both.
- [ ] Include both property choices in geometry identity.
- [ ] Prove 河北省 can contain two `新华区` and two `桥西区` rows with different keys and identical visible names.
- [ ] Prove refresh restores catalog geometry and Chinese defaults without restoring session-only edits or values.
- [ ] Preserve current geometry-only persistence and failure-atomic activation.

## Comments

Do not solve duplicates by appending codes to visible labels or by rewriting official `name` values. The product already has a display-name concept; deepen the source contract instead.
