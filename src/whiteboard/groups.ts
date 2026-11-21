import type { Element } from '../types';

// Group IDs run from the innermost group to the outermost group.
export function selectionGroup(element: Element, editingGroup: string | null = null) {
  const index = editingGroup ? element.groupIds.indexOf(editingGroup) : element.groupIds.length;
  return element.groupIds[(index < 0 ? element.groupIds.length : index) - 1];
}

export function selectionUnit(elements: Element[], id: string, editingGroup: string | null = null): Element[] {
  const element = elements.find(element => element.id === id);
  if (!element) return [];
  const parent = element.containerId && elements.find(parent => parent.id === element.containerId);
  const target = parent || element, group = selectionGroup(target, editingGroup);
  return group ? elements.filter(element => element.groupIds.includes(group)) : [target];
}

export function expandGroups(elements: Element[], ids: Set<string>, editingGroup: string | null = null) {
  const byId = new Map(elements.map(element => [element.id, element]));
  const selected = new Set<string>(), groups = new Set<string>();
  for (const id of ids) {
    const element = byId.get(id);
    if (!element) continue;
    const parent = element.containerId && byId.get(element.containerId);
    const target = parent || element, group = selectionGroup(target, editingGroup);
    selected.add(target.id); if (group) groups.add(group);
  }
  for (const element of elements) if (element.groupIds.some(id => groups.has(id))) selected.add(element.id);
  return selected;
}

export function groupingOptions(elements: Element[], selected: Element[], editingGroup: string | null = null) {
  const ids = new Set(selected.map(element => element.id));
  const roots = selected.filter(element => !(element.containerId && ids.has(element.containerId)) && !(element.frameId && ids.has(element.frameId)));
  const units = new Set(roots.map(element => selectionGroup(element, editingGroup) ?? element.id));
  const groups = new Set(roots.map(element => selectionGroup(element, editingGroup)).filter((id): id is string => !!id));
  const unlocked = selected.length > 0 && selected.every(element => !element.locked)
    && elements.every(element => !element.locked || !element.groupIds.some(id => groups.has(id)));
  return { canGroup: unlocked && units.size > 1, canUngroup: unlocked && groups.size > 0, groups };
}
