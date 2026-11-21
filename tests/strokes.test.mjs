import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createCanvas, Path2D } from '@napi-rs/canvas';
import rough from 'roughjs';
import * as SketchScene from '../src/scene.ts';
import * as ExcalidrawRenderer from '../vendor/excalidraw-renderer.js';
import * as SketchStrokes from '../src/strokes.ts';

const { createElement } = SketchScene;
const { generateShape, renderPaths } = SketchStrokes;
const upstream = ExcalidrawRenderer;
const reference = JSON.parse(readFileSync(new URL('./fixtures/excalidraw-renderer.json', import.meta.url)));
const sha = value => createHash('sha256').update(value).digest('hex');
const serialize = shape => !shape ? [] : (Array.isArray(shape) ? shape : [shape]).map(s => typeof s === 'string' ? s : { shape: s.shape, sets: s.sets });

test('all fixed-seed geometry matches fixtures recorded directly from pinned upstream source', () => {
  assert.equal(sha(readFileSync(new URL('../vendor/excalidraw-source.ts', import.meta.url))), reference.sourceSha256);
  for (const fixture of reference.fixtures) {
    const shape = generateShape(fixture.element, fixture.dark);
    assert.equal(sha(JSON.stringify(serialize(shape))), fixture.hash, fixture.name);
  }
});

test('canvas path rendering is pixel-identical to the direct upstream renderer for every fixture', () => {
  for (const fixture of reference.fixtures) {
    const element = fixture.element;
    const expected = createCanvas(280, 200), actual = createCanvas(280, 200);
    const expectedContext = expected.getContext('2d'), actualContext = actual.getContext('2d');
    for (const ctx of [expectedContext, actualContext]) { ctx.translate(element.x, element.y); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = .75; }
    const shape = upstream.generateElementShape(element, new upstream.RoughGenerator(), { isExporting: false, canvasBackgroundColor: '#ffffff', embedsValidationStatus: null, theme: fixture.dark ? 'dark' : 'light' });
    const renderer = rough.canvas(expected);
    for (const drawable of Array.isArray(shape) ? shape : [shape]) {
      if (typeof drawable === 'string') {
        expectedContext.fillStyle = upstream.applyDarkModeFilter(element.strokeColor, fixture.dark);
        expectedContext.fill(new Path2D(drawable));
      } else renderer.draw(drawable);
    }
    for (const path of renderPaths(element, fixture.dark)) {
      actualContext.setLineDash(path.dash);
      if (path.fill !== 'none') { actualContext.fillStyle = path.fill; actualContext.fill(new Path2D(path.d), path.fillRule); }
      if (path.stroke !== 'none') { actualContext.strokeStyle = path.stroke; actualContext.lineWidth = path.strokeWidth; actualContext.stroke(new Path2D(path.d)); }
    }
    const expectedPixels = expected.data();
    assert.ok(expectedPixels.some((value, index) => index % 4 === 3 && value > 0), `${fixture.name} reference contains visible ink`);
    assert.equal(Buffer.compare(expectedPixels, actual.data()), 0, fixture.name);
  }
});

test('Excalidraw small-shape and dashed-line rules are preserved', () => {
  const element = { ...createElement('rectangle', 0, 0), width: 8, height: 6, roughness: 2, strokeStyle: 'dashed', seed: 142 };
  const options = upstream.generateRoughOptions(element);
  assert.equal(options.roughness, 2 / 3);
  assert.equal(options.disableMultiStroke, true);
  assert.equal(options.strokeWidth, 2.5);
  assert.equal(options.fillWeight, 1);
  assert.equal(options.hachureGap, 8);
  assert.deepEqual(options.strokeLineDash, [8, 10]);
  const paths = renderPaths(element);
  assert.deepEqual(paths[0].dash, [8, 10]);
});

test('redraws, moves, and file round-trips preserve the exact seeded strokes', () => {
  const element = { ...createElement('ellipse', 10, 20), width: 200, height: 120, roughness: 2, seed: 142, backgroundColor: '#a5d8ff' };
  const original = structuredClone(renderPaths(element));
  element.x += 100; element.y -= 50;
  assert.deepEqual(renderPaths(element), original);
  assert.deepEqual(renderPaths(JSON.parse(JSON.stringify(element))), original);
  assert.notDeepEqual(renderPaths({ ...element, seed: 255 }), original);
  element.roughness = 0;
  assert.notDeepEqual(renderPaths(element), original);
});

test('all five variations produce distinct Artist and Cartoonist strokes and survive saving', () => {
  const { STROKE_VARIATION_SEEDS, exportScene, importScene } = SketchScene;
  for (const type of ['rectangle', 'diamond', 'ellipse', 'line', 'arrow']) {
    for (const roughness of [1, 2]) {
      const paths = new Set();
      for (const seed of STROKE_VARIATION_SEEDS) {
        const element = { ...createElement(type, 20, 30, { seed }), width: 200, height: 120, roughness, points: ['line', 'arrow'].includes(type) ? [[0, 0], [200, 120]] : [] };
        const original = renderPaths(element);
        paths.add(JSON.stringify(original));
        assert.deepEqual(renderPaths(importScene(exportScene([element])).elements[0]), original);
      }
      assert.equal(paths.size, 5, `${type} at roughness ${roughness} has five different stroke contours`);
    }
  }
});

test('empty and degenerate shapes never emit invalid coordinates', () => {
  for (const type of ['rectangle', 'diamond', 'ellipse', 'line', 'arrow', 'freedraw']) {
    const element = { ...createElement(type, 0, 0), seed: 142, points: [[0, 0], [0, 0]] };
    for (const path of renderPaths(element)) assert.doesNotMatch(path.d, /NaN|Infinity/);
  }
});
