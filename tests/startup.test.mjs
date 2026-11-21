import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { renderToString } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import Page from '../src/app/page.tsx';
import { createApp } from './helpers/app.mjs';
import { createElement } from '../src/scene.ts';
import { appearanceBootstrap } from '../src/appearance.ts';
import { mountCanvas } from '../src/whiteboard/canvas.ts';
import { createStore, initialState } from '../src/whiteboard/store.ts';

test('the restored canvas is painted synchronously before the first animation frame', () => {
  const app = createApp();
  const rectangle = { ...createElement('rectangle', 350, 250), width: 120, height: 80, backgroundColor: '#ff0000', fillStyle: 'solid' };
  const store = createStore({ ...initialState(), elements: [rectangle] });
  const dispose = mountCanvas(app.canvas, store);
  try {
    const pixel = app.canvas.getContext('2d').getImageData(400, 290, 1, 1).data;
    assert.deepEqual([...pixel], [255, 0, 0, 255]);
  } finally { dispose(); }
});

for (const strict of [false, true]) test(`saved board hydrates with its final appearance and clears startup overrides (strict=${strict})`, () => {
  const colors = [];
  const app = createApp({ hydrate: true, strict, theme: 'dark', savedElements: [label()], zoom: 1.5,
    savedLocal: { background: '#fffce8', iconTextSize: 'large', preferences: { zenMode: true, toolbarHints: false } },
    beforeHydrate(window) {
      const style = window.document.documentElement.style, setProperty = style.setProperty.bind(style);
      style.setProperty = (property, value, priority) => {
        if (property === '--canvas') colors.push(value);
        return setProperty(property, value, priority);
      };
    },
  });
  assert.ok(colors.length > 0);
  assert.ok(colors.every(color => color === '#292719'), `Hydration must never reset the saved color: ${colors}`);
  assert.equal(app.document.documentElement.style.getPropertyValue('--canvas'), '#292719');
  assert.equal(app.document.documentElement.hasAttribute('data-startup'), false);
  assert.equal(app.get('app').dataset.panelSize, 'large');
  assert.equal(app.get('welcome').hidden, true);
  assert.equal(app.get('board-chrome').hidden, true);
  assert.equal(app.get('zoom-reset').textContent, '150%');
  assert.ok(app.get('exit-zen'));
  app.click(app.get('exit-zen'));
  assert.equal(app.get('board-chrome').hidden, false);
});

test('startup preferences and saved content are known before the body is parsed', () => {
  for (const elements of [[], [{ type: 'rectangle' }]]) {
    let beforeBody;
    const dom = new JSDOM(`<head><script>${appearanceBootstrap};window.capture();</script></head><body></body>`, {
      url: 'http://localhost/', runScripts: 'dangerously',
      beforeParse(window) {
        window.localStorage.setItem('sketchify.scene.v1', JSON.stringify({ elements: [],
          project: { activePageId: 'saved', pages: [{ id: 'saved', elements }] },
          local: { iconTextSize: 'small', preferences: { zenMode: true, toolbarHints: false } } }));
        window.capture = () => { beforeBody = window.document.body; };
      },
    });
    const root = dom.window.document.documentElement;
    assert.equal(beforeBody, null);
    assert.equal(root.getAttribute('data-startup-content'), String(elements.length > 0));
    assert.equal(root.getAttribute('data-startup-size'), 'small');
    assert.equal(root.getAttribute('data-startup-zen'), 'true');
    assert.equal(root.getAttribute('data-startup-hints'), 'false');
    dom.window.close();
  }
});

test('initial HTML contains the real canvas and controls without browser globals or a loading screen', () => {
  const markup = renderToString(React.createElement(Page));
  const dom = new JSDOM(markup);
  assert.ok(dom.window.document.getElementById('app'));
  assert.ok(dom.window.document.getElementById('canvas'));
  assert.ok(dom.window.document.getElementById('toolbar'));
  assert.ok(dom.window.document.getElementById('menu-button'));
  assert.doesNotMatch(markup, /Loading Sketchify|BAILOUT_TO_CLIENT_SIDE_RENDERING/);
  dom.window.close();
});

const label = () => ({ ...createElement('text', 350, 250), id: 'label', text: 'Local sketch gyp', width: 1, height: 1 });
function pendingFont() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { fonts: { check: () => false, load: () => promise }, resolve: () => resolve([{}]) };
}
async function settle(app, pending) {
  app.activate(); await act(async () => { pending.resolve(); await Promise.resolve(); });
}

