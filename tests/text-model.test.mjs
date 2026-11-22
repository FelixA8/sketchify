import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import * as SketchScene from '../src/scene.ts';
import * as SketchText from '../src/text.ts';
import * as SketchTextEditor from '../src/text-editor.ts';
import { drawElement, measureText } from '../src/whiteboard/canvas.ts';
const { normalizeTextSpans, safeTextLink, createElement, importScene, exportScene } = SketchScene;
const { markRange, replaceRange, rangeMarks, layout, font, linkAt, html, svg } = SketchText;
assert.ok(GlobalFonts.register(readFileSync(new URL('../public/fonts/patrick-hand/PatrickHand-Regular.ttf', import.meta.url)), 'Patrick Hand'));

test('overlapping marks are combined and toggling one style preserves the others', () => {
  const text = 'plain bold italic';
  let spans = markRange(text, [], 6, 17, 'bold', true);
  spans = markRange(text, spans, 11, 17, 'italic', true);
  spans = markRange(text, spans, 11, 17, 'underline', true);
  spans = markRange(text, spans, 11, 17, 'link', 'https://example.com/page#section');
  assert.deepEqual(rangeMarks(text, spans, 11, 17), { bold: true, italic: true, underline: true, link: 'https://example.com/page#section' });
  spans = markRange(text, spans, 13, 15, 'bold', false);
  assert.deepEqual(rangeMarks(text, spans, 13, 15), { italic: true, underline: true, link: 'https://example.com/page#section' });
  assert.equal(rangeMarks(text, spans, 0, 17).bold, undefined);
});

test('insertions and replacements shift formatting while retaining unaffected ranges', () => {
  const original = { text: 'one two three', textSpans: [{ start: 4, end: 7, bold: true }, { start: 8, end: 13, italic: true }] };
  const replaced = replaceRange(original, 4, 7, '2', { bold: true, link: 'https://example.com/' });
  assert.equal(replaced.text, 'one 2 three');
  assert.deepEqual(replaced.textSpans, [{ start: 4, end: 5, bold: true, link: 'https://example.com/' }, { start: 6, end: 11, italic: true }]);
  const deleted = replaceRange(replaced, 3, 6, '');
  assert.equal(deleted.text, 'onethree');
  assert.deepEqual(deleted.textSpans, [{ start: 3, end: 8, italic: true }]);
});

test('import and file round-trip preserve inline text while sanitizing malformed metadata', () => {
  const element = { ...createElement('text', 20, 30), text: '你好 🌏 links', textSpans: [{ start: 0, end: 2, bold: true }, { start: 6, end: 11, italic: true, underline: true, link: 'https://example.com/#part' }] };
  const restored = importScene(exportScene([element])).elements[0];
  for (const key of Object.keys(element)) assert.deepEqual(restored[key], element[key]);
  const imported = importScene({ elements: [{ ...element, textSpans: [null, { start: -3, end: 2, bold: true, unknown: true }, { start: 2, end: 900, italic: true, link: 'javascript:alert(1)' }, { start: 1.5, end: 4, underline: true }] }] }).elements[0];
  assert.deepEqual(imported.textSpans, [{ start: 0, end: 2, bold: true }, { start: 2, end: element.text.length, italic: true }]);
  assert.deepEqual(normalizeTextSpans('text', 'bad'), []);
});

test('links permit web and email URLs and reject executable or malformed targets', () => {
  assert.equal(safeTextLink('example.com/docs#section'), 'https://example.com/docs#section');
  assert.equal(safeTextLink('mailto:hello@example.com'), 'mailto:hello@example.com');
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///etc/passwd', 'https://', 'java\nscript:alert(1)', 'https://example.com/has space']) assert.equal(safeTextLink(url), '');
});

test('layout measures styled font runs, multiline links and trailing blank lines', () => {
  const ctx = createCanvas(800, 300).getContext('2d');
  const element = { ...createElement('text', 10, 20), fontSize: 24, fontFamily: 2, text: 'wide normal\nlinked\n', textSpans: [{ start: 0, end: 4, bold: true }, { start: 12, end: 18, italic: true, link: 'https://example.com/' }] };
  const measured = layout(element, ctx);
  ctx.font = 'bold 24px Arial, sans-serif'; const boldWidth = ctx.measureText('wide').width;
  ctx.font = '24px Arial, sans-serif'; const normalWidth = ctx.measureText(' normal').width;
  assert.ok(Math.abs(measured.width - (boldWidth + normalWidth)) < 0.001);
  assert.equal(measured.height, 90);
  assert.equal(measured.segments[1].x, boldWidth);
  assert.equal(measured.segments[2].y, 30);
  assert.equal(font(element, { bold: true, italic: true }), 'italic bold 24px Arial, sans-serif');
  assert.equal(linkAt(element, { x: 15, y: 55 }, ctx), 'https://example.com/');
  assert.equal(linkAt(element, { x: 15, y: 25 }, ctx), '');
  assert.equal(linkAt(element, { x: 700, y: 55 }, ctx), '');
});

