# Arrow center checks

Scope: center attachment and its hint when drawing a connector or dragging either endpoint.

- Direction and liveliness PASS: the existing drawing workspace retains ENERGY 1 / RHYTHM 1 / MOTION 1. The crosshair uses the existing purple selection accent at the active snap point, with no animation. DESIGN.md records the interaction and visual decisions.
- Purpose PASS: the crosshair locates the exact center, and Center identifies the attachment for shapes and standalone text. The label uses existing panel colors and system typography to remain legible over drawing content. Hint geometry stays the same screen size at every zoom; its label position is clamped to the viewport.
- Functional controls PASS: the new hint accepts no pointer input or keyboard focus. Existing arrow and line tools and circular handles perform the operation; regression tests exercise drawing, both handles, cancellation, detachment, undo/redo, grid and zoom, saved bindings, text edits, and disabling bindings. The label has role=status, and the crosshair supplies a geometric cue as well as color.
- Contrast PASS: the existing label colors measure 6.02:1 (#5753c9 on #ffffff) and 7.83:1 (#b4afff on #232329), checked with the antislop-human contrast checker.
- Source and compatibility PASS: the changes are in TypeScript, React, and CSS. No assets, invented claims, decorative motion, new panels, or dependencies were introduced. All 260 Node tests, lint, strict TypeScript, renderer provenance verification, and the production build pass.
- Canvas appearance PASS: inspected artifacts/arrow-center-native-preview.png in both themes for hover, drawing to text, and dragging the start endpoint. The actual canvas renderer produces the preview; it does not include the DOM label or prove browser layout.
- Browser layout and click-through PENDING: localhost binding is denied with listen EPERM, bundled Chromium is unavailable, and installed Chrome aborts at launch. Desktop light/dark and mobile cases are checked in and discovered by Playwright. Browser layout, viewport clamping, native interaction, and DOM label appearance remain unverified in this environment.

The source, purpose, and native canvas checks pass. The full browser delivery gate remains pending; no browser acceptance is claimed.

## Side midpoint follow-up

- Purpose and consistency PASS: Midpoint uses the same accent, crosshair, panel surface, and typography as Center, with no animation or new controls. DESIGN.md records the four anchors for each target type and nearest-anchor behavior for small targets.
- Function and source PASS: all 266 Node tests, lint, strict TypeScript, renderer provenance checks, and the production build pass. Added coverage exercises all side midpoints, zoom, rotation, resize, export/import, both endpoint handles, drawing, cancellation, undo, ordinary edge binding beyond the midpoint range, and exact hint text.
- Native canvas appearance PASS: inspected artifacts/arrow-midpoint-native-preview.png in both themes, showing side hover, an arrow between shape/text side midpoints, and endpoint dragging. The hint reuses the previously checked 6.02:1 and 7.83:1 text contrast. Its viewport clamp reserves 80 pixels for the longer label.
- Browser delivery gate PENDING: the connector suite cannot start its server because localhost binding is denied (listen EPERM). Its 21 browser cases are discoverable, including the new side midpoint case. Native browser interaction, DOM label appearance, and viewport clamping remain unverified here.

## Small circle follow-up

- Purpose and consistency PASS: removed both labels and all crosshair arms at the user's request. Center, midpoint, and attached endpoint hints use one small circle, 10 screen pixels across, with the existing purple accent and panel-colored fill. DESIGN.md records the shared appearance and retained ENERGY 1 / RHYTHM 1 / MOTION 1 direction.
- Source and function PASS: all 266 existing Node tests, lint, strict TypeScript, and the production build pass. Connector tests assert empty hint content, pan/zoom position, and the existing drawing, snapping, and endpoint lifecycle. The decorative hover circle ignores pointer input and is hidden from assistive technology.
- Native canvas appearance PASS: inspected artifacts/arrow-circle-native-preview.png in both themes for attached endpoint hints while drawing and dragging. Native canvas and CSS use matching circle dimensions, stroke width, and colors. The DOM hover overlay is outside that preview.
- Browser delivery gate PENDING: browser checks remain blocked by the previously confirmed localhost sandbox restriction. Updated existing browser cases check empty hint content and the 10 pixel circle at the snap location. No browser visual pass is claimed.
