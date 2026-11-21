# Requirements: Migrate Sketchify to Next.js

Historical migration requirements. The library requirements below were superseded
on 2026-11-15: the feature and its storage handlers have been removed in favor of
copy/paste and duplication. Existing library storage is left untouched. See README.md
for current behavior.

## Introduction

Sketchify is a local-first drawing application. The current implementation is plain
JavaScript with no framework: scripts load as global `<script defer>` tags in
`index.html`, communicate through `globalThis` namespaces (`SketchScene`,
`SketchText`, `SketchTextEditor`, `ExcalidrawRenderer`, `SketchStrokes`), render
imperatively to a Canvas 2D context, and persist to `localStorage`. Drawing fidelity
comes from a source-pinned, provenance-tracked bundle of Excalidraw's renderer
(`vendor/excalidraw-renderer.js`) plus Rough.js 4.6.4 and perfect-freehand 1.2.0.

This document specifies the requirements for migrating the application to Next.js
(React). The stated motivation is code cleanliness and improved architecture — this is
a **re-platforming of an existing, working app**, not a rewrite of its behavior. The
guiding principle is **behavior parity**: the migrated app must do everything the
current app does, with identical drawing output, and then be organized into clean,
testable React/Next.js modules.

### Scope boundaries

- This migration does **not** add real-time collaboration, images, frames, rotation,
  grouping, connector binding, or upstream Excalidraw fonts. Those remain out of scope,
  exactly as today.
- This migration does **not** change the rendering algorithms, the pinned renderer, or
  its drawing dependencies. Pixel and operation parity against the existing 196
  fixtures must be preserved.
- The on-disk scene format (`.excalidraw` JSON with the `textSpans` extension) and the
  `localStorage` schema must remain compatible so existing saved work keeps loading.

### Open questions (to resolve before or during design)

1. **Router model**: App Router (default, recommended for new Next.js) vs. Pages
   Router. Assumed App Router unless decided otherwise.
2. **Rendering target**: static export (`output: 'export'`) to preserve the current
   "open from disk / tiny static server" story, vs. a running Next.js server. These
   have different implications for Requirement 9.
3. **Styling approach**: port `src/style.css` as a global stylesheet vs. CSS Modules
   vs. a CSS-in-JS/Tailwind migration.
4. **TypeScript**: adopt TypeScript during the migration vs. stay on JavaScript. The
   DOM-free model modules (`scene.js`, `text.js`) would benefit most from types.
5. **Canvas-in-React strategy**: keep the imperative Canvas 2D renderer behind a thin
   React wrapper (recommended, lowest risk) vs. a more React-idiomatic redraw model.
6. **Vendor bundle delivery**: how the pinned `ExcalidrawRenderer` is imported into the
   module graph instead of attaching to `globalThis` (see Requirement 5).
7. **Test strategy**: whether to keep the existing Node `--test` + jsdom harness
   (requires rework because it `eval`s global scripts) or move to a React testing stack
   (e.g. Vitest + Testing Library + jsdom) while preserving the renderer-fixture checks.

---

## Requirements

### Requirement 1: Next.js project foundation

**User Story:** As a developer, I want Sketchify to run as a Next.js application, so
that the codebase follows a standard, maintainable React architecture.

#### Acceptance Criteria

1. WHEN the project is built THEN the system SHALL use Next.js with React as the
   application framework, replacing the global-`<script>` loading model in
   `index.html`.
2. WHEN a developer runs the documented dev command THEN the system SHALL start the
   Next.js development server and serve the application.
3. WHEN a developer runs the documented production build command THEN the system SHALL
   produce a working production build with no build errors.
4. THE system SHALL define a single Next.js page (route) that hosts the whiteboard, and
   SHALL render the existing application chrome (toolbar, menu, properties panel, zoom
   controls, welcome panel, library, dialogs) as React components.
5. THE system SHALL preserve the existing `package.json` metadata intent (private,
   local-first) and SHALL document the new scripts (dev, build, start, lint, test) in
   `README.md`.
6. WHERE the current app relies on browser-only APIs (`window`, `document`, `canvas`,
   `localStorage`), the system SHALL confine that code to client components and SHALL
   not execute it during server rendering.

### Requirement 2: Behavior and feature parity

**User Story:** As a user of Sketchify, I want every current feature to keep working
after the migration, so that nothing I rely on is lost.

#### Acceptance Criteria