test('a pending font never blocks controls, local restore, or drawing, and its metrics refresh without an undo step', async () => {
  const pending = pendingFont(), app = createApp({ fonts: pending.fonts, savedElements: [label()] });
  assert.ok(app.get('canvas')); assert.ok(app.get('toolbar')); assert.equal(app.scene().length, 1);
  const originalWidth = app.scene()[0].width;
  const ctx = app.canvas.getContext('2d'), measure = ctx.measureText.bind(ctx);
  ctx.measureText = text => { const metrics = measure(text); return { ...metrics, width: metrics.width * 1.5 }; };
  app.tool('rectangle'); app.canvas.focus(); app.key('Enter'); assert.equal(app.scene().length, 2);
  await settle(app, pending);
  assert.equal(app.scene().length, 2); assert.equal(app.get('undo-button').disabled, false);
  assert.ok(Math.abs(app.scene()[0].width - originalWidth * 1.5) < .01);
  app.click(app.get('undo-button')); assert.equal(app.scene().length, 1);
  assert.equal(app.get('undo-button').disabled, true);
  assert.ok(Math.abs(app.scene()[0].width - originalWidth * 1.5) < .01); assert.equal(app.scene()[0].text, 'Local sketch gyp');
  app.click(app.get('redo-button')); assert.equal(app.scene().length, 2);
});

test('a font finishing during text editing keeps the draft, selection, focus and formatting', async () => {
  const pending = pendingFont(), app = createApp({ fonts: pending.fonts });
  app.tool('text'); app.click(app.canvas, { clientX: 350, clientY: 250 });
  app.input('Keep this draft'); app.select(0, 4); app.key('b', { ctrlKey: true });
  await settle(app, pending);
  assert.equal(app.document.activeElement, app.editor); assert.equal(app.editor.textContent, 'Keep this draft');
  assert.equal(app.document.getSelection().toString(), 'Keep');
  assert.equal(app.get('undo-button').disabled, true);
  app.click(app.get('text-done'));
  const text = app.scene()[0]; assert.equal(text.text, 'Keep this draft'); assert.deepEqual(text.textSpans, [{ start: 0, end: 4, bold: true }]);
});

test('a late font is applied after the active gesture, without cutting the gesture short', async () => {
  const pending = pendingFont(), app = createApp({ fonts: pending.fonts });
  app.tool('rectangle'); app.dispatch(app.canvas, 'pointerdown', { clientX: 350, clientY: 250 });
  app.dispatch(app.canvas, 'pointermove', { clientX: 450, clientY: 350 });
  await settle(app, pending);
  assert.equal(app.get('undo-button').disabled, true);
  app.dispatch(app.canvas, 'pointermove', { clientX: 550, clientY: 450 }); app.dispatch(app.canvas, 'pointerup');
  assert.equal(app.scene()[0].width, 200); assert.equal(app.scene()[0].height, 200);
  app.click(app.get('undo-button')); assert.equal(app.scene().length, 0);
});

test('font failure and unavailable font APIs leave the canvas usable', async () => {
  for (const fonts of [undefined, { check: () => false, load: () => Promise.reject(new Error('Font unavailable')) }]) {
    const app = createApp({ fonts }); await act(async () => { await Promise.resolve(); });
    app.tool('rectangle'); app.canvas.focus(); app.key('Enter'); assert.equal(app.scene().length, 1);
    assert.equal(app.get('toast').hidden, true);
  }
});

test('Strict Mode ignores a font promise from the disposed controller', async () => {
  let resolveFirst, resolveSecond, calls = 0;
  const fonts = { check: font => font.includes('Excalifont'), load: () => new Promise(resolve => { if (++calls === 1) resolveFirst = resolve; else resolveSecond = resolve; }) };
  const app = createApp({ fonts, strict: true, savedElements: [label()] }); app.scene();
  assert.equal(calls, 2);
  await act(async () => { resolveFirst([{}]); await Promise.resolve(); }); assert.equal(app.pendingSaves(), 0);
  await act(async () => { resolveSecond([{}]); await Promise.resolve(); }); assert.equal(app.pendingSaves(), 1);
  assert.equal(app.scene().length, 1); assert.equal(app.get('undo-button').disabled, true);
});

