import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './helpers/app.mjs';
import { defaultProjectName } from '../src/whiteboard/project-name.ts';

const label = app => app.get('project-name-button');
const savedName = app => { app.scene(); return JSON.parse(app.window.localStorage.getItem('sketchify.scene.v1')).local.name; };
const edit = app => { app.click(label(app), { detail: 1 }); return app.get('project-name'); };

test('new and legacy untitled projects keep a dated filename while displaying only Sketchify', () => {
  assert.equal(defaultProjectName(new Date(2026, 0, 2, 23)), 'sketchify_2026-01-02');
  for (const name of [undefined, 'Untitled', 'sketchify_2026-01-02']) {
    const app = createApp({ savedLocal: { name } });
    assert.equal(label(app).textContent, 'Sketchify');
    assert.equal(app.document.title, 'Sketchify | Local whiteboard');
    const original = savedName(app);
    assert.match(original, /^sketchify_\d{4}-\d{2}-\d{2}$/);
    app.canvas.focus(); app.key('s', { ctrlKey: true });
    assert.equal(app.filenames.at(-1), `${original}.sketchify`);
    const input = edit(app);
    assert.equal(input.value, 'Sketchify'); app.key('Enter');
    assert.equal(savedName(app), original);
  }
});

test('a single click selects the project name; Enter, blur, Escape and keyboard activation work without affecting the drawing', () => {
  const app = createApp({ savedLocal: { name: 'First project' }, savedElements: [{ id: 'box', type: 'rectangle', x: 100, y: 100, width: 100, height: 80 }] });
  const before = app.scene();
  let input = edit(app);
  assert.equal(app.document.activeElement, input);
  assert.deepEqual([input.selectionStart, input.selectionEnd], [0, 'First project'.length]);
  input.value = '  WealthSync  '; app.key('Enter', { isComposing: true });
  assert.equal(app.get('project-name'), input); app.key('Enter');
  assert.equal(label(app).textContent, 'WealthSync'); assert.equal(app.document.activeElement, label(app));
  assert.equal(savedName(app), 'WealthSync'); assert.deepEqual(app.scene(), before);
  assert.equal(app.get('undo-button').disabled, true);
  app.dispatch(label(app), 'click', { detail: 0 }); input = app.get('project-name');
  input.value = 'Discard'; app.key('Escape');
  assert.equal(savedName(app), 'WealthSync'); assert.equal(app.document.activeElement, label(app));
  input = edit(app); input.value = '   '; app.key('Enter'); assert.equal(savedName(app), 'WealthSync');
  input = edit(app); input.value = 'Final notes'; app.click(app.canvas);
  assert.equal(savedName(app), 'Final notes'); assert.equal(label(app).textContent, 'Final notes');
  app.canvas.focus(); app.key('s', { ctrlKey: true }); assert.equal(app.filenames.at(-1), 'Final notes.sketchify');
  const reloaded = createApp({ savedLocal: { name: savedName(app) }, savedElements: before });
  assert.equal(label(reloaded).textContent, 'Final notes'); assert.deepEqual(reloaded.scene(), before);
});

test('menu renaming, imported filenames and custom dated names update the header', async () => {
  const app = createApp({ savedLocal: { name: 'Roadmap_2026-11-17' } });
  assert.equal(label(app).textContent, 'Roadmap_2026-11-17');
  app.click(app.get('menu-button')); app.click(app.document.querySelector('[data-action="rename"]'));
  app.get('drawing-name').value = 'Menu project'; app.click(app.get('confirm-name'));
  assert.equal(label(app).textContent, 'Menu project'); assert.equal(savedName(app), 'Menu project');
  const { act } = await import('react');
  await act(async () => app.dispatch(app.document, 'drop', { dataTransfer: { files: [{ name: 'Imported.excalidraw', size: 20, text: async () => '{"elements":[]}' }] } }));
  assert.equal(label(app).textContent, 'Imported');
});
