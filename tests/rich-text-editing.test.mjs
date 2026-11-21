import test from 'node:test';
import assert from 'node:assert/strict';
import { loadImage, createCanvas } from '@napi-rs/canvas';
import { createApp } from './helpers/app.mjs';
import { layout } from '../src/text.ts';
import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';
import { act } from 'react';
import { fontsForExport } from '../src/fonts.ts';

function start(options) {
  const app = createApp(options);
  app.tool('text'); app.click(app.canvas, { clientX: Math.min(400, (options?.width || 1440) - 80), clientY: 300 });
  app.input('plain styled linked');
  return app;
}
const format = (app, property) => app.click(app.document.querySelector(`[data-text-format="${property}"]`));
function link(app, url) {
  app.key('k', { ctrlKey: true });
  app.get('text-link-url').value = url;
  app.dispatch(app.get('text-link-form'), 'submit');
}
const finish = app => { app.click(app.get('text-done')); return app.scene()[0]; };

test('selected words combine bold, italic and underline without formatting surrounding words', () => {
  const app = start(); app.select(6, 12);
  for (const property of ['bold', 'italic', 'underline']) format(app, property);
  assert.equal(app.editor.querySelector('strong em u').textContent, 'styled');
  assert.equal(app.editor.textContent, 'plain styled linked');
  assert.equal(app.document.activeElement, app.editor);
  assert.deepEqual(finish(app).textSpans, [{ start: 6, end: 12, bold: true, italic: true, underline: true }]);
});

test('a selected phrase can have a styled embedded link and reopen without losing its range', () => {
  const app = start(); app.select(13, 19);
  format(app, 'bold'); format(app, 'italic'); format(app, 'underline');
  link(app, 'example.com/docs#details');
  assert.equal(app.editor.querySelector('a').textContent, 'linked');
  assert.equal(app.get('text-link-form').hidden, true);
  const saved = finish(app);
  assert.deepEqual(saved.textSpans, [{ start: 13, end: 19, bold: true, italic: true, underline: true, link: 'https://example.com/docs#details' }]);
  app.dispatch(app.canvas, 'dblclick', { clientX: 420, clientY: 315 });
  assert.equal(app.editor.querySelector('strong em u a').textContent, 'linked');
  app.select(15); app.key('k', { ctrlKey: true });
  assert.equal(app.get('text-link-url').value, 'https://example.com/docs#details');
  assert.equal(app.get('text-open-link').getAttribute('href'), 'https://example.com/docs#details');
  app.get('text-link-url').value = 'https://example.org/new'; app.dispatch(app.get('text-link-form'), 'submit');
  assert.equal(finish(app).textSpans[0].link, 'https://example.org/new');
});

test('removing a link keeps its text and independent bold/italic/underline formatting', () => {
  const app = start(); app.select(6, 12); format(app, 'bold'); link(app, 'https://example.com/');
  app.key('k', { ctrlKey: true }); app.click(app.get('text-unlink'));
  assert.equal(app.editor.querySelector('a'), null);
  assert.deepEqual(finish(app).textSpans, [{ start: 6, end: 12, bold: true }]);
});

test('mixed formatting toggles on across a selection and toggles off without removing other marks', () => {
  const app = start(); app.select(6, 9); format(app, 'bold');
  app.select(6, 12); format(app, 'bold'); format(app, 'italic'); format(app, 'bold');
  assert.deepEqual(finish(app).textSpans, [{ start: 6, end: 12, italic: true }]);
});

test('format shortcuts and selected link insertion participate in editor undo and redo', () => {
  const app = start(); app.select(6, 12);
  app.key('b', { metaKey: true }); app.key('i', { ctrlKey: true }); app.key('u', { ctrlKey: true });
  assert.ok(app.editor.querySelector('strong em u'));
  app.key('z', { metaKey: true }); assert.equal(app.editor.querySelector('u'), null);
  app.key('z', { metaKey: true, shiftKey: true }); assert.ok(app.editor.querySelector('u'));
  link(app, 'https://example.com/');
  app.key('z', { ctrlKey: true }); assert.equal(app.editor.querySelector('a'), null);
  app.key('y', { ctrlKey: true }); assert.ok(app.editor.querySelector('a'));
  assert.equal(finish(app).textSpans[0].link, 'https://example.com/');
});

test('format toggles at the caret apply to newly typed text and can be switched off', () => {
  const app = createApp(); app.tool('text'); app.click(app.canvas, { clientX: 400, clientY: 300 });
  format(app, 'bold'); format(app, 'italic'); app.type('Hello');
  format(app, 'bold'); format(app, 'italic'); app.type(' world');
  assert.equal(app.editor.textContent, 'Hello world');
  assert.deepEqual(finish(app).textSpans, [{ start: 0, end: 5, bold: true, italic: true }]);
});

