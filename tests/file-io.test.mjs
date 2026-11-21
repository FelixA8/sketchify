import test from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';
import { createApp } from './helpers/app.mjs';
async function drop(app, content, name = 'Imported.excalidraw', size = 20) {
  const file = { name, size, text: async () => content };
  await act(async () => app.dispatch(app.document, 'drop', { dataTransfer: { files: [file] } }));
}
test('unsupported imports can be cancelled, confirmed, and undone', async () => {
  const app = createApp(); app.tool('rectangle'); app.canvas.focus(); app.key('Enter'); const before = app.scene();
  const payload = JSON.stringify({ elements: [{ type: 'ellipse', id: 'supported', width: 100, height: 80, seed: 17 }, { type: 'image' }] });
  await drop(app, payload); assert.equal(app.get('dialog').open, true); assert.match(app.get('dialog-content').textContent, /1 unsupported element/);
  app.click(app.get('cancel-import')); assert.deepEqual(app.scene(), before);
  await drop(app, payload); app.click(app.get('confirm-import')); assert.equal(app.scene()[0].id, 'supported');
  app.click(app.get('undo-button')); assert.deepEqual(app.scene(), before);
});
test('malformed and oversized files leave the existing scene intact; exactly 20 MiB is accepted', async () => {
  const app = createApp(); app.tool('rectangle'); app.canvas.focus(); app.key('Enter'); const before = app.scene();
  await drop(app, 'invalid'); assert.match(app.get('toast').textContent, /Could not open/); assert.deepEqual(app.scene(), before);
  await drop(app, '{"elements":[]}', 'Large.json', 20 * 1024 * 1024 + 1); assert.match(app.get('toast').textContent, /larger than 20 MB/); assert.deepEqual(app.scene(), before);
  await drop(app, '{"elements":[]}', 'Exact.json', 20 * 1024 * 1024); assert.deepEqual(app.scene(), []);
});
test('file picker resets after loading and editable downloads sanitize filenames', async () => {
  const app = createApp({ savedLocal: { name: 'A/B:*? 你好' } });
  app.canvas.focus(); app.key('s', { ctrlKey: true }); assert.equal(app.filenames.at(-1), 'AB 你好.sketchify');
  const picker = app.get('open-file'); Object.defineProperty(picker, 'files', { value: [{ size: 2, name: 'Picker.json', text: async () => '{"elements":[]}' }] });
  await act(async () => app.dispatch(picker, 'change')); app.scene();
  assert.equal(picker.value, ''); assert.equal(JSON.parse(app.window.localStorage.getItem('sketchify.scene.v1')).local.name, 'Picker');
});
test('selected exports contain only selected elements and PNG failure offers SVG', async () => {
  const app = createApp(); for (const tool of ['rectangle', 'ellipse']) { app.tool(tool); app.canvas.focus(); app.key('Enter'); }
  app.scene(); app.click(app.get('menu-button')); app.click(app.document.querySelector('[data-action="export"]'));
  app.click(app.get('export-scope')); app.click(app.get('export-scope-option-selected')); app.click(app.document.querySelector('[data-export="json"]'));
  const data = JSON.parse(await app.downloads.at(-1).text()); assert.equal(data.elements.length, 1); assert.equal(data.elements[0].type, 'ellipse');
  app.window.HTMLCanvasElement.prototype.toBlob = callback => callback(null);
  app.click(app.document.querySelector('[data-export="png"]')); assert.match(app.get('toast').textContent, /Try SVG instead/);
});
