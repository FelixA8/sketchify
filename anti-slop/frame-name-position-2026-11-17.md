# Frame rename position

Scope: preserve the frame label's text origin while renaming. Existing canvas direction and ENERGY 1 / RHYTHM 1 / MOTION 1 remain in place.

- PASS, purpose and visual consistency: the existing label retains its layout while hidden during editing. An absolutely positioned field offsets its border and padding around that text origin. Both states inherit the same font and line height; mobile uses the same 16px minimum in both states and keeps a 44px interaction height. No decorative elements, copy, colors, or animations were added.
- PASS, interaction checks: automated DOM checks verify the label and positioning container survive entering and leaving edit mode, selection of the existing name, Enter saving, Escape cancellation, blur saving, undo/redo, persistence, rotation/pan/zoom anchoring, composition keys, blank fallback, and locked frames.
- PASS, source validation: production build, ESLint, TypeScript, and frame-name DOM tests pass.
- PASS, requested border treatment: the field retains its single purple border as the editing indicator; the extra outer focus outline is removed. Browser assertions cover the retained 1px solid border and absent outline.
- PASS, hover treatment by source inspection: the button's hover background is transparent and the existing hover color applies only to its text span. Minimum click-target dimensions and the text's bottom alignment are preserved.

Browser alignment regression coverage was added for desktop and phone widths at 75%, 100%, and 200% zoom with a rotated frame. Browser execution remains unverified: the sandbox blocks the local server, Playwright's bundled browsers are absent, and installed Chrome aborts under sandbox restrictions even with static request interception. No browser layout, screenshot, or click-through pass is claimed.
