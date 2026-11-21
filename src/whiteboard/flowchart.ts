import { bounds, createElement, rotatePoint, sceneBounds } from '../scene';
import { elbowPoints, setConnectorPoints } from '../connectors';
import type { Element, EndpointBinding, Point } from '../types';
import type { Controller } from './controller';
import { snapshot } from './store';

export type FlowchartDirection = 'ArrowUp' | 'ArrowRight' | 'ArrowDown' | 'ArrowLeft';
export interface FlowchartPreview {
  sourceId: string; pageId: string; direction: FlowchartDirection;
  count: number; crossStart: number; elements: Element[];
}
export const isFlowchartDirection = (key: string): key is FlowchartDirection => ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(key);
const isNode = (element: Element) => ['rectangle', 'ellipse', 'diamond'].includes(element.type);
const GAP = 100;

function connectedNodes(source: Element, elements: Element[]) {
  const neighbors = new Map<string, string[]>();
  for (const element of elements) if (element.type === 'arrow' && element.startBinding && element.endBinding) {
    const from = element.startBinding.elementId, to = element.endBinding.elementId;
    neighbors.set(from, [...(neighbors.get(from) ?? []), to]);
    neighbors.set(to, [...(neighbors.get(to) ?? []), from]);
  }
  const ids = new Set([source.id]), queue = [source.id];
  for (let index = 0; index < queue.length; index++) for (const id of neighbors.get(queue[index]) ?? []) {
    if (!ids.has(id)) { ids.add(id); queue.push(id); }
  }
  return elements.filter(element => element.id !== source.id && ids.has(element.id) && isNode(element));
}

function positions(source: Element, direction: FlowchartDirection, count: number, obstacles: Element[], previous?: FlowchartPreview | null) {
  const horizontal = direction === 'ArrowLeft' || direction === 'ArrowRight', positive = direction === 'ArrowRight' || direction === 'ArrowDown';
  const box = bounds(source), size = horizontal ? source.width : source.height, crossSize = horizontal ? source.height : source.width;
  const start = horizontal ? box.x : box.y, end = start + (horizontal ? box.width : box.height);
  const primary = positive ? end + GAP : start - GAP - size;
  const zoneStart = positive ? end : primary - GAP, zoneEnd = positive ? primary + size + GAP : start;
  const occupied = obstacles.map(bounds).filter(box => {
    const p = horizontal ? box.x : box.y;
    return p < zoneEnd - 1e-6 && p + (horizontal ? box.width : box.height) > zoneStart + 1e-6;
  }).map(box => ({ start: (horizontal ? box.y : box.x) - GAP, end: (horizontal ? box.y + box.height : box.x + box.width) + GAP }));
  const total = count * crossSize + (count - 1) * GAP;
  const ideal = (horizontal ? box.y + box.height / 2 : box.x + box.width / 2) - total / 2;
  const free = (start: number) => occupied.every(interval => start + total <= interval.start + 1e-6 || start >= interval.end - 1e-6);
  const nearest = (candidates: number[]) => candidates.filter(free).sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal) || b - a)[0];
  const anchored = previous && nearest([ideal, previous.crossStart, previous.crossStart - crossSize - GAP]);
  const crossStart = anchored ?? nearest([ideal, ...occupied.flatMap(interval => [interval.start - total, interval.end])]);
  return { crossStart, points: Array.from({ length: count }, (_, index) => {
    const cross = crossStart + index * (crossSize + GAP);
    return horizontal ? { x: primary, y: cross } : { x: cross, y: primary };
  }) };
}

function attachment(node: Element, direction: Point): { point: Point; binding: EndpointBinding } {
  const rx = node.width / 2, ry = node.height / 2, center = { x: node.x + rx, y: node.y + ry };
  const local = rotatePoint(direction, { x: 0, y: 0 }, -node.angle);
  const scale = node.type === 'ellipse' ? 1 / Math.hypot(local.x / rx, local.y / ry)
    : node.type === 'diamond' ? 1 / (Math.abs(local.x) / rx + Math.abs(local.y) / ry)
    : Math.min(rx / Math.abs(local.x), ry / Math.abs(local.y));
  const x = local.x * scale, y = local.y * scale;
  return { point: rotatePoint({ x: center.x + x, y: center.y + y }, center, node.angle),
    binding: { elementId: node.id, fixedPoint: [(x + rx) / node.width, (y + ry) / node.height], focus: 0, gap: 0 } };
}

