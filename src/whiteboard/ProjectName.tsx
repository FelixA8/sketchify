import { useLayoutEffect, useRef, useState } from 'react';
import { useBoard } from './context';
import { projectNameLabel, renamedProject } from './project-name';

export function ProjectName() {
  const { state: s, run } = useBoard();
  const [editing, setEditing] = useState(false);
  const input = useRef<HTMLInputElement>(null), button = useRef<HTMLButtonElement>(null);
  const finishing = useRef(false), returnFocus = useRef(false);
  const label = projectNameLabel(s.name);
  useLayoutEffect(() => {
    if (editing) { finishing.current = false; input.current?.focus({ preventScroll: true }); input.current?.select(); }
    else if (returnFocus.current) { returnFocus.current = false; button.current?.focus({ preventScroll: true }); }
  }, [editing]);
  function finish(cancel = false, restoreFocus = false) {
    if (!input.current || finishing.current) return;
    finishing.current = true; returnFocus.current = restoreFocus;
    const value = input.current.value;
    setEditing(false);
    if (!cancel) run(a => {
      const name = renamedProject(value, a.state.name);
      if (name !== a.state.name) { a.state.name = name; a.persistence.schedule(); }
    });
  }
  return <div className="document-meta">
    <button ref={button} type="button" id="project-name-button" className="document-name" aria-label={`Rename project: ${label}`} title="Click to rename project"
      style={{ visibility: editing ? 'hidden' : undefined }}
      onClick={() => setEditing(true)}>
      <span>{label}</span>
    </button>
    {editing && <input ref={input} id="project-name" className="document-name document-name-input" aria-label="Project name" defaultValue={label} maxLength={100} autoComplete="off" spellCheck={false}
      onBlur={() => finish()}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Enter' || event.key === 'Escape') {
          event.preventDefault(); finish(event.key === 'Escape', true);
        }
      }} />}
    <span id="save-state" className="sr-only" role="status" aria-live="polite">{s.saveState}</span>
  </div>;
}
