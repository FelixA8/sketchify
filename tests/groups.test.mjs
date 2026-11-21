import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './helpers/app.mjs';
import { exportScene, importScene, rotatePoint, sceneBounds } from '../src/scene.ts';
import { selectionHandles } from '../src/whiteboard/canvas.ts';
import { initialState } from '../src/whiteboard/store.ts';

const box = (id, x = 400, extra = {}) => ({ id, type: 'rectangle', x, y: 250, width: 120, height: 80, ...extra });
const click = (app, x = 400, options = {}) => app.click(app.canvas, { clientX: x, clientY: 290, ...options });
const all = app => { app.canvas.focus(); app.key('a', { metaKey: true }); };
const group = app => app.key('g', { metaKey: true });
const ungroup = app => app.key('G', { metaKey: true, shiftKey: true });
const item = (app, action) => app.document.querySelector(`[data-context-action="${action}"]`);
const selected = (app, count) => assert.equal(app.get('selection-info').textContent, `${count} selected`);
const doubleClick = (app, x = 400, y = 290) => app.dispatch(app.canvas, 'dblclick', { clientX: x, clientY: y });
function drag(app, start, end, options = {}) {
  app.dispatch(app.canvas, 'pointerdown', { clientX: start.x, clientY: start.y, ...options });
  app.dispatch(app.canvas, 'pointermove', { clientX: end.x, clientY: end.y, ...options });
  app.dispatch(app.canvas, 'pointerup');
}
function nested(app) {
  click(app); click(app, 700, { shiftKey: true }); group(app);
  click(app, 1000, { shiftKey: true }); group(app);
}

for (const modifier of ['metaKey', 'ctrlKey']) test(`${modifier}+G groups and Shift+G ungroups with one undo step each`, () => {
  const app = createApp({ savedElements: [box('one'), box('two', 700)] });
  const original = app.scene(); all(app);
  assert.equal(app.key('g', { [modifier]: true }).defaultPrevented, true);
  const grouped = app.scene();
  assert.equal(grouped[0].groupIds.length, 1); assert.deepEqual(grouped[0].groupIds, grouped[1].groupIds);
  assert.deepEqual(grouped.map(element => ({ ...element, groupIds: [] })), original);
  app.key('z', { [modifier]: true }); assert.deepEqual(app.scene(), original);
  app.key('z', { [modifier]: true, shiftKey: true }); assert.deepEqual(app.scene(), grouped);
  click(app); selected(app, 2);
  assert.equal(app.key('G', { [modifier]: true, shiftKey: true }).defaultPrevented, true);
  assert.deepEqual(app.scene(), original);
  app.key('z', { [modifier]: true }); assert.deepEqual(app.scene(), grouped);
});

test('grouping requires two independent, unlocked components and repeated keydown is ignored', () => {
  const app = createApp({ savedElements: [box('one'), box('two', 700)] });
  group(app); assert.ok(app.scene().every(element => element.groupIds.length === 0));
  click(app); group(app); assert.equal(app.scene()[0].groupIds.length, 0);
  all(app); group(app); const grouped = app.scene();
  group(app); app.key('g', { metaKey: true, repeat: true });
  assert.deepEqual(app.scene(), grouped);
  app.key('G', { metaKey: true, shiftKey: true, repeat: true }); assert.deepEqual(app.scene(), grouped);
  app.dispatch(app.canvas, 'contextmenu', { clientX: 400, clientY: 290 });
  assert.equal(item(app, 'group').disabled, true); assert.equal(item(app, 'ungroup').disabled, false);
});

test('nested groups survive ungrouping their parent, including multiple selected groups', () => {
  const app = createApp({ savedElements: [box('one'), box('two', 700), box('three', 1000)] });
  nested(app); const grouped = app.scene(), [inner, outer] = grouped[0].groupIds;
  assert.deepEqual(grouped[1].groupIds, [inner, outer]); assert.deepEqual(grouped[2].groupIds, [outer]);
  ungroup(app); assert.deepEqual(app.scene().map(element => element.groupIds), [[inner], [inner], []]);
  ungroup(app); assert.ok(app.scene().every(element => element.groupIds.length === 0));
  app.key('z', { metaKey: true }); app.key('z', { metaKey: true }); assert.deepEqual(app.scene(), grouped);
});

