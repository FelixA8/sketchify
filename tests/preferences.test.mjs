import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './helpers/app.mjs';
import { createElement } from '../src/scene.ts';
import { createStore, DEFAULT_PREFERENCES } from '../src/whiteboard/store.ts';
import { loadStorage } from '../src/whiteboard/persistence.ts';
import { minimapGeometry } from '../src/whiteboard/CanvasOverview.tsx';

const preferences = app => { app.click(app.get('menu-button')); app.click(app.document.querySelector('[data-action="preferences"]')); };
const local = app => { app.scene(); return JSON.parse(app.window.localStorage.getItem('sketchify.scene.v1')).local; };
const drag = (app, from, to) => {
  app.dispatch(app.canvas, 'pointerdown', { clientX: from.x, clientY: from.y });
  app.dispatch(app.canvas, 'pointermove', { clientX: to.x, clientY: to.y });
  app.dispatch(app.canvas, 'pointerup');
};
const shape = () => ({ ...createElement('rectangle', 350, 250), id: 'target', width: 160, height: 100 });

test('Preferences replaces the grid menu action with six labeled switches, closes and returns focus', () => {
  const app = createApp(); preferences(app);
  assert.equal(app.document.querySelector('[data-action="grid"]'), null);
  assert.equal(app.document.querySelectorAll('[role="switch"]').length, 6);
  assert.equal(app.document.activeElement.getAttribute('aria-label'), 'Back to settings');
  for (const toggle of app.document.querySelectorAll('[role="switch"]')) {
    assert.ok(app.get(toggle.getAttribute('aria-labelledby')).textContent);
    assert.ok(app.get(toggle.getAttribute('aria-describedby')).textContent);
  }
  app.get('preference-grid').focus(); app.key('r');
  assert.equal(app.document.querySelector('[data-tool="selection"]').getAttribute('aria-pressed'), 'true');
  app.key('Escape'); assert.equal(app.get('menu').hidden, true); assert.equal(app.document.activeElement, app.get('menu-button'));
});

test('grid, hints and overview switches take effect immediately and survive reload in both themes', () => {
  for (const theme of ['light', 'dark']) {
    const app = createApp({ theme }); preferences(app);
    for (const key of ['minimap', 'canvasProperties', 'grid', 'toolbarHints']) app.click(app.get(`preference-${key}`));
    assert.ok(app.get('minimap')); assert.ok(app.get('canvas-properties')); assert.equal(app.get('tool-hint').hidden, true);
    assert.ok(app.get('board-chrome').classList.contains('hide-toolbar-hints'));
    const savedLocal = local(app); assert.equal(savedLocal.grid, true);
    assert.deepEqual(savedLocal.preferences, { ...DEFAULT_PREFERENCES, minimap: true, canvasProperties: true, toolbarHints: false });
    const loaded = createApp({ savedLocal });
    assert.ok(loaded.get('minimap')); assert.ok(loaded.get('canvas-properties')); assert.equal(loaded.get('tool-hint').hidden, true);
    loaded.canvas.focus(); loaded.key("'", { ctrlKey: true }); assert.equal(local(loaded).grid, false);
  }
});

test('panel size defaults to medium and each choice updates immediately and survives reload without changing the drawing', () => {
  for (const width of [375, 1440]) for (const theme of ['light', 'dark']) {
    const app = createApp({ width, theme, savedElements: [shape()] }); preferences(app);
    const buttons = [...app.document.querySelectorAll('.panel-size-options button')];
    assert.equal(app.get('app').dataset.panelSize, 'medium');
    assert.equal(buttons[1].getAttribute('aria-pressed'), 'true');
    const original = app.scene();
    for (const size of ['small', 'large', 'medium']) {
      app.click(buttons.find(button => button.textContent.toLowerCase() === size));
      assert.equal(app.get('app').dataset.panelSize, size);
      assert.equal(buttons.filter(button => button.getAttribute('aria-pressed') === 'true').length, 1);
      assert.equal(buttons.find(button => button.getAttribute('aria-pressed') === 'true').textContent.toLowerCase(), size);
      const savedLocal = local(app);
      assert.equal(savedLocal.iconTextSize ?? 'medium', size);
      assert.deepEqual(app.scene(), original);
      assert.equal(app.get('undo-button').disabled, true);
      const loaded = createApp({ width, theme, savedElements: original, savedLocal });
      assert.equal(loaded.get('app').dataset.panelSize, size);
    }
  }
});

