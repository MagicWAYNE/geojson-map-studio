# Split the portfolio sample from the reusable map-tool product line

Status: accepted

The original repository's `main` line remains a fixed Chongqing entrepreneurship data-big-screen portfolio sample, while the new standalone repository's `main` becomes the reusable GeoJSON map-authoring product line. Keeping the split in one history preserves the proven Three.js visual work and its provenance, but new product decisions must favor region-agnostic authoring over adding fixed industry dashboard panels; the `data-bigscreen-sample-v1` tag records the sample snapshot at the split.

## Consequences

- Changes intended only for the portfolio sample do not automatically flow into the map tool.
- Shared visual-engine fixes may be selectively ported when they preserve generic map-authoring behavior.
- A future standalone remote repository may be created from the tool line without rewriting the sample history.
