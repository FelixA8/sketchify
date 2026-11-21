import { bounds, rotatePoint, segmentDistance, unrotatedBounds } from './scene';
import type { Element, EndpointBinding, Point } from './types';

export const isConnector = (element: Element) => element.type === 'line' || element.type === 'arrow';
const isTarget = (element: Element) => ['rectangle', 'ellipse', 'diamond', 'stickynote'].includes(element.type) || element.type === 'text' && !element.containerId;
export const bindingKeys = ['startBinding', 'endBinding'] as const;

export function elbowPoints(start: Point, end: Point, horizontal: boolean): Point[] {
  if (Math.abs(start.x - end.x) < 1e-8 || Math.abs(start.y - end.y) < 1e-8) return [start, end];
  return horizontal
    ? [start, { x: (start.x + end.x) / 2, y: start.y }, { x: (start.x + end.x) / 2, y: end.y }, end]
    : [start, { x: start.x, y: (start.y + end.y) / 2 }, { x: end.x, y: (start.y + end.y) / 2 }, end];
}

export function connectorPoints(element: Element): Point[] {
  const box = unrotatedBounds(element), center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  return element.points.map(([x, y]) => rotatePoint({ x: element.x + x, y: element.y + y }, center, element.angle));
}

export function setConnectorPoints(element: Element, points: Point[]) {
  if (points.length < 2) return;
  // Keep the stored angle while rebasing the changed path around its new center.
  const local = points.map(point => rotatePoint(point, { x: 0, y: 0 }, -element.angle));
  const center = { x: (Math.min(...local.map(p => p.x)) + Math.max(...local.map(p => p.x))) / 2, y: (Math.min(...local.map(p => p.y)) + Math.max(...local.map(p => p.y))) / 2 };
  const worldCenter = rotatePoint(center, { x: 0, y: 0 }, element.angle);
  const origin = { x: worldCenter.x + local[0].x - center.x, y: worldCenter.y + local[0].y - center.y };
  element.x = origin.x; element.y = origin.y;
  element.points = local.map(point => [point.x - local[0].x, point.y - local[0].y]);
  element.width = Math.max(...local.map(p => p.x)) - Math.min(...local.map(p => p.x));
  element.height = Math.max(...local.map(p => p.y)) - Math.min(...local.map(p => p.y));
}

function edgePoint(target: Element, point: Point): Point {
  const box = unrotatedBounds(target), rx = box.width / 2, ry = box.height / 2;
  const center = { x: box.x + rx, y: box.y + ry }, p = rotatePoint(point, center, -target.angle);
  if (!rx || !ry) return center;
  if (target.type === 'ellipse') {
    // Minimize distance to the ellipse, including elongated ellipses and interior points.
    let angle = 0, distance = Infinity;
    for (let i = 0; i < 64; i++) {
      const t = i * Math.PI / 32, d = Math.hypot(center.x + rx * Math.cos(t) - p.x, center.y + ry * Math.sin(t) - p.y);
      if (d < distance) { angle = t; distance = d; }
    }
    let low = angle - Math.PI / 32, high = angle + Math.PI / 32;
    const score = (t: number) => (center.x + rx * Math.cos(t) - p.x) ** 2 + (center.y + ry * Math.sin(t) - p.y) ** 2;
    for (let i = 0; i < 48; i++) {
      const a = low + (high - low) / 3, b = high - (high - low) / 3;
      if (score(a) < score(b)) high = b; else low = a;
    }
    const refined = (low + high) / 2, t = score(angle) <= score(refined) ? angle : refined;
    return rotatePoint({ x: center.x + rx * Math.cos(t), y: center.y + ry * Math.sin(t) }, center, target.angle);
  }
  if (target.type === 'rectangle' && target.roundness) {
    const side = Math.min(box.width, box.height), radius = [1, 2].includes(target.roundness.type) ? side / 4 : target.roundness.type === 3 ? Math.max(0, Math.min(side / 4, target.roundness.value ?? 32)) : 0;
    const q = { x: Math.max(box.x + radius, Math.min(box.x + box.width - radius, p.x)), y: Math.max(box.y + radius, Math.min(box.y + box.height - radius, p.y)) };
    const length = Math.hypot(p.x - q.x, p.y - q.y);
    if (radius && length) return rotatePoint({ x: q.x + (p.x - q.x) * radius / length, y: q.y + (p.y - q.y) * radius / length }, center, target.angle);
  }
  const vertices = target.type === 'diamond'
    ? [{ x: center.x, y: box.y }, { x: box.x + box.width, y: center.y }, { x: center.x, y: box.y + box.height }, { x: box.x, y: center.y }]
    : [{ x: box.x, y: box.y }, { x: box.x + box.width, y: box.y }, { x: box.x + box.width, y: box.y + box.height }, { x: box.x, y: box.y + box.height }];
  let nearest = vertices[0], distance = Infinity;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length], dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    const d = segmentDistance(p, a, b);
    if (d < distance) { nearest = { x: a.x + dx * t, y: a.y + dy * t }; distance = d; }
  }
  return rotatePoint(nearest, center, target.angle);
}

