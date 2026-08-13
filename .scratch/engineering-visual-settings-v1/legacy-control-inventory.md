# Legacy visual-control inventory at `a86da05`

Status: baseline

This inventory is the mechanical completeness baseline for Engineering Visual Settings V1. Equivalent controls may move or receive generic labels, but every field and action below must be accounted for by an automated mapping test or an explicit reviewed exception.

## Composition and view

Fields:

- `layout.left`
- `layout.top`
- `layout.width`
- `layout.height`

Readouts/actions:

- synchronized number and range input for every field
- current `.pos-map` CSS text
- current OrbitControls camera `{ pos, target }` text
- copy CSS
- copy camera
- reset layout

## Map effects

### Normal boundary

- `base.innerColor`
- `base.innerWidth`
- `base.innerOpacity`
- `base.outerColor`
- `base.outerCoreWidth`

### Normal outward glow

- `base.outerGlowEnabled`
- `base.outerGlowColor`
- `base.outerGlowWidth`
- `base.outerGlowStrength`
- `base.outerGlowNearRadiusRatio`
- `base.outerGlowNearOpacityRatio`
- `base.outerGlowFarRadiusRatio`
- `base.outerGlowFarOpacityRatio`
- `base.outerGlowFalloff`
- `base.outerGlowEdgeSoftness`
- `base.outerGlowNearPasses`
- `base.outerGlowFarPasses`

### Hover surface

- `hover.surfaceColor`
- `hover.emissiveColor`
- `hover.emissiveIntensity`
- `hover.outlineColor`
- `hover.outlineWidth`
- `hover.lift`
- `hover.enterMs`
- `hover.leaveMs`

### Hover outward glow

- `hover.glowEnabled`
- `hover.glowColor`
- `hover.glowWidth`
- `hover.glowStrength`
- `hover.glowNearRadiusRatio`
- `hover.glowNearOpacityRatio`
- `hover.glowFarRadiusRatio`
- `hover.glowFarOpacityRatio`
- `hover.glowFalloff`
- `hover.glowEdgeSoftness`
- `hover.glowNearPasses`
- `hover.glowFarPasses`

### Quality

- `quality.renderScale`
- `quality.maxAlpha`

### Normal and Hover inward glow

For both `base.inwardGlow` and `hover.inwardGlow`:

- `enabled`
- `color`
- `width`
- `strength`
- `maxAlpha`
- `nearRadiusRatio`
- `nearOpacityRatio`
- `farRadiusRatio`
- `farOpacityRatio`
- `falloff`
- `edgeSoftness`
- `nearPasses`
- `farPasses`
- `baseRatio`

### Hover mosaic particles

- `hover.mosaicParticles.enabled`
- `primaryColor`
- `accentColor`
- `gapColor`
- `reseedOnEnter`
- `accentRatio`
- `density`
- `clusterChance`
- `clusterRadius`
- `clusterStrength`
- `accentClusterBias`
- `targetCellPx`
- `minCellPx`
- `maxCellPx`
- `gapRatio`
- `gapOpacity`
- `opacity`
- `brightness`
- `flickerHz`
- `dutyCycle`
- `pulseSharpness`
- `clusterFlickerScale`
- `burstDurationMs`
- `burstStrength`
- `burstDensityBoost`
- `surfaceOffset`
- `seed`

Effect actions/status:

- toggle live preview
- apply draft
- discard draft
- B3 preset per outward-glow channel
- reset per outward-glow channel
- blue-purple mosaic preset
- randomize mosaic seed
- reset mosaic group
- reset current/all effect target
- copy normalized effect JSON
- normal outward status
- Hover outward status
- normal inward status
- Hover inward status
- mosaic status
- render target size and render scale
- degraded status
- performance warning

## Region data columns

Fields:

- `bars.enabled`
- `bars.color`
- `bars.width`
- `bars.anchorOffsetX`
- `bars.anchorOffsetY`
- `bars.baseOffset`
- `bars.minHeight`
- `bars.maxHeight`
- `bars.sqrtExponent`
- `bars.glowStrength`
- `bars.baseRingRadius`
- `bars.baseRingOpacity`
- `bars.pulseEnabled`
- `bars.pulseColor`
- `bars.pulseWidth`
- `bars.pulseOuterRadiusRatio`
- `bars.pulseInnerRadiusRatio`
- `bars.pulseOuterOpacity`
- `bars.pulseInnerOpacity`
- `bars.pulseDurationMs`
- `bars.pulseStaggerMs`
- `bars.enterMs`
- `bars.staggerMs`
- `bars.hoverEmissiveIntensity`
- `bars.hoverLift`
- `bars.hoverInactiveOpacity`

Readouts/actions:

- rendered bar count
- numeric data range
- pulse state
- degraded state
- copy normalized bar JSON
- reset bar config

## Badge and Hover metric panel

Master:

- `overlay.enabled`

Badge:

- `enabled`
- `minWidth`
- `height`
- `paddingX`
- `gapY`
- `offsetX`
- `offsetY`
- `hideOnHover`
- `backgroundColor`
- `backgroundOpacity`
- `borderColor`
- `borderWidth`
- `borderRadius`
- `textColor`
- `fontSize`
- `fontWeight`
- `shadowColor`
- `shadowBlur`
- `shadowOpacity`
- `hoverInactiveOpacity`
- `decimals`
- `thousandsSeparator`
- `enterDelayMs`
- `enterMs`
- `staggerMs`

Panel:

- `enabled`
- `preferredSide`
- `gapX`
- `offsetY`
- `width`
- `minHeight`
- `viewportPadding`
- `backgroundColor`
- `backgroundOpacity`
- `borderColor`
- `borderWidth`
- `borderRadius`
- `paddingTop`
- `paddingRight`
- `paddingBottom`
- `paddingLeft`
- `rowGap`
- `titleAssetWidth`
- `titleAssetHeight`
- `titleOffsetX`
- `titleOffsetY`
- `titleTextOffsetX`
- `titleTextOffsetY`
- `titleColor`
- `titleFontSize`
- `titleFontWeight`
- `labelColor`
- `labelFontSize`
- `labelFontWeight`
- `valueColor`
- `valueFontSize`
- `valueFontWeight`
- `unitColor`
- `unitFontSize`
- `unitFontWeight`
- `caseDecimals`
- `amountDecimals`
- `thousandsSeparator`
- `enterMs`
- `leaveMs`
- `enterScale`

Collision:

- `badgeCollisionEnabled`
- `badgeCollisionGap`
- `badgeMaxShift`

Overlay actions:

- copy normalized overlay JSON
- reset overlay config

## HUD

Anchor:

- `anchor.x`
- `anchor.z`
- `anchor.elevation`

Static disc:

- `static.enabled`
- `static.diameter`
- `static.opacity`
- `static.phaseDeg`
- `static.elevationOffset`

Rotating disc:

- `rotating.enabled`
- `rotating.diameter`
- `rotating.opacity`
- `rotating.phaseDeg`
- `rotating.elevationOffset`
- `rotating.speedDegPerSecond`

HUD actions:

- toggle live preview
- apply draft
- discard draft
- reset current HUD target
- copy normalized HUD JSON

## Engineering information

- FPS
- camera position/target
- automatic carousel switch
- render target width/height
- effective render scale
- normal outward state
- Hover outward state
- normal inward state
- Hover inward state
- mosaic state
- complete degraded state
- rendered bar count and data range
- normalized effect JSON
- normalized bar JSON
- normalized overlay JSON
- normalized HUD JSON
