import { useSyncExternalStore } from 'react';
import { useBoard } from './context';
import { Icon } from './Icon';

const subscribePlatform = () => () => {};
const commandKey = () => /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘O' : 'Ctrl+O';
const serverCommandKey = () => 'Ctrl+O';

function Pointer({ down = false }: { down?: boolean }) {
  return <svg className={`onboarding-pointer${down ? ' pointer-down' : ''}`} width="64" height="58" viewBox="0 0 64 58" fill="none" aria-hidden="true">
    <path d="M57 52C24 51 13 34 14 5M5 17 14 4l9 13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

export function Onboarding() {
  const { state: s, run } = useBoard();
  const openShortcut = useSyncExternalStore(subscribePlatform, commandKey, serverCommandKey);
  const empty = s.elements.length === 0;
  const drawing = s.tool !== 'selection' || !!s.gesture || s.space || !!s.editing;
  const workspaceOpen = s.sidebar && !s.preferences.zenMode;
  return <>
    <section id="welcome" className="welcome" aria-label="Empty canvas" hidden={!empty} data-pass-through={drawing} data-workspace-open={workspaceOpen}>
      <div className="welcome-brand">
        <div className="brand-mark" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- Small local asset served directly by the static export. */}
          <img src="/sketchify-mark.png" width={62} height={62} alt="" draggable={false} />
        </div>
        <h1>Sketchify</h1>
      </div>
      <p className="welcome-subtitle">A little space for your big ideas.</p>
      <p className="welcome-mobile-instruction">Pick a tool below to start drawing.</p>
      <div className="welcome-actions">
        <button type="button" onClick={() => run(a => { a.setTool('rectangle'); a.canvas.focus(); })}><Icon name="rectangle" /><span>Create a shape</span><kbd>R</kbd></button>
        <button type="button" onClick={() => run(a => a.action('open'))}><Icon name="open" /><span>Open</span><kbd>{openShortcut}</kbd></button>
        <button type="button" onClick={() => run(a => a.openDialog('help'))}><Icon name="help" /><span>Help</span><kbd>?</kbd></button>
      </div>
      <p className="local-note">Saved in this browser. Save a file for backup.</p>
    </section>
    <div className="onboarding-hints" hidden={!empty} data-workspace-open={workspaceOpen}>
      <aside className="onboarding-tip onboarding-menu" aria-label="Files and settings tip">
        <Pointer /><h2>Your files, pages & preferences</h2>
        <p>Open, save, or export as PNG and SVG.<br />Organize pages & layers next door.<br />Change the theme or turn on the grid.</p>
      </aside>
      <aside className="onboarding-tip onboarding-tools" aria-label="Drawing tools tip">
        <Pointer /><h2>Pick a tool & start drawing</h2>
        <p>Choose a shape, arrow, pen, or text.<br />Then change its colors & style in the side panel.</p>
      </aside>
      <div className="onboarding-bottom">
        <aside className="onboarding-tip onboarding-navigation" aria-label="Canvas navigation tip">
          <h2>Move around the canvas</h2>
          <p>Hold <kbd>Space</kbd> + drag to pan.<br />Use zoom or fit to see more.</p><Pointer down />
        </aside>
        <aside className="onboarding-tip onboarding-help" aria-label="Keyboard shortcuts tip">
          <h2>Shortcuts & help</h2>
          <p>Press <kbd>?</kbd> for keyboard shortcuts.<br />Find every tool and action here.</p><Pointer down />
        </aside>
      </div>
    </div>
  </>;
}