test('click, Shift-click, partial marquee and right-click select whole groups', () => {
  const app = createApp({ savedElements: [box('one', 400, { groupIds: ['pair'] }), box('two', 700, { groupIds: ['pair'] }), box('three', 1000)] });
  click(app); selected(app, 2);
  click(app, 700, { shiftKey: true }); assert.equal(app.get('selection-info').textContent, '3 elements');
  click(app, 700, { shiftKey: true }); selected(app, 2);
  click(app, 1000, { shiftKey: true }); selected(app, 3);
  app.key('Escape'); drag(app, { x: 380, y: 230 }, { x: 540, y: 340 }); selected(app, 2);
  app.key('Escape'); app.dispatch(app.canvas, 'contextmenu', { clientX: 700, clientY: 290 }); selected(app, 2);
  app.click(item(app, 'ungroup')); assert.ok(app.scene().every(element => element.groupIds.length === 0));
  app.key('Escape'); all(app); app.dispatch(app.canvas, 'contextmenu', { clientX: 400, clientY: 290 });
  app.click(item(app, 'group')); assert.ok(app.scene().every(element => element.groupIds.length === 1));
});

test('groups move, resize and rotate together without changing membership', () => {
  const app = createApp({ savedElements: [box('one'), box('two', 700)] }); all(app); group(app);
  drag(app, { x: 400, y: 290 }, { x: 430, y: 310 });
  const moved = app.scene(); assert.deepEqual(moved.map(element => [element.x, element.y]), [[430, 270], [730, 270]]);
  const state = () => ({ ...initialState(), elements: app.scene(), selected: new Set(app.scene().map(element => element.id)) });
  const start = selectionHandles(state()).find(handle => handle.key === 'se');
  drag(app, start, { x: start.x + 420, y: start.y + 80 });
  const resized = app.scene(); assert.deepEqual(resized.map(element => [element.x, element.y, element.width, element.height]), [[430, 270, 240, 160], [1030, 270, 240, 160]]);
  const b = sceneBounds(resized), center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const handle = selectionHandles(state()).find(handle => handle.key === 'rotate');
  drag(app, handle, rotatePoint(handle, center, Math.PI / 2));
  for (const element of app.scene()) { assert.ok(Math.abs(element.angle - Math.PI / 2) < 1e-7); assert.deepEqual(element.groupIds, moved[0].groupIds); }
});

test('double-click enters one group level and Escape selects its containing group', () => {
  const app = createApp({ savedElements: [box('one'), box('two', 700), box('three', 1000)] }); nested(app);
  doubleClick(app); selected(app, 2); doubleClick(app); selected(app, 1);
  app.key('ArrowRight'); assert.deepEqual(app.scene().map(element => element.x), [401, 700, 1000]);
  app.key('Escape'); selected(app, 2); app.key('ArrowRight'); assert.deepEqual(app.scene().map(element => element.x), [402, 701, 1000]);
  app.key('Escape'); selected(app, 3); app.key('ArrowRight'); assert.deepEqual(app.scene().map(element => element.x), [403, 702, 1001]);
});

test('member editing supports subgroup creation and leaves the group on an outside click', () => {
  const app = createApp({ savedElements: [box('one', 400, { groupIds: ['outer'] }), box('two', 700, { groupIds: ['outer'] }), box('three', 1000)] });
  click(app); doubleClick(app); selected(app, 1);
  click(app, 700, { shiftKey: true }); group(app);
  const grouped = app.scene(); assert.equal(grouped[0].groupIds[1], 'outer'); assert.deepEqual(grouped[0].groupIds, grouped[1].groupIds);
  ungroup(app); assert.deepEqual(app.scene().slice(0, 2).map(element => element.groupIds), [['outer'], ['outer']]);
  click(app, 1000); selected(app, 1); click(app); selected(app, 2);
  doubleClick(app); app.click(app.canvas, { clientX: 1100, clientY: 600 }); click(app); selected(app, 2);
});

