# Next.js migration verification

## Flowchart toolbar tutorial, 2026-11-21

- The existing toolbar hint shows outlined Enter and Cmd/Ctrl+arrow keycaps for a single editable rectangle, ellipse, or diamond, following the supplied reference. Desktop positioning follows toolbar height with a 4px gap; mobile keeps the existing top hint area. The hint uses a 10px base font with the existing muted theme color and panel text scale, and respects toolbar-hint preferences and zen mode.
- PASS: platform/selection smoke checks cover Mac Cmd, Linux Ctrl, keycap accessibility labels, deselection, editing, locking, and hidden hints. All 56 relevant flowchart, onboarding, Preferences, and startup tests pass, as do ESLint, strict TypeScript, and the production build.
- Browser layout remains unverified under the previously observed local-server and browser-launch restrictions.

## Sticky notes, 2026-11-21

- Added the native `stickynote` tool (N), click/drag placement, immediate bound-text editing, five paper colors, text and font controls, creation dates, and fitting that shrinks text to 16px before growing the paper. Side and corner handles preserve note/text geometry during movement, resizing, and rotation.
- PASS: 373 Node/model/React DOM tests, including 18 new note model/workflow cases. Notes coverage includes placement/cancellation, editing, formatting cancellation followed by later edits, clearing grown notes, shrink/grow/restoration, footer space, styling/opacity, transforms, undo/redo, duplication, local/project/Excalidraw round-trips, SVG content, and decoded PNG paper/date pixels.
- PASS: lint, TypeScript, renderer provenance check, and production static build. Light and dark renders were visually inspected in `artifacts/sticky-note-light.png` and `artifacts/sticky-note-dark.png`.
- Browser/runtime verification remains unavailable: Playwright's bundled browser is absent, installed Chrome cannot launch under the host restrictions, and local-server binding is denied. No live Excalidraw runtime parity claim is made. See `RESEARCH.md` for the official source evidence and REA availability boundary.

## Flowchart creation shortcuts, 2026-11-21

- Cmd/Ctrl+Arrow creates blank rectangle, ellipse, or diamond children matching the selected shape. Holding the modifier builds a centered sibling preview; changing direction replaces it. Modifier release inserts the cluster as one undo step and selects its first node. Escape and window blur discard previews. Previews stay outside persisted elements. Connected chart nodes act as placement obstacles; elbow arrows retain endpoint bindings as nodes move. Ordinary nudging and shortcuts in text editors retain their behavior.
- PASS: all 355 Node/model/React DOM tests, including 22 flowchart cases. Coverage includes both modifiers, all directions, supported types/styles, repetition, direction changes, chaining, cancellation, undo/redo, locked/multiple/unsupported selections, typing/dialog/pointer guards, bound labels, snapping preferences, frame membership, rotated sources, editable export, and reload.
- PASS: ESLint, strict TypeScript, pinned renderer integrity check, and the Next.js production build. Native light/dark canvas previews were rendered and inspected in `artifacts/flowchart-light-native.png` and `artifacts/flowchart-dark-native.png`; tests confirm that previews draw without entering storage and Escape restores the original canvas pixels.
- Browser verification PENDING: Playwright discovers nine new scenarios across Chromium, Firefox, and WebKit. Execution stops before tests because the sandbox refuses localhost binding (`listen EPERM`). An independent installed-Chrome launch also aborts. These scenarios are authored but have not passed in a browser here. Live Excalidraw behavior was not observed; the implementation follows its reviewed public source, with adaptation boundaries recorded in `RESEARCH.md`.

## Custom Include options menu, 2026-11-21

- Replaced the native select popup with a themed combobox/listbox following the supplied rounded-menu reference. Options use compact icon/text rows, selected checkmarks, hover/navigation states, and the app's existing panel shadow. Trigger and options inherit the current size preference through shared variables. The chosen scope directly controls the preview, downloads, and clipboard output.
- PASS: all 333 Node/model/React DOM tests, ESLint, strict TypeScript, and the production build. New interaction tests cover pointer and keyboard choice, initial-letter navigation, arrows, Home/End, Enter/Space, Escape/Tab dismissal, outside pointer dismissal, selection availability, focus return, and keeping the export dialog open when dismissing options.
- Browser verification PENDING: the Chromium export suite again stops before launch because localhost binding returns `listen EPERM`. Playwright discovers 42 export cases across the configured browsers, including custom-option theme, size-preference, pointer, and keyboard scenarios. Native browser layout and screenshots remain unverified in this sandbox.

## Include dropdown sizing, 2026-11-21

- The export Include selector now uses compact app typography, themed surfaces, a matching chevron, and a 180×32px Medium desktop size. Width, height, padding, text, and icon follow the saved Small/Medium/Large preference; mobile uses the app's scaled 44px height baseline. The field can shrink inside narrow dialogs.
- PASS: ESLint, strict TypeScript, production build, and all nine existing export/file tests. Native browser layout remains unverified under the previously recorded sandbox restrictions. Design and implementation checks are recorded in `anti-slop/export-2026-11-21.md`.

## Image export controls, 2026-11-21

