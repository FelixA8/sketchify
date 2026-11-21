import { generateElementShape, RoughGenerator, applyDarkModeFilter } from '../vendor/excalidraw-renderer.js';
import { unrotatedBounds } from './scene';
import type { Element, RenderPath } from './types';
import { NOTE_BACKGROUND, notePath } from './notes';
const generator = new RoughGenerator();
const cache = new WeakMap<Element, { signature: string; paths: RenderPath[] }>();

function generateShape(element: Element, dark = false, canvasBackgroundColor = '#ffffff') {
  if (element.type === 'text' || element.type === 'image' || element.type === 'stickynote') return null;
  const box = unrotatedBounds(element);
  const normalized = { ...element, type: element.type === 'frame' ? 'rectangle' : element.type, width: box.width, height: box.height, simulatePressure: element.simulatePressure ?? true, pressures: element.pressures || [], roundness: element.roundness || null };
  if (['line', 'arrow'].includes(element.type) && element.points.length < 2) return [];
  if (element.type === 'arrow' && element.points.every(p => p[0] === element.points[0][0] && p[1] === element.points[0][1])) return [];
  return generateElementShape(normalized, generator, { isExporting: false, canvasBackgroundColor, embedsValidationStatus: null, theme: dark ? 'dark' : 'light' });
}

function renderPaths(element: Element, dark = false, canvasBackgroundColor = '#ffffff'): RenderPath[] {
  if (element.type === 'stickynote') {
    const box = unrotatedBounds(element);
    return [{ d: notePath(box.width, box.height), fill: applyDarkModeFilter(element.backgroundColor === 'transparent' ? NOTE_BACKGROUND : element.backgroundColor, dark), stroke: 'none', strokeWidth: 0, dash: [], fillRule: 'nonzero' }];
  }
  const signature = JSON.stringify([element.type, element.width, element.height, element.points, element.seed, element.roughness, element.strokeWidth, element.strokeStyle, element.strokeColor, element.backgroundColor, element.fillStyle, element.roundness, element.startArrowhead, element.endArrowhead, element.elbowed, element.pressures, element.simulatePressure, element.strokeOptions, dark, canvasBackgroundColor]);
  const cached = cache.get(element);
  if (cached?.signature === signature) return cached.paths;
  const shape = generateShape(element, dark, canvasBackgroundColor);
  const shapes = shape ? Array.isArray(shape) ? shape : [shape] : [];
  const paths: RenderPath[] = shapes.flatMap((drawable): RenderPath[] => {
    if (typeof drawable === 'string') return [{ d: drawable, fill: applyDarkModeFilter(element.strokeColor, dark), stroke: 'none', strokeWidth: 0, dash: [], fillRule: 'nonzero' }];
    return generator.toPaths(drawable).map((path, index) => ({
      ...path,
      dash: drawable.sets[index].type === 'path' ? drawable.options.strokeLineDash || [] : drawable.options.fillLineDash || [],
      fillRule: ['curve', 'polygon', 'path'].includes(drawable.shape) ? 'evenodd' : 'nonzero',
    }));
  });
  cache.set(element, { signature, paths });
  return paths;
}

export { generateShape, renderPaths };
