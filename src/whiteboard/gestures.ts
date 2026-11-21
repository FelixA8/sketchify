import { bounds, createElement, hitTest, resizeElement, resizeLocalElement, sceneBounds, unrotatedBounds, rotatePoint, normalizeAngle, pointInElementBounds } from '../scene';
import { linkAt } from '../text';
import type { Controller } from './controller';
import type { Point } from '../types';
import { pickHandle, selectionGeometry } from './canvas';
import { snapshot } from './store';
import { expandGroups } from './groups';
import { boundLabel, textContainer } from '../bound-text';
import { bindEndpoint, connectorPoints, isConnector, setConnectorPoints, snapEndpoint } from '../connectors';
import { NOTE_MIN_SIZE } from '../notes';
export function mountGestures(a: Controller) {
  const pick = (p: Point) => [...a.interactive()].reverse().find(e => hitTest(e, p, 7 / a.state.zoom));
  const textTarget = (p: Point) => [...a.visible()].reverse().find(element => hitTest(textContainer(element) ? { ...element, backgroundColor: '#ffffff' } : element, p, 7 / a.state.zoom));
  const followers = () => snapshot(a.state.elements.filter(element => isConnector(element) && (element.startBinding || element.endBinding)));
  const resizeOriginals = () => {
    const elements = a.objects.editable();
    return snapshot(elements.filter(element => !boundLabel(element) || !elements.some(parent => parent.id === element.containerId)));
  };
  let lastPointer: PointerEvent | null = null;
  function showSnapHint(snapped: ReturnType<typeof snapEndpoint>) {
    a.state.connectorHint = snapped?.hint ? snapped.point : null;
  }
  function snapWithHint(point: Point) {
    const s = a.state, snapped = s.preferences.arrowBinding ? snapEndpoint(a.interactive(), point, s.zoom) : null;
    showSnapHint(snapped);
    return snapped;
  }
  a.listen(a.canvas, 'pointerdown', event => {
    if (event.button !== 0 && event.button !== 1) return;
    lastPointer = event;
    a.text.finish(); const s = a.state; s.menu = false; s.connectorHint = null;
    const p = a.point(event), clicked = pick(p);
    if ((event.ctrlKey || event.metaKey) && clicked?.link) {
      event.preventDefault(); window.open(clicked.link, '_blank', 'noopener,noreferrer'); return;
    }
    if ((event.ctrlKey || event.metaKey) && clicked?.type === 'text') {
      const link = linkAt(clicked, p, a.ctx); if (link) { event.preventDefault(); window.open(link, '_blank', 'noopener,noreferrer'); return; }
    }
    if (s.tool === 'text' && !s.space && event.button === 0) {
      event.preventDefault();
      const note = clicked?.type === 'stickynote' ? clicked : clicked?.containerId ? s.elements.find(element => element.id === clicked.containerId && element.type === 'stickynote') : undefined;
      a.text.edit(a.snap(p), note);
      return;
    }
    a.canvas.focus({ preventScroll: true }); a.canvas.setPointerCapture(event.pointerId);
    if (s.tool === 'hand' || s.space || event.button === 1) { s.gesture = { kind: 'pan', start: { x: event.clientX, y: event.clientY }, pan: { ...s.pan } }; return; }
    if (s.tool === 'eraser') {
      s.gesture = { kind: 'erase', snapshot: snapshot(s.elements) }; if (clicked) a.removeElements(new Set([clicked.id]), false); s.selected.clear(); return;
    }
    if (s.tool === 'selection') {
      if (a.selected().some(element => a.isLocked(element))) s.selected.clear();
      const handle = pickHandle(s, p);
      if (handle?.key === 'startBinding' || handle?.key === 'endBinding') {
        s.gesture = { kind: 'endpoint', end: handle.key, originals: snapshot(a.objects.editable()) }; return;
      }
      if (handle?.key === 'rotate') {
        const { box, angle } = selectionGeometry(s), center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        s.gesture = { kind: 'rotate', center, box, initialAngle: angle, delta: 0, startAngle: Math.atan2(p.y - center.y, p.x - center.x), originals: snapshot(a.objects.editable()), followers: followers() }; return;
      }
      if (handle) { const { box, angle } = selectionGeometry(s); s.gesture = { kind: 'resize', start: p, handle: handle.key, box, angle, originals: resizeOriginals(), followers: followers() }; return; }
      let element = clicked && boundLabel(clicked) ? s.elements.find(parent => parent.id === clicked.containerId) ?? clicked : clicked;
      if (element && a.isLocked(element)) return;
      if (!element && s.selected.size) {
        const selected = a.selected(), box = sceneBounds(selected);
        if (selected.length === 1 ? pointInElementBounds(selected[0], p) : p.x >= box.x && p.x <= box.x + box.width && p.y >= box.y && p.y <= box.y + box.height) element = selected[0];
      }
      if (element) {
        if (event.shiftKey || !s.selected.has(element.id)) a.objects.select(element.id, event.shiftKey);
        if (event.altKey) { const copies = a.objects.copies({ x: 0, y: 0 }); s.elements.push(...copies); s.selected = new Set(copies.map(e => e.id)); }
        s.gesture = { kind: 'move', start: p, originals: snapshot(a.objects.editable()), followers: followers() }; if (innerWidth > 760) s.panel = true;
      } else {
        if (s.editingGroup) {
          const box = sceneBounds(s.elements.filter(element => element.groupIds.includes(s.editingGroup!)));
          if (p.x < box.x || p.x > box.x + box.width || p.y < box.y || p.y > box.y + box.height) s.editingGroup = null;
        }
        const initial = event.shiftKey ? new Set(s.selected) : new Set<string>(); s.selected = initial; s.gesture = { kind: 'marquee', start: p, current: p, initial };
      }
    } else {
      const start = a.snap(p), element = createElement(s.tool, start.x, start.y, snapshot(s.tool === 'stickynote' ? s.noteStyle : s.style));
      if (['line', 'arrow', 'freedraw'].includes(s.tool)) element.points = [[0, 0], [0, 0]];
      if (isConnector(element) && s.preferences.arrowBinding) {
        const snapped = snapWithHint(p);
        if (snapped) { element.x = snapped.point.x; element.y = snapped.point.y; element.startBinding = snapped.binding; Object.assign(start, snapped.point); }
      }
      s.elements.push(element); s.gesture = { kind: 'draw', start, id: element.id }; s.selected.clear();
    }
  });
  function updatePointer(event: PointerEvent, shiftKey = event.shiftKey) {
    const s = a.state, gesture = s.gesture, p = a.point(event);
    if (!gesture) {
      if (['arrow', 'line'].includes(s.tool) && !s.space) snapWithHint(p);
      else s.connectorHint = null;
      if (s.tool === 'selection') { const element = pick(p), handle = pickHandle(s, p); s.cursor = (event.metaKey || event.ctrlKey) && element && (element.link || element.type === 'text' && linkAt(element, p, a.ctx)) ? 'pointer' : handle?.key === 'rotate' ? 'grab' : handle?.key.endsWith('Binding') ? 'crosshair' : handle ? `${handle.key}-resize` : element ? 'move' : 'default'; } return;
    }
    if (gesture.kind === 'pan') s.pan = { x: gesture.pan.x + event.clientX - gesture.start.x, y: gesture.pan.y + event.clientY - gesture.start.y };
    else if (gesture.kind === 'draw') {
      const element = s.elements.find(e => e.id === gesture.id)!, end = a.snap(p);
      let dx = end.x - gesture.start.x, dy = end.y - gesture.start.y;
      if (element.type === 'stickynote' ? !shiftKey : shiftKey) {
        if (['line', 'arrow'].includes(element.type)) { const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI / 4, length = Math.hypot(dx, dy); dx = Math.cos(angle) * length; dy = Math.sin(angle) * length; }
        else { const size = Math.max(Math.abs(dx), Math.abs(dy)); dx = (Math.sign(dx) || 1) * size; dy = (Math.sign(dy) || 1) * size; }
      }
      element.width = dx; element.height = dy;
      if (element.type === 'freedraw') { const last = element.points.at(-1)!; if (Math.hypot(dx - last[0], dy - last[1]) > 1 / s.zoom) element.points.push([dx, dy]); }
      else if (isConnector(element)) {
        setConnectorPoints(element, [gesture.start, { x: gesture.start.x + dx, y: gesture.start.y + dy }]);
        if (s.preferences.arrowBinding) {
          const endpoint = snapWithHint(shiftKey ? { x: gesture.start.x + dx, y: gesture.start.y + dy } : p)?.point;
          showSnapHint(bindEndpoint(element, 'endBinding', endpoint ?? { x: gesture.start.x + dx, y: gesture.start.y + dy }, a.interactive(), s.zoom));
        }
      }
    } else if (gesture.kind === 'endpoint') {
      const original = gesture.originals[0], element = s.elements.find(element => element.id === original.id)!;
      Object.assign(element, snapshot(original));
      let end = a.snap(p);
      if (shiftKey) {
        const points = connectorPoints(original), fixed = points[gesture.end === 'startBinding' ? points.length - 1 : 0];
        const angle = Math.round(Math.atan2(end.y - fixed.y, end.x - fixed.x) / (Math.PI / 4)) * Math.PI / 4, length = Math.hypot(end.x - fixed.x, end.y - fixed.y);
        end = { x: fixed.x + Math.cos(angle) * length, y: fixed.y + Math.sin(angle) * length };
      }
      end = snapWithHint(shiftKey ? end : p)?.point ?? end;
      if (s.preferences.arrowBinding) showSnapHint(bindEndpoint(element, gesture.end, end, a.interactive(), s.zoom));
      else {
        element[gesture.end] = null;
        const points = connectorPoints(element); points[gesture.end === 'startBinding' ? 0 : points.length - 1] = end;
        setConnectorPoints(element, points);
      }
    } else if (gesture.kind === 'move') {
      let dx = p.x - gesture.start.x, dy = p.y - gesture.start.y;
      if (s.grid) { dx = Math.round(dx / 20) * 20; dy = Math.round(dy / 20) * 20; }
      if (shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      for (const original of gesture.originals) {
        const element = s.elements.find(e => e.id === original.id)!;
        Object.assign(element, snapshot(original), { x: original.x + dx, y: original.y + dy });
      }
    } else if (gesture.kind === 'rotate') {
      const { center, originals, startAngle } = gesture;
      if (Math.hypot(p.x - center.x, p.y - center.y) < 1 / s.zoom) return;
      let angle = gesture.initialAngle + Math.atan2(p.y - center.y, p.x - center.x) - startAngle;
      if (shiftKey) angle = Math.round(angle / (Math.PI / 12)) * Math.PI / 12;
      gesture.delta = angle - gesture.initialAngle;
      for (const original of originals) {
        const box = unrotatedBounds(original), oldCenter = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        const nextCenter = rotatePoint(oldCenter, center, gesture.delta);
        Object.assign(s.elements.find(element => element.id === original.id)!, snapshot(original), { x: original.x + nextCenter.x - oldCenter.x, y: original.y + nextCenter.y - oldCenter.y, angle: normalizeAngle(original.angle + gesture.delta) });
      }
    } else if (gesture.kind === 'resize') {
      const box = gesture.box, pointer = a.snap(p), center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const end = rotatePoint(pointer, center, -gesture.angle); let x1 = box.x, y1 = box.y, x2 = box.x + box.width, y2 = box.y + box.height;
      if (gesture.originals.length === 1 && gesture.originals[0].type === 'stickynote') {
        const original = gesture.originals[0], handle = gesture.handle, corner = handle.length === 2;
        if (handle.includes('w')) x1 = Math.min(end.x, x2 - NOTE_MIN_SIZE);
        if (handle.includes('e')) x2 = Math.max(end.x, x1 + NOTE_MIN_SIZE);
        if (handle.includes('n')) y1 = Math.min(end.y, y2 - NOTE_MIN_SIZE);
        if (handle.includes('s')) y2 = Math.max(end.y, y1 + NOTE_MIN_SIZE);
        let width = x2 - x1, height = y2 - y1;
        if (corner ? !shiftKey : shiftKey) {
          const scale = corner ? Math.max(width / box.width, height / box.height) : handle === 'w' || handle === 'e' ? width / box.width : height / box.height;
          width = Math.max(NOTE_MIN_SIZE, box.width * scale); height = Math.max(NOTE_MIN_SIZE, box.height * scale);
          x1 = handle.includes('w') ? x2 - width : handle.includes('e') ? x1 : center.x - width / 2;
          y1 = handle.includes('n') ? y2 - height : handle.includes('s') ? y1 : center.y - height / 2;
        }
        const nextCenter = rotatePoint({ x: x1 + width / 2, y: y1 + height / 2 }, center, original.angle);
        Object.assign(s.elements.find(element => element.id === original.id)!, snapshot(original), {
          x: nextCenter.x - width / 2, y: nextCenter.y - height / 2, width, height,
          baseHeight: handle === 'w' || handle === 'e' ? original.baseHeight ?? original.height : height,
          fontSize: corner && !shiftKey ? Math.max(16, original.fontSize * width / box.width) : original.fontSize,
        }); return;
      }
      if (gesture.originals.length === 1 && (gesture.originals[0].type === 'image' || gesture.originals[0].angle)) {
        const original = gesture.originals[0], b = unrotatedBounds(original), center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
        const sx = gesture.handle.includes('w') ? -1 : 1, sy = gesture.handle.includes('n') ? -1 : 1;
        if (original.type === 'text' && ['w', 'e'].includes(gesture.handle)) {
          const fixed = rotatePoint({ x: sx < 0 ? b.x + b.width : b.x, y: b.y }, center, original.angle);
          const local = rotatePoint({ x: pointer.x - fixed.x, y: pointer.y - fixed.y }, { x: 0, y: 0 }, -original.angle);
          const resized = { ...snapshot(original), x: 0, y: 0, textWidth: Math.max(8, Math.min(10000, sx * local.x)) };
          a.measure(resized);
          const offset = rotatePoint({ x: sx * resized.width / 2, y: resized.height / 2 }, { x: 0, y: 0 }, original.angle);
          Object.assign(s.elements.find(element => element.id === original.id)!, resized, { x: fixed.x + offset.x - resized.width / 2, y: fixed.y + offset.y - resized.height / 2 }); return;
        }
        const fixed = rotatePoint({ x: sx < 0 ? b.x + b.width : b.x, y: sy < 0 ? b.y + b.height : b.y }, center, original.angle);
        const local = rotatePoint({ x: pointer.x - fixed.x, y: pointer.y - fixed.y }, { x: 0, y: 0 }, -original.angle);
        let width = b.width ? Math.max(2, sx * local.x) : 0, height = b.height ? Math.max(2, sy * local.y) : 0;
        if (original.type === 'text') {
          const scale = Math.max(8 / original.fontSize, (sx * local.x * b.width + sy * local.y * b.height) / (b.width ** 2 + b.height ** 2 || 1));
          width = b.width * scale; height = b.height * scale;
        } else if ((original.type === 'image' || shiftKey) && b.width) { width = Math.max(width, b.height ? 2 * b.width / b.height : 2); height = width * b.height / b.width; }
        const resized = resizeLocalElement(snapshot(original), { x: 0, y: 0, width, height });
        if (resized.type === 'text') a.measure(resized);
        const actual = unrotatedBounds(resized), nextCenter = rotatePoint({ x: sx * actual.width / 2, y: sy * actual.height / 2 }, { x: 0, y: 0 }, original.angle);
        resized.x += fixed.x + nextCenter.x - actual.width / 2 - actual.x;
        resized.y += fixed.y + nextCenter.y - actual.height / 2 - actual.y;
        Object.assign(s.elements.find(element => element.id === original.id)!, resized); return;
      }
      if (gesture.originals.length === 1 && gesture.originals[0].type === 'text' && ['w', 'e'].includes(gesture.handle)) {
        const element = s.elements.find(e => e.id === gesture.originals[0].id)!;
        const width = Math.max(8, Math.min(10000, gesture.handle === 'w' ? x2 - end.x : end.x - x1));
        Object.assign(element, snapshot(gesture.originals[0]), { textWidth: width, x: gesture.handle === 'w' ? x2 - width : x1 });
        a.measure(element); return;
      }
      if (gesture.handle.includes('w')) x1 = Math.min(end.x, x2 - 2); else x2 = Math.max(end.x, x1 + 2);
      if (gesture.handle.includes('n')) y1 = Math.min(end.y, y2 - 2); else y2 = Math.max(end.y, y1 + 2);
      let w = x2 - x1, h = y2 - y1;
      const text = gesture.originals.filter(element => element.type === 'text');
      if (text.length) {
        const scale = Math.max(...text.map(element => 8 / element.fontSize), (w * box.width + h * box.height) / (box.width ** 2 + box.height ** 2 || 1));
        w = box.width * scale; h = box.height * scale;
        if (gesture.handle.includes('w')) x1 = x2 - w;
        if (gesture.handle.includes('n')) y1 = y2 - h;
      } else if (shiftKey || gesture.originals.some(element => element.type === 'image' || element.angle)) { const ratio = box.width / (box.height || 1); h = w / ratio; if (gesture.handle.includes('n')) y1 = y2 - h; }
      for (const original of gesture.originals) {
        if (gesture.angle) {
          const local = unrotatedBounds(original), oldCenter = rotatePoint({ x: local.x + local.width / 2, y: local.y + local.height / 2 }, center, -gesture.angle);
          const nextCenter = rotatePoint({ x: x1 + (oldCenter.x - box.x) / (box.width || 1) * w, y: y1 + (oldCenter.y - box.y) / (box.height || 1) * h }, center, gesture.angle);
          const resized = resizeLocalElement(snapshot(original), { x: 0, y: 0, width: local.width * w / (box.width || 1), height: local.height * h / (box.height || 1) });
          if (resized.type === 'text') a.measure(resized);
          const actual = unrotatedBounds(resized); resized.x += nextCenter.x - actual.x - actual.width / 2; resized.y += nextCenter.y - actual.y - actual.height / 2;
          Object.assign(s.elements.find(element => element.id === original.id)!, resized); continue;
        }
        const b = bounds(original), resized = resizeElement(snapshot(original), { x: x1 + (b.x - box.x) / (box.width || 1) * w, y: y1 + (b.y - box.y) / (box.height || 1) * h, width: b.width / (box.width || 1) * w, height: b.height / (box.height || 1) * h });
        if (resized.type === 'text') {
          a.measure(resized);
          if (gesture.originals.length === 1) {
            if (gesture.handle.includes('w')) resized.x = box.x + box.width - resized.width;
            if (gesture.handle.includes('n')) resized.y = box.y + box.height - resized.height;
          }
        }
        Object.assign(s.elements.find(e => e.id === original.id)!, resized);
      }
    } else if (gesture.kind === 'marquee') {
      gesture.current = p; const left = Math.min(gesture.start.x, p.x), top = Math.min(gesture.start.y, p.y), right = Math.max(gesture.start.x, p.x), bottom = Math.max(gesture.start.y, p.y);
      s.selected = new Set(gesture.initial);
      for (const element of a.interactive()) { const b = bounds(element); if ((!s.editingGroup || element.groupIds.includes(s.editingGroup)) && b.x >= left && b.y >= top && b.x + b.width <= right && b.y + b.height <= bottom) s.selected.add(element.id); }
      s.selected = expandGroups(s.elements, s.selected, s.editingGroup);
    } else if (gesture.kind === 'erase') { const element = pick(p); if (element) a.removeElements(new Set([element.id]), false); }
  }
  function updateGeometry() {
    const gesture = a.state.gesture;
    if (!gesture) return;
    if (gesture.kind === 'move' || gesture.kind === 'resize' || gesture.kind === 'rotate') a.rebindConnectors(gesture.originals);
    a.syncGeometry();
  }
  a.listen(a.canvas, 'pointermove', event => { lastPointer = event; updatePointer(event); updateGeometry(); });
  a.listen(a.canvas, 'pointerleave', () => { if (!a.state.gesture) { a.state.connectorHint = null; lastPointer = null; } });
  for (const type of ['keydown', 'keyup'] as const) a.listen(document, type, event => {
    if (event.key !== 'Shift' || event.repeat || !lastPointer) return;
    const gesture = a.state.gesture;
    if (gesture?.kind === 'endpoint' || gesture?.kind === 'move' || gesture?.kind === 'resize' || gesture?.kind === 'rotate' || gesture?.kind === 'draw' && a.state.elements.find(e => e.id === gesture.id)?.type !== 'freedraw') {
      updatePointer(lastPointer, type === 'keydown' || event.shiftKey);
      updateGeometry();
    }
  });
  a.listen(a.canvas, 'pointerup', () => { a.finishGesture(); lastPointer = null; }); a.listen(a.canvas, 'pointercancel', () => { a.finishGesture(true); lastPointer = null; });
  a.listen(a.canvas, 'contextmenu', event => {
    event.preventDefault(); a.objects.openMenu(event.clientX, event.clientY, a.point(event));
  });
  a.listen(a.canvas, 'dblclick', event => {
    if (!['selection', 'text'].includes(a.state.tool)) return;
    const p = a.point(event), target = a.state.tool === 'selection' ? textTarget(p) : undefined;
    const member = target && boundLabel(target) ? a.state.elements.find(element => element.id === target.containerId) ?? target : target;
    if (member && !a.isLocked(member) && a.objects.enterGroup(member.id)) { event.preventDefault(); return; }
    if (target && target.type !== 'text' && !textContainer(target)) return;
    const element = target && target.type !== 'stickynote' && textContainer(target) && !hitTest({ ...target, backgroundColor: 'transparent' }, p, 7 / a.state.zoom) ? undefined : target;
    event.preventDefault(); a.text.edit(p, element);
  });
  a.listen(a.canvas, 'wheel', event => {
    event.preventDefault(); a.text.finish(); a.state.contextMenu = null;
    if (event.ctrlKey || event.metaKey) a.zoom(a.state.zoom * Math.exp(-event.deltaY * .008), { x: event.offsetX, y: event.offsetY });
    else { a.state.pan.x -= event.shiftKey ? event.deltaY : event.deltaX; a.state.pan.y -= event.shiftKey ? event.deltaX : event.deltaY; a.persistence.schedule(); }
  }, { passive: false });
}
