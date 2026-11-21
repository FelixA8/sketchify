import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './helpers/app.mjs';

test('clicking the text tool and canvas keeps the editor focused for typing', () => {
  const app = createApp();
  app.tool('text');
  app.click(app.canvas, { clientX: 450, clientY: 300 });
  assert.equal(app.editor.hidden, false);
  assert.equal(app.document.activeElement, app.editor);
  app.input('A new label');
  app.key('Enter', { metaKey: true });
  assert.equal(app.scene().length, 1);
  assert.equal(app.scene()[0].text, 'A new label');
  assert.equal(app.scene()[0].x, 450);
  assert.equal(app.scene()[0].y, 300);
});

test('the T shortcut creates a separate text component over an existing label', () => {
  const app = createApp();
  app.tool('text');
  app.canvas.focus(); app.key('Enter');
  app.input('Original'); app.key('Enter', { ctrlKey: true });
  const original = app.scene()[0];
  app.canvas.focus(); app.key('t');
  app.click(app.canvas, { clientX: original.x + 15, clientY: original.y + 15 });
  assert.equal(app.editor.textContent, '');
  app.input('Separate'); app.key('Enter', { ctrlKey: true });
  const elements = app.scene(); assert.equal(elements.length, 2);
  assert.deepEqual(elements[0], original);
  assert.notEqual(elements[1].id, original.id);
  assert.equal(elements[1].text, 'Separate');
  assert.ok(!elements[1].containerId);
});

test('multiline editor spacing and dimensions match the text at the current zoom', () => {
  const app = createApp({ zoom: 2, pan: { x: 70, y: -30 } });
  app.tool('text'); app.canvas.focus(); app.key('Enter');
  app.input('First line\nSecond line\n');
  assert.equal(app.editor.style.lineHeight, '1.25');
  assert.ok(Number.parseFloat(app.editor.style.height) >= 3 * 32 * 2 * 1.25);
  app.key('Enter', { ctrlKey: true });
  const text = app.scene()[0];
  assert.equal(text.height, 120);
  assert.equal(text.text, 'First line\nSecond line\n');
});

test('text style controls update the draft without closing it or adding undo steps', () => {
  const app = createApp();
  app.tool('text'); app.click(app.canvas, { clientX: 450, clientY: 300 });
  app.input('Styled label');
  app.click(app.property('fontSize', 48));
  assert.equal(app.editor.hidden, false);
  assert.equal(app.document.activeElement, app.editor);
  assert.match(app.editor.style.font, /^48px /);
  app.click(app.property('fontFamily', 3));
  app.click(app.property('strokeColor', '#1971c2'));
  const opacity = app.get('opacity');
  app.click(opacity);
  opacity.value = '50';
  app.dispatch(opacity, 'input');
  app.dispatch(opacity, 'change');
  assert.equal(app.editor.style.opacity, '0.5');
  assert.equal(app.editor.hidden, false);
  assert.equal(app.document.activeElement, app.editor);
  app.key('Enter', { metaKey: true });
  const text = app.scene()[0];
  assert.equal(text.fontSize, 48);
  assert.equal(text.fontFamily, 3);
  assert.equal(text.strokeColor, '#1971c2');
  assert.equal(text.opacity, 50);
  app.click(app.get('undo-button'));
  assert.equal(app.scene().length, 0);
  app.click(app.get('redo-button'));
  assert.equal(app.scene()[0].text, 'Styled label');
});

test('double-click editing supports cancellation and one undo step for text and style changes', () => {
  const app = createApp();
  app.tool('text'); app.canvas.focus(); app.key('Enter');
  app.input('Original'); app.key('Enter', { metaKey: true });
  const original = app.scene()[0];
  const atLabel = { clientX: original.x + 15, clientY: original.y + 15 };
  app.dispatch(app.canvas, 'dblclick', atLabel);
  assert.equal(app.get('properties').hidden, false);
  assert.ok(app.property('fontSize', 48));
  app.input('Cancelled'); app.click(app.property('fontSize', 48));
  app.key('Escape');
  assert.deepEqual(app.scene()[0], original);
  assert.equal(app.editor.hidden, true);
  app.dispatch(app.canvas, 'dblclick', atLabel);
  app.input('Saved'); app.click(app.property('fontSize', 36));
  app.key('Enter', { metaKey: true });
  assert.equal(app.scene()[0].text, 'Saved');
  assert.equal(app.scene()[0].fontSize, 36);
  app.click(app.get('undo-button'));
  assert.deepEqual(app.scene()[0], original);
});

