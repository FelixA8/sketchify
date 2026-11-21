# Sketchify

A private, local-first drawing app built with Next.js, React, and TypeScript. Shapes use Excalidraw's source-pinned renderer, bundled with the original drawing dependencies. Drawing data stays in browser storage and exported files.

## Run locally

Use Node.js **20.19+, 22.12+, or 24+** and npm. Install the locked dependencies once:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. The development command starts Next.js. To build and preview production:

```sh
npm run build
npm start
```

The build creates static files in `out/`. `start` runs the small Node static server on port 3000; set `PORT` to change it. Any HTTP static host can serve `out/`; no Next.js application server or backend is required. `next start` is not used with this static export.

Directly double-clicking `index.html` is no longer supported. Building requires installed dependencies; the built files need HTTP serving. The app has no service worker, so offline reload depends on the host and browser cache. Once loaded, drawing, storage, and exports do not need a network connection.

Keep the **same origin** (scheme, hostname, and port), browser, and browser profile to retain access to existing saved work. In particular, `localhost` and `127.0.0.1` have separate storage. Drawings previously saved under `file://` must be exported from the old app and imported into the new one. Keep file backups before changing how you launch Sketchify.

## Features

- Selection, hand, rectangle, diamond, ellipse, arrow, line, freehand, text, and eraser.
- Sticky notes: select the note tool or press **N**, then click for a 250×250 note or drag to size it. Type immediately and click **Done** to finish; double-click the paper to edit again. Notes have five paper colors, text/font controls, a creation-date footer, and text that shrinks before the paper grows. Move, resize, rotate, duplicate, save, and export notes with the rest of the drawing.
- Move, resize, shift/marquee multi-select, duplicate, stacking order, keyboard nudging, undo, and redo.
- Rotate any object or multi-selection with its circular handle. Hold Shift to snap to 15° steps; frame contents rotate together, and text stays editable at its angle.
- Attach either endpoint of an arrow or line to a rectangle, ellipse, diamond, or standalone text. Endpoints snap to the center or side midpoints, or attach elsewhere along an edge, and keep their attachment position as the target moves, resizes, or rotates.
- Stroke/fill colors, hachure/cross-hatch/solid fills, widths, solid/dashed/dotted strokes, opacity, font size/family, and three sloppiness levels.
- Sharp/rounded rectangle edges update selected rectangles and become the persisted default for new rectangles.
- Five shuffled stroke seeds per shape type; existing, imported, and duplicated elements retain their seeds.
- Pan, zoom, fit, reset, optional alignment grid, light/dark themes, and a responsive layout.
- Preferences in the main menu: minimap, canvas and shape statistics, grid, arrow binding, toolbar hints, and zen mode. Switches apply immediately and persist on this device.
- Drawing rename, clear, and browser autosave.
- Project name beside the menu button: click once to rename, or activate with Enter/Space or a touch tap. Enter or clicking away saves; Escape cancels. New projects use `sketchify_YYYY-MM-DD` for filenames and display `Sketchify` without the date.
- Reuse selections with copy/paste or duplicate, preserving styles and connections.
- Pages and Layers sidebar, with shape properties on the right. Each page has its own canvas, background, view, and undo/redo history. Add, rename, duplicate, reorder, or delete pages.
- Expand frames and nested groups, select members, rename layers, hide/show, lock/unlock, and drag to reorder or change containment. Hidden objects do not appear in image exports. Parent visibility and locking apply to descendants.
- Save all pages in one `.sketchify` project. Export the current page or selection as editable `.excalidraw` JSON, PNG, or SVG; reopen projects and older drawings through the file picker or drag/drop.
- Export images with a live preview, 1×/2×/3× scale, an independent dark-mode switch, and an optional transparent background. Download PNG or SVG, or copy a PNG image to the clipboard. Large PNGs are capped at 8192 px on their longest side with a visible size notice; SVG retains vector geometry at the selected scale. Clipboard copying requires browser clipboard access.

Press `?` for shortcuts. Hold Space to pan. Use Ctrl/Cmd+S to save an editable file and Ctrl/Cmd+O to open one. To add a shape using the keyboard, choose its tool, Tab to the canvas, and press Enter. Arrow keys move the selection.

