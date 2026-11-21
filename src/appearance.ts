export const CANVAS_BACKGROUNDS = [
  { light: '#ffffff', dark: '#121212' },
  { light: '#f8f9fa', dark: '#1e1e1e' },
  { light: '#fffce8', dark: '#292719' },
  { light: '#edf2ff', dark: '#1c2333' },
  { light: '#f3faf5', dark: '#1b2921' },
];

export function applyAppearance(theme: unknown, background: unknown, palette = CANVAS_BACKGROUNDS) {
  const dark = theme === 'dark';
  const savedColor = typeof background === 'string' && /^#[0-9a-f]{6}$/i.test(background) ? background.toLowerCase() : '#ffffff';
  const color = dark ? palette.find(option => option.light === savedColor)?.dark ?? savedColor : savedColor;
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.setProperty('--canvas', color);
  root.style.backgroundColor = color;
  root.style.colorScheme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
}

export const appearanceBootstrap = `try {
  const saved = JSON.parse(localStorage.getItem('sketchify.scene.v1') || 'null');
  const local = saved?.local;
  (${applyAppearance.toString()})(local?.theme, local?.background, ${JSON.stringify(CANVAS_BACKGROUNDS)});
  if (saved && typeof saved === 'object') {
    const root = document.documentElement;
    const pages = saved.project?.pages;
    const activePage = Array.isArray(pages) ? pages.find(page => page.id === saved.project.activePageId) || pages[0] : null;
    const elements = activePage?.elements ?? saved.elements;
    root.setAttribute('data-startup', '');
    root.setAttribute('data-startup-content', String(Array.isArray(elements) && elements.length > 0));
    root.setAttribute('data-startup-size', local?.iconTextSize === 'small' || local?.iconTextSize === 'large' ? local.iconTextSize : 'medium');
    root.setAttribute('data-startup-zen', String(local?.preferences?.zenMode === true));
    root.setAttribute('data-startup-hints', String(local?.preferences?.toolbarHints !== false));
  }
} catch {}`;