1. THE migrated app SHALL support every drawing tool currently available: selection,
   hand, rectangle, diamond, ellipse, arrow, line, freedraw, text, and eraser.
2. THE migrated app SHALL support select, move, resize, multi-select (shift-click and
   marquee), duplicate, change stacking order (to front / to back), nudge with arrow
   keys, and erase.
3. THE migrated app SHALL support all style controls currently present: stroke color,
   background/fill color, fill style (hachure, cross-hatch, solid), stroke width,
   stroke style (solid, dashed, dotted), sloppiness (Architect 0, Artist 1, Cartoonist
   2), rectangle edges (sharp/rounded), opacity, font size, and font family.
4. WHEN the user changes the rectangle-edges setting THEN the system SHALL update
   selected rectangles AND SHALL make that choice the default for new rectangles,
   persisting across reload — matching current behavior.
5. THE migrated app SHALL support undo/redo, pan, zoom, zoom-to-fit, reset zoom, and the
   optional alignment grid.
6. THE migrated app SHALL support the full keyboard-shortcut set currently documented in
   the in-app help dialog (tool shortcuts, Q lock, Space pan, Ctrl/Cmd+Z/Y, Ctrl/Cmd+A,
   Ctrl/Cmd+D, Ctrl/Cmd+S/O, Ctrl/Cmd+' grid, zoom shortcuts, Shift+1 fit, Shift+0
   reset, `?` help, keyboard-only shape insertion via focus-canvas-then-Enter).
7. THE migrated app SHALL support light/dark themes, canvas background color selection,
   drawing rename, clear canvas, and the
   narrow-screen (≤760px) responsive layout, including auto-hiding the properties panel.
8. THE migrated app SHALL reproduce the five-seed stroke-variation policy exactly: five
   fixed seeds (17, 142, 741, 2027, 8191), shuffled per shape type, each cycle of five
   using all five without consecutive repeats, and stored seeds preserved on existing,
   imported, duplicated, and saved elements.

### Requirement 3: Rendering fidelity (no regression)

**User Story:** As a user, I want shapes to look exactly as they do now, so that my
drawings and exports are unchanged.

#### Acceptance Criteria

1. THE system SHALL continue to render shapes through the source-pinned Excalidraw
   renderer bundle and its pinned dependencies (Rough.js 4.6.4, perfect-freehand 1.2.0,
   points-on-curve 1.0.1), without modifying their algorithms.
2. THE system SHALL keep the stroke-path adapter behavior currently in `src/strokes.js`:
   paths generated in local coordinates (moving an element does not re-randomize its
   stroke), empty-geometry handling, dark-mode filtering, and result caching keyed on
   the same signature fields.
3. WHEN the renderer-fixture checks run THEN all 196 fixtures in
   `tests/fixtures/excalidraw-renderer.json` SHALL match exactly (operation hashes and
   native RGBA pixels), as they do today.
4. THE system SHALL render the canvas imperatively via Canvas 2D (not by replacing the
   canvas drawing with React/DOM primitives), preserving device-pixel-ratio scaling,
   grid rendering, selection box/handles, and marquee rendering.
5. THE system SHALL preserve the text layout and rendering behavior (multi-run layout,
   bold/italic/underline, links drawn in blue with underline, per-segment fonts) for
   both on-canvas drawing and the floating editor.

### Requirement 4: Model and logic module boundaries

**User Story:** As a developer, I want the pure model/logic separated from React, so
that the core is testable and the architecture is clean.

#### Acceptance Criteria

1. THE system SHALL preserve the existing DOM-free modules as framework-agnostic
   modules importable by both React components and tests: the scene/geometry/history
   logic (`SketchScene`: `createElement`, `bounds`, `sceneBounds`, `hitTest`,
   `resizeElement`, `exportScene`, `importScene`, `History`, `normalizeTextSpans`,
   `safeTextLink`, and the tool/style/seed constants) and the text model (`SketchText`:
   `runs`, `markRange`, `rangeMarks`, `replaceRange`, `html`, `font`, `layout`,
   `linkAt`, `svg`).
2. THE system SHALL replace the `globalThis.<Namespace>` publication pattern with ES
   module exports/imports across the whole app (no reliance on `window`/`globalThis`
   for inter-module wiring).
3. WHERE logic is currently DOM-free, the system SHALL keep it DOM-free after the
   migration so it can be unit-tested without a browser or jsdom.
