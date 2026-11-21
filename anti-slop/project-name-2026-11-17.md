# Project name checks

Scope: header project name, inline field, default naming, and existing rename dialog.

- Direction and liveliness PASS: DESIGN.md records the screenshot-directed header interaction and existing ENERGY 1 / RHYTHM 1 / MOTION 1. The drawing remains the focal point; the existing system type and purple focus accent identify the rename control without new decoration or animation.
- Purpose and consistency PASS: title position and font metrics are shared by the label and its overlaid field. One purple border identifies editing. Constrained widths and text ellipsis reserve room for the toolbar; phone fields use at least 16px type and 44px height. Default dates remain in storage/filenames and are hidden from the header, field, dialog, and browser title.
- Functional and keyboard checks PASS: tests/project-name.test.mjs mounts the actual React application and exercises a single click, selected contents, Enter, Escape, blur, blank names, IME keys, focus restoration, persistence, imports, the existing rename menu, and exports. The native button's click handler also supports keyboard activation and touch. Names do not change drawing content or undo history.
- Contrast PASS: measured light/dark ink-to-panel ratios are 15.24:1 and 12.48:1. Purple editing border/focus accents measure 6.02:1 and 7.83:1 against their panels.
- Source validation PASS: 298 Node tests, ESLint, strict TypeScript, and production build pass. No visual assets, statistics, claims, or navigation were added.
- Browser delivery gate PENDING: tests/browser/project-name.spec.ts adds six desktop/tablet/phone light/dark scenarios. The attempted Chromium run cannot start its localhost server because the sandbox rejects binding with EPERM. Actual layout dimensions, screenshots, and touch behavior remain unverified in a browser.