Select a rectangle, ellipse, or diamond and press Cmd+Arrow (Ctrl+Arrow on Windows/Linux) to create a matching blank node connected by an elbow arrow. Keep Cmd/Ctrl held and press the same arrow repeatedly to preview a row or column of sibling nodes. Release Cmd/Ctrl to commit them in one undo step and select the first new node; press the shortcut again to extend the chart from it. Changing direction while holding the modifier replaces the pending nodes; Escape cancels the preview. Existing connected nodes keep their spacing, and arrows follow node movement. Explicit flowchart creation attaches arrows even when automatic arrow snapping is disabled.

Use the sidebar button beside the main menu to show **Pages and Layers**. The sidebar remembers whether it is open. Click a page to switch canvases; its `…` button exposes rename, duplicate, reorder, and delete actions. Deleting a page requires confirmation, and the final page cannot be deleted. Switching pages finishes text editing and clears the selection. Page undo histories last for the current session; switching pages preserves them, and reopening a project starts fresh histories.

Layer rows follow drawing order, with frontmost objects first. Click a row to select an exact member; Shift/Ctrl/Cmd-click adds or removes it from the selection. Double-click or use **Rename** to change its layer label without changing text content. Eye and lock controls affect the row and its descendants. Drag near the top or bottom of a row to change order, or into the middle of a frame/group to change containment. The row's actions also provide **Move up**, **Move down**, and **Move to** for keyboard and touch use. Arrow keys navigate the layer list, Left/Right collapse or expand branches, and F2 renames. On phones the sidebar opens as a dismissible drawer. Existing saved drawings become Page 1. Per-page `.excalidraw` exports retain Sketchify layer settings in an app-state extension; other readers may ignore those settings.

Select two or more components and press Cmd+G (Ctrl+G on Windows/Linux) to group them. Cmd+Shift+G (Ctrl+Shift+G) ungroups one level. Both actions are also in the right-click menu. Groups select, move, resize, rotate, copy, and delete together. Double-click to select a member within a group; double-click again to enter a nested group or edit a member's text. Enter provides a keyboard alternative for entering a selected group. Escape returns to the containing group, and clicking outside leaves the group. Nested groups survive ungrouping their parent. Grouping is undoable and persists in saved drawings and editable exports.

Open the main menu and choose **Preferences** to customize the workspace. The minimap supports click/drag navigation, arrow-key panning, and Home to fit. Properties shows scene storage and dimensions, plus measurements for selected objects. Storage values describe the UTF-8 size of the saved JSON payload. Grid and snapping share a switch; Ctrl/Cmd+' also toggles it. Arrow binding controls new attachments; existing connections keep following their shapes. Zen mode hides panels and tools; Option+Z (Alt+Z on Windows/Linux) toggles it, and its exit button or Escape returns to the workspace. Both grid and zen shortcuts also work while Preferences is open. On phones, the style panel temporarily takes the place of the overview panels.

Draw a line or arrow with either end near a shape or text edge or center to connect it. Hover near the center or a side midpoint to see a small circle before drawing or while dragging either endpoint. Select an existing connector and drag either circular endpoint handle to attach it, change its attachment position, or pull it away to detach. Connections survive autosave, editable exports, and copying the connected objects together.

Double-click text to edit it. Select a phrase and use **B**, **I**, **U**, or **Link**, or Ctrl/Cmd+B/I/U/K. Formatting can be combined. Toggling a format with only a caret applies it to subsequent typing. Done or Ctrl/Cmd+Enter commits; Escape cancels. Formatting controls preserve selection and IME input.

Drag a text box's left or right side handle to set its width and wrap its content without changing the font size. You can also enter a width in pixels in the text properties, or choose **Fit text** to restore automatic width. Corner handles scale the text and its box together. Wrapping width survives autosave and editable export; PNG and SVG use the same wrapped layout. Other Excalidraw readers may ignore the `textWidth` extension.

Ctrl/Cmd-click linked canvas text to open its destination. The link form can apply, change, remove, or open web/email links. Formatting and links survive autosave, duplication, internal copy/paste, and editable export. SVG retains clickable links; PNG retains their appearance. Inline formatting uses the `textSpans` extension, which other Excalidraw readers may display as plain text.

## Architecture

