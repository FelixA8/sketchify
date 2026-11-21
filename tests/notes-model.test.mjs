import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas, Path2D } from '@napi-rs/canvas';
import { createElement, rotatePoint } from '../src/scene.ts';
import { layout } from '../src/text.ts';
import { fitStickyNote, noteDate, notePath, NOTE_SIZE, NOTE_MIN_SIZE } from '../src/notes.ts';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < .0001, `${actual} should equal ${expected}`);
const context = () => createCanvas(1, 1).getContext('2d');
const elements = (content, overrides = {}) => ({
  note: { ...createElement('stickynote', 100, 150), width: NOTE_SIZE, height: NOTE_SIZE, baseHeight: NOTE_SIZE, ...overrides },
  text: { ...createElement('text', 0, 0), text: content, textAlign: 'center', verticalAlign: 'middle', fontSize: 32, baseFontSize: 32 },
});
const topLeft = note => rotatePoint({ x: note.x, y: note.y }, { x: note.x + note.width / 2, y: note.y + note.height / 2 }, note.angle);

test('sticky-note text wraps inside the paper and leaves its date footer free', () => {
  const { note, text } = elements('Hi, this is a note');
  const ctx = context(); fitStickyNote(text, note, ctx);
  const measured = layout(text, ctx);
  assert.equal(note.height, NOTE_SIZE);
  assert.equal(text.textWidth, NOTE_SIZE - 32);
  close(text.x + text.width / 2, note.x + note.width / 2);
  close(text.y + text.height / 2, note.y + (note.height - 20) / 2);
  assert.ok(text.y >= note.y + 16);
  assert.ok(text.y + measured.height <= note.y + note.height - 16 - 20);
});

test('text shrinks to 16px before growing paper and restores its font and base height after shortening', () => {
  const { note, text } = elements('A long line of notes that needs wrapping.\n'.repeat(35));
  const ctx = context(); fitStickyNote(text, note, ctx);
  assert.equal(text.fontSize, 16);
  assert.equal(text.baseFontSize, 32);
  assert.ok(note.height > NOTE_SIZE);
  assert.equal(note.baseHeight, NOTE_SIZE);
  assert.ok(layout(text, ctx).height <= note.height - 52);
  text.text = 'Short'; fitStickyNote(text, note, ctx);
  assert.equal(note.height, NOTE_SIZE);
  assert.equal(text.fontSize, 32);
  close(note.x, 100); close(note.y, 150);
});

test('shrinking content chooses the largest allowed fitting font without needless paper growth', () => {
  const { note, text } = elements('A line\n'.repeat(5));
  const ctx = context(); fitStickyNote(text, note, ctx);
  assert.ok(text.fontSize >= 16 && text.fontSize < 32);
  assert.equal(note.height, NOTE_SIZE);
  assert.ok(layout(text, ctx).height <= note.height - 52);
  assert.ok(layout({ ...text, fontSize: text.fontSize + 2 }, ctx).height > note.height - 52);
});

for (const angle of [Math.PI / 6, Math.PI / 2, Math.PI * 1.3]) test(`automatic growth preserves the rotated paper anchor at ${angle}`, () => {
  const { note, text } = elements('Rotated note\n'.repeat(30), { angle });
  const original = topLeft(note), ctx = context();
  fitStickyNote(text, note, ctx);
  close(topLeft(note).x, original.x); close(topLeft(note).y, original.y);
  assert.equal(text.angle, angle);
  const noteCenter = { x: note.x + note.width / 2, y: note.y + note.height / 2 };
  const textCenter = rotatePoint({ x: text.x + text.width / 2, y: text.y + text.height / 2 }, noteCenter, -angle);
  close(textCenter.x, noteCenter.x); close(textCenter.y, noteCenter.y - 10);
  text.text = 'Short'; fitStickyNote(text, note, ctx);
  close(topLeft(note).x, original.x); close(topLeft(note).y, original.y);
  close(note.x, 100); close(note.y, 150);
});

test('minimum-sized notes remain finite and text never shrinks below 16px', () => {
  const { note, text } = elements('This is readable', { width: 10, height: 10, baseHeight: 10 });
  text.fontSize = 8; text.baseFontSize = 8;
  fitStickyNote(text, note, context());
  assert.equal(note.width, NOTE_MIN_SIZE);
  assert.ok(note.height >= NOTE_MIN_SIZE);
  assert.equal(text.fontSize, 16);
  for (const value of [note.x, note.y, text.x, text.y, text.width, text.height]) assert.ok(Number.isFinite(value));
});

test('date is creation-based, omits the current year and includes other years', () => {
  const created = new Date(2026, 10, 21, 12).getTime();
  assert.equal(noteDate({ created }, new Date(2026, 11, 1, 12).getTime()), '21 Nov');
  assert.equal(noteDate({ created }, new Date(2027, 0, 1, 12).getTime()), '21 Nov 2026');
  assert.equal(noteDate({ created, width: NOTE_MIN_SIZE }, new Date(2027, 0, 1, 12).getTime()), '21 Nov');
  assert.equal(noteDate({ created, width: 112 }, new Date(2027, 0, 1, 12).getTime()), '21 Nov 2026');
  for (const value of [undefined, null, NaN, Infinity, 9e20]) assert.equal(noteDate({ created: value }), '');
});

test('paper path fills the note, curls the lower left edge and scales to minimum dimensions', () => {
  for (const size of [NOTE_MIN_SIZE, NOTE_SIZE]) {
    const canvas = createCanvas(size, size), ctx = canvas.getContext('2d');
    ctx.fill(new Path2D(notePath(size, size)));
    const alpha = (x, y) => ctx.getImageData(x, y, 1, 1).data[3];
    assert.equal(alpha(Math.floor(size / 2), Math.floor(size / 2)), 255);
    assert.equal(alpha(size - 2, size - 2), 255);
    assert.equal(alpha(0, size - 1), 0);
    assert.ok(alpha(Math.floor(size / 2), size - 2) > 0);
  }
});
