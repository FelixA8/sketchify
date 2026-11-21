import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from '../src/scene.ts';
import { createStore } from '../src/whiteboard/store.ts';
import { activatePage, blankPage, projectData, readProject } from '../src/whiteboard/project.ts';
import { loadStorage, storedScene } from '../src/whiteboard/persistence.ts';
import { elementKey, groupKey, layerModel, layerMembers, moveLayer, visibleElements } from '../src/whiteboard/layers.ts';

const shape = (id, properties = {}) => ({ ...createElement('rectangle', 100, 100), id, width: 80, height: 60, ...properties });
test('legacy storage migrates to one page and project reload restores all canvases and views', () => {
  const store = createStore(), elements = [shape('old')];
  assert.equal(loadStorage(store, { getItem: () => JSON.stringify({ elements, local: { name: 'Old drawing', pan: { x: 20, y: 30 }, zoom: 2 } }) }), '');
  assert.equal(projectData(store.state).pages[0].elements[0].id, 'old');
  store.change(s => {
    s.layers['e:old'] = { name: 'Original', hidden: true };
    const second = blankPage('Second', 'second'); s.pages.push(second); activatePage(s, second.id);
    s.elements = [shape('new')]; s.background = '#abcdef'; s.pan = { x: 9, y: 12 }; s.zoom = .75;
  });
  const saved = storedScene(store.state), restored = createStore();
  assert.equal(loadStorage(restored, { getItem: () => JSON.stringify(saved) }), '');
  assert.deepEqual(projectData(restored.state), saved.project);
  assert.equal(restored.state.activePageId, 'second');
  restored.change(s => activatePage(s, 'page-1'));
  assert.deepEqual(restored.state.pan, { x: 20, y: 30 }); assert.equal(restored.state.zoom, 2);
  assert.deepEqual(restored.state.layers['e:old'], { name: 'Original', hidden: true });
});
test('page undo histories retain drawing and layer edits independently across switches', () => {
  const store = createStore();
  store.change(s => { s.elements.push(shape('one')); }); store.commit();
  store.change(s => { s.layers['e:one'] = { hidden: true }; }); store.commit();
  store.change(s => { s.pages.push(blankPage('Two', 'two')); activatePage(s, 'two'); }); store.pageHistory();
  store.change(s => { s.elements.push(shape('two')); }); store.commit();
  store.travel('undo'); assert.equal(store.state.elements.length, 0);
  store.change(s => activatePage(s, 'page-1')); store.pageHistory();
  store.travel('undo'); assert.equal(store.state.elements[0].id, 'one'); assert.equal(store.state.layers['e:one'], undefined);
  store.travel('redo'); assert.equal(store.state.layers['e:one'].hidden, true);
  store.change(s => activatePage(s, 'two')); store.pageHistory();
  assert.equal(store.state.canRedo, true); store.travel('redo'); assert.equal(store.state.elements[0].id, 'two');
});
test('hierarchy nests groups, frames and labels; visibility and locking inherit without changing children', () => {
  const elements = [shape('frame', { type: 'frame' }), shape('a', { frameId: 'frame', groupIds: ['inner', 'outer'] }), shape('b', { frameId: 'frame', groupIds: ['outer'] }), shape('label', { type: 'text', containerId: 'a', frameId: 'frame', groupIds: ['inner', 'outer'] })];
  const layers = { 'g:outer': { hidden: true, locked: true }, 'e:b': { hidden: true } };
  const model = layerModel(elements, layers);
  assert.equal(model.nodes.get('g:outer').parent, 'e:frame'); assert.equal(model.nodes.get('g:inner').parent, 'g:outer');
  assert.equal(model.nodes.get('e:label').parent, 'e:a');
  assert.deepEqual([...model.hidden].sort(), ['a', 'b', 'label']); assert.deepEqual([...model.locked].sort(), ['a', 'b', 'label']);
  assert.deepEqual(visibleElements(elements, layers).map(e => e.id), ['frame']);
  assert.deepEqual(visibleElements(elements, { ...layers, 'g:outer': { hidden: false } }).map(e => e.id), ['frame', 'a', 'label']);
});
test('dragging changes membership and stacking, preserves internal hierarchy, and rejects cycles and locks', () => {
  const elements = [shape('f', { type: 'frame' }), shape('a', { frameId: 'f', groupIds: ['g'] }), shape('b', { frameId: 'f', groupIds: ['g'] }), shape('c')];
  assert.equal(moveLayer(elements, {}, 'e:f', 'g:g', 'inside'), null);
  assert.equal(moveLayer(elements, { 'g:g': { locked: true } }, 'e:a', null, 'inside'), null);
  let moved = moveLayer(elements, {}, 'e:c', 'g:g', 'inside');
  assert.deepEqual(moved.find(e => e.id === 'c').groupIds, ['g']); assert.equal(moved.find(e => e.id === 'c').frameId, 'f');
  moved = moveLayer(moved, {}, 'g:g', null, 'inside');
  assert.equal(moved.find(e => e.id === 'a').frameId, null); assert.deepEqual(moved.find(e => e.id === 'a').groupIds, ['g']);
  moved = moveLayer(moved, {}, 'e:f', 'g:g', 'before'); assert.equal(moved.at(-1).id, 'f');
  const frame = [shape('f', { type: 'frame' }), shape('a', { frameId: 'f', groupIds: ['g'] }), shape('b', { frameId: 'f', groupIds: ['g'] }), shape('other', { type: 'frame' })];
  moved = moveLayer(frame, {}, 'e:f', 'e:other', 'inside');
  assert.deepEqual(moved.find(e => e.id === 'a').groupIds, ['g']); assert.equal(moved.find(e => e.id === 'a').frameId, 'f');
});
test('malformed hierarchy cannot recurse forever and malformed project files fail before replacement', () => {
  const elements = [shape('a', { frameId: 'b' }), shape('b', { frameId: 'a' })];
  assert.equal(layerModel(elements, {}).roots.flatMap(layerMembers).length, 2);
  assert.throws(() => readProject({ type: 'sketchify', version: 2, pages: [] }));
  assert.throws(() => readProject({ type: 'sketchify', version: 1, pages: [{}] }));
  const { project } = readProject({ type: 'sketchify', version: 1, activePageId: 'missing', pages: [{ id: 'same', elements: [] }, { id: 'same', elements: [], zoom: -100, pan: { x: 'bad', y: 0 } }] });
  assert.notEqual(project.pages[0].id, project.pages[1].id); assert.equal(project.activePageId, 'same');
  assert.equal(project.pages[1].zoom, .1); assert.deepEqual(project.pages[1].pan, { x: 0, y: 0 });
  assert.equal(elementKey('a'), 'e:a'); assert.equal(groupKey('g'), 'g:g');
});

