import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { createApp } from './helpers/app.mjs';
import { exportScene, importScene, rotatePoint } from '../src/scene.ts';
import { noteDate, NOTE_SIZE } from '../src/notes.ts';
import { layout } from '../src/text.ts';
import { selectionHandles } from '../src/whiteboard/canvas.ts';
import { initialState } from '../src/whiteboard/store.ts';
import { readProject } from '../src/whiteboard/project.ts';
import { svgDocument } from '../src/whiteboard/files.ts';

const close = (a, b) => assert.ok(Math.abs(a - b) < .001, `${a} should equal ${b}`);
const center = element => ({ x: element.x + element.width / 2, y: element.y + element.height / 2 });
function begin(app, start = { x: 400, y: 250 }, end) {
  app.tool('stickynote');
  app.dispatch(app.canvas, 'pointerdown', { clientX: start.x, clientY: start.y, pointerId: 1 });
  if (end) app.dispatch(app.canvas, 'pointermove', { clientX: end.x, clientY: end.y, pointerId: 1 });
  app.dispatch(app.canvas, 'pointerup', { pointerId: 1 });
}
function finish(app, content = 'A note') {
  app.input(content); app.key('Enter', { ctrlKey: true });
  return app.scene();
}
function edit(app, note, point = { x: note.x + note.width - 20, y: note.y + 20 }) {
  app.dispatch(app.canvas, 'dblclick', { clientX: point.x, clientY: point.y });
}
function centered(note, text) {
  const local = rotatePoint(center(text), center(note), -note.angle);
  close(local.x, center(note).x); close(local.y, center(note).y - 10);
  close(text.angle, note.angle);
  assert.equal(text.containerId, note.id);
}
function handles(elements) {
  return selectionHandles({ ...initialState(), elements, selected: new Set([elements[0].id]) });
}

test('N selects Sticky note; clicking places a dated 250px paper and immediately edits its bound text', () => {
  const app = createApp(); app.canvas.focus(); app.key('n');
  assert.equal(app.document.querySelector('[data-tool="stickynote"]').getAttribute('aria-pressed'), 'true');
  app.click(app.canvas, { clientX: 400, clientY: 250 });
  assert.equal(app.document.activeElement, app.editor);
  assert.equal(app.editor.style.textAlign, 'center');
  const paper = app.scene()[0];
  assert.equal(paper.type, 'stickynote'); assert.equal(paper.width, NOTE_SIZE); assert.equal(paper.height, NOTE_SIZE);
  assert.equal(paper.x, 400); assert.equal(paper.y, 250); assert.ok(Number.isFinite(paper.created));
  app.input('Hi, this is a note'); app.click(app.get('text-done'));
  const [note, text] = app.scene();
  assert.equal(app.editor.hidden, true); assert.equal(text.text, 'Hi, this is a note');
  assert.deepEqual(note.boundElements, [{ id: text.id, type: 'text' }]); centered(note, text);
  assert.equal(note.created, paper.created);
  app.click(app.get('undo-button')); assert.equal(app.scene().some(element => element.type === 'text'), false);
  app.click(app.get('redo-button')); assert.equal(app.scene()[1].text, text.text); assert.equal(app.scene()[0].created, paper.created);
});

test('reverse dragging sizes a note and pointer cancellation discards an unfinished placement', () => {
  const app = createApp(); begin(app, { x: 600, y: 450 }, { x: 420, y: 270 });
  const [note] = finish(app, 'Reverse drag');
  assert.equal(note.x, 420); assert.equal(note.y, 270); assert.equal(note.width, 180); assert.equal(note.height, 180);
  const original = app.scene(); app.tool('stickynote');
  app.dispatch(app.canvas, 'pointerdown', { clientX: 700, clientY: 200, pointerId: 2 });
  app.dispatch(app.canvas, 'pointermove', { clientX: 800, clientY: 300, pointerId: 2 });
  app.dispatch(app.canvas, 'pointercancel', { pointerId: 2 });
  assert.deepEqual(app.scene(), original);
});