The single App Router page pre-renders the canvas and application controls into the initial HTML. There is no separate startup loading screen. The document-head bootstrap applies saved colors, control sizing, zen mode, and toolbar hints before first paint and suppresses empty onboarding when restoring a drawing. Hydration restores local storage and paints the canvas synchronously before handing appearance back to React. The handwriting font loads in the background and refreshes drawing text geometry when ready; welcome text uses an optional font face to avoid a late font swap. React renders all application chrome using the existing global stylesheet. Canvas 2D drawing and the stable contenteditable editor remain imperative.

- `src/scene.ts` and `src/text.ts`: DOM-free geometry, history, serialization, rich-text operations, and layout.
- `src/strokes.ts`: DOM-free adapter over the checked-in ESM renderer.
- `src/whiteboard/`: React components, a per-instance immutable store, and focused controllers for gestures, text, keyboard, files, and persistence.

The store exposes immutable snapshots through `useSyncExternalStore`. Commands update Immer drafts in synchronous transactions; nested commands share the transaction. IDs and seed selection happen in commands rather than React rendering. Each page has an independent `History` of drawing elements and layer settings, with one entry per completed edit/gesture and a 100-entry limit. Viewport and transient UI changes do not enter scene history. Text editing has its own internal undo stack until committed. The existing drawing controllers continue to read active-page fields; page switches capture those fields and restore the next page.

Startup loads `sketchify.scene.v1` before enabling saves. Project autosave is debounced by 300 ms, and unload commits active text before saving. The saved payload includes all pages and keeps the active scene and workspace preferences in the existing fields. Legacy single-canvas data loads as Page 1. `.sketchify` files use a versioned project envelope; the individual-page Excalidraw serializer remains compatible with existing scenes. Listeners, animation frames, save/toast timers, editor controllers, and object URLs are disposed on unmount, including React Strict Mode remounts. The library feature has been removed; any existing `sketchify.library.v1` data is left untouched and is no longer read or written by the app.

## Commands and checks

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next.js development server |
| `npm run build` | Type-check and generate production static output |
| `npm start` | Serve an existing `out/` build |
| `npm run lint` | ESLint, including React and Next.js rules |
| `npm run typecheck` | Strict TypeScript checking |
| `npm test` | Node model, React/jsdom interaction, compatibility, and renderer tests |
| `npm run test:e2e` | Playwright tests against production output in Chromium, Firefox, and WebKit |
| `npm run vendor` | Rebuild the checked-in ESM renderer |
| `npm run vendor:check` | Verify the renderer rebuild without writing files |
| `npm run check` | Lint, types, Node tests, vendor verification, build, and browser tests |

Install browser binaries before running the full check:

```sh
npx playwright install chromium firefox webkit
npm run check
```

Linux environments may need `npx playwright install --with-deps chromium firefox webkit`. For a locally installed Chrome, set `PLAYWRIGHT_CHROME_CHANNEL=chrome` and run `npx playwright test --project=chromium` after building. Browser tests require permission to launch a browser and bind a localhost port.

The Node suite retains the original 49 scenarios and adds migration coverage. All 196 pinned renderer fixtures must match exact operation hashes and native RGBA pixels. Legacy storage, editable JSON, SVG, and native PNG outputs have separate compatibility fixtures. Their normal-text rendering uses a test-only font from the locked Next.js dependency to avoid host-font differences. Handwritten text bounds tests load the application's bundled Patrick Hand font.

Passing model/native-canvas tests does not establish browser visual parity by itself.

## Renderer scope and attribution

This independent application uses rendering routines from Excalidraw commit `701b901a0f1ba3d0b390d9cdf63d112e25abac4b`, Rough.js 4.6.4, perfect-freehand 1.2.0, and points-on-curve 1.0.1. See the retained [licenses](vendor/licenses/) and [source provenance](vendor/provenance.json). Font licenses are retained alongside the font files in `public/fonts/`.

Live collaboration and upstream Excalidraw fonts remain out of scope. Groups, images, frames, rotation, and fixed endpoint connections to rectangles, ellipses, diamonds, and standalone text are supported. Unsupported elements and missing image files are reported before import. Handwritten text uses locally bundled Patrick Hand; SVG exports embed the font and its license. Normal and code text metrics depend on available system fonts. Parity claims concern this app's prior behavior and the pinned renderer fixtures, not the full upstream application or an unidentified live-site build.
