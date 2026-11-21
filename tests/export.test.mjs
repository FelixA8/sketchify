import test from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { createApp } from './helpers/app.mjs';
import { createElement, sceneBounds } from '../src/scene.ts';
import { exportBackground, exportDimensions } from '../src/whiteboard/files.ts';

const rectangle = (id = 'shape', x = 100) => ({ ...createElement('rectangle', x, 100), id, width: 120, height: 80, roughness: 0, backgroundColor: '#a5d8ff', fillStyle: 'solid' });
function open(app) { app.click(app.get('menu-button')); app.click(app.document.querySelector('[data-action="export"]')); }
async function image(blob) {
  const decoded = await loadImage(Buffer.from(await blob.arrayBuffer()));
  const canvas = createCanvas(decoded.width, decoded.height), ctx = canvas.getContext('2d'); ctx.drawImage(decoded, 0, 0);
  return { width: decoded.width, height: decoded.height, corner: [...ctx.getImageData(0, 0, 1, 1).data] };
}

test('PNG and SVG honor all three scales and transparent or opaque backgrounds without changing the scene', async () => {
  const app = createApp({ savedElements: [rectangle()] }); open(app);
  const original = app.scene(), bounds = sceneBounds(original);
  for (const scale of [1, 2, 3]) {
    app.click(app.document.querySelector(`[data-scale="${scale}"]`));
    for (const background of [true, false]) {
      if (app.get('export-background').checked !== background) app.click(app.get('export-background'));
      app.click(app.document.querySelector('[data-export="png"]'));
      const png = await image(app.downloads.at(-1));
      assert.equal(png.width, Math.ceil((bounds.width + 48) * scale));
      assert.equal(png.height, Math.ceil((bounds.height + 48) * scale));
      assert.deepEqual(png.corner, background ? [255, 255, 255, 255] : [0, 0, 0, 0]);
      app.click(app.document.querySelector('[data-export="svg"]'));
      const svg = new app.window.DOMParser().parseFromString(await app.downloads.at(-1).text(), 'image/svg+xml');
      assert.equal(Number(svg.documentElement.getAttribute('width')), Math.ceil(bounds.width + 48) * scale);
      assert.equal(svg.querySelectorAll('rect').length, background ? 1 : 0);
      assert.ok(svg.querySelector('path'));
    }
  }
  assert.deepEqual(app.scene(), original);
});

test('export dark mode updates raster background, SVG strokes, text, links and frames independently of the editor', async () => {
  const label = { ...createElement('text', 110, 120), text: 'Link label', fontFamily: 2, textSpans: [{ start: 0, end: 4, link: 'https://example.com' }] };
  const app = createApp({ savedElements: [rectangle(), label, { ...rectangle('frame', 300), type: 'frame', name: 'Frame' }] }); open(app);
  app.click(app.get('export-dark'));
  app.click(app.document.querySelector('[data-export="png"]'));
  assert.deepEqual((await image(app.downloads.at(-1))).corner, [18, 18, 18, 255]);
  app.click(app.document.querySelector('[data-export="svg"]'));
  const svg = await app.downloads.at(-1).text();
  assert.match(svg, /fill="#121212"/); assert.match(svg, /fill="#eeeeef"/); assert.match(svg, /fill="#74c0fc"/);
  assert.equal(app.document.documentElement.classList.contains('dark'), false);
  app.click(app.get('export-background')); app.click(app.document.querySelector('[data-export="png"]'));
  assert.equal((await image(app.downloads.at(-1))).corner[3], 0);
});

test('export scope excludes hidden layers and includes children of selected frames', async () => {
  const frame = { ...rectangle('frame'), type: 'frame', width: 300 }, child = { ...rectangle('child', 130), frameId: 'frame' };
  const app = createApp({ savedElements: [frame, child, rectangle('hidden', 1000)], savedLocal: { layers: { 'e:hidden': { hidden: true } } } });
  app.click(app.document.querySelector('[data-layer-select="e:frame"]')); open(app);
  app.click(app.get('export-scope')); app.click(app.get('export-scope-option-selected'));
  app.click(app.document.querySelector('[data-export="svg"]'));
  const svg = await app.downloads.at(-1).text();
  assert.equal((svg.match(/<g opacity=/g) || []).length, 2);
  assert.equal(app.get('export-dimensions').textContent, `${exportDimensions([frame, child]).width} × ${exportDimensions([frame, child]).height} px · PNG & clipboard`);
});