test('double-clicking blank paper edits the same label; cancellation preserves it and shorter text restores paper size', () => {
  const app = createApp(); begin(app); const original = finish(app, 'Original');
  edit(app, original[0]); assert.equal(app.document.activeElement, app.editor); assert.equal(app.editor.textContent, 'Original');
  app.input('Discarded\n'.repeat(30)); app.key('Escape');
  assert.deepEqual(app.scene(), original);
  edit(app, original[0]); const grown = finish(app, 'A long note that must grow.\n'.repeat(35));
  assert.equal(grown[1].fontSize, 16); assert.ok(grown[0].height > original[0].height);
  assert.ok(layout(grown[1], app.canvas.getContext('2d')).height <= grown[0].height - 52);
  centered(...grown);
  edit(app, grown[0]); const shortened = finish(app, 'Short');
  assert.equal(shortened[0].height, original[0].height); assert.equal(shortened[1].fontSize, original[1].fontSize);
  assert.equal(shortened[1].id, original[1].id); assert.equal(shortened[0].created, original[0].created);
});

test('Escape discards note formatting drafts even after a subsequent scene edit', () => {
  const app = createApp(); begin(app); const original = finish(app, 'Original');
  edit(app, original[0]);
  app.click(app.property('backgroundColor', '#b2f2bb')); app.click(app.property('fontSize', 48));
  app.click(app.property('strokeColor', '#1971c2'));
  app.click(app.document.querySelector('[aria-label="Align text right"]'));
  app.key('Escape'); app.canvas.focus(); app.key('ArrowRight');
  const elements = app.scene();
  for (const key of ['backgroundColor', 'fontSize', 'strokeColor', 'textAlign', 'height', 'created']) assert.equal(elements[0][key], original[0][key]);
  assert.equal(elements[1].text, 'Original'); assert.equal(elements[1].fontSize, original[1].fontSize);
  assert.equal(elements[0].x, original[0].x + 1);
});

test('clearing a grown note restores its base paper height and keeps the blank paper editable', () => {
  const app = createApp(); begin(app); const grown = finish(app, 'Line of text\n'.repeat(35));
  assert.ok(grown[0].height > NOTE_SIZE);
  edit(app, grown[0]); const cleared = finish(app, '');
  assert.equal(cleared.length, 1); assert.equal(cleared[0].height, NOTE_SIZE); assert.equal(cleared[0].created, grown[0].created);
  edit(app, cleared[0]); const restored = finish(app, 'Write again');
  assert.equal(restored[1].text, 'Write again'); assert.equal(restored[0].height, NOTE_SIZE);
});

test('paper color, text color, font and opacity update both live editing and the saved note', () => {
  const app = createApp(); begin(app); const created = app.scene()[0].created; app.input('Styled note');
  app.click(app.property('backgroundColor', '#b2f2bb'));
  app.click(app.property('strokeColor', '#1971c2'));
  app.click(app.property('fontSize', 48)); app.click(app.property('fontFamily', 2));
  app.get('opacity').value = '60'; app.dispatch(app.get('opacity'), 'input'); app.dispatch(app.get('opacity'), 'change');
  app.click(app.get('text-done'));
  let [note, text] = app.scene();
  assert.equal(note.backgroundColor, '#b2f2bb'); assert.equal(text.strokeColor, '#1971c2');
  assert.equal(note.fontSize, 48); assert.equal(text.baseFontSize, 48); assert.equal(text.fontFamily, 2);
  assert.equal(note.opacity, 60); assert.equal(text.opacity, 60);
  app.click(app.property('backgroundColor', '#ffd8a8'));
  app.click(app.property('strokeColor', '#c92a2a')); app.click(app.property('fontSize', 16));
  [note, text] = app.scene();
  assert.equal(note.backgroundColor, '#ffd8a8'); assert.equal(text.strokeColor, '#c92a2a');
  assert.equal(text.fontSize, 16); assert.equal(text.baseFontSize, 16); assert.equal(note.created, created);
  const labels = [...app.document.querySelectorAll('.prop-label')].map(label => label.textContent);
  assert.ok(labels.includes('Note color')); assert.ok(labels.includes('Text color')); assert.ok(!labels.includes('Sloppiness'));
});