test('Enter preserves line breaks and trailing empty lines while editing formatted text', () => {
  const app = start(); app.select(19); format(app, 'bold');
  app.dispatch(app.editor, 'beforeinput', { inputType: 'insertParagraph' }); app.type('Next line');
  app.dispatch(app.editor, 'beforeinput', { inputType: 'insertLineBreak' });
  assert.equal(app.editor.textContent, 'plain styled linked\nNext line\n');
  const saved = finish(app);
  assert.equal(saved.height, 120);
  assert.ok(saved.textSpans.some(span => span.bold && span.end === saved.text.length));
});

test('invalid links show an error, leave the text untouched and keep the editor open', () => {
  const app = start(); app.select(6, 12); link(app, 'javascript:alert(1)');
  assert.equal(app.get('text-link-form').hidden, false);
  assert.match(app.get('text-link-error').textContent, /valid/);
  assert.equal(app.editor.querySelector('a'), null);
  app.key('Escape'); assert.equal(app.get('text-link-form').hidden, true);
  assert.equal(app.editor.hidden, false);
  assert.deepEqual(finish(app).textSpans, []);
});

test('adding a link at an empty caret inserts the URL as visible linked text', () => {
  const app = createApp(); app.tool('text'); app.click(app.canvas, { clientX: 400, clientY: 300 });
  link(app, 'https://example.com/');
  assert.equal(app.editor.querySelector('a').textContent, 'https://example.com/');
  assert.equal(finish(app).textSpans[0].link, 'https://example.com/');
});

test('cancel restores the original rich text and scene undo restores a committed formatting change', () => {
  const app = start(); app.select(6, 12); format(app, 'bold');
  const original = finish(app);
  app.dispatch(app.canvas, 'dblclick', { clientX: 420, clientY: 315 });
  app.select(6, 12); format(app, 'italic'); app.key('Escape');
  assert.deepEqual(app.scene()[0], original);
  app.dispatch(app.canvas, 'dblclick', { clientX: 420, clientY: 315 });
  app.select(6, 12); format(app, 'italic'); finish(app);
  app.click(app.get('undo-button')); assert.deepEqual(app.scene()[0], original);
});

test('Ctrl/Cmd-click opens only the linked subsection and leaves normal selection intact', () => {
  const app = start(); app.select(13, 19); link(app, 'https://example.com/'); const saved = finish(app);
  const segment = layout(saved, app.canvas.getContext('2d')).segments.find(run => run.link);
  app.click(app.canvas, { clientX: saved.x + segment.x + 5, clientY: saved.y + 10, ctrlKey: true });
  assert.deepEqual(app.opened, [['https://example.com/', '_blank', 'noopener,noreferrer']]);
  app.click(app.canvas, { clientX: saved.x + 5, clientY: saved.y + 10, ctrlKey: true });
  assert.equal(app.opened.length, 1);
  assert.deepEqual(app.scene()[0], saved);
});

test('clipboard copying and pasting selected rich text preserves formatting without importing HTML', () => {
  const app = start(); app.select(6, 12); format(app, 'bold'); link(app, 'https://example.com/');
  const data = new Map(), clipboardData = { getData: key => data.get(key) || '', setData: (key, value) => data.set(key, value) };
  app.dispatch(app.editor, 'copy', { clipboardData });
  assert.equal(data.get('text/plain'), 'styled');
  app.select(19); app.dispatch(app.editor, 'paste', { clipboardData });
  assert.equal(app.editor.textContent, 'plain styled linkedstyled');
  assert.equal(app.editor.querySelectorAll('a').length, 2);
  data.clear(); data.set('text/plain', '<script>alert(1)</script>'); data.set('text/html', '<img src=x onerror=alert(1)>');
  app.dispatch(app.editor, 'paste', { clipboardData });
  assert.equal(app.editor.querySelector('script,img'), null);
  assert.match(app.editor.textContent, /<script>alert\(1\)<\/script>/);
});

test('formatting controls stay within a narrow viewport and support keyboard link cancellation', () => {
  const app = start({ width: 375, height: 700 });
  const left = Number.parseFloat(app.get('text-formatting').style.left);
  assert.ok(left >= 12 && left + 272 <= 375 - 12);
  app.select(6, 12); app.key('k', { ctrlKey: true });
  assert.equal(app.document.activeElement, app.get('text-link-url'));
  app.key('Escape');
  assert.equal(app.document.activeElement, app.editor);
  format(app, 'bold');
  assert.deepEqual(finish(app).textSpans, [{ start: 6, end: 12, bold: true }]);
});