test('missing and malformed panel sizes fall back to medium without blocking scene loading', () => {
  for (const iconTextSize of [undefined, null, 'invalid', 'SMALL', false, 2, {}, []]) {
    const store = createStore();
    assert.equal(loadStorage(store, { getItem: () => JSON.stringify({ elements: [shape()], local: { iconTextSize } }) }), '');
    assert.equal(store.state.iconTextSize, 'medium');
    assert.equal(store.state.elements.length, 1);
  }
});

test('properties show actual scene and selection dimensions and update during transforms', () => {
  const app = createApp({ savedElements: [shape()], savedLocal: { preferences: { canvasProperties: true } } });
  const rows = () => [...app.get('canvas-properties').querySelectorAll('dl')].map(dl => dl.textContent).join(' ');
  assert.match(rows(), /Shapes1/); assert.match(rows(), /Width160Height100/); assert.match(rows(), /Scene\d+(\.\d+)? (KB|B)Total/);
  assert.match(app.get('canvas-properties').textContent, /Select a shape/);
  app.click(app.canvas, { clientX: 430, clientY: 250 });
  assert.match(rows(), /TyperectangleX350Y250/);
  drag(app, { x: 510, y: 350 }, { x: 610, y: 410 });
  assert.match(rows(), /Width260Height160/);
  app.click(app.get('undo-button')); assert.match(rows(), /Width160Height100/);
  app.click(app.get('canvas-properties').querySelector('button'));
  assert.equal(app.get('canvas-properties'), null); assert.equal(local(app).preferences, undefined);
});

test('minimap navigation pans without moving shapes, supports keyboard fitting, and persists viewport', () => {
  const app = createApp({ savedElements: [shape()], savedLocal: { preferences: { minimap: true } } });
  const original = app.scene(); const map = app.get('minimap').querySelector('canvas');
  map.getBoundingClientRect = () => ({ left: 0, top: 0, width: 220, height: 128 });
  app.click(map, { clientX: 150, clientY: 64 });
  assert.ok(local(app).pan.x < 0); assert.deepEqual(app.scene(), original);
  const x = local(app).pan.x; app.key('ArrowRight'); assert.equal(local(app).pan.x, x - 360);
  app.key('Home'); assert.ok(local(app).zoom > 1); assert.deepEqual(app.scene(), original);
});

test('minimap geometry contains rotated drawings and the viewport at negative coordinates and any zoom', () => {
  const store = createStore();
  store.change(s => { s.pan = { x: 1900, y: -1200 }; s.zoom = .2; s.elements = [{ ...shape(), x: -9000, y: -8000, angle: Math.PI / 4 }]; });
  const g = minimapGeometry(store.state, 1440, 900);
  const v = g.viewport;
  assert.ok(g.x + v.x * g.scale >= 12 - 1e-6); assert.ok(g.y + v.y * g.scale >= 12 - 1e-6);
  assert.ok(g.x + (v.x + v.width) * g.scale <= 208 + 1e-6);
  assert.ok(g.y + (v.y + v.height) * g.scale <= 116 + 1e-6);
});

test('zen mode hides chrome and panels, persists, and exits with Escape, button, or Alt+Z without clearing selection', () => {
  for (const width of [1440, 375]) {
    const app = createApp({ width, savedElements: [shape()], savedLocal: { preferences: { minimap: true, canvasProperties: true } } });
    app.click(app.canvas, { clientX: 430, clientY: 250 }); preferences(app); app.click(app.get('preference-zenMode'));
    assert.equal(app.get('board-chrome').hidden, true); assert.equal(app.get('properties').hidden, true); assert.equal(app.get('menu').hidden, true);
    assert.equal(app.get('minimap'), null); assert.equal(app.get('canvas-properties'), null); assert.ok(app.get('exit-zen'));
    assert.equal(local(app).preferences.zenMode, true);
    app.key('Escape'); assert.equal(app.get('board-chrome').hidden, false); assert.equal(app.get('selection-info').textContent, '1 selected');
    app.key('z', { altKey: true, code: 'KeyZ' }); app.click(app.get('exit-zen')); assert.equal(local(app).preferences.zenMode, false);
    const loaded = createApp({ width, savedLocal: { preferences: { zenMode: true } } });
    assert.ok(loaded.get('exit-zen')); loaded.canvas.focus(); loaded.key('z', { altKey: true, code: 'KeyZ' }); assert.equal(loaded.get('exit-zen'), null);
  }
});

