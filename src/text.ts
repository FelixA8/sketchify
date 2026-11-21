import type { Element, Marks, Mark, TextSpan, TextModel, TextContext, Point } from './types';
import { normalizeTextSpans, safeTextLink, unrotatedBounds, rotatePoint } from './scene';
import { fontFamily } from './fonts';
const keys: Mark[] = ['bold', 'italic', 'underline', 'link'];
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
const marksOnly = (value?: Marks): Marks => Object.fromEntries(keys.filter(key => value?.[key]).map(key => [key, value![key]]));
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

function runs(text: string, spans?: TextSpan[]) {
  const result: (TextSpan & { text: string })[] = [], normalized = normalizeTextSpans(text, spans);
  let offset = 0;
  for (const span of normalized) {
    if (span.start > offset) result.push({ start: offset, end: span.start, text: text.slice(offset, span.start) });
    result.push({ ...span, text: text.slice(span.start, span.end) });
    offset = span.end;
  }
  if (offset < text.length) result.push({ start: offset, end: text.length, text: text.slice(offset) });
  return result;
}

function markRange(text: string, spans: TextSpan[] | undefined, start: number, end: number, property: Mark, value: string | boolean | undefined) {
  if (!keys.includes(property)) return normalizeTextSpans(text, spans);
  start = Math.max(0, Math.min(text.length, start)); end = Math.max(start, Math.min(text.length, end));
  if (property === 'link') value = safeTextLink(value);
  const result = [];
  for (const run of runs(text, spans)) {
    const edges = [...new Set([run.start, run.end, Math.max(run.start, Math.min(run.end, start)), Math.max(run.start, Math.min(run.end, end))])].sort((a, b) => a - b);
    for (let i = 1; i < edges.length; i++) {
      const from = edges[i - 1], to = edges[i], marks = marksOnly(run);
      if (from >= start && to <= end) { if (value) Object.assign(marks, { [property]: value }); else delete marks[property]; }
      result.push({ start: from, end: to, ...marks });
    }
  }
  return normalizeTextSpans(text, result);
}

function rangeMarks(text: string, spans: TextSpan[] | undefined, start: number, end = start): Marks {
  if (start === end) {
    const point = start > 0 ? start - 1 : 0;
    return marksOnly(runs(text, spans).find(run => run.start <= point && run.end > point));
  }
  const selected = runs(text, spans).filter(run => run.end > start && run.start < end);
  return Object.fromEntries(keys.filter(key => selected.length && selected[0][key] && selected.every(run => run[key] === selected[0][key])).map(key => [key, selected[0][key]]));
}

function replaceRange(model: TextModel, start: number, end: number, inserted: string, marks = rangeMarks(model.text, model.textSpans, start)) {
  const text = model.text.slice(0, start) + inserted + model.text.slice(end), shift = inserted.length - (end - start);
  const spans = [];
  for (const span of normalizeTextSpans(model.text, model.textSpans)) {
    if (span.start < start) spans.push({ ...span, end: Math.min(start, span.end) });
    if (span.end > end) spans.push({ ...span, start: Math.max(end, span.start) + shift, end: span.end + shift });
  }
  if (inserted.length) spans.push({ start, end: start + inserted.length, ...marksOnly(marks) });
  return { text, textSpans: normalizeTextSpans(text, spans) };
}

function html(model: TextModel) {
  return runs(model.text, model.textSpans).map(run => {
    let content = escape(run.text);
    if (run.link) content = `<a href="${escape(run.link)}" target="_blank" rel="noopener noreferrer">${content}</a>`;
    if (run.underline) content = `<u>${content}</u>`;
    if (run.italic) content = `<em>${content}</em>`;
    if (run.bold) content = `<strong>${content}</strong>`;
    return content;
  }).join('');
}

function font(element: Pick<Element, 'fontSize' | 'fontFamily'>, marks: Marks = {}) {
  return `${marks.italic ? 'italic ' : ''}${marks.bold ? 'bold ' : ''}${element.fontSize}px ${fontFamily(element.fontFamily)}`;
}

