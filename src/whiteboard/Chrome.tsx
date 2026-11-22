import { useBoard } from './context';
import { Icon } from './Icon';
import { hints, tools } from './tools';
import { ProjectName } from './ProjectName';
import { Onboarding } from './Onboarding';
import { useSyncExternalStore } from 'react';
import { selectedElements } from './canvas';
import { layerModel } from './layers';
const subscribePlatform = () => () => {};
const commandKey = () => /Mac|iPhone|iPad/.test(navigator.platform) ? 'Cmd' : 'Ctrl';
const serverCommandKey = () => 'Ctrl';
export function Chrome() {
  const { state: s, run } = useBoard();
  const command = useSyncExternalStore(subscribePlatform, commandKey, serverCommandKey);
  const selected = selectedElements(s), shape = selected.length === 1 ? selected[0] : null;
  const flowchartHint = s.tool === 'selection' && shape && ['rectangle', 'ellipse', 'diamond'].includes(shape.type)
    && shape.width > 0 && shape.height > 0 && !layerModel(s.elements, s.layers).locked.has(shape.id)
    && !s.editing && !s.gesture && !s.space && !s.menu && !s.contextMenu && !s.dialog;
  return <>
    <div id="board-chrome" hidden={s.preferences.zenMode} className={s.preferences.toolbarHints ? '' : 'hide-toolbar-hints'}>
    <div className="top-left"><button id="menu-button" className="surface icon-button" aria-label="Main menu" aria-expanded={s.menu} title="Main menu" onClick={() => run(a => { a.state.menuPage = 'main'; a.state.menu = !a.state.menu; })}><Icon name="menu" /></button><button id="workspace-toggle" className="surface icon-button" aria-label="Toggle pages and layers" aria-controls="workspace" aria-expanded={s.sidebar} title="Pages and layers" onClick={() => run(a => { a.state.sidebar = !a.state.sidebar; a.persistence.schedule(); })}><Icon name="sidebar" /></button><ProjectName /></div>
    <nav id="toolbar" className="surface toolbar" aria-label="Drawing tools"><button className="tool tool-lock" id="lock-button" aria-label="Keep drawing tool active" title="Keep drawing tool active (q)" aria-pressed={s.locked} onClick={() => run(a => { a.state.locked = !a.state.locked; })}><Icon name={s.locked ? 'lock' : 'unlock'} /></button><span className="divider" />{tools.map(([id, label, number, shortcut]) => <button key={id} className="tool" data-tool={id} aria-label={label} aria-pressed={s.tool === id} title={`${label} (${shortcut}${number ? ` or ${number}` : ''})`} onClick={() => run(a => a.setTool(id))}><Icon name={id} /><kbd>{shortcut}</kbd></button>)}</nav>
    <div className="top-right"><button id="style-toggle" className="surface icon-button" aria-label="Toggle style panel" title="Style panel" aria-pressed={s.panel} onClick={() => run(a => { a.state.panel = !a.state.panel; })}><Icon name="settings" /></button></div>
    <p id="tool-hint" className="tool-hint" hidden={!s.preferences.toolbarHints}>{flowchartHint ? <><kbd>Enter</kbd> to add text, <kbd aria-label={`${command} plus arrow keys`}>{command} + ↑↓←→</kbd> to create a flowchart</> : hints[s.tool]}</p>
    <div className="bottom-left"><div className="surface zoom-controls"><button id="zoom-out" className="icon-button" aria-label="Zoom out" onClick={() => run(a => a.zoom(s.zoom / 1.2))}><Icon name="minus" /></button><button id="zoom-reset" className="zoom-label" title="Reset zoom" onClick={() => run(a => a.zoom(1))}>{Math.round(s.zoom * 100)}%</button><button id="zoom-in" className="icon-button" aria-label="Zoom in" onClick={() => run(a => a.zoom(s.zoom * 1.2))}><Icon name="plus" /></button><span className="divider" /><button id="fit-button" className="icon-button" aria-label="Zoom to fit" onClick={() => run(a => a.fit())}><Icon name="fit" /></button></div><div className="surface history-controls"><button id="undo-button" className="icon-button" aria-label="Undo" title="Undo (⌘z)" disabled={!s.canUndo} onClick={() => run(a => a.history('undo'))}><Icon name="undo" /></button><button id="redo-button" className="icon-button" aria-label="Redo" title="Redo (⌘⇧z)" disabled={!s.canRedo} onClick={() => run(a => a.history('redo'))}><Icon name="redo" /></button></div></div>
    <div className="bottom-right"><span id="selection-info" aria-live="polite">{s.selected.size ? `${s.selected.size} selected` : s.elements.length ? `${s.elements.length} elements` : ''}</span><button id="help-button" className="surface icon-button" aria-label="Help and keyboard shortcuts" title="Help (?)" onClick={event => run(a => a.openDialog('help', event.currentTarget))}><Icon name="help" /></button></div>
    </div>
    <Onboarding />
    {s.preferences.zenMode && <button id="exit-zen" className="surface exit-zen" title="Exit zen mode (Escape or Option+z)" onClick={() => run(a => a.togglePreference('zenMode'))}><Icon name="fit" />Exit zen mode<kbd>Esc</kbd></button>}
  </>;
}