- Added a live canvas preview, 1×/2×/3× scale, background and dark-mode switches, PNG/SVG downloads, and PNG clipboard copying. Export theme changes are independent of editor appearance. The preview uses the PNG renderer, and SVG uses matching dark paths, text, links, and frame labels. SVG scales its intrinsic dimensions while retaining vector geometry. Hidden content is excluded and empty image exports are disabled. The secondary editable-page export is retained.
- Validation PASS: all 330 Node/model/React DOM tests, ESLint, strict TypeScript, renderer provenance verification, and the production static build. New tests inspect actual PNG dimensions and alpha pixels at every scale, scaled SVG dimensions, dark colors, selected frame children, clipboard PNG data and permission errors, and the raster size cap. Legacy image fixtures still match when choosing their original light theme and format scales.
- Contrast PASS: the skill contrast checker reports 4.68:1 for light action labels, 7.83:1 for dark action labels, 6.01:1 for light supporting text, and 7.23:1 for dark supporting text. Design decisions and implementation checks are recorded in `anti-slop/export-2026-11-21.md`.
- Browser verification PENDING: the targeted Chromium run cannot bind `127.0.0.1:3000` (`listen EPERM`). A direct Chrome launch also aborts with `SIGABRT`. Playwright discovers 24 export cases across the three configured browsers, covering 320/768/1440px layouts in both themes, switch keyboard activation, scale controls, file downloads, editable export, focus and dismissal, real Chromium clipboard PNG reading, and clipboard rejection. No native browser layout, screenshot, or real clipboard PASS is claimed. Run `PLAYWRIGHT_CHROME_CHANNEL=chrome npm run test:e2e -- --project=chromium tests/browser/export.spec.ts` where localhost and browser launching are allowed.

## Onboarding beside Pages/Layers, 2026-11-21

- Layout: desktop welcome actions center beyond the visible sidebar; left hints clear its right edge by 24px. The files/pages hint hides below 1440px with the panel open to prevent collision with the tools hint. Moved hints omit inaccurate pointers. Phones temporarily hide welcome content and its focus targets while the overlay panel is open. Closing the panel restores onboarding; zen mode retains centered guidance.
- Validation PASS: all 325 Node/model/React DOM tests, including the six existing onboarding interaction tests; ESLint; strict TypeScript; and production static build. Playwright discovers all 25 onboarding cases, including the 11 added panel-layout cases. Empty-canvas lifetime and drawing pointer passthrough are preserved. Test discovery does not establish a browser-layout pass.
- Design review: the existing handwriting, purple accent, light/dark tokens, action labels, and ENERGY 1 / RHYTHM 1 / MOTION 1 remain. Layout reasons are recorded in DESIGN.md. No assets, colors, copy, controls, or motion were added.
- Browser verification PENDING: the local server was rejected with `listen EPERM` on `127.0.0.1:3000`. Browser tests now cover saved-open panels at 375, 768, 1152, 1440, and 2048px in both themes with Large controls, visible-hint/sidebar separation, welcome action access and focus restoration, closing the panel, horizontal overflow, and zen mode. No browser visual or responsive-layout PASS is claimed. After building, run `PLAYWRIGHT_CHROME_CHANNEL=chrome npm run test:e2e -- --project=chromium tests/browser/onboarding.spec.ts` in an environment that allows the local server and browser.

## Refresh flicker, 2026-11-20

- Cause: static HTML showed an empty board at default control size before local restoration. Hydration could also apply the default light appearance before the saved appearance, and canvas initialization deferred its first draw to an animation frame. Welcome text used a swapping font face.
- Fix: the document-head bootstrap now applies saved sizing, zen mode, and toolbar hints and suppresses empty onboarding for saved content. Project name and zoom labels wait for restored values. Appearance effects wait for restoration, startup overrides are removed after the restored React commit, and the canvas paints synchronously during initialization and resize. An optional UI face of the existing Patrick Hand font avoids late welcome-text swaps while drawing text retains normal font loading.
- Validation PASS: all 325 Node tests, including synchronous canvas pixel output, real SSR hydration in normal and Strict Mode, startup preference extraction before body parsing, and checks that hydration never writes a default light canvas color over a saved dark color. ESLint, strict TypeScript, renderer provenance verification, and production build passed.
- Browser verification PENDING: the Chromium startup suite could not launch because the sandbox rejects the local server with `listen EPERM` on `127.0.0.1:3000`. Added delayed-hydration checks for saved content and Small/Large controls at 320px and 1440px, zen mode, and stable welcome heading bounds after a delayed font loads. No live browser visual pass is claimed.
- Design review PASS for this repair's scope: existing palette, layout, controls, focus styles, and ENERGY 1 / RHYTHM 1 / MOTION 1 are retained. Startup visibility changes prevent stale state from appearing; the font face avoids disruptive UI movement without changing drawing font behavior.

## Example starter removal, 2026-11-20

- Removed the welcome-screen example button, its CSS rule, the controller entry point, and the example drawing generator. Updated the README and migration requirements. Preferences and external-request browser checks now create a rectangle through the drawing tools.
- Validation PASS: ESLint, strict TypeScript, all 315 Node tests, and the production static build.
- Browser verification remains pending: the targeted startup, Preferences, and drawing suites could not start because the sandbox rejects the local server binding to `127.0.0.1:3000` with `listen EPERM`.

## Project name in the header, 2026-11-17