test('formatting toolbar keyboard focus does not turn Space into canvas panning', () => {
  const app = start(), bold = app.document.querySelector('[data-text-format="bold"]');
  bold.focus();
  const space = app.key(' ');
  assert.equal(space.defaultPrevented, false);
  app.key('Escape');
  assert.equal(app.editor.hidden, true);
  assert.equal(app.document.activeElement, app.canvas);
  assert.deepEqual(app.scene(), []);
});

test('composition input respects pending styles and creates a single editor undo entry', () => {
  const app = createApp(); app.tool('text'); app.click(app.canvas, { clientX: 400, clientY: 300 });
  format(app, 'bold');
  app.dispatch(app.editor, 'compositionstart');
  app.editor.textContent = '你'; app.select(1); app.dispatch(app.editor, 'input', { isComposing: true });
  app.editor.textContent = '你好'; app.select(2); app.dispatch(app.editor, 'input', { isComposing: true });
  app.dispatch(app.editor, 'compositionend');
  assert.equal(app.editor.querySelector('strong').textContent, '你好');
  app.key('z', { ctrlKey: true }); assert.equal(app.editor.textContent, '');
  app.key('y', { ctrlKey: true }); assert.equal(app.editor.querySelector('strong').textContent, '你好');
  assert.deepEqual(finish(app).textSpans, [{ start: 0, end: 2, bold: true }]);
});

test('autosave reload, duplication and editable JSON export preserve inline marks and links', async () => {
  const app = start(); app.select(6, 12); format(app, 'bold'); format(app, 'italic'); link(app, 'https://example.com/');
  const saved = finish(app);
  const reloaded = createApp({ savedElements: app.scene() });
  reloaded.dispatch(reloaded.canvas, 'dblclick', { clientX: 420, clientY: 315 });
  assert.equal(reloaded.editor.querySelector('strong em a').textContent, 'styled'); finish(reloaded);
  app.key('d', { ctrlKey: true });
  assert.equal(app.scene().length, 2);
  assert.deepEqual(app.scene()[1].textSpans, saved.textSpans);
  app.key('s', { ctrlKey: true });
  const exported = JSON.parse(await app.downloads.at(-1).text());
  assert.deepEqual(exported.pages[0].elements[0].textSpans, saved.textSpans);
  assert.deepEqual(exported.pages[0].elements[1].textSpans, saved.textSpans);
});

test('image exports use the formatted text renderer and SVG keeps clickable inline links', async t => {
  t.mock.method(globalThis, 'fetch', async path => new Response(readFileSync(new NodeURL(`../public${path}`, import.meta.url))));
  const app = start(); app.select(6, 12);
  for (const property of ['bold', 'italic', 'underline']) format(app, property);
  link(app, 'https://example.com/'); const saved = finish(app);
  app.click(app.get('menu-button')); app.click(app.document.querySelector('[data-action="export"]'));
  await act(async () => {
    app.click(app.document.querySelector('[data-export="svg"]'));
    await fontsForExport([saved]);
  });
  assert.ok(app.downloads.length, app.get('toast').textContent);
  const exported = await app.downloads.at(-1).text();
  const svg = new app.window.DOMParser().parseFromString(exported, 'image/svg+xml');
  assert.ok(svg.querySelector('style').textContent.includes('data:font/woff2;base64,'));
  assert.ok(svg.querySelector('metadata').textContent.includes('SIL OPEN FONT LICENSE'));
  const linked = svg.querySelector('a text');
  assert.equal(linked.textContent, 'styled');
  assert.equal(linked.getAttribute('font-weight'), 'bold');
  assert.equal(linked.getAttribute('font-style'), 'italic');
  assert.equal(linked.getAttribute('text-decoration'), 'underline');
  assert.equal(svg.querySelector('a').getAttribute('href'), 'https://example.com/');
  app.click(app.document.querySelector('[data-export="png"]'));
  const png = app.downloads.at(-1);
  assert.equal(png.type, 'image/png');
  const image = await loadImage(Buffer.from(await png.arrayBuffer()));
  assert.equal(image.width, Math.ceil((saved.width + 48) * 2));
  assert.equal(image.height, Math.ceil((saved.height + 48) * 2));
  const canvas = createCanvas(image.width, image.height), ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
  assert.ok(pixels.some((value, i) => i % 4 === 2 && value > pixels[i - 2] + 50), 'exported link contains blue ink');
});
