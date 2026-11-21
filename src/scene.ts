import type { Style, Element, Point, Box, Marks, TextSpan, ImportResult } from './types';
import { isImageData } from './images';
import { NOTE_SIZE, NOTE_MIN_SIZE, NOTE_BACKGROUND, NOTE_INK } from './notes';
const TOOLS: Element['type'][] = ['selection', 'hand', 'rectangle', 'diamond', 'ellipse', 'arrow', 'line', 'freedraw', 'text', 'stickynote', 'eraser', 'frame', 'image'];
const DEFAULT_STYLE: Style = { strokeColor: '#1b1b1f', backgroundColor: 'transparent', strokeWidth: 2, strokeStyle: 'solid', fillStyle: 'hachure', roughness: 1, roundness: null, opacity: 100, fontSize: 32, fontFamily: 5 };
const STROKE_VARIATION_SEEDS = Object.freeze([17, 142, 741, 2027, 8191]);
const strokeVariations = new Map<Element['type'], { remaining: number[]; previous: number | null }>();
const finite = (value: number | undefined, fallback = 0) => Number.isFinite(value) ? value! : fallback;
const clone = <T>(value: T): T => structuredClone(value);
const uid = () => globalThis.crypto.randomUUID();

function safeTextLink(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const input = value.trim();
  if (/[\u0000-\u0020\u007f]/.test(input)) return '';
  try {
    const url = new URL(/^[\w+.-]+:/.test(input) ? input : `https://${input}`);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function normalizeTextSpans(text: string, spans: unknown = []): TextSpan[] {
  if (!Array.isArray(spans)) return [];
  const valid = spans.filter(s => s && Number.isInteger(s.start) && Number.isInteger(s.end) && s.end > s.start && s.start < text.length && s.end > 0).map(s => ({
    start: Math.max(0, s.start), end: Math.min(text.length, s.end),
    ...(s.bold === true ? { bold: true } : {}), ...(s.italic === true ? { italic: true } : {}),
    ...(s.underline === true ? { underline: true } : {}), ...(safeTextLink(s.link) ? { link: safeTextLink(s.link) } : {}),
  }));
  const edges = [...new Set([0, text.length, ...valid.flatMap(s => [s.start, s.end])])].sort((a, b) => a - b);
  const result: TextSpan[] = [];
  for (let i = 1; i < edges.length; i++) {
    const start = edges[i - 1], end = edges[i], marks: Marks = {};
    for (const span of valid) if (span.start <= start && span.end >= end) {
      for (const key of ['bold', 'italic', 'underline', 'link'] as const) if (span[key]) Object.assign(marks, { [key]: span[key] });
    }
    if (!Object.keys(marks).length) continue;
    const previous = result.at(-1);
    if (previous?.end === start && (['bold', 'italic', 'underline', 'link'] as const).every(key => previous[key] === marks[key])) previous.end = end;
    else result.push({ start, end, ...marks });
  }
  return result;
}

function nextStrokeSeed(type: Element['type']): number {
  let variation = strokeVariations.get(type);
  if (!variation) { variation = { remaining: [], previous: null }; strokeVariations.set(type, variation); }
  if (!variation.remaining.length) {
    variation.remaining = [...STROKE_VARIATION_SEEDS];
    for (let i = variation.remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [variation.remaining[i], variation.remaining[j]] = [variation.remaining[j], variation.remaining[i]];
    }
    if (variation.remaining.at(-1) === variation.previous) {
      [variation.remaining[0], variation.remaining[4]] = [variation.remaining[4], variation.remaining[0]];
    }
  }
  variation.previous = variation.remaining.pop()!;
  return variation.previous;
}

function createElement(type: Element['type'], x: number, y: number, style: Partial<Style> & { seed?: number } = {}): Element {
  const { textAlign, ...properties } = style;
  return { ...DEFAULT_STYLE, ...properties, id: uid(), type, x, y, width: 0, height: 0, angle: 0, roundness: type === 'rectangle' ? clone(style.roundness ?? null) : null, seed: Number.isFinite(style.seed) ? style.seed! : nextStrokeSeed(type), points: [], text: '', ...(type === 'text' ? { textSpans: [], ...(textAlign ? { textAlign } : {}) } : {}), ...(type === 'stickynote' ? { width: NOTE_SIZE, height: NOTE_SIZE, baseHeight: NOTE_SIZE, created: Date.now(), backgroundColor: style.backgroundColor && style.backgroundColor !== 'transparent' ? style.backgroundColor : NOTE_BACKGROUND, strokeColor: style.strokeColor ?? NOTE_INK, fillStyle: 'solid', roughness: 0, textAlign: 'center', verticalAlign: 'middle' } : {}), version: 1, versionNonce: 0, isDeleted: false, groupIds: [], boundElements: null, updated: Date.now() };
}

function unrotatedBounds(element: Element): Box {
  if (['line', 'arrow', 'freedraw'].includes(element.type) && element.points.length) {
    const xs = element.points.map(p => p[0] + element.x);
    const ys = element.points.map(p => p[1] + element.y);
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  }
  return { x: Math.min(element.x, element.x + element.width), y: Math.min(element.y, element.y + element.height), width: Math.abs(element.width), height: Math.abs(element.height) };
}

function rotatePoint(point: Point, center: Point, angle: number): Point {
  const cos = Math.cos(angle), sin = Math.sin(angle), x = point.x - center.x, y = point.y - center.y;
  return { x: center.x + x * cos - y * sin, y: center.y + x * sin + y * cos };
}

function bounds(element: Element): Box {
  const box = unrotatedBounds(element);
  if (!element.angle) return box;
  const cos = Math.abs(Math.cos(element.angle)), sin = Math.abs(Math.sin(element.angle));
  const width = box.width * cos + box.height * sin, height = box.width * sin + box.height * cos;
  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height };
}

function sceneBounds(elements: Element[]): Box {
  if (!elements.length) return { x: 0, y: 0, width: 0, height: 0 };
  const boxes = elements.map(bounds);
  const x = Math.min(...boxes.map(b => b.x));
  const y = Math.min(...boxes.map(b => b.y));
  return { x, y, width: Math.max(...boxes.map(b => b.x + b.width)) - x, height: Math.max(...boxes.map(b => b.y + b.height)) - y };
}

function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = dx || dy ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

function hitTest(element: Element, p: Point, tolerance = 7) {
  const b = unrotatedBounds(element);
  p = rotatePoint(p, { x: b.x + b.width / 2, y: b.y + b.height / 2 }, -element.angle);
  if (['line', 'arrow', 'freedraw'].includes(element.type)) {
    return element.points.some((pt, i, pts) => i > 0 && segmentDistance(p, { x: pts[i - 1][0] + element.x, y: pts[i - 1][1] + element.y }, { x: pt[0] + element.x, y: pt[1] + element.y }) <= tolerance + element.strokeWidth / 2);
  }
  if (p.x < b.x - tolerance || p.x > b.x + b.width + tolerance || p.y < b.y - tolerance || p.y > b.y + b.height + tolerance) return false;
  if (element.type === 'text' || element.type === 'image' || element.type === 'stickynote') return true;
  const filled = element.backgroundColor !== 'transparent';
  if (element.type === 'ellipse') {
    const rx = b.width / 2 || 1, ry = b.height / 2 || 1;
    const distance = Math.sqrt(((p.x - b.x - rx) / rx) ** 2 + ((p.y - b.y - ry) / ry) ** 2);
    return filled ? distance <= 1 + tolerance / Math.min(rx, ry) : Math.abs(distance - 1) <= tolerance / Math.min(rx, ry);
  }
  if (element.type === 'diamond') {
    const vertices = [{ x: b.x + b.width / 2, y: b.y }, { x: b.x + b.width, y: b.y + b.height / 2 }, { x: b.x + b.width / 2, y: b.y + b.height }, { x: b.x, y: b.y + b.height / 2 }];
    return filled && Math.abs((p.x - b.x - b.width / 2) / (b.width / 2 || 1)) + Math.abs((p.y - b.y - b.height / 2) / (b.height / 2 || 1)) <= 1 || vertices.some((v, i) => segmentDistance(p, v, vertices[(i + 1) % 4]) <= tolerance);
  }
  if (element.type === 'rectangle' && element.roundness) {
    const side = Math.min(b.width, b.height);
    const radius = [1, 2].includes(element.roundness.type) ? side / 4 : element.roundness.type === 3 ? Math.min(side / 4, element.roundness.value ?? 32) : 0;
    const cornerX = p.x < b.x + radius ? b.x + radius : p.x > b.x + b.width - radius ? b.x + b.width - radius : null;
    const cornerY = p.y < b.y + radius ? b.y + radius : p.y > b.y + b.height - radius ? b.y + b.height - radius : null;
    if (radius > 0 && cornerX !== null && cornerY !== null) {
      const distance = Math.hypot(p.x - cornerX, p.y - cornerY);
      return filled ? distance <= radius + tolerance : Math.abs(distance - radius) <= tolerance;
    }
  }
  return filled || Math.min(Math.abs(p.x - b.x), Math.abs(p.x - b.x - b.width), Math.abs(p.y - b.y), Math.abs(p.y - b.y - b.height)) <= tolerance;
}

function pointInElementBounds(element: Element, point: Point, tolerance = 0) {
  const b = unrotatedBounds(element), p = rotatePoint(point, { x: b.x + b.width / 2, y: b.y + b.height / 2 }, -element.angle);
  return p.x >= b.x - tolerance && p.x <= b.x + b.width + tolerance && p.y >= b.y - tolerance && p.y <= b.y + b.height + tolerance;
}

function normalizeAngle(angle: number) {
  const result = (angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  return result < 1e-10 || Math.PI * 2 - result < 1e-10 ? 0 : result;
}

function resizeLocalElement(original: Element, target: Box) {
  const old = unrotatedBounds(original);
  const element = clone(original);
  element.x = target.x;
  element.y = target.y;
  element.width = target.width;
  element.height = target.height;
  if (element.type === 'stickynote') { element.width = Math.max(NOTE_MIN_SIZE, target.width); element.height = Math.max(NOTE_MIN_SIZE, target.height); element.baseHeight = element.height; element.fontSize = Math.max(16, original.fontSize * element.width / Math.max(1, old.width)); }
  if (['line', 'arrow', 'freedraw'].includes(element.type)) {
    element.points = original.points.map(([x, y]) => [((x + original.x - old.x) / (old.width || 1)) * target.width, ((y + original.y - old.y) / (old.height || 1)) * target.height]);
  }
  if (element.type === 'text') {
    element.fontSize = Math.max(8, original.fontSize * target.width / (old.width || 1));
    const scale = element.fontSize / original.fontSize;
    element.width = old.width * scale; element.height = old.height * scale;
    if (original.textWidth) element.textWidth = original.textWidth * scale;
  }
  return element;
}

function resizeElement(original: Element, target: Box) {
  if (!original.angle) return resizeLocalElement(original, target);
  const old = bounds(original), local = unrotatedBounds(original);
  const width = local.width * target.width / (old.width || 1), height = local.height * target.height / (old.height || 1);
  return resizeLocalElement(original, { x: target.x + target.width / 2 - width / 2, y: target.y + target.height / 2 - height / 2, width, height });
}

function exportScene(elements: Element[], appState: Record<string, unknown> = {}) {
  const files: Record<string, { id: string; dataURL: string; mimeType: string; created: number }> = {};
  const exported = elements.map(element => {
    let payload = element;
    if (element.type === 'image' && element.imageData) {
      const { imageData, ...image } = element;
      const fileId = element.fileId ?? element.id;
      files[fileId] = { id: fileId, dataURL: imageData, mimeType: imageData.slice(5, imageData.indexOf(';')), created: element.updated };
      payload = { ...image, fileId, status: 'saved' };
    }
    return { ...payload, startArrowhead: null, endArrowhead: element.type === 'arrow' ? 'arrow' : null, textAlign: element.textAlign ?? (['rectangle', 'stickynote'].includes(element.type) ? 'center' : 'left'), verticalAlign: element.verticalAlign ?? (['rectangle', 'stickynote'].includes(element.type) ? 'middle' : 'top'), containerId: element.containerId ?? null, originalText: element.text, lineHeight: 1.25, baseline: element.fontSize, fillStyle: element.fillStyle || 'hachure', strokeSharpness: 'round' };
  });
  return JSON.stringify({ type: 'excalidraw', version: 2, source: 'sketchify-local', elements: exported, appState, files }, null, 2);
}

function importScene(raw: unknown): ImportResult {
  const data = (typeof raw === 'string' ? JSON.parse(raw) : raw) as { elements?: Element[]; appState?: Record<string, unknown>; files?: Record<string, { dataURL?: unknown }> } | null;
  if (!data || !Array.isArray(data.elements)) throw new Error('This file does not contain an Excalidraw scene.');
  let skipped = 0;
  const color = (value: unknown, fallback: string) => typeof value === 'string' && (/^#[\da-f]{3,8}$/i.test(value) || value === 'transparent') ? value : fallback;
  const elements = data.elements.filter(e => !e?.isDeleted).flatMap<Element>(e => {
    if (!e || !TOOLS.includes(e.type) || ['selection', 'hand', 'eraser'].includes(e.type)) { skipped++; return []; }
    const imageData = e.type === 'image' ? e.imageData ?? data.files?.[e.fileId ?? '']?.dataURL : undefined;
    if (e.type === 'image' && !isImageData(imageData)) { skipped++; return []; }
    return [{ ...createElement(e.type, finite(e.x), finite(e.y), { seed: finite(e.seed, 1) }), ...e,
      id: typeof e.id === 'string' && e.id ? e.id : uid(),
      groupIds: [...new Set((Array.isArray(e.groupIds) ? e.groupIds : []).filter((id): id is string => typeof id === 'string' && id.length > 0))],
      x: finite(e.x), y: finite(e.y), width: finite(e.width), height: finite(e.height),
      points: (Array.isArray(e.points) ? e.points : []).filter(p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])),
      strokeColor: color(e.strokeColor, DEFAULT_STYLE.strokeColor), backgroundColor: color(e.backgroundColor, 'transparent'),
      strokeStyle: ['solid', 'dashed', 'dotted'].includes(e.strokeStyle) ? e.strokeStyle : 'solid',
      fillStyle: ['solid', 'hachure', 'cross-hatch'].includes(e.fillStyle) ? e.fillStyle : 'hachure',
      roughness: Math.max(0, Math.min(2, finite(e.roughness, 1))), seed: finite(e.seed, 1),
      opacity: Math.max(0, Math.min(100, finite(e.opacity, 100))), strokeWidth: Math.max(1, Math.min(20, finite(e.strokeWidth, 2))),
      fontSize: Math.max(8, Math.min(500, finite(e.fontSize, 24))), fontFamily: [1, 2, 3, 5].includes(e.fontFamily) ? e.fontFamily : DEFAULT_STYLE.fontFamily,
      text: typeof e.text === 'string' ? e.text : '',
      ...(e.type === 'stickynote' ? { created: typeof e.created === 'number' && Number.isFinite(e.created) && Math.abs(e.created) <= 8.64e15 ? e.created : null, width: Math.max(NOTE_MIN_SIZE, finite(e.width, NOTE_SIZE)), height: Math.max(NOTE_MIN_SIZE, finite(e.height, NOTE_SIZE)), baseHeight: Math.max(NOTE_MIN_SIZE, finite(e.baseHeight, finite(e.height, NOTE_SIZE))), backgroundColor: color(e.backgroundColor, NOTE_BACKGROUND) === 'transparent' ? NOTE_BACKGROUND : color(e.backgroundColor, NOTE_BACKGROUND), fillStyle: 'solid', roughness: 0, textAlign: e.textAlign === 'left' || e.textAlign === 'right' ? e.textAlign : 'center', verticalAlign: e.verticalAlign === 'top' || e.verticalAlign === 'bottom' ? e.verticalAlign : 'middle' } : {}),
      ...(e.type === 'text' && e.baseFontSize != null ? { baseFontSize: Math.max(16, Math.min(500, finite(e.baseFontSize, e.fontSize))) } : {}),
      ...(['text', 'rectangle'].includes(e.type) && e.textAlign !== undefined ? { textAlign: ['center', 'right'].includes(e.textAlign) ? e.textAlign : 'left' as const } : {}),
      ...(['text', 'rectangle'].includes(e.type) && e.verticalAlign !== undefined ? { verticalAlign: ['middle', 'bottom'].includes(e.verticalAlign) ? e.verticalAlign : 'top' as const } : {}),
      ...(e.link !== undefined ? { link: safeTextLink(e.link) || null } : {}),
      ...(e.locked !== undefined ? { locked: e.locked === true } : {}),
      ...(e.type === 'image' ? { imageData: imageData as string, status: 'saved' as const, scale: [e.scale?.[0] === -1 ? -1 : 1, e.scale?.[1] === -1 ? -1 : 1] as [number, number] } : {}),
      ...(e.type === 'text' && e.textWidth !== undefined ? { textWidth: typeof e.textWidth === 'number' && Number.isFinite(e.textWidth) && e.textWidth > 0 ? Math.max(8, Math.min(10000, e.textWidth)) : undefined } : {}),
      ...(e.type === 'text' ? { textSpans: normalizeTextSpans(typeof e.text === 'string' ? e.text : '', e.textSpans) } : {}), angle: finite(e.angle) }];
  });
  const ids = new Set();
  for (const element of elements) { if (ids.has(element.id)) element.id = uid(); ids.add(element.id); }
  for (const note of elements.filter(element => element.type === 'stickynote')) {
    const label = elements.find(element => element.type === 'text' && element.containerId === note.id);
    if (label) {
      note.fontSize = label.baseFontSize ?? label.fontSize; note.fontFamily = label.fontFamily;
      label.baseFontSize = note.fontSize; label.strokeColor = note.strokeColor;
    }
  }
  for (const element of elements) if (['line', 'arrow'].includes(element.type)) {
    for (const key of ['startBinding', 'endBinding'] as const) {
      const binding = element[key]; if (binding === undefined) continue;
      const target = elements.find(target => target.id === binding?.elementId);
      if (!binding || !target || !(['rectangle', 'ellipse', 'diamond', 'stickynote'].includes(target.type) || target.type === 'text' && !target.containerId)) { element[key] = null; continue; }
      const fixed = binding.fixedPoint;
      element[key] = { elementId: target.id, focus: finite(binding.focus), gap: Math.max(0, finite(binding.gap)),
        ...(Array.isArray(fixed) && fixed.length === 2 && fixed.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1) ? { fixedPoint: [fixed[0], fixed[1]] as [number, number] } : {}) };
    }
  }
  return { elements, skipped, appState: data.appState || {} };
}

class History<T = Element[]> {
  entries: T[];
  index: number;
  constructor(elements: T = [] as unknown as T) { this.entries = [clone(elements)]; this.index = 0; }
  commit(elements: T) {
    if (JSON.stringify(elements) === JSON.stringify(this.entries[this.index])) return;
    this.entries.splice(this.index + 1);
    this.entries.push(clone(elements));
    if (this.entries.length > 100) this.entries.shift();
    this.index = this.entries.length - 1;
  }
  undo() { this.index = Math.max(0, this.index - 1); return clone(this.entries[this.index]); }
  redo() { this.index = Math.min(this.entries.length - 1, this.index + 1); return clone(this.entries[this.index]); }
  get canUndo() { return this.index > 0; }
  get canRedo() { return this.index < this.entries.length - 1; }
}
export { TOOLS, DEFAULT_STYLE, STROKE_VARIATION_SEEDS, clone, uid, createElement, bounds, unrotatedBounds, rotatePoint, normalizeAngle, pointInElementBounds, sceneBounds, segmentDistance, hitTest, resizeElement, resizeLocalElement, exportScene, importScene, History, safeTextLink, normalizeTextSpans };