test('image clipboard writes the selected PNG options and reports permission denial inside the dialog', async () => {
  const app = createApp({ savedElements: [rectangle()] }); open(app);
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'ClipboardItem'); let items;
  Object.defineProperty(globalThis, 'ClipboardItem', { configurable: true, value: class { constructor(data) { this.data = data; } } });
  Object.defineProperty(app.window.navigator, 'clipboard', { configurable: true, value: { write: async value => { items = value; await value[0].data['image/png']; } } });
  try {
    app.click(app.document.querySelector('[data-scale="3"]')); app.click(app.get('export-background')); app.click(app.get('export-dark'));
    await act(async () => app.click(app.document.querySelector('[data-export="clipboard"]')));
    const copied = await image(await items[0].data['image/png']);
    assert.equal(copied.width, exportDimensions(app.scene(), 3).width); assert.equal(copied.corner[3], 0);
    assert.match(app.document.querySelector('.export-feedback').textContent, /PNG copied to clipboard/);
    app.window.navigator.clipboard.write = async () => { throw new Error('Denied'); };
    await act(async () => app.click(app.document.querySelector('[data-export="clipboard"]')));
    assert.match(app.document.querySelector('.export-feedback').textContent, /Allow clipboard access/);
    assert.equal(app.document.querySelector('[data-export="clipboard"]').disabled, false);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'ClipboardItem', previous); else delete globalThis.ClipboardItem;
  }
});

test('large raster exports show the size cap and theme background pairs preserve the canvas color choice', () => {
  const dimensions = exportDimensions([{ ...rectangle(), width: 10000 }], 3);
  assert.equal(dimensions.width, 8192); assert.equal(dimensions.limited, true);
  for (const [light, dark] of [['#ffffff', '#121212'], ['#fffce8', '#292719'], ['#edf2ff', '#1c2333']]) {
    assert.equal(exportBackground(light, true), dark); assert.equal(exportBackground(dark, false), light);
  }
  assert.equal(exportBackground('#abcdef', true), '#abcdef');
});

for (const theme of ['light', 'dark']) test(`custom export scope supports keyboard selection, dismissal and focus in ${theme}`, () => {
  const app = createApp({ theme, savedElements: [rectangle('a'), rectangle('b', 500)] });
  app.click(app.document.querySelector('[data-layer-select="e:a"]')); open(app);
  const trigger = app.get('export-scope');
  assert.equal(trigger.getAttribute('role'), 'combobox');
  assert.equal(app.get('export-scope-options'), null);
  app.click(trigger);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(app.document.querySelectorAll('[role="option"]').length, 2);
  assert.equal(app.get('export-scope-option-all').getAttribute('aria-selected'), 'true');
  app.key('ArrowDown');
  assert.equal(trigger.getAttribute('aria-activedescendant'), 'export-scope-option-selected');
  app.key('Escape');
  assert.equal(app.get('export-scope-options'), null);
  assert.equal(app.get('dialog').open, true);
  assert.match(trigger.textContent, /Entire page/);
  app.key('End'); app.key('Enter');
  assert.match(trigger.textContent, /Selected elements/);
  assert.equal(app.document.activeElement, trigger);
  assert.equal(app.get('export-scope-options'), null);
  app.key('Home'); app.key(' ');
  assert.match(trigger.textContent, /Entire page/);
  app.key('s'); app.key('Enter');
  assert.match(trigger.textContent, /Selected elements/);
  app.click(trigger); app.key('Tab');
  assert.equal(app.get('export-scope-options'), null);
  app.click(trigger); app.dispatch(app.document.querySelector('.export-preview'), 'pointerdown');
  assert.equal(app.get('export-scope-options'), null);
  app.click(trigger); app.click(app.get('export-scope-option-all'));
  assert.match(trigger.textContent, /Entire page/);
  assert.equal(app.document.activeElement, trigger);
});

test('export scope menu only offers selected elements when a selection exists', () => {
  const app = createApp({ savedElements: [rectangle()] }); open(app);
  app.click(app.get('export-scope'));
  assert.equal(app.document.querySelectorAll('[role="option"]').length, 1);
  assert.equal(app.get('export-scope-option-selected'), null);
  app.key('ArrowDown'); app.key('ArrowUp'); app.key('Enter');
  assert.match(app.get('export-scope').textContent, /Entire page/);
  assert.equal(app.get('export-scope-options'), null);
});
