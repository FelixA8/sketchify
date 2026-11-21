import { layout } from './text';
import type { Element, TextContext } from './types';

export const NOTE_SIZE = 250;
export const NOTE_MIN_SIZE = 75;
export const NOTE_BACKGROUND = '#ffdf6b';
export const NOTE_INK = '#1b1b1f';
export const NOTE_COLORS = [NOTE_BACKGROUND, '#fcc2d7', '#b2f2bb', '#a5d8ff', '#ffd8a8'] as const;

const PADDING = 16;
const FOOTER = 20;
const MIN_FONT_SIZE = 16;
const positive = (value: number | null | undefined, fallback: number) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;

export function fitStickyNote(text: Element, note: Element, ctx: TextContext) {
  const oldWidth = Math.abs(note.width), oldHeight = Math.abs(note.height);
  const oldX = Math.min(note.x, note.x + note.width), oldY = Math.min(note.y, note.y + note.height);
  const width = Math.max(NOTE_MIN_SIZE, oldWidth);
  const baseHeight = Math.max(NOTE_MIN_SIZE, positive(note.baseHeight, oldHeight || NOTE_SIZE));
  const ceiling = Math.max(MIN_FONT_SIZE, positive(text.baseFontSize, positive(text.fontSize, 32)));
  note.baseHeight = baseHeight;
  text.baseFontSize = ceiling;
  text.textWidth = width - PADDING * 2;
  text.textAlign ??= 'center';
  text.verticalAlign ??= 'middle';
  text.fontSize = ceiling;
  let measured = layout(text, ctx);
  while (text.fontSize > MIN_FONT_SIZE && measured.height > baseHeight - PADDING * 2 - FOOTER) {
    text.fontSize = Math.max(MIN_FONT_SIZE, text.fontSize - 2);
    measured = layout(text, ctx);
  }
  const height = Math.max(baseHeight, measured.height + PADDING * 2 + FOOTER);
  const angle = note.angle, cos = Math.cos(angle), sin = Math.sin(angle);
  const dx = (width - oldWidth) / 2, dy = (height - oldHeight) / 2;
  // Keep the paper's rotated top-left corner fixed while automatic growth moves its lower edge.
  const centerX = oldX + oldWidth / 2 + dx * cos - dy * sin;
  const centerY = oldY + oldHeight / 2 + dx * sin + dy * cos;
  Object.assign(note, { x: centerX - width / 2, y: centerY - height / 2, width, height });
  const bodyHeight = height - PADDING * 2 - FOOTER;
  const bodyCenterY = -FOOTER / 2;
  const alignment = text.verticalAlign === 'top' ? -(bodyHeight - measured.contentHeight) / 2 : text.verticalAlign === 'bottom' ? (bodyHeight - measured.contentHeight) / 2 : 0;
  const offsetY = bodyCenterY + alignment;
  Object.assign(text, {
    x: centerX - offsetY * sin - measured.width / 2,
    y: centerY + offsetY * cos - measured.contentHeight / 2,
    width: measured.width, height: measured.contentHeight, angle,
  });
}

export function notePath(width: number, height: number): string {
  const w = positive(width, NOTE_SIZE), h = positive(height, NOTE_SIZE);
  const curl = Math.min(w, h) * .16, inset = Math.min(4, w * .016);
  return `M${inset} 0H${w}V${h}H${curl}C${curl * .6} ${h} ${inset * 2} ${h - inset} ${inset} ${h - inset * 1.5}C0 ${h - curl * .5} 0 ${h - curl} 0 ${h - curl * 1.25}Z`;
}

export function noteDate(note: Pick<Element, 'created'> & Partial<Pick<Element, 'width'>>, now = Date.now()): string {
  if (typeof note.created !== 'number' || !Number.isFinite(note.created)) return '';
  const created = new Date(note.created), current = new Date(now);
  if (!Number.isFinite(created.getTime()) || !Number.isFinite(current.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', ...(created.getFullYear() !== current.getFullYear() && (note.width === undefined || note.width >= 112) ? { year: 'numeric' } : {}) }).format(created);
}