- The header displays the saved project name and supports inline renaming by a single click, keyboard activation, or touch. Enter/blur saves, Escape cancels, and blank input preserves the previous name. Default `sketchify_YYYY-MM-DD` names retain their local date in storage and exported filenames while displaying `Sketchify`. Legacy `Untitled` defaults adopt the dated name; custom names and imported filenames remain visible.
- PASS: all 298 Node tests, ESLint, strict TypeScript, and the production static build. Interaction checks cover text selection, IME confirmation, save/cancel/blur, blank names, focus restoration, persistence/reload, menu renaming, imported filenames, export naming, and unchanged drawing/undo history. The compatibility test accounts for the intentional legacy default-name migration while retaining its complete content and other metadata comparisons.
- PASS: computed contrast ratios for light/dark text are 15.24:1 and 12.48:1; editing borders/focus accents are 6.02:1 and 7.83:1 against their panels.
- Browser layout verification PENDING: six new scenarios cover 375px, 820px, and 1440px in both themes at Large UI scale, including keyboard operation, long names, toolbar separation, viewport containment, screenshots, persistence, and exported filenames. Chromium execution stops before tests because the sandbox rejects `127.0.0.1:3000` with `listen EPERM`.

## Size preference for complete buttons, 2026-11-17

- Source and purpose: the existing scale now controls toolbar and corner button width/height, zoom/history padding, gaps, dividers, and button radii as well as content. Desktop corner panels preserve their shared toolbar height at all three scales. Mobile controls, property buttons, color swatches, Preferences switches, and panel close buttons scale from their existing Medium baseline. Bottom groups wrap on narrow phones; dropdowns track the resized menu button. Medium retains the prior dimensions, and drawing geometry and zoom are independent.
- Validation PASS: ESLint and production build, including TypeScript validation.
- Extended browser assertions check menu, drawing tool, zoom, Help, and panel dimensions at each scale on mobile, desktop, and wide desktop. Native layout checks remain pending under the established sandbox localhost restriction.

## Size preference for toolbar and corner controls, 2026-11-17

- Source and purpose PASS: the existing Icon and text size preference now scales toolbar, menu/style, zoom/fit, undo/redo, Help, and zen-exit icons, plus their UI labels and hints. Medium preserves each control's existing size; button/panel dimensions remain unchanged to preserve the layout and hit areas. Canvas content and drawing zoom are independent of the preference.
- Validation PASS: ESLint and production build, including TypeScript validation.
- Browser coverage extends the existing size preference checks to desktop, wide desktop, and mobile corner icons, toolbar glyph bounds, zoom text, and viewport fit for every size. Native layout verification remains pending under the established localhost binding restriction.

## Panel icon and text size preference, 2026-11-17

- Source and purpose PASS: Preferences offers a labeled Icon and text size button group with Small, Medium, and Large choices. Pressed states use the existing purple accent. Medium retains the current scale; Small uses 90% and Large uses 120%. Shared panel variables adjust type, icons, and corresponding control heights without resizing the drawing or desktop toolbar.
- Interaction PASS: React/JSDOM clicks each choice in light/dark themes at desktop/mobile logical widths, checks immediate selection and root size state, flushes local persistence, and restores each choice in a new editor. The drawing and undo availability remain unchanged. Missing and malformed saved values restore Medium. Mobile size buttons use 44px minimum heights, and existing field/touch-target overrides remain.
- Validation PASS: all 295 Node tests, ESLint, and production build with TypeScript validation.
- Browser delivery gate PENDING: added desktop/mobile browser coverage for keyboard selection, computed icon/text sizes, viewport fit, and reload. The attempted Chromium run stops before tests because the local server cannot bind to 127.0.0.1:3000 (`listen EPERM`). Native browser dimensions and screenshots remain unverified.

## Denser panel content, 2026-11-17

- Source and purpose PASS: panel icons use 14px, property buttons use 24px squares, and color controls use 20px squares. Menu rows use a 28px minimum height; smaller type, padding, section gaps, Preferences rows, overview measurements, and text formatting controls fit more content within existing panel widths.
- Direction PASS: DESIGN.md records the updated sizes and retained ENERGY 1 / RHYTHM 1 / MOTION 1. Mobile property controls retain 44px targets, menu actions retain 44px minimum heights, and editable mobile fields retain 16px text. Theme colors, focus indicators, and event handlers remain in place.
- Validation PASS: ESLint and production build, including TypeScript validation. No behavior changes or new tests.
- Browser delivery gate PENDING: the established sandbox restriction prevents binding the local server (`listen EPERM` on 127.0.0.1:3000). Native browser layout remains unverified.

## Smaller panel content, 2026-11-17

- Source and purpose PASS: menu and shape property icons use 16px dimensions; action text uses 12px and supporting labels use 10–11px. Sloppiness no longer has an inline size overriding its panel style. Existing button dimensions, focus indicators, handlers, and themes are retained; mobile rounding fields retain 16px text.
- Direction PASS: DESIGN.md records the smaller content scale and existing ENERGY 1 / RHYTHM 1 / MOTION 1.
- Validation PASS: ESLint and the production build, including TypeScript validation. This reversible sizing change adds no behavior or new tests.
- Browser delivery gate PENDING: the targeted Chromium run cannot start its local server because binding to 127.0.0.1:3000 returns `listen EPERM`. Browser layout and screenshots remain unverified.

## Compact corner controls, 2026-11-17