export function snapEndpoint(elements: Element[], point: Point, zoom = 1) {
  const snapDistance = 14 / zoom;
  let result: { point: Point; binding: EndpointBinding; hint: 'center' | 'midpoint' | null } | null = null, distance = snapDistance;
  for (const target of [...elements].reverse()) {
    if (!isTarget(target) || target.isDeleted) continue;
    const outer = bounds(target);
    if (point.x < outer.x - distance || point.x > outer.x + outer.width + distance || point.y < outer.y - distance || point.y > outer.y + outer.height + distance) continue;
    const box = unrotatedBounds(target), center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const sides: [number, number][] = target.type === 'diamond'
      ? [[.25, .25], [.75, .25], [.75, .75], [.25, .75]]
      : [[.5, 0], [1, .5], [.5, 1], [0, .5]];
    const anchors: [number, number][] = [[.5, .5], ...sides];
    let candidate: { point: Point; fixedPoint: [number, number]; distance: number; hint: 'center' | 'midpoint' } | null = null;
    for (const [index, fixedPoint] of anchors.entries()) {
      const anchor = rotatePoint({ x: box.x + fixedPoint[0] * box.width, y: box.y + fixedPoint[1] * box.height }, center, target.angle);
      const d = Math.hypot(anchor.x - point.x, anchor.y - point.y);
      if (d <= snapDistance && (!candidate || d < candidate.distance)) candidate = { point: anchor, fixedPoint, distance: d, hint: index === 0 ? 'center' : 'midpoint' };
    }
    const anchor = candidate?.point ?? edgePoint(target, point), d = Math.hypot(anchor.x - point.x, anchor.y - point.y);
    if (d > distance) continue;
    if (result && Math.abs(d - distance) < 1e-7) continue;
    const local = rotatePoint(anchor, center, -target.angle);
    result = { point: anchor, binding: { elementId: target.id, fixedPoint: candidate?.fixedPoint ?? [Math.max(0, Math.min(1, (local.x - box.x) / (box.width || 1))), Math.max(0, Math.min(1, (local.y - box.y) / (box.height || 1)))], focus: 0, gap: 0 }, hint: candidate?.hint ?? null };
    distance = d;
  }
  return result;
}

export function bindEndpoint(element: Element, end: 'startBinding' | 'endBinding', point: Point, elements: Element[], zoom = 1) {
  const snapped = snapEndpoint(elements, point, zoom), points = connectorPoints(element);
  if (snapped || element[end] !== undefined) element[end] = snapped?.binding ?? null;
  const index = end === 'startBinding' ? 0 : points.length - 1, next = snapped?.point ?? point;
  if (Math.hypot(points[index].x - next.x, points[index].y - next.y) > 1e-8) {
    points[index] = next; setConnectorPoints(element, points);
  }
  return snapped;
}

export function syncConnectors(elements: Element[]) {
  const byId = new Map(elements.map(element => [element.id, element]));
  const references = new Map<string, { id: string; type: string }[]>();
  for (const element of elements) {
    if (!isConnector(element) || element.points.length < 2) continue;
    const points = connectorPoints(element); let changed = false;
    for (const key of bindingKeys) {
      const binding = element[key]; if (!binding) continue;
      const target = byId.get(binding.elementId);
      if (!target || !isTarget(target)) { element[key] = null; continue; }
      const index = key === 'startBinding' ? 0 : points.length - 1;
      const box = unrotatedBounds(target), center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      if (!binding.fixedPoint) {
        const edge = rotatePoint(edgePoint(target, points[index]), center, -target.angle);
        binding.fixedPoint = [(edge.x - box.x) / (box.width || 1), (edge.y - box.y) / (box.height || 1)];
      }
      let point = rotatePoint({ x: box.x + binding.fixedPoint[0] * box.width, y: box.y + binding.fixedPoint[1] * box.height }, center, target.angle);
      if (target.type === 'rectangle' && target.roundness && !binding.fixedPoint.every(value => value === .5)) point = edgePoint(target, point);
      if (Math.hypot(point.x - points[index].x, point.y - points[index].y) > 1e-8) { points[index] = point; changed = true; }
      const refs = references.get(target.id) ?? [];
      if (!refs.some(ref => ref.id === element.id)) refs.push({ id: element.id, type: element.type });
      references.set(target.id, refs);
    }
    if (changed) {
      const horizontal = Math.abs(element.points[1][0] - element.points[0][0]) > Math.abs(element.points[1][1] - element.points[0][1]);
      setConnectorPoints(element, element.elbowed && !element.angle ? elbowPoints(points[0], points.at(-1)!, horizontal) : points);
    }
  }
  for (const target of elements) if (isTarget(target)) {
    const other = Array.isArray(target.boundElements) ? target.boundElements.filter(ref => ref && !['arrow', 'line'].includes(ref.type)) : [];
    const refs = [...other, ...(references.get(target.id) ?? [])];
    if (JSON.stringify(target.boundElements ?? []) !== JSON.stringify(refs)) target.boundElements = refs.length ? refs : null;
  }
}