function reveal(a: Controller, elements: Element[]) {
  let box = sceneBounds(elements);
  if (box.width * a.state.zoom > a.width - 80 || box.height * a.state.zoom > a.height - 80) box = bounds(elements[0]);
  const s = a.state;
  for (const axis of ['x', 'y'] as const) {
    const size = axis === 'x' ? box.width : box.height, viewport = axis === 'x' ? a.width : a.height;
    const start = box[axis] * s.zoom + s.pan[axis], end = start + size * s.zoom;
    if (start < 40) s.pan[axis] += 40 - start;
    else if (end > viewport - 40) s.pan[axis] -= end - viewport + 40;
  }
}

export function previewFlowchart(a: Controller, direction: FlowchartDirection) {
  const s = a.state, selected = a.selected(), source = selected[0];
  if (s.tool !== 'selection' || s.gesture || s.space || s.menu || s.contextMenu || selected.length !== 1 || !isNode(source) || a.isLocked(source) || source.width <= 0 || source.height <= 0) return false;
  const previous = s.flowchart?.sourceId === source.id && s.flowchart.pageId === s.activePageId && s.flowchart.direction === direction ? s.flowchart : null;
  const count = previous ? previous.count + 1 : 1;
  const placement = positions(source, direction, count, connectedNodes(source, a.visible()), previous);
  const horizontal = direction === 'ArrowLeft' || direction === 'ArrowRight';
  const vector = { x: direction === 'ArrowLeft' ? -1 : direction === 'ArrowRight' ? 1 : 0, y: direction === 'ArrowUp' ? -1 : direction === 'ArrowDown' ? 1 : 0 };
  const style = { strokeColor: source.strokeColor, backgroundColor: source.backgroundColor, strokeWidth: source.strokeWidth, strokeStyle: source.strokeStyle,
    fillStyle: source.fillStyle, roughness: source.roughness, roundness: snapshot(source.roundness), opacity: source.opacity, fontSize: source.fontSize, fontFamily: source.fontFamily, textAlign: source.textAlign };
  const elements = placement.points.flatMap(point => {
    const node = { ...createElement(source.type, point.x, point.y, style), width: source.width, height: source.height };
    const from = attachment(source, vector), to = attachment(node, { x: -vector.x, y: -vector.y });
    const arrow = { ...createElement('arrow', from.point.x, from.point.y, { ...style, backgroundColor: 'transparent' }), startBinding: from.binding, endBinding: to.binding, startArrowhead: null, endArrowhead: 'arrow', elbowed: true };
    setConnectorPoints(arrow, elbowPoints(from.point, to.point, horizontal));
    return [node, arrow];
  });
  const frame = s.elements.find(element => element.id === source.frameId);
  if (frame && elements.every(element => {
    const box = bounds(element), outer = bounds(frame);
    return box.x <= outer.x + outer.width && box.x + box.width >= outer.x && box.y <= outer.y + outer.height && box.y + box.height >= outer.y;
  })) for (const element of elements) element.frameId = frame.id;
  s.flowchart = { sourceId: source.id, pageId: s.activePageId, direction, count, crossStart: placement.crossStart, elements };
  reveal(a, elements);
  return true;
}

export function finishFlowchart(a: Controller, cancel = false) {
  const s = a.state, preview = s.flowchart;
  if (!preview) return false;
  s.flowchart = null;
  if (cancel || preview.pageId !== s.activePageId || s.selected.size !== 1 || !s.selected.has(preview.sourceId)) return true;
  const source = a.visible().find(element => element.id === preview.sourceId);
  if (!source || a.isLocked(source)) return true;
  s.elements.push(...snapshot(preview.elements));
  s.selected = new Set([preview.elements[0].id]); s.editingGroup = null;
  a.commit();
  return true;
}
