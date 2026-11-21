# Frame name editing checks

Scope: the frame label and inline name field.

- PASS, direction and purpose: DESIGN.md records the existing ENERGY 1 / RHYTHM 1 / MOTION 1 direction. The label becomes a button so tapping and keyboard activation open the same field. No animation or decorative assets were added.
- PASS, functional controls: tests/frame-names.test.mjs exercises wrapping a selection, tapping its label, selecting the current name, Enter, Escape, blur saving, undo, redo, and scene export/import/reload. Frame members and geometry remain intact.
- PASS, input states: the same tests verify blank-name fallback, composition-key handling, and locked frames. Other drawing tools retain canvas pointer access.
- PASS, keyboard and focus: the label is a native button, the input has an accessible name and selects its contents, and Enter/Escape restore canvas focus. The input uses a visible purple border and outline.
- PASS, contrast: labels use the existing muted UI text colors. The field uses the existing panel/ink colors and purple focus accent. Checked with antislop-human/contrast-check.py for both default themes.
- PASS, layout implementation: label anchors use rotated frame coordinates and saved pan/zoom, verified in the DOM test. Mobile labels and inputs have 44px minimum heights; the input has a viewport-relative maximum width.
- PASS, source and build: changes live in React/TypeScript and CSS; production build, lint, type checking, and automated DOM interaction checks pass.

Browser limitation: Playwright coverage was added for desktop and narrow rotated frames, but this sandbox rejects binding the local HTTP server with EPERM. Real-browser layout and touch execution remain unverified here.
