import { importScene } from '../scene';
import type { State, Store } from './store';
import { DEFAULT_PREFERENCES, DEFAULT_NOTE_STYLE, type Preference } from './store';
import { activatePage, projectData, readProject } from './project';
export const SCENE_KEY = 'sketchify.scene.v1';
export function storedScene(s: State) {
  return { elements: s.elements, project: projectData(s), local: {
    pan: s.pan, zoom: s.zoom, background: s.background, theme: s.theme,
    grid: s.grid, name: s.name, rectangleRoundness: s.style.roundness,
    ...(JSON.stringify(s.noteStyle) !== JSON.stringify(DEFAULT_NOTE_STYLE) ? { noteStyle: s.noteStyle } : {}),
    sidebar: s.sidebar,
    ...(s.sidebarWidth !== null ? { sidebarWidth: s.sidebarWidth } : {}),
    ...(s.iconTextSize !== 'medium' ? { iconTextSize: s.iconTextSize } : {}),
    ...(Object.keys(DEFAULT_PREFERENCES).some(key => s.preferences[key as Preference] !== DEFAULT_PREFERENCES[key as Preference]) ? { preferences: s.preferences } : {}),
  } };
}
export function loadStorage(store: Store, storage: Storage) {
  let error = '';
  store.change(s => {
    try {
      const saved = storage.getItem(SCENE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        s.elements = importScene(data).elements;
        if (data.project) {
          const { project, skipped } = readProject(data.project);
          if (skipped) throw new Error('Unsupported saved elements.');
          s.pages = project.pages; s.activePageId = '';
          activatePage(s, project.activePageId); s.name = project.name;
        }
        if (data.local) {
          s.pan = data.local.pan || s.pan;
          s.zoom = Math.max(.1, Math.min(5, Number(data.local.zoom) || 1));
          s.background = data.local.background || '#ffffff';
          s.theme = data.local.theme === 'dark' ? 'dark' : 'light'; s.grid = Boolean(data.local.grid);
          s.sidebar = data.local.sidebar === true;
          if (typeof data.local.sidebarWidth === 'number' && Number.isFinite(data.local.sidebarWidth) && data.local.sidebarWidth > 0) s.sidebarWidth = data.local.sidebarWidth;
          if (data.local.noteStyle && typeof data.local.noteStyle === 'object') {
            const note = importScene({ elements: [{ ...data.local.noteStyle, type: 'stickynote', width: 250, height: 250 }] }).elements[0];
            if (note) for (const key of ['backgroundColor', 'strokeColor', 'fontSize', 'fontFamily', 'opacity', 'textAlign'] as const) Object.assign(s.noteStyle, { [key]: note[key] });
          }
          if (typeof data.local.name === 'string' && data.local.name.trim() && data.local.name !== 'Untitled') s.name = data.local.name;
          s.iconTextSize = data.local.iconTextSize === 'small' || data.local.iconTextSize === 'large' ? data.local.iconTextSize : 'medium';
          for (const key of Object.keys(DEFAULT_PREFERENCES) as Preference[]) {
            if (typeof data.local.preferences?.[key] === 'boolean') s.preferences[key] = data.local.preferences[key];
          }
          const rounding = data.local.rectangleRoundness;
          s.style.roundness = rounding?.type === 3 ? {
            type: 3,
            ...(typeof rounding.value === 'number' && Number.isFinite(rounding.value) ? { value: Math.max(0, rounding.value) } : {}),
          } : null;
        }
      }
    } catch { error = 'Saved data could not be read. You can open an exported .excalidraw file from the menu.'; }
  });
  store.resetHistory(true);
  return error;
}
export function createPersistence(store: Store, toast: (message: string, error?: boolean) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  function persist() {
    clearTimeout(timer);
    try {
      const s = store.state;
      localStorage.setItem(SCENE_KEY, JSON.stringify(storedScene(s)));
      store.change(s => { s.saveState = 'Saved on this device'; });
    } catch {
      store.change(s => { s.saveState = 'Save a file to keep your work'; });
      toast('Browser storage is unavailable or full. Use Save to file to keep your drawing.', true);
    }
  }
  return {
    persist,
    schedule() { store.change(s => { s.saveState = 'Saving…'; }); clearTimeout(timer); timer = setTimeout(persist, 300); },
    dispose() { clearTimeout(timer); },
  };
}