for (const type of ['arrow', 'line']) test(`${type} binding switch prevents new attachments during drawing, movement, and endpoint editing`, () => {
  const app = createApp({ savedElements: [shape()] }); preferences(app); app.click(app.get('preference-arrowBinding')); app.key('Escape');
  app.tool(type); drag(app, { x: 516, y: 300 }, { x: 760, y: 400 });
  let wire = app.scene()[1]; assert.equal(wire.startBinding, undefined); assert.equal(wire.endBinding, undefined); assert.equal(wire.x, 516);
  drag(app, { x: 638, y: 350 }, { x: 632, y: 350 }); wire = app.scene()[1]; assert.equal(wire.startBinding, undefined);
  drag(app, { x: 510, y: 300 }, { x: 516, y: 300 }); wire = app.scene()[1]; assert.equal(wire.startBinding, null); assert.equal(wire.x, 516);
  preferences(app); app.click(app.get('preference-arrowBinding')); app.key('Escape');
  drag(app, { x: 516, y: 300 }, { x: 515, y: 300 }); wire = app.scene()[1]; assert.equal(wire.startBinding.elementId, 'target'); assert.equal(wire.x, 510);
});

test('disabling binding keeps existing attachments following their shapes', () => {
  const app = createApp({ savedElements: [shape()] }); app.tool('arrow'); drag(app, { x: 516, y: 300 }, { x: 760, y: 400 });
  preferences(app); app.click(app.get('preference-arrowBinding')); app.key('Escape');
  drag(app, { x: 430, y: 250 }, { x: 450, y: 290 });
  const wire = app.scene()[1]; assert.equal(wire.startBinding.elementId, 'target'); assert.equal(wire.x, 530); assert.equal(wire.y, 340);
});

test('malformed and partial saved preferences retain defaults without blocking scene loading', () => {
  for (const preferences of [null, 'invalid', 2, { arrowBinding: 'false', minimap: true, zenMode: 1 }]) {
    const store = createStore(); const error = loadStorage(store, { getItem: () => JSON.stringify({ elements: [shape()], local: { preferences } }) });
    assert.equal(error, ''); assert.equal(store.state.elements.length, 1);
    assert.equal(store.state.preferences.arrowBinding, true); assert.equal(store.state.preferences.zenMode, false);
    assert.equal(store.state.preferences.minimap, preferences?.minimap === true);
  }
});

test('Space and Enter retain native activation for properties disclosures and the zen exit button', () => {
  const app = createApp({ savedLocal: { preferences: { canvasProperties: true } } });
  app.get('canvas-properties').querySelector('summary').focus();
  assert.equal(app.key(' ').defaultPrevented, false); assert.equal(app.key('Enter').defaultPrevented, false);
  app.canvas.focus(); app.key('z', { altKey: true, code: 'KeyZ' }); app.get('exit-zen').focus();
  assert.equal(app.key(' ').defaultPrevented, false); assert.equal(app.key('Enter').defaultPrevented, false);
});

test('grid retains Cmd/Ctrl+quote and Option+Z handles the Mac character while Preferences is open', () => {
  const app = createApp(); preferences(app); app.get('preference-grid').focus();
  app.key("'", { metaKey: true }); assert.equal(app.get('preference-grid').getAttribute('aria-checked'), 'true');
  app.key("'", { ctrlKey: true }); assert.equal(app.get('preference-grid').getAttribute('aria-checked'), 'false');
  app.get('preference-zenMode').focus();
  assert.equal(app.key('Ω', { altKey: true, code: 'KeyZ' }).defaultPrevented, true);
  assert.equal(app.get('board-chrome').hidden, true); assert.equal(app.get('menu').hidden, true);
  app.key('Ω', { altKey: true, code: 'KeyZ' }); assert.equal(app.get('board-chrome').hidden, false);
});
