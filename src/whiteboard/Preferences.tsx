import { useBoard } from './context';
import { Icon } from './Icon';
import type { Preference } from './store';

const groups: { title: string; items: { key: Preference | 'grid'; label: string; description: string; shortcut?: string }[] }[] = [
  { title: 'Canvas', items: [
    { key: 'minimap', label: 'Minimap', description: 'See your drawing at a glance. Click to navigate.' },
    { key: 'canvasProperties', label: 'Canvas & shape properties', description: 'Show storage, dimensions, and selection details.' },
    { key: 'grid', label: 'Grid', description: 'Show the dot grid and snap objects into place.', shortcut: "⌘'" },
  ] },
  { title: 'Drawing', items: [
    { key: 'arrowBinding', label: 'Arrow binding', description: 'Attach arrows and lines to shapes as you draw.' },
    { key: 'toolbarHints', label: 'Toolbar hints', description: 'Show tool shortcuts and drawing tips.' },
    { key: 'zenMode', label: 'Zen mode', description: 'Toggle with Option+z. Press Esc to return.', shortcut: '⌥z' },
  ] },
];

export function Preferences() {
  const { state: s, run } = useBoard();
  return <>
    <div className="preferences-head">
      <button className="icon-button" aria-label="Back to settings" onClick={() => run(a => { a.state.menuPage = 'main'; })}><Icon name="backArrow" /></button>
      <h2>Preferences</h2>
      <button className="icon-button" aria-label="Close preferences" onClick={() => run(a => { a.state.menu = false; a.get('menu-button').focus(); })}><Icon name="close" /></button>
    </div>
    {groups.map(group => <section className="preference-group" key={group.title} aria-label={group.title}>
      <h3>{group.title}</h3>
      {group.items.map(({ key, label, description, shortcut }) => {
        const checked = key === 'grid' ? s.grid : s.preferences[key];
        return <button key={key} id={`preference-${key}`} className="preference-row" role="switch" aria-checked={checked} aria-labelledby={`preference-${key}-label`} aria-describedby={`preference-${key}-description`} onClick={() => run(a => a.togglePreference(key))}>
          <span className="preference-copy"><span className="preference-title"><span id={`preference-${key}-label`} className="preference-label">{label}</span>{shortcut && <kbd aria-hidden="true">{shortcut}</kbd>}</span><span id={`preference-${key}-description`} className="preference-description">{description}</span></span>
          <span className="preference-track" aria-hidden="true"><span className="preference-thumb">{checked && <Icon name="check" />}</span></span>
        </button>;
      })}
    </section>)}
    <section className="preference-group preference-size">
      <h3 id="icon-text-size-label">Icon and text size</h3>
      <div className="panel-size-options" role="group" aria-labelledby="icon-text-size-label">
        {(['small', 'medium', 'large'] as const).map(size => <button key={size} type="button" aria-pressed={s.iconTextSize === size} onClick={() => run(a => { a.state.iconTextSize = size; a.persistence.schedule(); })}>{size[0].toUpperCase() + size.slice(1)}</button>)}
      </div>
    </section>
    <p className="preferences-note">Changes are saved on this device.</p>
  </>;
}