4. THE system SHALL extract the monolithic `src/app.js` (currently ~888 lines mixing
   state, rendering, events, persistence, export/import, and UI) into cohesive React
   components and hooks/modules with clear responsibilities (e.g. canvas/viewport,
   tool/gesture handling, selection, style/properties, menu, library, import/export,
   persistence, keyboard).
5. THE application state currently held in the single `state` object SHALL be managed
   through an explicit, documented React state model (e.g. a reducer or store), rather
   than ad-hoc mutation, while producing the same observable behavior.

### Requirement 5: Vendor renderer integration

**User Story:** As a maintainer, I want the pinned Excalidraw renderer to integrate
cleanly with the Next.js build while keeping its provenance guarantees, so that
rendering stays attributable and reproducible.

#### Acceptance Criteria

1. THE system SHALL make the pinned renderer (`ExcalidrawRenderer`:
   `generateElementShape`, `RoughGenerator`, `applyDarkModeFilter`) available to the
   application through the module graph instead of a `globalThis` attachment.
2. THE system SHALL preserve the provenance and rebuild workflow: `vendor/provenance.json`
   source hashes, `vendor/excalidraw-source.ts`, the `vendor` rebuild script, and the
   retained MIT license notices in `vendor/licenses` SHALL remain valid.
3. WHEN the renderer bundle is rebuilt THEN the rebuild SHALL still produce a bundle
   that passes the 196-fixture checks, and the documented rebuild command SHALL remain
   available.
4. IF the renderer or a drawing dependency version changes THEN the system SHALL require
   re-recording fixtures and re-verifying provenance before acceptance, matching the
   current policy.

### Requirement 6: Persistence and data compatibility

**User Story:** As an existing user, I want my saved drawings and library to keep
loading after the migration, so that I do not lose work.

#### Acceptance Criteria

1. THE system SHALL continue to autosave the scene to `localStorage` under the key
   `sketchify.scene.v1` with the same shape (`{ elements, local: { pan, zoom,
   background, theme, grid, name, rectangleRoundness } }`) and SHALL load scenes written
   by the current app without data loss.
2. THE system SHALL continue to store the reusable library under
   `sketchify.library.v1` with the same structure and SHALL load existing library data.
3. THE system SHALL preserve the debounced autosave behavior (save after a short idle,
   with the "Saving…" / "Saved on this device" state indicator) and the graceful
   handling of unavailable/full storage (user-visible message, offer to save to file).
4. WHEN storage cannot be read at startup THEN the system SHALL surface the same
   non-fatal recovery message and keep the app usable, matching current behavior.
5. THE `.excalidraw` export/import format (including the `textSpans` extension, the
   unsupported-element skip count with its confirmation dialog, and the 20 MB import
   limit) SHALL remain byte-compatible with the current `exportScene`/`importScene`.

### Requirement 7: Text editing and rich text

**User Story:** As a user, I want rich-text editing to behave exactly as it does now, so
that formatting, links, and selection keep working.

#### Acceptance Criteria

1. THE system SHALL preserve the `contenteditable` floating text editor with its current
   capabilities: typing, multi-line input, bold/italic/underline, links (web and
   email), combined styles, caret-only pending-style application, composition (IME)
   handling, and internal undo/redo.
2. THE system SHALL preserve the floating formatting toolbar (B / I / U / Link / Done),
   the link form (apply, remove, open link, cancel, validation), and the
   Ctrl/Cmd+B/I/U/K shortcuts, including positioning relative to the edited label.
3. THE system SHALL preserve clipboard behavior for rich text: the
   `application/x-sketchify-text` payload, `text/html`, and `text/plain` on copy/cut,
   and rich paste that round-trips formatting within Sketchify.
4. THE system SHALL preserve link activation on canvas (Ctrl/Cmd+click opens a link) and
   link survival through autosave, duplication, copy/paste, and `.excalidraw` export.
5. THE system SHALL preserve finish/cancel semantics (Done / Ctrl/Cmd+Enter commits,
   Escape cancels, blur commits unless focus moves to the properties or formatting
   panels) and the discard-empty-text behavior.

### Requirement 8: Import, export, and file I/O

**User Story:** As a user, I want to open and export drawings exactly as I can today, so
that my interchange with files and images is unchanged.

#### Acceptance Criteria

1. THE system SHALL support opening `.excalidraw`/`.json` files via the menu, the file
   picker, and drag-and-drop onto the window, with the same validation and
   unsupported-element reporting.
2. THE system SHALL support saving an editable `.excalidraw` file (Ctrl/Cmd+S and the
   menu) with the same filename sanitization and content.