- Desktop menu, zoom/history panels, and Help now share the center toolbar's rendered height: 40px normally and 43.2px at viewport widths of 1500px or more. Their 16px icons match the toolbar's existing 80% scale. Zoom/history inner controls are 32px or 35.2px, with padding and borders completing the panel height.
- Source and purpose PASS: scoped desktop CSS uses a shared toolbar height to keep the corner controls aligned with the drawing toolbar. Existing labels, focus indicators, event handlers, panel colors, and mobile rules are retained. No new controls or assets were added.
- Direction PASS: DESIGN.md records the compact dimensions and retained ENERGY 1 / RHYTHM 1 / MOTION 1.
- Build PASS: ESLint and the production build, including TypeScript validation, pass. No behavior changes or new tests were needed for this sizing adjustment.
- Browser delivery gate PENDING: attempted a direct headless Chrome launch for layout verification; Chrome closes during launch in this environment. Actual browser dimensions and screenshots remain unverified. The recorded heights follow the CSS box dimensions and toolbar scale.

## Individual multi-selection borders, 2026-11-17

- Box selection and multi-selection now show a solid purple border around each independent selected component, alongside the shared outline and transform handles. A selected group has one border for its members, including when selected beside ungrouped components. Bound labels and frame contents use their container's border. Rotated component borders follow their angle, and padding remains fixed in screen pixels under pan and zoom.
- PASS: all **293 Node tests**, ESLint, strict TypeScript, and the production build. Five pixel-based renderer cases verify individual borders, grouping and ungrouping, live marquee selection, clearing selection, dark/light themes, rotation, pan/zoom, and mixed group/ungrouped selections.
- PASS: inspected [the native canvas preview](artifacts/selection-outlines-native-preview.png) in both themes. Each rectangle and connecting arrow has its own border, with handles on the shared outer boundary. This preview verifies the canvas layer; it does not include browser controls or layout.
- Browser verification remains pending under the previously confirmed localhost binding restriction. [Design checks](anti-slop/selection-outlines-2026-11-17.md) record the scope and evidence.

## Component groups, 2026-11-17

- Cmd/Ctrl+G groups two or more independent components. Cmd/Ctrl+Shift+G removes one group level. Both actions appear in the right-click menu and shortcut help. Groups select, move, resize, rotate, copy, and delete together. Double-click or Enter enters a selected group; Escape selects the containing group. Bound labels and frame contents follow their parents.
- PASS: all **288 Node tests**, including **22 grouping cases**, ESLint, strict TypeScript, renderer provenance verification, and the production build. Tests exercise Mac and Ctrl shortcuts, nested groups, additive and marquee selection, member editing, parent scope changes, locks, transformations, copy/paste, duplication, frame renames, undo/redo, reload, malformed imports, and editable export.
- PASS: React/JSDOM click-through of Group and Ungroup in light/dark themes at 1440px and 375px logical widths, including disabled states, menu dismissal, and canvas focus. This verifies event handling, not browser layout. Inspected [the native canvas preview](artifacts/groups-native-preview.png) for whole-group and member selections in both themes.
- Browser verification pending: Playwright discovers **15 grouping cases** across Chromium, Firefox, and WebKit, including light/dark desktop and mobile menus. The attempted Chromium run cannot start its server because localhost binding returns `listen EPERM` on `127.0.0.1:3000`. Native browser interaction, menu positioning, and mobile layout remain unverified. [Design checks](anti-slop/groups-2026-11-17.md) record the evidence and limitation.

## Small circle connection hints, 2026-11-17

- Removed the Center and Midpoint labels and the crosshair strokes. Hovered center and side midpoint hints now use the same small circle as attached endpoint hints: 10 screen pixels across with a 1.5 pixel purple border and panel-colored fill. The hover circle sits directly on the snap point and ignores pointer input. Drawing and endpoint snapping behavior is unchanged.
- PASS: all **266 Node tests**, ESLint, strict TypeScript, and the production build. Existing connector checks now verify empty hint content, exact snap position under zoom/pan, visibility, and interaction lifecycle. Browser assertions check the circle's position and 10 pixel size.
- PASS: inspected `artifacts/arrow-circle-native-preview.png` for small attached endpoint circles in light/dark drawing and endpoint-dragging states. The hover circle is a DOM overlay and is not included in that canvas preview. Browser verification remains pending due to the previously confirmed localhost binding restriction; no browser visual pass is claimed.

## Arrow side midpoints, 2026-11-17

- Arrows and lines snap to each side's exact midpoint while starting a connector or dragging either endpoint. The crosshair displays Midpoint, using the existing center hint styles. Rectangles and text use their four edge centers; ellipses use the four cardinal points; diamonds use the middle of each sloped side. The nearest named anchor wins within 14 screen pixels, and ordinary edge binding remains available beyond that range.
- PASS: all **266 Node tests**, ESLint, strict TypeScript, renderer provenance verification, and the production build. Six additional cases cover every target type and side, zoom, rotation, resizing, export/import, range boundaries, short text, drawing, both endpoint handles, cancellation, undo, and Midpoint hints. Existing center and edge attachment tests pass.
- PASS: inspected `artifacts/arrow-midpoint-native-preview.png` in light and dark themes for side hover, drawing to a text side, and dragging the starting endpoint. This is the native canvas layer, without the DOM hint label. The label retains the contrast-checked theme colors and reserves additional viewport width for Midpoint.
- Browser verification pending: the targeted connector suite still cannot bind its server to `127.0.0.1:3000` (`listen EPERM`). Playwright discovers 21 cases across the three configured browsers, including a new side midpoint drawing and endpoint scenario. No browser layout or screenshot acceptance is claimed.

