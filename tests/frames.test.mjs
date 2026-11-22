import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from './helpers/app.mjs';

function drag(app, x, y, endX, endY, finish = 'pointerup') {
  app.dispatch(app.canvas, 'pointerdown', { clientX: x, clientY: y });
  app.dispatch(app.canvas, 'pointermove', { clientX: endX, clientY: endY });
  app.dispatch(app.canvas, finish, { clientX: endX, clientY: endY });
}

test('the Frame tool draws an empty frame and skips canceled and zero-area drags', () => {
  const app = createApp();
  app.tool('frame');
  drag(app, 600, 500, 320, 200, 'pointercancel');
  drag(app, 600, 500, 320, 500);
  assert.deepEqual(app.scene(), []);
  assert.equal(app.get('undo-button').disabled, true);
  drag(app, 600, 500, 320, 200);
  const [frame] = app.scene();
  assert.equal(app.scene().length, 1);
  assert.equal(frame.type, 'frame');
  assert.equal(frame.name, 'Frame');
  assert.deepEqual([frame.x, frame.y, frame.width, frame.height], [320, 200, 280, 300]);
  assert.equal(frame.frameId ?? null, null);
  assert.equal(app.document.querySelector('[data-tool="selection"]').getAttribute('aria-pressed'), 'true');
  app.click(app.get('undo-button'));
  assert.deepEqual(app.scene(), []);
  app.click(app.get('redo-button'));
  assert.equal(app.scene()[0].id, frame.id);
});

test('drawn elements use the frame at the start of the gesture and save it in Layers and history', () => {
  const app = createApp({ savedLocal: { sidebar: true } });
  app.key('f');
  drag(app, 320, 200, 620, 490);
  const [frame] = app.scene();
  app.tool('rectangle');
  drag(app, 360, 260, 510, 330, 'pointercancel');
  assert.equal(app.scene().length, 1);
  app.tool('rectangle');
  drag(app, 590, 260, 680, 330);
  const child = app.scene().at(-1);
  assert.equal(child.frameId, frame.id);
  assert.ok(app.document.querySelector(`[data-layer-key="e:${frame.id}"] [data-layer-key="e:${child.id}"]`));
  app.click(app.get('undo-button'));
  assert.equal(app.scene().length, 1);
  app.click(app.get('redo-button'));
  assert.equal(app.scene().at(-1).frameId, frame.id);
  app.tool('ellipse');
  drag(app, 670, 370, 550, 440);
  assert.equal(app.scene().at(-1).frameId ?? null, null);
  const saved = app.window.localStorage.getItem('sketchify.scene.v1');
  const reloaded = createApp({ storageEntries: { 'sketchify.scene.v1': saved } });
  assert.equal(reloaded.scene().find(element => element.id === child.id).frameId, frame.id);
});

test('creation chooses the topmost editable frame and uses its rotated bounds', () => {
  const frame = { type: 'frame', x: 300, y: 200, width: 300, height: 220 };
  const app = createApp({ savedElements: [
    { ...frame, id: 'behind' },
    { ...frame, id: 'top', y: 285, height: 50, angle: Math.PI / 4 },
    { ...frame, id: 'locked', locked: true },
  ] });
  app.tool('line');
  drag(app, 450, 310, 520, 360);
  assert.equal(app.scene().at(-1).frameId, 'top');
  app.tool('freedraw');
  drag(app, 390, 360, 410, 370);
  assert.equal(app.scene().at(-1).frameId, 'behind');
});

test('standalone text, bound labels, pasted text, and keyboard placement become frame children', () => {
  const app = createApp({ savedElements: [{ id: 'frame', type: 'frame', x: 300, y: 180, width: 660, height: 460 }] });
  app.tool('text');
  app.click(app.canvas, { clientX: 340, clientY: 240 });
  app.input('Title');
  app.key('Enter', { ctrlKey: true });
  assert.equal(app.scene().at(-1).frameId, 'frame');
  app.key('n');
  app.key('Enter');
  app.input('Note');
  app.key('Enter', { ctrlKey: true });
  const [, , note, label] = app.scene();
  assert.equal(note.frameId, 'frame');
  assert.equal(label.containerId, note.id);
  assert.equal(label.frameId, 'frame');
  app.dispatch(app.canvas, 'paste', { clipboardData: { getData: () => 'Pasted label' } });
  assert.equal(app.scene().at(-1).frameId, 'frame');
});
