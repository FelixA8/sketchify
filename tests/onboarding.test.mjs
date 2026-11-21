import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './helpers/app.mjs';

const hints = app => app.document.querySelector('.onboarding-hints');
const action = (app, text) => [...app.document.querySelectorAll('.welcome-actions button')].find(button => button.textContent.includes(text));

test('empty-state actions open the native file picker and restore focus after keyboard help', () => {
  const app = createApp();
  let opened = 0;
  app.get('open-file').addEventListener('click', () => { opened++; });
  app.click(action(app, 'Open'));
  assert.equal(opened, 1);
  const help = action(app, 'Help');
  app.click(help);
  assert.equal(app.get('dialog').open, true);
  assert.equal(hints(app).hidden, false);
  app.dispatch(app.get('dialog'), 'cancel');
  assert.equal(app.get('dialog').open, false);
  assert.equal(app.get('welcome').hidden, false);
  assert.equal(app.document.activeElement, help);
  assert.equal(hints(app).hidden, false);
});

test('onboarding stays until a component is inserted and returns when the canvas is empty', () => {
  const app = createApp();
  assert.equal(app.get('welcome').hidden, false);
  app.tool('rectangle');
  assert.equal(app.get('welcome').hidden, false);
  assert.equal(hints(app).hidden, false);
  assert.equal(app.get('welcome').dataset.passThrough, 'true');
  app.dispatch(app.canvas, 'pointerdown', { clientX: 500, clientY: 300 });
  app.dispatch(app.canvas, 'pointermove', { clientX: 650, clientY: 400 });
  assert.equal(app.get('welcome').hidden, true);
  assert.equal(hints(app).hidden, true);
  app.dispatch(app.canvas, 'pointerup');
  assert.equal(app.get('welcome').hidden, true);
  app.click(app.get('undo-button'));
  assert.equal(app.get('welcome').hidden, false);
  app.tool('text');
  app.click(app.canvas, { clientX: 500, clientY: 300 });
  assert.equal(app.get('welcome').hidden, false);
  app.input('First label');
  app.click(app.get('text-done'));
  assert.equal(app.get('welcome').hidden, true);
  app.click(app.get('undo-button'));
  assert.equal(app.get('welcome').hidden, false);
});

test('clicking, hovering, menus, the sidebar, tools, and navigation never dismiss empty onboarding', () => {
  const app = createApp();
  for (const type of ['pointerenter', 'pointermove']) {
    app.dispatch(app.canvas, type, { clientX: 500, clientY: 300 });
    assert.equal(app.get('welcome').hidden, false);
  }
  app.dispatch(app.canvas, 'pointerdown', { clientX: 500, clientY: 300 });
  assert.equal(app.get('welcome').hidden, false);
  app.dispatch(app.canvas, 'pointermove', { clientX: 650, clientY: 400 });
  assert.equal(app.get('welcome').hidden, false);
  app.dispatch(app.canvas, 'pointerup');
  for (const id of ['menu-button', 'workspace-toggle']) {
    app.click(app.get(id));
    assert.equal(app.get('welcome').hidden, false);
    assert.equal(hints(app).hidden, false);
    app.click(app.get(id));
    assert.equal(app.get('welcome').hidden, false);
  }
  app.canvas.focus(); app.key(' ');
  assert.equal(app.get('welcome').hidden, false);
  app.dispatch(app.canvas, 'keyup', { key: ' ', code: 'Space' });
  assert.equal(app.get('welcome').hidden, false);
  for (const tool of ['hand', 'rectangle', 'diamond', 'ellipse', 'arrow', 'line', 'freedraw', 'text', 'eraser']) {
    app.tool(tool);
    assert.equal(app.get('welcome').hidden, false);
    assert.equal(hints(app).hidden, false);
  }
  app.click(app.get('zoom-in'));
  assert.equal(app.get('welcome').hidden, false);
});

test('saved display preferences never dismiss onboarding on an empty canvas', () => {
  const app = createApp({ savedLocal: { preferences: { toolbarHints: false, zenMode: true } }, width: 375, theme: 'dark' });
  assert.equal(hints(app).hidden, false);
  assert.equal(app.get('welcome').hidden, false);
  assert.equal(app.get('welcome').closest('[hidden]'), null);
  assert.equal(hints(app).closest('[hidden]'), null);
  assert.equal(app.document.querySelectorAll('.welcome-actions button').length, 3);
  assert.match(action(app, 'Open').textContent, /Ctrl\+O/);
});

test('Create a shape selects Rectangle and focuses the canvas for immediate drawing', () => {
  const app = createApp();
  app.click(action(app, 'Create a shape'));
  assert.equal(app.document.querySelector('[data-tool="rectangle"]').getAttribute('aria-pressed'), 'true');
  assert.equal(app.document.activeElement, app.canvas);
  assert.equal(app.get('welcome').hidden, false);
  app.key('Enter');
  assert.equal(app.scene()[0].type, 'rectangle');
  assert.equal(app.get('welcome').hidden, true);
});

test('existing drawings skip the onboarding and new blank pages can show it', () => {
  const app = createApp();
  app.tool('rectangle'); app.canvas.focus(); app.key('Enter');
  assert.equal(app.get('welcome').hidden, true);
  app.click(app.get('workspace-toggle'));
  app.click(app.document.querySelector('[aria-label="Add page"]'));
  app.click(app.get('workspace-toggle'));
  assert.equal(app.get('welcome').hidden, false);
  assert.equal(hints(app).hidden, false);
});