test('Shift-clicking outside an entered group selects its whole parent before regrouping', () => {
  const app = createApp({ savedElements: [box('one', 400, { groupIds: ['pair'] }), box('two', 700, { groupIds: ['pair'] }), box('three', 1000)] });
  click(app); doubleClick(app); selected(app, 1); click(app, 1000, { shiftKey: true }); selected(app, 3); group(app);
  const elements = app.scene(); assert.deepEqual(elements[0].groupIds, elements[1].groupIds); assert.equal(elements[0].groupIds.length, 2);
  ungroup(app); assert.deepEqual(app.scene().map(element => element.groupIds), [['pair'], ['pair'], []]);
});

test('copy/paste and duplication remap groups and deletion removes every group member', () => {
  const app = createApp({ savedElements: [box('one'), box('two', 700)] }); all(app); group(app);
  const original = app.scene(); let copied;
  app.dispatch(app.document, 'copy', { clipboardData: { setData: (_, value) => { copied = value; } } });
  assert.equal(JSON.parse(copied).elements.length, 2);
  app.dispatch(app.document, 'paste', { clipboardData: { getData: () => copied } });
  const pasted = app.scene().slice(2); assert.deepEqual(pasted[0].groupIds, pasted[1].groupIds); assert.notDeepEqual(pasted[0].groupIds, original[0].groupIds);
  app.key('d', { metaKey: true }); const duplicated = app.scene().slice(4);
  assert.deepEqual(duplicated[0].groupIds, duplicated[1].groupIds); assert.notDeepEqual(duplicated[0].groupIds, pasted[0].groupIds);
  app.key('Delete'); assert.equal(app.scene().length, 4);
  app.key('z', { metaKey: true }); assert.equal(app.scene().length, 6);
});

test('duplicating a member inside a group retains the containing group', () => {
  const app = createApp({ savedElements: [box('one', 400, { groupIds: ['pair'] }), box('two', 700, { groupIds: ['pair'] })] });
  click(app); doubleClick(app); app.key('d', { metaKey: true });
  assert.deepEqual(app.scene().map(element => element.groupIds), [['pair'], ['pair'], ['pair']]);
  app.key('Escape'); selected(app, 3);
});

test('copying an entered subgroup keeps its children and detaches unselected ancestors', () => {
  const app = createApp({ savedElements: [box('one'), box('two', 700), box('three', 1000)] }); nested(app);
  doubleClick(app); selected(app, 2);
  let copied; app.dispatch(app.document, 'copy', { clipboardData: { setData: (_, value) => { copied = value; } } });
  app.dispatch(app.document, 'paste', { clipboardData: { getData: () => copied } });
  const pasted = app.scene().slice(3); assert.equal(pasted.length, 2);
  assert.equal(pasted[0].groupIds.length, 1); assert.deepEqual(pasted[0].groupIds, pasted[1].groupIds);
  ungroup(app); assert.ok(app.scene().slice(3).every(element => !element.groupIds.length));
});

test('bound labels and frame contents do not count as independent components', () => {
  const app = createApp({ savedElements: [box('shape', 400, { boundElements: [{ id: 'label', type: 'text' }] }), { id: 'label', type: 'text', containerId: 'shape', text: 'Label' }, box('two', 700)] });
  click(app); group(app); assert.ok(app.scene().every(element => !element.groupIds.length));
  click(app, 700, { shiftKey: true }); group(app); assert.ok(app.scene().every(element => element.groupIds.length === 1));
  app.key('Escape'); click(app); selected(app, 3); app.key('ArrowRight');
  assert.equal(app.scene()[0].x, 401); assert.equal(app.scene()[2].x, 701); assert.equal(app.scene()[1].containerId, 'shape');
  const frame = createApp({ savedElements: [{ id: 'frame', type: 'frame', x: 350, y: 200, width: 500, height: 200 }, box('one', 400, { frameId: 'frame' })] });
  click(frame, 350); group(frame); assert.ok(frame.scene().every(element => !element.groupIds.length));
});

