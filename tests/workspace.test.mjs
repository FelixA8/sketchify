import test from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';
import { createElement } from '../src/scene.ts';
import { createApp } from './helpers/app.mjs';

const box = (id, x = 450, extra = {}) => ({ ...createElement('rectangle', x, 250), id, width: 100, height: 80, ...extra });
const button = (app, label) => [...app.document.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === label);
const click = (app, label) => { const target = button(app, label); assert.ok(target, label); app.click(target); };
const project = app => { app.scene(); return JSON.parse(app.window.localStorage.getItem('sketchify.scene.v1')).project; };
const show = app => click(app, 'Toggle pages and layers');
const row = (app, key) => app.document.querySelector(`[data-layer-select="${key}"]`);
const layerName = (app, key) => row(app, key).parentElement.querySelector('.layer-name');
function edit(app, label, value) {
  const input = app.document.querySelector(`input[aria-label="${label}"]`); assert.ok(input, label);
  input.value = value; app.dispatch(input, 'keydown', { key: 'Enter' });
}

test('pages isolate drawings, views and undo; switching commits text and preserves all pages on reload', () => {
  const app = createApp({ savedElements: [box('original')] }); show(app);
  app.tool('text'); app.click(app.canvas, { clientX: 650, clientY: 300 }); app.input('Finish on switch');
  click(app, 'Add page'); assert.equal(app.editor.hidden, true); assert.equal(app.scene().length, 0);
  app.tool('ellipse'); app.canvas.focus(); app.key('Enter'); const second = app.scene(); assert.equal(second[0].type, 'ellipse');
  app.click(app.get('undo-button')); assert.equal(app.scene().length, 0);
  app.click([...app.document.querySelectorAll('.page-select')].find(button => button.textContent === 'Page 1'));
  assert.deepEqual(app.scene().map(e => e.text).filter(Boolean), ['Finish on switch']);
  app.click(app.get('undo-button')); assert.equal(app.scene().length, 1);
  app.click([...app.document.querySelectorAll('.page-select')].find(button => button.textContent === 'Page 2'));
  app.click(app.get('redo-button')); assert.deepEqual(app.scene(), second);
  const saved = JSON.parse(app.window.localStorage.getItem('sketchify.scene.v1'));
  const reload = createApp({ storageEntries: { 'sketchify.scene.v1': JSON.stringify(saved) } });
  assert.equal(reload.get('workspace').hidden, false); assert.deepEqual(reload.scene(), second); assert.equal(project(reload).pages.length, 2);
});
test('layer tree selects exact members, reveals canvas selection, renames independently from text, and undoes changes', () => {
  const app = createApp({ savedElements: [box('a', 450, { groupIds: ['inner', 'outer'] }), box('b', 650, { groupIds: ['outer'] }), box('label', 450, { type: 'text', text: 'Content', containerId: 'a', groupIds: ['inner', 'outer'] })] }); show(app);
  assert.ok(row(app, 'g:outer')); assert.ok(row(app, 'g:inner')); assert.ok(row(app, 'e:label'));
  app.click(row(app, 'e:a')); assert.equal(row(app, 'e:a').getAttribute('aria-pressed'), 'true'); assert.equal(row(app, 'e:b').getAttribute('aria-pressed'), 'false');
  app.click(layerName(app, 'e:label')); edit(app, 'Layer name', 'Label layer');
  assert.equal(project(app).pages[0].layers['e:label'].name, 'Label layer'); assert.equal(app.scene().find(e => e.id === 'label').text, 'Content');
  app.click(app.get('undo-button')); assert.equal(project(app).pages[0].layers['e:label'], undefined);
  click(app, 'Collapse all layers'); assert.equal(row(app, 'e:a'), null);
  app.dispatch(app.canvas, 'pointerdown', { clientX: 450, clientY: 290, button: 0 }); app.dispatch(app.canvas, 'pointerup', { clientX: 450, clientY: 290, button: 0 });
  assert.ok(row(app, 'e:a'));
});
test('only the layer icon brings an off-screen component into view and saves the camera without editing the drawing', () => {
  const app = createApp({ savedElements: [box('far', 2400), box('here')], savedLocal: { sidebar: true } });
  const before = project(app).pages[0];
  app.click(layerName(app, 'e:far'));
  assert.equal(row(app, 'e:far').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(project(app).pages[0], before);
  app.key('Escape');
  app.click(row(app, 'e:here'));
  assert.deepEqual(project(app).pages[0], before);
  app.click(row(app, 'e:far'));
  assert.equal(app.get('zoom-reset').textContent, '100%');
  app.advanceFrame(150);
  const midpointZoom = Number.parseInt(app.get('zoom-reset').textContent, 10);
  assert.ok(midpointZoom > 100 && midpointZoom < 500);
  app.advanceFrame(150);
  const after = project(app).pages[0];
  assert.equal(after.zoom, 5);
  assert.deepEqual(after.pan, { x: 702 - 2450 * 5, y: 454 - 290 * 5 });
  assert.deepEqual(after.elements, before.elements);
  assert.equal(app.get('undo-button').disabled, true);
  const saved = app.window.localStorage.getItem('sketchify.scene.v1');
  const reload = createApp({ storageEntries: { 'sketchify.scene.v1': saved } });
  assert.deepEqual(project(reload).pages[0], after);
});
test('manual panning interrupts the layer navigation at the current view', () => {
  const app = createApp({ savedElements: [box('far', 2400)], savedLocal: { sidebar: true } });
  app.click(row(app, 'e:far'));
  app.advanceFrame(150);
  const midwayZoom = app.get('zoom-reset').textContent;
  app.dispatch(app.canvas, 'wheel', { deltaX: 40, deltaY: 30 });
  const panned = project(app).pages[0];
  assert.equal(`${Math.round(panned.zoom * 100)}%`, midwayZoom);
  assert.ok(panned.pan.x < -40 && panned.pan.x > 702 - 2450 * 5 - 40);
  app.advanceFrame(300);
  assert.deepEqual(project(app).pages[0], panned);
});
test('switching pages interrupts layer navigation and keeps each page view independent', () => {
  const app = createApp({ savedElements: [box('far', 2400)], savedLocal: { sidebar: true } });
  click(app, 'Add page');
  app.click(app.document.querySelector('.page-select'));
  app.click(row(app, 'e:far'));
  app.advanceFrame(150);
  app.click([...app.document.querySelectorAll('.page-select')].find(button => button.textContent === 'Page 2'));
  app.advanceFrame(300);
  const [first, second] = project(app).pages;
  assert.ok(first.zoom > 1 && first.zoom < 5);
  assert.equal(second.zoom, 1);
  assert.deepEqual(second.pan, { x: 0, y: 0 });
});
test('group icon frames visible members and a hidden member icon leaves the camera in place', () => {
  const groupIds = ['g'];
  const app = createApp({ savedElements: [box('a', 1000, { groupIds }), box('b', 2200, { groupIds }), box('hidden', 4000, { groupIds })] });
  show(app);
  click(app, 'Hide Rectangle');
  app.click(row(app, 'g:g'));
  app.advanceFrame(300);
  const framed = project(app).pages[0];
  assert.equal(row(app, 'e:a').getAttribute('aria-pressed'), 'true');
  assert.equal(row(app, 'e:b').getAttribute('aria-pressed'), 'true');
  assert.equal(framed.zoom, (1220 - 184 - 72) / 1300);
  assert.equal(framed.pan.x + 1650 * framed.zoom, 702);
  app.click(row(app, 'e:hidden'));
  assert.deepEqual(project(app).pages[0].pan, framed.pan);
  assert.equal(project(app).pages[0].zoom, framed.zoom);
});
test('hidden groups are excluded from selection and SVG export; child visibility survives restoring parent', async () => {
  const app = createApp({ savedElements: [box('a', 450, { groupIds: ['g'], backgroundColor: '#ffc9c9' }), box('b', 650, { groupIds: ['g'] }), box('c', 900)] }); show(app);
  click(app, 'Hide Rectangle'); // First rectangle in front-to-back tree is c.
  click(app, 'Hide Group'); app.canvas.focus(); app.key('a', { ctrlKey: true });
  assert.equal(app.get('selection-info').textContent, '3 elements');
  app.click(app.get('menu-button')); app.click(app.document.querySelector('[data-action="export"]')); app.click(app.document.querySelector('[data-export="svg"]'));
  assert.equal(app.document.querySelector('[data-export="svg"]').disabled, true);
  assert.equal(app.downloads.length, 0);
  assert.match(app.document.querySelector('.export-preview').textContent, /No visible elements/);
  app.click(app.document.querySelector('[data-close]')); click(app, 'Show Group');
  assert.equal(project(app).pages[0].layers['e:c'].hidden, true); assert.equal(project(app).pages[0].layers['g:g'].hidden, false);
});
test('locking a parent prevents canvas edits and deletion while allowing inspection and unlocking', () => {
  const app = createApp({ savedElements: [box('f', 400, { type: 'frame', width: 400, height: 200 }), box('a', 450, { frameId: 'f' })] }); show(app);
  click(app, 'Lock Frame'); const before = app.scene(); app.click(row(app, 'e:a'));
  app.canvas.focus(); app.key('ArrowRight'); app.key('Delete'); assert.deepEqual(app.scene(), before);
  assert.equal(button(app, 'Unlock Rectangle').disabled, true);
  click(app, 'Unlock Frame'); app.click(row(app, 'e:a')); app.canvas.focus(); app.key('ArrowRight');
  assert.equal(app.scene().find(e => e.id === 'a').x, 451);
});
test('page actions duplicate hierarchy with fresh IDs, reorder, rename and confirm deletion', () => {
  const app = createApp({ savedElements: [box('a', 450, { groupIds: ['g'] }), box('b', 650, { groupIds: ['g'] })] }); show(app);
  app.click(layerName(app, 'g:g')); edit(app, 'Layer name', 'Named group');
  click(app, 'Page actions for Page 1'); app.click([...app.document.querySelectorAll('.workspace-actions button')].find(button => button.textContent === 'Duplicate'));
  const copied = project(app).pages[1]; assert.equal(copied.name, 'Page 1 copy'); assert.equal(copied.elements.length, 2);
  assert.notEqual(copied.elements[0].id, 'a'); assert.notEqual(copied.elements[0].groupIds[0], 'g');
  assert.equal(copied.layers[`g:${copied.elements[0].groupIds[0]}`].name, 'Named group');
  click(app, 'Page actions for Page 1 copy'); app.click([...app.document.querySelectorAll('.workspace-actions button')].find(button => button.textContent === 'Move up'));
  assert.equal(project(app).pages[0].id, copied.id);
  app.dispatch(app.document.querySelector('.page-select'), 'dblclick'); edit(app, 'Page name', 'Second canvas');
  click(app, 'Page actions for Second canvas'); app.click([...app.document.querySelectorAll('.workspace-actions button')].find(button => button.textContent === 'Delete page'));
  assert.equal(app.get('dialog').open, true); assert.equal(project(app).pages.length, 2);
  app.click(app.get('confirm-delete-page')); assert.equal(project(app).pages.length, 1); assert.equal(project(app).pages[0].name, 'Page 1');
});
test('project save and import round-trip every page; page exports remain compatible editable scenes', async () => {
  const app = createApp({ savedElements: [box('a')] }); show(app); click(app, 'Add page');
  app.tool('diamond'); app.canvas.focus(); app.key('Enter'); app.key('s', { ctrlKey: true });
  const data = JSON.parse(await app.downloads.at(-1).text()); assert.equal(data.type, 'sketchify'); assert.equal(data.pages.length, 2); assert.match(app.filenames.at(-1), /\.sketchify$/);
  const reload = createApp();
  await act(async () => reload.dispatch(reload.document, 'drop', { dataTransfer: { files: [{ name: 'Project.sketchify', size: 100, text: async () => JSON.stringify(data) }] } }));
  assert.equal(project(reload).pages.length, 2); assert.equal(reload.scene()[0].type, 'diamond');
  reload.click(reload.get('menu-button')); reload.click(reload.document.querySelector('[data-action="export"]')); reload.click(reload.document.querySelector('[data-export="json"]'));
  const exported = JSON.parse(await reload.downloads.at(-1).text()); assert.equal(exported.type, 'excalidraw'); assert.equal(exported.elements.length, 1);
});

test('layer drag/drop reparents and reorders; destination menus provide a keyboard alternative', () => {
  const app = createApp({ savedElements: [box('f', 400, { type: 'frame' }), box('a', 450), box('b', 650)] }); show(app);
  const rows = key => app.document.querySelector(`[data-layer-key="${key}"] > .layer-row`);
  const transfer = { setData() {}, effectAllowed: '' };
  app.dispatch(rows('e:a'), 'dragstart', { dataTransfer: transfer });
  app.dispatch(rows('e:f'), 'dragover', { dataTransfer: transfer, clientY: 0 });
  app.dispatch(rows('e:f'), 'drop', { dataTransfer: transfer });
  assert.equal(app.scene().find(e => e.id === 'a').frameId, 'f');
  assert.ok(app.document.querySelector('[data-layer-key="e:f"] [data-layer-key="e:a"]'));
  app.click(rows('e:a').querySelector('[aria-label="Actions for Rectangle"]'));
  const destination = app.document.querySelector('select[aria-label="Move Rectangle to"]');
  assert.ok(destination); destination.value = 'root'; app.dispatch(destination, 'change');
  assert.equal(app.scene().find(e => e.id === 'a').frameId, null);
  app.click(app.get('undo-button')); assert.equal(app.scene().find(e => e.id === 'a').frameId, 'f');
  app.click(app.get('undo-button')); assert.equal(app.scene().find(e => e.id === 'a').frameId ?? null, null);
});

for (const theme of ['light', 'dark']) for (const width of [375, 1440]) test(`sidebar controls and keyboard navigation work in ${theme} at ${width}px`, () => {
  const app = createApp({ theme, width, savedElements: [box('a', 450, { groupIds: ['g'] }), box('b', 650, { groupIds: ['g'] })] }); show(app);
  assert.equal(app.get('workspace').hidden, false);
  click(app, 'Collapse Group'); assert.equal(row(app, 'e:a'), null);
  row(app, 'g:g').focus(); app.dispatch(row(app, 'g:g'), 'keydown', { key: 'ArrowRight' });
  assert.ok(row(app, 'e:a'));
  row(app, 'g:g').focus(); app.dispatch(row(app, 'g:g'), 'keydown', { key: 'ArrowRight' });
  assert.equal(app.document.activeElement, row(app, 'e:b'));
  click(app, 'Lock Group'); click(app, 'Unlock Group');
  click(app, 'Hide Group'); click(app, 'Show Group');
  click(app, 'Add page'); click(app, 'Page actions for Page 2');
  app.click([...app.document.querySelectorAll('.workspace-actions button')].find(button => button.textContent === 'Delete page'));
  app.click(app.get('confirm-delete-page')); assert.equal(project(app).pages.length, 1);
  click(app, 'Close sidebar'); assert.equal(app.get('workspace').hidden, true);
  assert.equal(app.document.activeElement, app.get('workspace-toggle'));
});


test('sidebar width restores locally without changing scene history or project files', () => {
  const app = createApp({ savedElements: [box('a')], savedLocal: { sidebar: true, sidebarWidth: 360 } });
  assert.equal(app.get('app').style.getPropertyValue('--workspace-width'), '360px');
  assert.equal(app.get('undo-button').disabled, true);
  const data = project(app);
  assert.equal(data.sidebarWidth, undefined);
  const saved = app.window.localStorage.getItem('sketchify.scene.v1');
  assert.equal(JSON.parse(saved).local.sidebarWidth, 360);
  const reload = createApp({ storageEntries: { 'sketchify.scene.v1': saved } });
  assert.equal(reload.get('app').style.getPropertyValue('--workspace-width'), '360px');
  assert.deepEqual(project(reload), data);
});

for (const sidebarWidth of [-100, 0, '360', {}, null]) test(`invalid sidebar width ${JSON.stringify(sidebarWidth)} keeps the default and loads the drawing`, () => {
  const app = createApp({ savedElements: [box('a')], savedLocal: { sidebar: true, sidebarWidth } });
  assert.equal(app.get('app').style.getPropertyValue('--workspace-width'), '');
  assert.equal(app.scene()[0].id, 'a');
});