test('appearance bootstrap applies the saved canvas color before the body is parsed', () => {
  for (const [local, color, scheme] of [
    [{ theme: 'dark', background: '#fffce8' }, '#292719', 'dark'],
    [{ theme: 'dark', background: '#ffffff' }, '#121212', 'dark'],
    [{ theme: 'dark', background: 'invalid' }, '#121212', 'dark'],
    [{ theme: 'dark' }, '#121212', 'dark'],
    [{ theme: 'dark', background: '#123456' }, '#123456', 'dark'],
    [{ theme: 'light', background: '#fffce8' }, '#fffce8', 'light'],
    [{ theme: 'light', background: 'invalid' }, '#ffffff', 'light'],
    [undefined, '#ffffff', 'light'],
  ]) {
    let headAppearance;
    const dom = new JSDOM(`<html><head><meta name="theme-color" content="#ffffff"><script>${appearanceBootstrap};window.captureAppearance();</script></head><body><main id="app"></main></body></html>`, {
      url: 'http://localhost/', runScripts: 'dangerously',
      beforeParse(window) {
        window.localStorage.setItem('sketchify.scene.v1', JSON.stringify({ local }));
        window.captureAppearance = () => {
          headAppearance = { body: window.document.body, color: window.document.documentElement.style.getPropertyValue('--canvas') };
        };
      },
    });
    const root = dom.window.document.documentElement;
    assert.equal(headAppearance.body, null); assert.equal(headAppearance.color, color);
    assert.equal(root.style.getPropertyValue('--canvas'), color); assert.equal(root.style.colorScheme, scheme);
    assert.equal(root.classList.contains('dark'), scheme === 'dark');
    assert.equal(dom.window.document.querySelector('meta[name="theme-color"]').content, color);
    dom.window.close();
  }
});

test('unreadable appearance storage cannot stop the rest of the document from starting', () => {
  for (const blocked of [false, true]) {
    const errors = [];
    const dom = new JSDOM(`<head><script>${appearanceBootstrap};window.started = true;</script></head><body></body>`, {
      url: 'http://localhost/', runScripts: 'dangerously',
      beforeParse(window) {
        window.addEventListener('error', event => errors.push(event.error));
        if (blocked) window.Storage.prototype.getItem = () => { throw new Error('Storage blocked'); };
        else window.localStorage.setItem('sketchify.scene.v1', '{invalid');
      },
    });
    assert.equal(dom.window.started, true); assert.deepEqual(errors, []); dom.window.close();
  }
});

test('hydrated canvas keeps document appearance in sync with theme and background changes', () => {
  const app = createApp({ theme: 'dark', savedLocal: { background: '#fffce8' } });
  const root = app.document.documentElement;
  assert.equal(root.style.getPropertyValue('--canvas'), '#292719'); assert.equal(root.style.colorScheme, 'dark');
  assert.equal(app.get('app').style.getPropertyValue('--canvas'), '');
  app.click(app.get('menu-button')); app.click(app.document.querySelector('[data-action="light"]'));
  assert.equal(root.style.getPropertyValue('--canvas'), '#fffce8'); assert.equal(root.style.colorScheme, 'light');
  app.click(app.document.querySelector('[data-background="#edf2ff"]'));
  assert.equal(root.style.getPropertyValue('--canvas'), '#edf2ff');
  app.click(app.document.querySelector('[data-action="dark"]'));
  assert.equal(root.style.getPropertyValue('--canvas'), '#1c2333');
});

test('canvas swatches match the surface in both themes and preserve the saved selection', () => {
  const colors = [
    ['#ffffff', '#121212'], ['#f8f9fa', '#1e1e1e'], ['#fffce8', '#292719'],
    ['#edf2ff', '#1c2333'], ['#f3faf5', '#1b2921'],
  ];
  for (const theme of ['light', 'dark']) {
    const app = createApp({ theme });
    const root = app.document.documentElement;
    assert.equal(root.style.getPropertyValue('--canvas'), theme === 'dark' ? '#121212' : '#ffffff');
    app.click(app.get('menu-button'));
    for (const [light, dark] of colors) {
      const swatch = app.document.querySelector(`[data-background="${light}"]`);
      const expected = theme === 'dark' ? dark : light;
      app.click(swatch);
      assert.equal(swatch.style.getPropertyValue('--color'), expected);
      assert.equal(swatch.getAttribute('aria-label'), `Canvas ${expected}`);
      assert.equal(swatch.getAttribute('aria-pressed'), 'true');
      assert.equal(root.style.getPropertyValue('--canvas'), expected);
      app.scene();
      const saved = JSON.parse(app.window.localStorage.getItem('sketchify.scene.v1'));
      const loaded = createApp({ savedLocal: saved.local });
      assert.equal(loaded.document.documentElement.style.getPropertyValue('--canvas'), expected);
      assert.equal(saved.local.background, light);
      app.click(app.document.querySelector(`[data-action="${theme === 'dark' ? 'light' : 'dark'}"]`));
      assert.equal(root.style.getPropertyValue('--canvas'), theme === 'dark' ? light : dark);
      app.click(app.document.querySelector(`[data-action="${theme}"]`));
    }
  }
});