test('grouped frames retain their children and local groups through reparenting', () => {
  const elements = [shape('f', { type: 'frame', groupIds: ['outer'] }), shape('a', { frameId: 'f', groupIds: ['inner', 'outer'] }), shape('b', { frameId: 'f', groupIds: ['inner', 'outer'] }), shape('outside', { groupIds: ['outer'] }), shape('dest', { groupIds: ['destination'] })];
  let model = layerModel(elements, {});
  assert.equal(model.nodes.get('e:f').parent, 'g:outer'); assert.equal(model.nodes.get('g:inner').parent, 'e:f');
  assert.equal(model.nodes.get('e:a').parent, 'g:inner'); assert.equal(layerMembers(model.nodes.get('e:f')).length, 3);
  const moved = moveLayer(elements, {}, 'e:f', 'g:destination', 'inside');
  model = layerModel(moved, {});
  assert.equal(model.nodes.get('e:f').parent, 'g:destination'); assert.equal(model.nodes.get('g:inner').parent, 'e:f');
  assert.deepEqual(moved.find(e => e.id === 'a').groupIds, ['inner', 'destination']);
  assert.equal(model.nodes.get('e:outside').parent, 'g:outer');
  assert.ok(moveLayer(moved, {}, 'e:a', 'g:inner', 'inside'), 'a member can be dropped back into its current container');
});