## Arrow center connections, 2026-11-17

- Either endpoint of an arrow or line can attach to the center of a rectangle, ellipse, diamond, or standalone text. The 14 screen pixel threshold matches edge snapping. A crosshair and Center label appear before drawing and while dragging either endpoint; leaving the target, finishing, cancelling, changing tools, or disabling arrow binding clears the hint.
- PASS: all **260 Node tests**, ESLint, strict TypeScript, renderer provenance verification, and the production build. New tests cover both endpoints, rounded and rotated shapes, text edits, small targets, bound labels, zoom, grid precedence, cancellation, detachment, undo/redo, export/import, reload, and hint lifecycle. Existing edge binding and legacy renderer tests pass.
- PASS: native canvas preview inspected at `artifacts/arrow-center-native-preview.png`, showing center markers before drawing, while connecting text, and while dragging the starting endpoint in light and dark themes. This preview renders the canvas layer, not the DOM Center label or browser layout. The label's existing accent/surface colors pass text contrast at 6.02:1 in light mode and 7.83:1 in dark mode.
- Browser verification pending: Playwright cannot start its local server because binding `127.0.0.1:3000` returns `listen EPERM`. Bundled Chromium is unavailable and installed Chrome aborts with `SIGABRT`. The six connector scenarios, including desktop light/dark center hints and mobile center drawing, are discoverable across Chromium, Firefox, and WebKit (18 cases). No browser screenshot or native browser acceptance is claimed. Design decisions and checks are recorded in [Arrow center checks](anti-slop/arrow-centers-2026-11-17.md).

## Canvas backgrounds in both themes, 2026-11-16

- Fixed dark mode ignoring background selections. The default remains #ffffff in light mode and #121212 in dark mode; each palette option now has a dark counterpart. Swatches preview the active theme's color and preserve the existing saved palette values across theme changes and reloads. Document background, canvas, minimap, and theme-color metadata share the resolved color. Imported colors outside the palette retain their exact value.
- PASS: ESLint, strict TypeScript, all **248 Node tests**, and the production build. Regression checks exercise every swatch in both themes, default and invalid colors, saved selection, reload, and live theme changes. Five additional checks executed the actual bootstrap extracted from production HTML, including uppercase saved colors.
- Purpose/consistency PASS: dark counterparts keep the workspace dark while making every palette choice visible; the existing ENERGY 1 / RHYTHM 1 / MOTION 1 direction is retained. No layout, typography, or motion changes.
- Browser verification pending: the targeted Chromium run (`tests/browser/background.spec.ts` and `tests/browser/startup.spec.ts`) could not start because localhost binding returned `listen EPERM`. Added desktop/mobile swatch, theme toggle, reload, minimap, and pre-hydration checks. No browser screenshot or visual acceptance is claimed.

## Canvas-colored startup, 2026-11-15

- A synchronous head script reads the existing saved scene's appearance and sets the document theme, canvas color, native color scheme, and theme-color metadata before the body is parsed. Removed the server-rendered white canvas override, so the initial canvas inherits the restored color. The same appearance function keeps these values synchronized after hydration and during settings changes.
- PASS: all **247 Node tests**, ESLint, strict TypeScript, and the production build. New cases cover dark/light/custom colors before body parsing, unavailable/malformed storage, and live theme/background changes. Executed the actual bootstrap script extracted from built HTML to verify that production serialization preserves both dark and custom light colors.
- Browser verification remains pending: the sandbox rejects Playwright's server with `listen EPERM` on `127.0.0.1:3000`. Added pre-hydration dark/light browser checks that hold JavaScript requests and inspect the canvas/document backgrounds. No actual browser flicker or screenshot acceptance is claimed.

## Startup without loading screen, 2026-11-15

- Removed the dynamic whiteboard/font gate and its “Loading Sketchify…” fallback. The static document now includes the actual canvas and controls; browser controllers mount during hydration, and the locally bundled handwriting font warms in the background. Font completion refreshes text metrics without adding an undo step or interrupting an active gesture.
- PASS: all **244 Node tests**, ESLint, strict TypeScript, renderer provenance verification, and the production build. Parsed the built HTML to confirm real canvas/toolbar markup, no loading message, and no client-render bailout.
- Six new Node cases verify server rendering without browser globals, editing/drawing before font readiness, changed font widths and undo/redo, selection/focus retention, gesture completion, fallback rendering, and Strict Mode cleanup. Three new browser scenarios cover static HTML, delayed fonts, and failed fonts.
- [Startup analysis and checks](anti-slop/startup-2026-11-15.md) records the official Excalidraw source findings: a 250 ms delayed indicator, font prewarming after scene initialization, and early theme setup.
- Browser acceptance remains pending: the sandbox rejects the Playwright web server with `listen EPERM` on `127.0.0.1:3000`. No runtime startup timing, screenshot, or visual acceptance is claimed.

## Preferences, 2026-11-15