test('grouped text requires entering the group before editing and shortcuts respect text inputs', () => {
  const app = createApp({ savedElements: [box('one', 400, { groupIds: ['pair'] }), { id: 'text', type: 'text', x: 700, y: 250, text: 'Group label', fontFamily: 2, groupIds: ['pair'] }] });
  click(app); doubleClick(app, 710, 260); selected(app, 1); assert.equal(app.editor.hidden, true);
  doubleClick(app, 710, 260); assert.equal(app.editor.hidden, false);
  const original = app.scene(); assert.equal(app.key('g', { metaKey: true }).defaultPrevented, false);
  app.key('G', { metaKey: true, shiftKey: true }); assert.deepEqual(app.scene(), original);
  app.key('Escape'); assert.equal(app.editor.hidden, true);
});

test('locked groups remain intact and cannot be regrouped, moved or ungrouped', () => {
  const app = createApp({ savedElements: [box('one', 400, { groupIds: ['pair'] }), box('two', 700, { groupIds: ['pair'], locked: true })] });
  const original = app.scene(); click(app); selected(app, 2); group(app); ungroup(app); app.key('ArrowRight'); app.key('Delete');
  assert.deepEqual(app.scene(), original);
  drag(app, { x: 400, y: 290 }, { x: 450, y: 320 }); assert.deepEqual(app.scene(), original);
  app.dispatch(app.canvas, 'contextmenu', { clientX: 400, clientY: 290 });
  assert.equal(item(app, 'group').disabled, true); assert.equal(item(app, 'ungroup').disabled, true);
  app.key('Escape'); all(app); selected(app, 2); app.key('ArrowRight'); app.key('Delete'); assert.deepEqual(app.scene(), original);
});

test('Enter enters selected groups and select-all stays within the entered group', () => {
  const app = createApp({ savedElements: [box('one'), box('two', 700), box('three', 1000)] }); nested(app);
  app.canvas.focus(); app.key('Enter'); selected(app, 2); app.key('Enter'); selected(app, 1);
  all(app); selected(app, 2); app.key('Escape'); selected(app, 2); app.key('Escape'); selected(app, 3);
});

test('nested group membership survives reload and editable export, and malformed IDs are normalized', () => {
  const app = createApp({ savedElements: [box('one'), box('two', 700), box('three', 1000)] }); nested(app);
  const elements = app.scene(), imported = importScene(exportScene(elements)).elements;
  assert.deepEqual(imported.map(element => element.groupIds), elements.map(element => element.groupIds));
  const reload = createApp({ savedElements: imported }); click(reload); selected(reload, 3);
  ungroup(reload); assert.equal(reload.scene()[0].groupIds.length, 1); assert.deepEqual(reload.scene()[2].groupIds, []);
  const malformed = importScene({ elements: [box('null', 400, { groupIds: null }), box('mixed', 700, { groupIds: ['pair', 42, null, '', 'pair', 'outer'] })] });
  assert.deepEqual(malformed.elements.map(element => element.groupIds), [[], ['pair', 'outer']]);
});

for (const theme of ['light', 'dark']) for (const width of [1440, 375]) test(`Group and Ungroup menu actions work in ${theme} at ${width}px`, () => {
  const app = createApp({ theme, width, savedElements: [box('one', 50), box('two', 220)] });
  all(app); app.key('F10', { shiftKey: true });
  assert.equal(item(app, 'group').disabled, false); assert.equal(item(app, 'ungroup').disabled, true);
  assert.match(item(app, 'group').textContent, /g$/); app.click(item(app, 'group'));
  assert.equal(app.scene()[0].groupIds.length, 1);
  app.key('F10', { shiftKey: true }); assert.equal(item(app, 'group').disabled, true); assert.equal(item(app, 'ungroup').disabled, false);
  app.click(item(app, 'ungroup')); assert.ok(app.scene().every(element => !element.groupIds.length));
  assert.equal(app.get('object-context-menu').hidden, true); assert.equal(app.document.activeElement, app.canvas);
});

test('renaming a grouped frame retains selection of its group', () => {
  const app = createApp({ savedElements: [{ id: 'frame', type: 'frame', x: 350, y: 200, width: 250, height: 200, groupIds: ['pair'] }, box('two', 700, { groupIds: ['pair'] })] });
  app.click(app.document.querySelector('.frame-name'));
  const input = app.get('frame-name'); input.value = 'Grouped frame'; app.key('Enter'); selected(app, 2);
  app.key('ArrowRight'); assert.deepEqual(app.scene().map(element => element.x), [351, 701]);
});
