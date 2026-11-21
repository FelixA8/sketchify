import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './helpers/app.mjs';
import { exportScene, importScene } from '../src/scene.ts';

const label = app => app.document.querySelector('.frame-name');

test('wrapped frame names support tap, keyboard, cancel, blur, undo and saved scene round-trips', () => {
  const app = createApp({ savedElements: [{ id: 'box', type: 'rectangle', x: 400, y: 250, width: 200, height: 140 }] });
  app.dispatch(app.canvas, 'contextmenu', { clientX: 410, clientY: 350 });
  app.click(app.document.querySelector('[data-context-action="wrap-frame"]'));
  const wrapped = app.scene();
  const originalLabel = label(app), position = originalLabel.parentElement;
  app.click(originalLabel);
  let input = app.get('frame-name');
  assert.equal(label(app), originalLabel);
  assert.equal(originalLabel.style.visibility, 'hidden');
  assert.equal(input.parentElement, position);
  assert.equal(app.document.activeElement, input);
  assert.deepEqual([input.selectionStart, input.selectionEnd], [0, 5]);
  input.value = 'Project notes'; app.key('Enter');
  const renamed = wrapped.map(element => element.type === 'frame' ? { ...element, name: 'Project notes' } : element);
  assert.deepEqual(app.scene(), renamed);
  assert.equal(label(app), originalLabel);
  assert.equal(originalLabel.style.visibility, '');
  assert.equal(app.document.activeElement, app.canvas);
  app.key('z', { ctrlKey: true }); assert.deepEqual(app.scene(), wrapped);
  app.key('z', { ctrlKey: true, shiftKey: true }); assert.deepEqual(app.scene(), renamed);
  app.click(label(app)); input = app.get('frame-name'); input.value = 'Discard'; app.key('Escape');
  assert.deepEqual(app.scene(), renamed);
  app.key('Enter'); input = app.get('frame-name'); assert.equal(app.document.activeElement, input);
  input.value = 'Final notes'; app.click(app.canvas, { clientX: 900, clientY: 500 });
  const saved = app.scene(); assert.equal(saved[0].name, 'Final notes');
  assert.equal(importScene(exportScene(saved)).elements[0].name, 'Final notes');
  const reloaded = createApp({ savedElements: saved }); assert.equal(label(reloaded).textContent, 'Final notes');
});

test('frame labels track rotated geometry and respect locked frames and other tools', () => {
  const frame = { id: 'frame', type: 'frame', name: 'Frame', x: 100, y: 150, width: 200, height: 200, angle: Math.PI / 6 };
  const app = createApp({ savedElements: [frame], width: 375, height: 700, zoom: 0.75, pan: { x: 30, y: 100 } });
  const anchor = app.document.querySelector('.frame-name-anchor');
  assert.equal(anchor.style.transform, `rotate(${frame.angle}rad)`);
  assert.ok(Math.abs(parseFloat(anchor.style.left) - (200 - 100 * Math.cos(frame.angle) + 100 * Math.sin(frame.angle)) * 0.75 - 30) < 0.001);
  app.click(label(app)); const input = app.get('frame-name'); input.value = '   ';
  app.key('Enter', { isComposing: true }); assert.equal(app.get('frame-name'), input);
  app.key('Enter'); assert.equal(app.scene()[0].name, 'Frame');
  assert.equal(app.get('undo-button').disabled, true);
  app.tool('rectangle'); assert.equal(label(app).style.pointerEvents, 'none');
  const locked = createApp({ savedElements: [{ ...frame, locked: true }] });
  assert.equal(label(locked).disabled, true); app.click(label(locked)); assert.equal(locked.get('frame-name'), null);
});