test('text bounds meet the last painted pixel without clipping descenders or underlines', () => {
  for (const fontFamily of [1, 2, 3]) for (const text of ['fdsjlfka\ndsfdsfadf', 'gyp', 'CAPS']) for (const marks of [{}, { bold: true, italic: true }, { underline: true }]) {
    const canvas = createCanvas(1200, 600), ctx = canvas.getContext('2d');
    const element = { ...createElement('text', 10, 10), fontSize: 96, fontFamily, text, textSpans: [{ start: 0, end: text.length, ...marks }] };
    ctx.textBaseline = 'alphabetic';
    measureText(element, ctx);
    assert.equal(ctx.textBaseline, 'alphabetic');
    drawElement(element, ctx, { theme: 'light', background: '#ffffff' });
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let bottom = -1;
    for (let index = pixels.length - 1; index >= 3; index -= 4) if (pixels[index]) { bottom = Math.floor((index - 3) / 4 / canvas.width); break; }
    assert.ok(bottom >= 0);
    assert.ok(Math.abs(element.y + element.height - (bottom + 1)) <= 2, `${fontFamily}: ${text} ${JSON.stringify(marks)}`);
    if (text === 'fdsjlfka\ndsfdsfadf') assert.ok(element.height < 2 * element.fontSize * 1.25);
  }
});
test('fixed-width text wraps words and long graphemes while preserving explicit breaks and marks', () => {
  const ctx = createCanvas(800, 600).getContext('2d');
  const element = { ...createElement('text', 10, 20), fontFamily: 1, fontSize: 24, textWidth: 100, text: 'Sketch ideas\nextraordinary 🧑🏽‍💻\n', textSpans: [{ start: 7, end: 12, bold: true, link: 'https://example.com/' }] };
  const measured = layout(element, ctx);
  assert.equal(measured.width, 100); assert.ok(measured.height > 4 * 24 * 1.25);
  assert.ok(measured.segments.every(run => run.x + run.width <= 100.01));
  assert.equal(measured.segments.map(run => run.text).join(''), element.text.replaceAll('\n', ''));
  assert.ok(measured.segments.some(run => run.text === 'ideas' && run.bold && run.link));
  assert.ok(measured.segments.some(run => run.text.includes('🧑🏽‍💻')));
  assert.equal(measured.contentHeight, measured.height);
  assert.equal(importScene(exportScene([element])).elements[0].textWidth, 100);
  const document = new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">${svg(element, ctx)}</svg>`, { contentType: 'image/svg+xml' }).window.document;
  assert.equal(document.querySelectorAll('text').length, measured.segments.length);
});

test('HTML and SVG export retain combined styles and links while escaping text and attributes', () => {
  const ctx = createCanvas(800, 300).getContext('2d');
  const element = { ...createElement('text', 10, 20), text: 'A < B & "C"', textSpans: [{ start: 0, end: 11, bold: true, italic: true, underline: true, link: 'https://example.com/?a=1&b=2' }] };
  const document = new JSDOM(html(element)).window.document;
  assert.equal(document.body.textContent, element.text);
  assert.equal(document.querySelector('strong em u a').href, 'https://example.com/?a=1&b=2');
  const xml = new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">${svg(element, ctx)}</svg>`, { contentType: 'image/svg+xml' }).window.document;
  const text = xml.querySelector('a text');
  assert.equal(text.textContent, element.text);
  for (const [key, value] of [['font-weight', 'bold'], ['font-style', 'italic'], ['text-decoration', 'underline']]) assert.equal(text.getAttribute(key), value);
  assert.equal(xml.querySelector('a').getAttribute('href'), 'https://example.com/?a=1&b=2');
  assert.doesNotMatch(svg(element, ctx), /NaN|Infinity/);
});

test('native editable DOM blocks, inline style spans and empty lines produce consistent text ranges', () => {
  const document = new JSDOM('<div id="editor"><strong>one</strong><div><span style="font-style:italic">two</span></div><div><br></div></div>').window.document;
  const model = SketchTextEditor.readDOM(document.getElementById('editor'));
  assert.equal(model.text, 'one\ntwo\n');
  assert.deepEqual(model.textSpans, [{ start: 0, end: 3, bold: true }, { start: 4, end: 7, italic: true }]);
});
