import { importScene, uid } from '../scene';
import type { Element, Point } from '../types';
import type { State } from './store';

export interface LayerSettings { name?: string; hidden?: boolean; locked?: boolean }
export type Layers = Record<string, LayerSettings>;
export interface PageScene { elements: Element[]; layers: Layers }
export interface CanvasPage extends PageScene { id: string; name: string; background: string; pan: Point; zoom: number }
export interface Project { type: 'sketchify'; version: 1; name: string; activePageId: string; pages: CanvasPage[] }

export function blankPage(name = 'Page 1', id = uid()): CanvasPage {
  return { id, name, elements: [], layers: {}, background: '#ffffff', pan: { x: 0, y: 0 }, zoom: 1 };
}
export function projectPages(s: State): CanvasPage[] {
  return s.pages.map(page => page.id === s.activePageId ? { ...page, elements: s.elements, layers: s.layers, background: s.background, pan: s.pan, zoom: s.zoom } : page);
}
export function projectData(s: State): Project {
  return { type: 'sketchify', version: 1, name: s.name, activePageId: s.activePageId, pages: projectPages(s) };
}
export function activatePage(s: State, id: string) {
  const pages = projectPages(s), page = pages.find(page => page.id === id);
  if (!page) return;
  s.pages = pages; s.activePageId = id;
  s.elements = page.elements; s.layers = page.layers; s.background = page.background; s.pan = page.pan; s.zoom = page.zoom;
  s.selected.clear(); s.editingGroup = null; s.gesture = null; s.editing = null; s.frameEditing = null;
  s.connectorHint = null; s.flowchart = null; s.contextMenu = null; s.cursor = null;
}
export function readProject(raw: unknown): { project: Project; skipped: number } {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid Sketchify project.');
  const data = raw as Record<string, unknown>;
  if (data.type !== 'sketchify' || data.version !== 1 || !Array.isArray(data.pages) || !data.pages.length) throw new Error('Unsupported Sketchify project.');
  const ids = new Set<string>(); let skipped = 0;
  const pages = data.pages.map((value: unknown, index): CanvasPage => {
    if (!value || typeof value !== 'object') throw new Error('Invalid project page.');
    const page = value as Record<string, unknown>;
    if (!Array.isArray(page.elements)) throw new Error('Invalid page elements.');
    const result = importScene({ elements: page.elements }); skipped += result.skipped;
    const id = typeof page.id === 'string' && page.id && !ids.has(page.id) ? page.id : uid(); ids.add(id);
    const layers: Layers = {};
    if (page.layers && typeof page.layers === 'object') for (const [key, value] of Object.entries(page.layers)) {
      if (!value || typeof value !== 'object' || ['__proto__', 'constructor', 'prototype'].includes(key)) continue;
      layers[key] = { ...(typeof value.name === 'string' ? { name: value.name.slice(0, 100) } : {}), ...(value.hidden === true ? { hidden: true } : {}), ...(value.locked === true ? { locked: true } : {}) };
    }
    const pan = page.pan as Point | undefined;
    return { id, name: typeof page.name === 'string' && page.name.trim() ? page.name.slice(0, 100) : `Page ${index + 1}`, elements: result.elements, layers,
      background: typeof page.background === 'string' && /^#[\da-f]{6}$/i.test(page.background) ? page.background : '#ffffff',
      pan: pan && Number.isFinite(pan.x) && Number.isFinite(pan.y) ? { x: pan.x, y: pan.y } : { x: 0, y: 0 },
      zoom: Math.max(.1, Math.min(5, Number(page.zoom) || 1)) };
  });
  return { project: { type: 'sketchify', version: 1, name: typeof data.name === 'string' && data.name.trim() ? data.name.slice(0, 100) : 'Sketchify',
    activePageId: pages.some(page => page.id === data.activePageId) ? data.activePageId as string : pages[0].id, pages }, skipped };
}