- Added a Preferences menu view with six immediately applied, locally saved switches: minimap, canvas and shape properties, grid, arrow binding, toolbar hints, and zen mode. Grid keeps its Ctrl/Cmd+' shortcut. Zen mode has an exit button, Escape, and Alt+Z.
- PASS: all **237 Node tests**, ESLint, strict TypeScript, renderer provenance verification, and the production static build. Eleven new tests cover preference behavior, legacy/partial/malformed storage, real scene/selection geometry, minimap navigation, connector drawing/movement/endpoint binding rules, existing attachment retention, native control key handling, and zen-mode persistence and exits.
- Contrast PASS: verified with the antislop contrast checker. The design decisions, source checks, and remaining visual gate are recorded in [Preferences checks](anti-slop/preferences-2026-11-15.md).
- Browser acceptance pending: Playwright cannot start its local server (`listen EPERM` on `127.0.0.1:3000`); installed Chrome also exits at launch. The six new desktop/tablet/mobile and light/dark scenarios in `tests/browser/preferences.spec.ts` are discoverable across all three browsers (18 cases). Run them in a permitted local environment or CI for actual keyboard activation, visual layout, focus, overflow, and screenshots. No browser visual pass is claimed.

## Library removal, 2026-11-15

- Removed the library toolbar button, panel, selection/property actions, context-menu entry, clear dialog, icon, template variants, state, persistence handlers, and styles. Source and production JavaScript/CSS searches contain no library references.
- PASS: all 226 Node tests, ESLint, strict TypeScript, renderer provenance verification, and the production static build. Compatibility checks still cover legacy scene metadata, editable export, SVG, PNG, and all 196 renderer fixtures.
- PASS: desktop/mobile interaction tests confirm that legacy library data, including malformed JSON, stays untouched and cannot prevent scene loading or editing. Startup reads only the scene key. Duplicate/undo, property actions, context-menu copy, and keyboard copy/cut/paste remain usable; new sessions never create library storage.
- Browser verification pending: `PLAYWRIGHT_CHROME_CHANNEL=chrome npx playwright test tests/browser/whiteboard.spec.ts tests/browser/context-menu.spec.ts --project=chromium` was blocked before browser launch by `listen EPERM` on `127.0.0.1:3000`. The updated browser suite covers removal and clipboard event handling at desktop/mobile widths, reload, undo, focus return, and overflow. Real system clipboard and visual acceptance still need a normal terminal or CI runner.

The historical migration evidence below includes library checks from before the feature was removed.

## Text alignment, 2026-11-15

- Standalone text has Left/Center/Right controls. Rectangle labels have the requested horizontal row plus Top/Middle/Bottom; other shape types do not show alignment controls. New rectangle labels retain center/middle defaults, including when standalone text previously used a different alignment. Empty selected rectangles can store alignment before their label is added.
- Geometry and interaction PASS: all nine rectangle positions, rotated local-axis placement, natural and fixed-width multiline text, rich spans and SVG coordinates, editor draft/selection behavior, cancellation, undo/redo, dragging, resizing, rotation, duplication, locking, mixed selections, reload, and editable file round-trips are covered by regression tests. Existing compatibility and renderer fixtures pass.
- Native canvas preview PASS: `artifacts/text-alignment-preview.png` was generated with the bundled font and actual renderer and visually inspected. It is not a browser screenshot.
- Post-implementation audit: `anti-slop/audit-001-2026-11-15.md` records verified color contrast, design consistency, control behavior, and one pending browser verification finding.
- Browser acceptance pending: Playwright cannot start its local server in this sandbox (`listen EPERM` on `127.0.0.1:3000`). The 12 new scenarios are discoverable across Chromium, Firefox, and WebKit. Run `npx playwright test tests/browser/text-alignment.spec.ts` in a normal terminal or CI for desktop/mobile, keyboard, light/dark, live-editor appearance, and screenshots.

## Text box resizing and wrapping, 2026-11-14

- Geometry PASS: corner resizing remeasures text and preserves the opposite corner. Four native interaction cases reproduce an uneven drag on three-line Patrick Hand text at 150% zoom, verify the selection bottom against the last painted pixel, and check undo/redo and reload. Minimum-size and cancellation checks pass.
- Width control PASS: left/right side handles set `textWidth` without changing font size. Native interaction checks cover both sides, numeric width entry, Fit text, reload, undo/redo, and proportional corner scaling after wrapping. Canvas and SVG share a layout that retains explicit line breaks and styled runs and splits long words at grapheme boundaries. The editor uses the same fixed width with soft wrapping enabled.
- Build/checks PASS: all 81 Node tests, ESLint, strict TypeScript, and the production build pass. The native render [text box preview](artifacts/text-box-width.png) was inspected; it is a native canvas render, not a browser screenshot.
- Browser acceptance remains pending under the localhost restriction described below. Playwright discovers 33 browser cases, including width dragging, editing/reload, and keyboard width entry; these cases have not run here.

## Patrick Hand update, 2026-11-14

