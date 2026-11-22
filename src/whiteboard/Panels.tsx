import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { useBoard } from './context';
import { Icon } from './Icon';
import { Preferences } from './Preferences';
import { CANVAS_BACKGROUNDS } from '../appearance';
function MenuItem({ action, label, glyph, shortcut }: { action: string; label: string; glyph: string; shortcut?: string }) {
  const { run } = useBoard();
  return <button className="menu-item" data-action={action} onClick={() => run(a => a.action(action))}><Icon name={glyph} />{label}{shortcut && <kbd>{shortcut}</kbd>}</button>;
}
export function Menu() {
  const { state: s, run } = useBoard(), menu = useRef<HTMLElement>(null);
  useLayoutEffect(() => { if (s.menu) menu.current?.querySelector('button')?.focus(); }, [s.menu, s.menuPage]);
  return <section ref={menu} id="menu" className={`surface dropdown${s.menuPage === 'preferences' ? ' preferences-menu' : ''}`} aria-label={s.menuPage === 'preferences' ? 'Preferences' : 'Main menu'} hidden={!s.menu} onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); run(a => { a.state.menu = false; a.get('menu-button').focus(); }); }
    else if (s.menuPage === 'preferences' && !event.metaKey && !event.ctrlKey && !event.altKey) event.stopPropagation();
  }}>
    {s.menuPage === 'preferences' ? <Preferences /> : <>
    <MenuItem action="open" label="Open a drawing" glyph="open" shortcut="⌘o" /><MenuItem action="save" label="Save to file" glyph="save" shortcut="⌘s" /><MenuItem action="export" label="Export image" glyph="export" />
    <hr className="menu-separator" /><MenuItem action="rename" label="Rename drawing" glyph="text" /><MenuItem action="preferences" label="Preferences" glyph="settings" /><MenuItem action="clear" label="Clear canvas" glyph="trash" />
    <hr className="menu-separator" /><div className="menu-heading">Appearance</div><div className="theme-picker">{(['light', 'dark'] as const).map(theme => <button key={theme} data-action={theme} aria-pressed={s.theme === theme} onClick={() => run(a => a.theme(theme))}><Icon name={theme === 'light' ? 'sun' : 'moon'} />{theme === 'light' ? 'Light' : 'Dark'}</button>)}</div>
    <div className="menu-heading">Canvas background</div><div className="canvas-colors swatches">{CANVAS_BACKGROUNDS.map(option => <button key={option.light} className="swatch" style={{ '--color': option[s.theme] } as CSSProperties} data-background={option.light} aria-label={`Canvas ${option[s.theme]}`} aria-pressed={s.background.toLowerCase() === option.light} onClick={() => run(a => { a.state.background = option.light; a.persistence.schedule(); })} />)}</div>
    <hr className="menu-separator" />
    <MenuItem action="help" label="Keyboard shortcuts" glyph="help" shortcut="?" />
    <a className="menu-item" href="https://forms.gle/AtpuDWgYtMiseJzE8" target="_blank" rel="noopener noreferrer" aria-label="Share your experience (opens in a new tab)">
      <Icon name="arrow" />Share your experience
    </a>
    <div className="menu-heading">Local editor · No account required</div>
    <div className="menu-heading">built on top of excalidraw framework <a href="https://excalidraw.com" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>excalidraw.com</a></div>
    </>}
  </section>;
}