test('clicking away saves text and an empty existing label is removed with undo support', () => {
  const app = createApp();
  app.tool('text'); app.click(app.canvas, { clientX: 450, clientY: 300 });
  app.input('Keep this');
  app.click(app.canvas, { clientX: 700, clientY: 500 });
  assert.equal(app.editor.hidden, true);
  assert.equal(app.scene()[0].text, 'Keep this');
  app.dispatch(app.canvas, 'dblclick', { clientX: 465, clientY: 315 });
  app.input('');
  app.click(app.get('menu-button'));
  assert.equal(app.scene().length, 0);
  app.click(app.get('undo-button'));
  assert.equal(app.scene()[0].text, 'Keep this');
});

test('Escape discards a fresh label and IME confirmation keys keep editing active', () => {
  const app = createApp();
  app.tool('text'); app.click(app.canvas, { clientX: 450, clientY: 300 });
  app.input('你好');
  app.key('Enter', { ctrlKey: true, isComposing: true });
  assert.equal(app.editor.hidden, false);
  app.key('Escape', { isComposing: true });
  assert.equal(app.editor.hidden, false);
  app.key('Escape');
  assert.equal(app.scene().length, 0);
  assert.equal(app.editor.hidden, true);
  assert.equal(app.document.activeElement, app.canvas);
  assert.equal(app.document.querySelector('[data-tool="selection"]').getAttribute('aria-pressed'), 'true');
});

test('a locked text tool places multiple independent labels and supports middle-button panning', () => {
  const app = createApp();
  app.tool('text'); app.click(app.get('lock-button'));
  for (const [x, value] of [[400, 'First'], [700, 'Second']]) {
    app.click(app.canvas, { clientX: x, clientY: 300 });
    app.input(value); app.key('Enter', { ctrlKey: true });
  }
  assert.deepEqual(app.scene().map(e => e.text), ['First', 'Second']);
  app.dispatch(app.canvas, 'pointerdown', { button: 1, clientX: 100, clientY: 100 });
  app.dispatch(app.canvas, 'pointermove', { clientX: 150, clientY: 130 });
  app.dispatch(app.canvas, 'pointerup');
  assert.equal(app.editor.hidden, true);
  assert.equal(app.scene().length, 2);
});

test('text editor uses saved pan, zoom, theme and opacity when reopening a label', () => {
  const text = { id: 'label', type: 'text', x: 200, y: 150, width: 100, height: 30, text: 'Existing', fontSize: 24, fontFamily: 2, strokeColor: '#1b1b1f', opacity: 40 };
  const app = createApp({ savedElements: [text], zoom: 2, pan: { x: 70, y: -30 }, theme: 'dark' });
  app.dispatch(app.canvas, 'dblclick', { clientX: 500, clientY: 300 });
  assert.equal(app.editor.style.left, '470px');
  assert.equal(app.editor.style.top, '270px');
  assert.equal(app.editor.style.fontSize, '48px');
  assert.equal(app.editor.style.fontFamily, 'Arial, sans-serif');
  assert.equal(app.editor.style.color, 'rgb(238, 238, 239)');
  assert.equal(app.editor.style.opacity, '0.4');
});

test('editing compensates for HTML baseline spacing without changing text coordinates or line spacing', () => {
  const text = { id: 'label', type: 'text', x: 200, y: 150, text: 'First\nSecond', fontSize: 24, fontFamily: 2 };
  const app = createApp({ savedElements: [text], zoom: 2, pan: { x: 70, y: -30 } });
  const original = app.scene()[0], prototype = app.window.HTMLElement.prototype;
  const getRect = prototype.getBoundingClientRect;
  prototype.getBoundingClientRect = function () {
    if (this.style.visibility === 'hidden') return { top: 100 };
    if (this.style.verticalAlign === 'baseline') return { top: 146 };
    return getRect.call(this);
  };
  const ctx = app.canvas.getContext('2d');
  ctx.save(); ctx.font = '48px Arial, sans-serif';
  ctx.textBaseline = 'alphabetic'; const ascent = ctx.measureText('M').actualBoundingBoxAscent;
  ctx.textBaseline = 'top'; const topAscent = ctx.measureText('M').actualBoundingBoxAscent;
  ctx.restore();
  app.dispatch(app.canvas, 'dblclick', { clientX: 500, clientY: 300 });
  assert.equal(app.editor.style.transform, `translateY(${ascent - topAscent - 46}px)`);
  assert.equal(app.editor.style.left, '470px');
  assert.equal(app.editor.style.top, '270px');
  assert.equal(app.editor.style.lineHeight, '1.25');
  assert.equal(Number.parseFloat(app.editor.style.getPropertyValue('--text-content-height')), original.height * 2);
  assert.equal(app.document.querySelector('[style*="visibility: hidden"]'), null);
  app.key('Enter', { ctrlKey: true });
  assert.deepEqual(app.scene()[0], original);
});
