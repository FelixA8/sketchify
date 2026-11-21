import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from './Icon';

export function ExportScope({ selected, hasSelection, onChange }: { selected: boolean; hasSelection: boolean; onChange: (selected: boolean) => void }) {
  const [open, setOpen] = useState(false), [active, setActive] = useState(selected);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const options = [{ selected: false, label: 'Entire page', icon: 'image' }, ...(hasSelection ? [{ selected: true, label: 'Selected elements', icon: 'selection' }] : [])];
  const optionId = (value: boolean) => `export-scope-option-${value ? 'selected' : 'all'}`;
  const choose = (value: boolean) => { onChange(value); setOpen(false); trigger.current?.focus(); };

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  const navigate = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      if (open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
      return;
    }
    if (event.key === 'Tab') { setOpen(false); return; }
    if (['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      if (open) choose(active); else { setActive(selected); setOpen(true); }
      return;
    }
    const index = options.findIndex(option => option.selected === active);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : !open ? Math.max(0, options.findIndex(option => option.selected === selected)) : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      setActive(options[next].selected); setOpen(true);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const option = options.find(option => option.label.toLowerCase().startsWith(event.key.toLowerCase()));
      if (option) { event.preventDefault(); setActive(option.selected); setOpen(true); }
    }
  };

  return <div className="export-scope-control" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} type="button" id="export-scope" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls="export-scope-options" aria-labelledby="export-scope-label export-scope-value" aria-activedescendant={open ? optionId(active) : undefined} onKeyDown={navigate} onClick={() => { setActive(selected); setOpen(!open); }}>
      <span id="export-scope-value">{selected ? 'Selected elements' : 'Entire page'}</span><Icon name="chevron" />
    </button>
    {open && <div id="export-scope-options" className="export-scope-options" role="listbox" aria-labelledby="export-scope-label">
      {options.map(option => <button key={String(option.selected)} type="button" id={optionId(option.selected)} className="export-scope-option" role="option" aria-selected={selected === option.selected} data-active={active === option.selected} tabIndex={-1} onPointerMove={() => setActive(option.selected)} onPointerDown={event => event.preventDefault()} onClick={() => choose(option.selected)}>
        <Icon name={option.icon} /><span>{option.label}</span>{selected === option.selected && <Icon name="check" />}
      </button>)}
    </div>}
  </div>;
}