test('moving, resizing and rotating paper preserve its date and bound text geometry', () => {
  const app = createApp(); begin(app); let elements = finish(app, 'Geometry'); const created = elements[0].created;
  app.dispatch(app.canvas, 'pointerdown', { clientX: 440, clientY: 290 });
  app.dispatch(app.canvas, 'pointermove', { clientX: 480, clientY: 320 }); app.dispatch(app.canvas, 'pointerup');
  elements = app.scene(); close(elements[0].x, 440); close(elements[0].y, 280); centered(...elements);
  let handle = handles(elements).find(handle => handle.key === 'se');
  app.dispatch(app.canvas, 'pointerdown', { clientX: handle.x, clientY: handle.y });
  app.dispatch(app.canvas, 'pointermove', { clientX: handle.x + 100, clientY: handle.y + 100 }); app.dispatch(app.canvas, 'pointerup');
  elements = app.scene(); assert.ok(elements[0].width > NOTE_SIZE); assert.equal(elements[0].baseHeight, elements[0].height); centered(...elements);
  handle = handles(elements).find(handle => handle.key === 'rotate');
  const end = rotatePoint(handle, center(elements[0]), Math.PI / 3);
  app.dispatch(app.canvas, 'pointerdown', { clientX: handle.x, clientY: handle.y });
  app.dispatch(app.canvas, 'pointermove', { clientX: end.x, clientY: end.y }); app.dispatch(app.canvas, 'pointerup');
  elements = app.scene(); close(elements[0].angle, Math.PI / 3); centered(...elements); assert.equal(elements[0].created, created);
});

test('duplicated notes retain dates and reload through local storage, project and editable scene formats', () => {
  const app = createApp(); begin(app); finish(app, 'Keep this note');
  app.canvas.focus(); app.key('d', { ctrlKey: true }); const elements = app.scene();
  assert.equal(elements.length, 4); assert.notEqual(elements[0].id, elements[2].id);
  assert.equal(elements[0].created, elements[2].created); assert.equal(elements[3].containerId, elements[2].id);
  centered(...elements.slice(2));
  const saved = app.window.localStorage.getItem('sketchify.scene.v1');
  const reloaded = createApp({ storageEntries: { 'sketchify.scene.v1': saved } }); assert.deepEqual(reloaded.scene(), elements);
  const project = readProject(JSON.parse(saved).project); assert.equal(project.skipped, 0); assert.deepEqual(project.project.pages[0].elements, elements);
  const imported = importScene(exportScene(elements)); assert.equal(imported.skipped, 0);
  assert.equal(imported.elements[0].type, 'stickynote'); assert.equal(imported.elements[0].created, elements[0].created);
  assert.equal(imported.elements[1].baseFontSize, elements[1].baseFontSize);
  const roundTrip = createApp({ savedElements: imported.elements }); assert.equal(roundTrip.scene()[1].text, 'Keep this note');
});

test('SVG and PNG exports include note paper, body text and its creation-date footer', async () => {
  const app = createApp(); begin(app); app.click(app.property('fontFamily', 2)); const elements = finish(app, 'Export me');
  const svg = svgDocument(elements, null, app.canvas.getContext('2d'));
  assert.ok(svg.includes('Export me')); assert.ok(svg.includes(noteDate(elements[0]))); assert.match(svg, /<path /);
  app.click(app.get('menu-button')); app.click(app.document.querySelector('[data-action="export"]'));
  app.click(app.document.querySelector('[data-export="png"]'));
  const blob = app.downloads.at(-1); assert.equal(blob.type, 'image/png');
  const output = await loadImage(Buffer.from(await blob.arrayBuffer()));
  assert.ok(output.width >= NOTE_SIZE); assert.ok(output.height >= NOTE_SIZE);
  const canvas = createCanvas(output.width, output.height), ctx = canvas.getContext('2d'); ctx.drawImage(output, 0, 0);
  const scale = output.width / (elements[0].width + 48);
  const sample = ctx.getImageData(Math.round(44 * scale), Math.round(44 * scale), 1, 1).data;
  assert.deepEqual([...sample], [255, 223, 107, 255], 'PNG must contain the yellow paper');
  const footer = ctx.getImageData(Math.round((24 + elements[0].width - 110) * scale), Math.round((24 + elements[0].height - 34) * scale), Math.round(95 * scale), Math.round(22 * scale)).data;
  let darkPixels = 0;
  for (let i = 0; i < footer.length; i += 4) if (footer[i] < 100 && footer[i + 1] < 100 && footer[i + 2] < 100 && footer[i + 3] > 128) darkPixels++;
  assert.ok(darkPixels > 10, 'PNG must contain rendered date text in the footer');
});
