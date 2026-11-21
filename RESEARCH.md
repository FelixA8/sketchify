# Excalidraw reconstruction notes

Requested target: https://excalidraw.com/

## Flowchart shortcut investigation, 2026-11-21

The reverse-engineer-anything browser and recovery guidance was applied. REA tools remain absent, no installed CLI was found, and the CLI package attempt failed with registry DNS `ENOTFOUND`. The web reader could retrieve the site's JavaScript-required placeholder and public upstream source. No REA Evidence IDs or live Excalidraw observations were produced.

- Source observation: [App.flowchart.ts](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.flowchart.ts) handles a single eligible selection, previews nodes on Cmd/Ctrl+Arrow without Shift, cancels on Escape, and commits on modifier release, selecting the first child. Repeated keydowns add siblings; a direction change resets the pending cluster.
- Source observation: [element flowchart.ts](https://github.com/excalidraw/excalidraw/blob/master/packages/element/src/flowchart.ts) copies shape type, dimensions, and drawing style into blank nodes, uses 100 scene-unit spacing, creates bound elbow arrows, and avoids existing connected chart nodes. These are mutable upstream source links reviewed on this date, not proof of the exact build deployed at excalidraw.com.
- Local implementation choices: support Sketchify's rectangle, ellipse, and diamond types, reuse its fixed-point endpoint bindings, keep previews outside saved elements, and reroute orthogonal segments when attached endpoints move. Automatic snapping preferences do not disable explicitly requested flowchart connections. Preview arrows meet the visible shape outline without upstream's six-unit padding. Navigation with Alt/Option+Arrow and full upstream obstacle-aware arrow routing are outside this change.
- Verification: React DOM interaction tests exercise both Cmd and Ctrl, all directions and supported shapes, held-modifier siblings, selection after commit, cancellation, undo/redo, connected-node placement, typing guards, frame membership, rotation, reload, and editable export. Native canvas renders cover preview appearance in both themes. Browser tests were added, but local server binding returned `listen EPERM`, and a separate Chrome launch aborted. Live/browser behavior remains unverified in this sandbox.

## Evidence and limitations

The reverse-engineer-anything skill and its connection-recovery and browser-runtime instructions were read on 2026-11-09. No REA MCP tools or installed REA CLI were available. Acquiring the CLI failed because the shell could not resolve registry.npmjs.org. The permission policy rejected an elevated installation attempt. No REA runtime Evidence, screenshots, event traces, or network recordings were obtained. This project must not be described as a completed REA capture or a verified pixel-identical reconstruction.

The public page was retrieved through the web tool. Its HTML requires JavaScript. The official SDK installation documentation confirms that Excalidraw exports a React component and supports self-hosted fonts:

- https://excalidraw.com/
- https://plus.excalidraw.com/docs/sdk/excalidraw/installation

Network access subsequently allowed downloading official source and pinned rendering packages. The local application now embeds the selected, unmodified rendering routines from Excalidraw commit `701b901a0f1ba3d0b390d9cdf63d112e25abac4b`, bundled with the same declared dependency versions. Source file hashes and the extracted declarations are retained in `vendor/provenance.json`. This is source-based reconstruction, not REA runtime Evidence. See `RENDERER.md` for verification.

Full Excalidraw file compatibility must not be claimed; the local scene parser supports basic shape and text types and reports unsupported element types.

## Recovery

### Sticky notes, 2026-11-21

The user requested the reverse-engineer-anything workflow for Excalidraw notes. No REA tools or installed CLI were available in this session. Direct acquisition of the live app failed with DNS resolution blocked; the temporary-cache CLI acquisition made no progress and was canceled. No REA Evidence IDs or runtime observations were produced, and no MCP registration was changed.

Official source evidence: [the sticky-note changelog entry](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/CHANGELOG.md), [the element skeleton documentation](https://github.com/excalidraw/excalidraw/blob/master/dev-docs/docs/@excalidraw/excalidraw/api/excalidraw-element-skeleton.mdx), [layout constants](https://github.com/excalidraw/excalidraw/blob/master/packages/common/src/constants.ts), and [note colors](https://github.com/excalidraw/excalidraw/blob/master/packages/common/src/colors.ts). These establish the native `stickynote` type, N shortcut, 250px default, 75px minimum, 16px minimum font, 2px fitting steps, 16px padding, 20px footer, immutable creation timestamp, and #ffdf6b default paper color. The supplied screenshot establishes the curled paper silhouette and bottom-right date placement.

The local implementation is a source-informed reconstruction using Sketchify's editor and selection system. It supports saving/importing the native note type and rendering paper, body, and dates in PNG/SVG. The exact upstream path geometry, toolbar drag-out creation, and live behavior parity are not established. The paper curve is reconstructed from the screenshot. Existing Sketchify font choices are retained. Playwright's bundled browser is absent, and launching installed Chrome is blocked by the host, so validation uses the existing JSDOM interaction harness, the actual Canvas renderer, export pixel checks, and production build.

Once network access is available, install `rea-agents` in a trusted directory outside this project and inspect its current CLI help. Capture a temporary browser session against https://excalidraw.com/ using the skill's browser scenario workflow. Retain the complete Evidence before deriving a feature map, and distinguish observed behavior from reconstruction choices. Do not change MCP registration or install unrelated analysis engines.
