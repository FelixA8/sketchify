import type { Element } from '../types';
import type { Layers } from './project';
import { isDraft } from 'immer';

export interface LayerNode { key: string; element?: Element; group?: string; name: string; parent: string | null; children: LayerNode[]; order: number }
export interface LayerModel { roots: LayerNode[]; nodes: Map<string, LayerNode>; hidden: Set<string>; locked: Set<string> }
const cache = new WeakMap<Element[], WeakMap<Layers, LayerModel>>();
export const elementKey = (id: string) => `e:${id}`;
export const groupKey = (id: string) => `g:${id}`;
export function layerModel(elements: Element[], settings: Layers): LayerModel {
  const draft = isDraft(elements) || isDraft(settings);
  const cached = !draft && cache.get(elements)?.get(settings); if (cached) return cached;
  const nodes = new Map<string, LayerNode>();
  const byId = new Map(elements.map(element => [element.id, element]));
  const relativeGroups = new Map(elements.map(element => [element.id, element.groupIds.filter(group => !byId.get(element.frameId ?? '')?.groupIds.includes(group))]));
  elements.forEach((element, order) => {
    nodes.set(elementKey(element.id), { key: elementKey(element.id), element, name: element.name || (element.type === 'text' ? element.text.replace(/\s+/g, ' ').slice(0, 80) : '') || (element.type === 'freedraw' ? 'Drawing' : element.type === 'stickynote' ? 'Sticky note' : element.type[0].toUpperCase() + element.type.slice(1)), parent: null, children: [], order });
    for (const group of element.groupIds) if (!nodes.has(groupKey(group))) nodes.set(groupKey(group), { key: groupKey(group), group, name: 'Group', parent: null, children: [], order });
  });
  for (const node of nodes.values()) {
    const element = node.element;
    if (element) {
      const groups = relativeGroups.get(element.id)!;
      node.parent = element.containerId && nodes.has(elementKey(element.containerId)) ? elementKey(element.containerId) : groups.length ? groupKey(groups[0]) : element.frameId && nodes.has(elementKey(element.frameId)) ? elementKey(element.frameId) : null;
    }
    else {
      const members = elements.filter(element => relativeGroups.get(element.id)!.includes(node.group!));
      if (!members.length) continue;
      const member = members[0], groups = relativeGroups.get(member.id)!, outer = groups[groups.indexOf(node.group!) + 1];
      const frame = member.frameId;
      node.parent = outer ? groupKey(outer) : frame && members.every(element => element.frameId === frame) && !members.some(element => element.id === frame) ? elementKey(frame) : null;
    }
    node.name = settings[node.key]?.name || node.name;
  }
  for (const node of nodes.values()) {
    const visited = new Set([node.key]); let parent = node.parent;
    while (parent) { if (visited.has(parent)) { node.parent = null; break; } visited.add(parent); parent = nodes.get(parent)?.parent ?? null; }
    if (node.parent && !nodes.has(node.parent)) node.parent = null;
  }
  const roots: LayerNode[] = [], hidden = new Set<string>(), locked = new Set<string>();
  for (const node of nodes.values()) (node.parent ? nodes.get(node.parent)!.children : roots).push(node);
  function visit(list: LayerNode[], hide = false, lock = false) {
    for (const node of list) {
      const h = hide || !!settings[node.key]?.hidden, l = lock || !!settings[node.key]?.locked || !!node.element?.locked;
      visit(node.children, h, l);
      if (node.element) { if (h) hidden.add(node.element.id); if (l) locked.add(node.element.id); }
      node.order = Math.max(node.order, ...node.children.map(child => child.order));
    }
    list.sort((a, b) => b.order - a.order);
  }
  visit(roots);
  const result = { roots, nodes, hidden, locked };
  if (!draft) { if (!cache.has(elements)) cache.set(elements, new WeakMap()); cache.get(elements)!.set(settings, result); }
  return result;
}
export function layerMembers(node: LayerNode): Element[] {
  return [...(node.element ? [node.element] : []), ...node.children.flatMap(layerMembers)];
}
export function visibleElements(elements: Element[], settings: Layers, scene = elements) {
  const { hidden } = layerModel(scene, settings); return elements.filter(element => !hidden.has(element.id));
}
export function layerAncestors(model: LayerModel, key: string) {
  const parents: LayerNode[] = []; let parent = model.nodes.get(key)?.parent;
  while (parent) { const node = model.nodes.get(parent)!; parents.push(node); parent = node.parent; }
  return parents;
}
export function moveLayer(elements: Element[], settings: Layers, source: string, target: string | null, position: 'before' | 'after' | 'inside'): Element[] | null {
  const model = layerModel(elements, settings), node = model.nodes.get(source), to = target ? model.nodes.get(target) : undefined;
  if (!node || source === target || node.element?.containerId || target && !to) return null;
  const moving = layerMembers(node), ids = new Set(moving.map(element => element.id));
  if (moving.some(element => model.locked.has(element.id)) || to && ([to, ...layerAncestors(model, to.key)].some(target => target.key === source) || to.element && model.locked.has(to.element.id))) return null;
  if (position === 'inside' && to && !to.group && to.element?.type !== 'frame') return null;
  const parent = position === 'inside' ? to : to?.parent ? model.nodes.get(to.parent) : undefined;
  if (parent?.element && parent.element.type !== 'frame') return null;
  const ancestors = parent ? [parent, ...layerAncestors(model, parent.key)] : [];
  if (ancestors.some(ancestor => settings[ancestor.key]?.locked || ancestor.element?.locked)) return null;
  const groups = ancestors.flatMap(ancestor => ancestor.group ? [ancestor.group] : []);
  const frame = ancestors.find(ancestor => ancestor.element?.type === 'frame')?.element?.id ?? null;
  const rest = elements.filter(element => !ids.has(element.id));
  const groupMember = node.group ? moving.find(element => element.groupIds.includes(node.group!)) : undefined;
  const previousGroups = groupMember && node.group ? groupMember.groupIds.slice(groupMember.groupIds.indexOf(node.group) + 1) : [...(node.element?.groupIds ?? [])];
  for (const element of moving) {
    const groupIndex = node.group ? element.groupIds.indexOf(node.group) : -1;
    const localGroups = groupIndex >= 0 ? element.groupIds.slice(0, groupIndex + 1) : element.id !== node.element?.id ? element.groupIds.filter(id => !previousGroups.includes(id)) : [];
    // Descendant frames and labels retain their local containment while the moved root changes parents.
    if (!element.containerId || !ids.has(element.containerId)) element.groupIds = [...localGroups, ...groups];
    else element.groupIds = [...(moving.find(parent => parent.id === element.containerId)?.groupIds ?? groups)];
    if (!element.frameId || !ids.has(element.frameId)) element.frameId = frame;
  }
  let index = rest.length;
  if (to && position !== 'inside') {
    const targets = new Set(layerMembers(to).map(element => element.id));
    const indices = rest.flatMap((element, index) => targets.has(element.id) ? [index] : []);
    if (indices.length) index = position === 'before' ? Math.max(...indices) + 1 : Math.min(...indices);
  } else if (parent) {
    const targets = new Set(layerMembers(parent).map(element => element.id));
    index = rest.reduce((end, element, index) => targets.has(element.id) ? index + 1 : end, 0);
  }
  rest.splice(index, 0, ...moving.sort((a, b) => elements.indexOf(a) - elements.indexOf(b)));
  return rest;
}
