import type { Controller } from './controller';
import { activatePage, blankPage, projectPages, type CanvasPage, type Project } from './project';
import { layerAncestors, layerMembers, layerModel, moveLayer } from './layers';
import { copyElements } from './object-actions';
import { snapshot } from './store';
import { uid } from '../scene';

export class WorkspaceActions {
  constructor(readonly app: Controller) {}
  finish() { this.app.cancelLayerNavigation(); this.app.text.finish(); this.app.finishFrameName(); this.app.finishGesture(); }
  switchPage(id: string) {
    if (id === this.app.state.activePageId || !this.app.state.pages.some(page => page.id === id)) return;
    this.finish(); activatePage(this.app.state, id);
    for (const element of this.app.state.elements) if (element.type === 'text') this.app.measure(element);
    this.app.syncGeometry(); this.app.store.pageHistory(); this.app.persistence.schedule();
  }
  addPage() {
    this.finish(); const s = this.app.state;
    let number = 1; while (s.pages.some(page => page.name === `Page ${number}`)) number++;
    const page = blankPage(`Page ${number}`); s.pages.push(page); this.switchPage(page.id);
  }
  renamePage(id: string, name: string) {
    const page = this.app.state.pages.find(page => page.id === id);
    if (page && name.trim()) { page.name = name.trim().slice(0, 100); this.app.persistence.schedule(); }
  }
  duplicatePage(id: string) {
    this.finish(); const s = this.app.state, source = projectPages(s).find(page => page.id === id); if (!source) return;
    const page = { ...blankPage(`${source.name} copy`), background: source.background, pan: snapshot(source.pan), zoom: source.zoom };
    page.elements = copyElements(snapshot(source.elements), { x: 0, y: 0 });
    const groups = new Map([...new Set(source.elements.flatMap(element => element.groupIds))].map(id => [id, uid()]));
    source.elements.forEach((element, index) => { page.elements[index].groupIds = element.groupIds.map(id => groups.get(id)!); });
    const keys = new Map<string, string>();
    source.elements.forEach((element, index) => {
      const copy = page.elements[index]; keys.set(`e:${element.id}`, `e:${copy.id}`);
      element.groupIds.forEach((group, groupIndex) => { if (copy.groupIds[groupIndex]) keys.set(`g:${group}`, `g:${copy.groupIds[groupIndex]}`); });
    });
    for (const [key, value] of Object.entries(source.layers)) if (keys.has(key)) page.layers[keys.get(key)!] = snapshot(value);
    s.pages.splice(s.pages.findIndex(page => page.id === id) + 1, 0, page); this.switchPage(page.id);
  }
  reorderPage(id: string, target: string) {
    const s = this.app.state, from = s.pages.findIndex(page => page.id === id), to = s.pages.findIndex(page => page.id === target);
    if (from < 0 || to < 0 || from === to) return;
    const [page] = s.pages.splice(from, 1); s.pages.splice(to, 0, page); this.app.persistence.schedule();
  }
  deletePage(id: string) {
    const s = this.app.state; if (s.pages.length < 2) return;
    const index = s.pages.findIndex(page => page.id === id); if (index < 0) return;
    this.finish();
    if (s.activePageId === id) this.switchPage(s.pages[index ? index - 1 : 1].id);
    s.pages = s.pages.filter(page => page.id !== id); s.deletingPage = null;
    this.app.store.pageHistory(); this.app.persistence.schedule();
  }
  replaceProject(project: Project) {
    this.finish(); const s = this.app.state;
    s.pages = project.pages; s.activePageId = ''; s.name = project.name;
    activatePage(s, project.activePageId); this.app.store.resetHistory(true);
    for (const element of s.elements) if (element.type === 'text') this.app.measure(element);
    this.app.syncGeometry(); this.app.persistence.schedule();
  }
  replaceCanvas(page: CanvasPage, name: string) {
    if (this.app.state.pages.length === 1) {
      this.finish(); const s = this.app.state;
      s.elements = page.elements; s.layers = page.layers; s.background = page.background; s.selected.clear(); s.editingGroup = null; s.name = name;
      this.app.commit();
    } else this.replaceProject({ type: 'sketchify', version: 1, pages: [page], name, activePageId: page.id });
  }
  selectLayer(key: string, additive = false, reveal = false) {
    this.finish(); const s = this.app.state, model = layerModel(s.elements, s.layers), node = model.nodes.get(key); if (!node) return;
    const members = node.group ? layerMembers(node) : [node.element!];
    if (!additive) s.selected.clear();
    const remove = additive && members.every(element => s.selected.has(element.id));
    for (const element of members) if (remove) s.selected.delete(element.id); else s.selected.add(element.id);
    const groupMember = node.group ? members.find(element => element.groupIds.includes(node.group!)) : undefined;
    s.editingGroup = node.group && groupMember ? groupMember.groupIds[groupMember.groupIds.indexOf(node.group) + 1] ?? null : node.element?.groupIds[0] ?? null;
    s.tool = 'selection'; if (innerWidth > 760) s.panel = true;
    if (reveal && !remove) this.app.revealLayer(members.filter(element => !model.hidden.has(element.id)));
  }
  renameLayer(key: string, name: string) {
    const s = this.app.state, model = layerModel(s.elements, s.layers), node = model.nodes.get(key); if (!node) return;
    if (s.layers[key]?.locked || node.element?.locked || layerAncestors(model, key).some(parent => s.layers[parent.key]?.locked || parent.element?.locked)) return;
    if (node.element?.type === 'frame') node.element.name = name.trim().slice(0, 100) || 'Frame';
    else s.layers[key] = { ...s.layers[key], name: name.trim().slice(0, 100) || undefined };
    this.app.commit();
  }
  toggleLayer(key: string, flag: 'hidden' | 'locked') {
    this.finish(); const s = this.app.state, model = layerModel(s.elements, s.layers), node = model.nodes.get(key); if (!node) return;
    if (flag === 'locked' && layerAncestors(model, key).some(parent => s.layers[parent.key]?.locked || parent.element?.locked)) return;
    const value = flag === 'locked' ? !(s.layers[key]?.locked || node.element?.locked) : !s.layers[key]?.hidden;
    s.layers[key] = { ...s.layers[key], [flag]: value };
    if (flag === 'locked' && node.element) node.element.locked = false;
    if (flag === 'hidden') for (const element of layerMembers(node)) s.selected.delete(element.id);
    this.app.commit();
  }
  moveLayer(source: string, target: string | null, position: 'before' | 'after' | 'inside') {
    this.finish(); const s = this.app.state;
    const moved = moveLayer(s.elements, s.layers, source, target, position);
    if (!moved) { this.app.toast('That layer cannot be moved there.'); return false; }
    s.elements = moved; this.app.commit(); return true;
  }
}