function layout(element: Element, ctx: TextContext) {
  const segments = [];
  const baseline = ctx.textBaseline;
  ctx.textBaseline = 'top';
  const styled = runs(element.text, element.textSpans);
  const rangeWidth = (start: number, end: number) => styled.reduce((width, run) => {
    const from = Math.max(start, run.start), to = Math.min(end, run.end);
    if (from >= to) return width;
    ctx.font = font(element, run); return width + ctx.measureText(element.text.slice(from, to)).width;
  }, 0);
  const lines: { start: number; end: number }[] = [];
  let offset = 0;
  for (const paragraph of element.text.split('\n')) {
    let start = offset;
    if (element.textWidth) {
      for (const token of paragraph.matchAll(/\s+|[^\s/-]+[/-]*|[/-]+/gu)) {
        if (/^\s/u.test(token[0])) continue;
        const from = offset + token.index, end = from + token[0].length;
        if (rangeWidth(start, end) <= element.textWidth) continue;
        if (from > start) { lines.push({ start, end: from }); start = from; }
        let previous = from;
        for (const { segment, index } of graphemes.segment(token[0])) {
          const next = from + index + segment.length;
          if (previous > start && rangeWidth(start, next) > element.textWidth) {
            lines.push({ start, end: previous }); start = previous;
          }
          previous = next;
        }
      }
    }
    lines.push({ start, end: offset + paragraph.length }); offset += paragraph.length + 1;
  }
  const width = element.textWidth || Math.max(0, ...lines.map(range => rangeWidth(range.start, range.end)));
  let contentHeight = 0;
  for (const [line, range] of lines.entries()) {
    const visibleEnd = range.start + element.text.slice(range.start, range.end).trimEnd().length;
    const alignedWidth = rangeWidth(range.start, visibleEnd);
    let x = element.textAlign === 'center' ? (width - alignedWidth) / 2 : element.textAlign === 'right' ? width - alignedWidth : 0;
    for (const run of styled) {
      const start = Math.max(run.start, range.start), end = Math.min(run.end, range.end);
      if (start >= end) continue;
      const text = element.text.slice(start, end);
      ctx.font = font(element, run);
      const measured = ctx.measureText(text), y = line * element.fontSize * 1.25;
      segments.push({ ...marksOnly(run), text, x, y, width: measured.width });
      contentHeight = Math.max(contentHeight, y + measured.actualBoundingBoxDescent);
      if (run.underline || run.link) contentHeight = Math.max(contentHeight, y + element.fontSize * 1.05 + Math.max(1, element.fontSize / 16) / 2);
      x += measured.width;
    }
  }
  ctx.textBaseline = baseline;
  const height = lines.length * element.fontSize * 1.25;
  return { segments, width, height, contentHeight: !element.text || element.text.endsWith('\n') ? height : contentHeight };
}

function linkAt(element: Element, point: Point, ctx: TextContext) {
  const b = unrotatedBounds(element); point = rotatePoint(point, { x: b.x + b.width / 2, y: b.y + b.height / 2 }, -element.angle);
  return layout(element, ctx).segments.find(run => run.link && point.x >= element.x + run.x && point.x <= element.x + run.x + run.width && point.y >= element.y + run.y && point.y < element.y + run.y + element.fontSize * 1.25)?.link || '';
}

function svg(element: Element, ctx: TextContext, dark = false) {
  const content = layout(element, ctx).segments.map(run => {
    const family = fontFamily(element.fontFamily).replaceAll('"', '').replace(', ', ',');
    const color = run.link ? dark ? '#74c0fc' : '#1971c2' : dark && ['#1b1b1f', '#1e1e1e', '#000000'].includes(element.strokeColor) ? '#eeeeef' : element.strokeColor;
    const content = `<text x="${element.x + run.x}" y="${element.y + run.y}" xml:space="preserve" fill="${escape(color)}" font-size="${element.fontSize}" font-family="${family}" font-weight="${run.bold ? 'bold' : 'normal'}" font-style="${run.italic ? 'italic' : 'normal'}" text-decoration="${run.underline || run.link ? 'underline' : 'none'}" opacity="${element.opacity / 100}" dominant-baseline="text-before-edge">${escape(run.text)}</text>`;
    return run.link ? `<a href="${escape(run.link)}" target="_blank" rel="noopener noreferrer">${content}</a>` : content;
  }).join('');
  const b = unrotatedBounds(element);
  return element.angle ? `<g transform="rotate(${element.angle * 180 / Math.PI} ${b.x + b.width / 2} ${b.y + b.height / 2})">${content}</g>` : content;
}

export { runs, markRange, rangeMarks, replaceRange, html, font, layout, linkAt, svg };
