import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { createApp } from './helpers/app.mjs';
import { exportScene, importScene } from '../src/scene.ts';
import { compatibilityFont } from './helpers/compatibility-font.mjs';
import { createStore } from '../src/whiteboard/store.ts';
import { loadStorage, SCENE_KEY } from '../src/whiteboard/persistence.ts';
const fixture = name => new URL(`./fixtures/${name}`, import.meta.url);
const legacy = JSON.parse(readFileSync(fixture('legacy-storage.json')));
const metadata = JSON.parse(readFileSync(fixture('legacy-metadata.json')));
assert.equal(compatibilityFont(), metadata.testFontSha256);
test('legacy storage retains content and metadata while updating the default name and tightening text bounds', () => {
  const app = createApp({ savedElements: legacy.scene.elements, savedLocal: legacy.scene.local, storageEntries: { 'sketchify.library.v1': JSON.stringify(legacy.library) } }); app.scene();
  const saved = JSON.parse(app.window.localStorage.getItem('sketchify.scene.v1'));
  const withoutTextDimensions = scene => ({ ...scene, elements: scene.elements.map(element => {
    if (element.type !== 'text') return element;
    const { width, height, ...content } = element;
    assert.ok(width > 0 && height > 0);
    return content;
  }) });
  assert.match(saved.local.name, /^sketchify_\d{4}-\d{2}-\d{2}$/);
  const { project, ...legacySaved } = saved;
  assert.equal(project.pages.length, 1);
  assert.deepEqual(project.pages[0].elements, saved.elements);
  assert.deepEqual(withoutTextDimensions(legacySaved), withoutTextDimensions({ ...legacy.scene, local: { ...legacy.scene.local, name: saved.local.name, sidebar: false } }));
  assert.ok(saved.elements.find(element => element.type === 'text').height < legacy.scene.elements.find(element => element.type === 'text').height);
  assert.deepEqual(JSON.parse(app.window.localStorage.getItem('sketchify.library.v1')), legacy.library);
  assert.deepEqual(app.scene()[0].customExtension, { keep: 'unchanged' });
});
test('startup reads only the scene and ignores retired storage keys', () => {
  const store = createStore();
  const error = loadStorage(store, { getItem(key) {
    assert.equal(key, SCENE_KEY);
    return JSON.stringify(legacy.scene);
  } });
  assert.equal(error, '');
  assert.equal(store.state.elements.length, legacy.scene.elements.length);
});
test('editable scene export is byte-identical to the legacy export', () => {
  const old = readFileSync(fixture('legacy-scene.excalidraw'), 'utf8'); const parsed = JSON.parse(old);
  assert.equal(exportScene(importScene(old).elements, parsed.appState), old);
});
for (const background of [true, false]) test(`SVG and native PNG exports exactly match legacy output (${background ? 'background' : 'transparent'})`, async () => {
  const app = createApp({ savedElements: legacy.scene.elements, savedLocal: legacy.scene.local });
  app.click(app.get('menu-button')); app.click(app.document.querySelector('[data-action="export"]'));
  // Legacy exports were always light, with 1× SVG and 2× PNG dimensions.
  if (app.get('export-dark').checked) app.click(app.get('export-dark'));
  if (app.get('export-background').checked !== background) app.click(app.get('export-background'));
  app.click(app.document.querySelector('[data-scale="1"]'));
  app.click(app.document.querySelector('[data-export="svg"]'));
  assert.equal(await app.downloads.at(-1).text(), readFileSync(fixture(`legacy-${background ? 'background' : 'transparent'}.svg`), 'utf8'));
  app.click(app.document.querySelector('[data-scale="2"]'));
  app.click(app.document.querySelector('[data-export="png"]'));
  const actual = await loadImage(Buffer.from(await app.downloads.at(-1).arrayBuffer())), expected = await loadImage(readFileSync(fixture(`legacy-${background ? 'background' : 'transparent'}.png`)));
  assert.equal(actual.width, expected.width); assert.equal(actual.height, expected.height);
  const pixels = image => { const canvas = createCanvas(image.width, image.height); canvas.getContext('2d').drawImage(image, 0, 0); return canvas.data(); };
  assert.equal(Buffer.compare(pixels(actual), pixels(expected)), 0);
});
