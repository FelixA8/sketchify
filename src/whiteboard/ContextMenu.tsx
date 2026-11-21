import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { useBoard } from './context';
import { selectionWithChildren } from './object-actions';
import { groupingOptions } from './groups';
import { layerModel } from './layers';
const subscribePlatform = () => () => {};
const commandKey = () => /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';
const serverCommandKey = () => 'Ctrl+';

export function ContextMenu() {
  const { state: s, run } = useBoard(), menu = useRef<HTMLElement>(null);
  const selected = selectionWithChildren(s.elements, s.selected);
  const { locked } = layerModel(s.elements, s.layers);
  const hasSelection = selected.length > 0, editable = hasSelection && selected.every(element => !locked.has(element.id));
  const boundText = s.elements.some(element => element.type === 'text' && element.containerId && !element.locked && selected.some(parent => parent.id === element.id || parent.id === element.containerId));
  const command = useSyncExternalStore(subscribePlatform, commandKey, serverCommandKey);
  const option = command === '⌘' ? '⌥' : 'Alt+';
  const { canGroup, canUngroup } = groupingOptions(s.elements, selected, s.editingGroup);
  const groups: [string, string, string?, boolean?][][] = [
    [['cut', 'Cut', `${command}x`, editable], ['copy', 'Copy', `${command}c`, hasSelection], ['paste', 'Paste', `${command}v`, true]],
    [['wrap-frame', 'Wrap selection in frame', undefined, editable]],
    [['group', 'Group', `${command}g`, editable && canGroup], ['ungroup', 'Ungroup', `${command}Shift+g`, editable && canUngroup]],
    [['copy-png', 'Copy to clipboard as PNG', `Shift+${option}c`, hasSelection], ['copy-svg', 'Copy to clipboard as SVG', undefined, hasSelection], ['copy-text', 'Copy to clipboard as text', undefined, selected.some(element => element.type === 'text' && element.text)]],
    [['copy-styles', 'Copy styles', `${command}${option}c`, hasSelection], ['paste-styles', 'Paste styles', `${command}${option}v`, editable && !!s.styleClipboard]],
    [['unbind-text', 'Unbind text', undefined, editable && boundText]],
    [['backward', 'Send backward', `${command}[`, editable], ['forward', 'Bring forward', `${command}]`, editable], ['back', 'Send to back', `${command}${option}[`, editable], ['front', 'Bring to front', `${command}${option}]`, editable]],
    [['flip-horizontal', 'Flip horizontal', 'Shift+h', editable], ['flip-vertical', 'Flip vertical', 'Shift+v', editable]],
    [['object-link', selected.some(element => element.link) ? 'Edit link' : 'Add link', `${command}k`, editable], ['copy-object-link', 'Copy link to object', undefined, selected.length === 1]],
    [['duplicate', 'Duplicate', `${command}d`, editable], ['lock', hasSelection && selected.every(element => locked.has(element.id)) ? 'Unlock' : 'Lock', `${command}Shift+l`, hasSelection]],
    [['delete', 'Delete', 'Delete', editable]],
  ];
  useLayoutEffect(() => {
    if (!s.contextMenu || !menu.current) return;
    const element = menu.current;
    element.style.left = `${Math.max(8, Math.min(s.contextMenu.x, window.innerWidth - element.offsetWidth - 8))}px`;
    element.style.top = `${Math.max(8, Math.min(s.contextMenu.y, window.innerHeight - element.offsetHeight - 8))}px`;
    element.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
  }, [s.contextMenu]);
  return <section ref={menu} id="object-context-menu" className="surface context-menu" role="menu" aria-label="Object actions" hidden={!s.contextMenu} onContextMenu={event => event.preventDefault()} onKeyDown={event => {
    if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); run(a => a.objects.closeMenu()); return; }
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    let next = index;
    if (event.key === 'ArrowDown') next = (index + 1) % items.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return;
    event.preventDefault(); event.stopPropagation(); items[next]?.focus();
  }}>
    {groups.map((items, index) => <div role="none" key={items[0][0]}>{index > 0 && <hr role="separator" />}{items.map(([action, label, shortcut, enabled]) => <button key={action} type="button" role="menuitem" tabIndex={-1} className={`context-item${action === 'delete' ? ' danger' : ''}`} data-context-action={action} disabled={!enabled} onClick={() => run(a => a.objects.execute(action))}><span>{label}</span>{shortcut && <kbd>{shortcut}</kbd>}</button>)}</div>)}
  </section>;
}
