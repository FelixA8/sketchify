import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './helpers/app.mjs';
import { rotatePoint } from '../src/scene.ts';

const box = (id, x, extra = {}) => ({ id, type: 'rectangle', x, y: 250, width: 120, height: 80, ...extra });
const all = app => { app.canvas.focus(); app.key('a', { metaKey: true }); };
function outlineAt(app, x, y, theme = 'light') {
  const [r, g, b] = theme === 'dark' ? [180, 175, 255] : [105, 101, 219];
  const pixels = app.canvas.getContext('2d').getImageData(Math.round(x) - 1, Math.round(y) - 1, 3, 3).data;
  for (let i = 0; i < pixels.length; i += 4) if (Math.abs(pixels[i] - r) < 4 && Math.abs(pixels[i + 1] - g) < 4 && Math.abs(pixels[i + 2] - b) < 4 && pixels[i + 3] > 40) return true;
  return false;
}

for (const theme of ['light', 'dark']) test(`multi-selection outlines each component and a group keeps one border in ${theme} mode`, () => {
  const app = createApp({ theme, savedElements: [box('one', 400), box('two', 700)] });
  all(app);
  assert.equal(outlineAt(app, 525, 290, theme), true); assert.equal(outlineAt(app, 695, 290, theme), true);
  app.key('g', { metaKey: true });
  assert.equal(outlineAt(app, 525, 290, theme), false); assert.equal(outlineAt(app, 695, 290, theme), false);
  assert.equal(outlineAt(app, 395, 290, theme), true); assert.equal(outlineAt(app, 825, 290, theme), true);
  app.key('G', { metaKey: true, shiftKey: true });
  assert.equal(outlineAt(app, 525, 290, theme), true); assert.equal(outlineAt(app, 695, 290, theme), true);
});

test('individual borders appear during marquee selection and disappear when selection is cleared', () => {
  const app = createApp({ savedElements: [box('one', 400), box('two', 700)] });
  app.dispatch(app.canvas, 'pointerdown', { clientX: 370, clientY: 220 });
  app.dispatch(app.canvas, 'pointermove', { clientX: 850, clientY: 350 });
  assert.equal(app.get('selection-info').textContent, '2 selected');
  assert.equal(outlineAt(app, 525, 290), true); assert.equal(outlineAt(app, 695, 290), true);
  app.dispatch(app.canvas, 'pointerup'); app.key('Escape');
  assert.equal(outlineAt(app, 525, 290), false); assert.equal(outlineAt(app, 695, 290), false);
});

test('rotated component borders follow the component at the saved pan and zoom', () => {
  const zoom = 1.5, pan = { x: -200, y: -100 }, angle = Math.PI / 4;
  const app = createApp({ zoom, pan, savedElements: [box('one', 400, { angle }), box('two', 700)] }); all(app);
  const point = rotatePoint({ x: 520 + 5 / zoom, y: 290 }, { x: 460, y: 290 }, angle);
  assert.equal(outlineAt(app, point.x * zoom + pan.x, point.y * zoom + pan.y), true);
  assert.equal(outlineAt(app, (700 - 5 / zoom) * zoom + pan.x, 290 * zoom + pan.y), true);
});

test('mixed selections outline the group as a unit and each ungrouped component', () => {
  const app = createApp({ savedElements: [box('one', 400, { groupIds: ['pair'] }), box('two', 700, { groupIds: ['pair'] }), box('three', 1000)] }); all(app);
  assert.equal(outlineAt(app, 525, 290), false); assert.equal(outlineAt(app, 695, 290), false);
  assert.equal(outlineAt(app, 825, 290), true); assert.equal(outlineAt(app, 995, 290), true);
});
