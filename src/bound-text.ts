import { rotatePoint, unrotatedBounds } from './scene';
import { layout } from './text';
import type { Element, TextContext } from './types';
import { fitStickyNote } from './notes';

export const textContainer = (element: Element) => ['rectangle', 'ellipse', 'diamond', 'stickynote'].includes(element.type);
export const boundLabel = (element: Element) => element.type === 'text' && !!element.containerId;

export function fitBoundText(text: Element, container: Element, ctx: TextContext) {
  if (container.type === 'stickynote') {
    Object.assign(text, { baseFontSize: container.fontSize, fontFamily: container.fontFamily, strokeColor: container.strokeColor, opacity: container.opacity });
    fitStickyNote(text, container, ctx); return;
  }
  const box = unrotatedBounds(container);
  const factor = container.type === 'diamond' ? .5 : container.type === 'ellipse' ? Math.SQRT1_2 : 1;
  const padding = 16;
  const width = Math.max(box.width, (text.fontSize + padding * 2) / factor);
  text.textWidth = Math.max(8, width * factor - padding * 2);
  const measured = layout(text, ctx);
  const height = Math.max(box.height, (measured.height + padding * 2) / factor);
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  // Grow along the shape's own axes so rotated labels keep their top edge anchored.
  const next = rotatePoint({ x: center.x + (width - box.width) / 2, y: center.y + (height - box.height) / 2 }, center, container.angle);
  Object.assign(container, { x: next.x - width / 2, y: next.y - height / 2, width, height });
  const innerHeight = height * factor - padding * 2;
  const offsetY = text.verticalAlign === 'top' ? -innerHeight / 2 + measured.contentHeight / 2 : text.verticalAlign === 'bottom' ? innerHeight / 2 - measured.contentHeight / 2 : 0;
  const textCenter = rotatePoint({ x: next.x, y: next.y + offsetY }, next, container.angle);
  Object.assign(text, { width: measured.width, height: measured.contentHeight, x: textCenter.x - measured.width / 2, y: textCenter.y - measured.contentHeight / 2, angle: container.angle });
}

export function fitBoundLabels(elements: Element[], ctx: TextContext) {
  for (const text of elements) if (boundLabel(text)) {
    const container = elements.find(element => element.id === text.containerId);
    if (container && textContainer(container)) fitBoundText(text, container, ctx);
  }
}
