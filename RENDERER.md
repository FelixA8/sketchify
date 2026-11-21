# Sloppiness renderer

The application uses the original rendering functions from [excalidraw/excalidraw at 701b901a0f1ba3d0b390d9cdf63d112e25abac4b](https://github.com/excalidraw/excalidraw/tree/701b901a0f1ba3d0b390d9cdf63d112e25abac4b), with the same declared drawing dependencies:

- Rough.js 4.6.4.
- perfect-freehand 1.2.0.
- points-on-curve 1.0.1 (Rough.js's own nested dependency is separately locked).
- @excalidraw/laser-pointer 1.3.1.
- tinycolor2 1.6.0.

`vendor/excalidraw-source.ts` retains the selected upstream declarations without changing their algorithms. `vendor/provenance.json` records each original source file's SHA-256 and declaration names. `scripts/vendor-excalidraw.mjs` extracts those declarations and bundles them with esbuild. The small bridge supplies assertion helpers; the shape, arrowhead, fill, roughness, rounding, numeric, dark-color, and freehand algorithms remain upstream code.

`src/strokes.ts` normalizes dimensions while drawing, handles empty geometry, caches the results, and converts the upstream Rough.js drawables into shared canvas/SVG path descriptors. Those paths are generated in local coordinates, so moving an element does not rerandomize its stroke. Architect, Artist, and Cartoonist map to upstream roughness 0, 1, and 2. The selector uses the original upstream SVG icons.

The checked-in `vendor/excalidraw-renderer.js` is an ES module imported directly by the adapter. Its retained source bytes, drawing dependencies, and fixture source hash are unchanged by the Next.js migration. Only bundle delivery changed: there is no global namespace attachment. A separate declaration file types the application boundary without rewriting the extracted upstream TypeScript. Canvas 2D painting and text layout are shared between the whiteboard and image exports.

## Verification scope

`scripts/record-renderer-fixtures.mjs` executes the retained upstream source directly, without the local adapter, to record fixed-seed shape operation hashes. `tests/fixtures/excalidraw-renderer.json` holds 196 fixtures and the retained source hash.

`npm test` checks exact operation hashes against those fixtures and compares native RGBA pixels produced by the local path adapter against the upstream source plus Rough.js's direct canvas renderer. All 196 cases match exactly. These checks use @napi-rs/canvas 0.1.100; they are not screenshots or measurements of the current live website.

The same seed, dimensions, points, roughness, stroke, fill, and rounding data produce the pinned upstream geometry. At the user's request, newly created shapes now draw from five fixed seeds (17, 142, 741, 2027, and 8191), shuffled separately for each shape type. Every five new shapes of a type use all five variations, and the shuffle prevents consecutive repeats across cycles. This seed-selection policy is a local customization; it is not a claim that upstream Excalidraw limits itself to five seeds. The underlying shape renderer remains upstream code.

The three sloppiness levels continue to control stroke intensity. Artist and Cartoonist show the five different seeded contours; Architect deliberately keeps the precise upstream appearance. Existing, imported, duplicated, and saved elements preserve their stored seeds, including seeds outside the five-variation pool. Redraws and moves never pick a new variation.

The live website's deployed commit, browser rasterization, upstream fonts, and the rest of the application UI have not been verified as identical.

## Rebuilding

Run `npm ci` and `npm run vendor` to rebuild the checked-in ESM bundle. `npm run vendor:check` rebuilds in memory and verifies byte-for-byte reproducibility without changing files. Run `npm test` afterwards; the existing 196 fixtures must pass without rerecording. The application itself now requires a Next.js build before serving its static output.

The source extraction command also accepts a directory containing the original source files named `sketchify-upstream-<name>.ts`, as listed in `vendor/provenance.json`, plus `sketchify-excalidraw-LICENSE`. It verifies those source hashes against the retained provenance before writing. A source or drawing-dependency upgrade requires a separate intentional provenance update, fixture rerecording, and exact operation/pixel verification; it is not part of this migration.

Legacy application compatibility fixtures additionally check storage, editable JSON, SVG bytes, and native PNG pixels. Text goldens register the locked Next.js package's Geist font under a test-only Arial alias, independent of host fonts. This does not change application font selection or add upstream Excalidraw fonts. Fixture metadata records the font hash and legacy module hashes. To render the five-seed preview, run `node --import tsx scripts/preview-variations.mjs`.

MIT notices are retained in `vendor/licenses`.