3. THE system SHALL support image export to PNG (2× resolution, with size cap and
   fallback message) and SVG (vector, with clickable links retained), plus editable
   JSON export, with the same scope options (entire drawing vs. selected) and
   background toggle.
4. THE SVG and PNG output SHALL be visually identical to the current output for the same
   scene (same path adapter, same text rendering).

### Requirement 9: Local-first delivery and documentation

**User Story:** As a user, I want Sketchify to remain a private, local-first tool, so
that my drawings stay on my device and the app stays easy to run.

#### Acceptance Criteria

1. THE migrated app SHALL remain local-first: all drawing data stays in the browser
   (`localStorage` and exported files); the system SHALL NOT transmit scene content to
   any server or third party.
2. THE system SHALL document how to run the app locally with the new Next.js tooling
   (replacing the current "double-click `index.html`" and `node server.mjs` instructions
   in `README.md`), and SHALL state any change to the offline/from-disk story.
3. IF a static export is produced (resolving open question 2) THEN the exported output
   SHALL run as static files, preserving a close equivalent of the current no-backend
   deployment; otherwise the docs SHALL clearly describe the new runtime requirement.
4. THE system SHALL update `README.md`, `DESIGN.md`, `RENDERER.md`, and
   `THIRD_PARTY_NOTICES.md` as needed to reflect the new stack while keeping the
   attribution and parity-scope statements accurate.

### Requirement 10: Accessibility and visual design parity

**User Story:** As a user relying on keyboard and assistive technology, I want the
accessible, responsive UI to be preserved, so that the app stays usable after the
migration.

#### Acceptance Criteria

1. THE system SHALL preserve the existing ARIA roles, labels, `aria-pressed`/
   `aria-expanded` states, live regions (toast, selection info, save state), focus
   management (dialog focus, library/menu focus return), and keyboard operability of all
   controls.
2. THE system SHALL preserve the visual design described in `DESIGN.md`: white canvas,
   purple accent, compact floating controls, system UI type, optional grid, low panel
   shadows, reduced-motion handling, and the mobile toolbar/properties layout.
3. WHEN the viewport is narrow (≤760px) THEN the responsive behavior SHALL match the
   current app (toolbar wrapping, explicitly toggled properties panel, adjusted fit
   margins).
4. THE migrated UI SHALL honor `prefers-reduced-motion` by disabling transitions, as
   today.

### Requirement 11: Testing and verification

**User Story:** As a maintainer, I want automated checks to cover the migrated app at
least as well as today, so that parity is enforced, not assumed.

#### Acceptance Criteria

1. THE system SHALL retain automated checks equivalent in coverage to the current suite:
   scene geometry and history, text editing and selection ranges, rich-text persistence
   and exports, and the 196 renderer-fixture operation-and-pixel comparisons.
2. WHERE the current tests drive the app by `eval`-ing global scripts into a JSDOM
   window (`tests/helpers/app.mjs`), the system SHALL replace that harness with one
   compatible with the React/Next.js module structure, while keeping equivalent
   interaction coverage (tool use, pointer gestures, keyboard, text editing).
3. THE renderer-fixture tests SHALL run against the DOM-free path adapter using a
   canvas implementation for Node (as today with `@napi-rs/canvas`) and SHALL pass with
   exact matches.
4. WHEN the full check command runs THEN it SHALL complete without failures on the
   Node.js versions the project supports (currently 20.19+, 22.12+, 24+), or the docs
   SHALL state any revised support matrix.
5. THE migration SHALL be considered complete only when feature parity (Req. 2),
   rendering fidelity (Req. 3), data compatibility (Req. 6), and the full test suite
   (this requirement) are all verified.

### Requirement 12: Incremental, reviewable migration

**User Story:** As a maintainer, I want the migration done in verifiable increments, so
that regressions are caught early and the change is reviewable.

#### Acceptance Criteria

1. THE migration SHALL first stand up the Next.js shell and move the DOM-free model
   modules (scene, text) to ES modules behind unit tests, before porting UI.
2. THE system SHALL port the canvas renderer and vendor integration next, verified
   against the 196 fixtures, before porting interactive UI.
3. THE system SHALL port interactive features (tools, gestures, text editor, menus,
   properties, library, import/export, persistence, keyboard) in cohesive slices, each
   independently verifiable against the corresponding acceptance criteria above.
4. AT every increment the app SHALL remain buildable and the already-migrated behavior
   SHALL remain covered by passing tests.
