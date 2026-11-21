import { sceneBounds, unrotatedBounds, rotatePoint } from '../scene';
import { font, layout } from '../text';
import { renderPaths } from '../strokes';
import type { Box, Element, Point } from '../types';
import type { State, Store } from './store';
import { imageRecord, subscribeImages } from '../images';
import { bindingKeys, connectorPoints, isConnector } from '../connectors';
import { selectionGroup } from './groups';
import { layerModel, visibleElements } from './layers';
import { noteDate } from '../notes';
export const selectedElements = (state: State) => visibleElements(state.elements, state.layers).filter(e => state.selected.has(e.id));
export const screenToWorld = (state: State, x: number, y: number): Point => ({ x: (x - state.pan.x) / state.zoom, y: (y - state.pan.y) / state.zoom });
export const ink = (state: State, color: string) => state.theme === 'dark' && ['#1b1b1f', '#1e1e1e', '#000000'].includes(color) ? '#eeeeef' : color;
export function handleLocations(box: Box, text = false, note = false) {
  return [{ key: 'nw', x: box.x, y: box.y }, { key: 'ne', x: box.x + box.width, y: box.y }, { key: 'se', x: box.x + box.width, y: box.y + box.height }, { key: 'sw', x: box.x, y: box.y + box.height }, ...(text || note ? [{ key: 'w', x: box.x, y: box.y + box.height / 2 }, { key: 'e', x: box.x + box.width, y: box.y + box.height / 2 }] : []), ...(note ? [{ key: 'n', x: box.x + box.width / 2, y: box.y }, { key: 's', x: box.x + box.width / 2, y: box.y + box.height }] : [])];
}
export function pickHandle(state: State, p: Point) {
  const selected = selectedElements(state);
  return selected.length && !selected.some(element => layerModel(state.elements, state.layers).locked.has(element.id)) ? selectionHandles(state)
    .map(handle => ({ handle, distance: Math.hypot(handle.x - p.x, handle.y - p.y) }))
    .filter(candidate => candidate.distance < 9 / state.zoom).sort((a, b) => a.distance - b.distance || Number(b.handle.key.endsWith('Binding')) - Number(a.handle.key.endsWith('Binding')))[0]?.handle : undefined;
}
export function selectionHandles(state: State) {
  const selected = selectedElements(state);
  if (!selected.length) return [];
  const { box: b, angle } = selectionGeometry(state), center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const primary = selected.filter(element => !element.containerId || !state.selected.has(element.containerId));
  const handles = [...handleLocations(b, selected.length === 1 && selected[0].type === 'text', primary.length === 1 && primary[0].type === 'stickynote'), { key: 'rotate', x: center.x, y: b.y - 32 / state.zoom }].map(handle => ({ ...handle, ...rotatePoint(handle, center, angle) }));
  if (selected.length === 1 && isConnector(selected[0])) {
    const points = connectorPoints(selected[0]);
    if (points.length > 1) handles.push({ key: 'startBinding', ...points[0] }, { key: 'endBinding', ...points.at(-1)! });
  }
  return handles;
}
export function selectionGeometry(state: State) {
  const all = selectedElements(state), selected = all.filter(element => !element.containerId || !state.selected.has(element.containerId) || !all.some(parent => parent.id === element.containerId && parent.type === 'stickynote'));
  if (selected.length === 1) return { box: unrotatedBounds(selected[0]), angle: selected[0].angle };
  if (state.gesture?.kind === 'rotate') return { box: state.gesture.box, angle: state.gesture.delta };
  return { box: sceneBounds(selected), angle: 0 };
}
function drawSelectionBox(ctx: CanvasRenderingContext2D, box: Box, angle: number, pad: number) {
  ctx.save();
  if (angle) { ctx.translate(box.x + box.width / 2, box.y + box.height / 2); ctx.rotate(angle); ctx.translate(-box.x - box.width / 2, -box.y - box.height / 2); }
  ctx.setLineDash([]); ctx.strokeRect(box.x - pad, box.y - pad, box.width + pad * 2, box.height + pad * 2); ctx.restore();
}
function individualSelectionBoxes(state: State, selected: Element[]) {
  const groups = new Set<string>(), boxes: { box: Box; angle: number; pad: number }[] = [];
  for (const element of selected) {
    if (element.containerId && state.selected.has(element.containerId) || element.frameId && state.selected.has(element.frameId)) continue;
    const group = selectionGroup(element, state.editingGroup);
    if (group) {
      if (groups.has(group)) continue;
      groups.add(group);
      boxes.push({ box: sceneBounds(selected.filter(member => member.groupIds.includes(group))), angle: 0, pad: 5 / state.zoom });
    } else boxes.push({ box: unrotatedBounds(element), angle: element.angle, pad: ['image', 'text'].includes(element.type) ? 0 : 5 / state.zoom });
  }
  return boxes;
}
export function measureText(element: Element, ctx: CanvasRenderingContext2D) {
  const measured = layout(element, ctx);
  if (element.angle && (element.width !== measured.width || element.height !== measured.contentHeight)) {
    const old = unrotatedBounds(element), center = { x: old.x + old.width / 2, y: old.y + old.height / 2 };
    const anchor = rotatePoint({ x: old.x, y: old.y }, center, element.angle);
    const offset = rotatePoint({ x: -measured.width / 2, y: -measured.contentHeight / 2 }, { x: 0, y: 0 }, element.angle);
    element.x = anchor.x - offset.x - measured.width / 2; element.y = anchor.y - offset.y - measured.contentHeight / 2;
  }
  element.width = measured.width; element.height = measured.contentHeight;
}
export function drawElement(element: Element, target: CanvasRenderingContext2D, state: State, dark = true, frameName = true) {
  target.save(); target.globalAlpha = element.opacity / 100; target.lineWidth = element.strokeWidth;
  target.lineJoin = 'round'; target.lineCap = 'round'; target.strokeStyle = dark ? ink(state, element.strokeColor) : element.strokeColor;
  const local = unrotatedBounds(element);
  if (element.angle) { target.translate(local.x + local.width / 2, local.y + local.height / 2); target.rotate(element.angle); target.translate(-local.x - local.width / 2, -local.y - local.height / 2); }
  if (element.type === 'image') {
    const b = unrotatedBounds(element), record = element.imageData ? imageRecord(element.imageData) : null;
    if (record?.ready) {
      const [sx, sy] = element.scale ?? [1, 1];
      target.translate(b.x + (sx < 0 ? b.width : 0), b.y + (sy < 0 ? b.height : 0)); target.scale(sx, sy);
      target.drawImage(record.image, 0, 0, b.width, b.height);
    } else {
      target.fillStyle = state.theme === 'dark' ? '#34343e' : '#f1f0f7'; target.fillRect(b.x, b.y, b.width, b.height);
      target.fillStyle = state.theme === 'dark' ? '#b0afbd' : '#62626f'; target.font = '12px sans-serif';
      target.fillText(record?.failed || !record ? 'Image unavailable' : 'Loading image…', b.x + 8, b.y + 20, Math.max(1, b.width - 16));
    }
  } else if (element.type === 'text') {
    target.textBaseline = 'top';
    for (const run of layout(element, target).segments) {
      target.font = font(element, run);
      const color = run.link ? dark && state.theme === 'dark' ? '#74c0fc' : '#1971c2' : dark ? ink(state, element.strokeColor) : element.strokeColor;
      target.fillStyle = color; target.fillText(run.text, element.x + run.x, element.y + run.y);
      if (run.underline || run.link) {
        target.strokeStyle = color; target.lineWidth = Math.max(1, element.fontSize / 16); target.setLineDash([]);
        target.beginPath(); target.moveTo(element.x + run.x, element.y + run.y + element.fontSize * 1.05);
        target.lineTo(element.x + run.x + run.width, element.y + run.y + element.fontSize * 1.05); target.stroke();
      }
    }
  } else {
    const box = unrotatedBounds(element), linear = ['line', 'arrow', 'freedraw'].includes(element.type);
    target.translate(linear ? element.x : box.x, linear ? element.y : box.y);
    for (const descriptor of renderPaths(element, dark && state.theme === 'dark', state.background)) {
      const path = new Path2D(descriptor.d); target.setLineDash(descriptor.dash);
      if (descriptor.fill !== 'none') { target.fillStyle = descriptor.fill!; target.fill(path, descriptor.fillRule); }
      if (descriptor.stroke !== 'none') { target.strokeStyle = descriptor.stroke; target.lineWidth = descriptor.strokeWidth; target.stroke(path); }
    }
    if (element.type === 'stickynote') {
      target.fillStyle = dark ? ink(state, element.strokeColor) : element.strokeColor;
      target.font = '12px Helvetica, Arial, sans-serif'; target.textBaseline = 'alphabetic'; target.textAlign = 'right';
      target.fillText(noteDate(element), box.width - 16, box.height - 14, Math.max(1, box.width - 32));
    }
    if (element.type === 'frame' && frameName) {
      target.fillStyle = dark ? ink(state, element.strokeColor) : element.strokeColor; target.font = '12px sans-serif'; target.textBaseline = 'bottom';
      target.fillText(element.name || 'Frame', 0, -5);
    }
  }
  target.restore();
}
export function drawCanvas(canvas: HTMLCanvasElement, state: State) {
  const ctx = canvas.getContext('2d')!, width = canvas.clientWidth, height = canvas.clientHeight;
  const dpr = devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height); ctx.save();
  ctx.translate(state.pan.x, state.pan.y); ctx.scale(state.zoom, state.zoom);
  if (state.grid) {
    ctx.fillStyle = state.theme === 'dark' ? '#414149' : '#d1d0dc';
    const start = screenToWorld(state, 0, 0), end = screenToWorld(state, width, height), step = state.zoom < .4 ? 100 : 20;
    for (let x = Math.floor(start.x / step) * step; x < end.x; x += step) for (let y = Math.floor(start.y / step) * step; y < end.y; y += step) ctx.fillRect(x, y, 1 / state.zoom, 1 / state.zoom);
  }
  for (const element of visibleElements(state.elements, state.layers)) if (element.id !== state.editing?.id) drawElement(state.editing?.container?.id === element.id ? state.editing.container : element, ctx, state, true, false);
  if (state.flowchart?.pageId === state.activePageId) for (const element of state.flowchart.elements) drawElement(element, ctx, state, true, false);
  const gesture = state.gesture;
  const connecting = gesture?.kind === 'draw' ? state.elements.find(element => element.id === gesture.id) : gesture?.kind === 'endpoint' ? state.elements.find(element => element.id === gesture.originals[0].id) : null;
  if (connecting && isConnector(connecting)) {
    const points = connectorPoints(connecting);
    ctx.strokeStyle = state.theme === 'dark' ? '#b4afff' : '#6965db'; ctx.lineWidth = 1.5 / state.zoom;
    ctx.fillStyle = state.theme === 'dark' ? '#232329' : '#ffffff';
    for (const key of bindingKeys) if (connecting[key]) {
      const point = points[key === 'startBinding' ? 0 : points.length - 1];
      ctx.beginPath(); ctx.arc(point.x, point.y, 4.25 / state.zoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
  if (selectedElements(state).length && !state.editing) {
    const selected = selectedElements(state), image = selected.length === 1 && selected[0].type === 'image' ? selected[0] : null;
    const { box: b, angle } = selectionGeometry(state), pad = image || selected.every(element => element.type === 'text') ? 0 : 5 / state.zoom;
    ctx.strokeStyle = state.theme === 'dark' ? '#b4afff' : '#6965db'; ctx.lineWidth = 1 / state.zoom;
    const boxes = individualSelectionBoxes(state, selected);
    if (boxes.length > 1) for (const { box, angle, pad } of boxes) drawSelectionBox(ctx, box, angle, pad);
    drawSelectionBox(ctx, b, angle, pad);
    for (const h of selected.some(element => layerModel(state.elements, state.layers).locked.has(element.id)) ? [] : selectionHandles(state)) {
      ctx.fillStyle = state.theme === 'dark' ? '#232329' : '#ffffff';
      ctx.beginPath();
      if (h.key === 'rotate' || h.key.endsWith('Binding')) ctx.arc(h.x, h.y, 5 / state.zoom, 0, Math.PI * 2);
      else ctx.roundRect(h.x - 4 / state.zoom, h.y - 4 / state.zoom, 8 / state.zoom, 8 / state.zoom, image ? 2 / state.zoom : 0);
      ctx.fill(); ctx.stroke();
    }
  }
  if (state.gesture?.kind === 'marquee') {
    const { start, current } = state.gesture;
    ctx.fillStyle = '#6965db15'; ctx.strokeStyle = '#6965db'; ctx.lineWidth = 1 / state.zoom;
    ctx.fillRect(start.x, start.y, current.x - start.x, current.y - start.y); ctx.strokeRect(start.x, start.y, current.x - start.x, current.y - start.y);
  }
  ctx.restore();
}
export function mountCanvas(canvas: HTMLCanvasElement, store: Store) {
  let frame: number | null = null;
  const redraw = () => {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => { frame = null; drawCanvas(canvas, store.getSnapshot()); });
  };
  const resize = () => { canvas.width = Math.round(canvas.clientWidth * (devicePixelRatio || 1)); canvas.height = Math.round(canvas.clientHeight * (devicePixelRatio || 1)); drawCanvas(canvas, store.getSnapshot()); };
  const unsubscribe = store.subscribe(redraw), unsubscribeImages = subscribeImages(redraw); window.addEventListener('resize', resize); resize();
  return () => { unsubscribe(); unsubscribeImages(); window.removeEventListener('resize', resize); if (frame !== null) cancelAnimationFrame(frame); };
}