- Typography PASS: the approved Patrick Hand font is bundled locally with its OFL license. Canvas measurement, drawing, editing, the handwritten font preview, and welcome typography select the same family. Existing normal/code choices remain available. ENERGY 1 / RHYTHM 1 / MOTION 1 is retained.
- Export PASS: the React/jsdom export test verifies handwritten SVG font embedding, license metadata, styled links, and PNG dimensions. Asynchronous SVG export snapshots the scene before awaiting font data. Native text bounds tests use the real bundled font and check painted descenders and underlines.
- Checks PASS: all 72 Node tests, ESLint, strict TypeScript, and the production static build pass. The built output contains both the font file and its license.
- Browser acceptance remains pending: `npm run test:e2e` cannot start its server because localhost binding returns `listen EPERM`. Playwright discovers 30 cases across the three configured browsers, including the new standalone font/export case; discovery does not establish that they pass. Real-browser text/editor alignment, standalone SVG rendering, and desktop/mobile light/dark appearance still need verification in an unrestricted environment.

The migration evidence below predates this intentional typography change.

Date: 2026-11-10. This record distinguishes automated/native verification from browser acceptance. The original global-script application was retained temporarily outside the project while compatibility fixtures were recorded, then removed from the application source.

## Verified

- Next.js 16.4.6 App Router static builds complete on Node 20.19.0, 22.12.0, 24.0.0, and the installed 26.5.0. The whiteboard route exports to `out/`; browser APIs do not execute during prerendering.
- The Node suite retains all 49 original cases and adds migration regression coverage for tools, movement/resizing, cancellation, selection, stacking, erasure, rectangle defaults, library compatibility/failures, storage recovery, Strict Mode, autosave, unload, and file I/O.
- All **70 tests pass** on Node 20.19.0, 22.12.0, 24.0.0, and 26.5.0 on macOS ARM64. The supported-version test runs include the legacy export goldens and 196 renderer comparisons. Cross-platform browser acceptance is delegated to the checked-in CI workflow and remains pending here.
- All 196 original renderer fixtures pass exact operation hashes and native RGBA comparisons. The fixture file, retained renderer source, provenance, drawing dependency versions, and global stylesheet are unchanged.
- Legacy storage loads with the same scene/library representation, including extension metadata and stored seeds. Editable JSON and SVG match the recorded legacy output byte-for-byte. Native PNG exports match every pixel with and without backgrounds.
- Compatibility fixture metadata records the legacy source hashes and deterministic test-font hash. Goldens were recorded by the original application with the same test-only font alias used by the migrated tests. Application font selection is unchanged.
- Strict TypeScript and ESLint pass. `npm run vendor:check` verifies the checked-in ESM renderer against an in-memory rebuild.
- The React/jsdom harness mounts actual React components, uses Selection/Range and native canvas, models pointer focus, cleans up roots and global shims, and fails on browser-event exceptions. No global application namespaces or source evaluation are used.
- Playwright discovers 18 production scenarios across Chromium, Firefox, and WebKit. A CI workflow runs the full check on the supported Node matrix.

## Pending browser acceptance

This sandbox denies localhost binding (`listen EPERM` on 127.0.0.1:3000). Launching installed Chrome through Playwright also exits with `SIGABRT`; downloading Playwright browsers fails because the download host cannot resolve. Consequently `npm run test:e2e`, the complete `npm run check`, real-browser click-through, native IME/clipboard behavior, and visual layout acceptance are **not recorded as passing**. No static or development server is left running.

The remaining gate requires a normal local terminal or CI runner:

```sh
npm ci
npx playwright install --with-deps chromium firefox webkit
npm run check
```

The browser suite checks drawing/movement/history/reload, every drawing tool, native rich-text focus and formatting, links and exports, file picker/drop handling, unsupported-import confirmation, mobile properties, themes, reduced motion, focus return, and external requests. It also produces desktop/mobile screenshots under `artifacts/` when run.

For manual acceptance, build and run `npm start`, then open http://localhost:3000. Test desktop and 375 px, both themes, and widths around 760 px:

1. Draw every supported shape, including reverse drags and Shift constraints. Select, move, resize, multi-select, duplicate, change stacking, erase, and undo/redo.
2. Exercise every property, including mixed rectangle edges and its default after reload.
3. Edit multiline text; combine bold/italic/underline/links, use caret-only formatting, native IME input, internal undo, copy/cut/paste, Done, Escape, and blur into formatting/property panels.
4. Exercise pan, zoom, fit/reset, grid, tool lock, Tab/Enter insertion, and the help shortcuts.
5. Reload a pre-migration scene at the same origin with legacy library data present. Save/reopen editable files, import invalid/unsupported/oversized files, and export all/selected PNG/SVG with both background settings.
6. Check dialog/menu focus return, live status announcements, visible focus, mobile keyboard visibility, reduced motion, and absence of overlapping controls. Verify copy/cut/paste and duplication for reuse, and confirm no library controls appear.

The antislop browser delivery gate remains open until these checks can run. Exact native fixture parity does not establish identical browser font rasterization or whole-upstream Excalidraw parity. The original upstream live-site/REA comparison remains outside this migration's verified scope.

Shape label editing (2026-11-14):

- PASS: lint, TypeScript, renderer provenance check, and production build.
- PASS: interaction coverage for rectangle/ellipse/diamond labels, centered wrapping, slash breaks, re-editing, keyboard entry, locking, cancellation, growth, undo/redo, move/resize/rotation, duplication, deletion, reload, and editable export/import. The existing compatibility fixtures still pass.
- PASS: native canvas rendering inspected at `artifacts/shape-text-preview.png`, using the bundled Patrick Hand font and the supplied example's text, rounded rectangle, and yellow fill. Each wrapped line is centered independently. This artifact is a renderer preview, not a browser screenshot.
- Browser verification pending: desktop/mobile tests are in `tests/browser/bound-text.spec.ts`. This session's sandbox rejected the local test server with `listen EPERM`; installed Chrome also aborted at launch. Run `npm run test:e2e -- tests/browser/bound-text.spec.ts` in a normal terminal to verify native editing and screenshots across Chromium, Firefox, and WebKit.

