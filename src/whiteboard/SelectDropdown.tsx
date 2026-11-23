import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from './Icon';

type SelectOption = {
  value: string;
  label: string;
  icon?: string;
};

type SelectDropdownProps = {
  id?: string;
  label: string;
  value: string | null;
  options: readonly SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function SelectDropdown({ id, label, value, options, placeholder, disabled, onChange }: SelectDropdownProps) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const listId = `${triggerId}-options`;
  const [open, setOpen] = useState(false), [activeValue, setActiveValue] = useState(value);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const revealActive = useRef(false);
  const selected = options.find(option => option.value === value);
  const first = selected ?? options[0];
  const active = options.find(option => option.value === activeValue) ?? first;
  const expanded = open && !disabled && !!active;
  const optionId = (value: string) => `${triggerId}-option-${encodeURIComponent(value)}`;

  useEffect(() => {
    if (!expanded) return;
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [expanded]);

  useLayoutEffect(() => {
    if (!expanded || !revealActive.current) return;
    revealActive.current = false;
    root.current?.querySelector('[data-active="true"]')?.scrollIntoView?.({ block: 'nearest' });
  });

  const highlight = (option: SelectOption) => {
    revealActive.current = true;
    setActiveValue(option.value);
    setOpen(true);
  };
  const choose = (option: SelectOption) => {
    trigger.current?.focus({ preventScroll: true });
    setOpen(false);
    onChange(option.value);
  };
  const navigate = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      if (expanded) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
      return;
    }
    if (event.key === 'Tab') { setOpen(false); return; }
    if (!active || !first || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (expanded) choose(active);
      else highlight(first);
      return;
    }
    let next: SelectOption | undefined;
    if (event.key === 'Home') next = options[0];
    else if (event.key === 'End') next = options.at(-1);
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const step = event.key === 'ArrowDown' ? 1 : -1;
      next = expanded ? options[(options.indexOf(active) + step + options.length) % options.length] : first;
    } else if (event.key.length === 1) {
      next = options.find(option => option.label.toLowerCase().startsWith(event.key.toLowerCase()));
    }
    if (next) { event.preventDefault(); event.stopPropagation(); highlight(next); }
  };

  return <div className="select-dropdown" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} type="button" id={triggerId} role="combobox" disabled={disabled || !first} aria-label={`${label} ${selected?.label ?? placeholder ?? ''}`.trimEnd()} aria-haspopup="listbox" aria-expanded={expanded} aria-controls={expanded ? listId : undefined} aria-activedescendant={expanded ? optionId(active.value) : undefined}
      onKeyDown={navigate} onClick={event => {
        event.currentTarget.focus({ preventScroll: true });
        if (expanded) setOpen(false);
        else if (first) highlight(first);
      }}>
      <span>{selected?.label ?? placeholder}</span><Icon name="chevron" />
    </button>
    {expanded && <div id={listId} className="select-dropdown-options" role="listbox" aria-label={label}>
      {options.map(option => <button key={option.value} type="button" id={optionId(option.value)} className="select-dropdown-option" role="option" aria-selected={value === option.value} data-active={active.value === option.value} tabIndex={-1}
        onPointerMove={() => setActiveValue(option.value)} onPointerDown={event => event.preventDefault()} onClick={() => choose(option)}>
        {option.icon && <Icon name={option.icon} />}<span>{option.label}</span>{value === option.value && <Icon name="check" />}
      </button>)}
    </div>}
  </div>;
}
