import test from 'node:test';
import assert from 'node:assert/strict';
import * as SketchScene from '../src/scene.ts';
const { createElement, bounds, hitTest, resizeElement, exportScene, importScene, History } = SketchScene;

test('each shape type uses five shuffled variations without consecutive repeats', () => {
  const factory = SketchScene;
  for (const type of ['rectangle', 'diamond', 'ellipse', 'line', 'arrow']) {
    let previous;
    for (let cycle = 0; cycle < 10; cycle++) {
      const seen = new Set();
      for (let i = 0; i < 5; i++) {
        const seed = factory.createElement(type, 0, 0).seed;
        assert.ok(factory.STROKE_VARIATION_SEEDS.includes(seed));
        assert.notEqual(seed, previous);
        seen.add(seed); previous = seed;
      }
      assert.equal(seen.size, 5);
    }
  }
});

test('imported and explicitly supplied seeds retain their original stroke appearance', () => {
  const element = createElement('rectangle', 10, 20, { seed: 123456789 });
  assert.equal(element.seed, 123456789);
  assert.equal(importScene(exportScene([element])).elements[0].seed, 123456789);
});

test('an unfilled rectangle selects at its outline and a filled rectangle selects inside', () => {
  const shape = { ...createElement('rectangle', 100, 100), width: -80, height: -60 };
  assert.deepEqual(bounds(shape), { x: 20, y: 40, width: 80, height: 60 });
  assert.equal(hitTest(shape, { x: 60, y: 70 }), false);
  assert.equal(hitTest(shape, { x: 20, y: 70 }), true);
  assert.equal(hitTest({ ...shape, backgroundColor: '#fff' }, { x: 60, y: 70 }), true);
});

test('rounded rectangles select along their curved edge and leave the cut-off corner empty', () => {
  const shape = { ...createElement('rectangle', 0, 0, { roundness: { type: 3 } }), width: 200, height: 120 };
  assert.equal(hitTest(shape, { x: 0, y: 0 }), false);
  assert.equal(hitTest(shape, { x: 9, y: 9 }), true);
  assert.equal(hitTest(shape, { x: 0, y: 60 }), true);
  assert.equal(hitTest(shape, { x: 30, y: 30 }), false);
  const filled = { ...shape, backgroundColor: '#a5d8ff' };
  assert.equal(hitTest(filled, { x: 0, y: 0 }), false);
  assert.equal(hitTest(filled, { x: 30, y: 30 }), true);
});

test('rectangle edge defaults do not round unrelated tools and survive a file round-trip', () => {
  const style = { roundness: { type: 3 } };
  const rectangle = createElement('rectangle', 0, 0, style);
  assert.deepEqual(rectangle.roundness, { type: 3 });
  assert.notEqual(rectangle.roundness, style.roundness);
  for (const type of ['diamond', 'ellipse', 'line', 'arrow', 'freedraw', 'text']) assert.equal(createElement(type, 0, 0, style).roundness, null);
  assert.deepEqual(importScene(exportScene([rectangle])).elements[0].roundness, { type: 3 });
});

test('reverse-direction arrows keep their geometry when resized', () => {
  const arrow = { ...createElement('arrow', 200, 100), width: -100, height: 100, points: [[0, 0], [-100, 100]] };
  assert.equal(hitTest(arrow, { x: 150, y: 150 }), true);
  const resized = resizeElement(arrow, { x: 0, y: 0, width: 200, height: 200 });
  assert.deepEqual(resized.points, [[200, 0], [0, 200]]);
  assert.equal(hitTest(resized, { x: 100, y: 100 }), true);
});

test('file export and import preserve editable shapes and text', () => {
  const elements = [{ ...createElement('text', 10, 20), text: 'A < B\n你好', width: 110, height: 60 }, { ...createElement('freedraw', 10, 10), points: [[0, 0], [10, 30], [30, 20]] }];
  const restored = importScene(exportScene(elements, { viewBackgroundColor: '#fafafa' }));
  for (const [index, element] of elements.entries()) {
    for (const key of Object.keys(element)) assert.deepEqual(restored.elements[index][key], element[key]);
  }
  assert.equal(restored.appState.viewBackgroundColor, '#fafafa');
});

test('invalid imports are rejected and unsupported elements reported', () => {
  assert.throws(() => importScene('{}'), /scene/);
  const result = importScene({ elements: [{ type: 'image' }, { type: 'rectangle', x: 'bad', y: 3, opacity: 900 }] });
  assert.equal(result.skipped, 1);
  assert.equal(result.elements[0].x, 0);
  assert.equal(result.elements[0].opacity, 100);
});

test('import sanitizes styles and retains rotations without changing geometry', () => {
  const result = importScene({ elements: [null, { type: 'ellipse', angle: Math.PI / 4 }, { type: 'rectangle', id: 'a', roughness: Infinity, strokeColor: 'url(bad)', strokeStyle: 'invalid' }, { type: 'ellipse', id: 'a' }] });
  assert.equal(result.skipped, 1);
  assert.equal(result.elements[0].angle, Math.PI / 4);
  assert.equal(result.elements[1].roughness, 1);
  assert.equal(result.elements[1].strokeColor, '#1b1b1f');
  assert.equal(result.elements[1].strokeStyle, 'solid');
  assert.notEqual(result.elements[1].id, result.elements[2].id);
});

test('undo and redo retain independent snapshots and discard a superseded future', () => {
  const h = new History();
  const elements = [createElement('rectangle', 1, 2)];
  h.commit(elements);
  elements[0].x = 50;
  h.commit(elements);
  assert.equal(h.undo()[0].x, 1);
  assert.equal(h.redo()[0].x, 50);
  h.undo();
  h.commit([createElement('ellipse', 3, 4)]);
  assert.equal(h.canRedo, false);
  const snapshot = h.undo();
  snapshot[0].x = 999;
  assert.equal(h.redo()[0].type, 'ellipse');
  assert.equal(h.undo()[0].x, 1);
});