Shape connections (2026-11-15):

- PASS: all 181 Node tests, lint, TypeScript, renderer provenance check, and production build.
- Interaction and geometry regression tests in `tests/connectors.test.mjs` cover arrows and lines attached to rectangles, ellipses, and diamonds; both endpoints; fixed edge positions during move/resize/rotation; live updates; keyboard nudging; endpoint editing and detachment; cancellation; undo/redo; copying; deletion; reload; editable export/import; zoom; rounded corners; rotated paths; and shape growth from bound labels. Existing legacy serialization and renderer fixtures still pass.
- PASS: native canvas preview inspected at `artifacts/connected-shapes-preview.png`, showing an arrow and a line following moved and rotated shapes, with circular endpoint handles. This is a renderer preview, not a browser screenshot.
- Browser verification pending: `npm run test:e2e -- tests/browser/connectors.spec.ts` failed before launching tests because the sandbox denied the local server (`listen EPERM` on `127.0.0.1:3000`). Desktop and mobile scenarios are checked in for Chromium, Firefox, and WebKit. No test server remains running.

Onboarding and empty canvas (2026-11-20):

- Visibility revision: the active canvas element count is the only condition for onboarding visibility. Hover, clicks, selection drags, tools, Space/Hand navigation, menus, sidebar, help, and saved preferences retain it on an empty canvas. Drawing and committed text hide it; undoing the final component or opening a blank page restores it. Pointer passthrough prevents the persistent welcome actions from intercepting drawing gestures. Onboarding is outside the chrome hidden by zen mode.

- Revision: replaced the central feature paragraphs and file-extension label with Create a shape · R, Open · ⌘O/Ctrl+O, and Help · ?. The top callouts are retained. The bottom hints share one flex row and use equal two-line descriptions, matching heading baselines and distances above their controls; the right hint aligns its text to the right.
- Revision coverage: the onboarding suite checks all three actions, including Rectangle activation and canvas focus. Browser assertions now check bottom heading alignment as well as viewport fit. Visual browser verification remains pending under the launch restriction described below.

- PASS: all 320 Node/model/React DOM tests. The five new onboarding tests exercise the native file input action, help dialog cancel and focus restoration, tool selection and text editing, first-mark undo, menus, sidebar, Space/Hand navigation, saved hint preferences, and blank-page switching.
- PASS: ESLint, TypeScript, and production static build. The implementation retains server-rendered welcome content and uses existing light/dark tokens and focus indicators. Both new action rows have a 44px minimum height.
- Design review PASS: the existing brand and handwriting remain; pointers identify real controls, feature descriptions match implemented tools, the central list groups drawing/text/organization, and storage copy explains browser persistence and file backups. Purpose and ENERGY 1 / RHYTHM 1 / MOTION 1 are recorded in DESIGN.md.
- Contrast PASS: muted onboarding text measures 6.01:1 on the default light canvas and 8.66:1 on the default dark canvas, above the 4.5:1 normal-text requirement.
- Browser layout verification pending: Playwright’s bundled Chromium is absent; installed Chrome aborted with SIGABRT under the sandbox. No browser screenshot, responsive geometry, or visual PASS is claimed. Browser coverage is provided for 320, 375, 768, 1024, 1440, and 2048px in both themes, including large controls on phones, scrollable guide actions, toolbar clearance, and keyboard focus. Run `PLAYWRIGHT_CHROME_CHANNEL=chrome npm run test:e2e -- --project=chromium tests/browser/onboarding.spec.ts` in a terminal that permits browser launches.

Pages and Layers (2026-11-20):

- PASS: 315 Node/model/React DOM interaction tests, including 17 page/hierarchy scenarios. Coverage includes legacy migration, multi-page save/reload, independent undo/redo, committing text on switches, page duplication with fresh IDs and retained layer settings, rename/reorder/delete confirmation, exact member selection, expansion, inherited visibility/locking, image export filtering, nested frame/group reparenting, cycle rejection, drag/drop, destination menus, and keyboard navigation. Sidebar controls are exercised in both themes at 375px and 1440px. These are DOM interactions and native canvas checks, not browser layout verification.
- PASS: ESLint, TypeScript, renderer provenance check, and production static build.
- PASS: existing selected-text, muted-label, and dark/light selection color pairs were measured at 4.90:1, 5.44:1, 6.01:1, and 7.23:1, above the 4.5:1 normal-text requirement. New mobile sidebar controls specify 44px minimum targets.
- Browser verification pending: the sandbox denied the server with `listen EPERM` on `127.0.0.1:3000`. Playwright's bundled browser is absent, and installed Chrome aborted at launch with `SIGABRT`. No browser screenshots or responsive-layout pass are claimed. Run `PLAYWRIGHT_CHROME_CHANNEL=chrome npm run test:e2e -- --project=chromium tests/browser/workspace.spec.ts` after building in a normal terminal. Full cross-browser verification remains available through `npm run check` once browser binaries are installed.
